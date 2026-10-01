'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { useStore } from '../../../lib/store';
import { Logo, Narrow, Title } from '../../../components/ui';

// Admin login — separate from customer login: no signup, no Google, always lands on the dashboard
export default function AdminLogin() {
  const router = useRouter();
  const { signIn } = useStore();
  const [f, setF] = useState({ email: '', password: '', remember: false });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await api('/auth/admin/login', { method: 'POST', body: f });
      await signIn(r.token);
      router.replace('/admin');
    } catch (e) {
      const left = e.data?.attemptsLeft;
      setError(e.status === 423 ? 'บัญชีถูกล็อก 15 นาทีเพราะใส่รหัสผิดเกิน 5 ครั้ง'
        : `${e.message}${left != null ? ` · ลองได้อีก ${left} ครั้ง` : ''}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="narrow"><Narrow /></div>
      <div className="adm"><div className="auth" style={{ flex: 1 }}>
        <div className="auth-l dark">
          <Logo />
          <div>
            <h2>ระบบหลังร้าน</h2>
            <p>จัดการสินค้า ตรวจคำสั่งซื้อ และดูยอดขายของร้าน สำหรับผู้ดูแลระบบเท่านั้น</p>
          </div>
          <small>ADMIN CONSOLE</small>
        </div>
        <div className="auth-r">
          <Title title="เข้าสู่ระบบแอดมิน" desc="ใช้บัญชีผู้ดูแลระบบที่ได้รับสิทธิ์แล้วเท่านั้น" />
          <form onSubmit={submit}>
            {error && <div className="alert">{error}</div>}
            <input className="inp" type="email" aria-label="อีเมลผู้ดูแลระบบ" placeholder="อีเมลผู้ดูแลระบบ" autoComplete="email" required
              value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <input className="inp" type="password" aria-label="รหัสผ่าน" placeholder="รหัสผ่าน" autoComplete="current-password" required
              value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            <label className="chk"><input type="checkbox" checked={f.remember} onChange={(e) => setF({ ...f, remember: e.target.checked })} />จำอุปกรณ์นี้ไว้ 30 วัน</label>
            <button className="btn btnl" disabled={busy}>เข้าสู่ระบบ</button>
            <span className="alt">สิทธิ์แอดมินกำหนดจากฐานข้อมูลเท่านั้น · เป็นลูกค้า? <Link href="/login">เข้าสู่ระบบที่หน้าร้าน</Link></span>
          </form>
        </div>
      </div></div>
    </>
  );
}
