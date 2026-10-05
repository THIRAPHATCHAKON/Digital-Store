import express from 'express';
import { HttpError, UPLOAD_DIR, useSupabaseStorage, seedAdmin } from './lib.js';
import { auth } from './auth.js';
import { shop, stripeWebhook } from './shop.js';
import { admin } from './admin.js';

const app = express();
app.set('trust proxy', 1); // behind nginx: real client IP for audit log, https for signed URLs
let seeded;
app.use(async (req, res, next) => {
  try { seeded ||= seedAdmin(); await seeded; next(); } catch (e) { next(e); }
});

// Stripe signs the raw bytes, so this must come before express.json()
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
if (!useSupabaseStorage) {
  const path = await import('node:path');
  const fs = await import('node:fs');
  for (const d of ['covers', 'files']) fs.mkdirSync(path.join(UPLOAD_DIR, d), { recursive: true });
  app.use('/api/covers', express.static(path.join(UPLOAD_DIR, 'covers'), { maxAge: '7d' }));
} else {
  app.get('/api/covers/:key', async (req, res, next) => {
    try {
      const { storageRequest } = await import('./lib.js');
      const response = await storageRequest('GET', `covers/${req.params.key}`);
      res.set('Cache-Control', 'public, max-age=604800').type(response.headers.get('content-type') || 'application/octet-stream');
      res.send(Buffer.from(await response.arrayBuffer()));
    } catch (e) { next(e); }
  });
}
app.use('/api/auth', auth);
app.use('/api/admin', admin);
app.use('/api', shop);

app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') err = new HttpError(413, 'อัปโหลดไม่สำเร็จ — ไฟล์ใหญ่เกิน 500 MB');
  if (!(err instanceof HttpError) && !err.status) console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: status === 500 ? 'เกิดข้อผิดพลาดในระบบ' : err.message, ...err.extra });
});

if (!process.env.VERCEL) {
  await seedAdmin();
  app.listen(process.env.PORT || 4000, () => console.log(`api on :${process.env.PORT || 4000}`));
}

export default app;
