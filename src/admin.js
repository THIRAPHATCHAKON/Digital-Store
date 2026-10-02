import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import express, { Router } from 'express';
import multer from 'multer';
import {
  q, HttpError, EMAIL_RE, UPLOAD_DIR, SETTING_DEFAULTS, getSettings, requireAdmin, audit, page, filters,
  numericParams, toCsv, parseCsv,
} from './lib.js';
import { stripe, CARD, SOLD } from './shop.js';

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(UPLOAD_DIR, file.fieldname === 'cover' ? 'covers' : 'files')),
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.fieldname === 'cover'
      ? /^image\/(jpeg|png)$/.test(file.mimetype)
      : /\.(zip|pdf|mp4)$/i.test(file.originalname);
    cb(ok ? null : new HttpError(422, 'ประเภทไฟล์ไม่รองรับ', { errors: { [file.fieldname]: 'ประเภทไฟล์ไม่รองรับ' } }), ok);
  },
}).fields([{ name: 'cover', maxCount: 1 }, { name: 'file', maxCount: 1 }]);

const testMode = () => !process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_');
const stripeUrl = (pi) => pi && `https://dashboard.stripe.com/${testMode() ? 'test/' : ''}payments/${pi}`;
const listResult = (rows, pg) => ({ items: rows.map(({ total_rows, ...r }) => r), total: rows[0]?.total_rows ?? 0, page: pg });

export const admin = Router();
admin.use(requireAdmin); // every route admin-only
numericParams(admin, 'id');

// ---------- dashboard: /stats?days=30 ----------
admin.get('/stats', async (req, res) => {
  const days = Math.min(365, Math.max(1, parseInt(req.query.days) || 30));
  const { rows: [s] } = await q(
    `WITH cur AS (SELECT now() - make_interval(days => $1) AS since),
          prev AS (SELECT now() - make_interval(days => $1 * 2) AS since)
     SELECT
       (SELECT coalesce(sum(total), 0) FROM orders, cur WHERE status = 'PAID' AND paid_at >= cur.since) AS sales,
       (SELECT coalesce(sum(total), 0) FROM orders, cur, prev WHERE status = 'PAID' AND paid_at >= prev.since AND paid_at < cur.since) AS sales_prev,
       (SELECT count(*)::int FROM orders, cur WHERE created_at >= cur.since) AS orders,
       (SELECT count(*)::int FROM orders, cur, prev WHERE created_at >= prev.since AND created_at < cur.since) AS orders_prev,
       (SELECT count(*)::int FROM orders WHERE status = 'PENDING') AS orders_pending,
       (SELECT count(*)::int FROM products WHERE status = 'PUBLISHED') AS products_published,
       (SELECT count(*)::int FROM products WHERE status = 'DRAFT') AS products_draft,
       (SELECT count(*)::int FROM users WHERE role = 'customer') AS customers,
       (SELECT count(*)::int FROM users, cur WHERE role = 'customer' AND created_at >= cur.since) AS new_users,
       (SELECT count(*)::int FROM users, cur, prev WHERE role = 'customer' AND created_at >= prev.since AND created_at < cur.since) AS new_users_prev`,
    [days]);
  // one bar per day / week / month; generate_series keeps the empty buckets so the chart has no gaps
  const bucket = days <= 31 ? 'day' : days <= 120 ? 'week' : 'month';
  const series = await q(
    `SELECT g.t, coalesce(sum(o.total), 0) AS sales
     FROM generate_series(date_trunc($2, now() - make_interval(days => $1)), date_trunc($2, now()), ('1 ' || $2)::interval) AS g(t)
     LEFT JOIN orders o ON o.status = 'PAID' AND date_trunc($2, o.paid_at) = g.t
     GROUP BY 1 ORDER BY 1`, [days, bucket]);
  const top = await q(
    `SELECT c.name, coalesce(sum(oi.price), 0) AS sales FROM categories c
     LEFT JOIN products p ON p.category = c.slug
     LEFT JOIN order_items oi ON oi.product_id = p.id AND EXISTS (
       SELECT 1 FROM orders o WHERE o.id = oi.order_id AND o.status = 'PAID' AND o.paid_at >= now() - make_interval(days => $1))
     GROUP BY c.slug ORDER BY sales DESC, c.sort LIMIT 4`, [days]);
  const recent = await q(
    `SELECT o.order_no, u.name, u.email, o.created_at, o.total, o.status,
       (SELECT count(*)::int FROM order_items WHERE order_id = o.id) AS item_count
     FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC LIMIT 5`);
  res.json({ ...s, days, bucket, series: series.rows, topCategories: top.rows, recentOrders: recent.rows });
});

// ---------- products: /products?q=&category=&status=&sort=&page= ----------
admin.get('/products', async (req, res) => {
  const { q: term, category, status, sort } = req.query;
  const f = filters();
  if (term) f.add(`(p.name ILIKE ? OR p.seller ILIKE ? OR 'SKU-' || lpad(p.id::text, 5, '0') ILIKE ?)`, `%${term}%`);
  if (category) f.add('p.category = ?', String(category));
  if (['DRAFT', 'PUBLISHED'].includes(status)) f.add('p.status = ?', status);
  const order = { name: 'p.name', price_asc: 'p.price', price_desc: 'p.price DESC' }[sort] ?? 'p.updated_at DESC';
  const { limit, offset, page: pg } = page(req, 20);
  const { rows } = await q(
    `SELECT ${CARD}, 'SKU-' || lpad(p.id::text, 5, '0') AS sku, p.status, p.version, p.file IS NOT NULL AS has_file,
       ${SOLD} AS sold, p.updated_at, count(*) OVER ()::int AS total_rows
     FROM products p WHERE ${f.where.join(' AND ')} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, f.params);
  res.json(listResult(rows, pg));
});

admin.get('/products/:id', async (req, res) => {
  const { rows: [p] } = await q(
    `SELECT p.*, 'SKU-' || lpad(p.id::text, 5, '0') AS sku, '/api/covers/' || p.cover AS cover_url FROM products p WHERE id = $1`,
    [req.params.id]);
  if (!p) throw new HttpError(404, 'ไม่พบสินค้า');
  res.json(p);
});

// ---------- product form: multipart (fields + optional cover/file) ----------
// Shared by the form and the CSV import. `cats` is a Set of category slugs.
function productErrors(b, hasFile, cats) {
  const e = {};
  if (!String(b.name ?? '').trim()) e.name = 'กรุณากรอกชื่อสินค้า';
  if (!cats.has(b.category)) e.category = 'ไม่มีหมวดหมู่นี้';
  // Stripe refuses THB charges under ฿10 (amount_too_small)
  if (!(Number(b.price) >= 10 && Number(b.price) < 1e8)) e.price = 'ราคาต้องไม่ต่ำกว่า 10 บาท';
  if (b.compare_at && !(Number(b.compare_at) >= 0 && Number(b.compare_at) < 1e8)) e.compare_at = 'ราคาก่อนลดไม่ถูกต้อง';
  if (String(b.short_description ?? '').length > 200) e.short_description = 'คำอธิบายสั้นยาวเกิน 200 ตัวอักษร';
  if (String(b.description ?? '').length > 2000) e.description = 'รายละเอียดยาวเกิน 2,000 ตัวอักษร';
  if (b.status === 'PUBLISHED' && !hasFile) e.file = 'ต้องอัปโหลดไฟล์สินค้าก่อนเผยแพร่';
  return e;
}
const categorySlugs = async () => new Set((await q('SELECT slug FROM categories')).rows.map((r) => r.slug));
// "a, b | c" → ['a', 'b', 'c'] (commas in the form, pipes in exported CSV)
const parseTags = (v) => [...new Set(String(v ?? '').split(/[,|]/).map((t) => t.trim()).filter(Boolean))].slice(0, 10);
// Column order of the INSERT/UPDATE below and of json_to_recordset in the import.
const productRow = (b) => ({
  name: String(b.name).trim(), category: b.category, price: Number(b.price), compare_at: Number(b.compare_at) || null,
  short_description: String(b.short_description ?? '').trim(), description: String(b.description ?? ''),
  seller: String(b.seller ?? '').trim().slice(0, 100), tags: parseTags(b.tags),
  license: b.license === 'commercial' ? 'commercial' : 'personal', version: String(b.version ?? '').trim() || null,
});

async function saveProduct(req, id) {
  const old = id ? (await q('SELECT * FROM products WHERE id = $1', [id])).rows[0] : {};
  if (id && !old) throw new HttpError(404, 'ไม่พบสินค้า');
  const cover = req.files?.cover?.[0], file = req.files?.file?.[0];
  const b = { ...req.body, status: req.body.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT' };
  const errors = productErrors(b, file || old.file, await categorySlugs());
  if (Object.keys(errors).length) { // don't leave orphaned uploads behind a failed save
    await Promise.all([cover, file].filter(Boolean).map((f) => fs.rm(f.path, { force: true })));
    throw new HttpError(422, `บันทึกไม่สำเร็จ — มี ${Object.keys(errors).length} ช่องที่ต้องแก้`, { errors });
  }
  const r = productRow(b);
  const vals = [r.name, r.category, r.price, r.compare_at, r.short_description, r.description, r.seller, r.tags, r.license,
    r.version, cover?.filename ?? old.cover ?? null, file?.filename ?? old.file ?? null,
    file?.originalname ?? old.file_name ?? null, file?.size ?? old.file_size ?? null,
    file ? path.extname(file.originalname).slice(1).toUpperCase() : old.file_types ?? null, b.status];
  const { rows: [p] } = id
    ? await q(`UPDATE products SET name=$1, category=$2, price=$3, compare_at=$4, short_description=$5, description=$6,
                 seller=$7, tags=$8, license=$9, version=$10, cover=$11, file=$12, file_name=$13, file_size=$14,
                 file_types=$15, status=$16, updated_at=now()
               WHERE id = $17 RETURNING *`, [...vals, id])
    : await q(`INSERT INTO products (name, category, price, compare_at, short_description, description, seller, tags,
                 license, version, cover, file, file_name, file_size, file_types, status)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`, vals);
  // replaced files are unreachable now
  if (cover && old.cover) await fs.rm(path.join(UPLOAD_DIR, 'covers', old.cover), { force: true });
  if (file && old.file) await fs.rm(path.join(UPLOAD_DIR, 'files', old.file), { force: true });
  await audit(req.user.id, id ? 'product_update' : 'product_create', req, String(p.id));
  return p;
}

admin.post('/products', upload, async (req, res) => res.status(201).json(await saveProduct(req, null)));
admin.put('/products/:id', upload, async (req, res) => res.json(await saveProduct(req, req.params.id)));

// Publish/unpublish by id list: { ids: [], status }
admin.patch('/products', async (req, res) => {
  const status = req.body?.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
  const { rows } = await q(
    `UPDATE products SET status = $1, updated_at = now()
     WHERE id = ANY($2) AND ($1 = 'DRAFT' OR file IS NOT NULL) RETURNING id`,
    [status, [].concat(req.body?.ids ?? []).map(Number).filter(Number.isInteger)]);
  res.json({ updated: rows.map((r) => r.id) });
});

admin.delete('/products/:id', async (req, res) => {
  const { rows: [p] } = await q('SELECT id, name, cover, file FROM products WHERE id = $1', [req.params.id]);
  if (!p) throw new HttpError(404, 'ไม่พบสินค้า');
  const { rows: [{ buyers }] } = await q(
    `SELECT count(DISTINCT o.user_id)::int AS buyers FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE oi.product_id = $1`, [p.id]);

  // deleting would break buyers' downloads — refuse and let the admin switch to DRAFT instead
  if (buyers > 0) {
    throw new HttpError(409, 'ลบไม่ได้ เพราะมีผู้ซื้อแล้ว — ให้เปลี่ยนเป็น DRAFT แทน', { buyers, suggest: 'DRAFT' });
  }

  await q('DELETE FROM products WHERE id = $1', [p.id]);
  await Promise.all([
    p.cover && fs.rm(path.join(UPLOAD_DIR, 'covers', p.cover), { force: true }),
    p.file && fs.rm(path.join(UPLOAD_DIR, 'files', p.file), { force: true }),
  ]);
  await audit(req.user.id, 'product_delete', req, String(p.id));
  res.status(204).end();
});

// ---------- categories ----------
admin.get('/categories', async (req, res) => {
  const { rows } = await q(
    `SELECT c.slug, c.name, c.color, count(p.id)::int AS count FROM categories c
     LEFT JOIN products p ON p.category = c.slug GROUP BY c.slug ORDER BY c.sort, c.name`);
  res.json({ items: rows });
});

function categoryInput(b, withSlug) {
  const c = { name: String(b?.name ?? '').trim(), color: String(b?.color ?? '').toLowerCase(), slug: String(b?.slug ?? '').trim() };
  const errors = {};
  if (!c.name || c.name.length > 40) errors.name = 'กรุณากรอกชื่อหมวดหมู่ (ไม่เกิน 40 ตัวอักษร)';
  if (!/^#[0-9a-f]{6}$/.test(c.color)) errors.color = 'เลือกสีของหมวดหมู่';
  if (withSlug && !/^[a-z0-9-]{2,30}$/.test(c.slug)) errors.slug = 'ใช้ a–z, 0–9 และ - ยาว 2–30 ตัวอักษร';
  if (Object.keys(errors).length) throw new HttpError(422, 'ข้อมูลไม่ถูกต้อง', { errors });
  return c;
}

admin.post('/categories', async (req, res) => {
  const c = categoryInput(req.body, true);
  const { rows } = await q(
    `INSERT INTO categories (slug, name, color, sort) VALUES ($1, $2, $3, (SELECT coalesce(max(sort), 0) + 1 FROM categories))
     ON CONFLICT (slug) DO NOTHING RETURNING *`, [c.slug, c.name, c.color]);
  if (!rows[0]) throw new HttpError(409, 'มีหมวดหมู่ที่ใช้ slug นี้แล้ว', { errors: { slug: 'slug นี้ถูกใช้แล้ว' } });
  await audit(req.user.id, 'category_create', req, c.slug);
  res.status(201).json(rows[0]);
});

// the slug never changes: it is already in product rows and in shared catalog links
admin.put('/categories/:slug', async (req, res) => {
  const c = categoryInput(req.body, false);
  const { rows } = await q('UPDATE categories SET name = $2, color = $3 WHERE slug = $1 RETURNING *', [req.params.slug, c.name, c.color]);
  if (!rows[0]) throw new HttpError(404, 'ไม่พบหมวดหมู่');
  await audit(req.user.id, 'category_update', req, req.params.slug);
  res.json(rows[0]);
});

admin.delete('/categories/:slug', async (req, res) => {
  const { rows: [{ n }] } = await q('SELECT count(*)::int AS n FROM products WHERE category = $1', [req.params.slug]);
  if (n > 0) throw new HttpError(409, `ลบไม่ได้ เพราะยังมีสินค้า ${n} รายการในหมวดนี้ — ย้ายสินค้าไปหมวดอื่นก่อน`);
  await q('DELETE FROM categories WHERE slug = $1', [req.params.slug]);
  await audit(req.user.id, 'category_delete', req, req.params.slug);
  res.status(204).end();
});

// ---------- orders + drawer: /orders?q=&status=&from=YYYY-MM-DD&to=YYYY-MM-DD&page= ----------
admin.get('/orders', async (req, res) => {
  const { q: term, status, from, to } = req.query;
  const f = filters();
  if (term) f.add('(o.order_no ILIKE ? OR u.email ILIKE ? OR u.name ILIKE ?)', `%${term}%`);
  if (['PENDING', 'PAID', 'FAILED', 'REFUNDED'].includes(status)) f.add('o.status = ?', status);
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) f.add('o.created_at >= ?::date', from);
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) f.add(`o.created_at < ?::date + 1`, to);
  const { limit, offset, page: pg } = page(req, 20);
  const { rows } = await q(
    `SELECT o.order_no, u.name, u.email, o.created_at, o.total, o.status,
       (SELECT count(*)::int FROM order_items WHERE order_id = o.id) AS item_count, count(*) OVER ()::int AS total_rows
     FROM orders o JOIN users u ON u.id = o.user_id WHERE ${f.where.join(' AND ')}
     ORDER BY o.created_at DESC LIMIT ${limit} OFFSET ${offset}`, f.params);
  const { rows: [c] } = await q(
    `SELECT count(*) FILTER (WHERE status = 'PENDING')::int AS pending, count(*) FILTER (WHERE status = 'FAILED')::int AS failed FROM orders`);
  res.json({ ...listResult(rows, pg), counts: c });
});

admin.get('/orders/:orderNo', async (req, res) => {
  const { rows: [o] } = await q(
    `SELECT o.order_no, o.status, o.total, o.failure_code, o.payment_intent, o.created_at, o.paid_at,
       json_build_object('name', o.billing_name, 'email', o.billing_email, 'country', o.billing_country, 'address', o.billing_address) AS billing,
       json_build_object('name', u.name, 'email', u.email, 'memberSince', u.created_at,
         'orderCount', (SELECT count(*) FROM orders WHERE user_id = u.id),
         'lifetimeTotal', (SELECT coalesce(sum(total), 0) FROM orders WHERE user_id = u.id AND status = 'PAID')) AS customer,
       (SELECT json_agg(json_build_object('name', p.name, 'category', p.category, 'price', oi.price,
          'coverUrl', '/api/covers/' || p.cover, 'downloads', oi.downloads) ORDER BY oi.id)
        FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) AS items
     FROM orders o JOIN users u ON u.id = o.user_id WHERE o.order_no = $1`, [req.params.orderNo]);
  if (!o) throw new HttpError(404, 'ไม่พบคำสั่งซื้อ');
  const s = await getSettings();
  res.json({ ...o, testMode: testMode(), stripeUrl: stripeUrl(o.payment_intent), downloadLimit: Number(s.download_limit) });
});

admin.post('/orders/:orderNo/refund', async (req, res) => {
  const { rows: [o] } = await q(`SELECT id, status, payment_intent FROM orders WHERE order_no = $1`, [req.params.orderNo]);
  if (!o) throw new HttpError(404, 'ไม่พบคำสั่งซื้อ');
  if (o.status !== 'PAID') throw new HttpError(409, 'คืนเงินได้เฉพาะคำสั่งซื้อที่ชำระแล้ว');
  await stripe.refunds.create({ payment_intent: o.payment_intent });
  await q(`UPDATE orders SET status = 'REFUNDED' WHERE id = $1`, [o.id]); // revokes library access
  await audit(req.user.id, 'order_refund', req, req.params.orderNo);
  res.json({ status: 'REFUNDED' });
});

// ---------- customers: /customers?q=&status=active|disabled&page= ----------
admin.get('/customers', async (req, res) => {
  const { q: term, status } = req.query;
  const f = filters(`u.role = 'customer'`);
  if (term) f.add('(u.name ILIKE ? OR u.email ILIKE ?)', `%${term}%`);
  if (status === 'active') f.where.push('NOT u.disabled');
  if (status === 'disabled') f.where.push('u.disabled');
  const { limit, offset, page: pg } = page(req, 20);
  const { rows } = await q(
    `SELECT u.id, u.name, u.email, u.created_at, u.disabled,
       (SELECT count(*)::int FROM orders WHERE user_id = u.id) AS order_count,
       (SELECT coalesce(sum(total), 0) FROM orders WHERE user_id = u.id AND status = 'PAID') AS total_spent,
       count(*) OVER ()::int AS total_rows
     FROM users u WHERE ${f.where.join(' AND ')} ORDER BY u.created_at DESC LIMIT ${limit} OFFSET ${offset}`, f.params);
  res.json(listResult(rows, pg));
});

// Suspend / restore: { disabled }. Suspending also signs the customer out everywhere.
admin.patch('/customers/:id', async (req, res) => {
  const disabled = req.body?.disabled === true;
  const { rows: [u] } = await q(
    `UPDATE users SET disabled = $2 WHERE id = $1 AND role = 'customer' RETURNING id, disabled`, [req.params.id, disabled]);
  if (!u) throw new HttpError(404, 'ไม่พบลูกค้า');
  if (disabled) await q('DELETE FROM sessions WHERE user_id = $1', [u.id]);
  await audit(req.user.id, disabled ? 'customer_disable' : 'customer_enable', req, String(u.id));
  res.json(u);
});

// ---------- files: every uploaded product file — /files?q=&type=zip|pdf|mp4&page= ----------
admin.get('/files', async (req, res) => {
  const { q: term, type } = req.query;
  const f = filters('p.file IS NOT NULL');
  if (term) f.add('(p.file_name ILIKE ? OR p.name ILIKE ?)', `%${term}%`);
  if (['zip', 'pdf', 'mp4'].includes(type)) f.add('lower(p.file_name) LIKE ?', `%.${type}`);
  const { limit, offset, page: pg } = page(req, 20);
  const { rows } = await q(
    `SELECT p.id, p.name, p.file_name, p.file_size, p.version, p.status, p.updated_at,
       (SELECT coalesce(sum(downloads), 0)::int FROM order_items WHERE product_id = p.id) AS downloads,
       count(*) OVER ()::int AS total_rows
     FROM products p WHERE ${f.where.join(' AND ')} ORDER BY p.updated_at DESC LIMIT ${limit} OFFSET ${offset}`, f.params);
  res.json(listResult(rows, pg));
});

// ---------- payments: every order that reached Stripe — /payments?q=&status=&page= ----------
admin.get('/payments', async (req, res) => {
  const { q: term, status } = req.query;
  const f = filters('o.payment_intent IS NOT NULL');
  if (term) f.add('(o.payment_intent ILIKE ? OR o.order_no ILIKE ? OR u.email ILIKE ?)', `%${term}%`);
  if (['PENDING', 'PAID', 'FAILED', 'REFUNDED'].includes(status)) f.add('o.status = ?', status);
  const { limit, offset, page: pg } = page(req, 20);
  const { rows } = await q(
    `SELECT o.payment_intent, o.order_no, u.email, o.total, o.status, o.failure_code,
       coalesce(o.paid_at, o.created_at) AS at, count(*) OVER ()::int AS total_rows
     FROM orders o JOIN users u ON u.id = o.user_id WHERE ${f.where.join(' AND ')}
     ORDER BY o.created_at DESC LIMIT ${limit} OFFSET ${offset}`, f.params);
  res.json({ ...listResult(rows.map((r) => ({ ...r, stripeUrl: stripeUrl(r.payment_intent) })), pg), testMode: testMode() });
});

// ---------- export: /export/products|orders|customers|payments|files?format=csv|json ----------
const EXPORTS = {
  // first ten columns are exactly what the product import reads back
  products: `SELECT p.name, p.category, p.price, p.compare_at, p.short_description, p.description, p.seller, p.tags,
      p.license, p.version, p.id, p.status, p.file_name, p.file_size, p.created_at, p.updated_at FROM products p ORDER BY p.id`,
  orders: `SELECT o.order_no, u.email, o.status, o.total, o.billing_name, o.billing_email, o.billing_country,
      o.billing_address, o.created_at, o.paid_at FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id`,
  customers: `SELECT u.id, u.name, u.email, u.created_at, u.disabled,
      (SELECT count(*)::int FROM orders WHERE user_id = u.id) AS orders,
      (SELECT coalesce(sum(total), 0) FROM orders WHERE user_id = u.id AND status = 'PAID') AS total_spent
    FROM users u WHERE u.role = 'customer' ORDER BY u.id`,
  payments: `SELECT o.payment_intent, o.order_no, u.email, o.total AS amount, o.status, o.failure_code, o.created_at, o.paid_at
    FROM orders o JOIN users u ON u.id = o.user_id WHERE o.payment_intent IS NOT NULL ORDER BY o.id`,
  files: `SELECT p.id AS product_id, p.name AS product, p.file_name, p.file_size, p.version, p.status,
      (SELECT coalesce(sum(downloads), 0)::int FROM order_items WHERE product_id = p.id) AS downloads, p.updated_at
    FROM products p WHERE p.file IS NOT NULL ORDER BY p.id`,
};

admin.get('/export/:type', async (req, res) => {
  const { type } = req.params;
  if (!Object.hasOwn(EXPORTS, type)) throw new HttpError(404, 'ไม่มีข้อมูลชุดนี้');
  const { rows, fields } = await q(EXPORTS[type]);
  await audit(req.user.id, 'export', req, type);
  const name = `${type}-${new Date().toISOString().slice(0, 10)}`;
  if (req.query.format === 'json') return res.attachment(`${name}.json`).json(rows);
  res.attachment(`${name}.csv`).send(toCsv(rows, fields.map((c) => c.name)));
});

// ---------- import products from CSV: POST text/csv, ?dryRun=1 only validates ----------
// Rows become DRAFT products (files are uploaded afterwards from the product form). All or nothing.
const IMPORT_COLS = ['name', 'category', 'price', 'compare_at', 'short_description', 'description', 'seller', 'tags', 'license', 'version'];
const IMPORT_REQUIRED = ['name', 'category', 'price'];

admin.post('/import/products', express.text({ type: ['text/csv', 'text/plain'], limit: '5mb' }), async (req, res) => {
  const [head = [], ...lines] = parseCsv(typeof req.body === 'string' ? req.body : '');
  const cols = head.map((h) => h.trim().toLowerCase());
  const missing = IMPORT_REQUIRED.filter((c) => !cols.includes(c));
  const rows = lines.slice(0, 1000).map((l) => Object.fromEntries(cols.map((c, i) => [c, l[i] ?? ''])));
  const cats = await categorySlugs();
  const errors = missing.length ? [] : rows.flatMap((r, i) => {
    // imported rows are always drafts, whatever a `status` column in the file says (exports have one)
    const e = Object.values(productErrors({ ...r, status: 'DRAFT' }, false, cats));
    return e.length ? [{ row: i + 2, error: e.join(' · ') }] : []; // +2: header line, 1-based
  });
  const report = {
    columns: cols.filter((c) => IMPORT_COLS.includes(c)), ignored: cols.filter((c) => !IMPORT_COLS.includes(c)),
    missing, rows: rows.length, truncated: lines.length > 1000, errors: errors.slice(0, 50), errorCount: errors.length, imported: 0,
  };
  const ok = !missing.length && !errors.length && rows.length > 0;
  if (req.query.dryRun) return res.json({ ...report, ok });
  if (!ok) throw new HttpError(422, 'ไฟล์ยังนำเข้าไม่ได้ — แก้ข้อผิดพลาดก่อน', report);

  const { rowCount } = await q(
    `INSERT INTO products (${IMPORT_COLS.join(', ')})
     SELECT ${IMPORT_COLS.join(', ')} FROM json_to_recordset($1) AS x(name text, category text, price numeric,
       compare_at numeric, short_description text, description text, seller text, tags text[], license text, version text)`,
    [JSON.stringify(rows.map(productRow))]);
  await audit(req.user.id, 'product_import', req, String(rowCount));
  res.status(201).json({ ...report, imported: rowCount });
});

// ---------- settings ----------
admin.get('/settings', async (req, res) => res.json(await getSettings()));

admin.put('/settings', async (req, res) => {
  const entries = Object.entries(req.body ?? {})
    .filter(([k]) => Object.hasOwn(SETTING_DEFAULTS, k)).map(([k, v]) => [k, String(v ?? '').trim()]);
  const errors = {};
  for (const [k, v] of entries) {
    if (!v) errors[k] = 'ห้ามเว้นว่าง';
    else if (v.length > 200) errors[k] = 'ยาวเกิน 200 ตัวอักษร';
    else if (k.startsWith('download_') && !(/^\d+$/.test(v) && +v >= 1 && +v <= 3650)) errors[k] = 'ต้องเป็นจำนวนเต็ม 1–3650';
    else if (k === 'support_email' && !EMAIL_RE.test(v)) errors[k] = 'รูปแบบอีเมลไม่ถูกต้อง';
  }
  if (Object.keys(errors).length) throw new HttpError(422, 'บันทึกไม่สำเร็จ', { errors });
  for (const [k, v] of entries) {
    await q('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [k, v]);
  }
  await audit(req.user.id, 'settings_update', req, entries.map(([k]) => k).join(','));
  res.json(await getSettings());
});
