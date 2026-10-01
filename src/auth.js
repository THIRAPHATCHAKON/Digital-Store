import { Router } from 'express';
import {
  q, HttpError, EMAIL_RE, hashPassword, checkPassword, createSession, deleteSession, deleteOtherSessions,
  bearer, requireAuth, audit,
} from './lib.js';

const MAX_FAILS = 5;
const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role });

// Shared by customer login and admin login: 5 fails → locked 15 min, every attempt audited.
async function login(req, { adminOnly }) {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const { password, remember } = req.body ?? {};
  if (!email || !password) throw new HttpError(400, 'กรุณากรอกอีเมลและรหัสผ่าน');

  const u = (await q('SELECT * FROM users WHERE email = $1', [email])).rows[0];
  if (u?.locked_until > new Date()) {
    await audit(u.id, 'login_locked', req);
    throw new HttpError(423, 'บัญชีถูกล็อกชั่วคราว', { lockedUntil: u.locked_until });
  }
  // password_hash is NULL for Google-only accounts: they can't sign in with a password until they set one
  if (!u?.password_hash || !(await checkPassword(String(password), u.password_hash))) {
    let attemptsLeft;
    if (u) {
      const { rows: [r] } = await q(
        `UPDATE users SET
           locked_until  = CASE WHEN failed_logins + 1 >= $2 THEN now() + interval '15 minutes' END,
           failed_logins = CASE WHEN failed_logins + 1 >= $2 THEN 0 ELSE failed_logins + 1 END
         WHERE id = $1 RETURNING failed_logins, locked_until`, [u.id, MAX_FAILS]);
      attemptsLeft = r.locked_until ? 0 : MAX_FAILS - r.failed_logins;
    }
    await audit(u?.id ?? null, adminOnly ? 'admin_login_fail' : 'login_fail', req, email);
    throw new HttpError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', { attemptsLeft });
  }
  await q('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1', [u.id]);
  if (u.disabled) { // checked after the password so a stranger can't probe which accounts are suspended
    await audit(u.id, 'login_disabled', req);
    throw new HttpError(403, 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อฝ่ายช่วยเหลือ');
  }
  if (adminOnly && u.role !== 'admin') {
    await audit(u.id, 'admin_login_forbidden', req);
    throw new HttpError(403, 'บัญชีนี้ไม่มีสิทธิ์เข้าถึงระบบหลังร้าน');
  }
  await audit(u.id, adminOnly ? 'admin_login' : 'login', req);
  const token = await createSession(u.id, remember ? 30 : 1);
  return { token, user: publicUser(u) };
}

export const auth = Router()
  .post('/register', async (req, res) => {
    const { name, email, password } = req.body ?? {};
    const errors = {};
    if (!String(name ?? '').trim()) errors.name = 'กรุณากรอกชื่อ-นามสกุล';
    if (!EMAIL_RE.test(email ?? '')) errors.email = 'รูปแบบอีเมลไม่ถูกต้อง';
    if (String(password ?? '').length < 8) errors.password = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
    if (Object.keys(errors).length) throw new HttpError(422, 'ข้อมูลไม่ถูกต้อง', { errors });

    const { rows } = await q(
      `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING RETURNING id, email, name, role`,
      [email.trim().toLowerCase(), name.trim(), await hashPassword(password)]);
    if (!rows[0]) throw new HttpError(409, 'อีเมลนี้ถูกใช้แล้ว', { errors: { email: 'อีเมลนี้ถูกใช้แล้ว' } });
    res.status(201).json({ token: await createSession(rows[0].id, 1), user: rows[0] });
  })
  .post('/login', async (req, res) => res.json(await login(req, { adminOnly: false })))
  .post('/admin/login', async (req, res) => res.json(await login(req, { adminOnly: true })))

  // "Continue with Google": body { credential } is the ID token from Google Identity Services.
  .post('/google', async (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new HttpError(501, 'ยังไม่ได้เปิดใช้การเข้าสู่ระบบด้วย Google');
    // ponytail: Google's tokeninfo endpoint checks the signature for us; verify the JWT locally
    // (google-auth-library) if sign-in volume ever makes the extra round trip matter
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(String(req.body?.credential ?? '')));
    const t = await r.json().catch(() => ({}));
    if (!r.ok || t.aud !== clientId || String(t.email_verified) !== 'true' || !EMAIL_RE.test(t.email ?? '')) {
      throw new HttpError(401, 'ยืนยันตัวตนกับ Google ไม่สำเร็จ');
    }
    const email = t.email.toLowerCase();
    const old = (await q('SELECT id, password_hash FROM users WHERE email = $1', [email])).rows[0];
    // Registration never verified this email, so whoever set the existing password may not own it.
    // Google just proved ownership: drop that password and every session opened with it.
    if (old?.password_hash) {
      await q('UPDATE users SET password_hash = NULL WHERE id = $1', [old.id]);
      await q('DELETE FROM sessions WHERE user_id = $1', [old.id]);
    }
    const { rows: [u] } = await q(
      `INSERT INTO users (email, name) VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id, email, name, role, disabled`,
      [email, String(t.name || email.split('@')[0]).slice(0, 100)]);
    if (u.disabled) throw new HttpError(403, 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อฝ่ายช่วยเหลือ');
    await audit(u.id, 'login_google', req);
    res.json({ token: await createSession(u.id, 30), user: publicUser(u) });
  })

  .post('/logout', requireAuth, async (req, res) => {
    await deleteSession(bearer(req));
    res.status(204).end();
  })
  .get('/me', requireAuth, async (req, res) => {
    const { rows: [c] } = await q('SELECT count(*)::int AS n FROM cart_items WHERE user_id = $1', [req.user.id]);
    res.json({ user: req.user, cartCount: c.n });
  })

  // Profile page: { name } and/or { currentPassword, newPassword }
  .patch('/me', requireAuth, async (req, res) => {
    const { name, currentPassword, newPassword } = req.body ?? {};
    const errors = {};
    if (name != null && !String(name).trim()) errors.name = 'กรุณากรอกชื่อ-นามสกุล';
    if (newPassword != null) {
      if (String(newPassword).length < 8) errors.newPassword = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
      const { rows: [u] } = await q('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
      // Google-only accounts have no password yet, so there is nothing to confirm
      if (u.password_hash && !(await checkPassword(String(currentPassword ?? ''), u.password_hash))) {
        errors.currentPassword = 'รหัสผ่านปัจจุบันไม่ถูกต้อง';
      }
    }
    if (Object.keys(errors).length) throw new HttpError(422, 'ข้อมูลไม่ถูกต้อง', { errors });

    const { rows: [u] } = await q(
      `UPDATE users SET name = coalesce($2, name), password_hash = coalesce($3, password_hash)
       WHERE id = $1 RETURNING id, email, name, role`,
      [req.user.id, name == null ? null : String(name).trim().slice(0, 100),
        newPassword == null ? null : await hashPassword(String(newPassword))]);
    if (newPassword != null) {
      await deleteOtherSessions(req.user.id, bearer(req));
      await audit(req.user.id, 'password_change', req);
    }
    res.json({ user: u });
  });
