'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { useStore } from '../../../lib/store';
import { Modal, SignedOut, Title } from '../../../components/ui';

// Profile: identity card, then one row per destination or action
export default function Account() {
  const { user, shop, signOut } = useStore();
  const [edit, setEdit] = useState(null); // 'name' | 'password'

  const title = <Title title="โปรไฟล์" desc="จัดการบัญชีและการเข้าถึงสินค้าของคุณ" />;
  if (user === null) return <>{title}<SignedOut title="บัญชีของฉัน" text="เข้าสู่ระบบเพื่อดูคลังและคำสั่งซื้อของคุณ" next="/account" /></>;
  if (!user) return title;

  const row = (label, props) => (props.href
    ? <Link className="prow2" {...props}>{label}<span>›</span></Link>
    : <button className={`prow2 ${props.danger ? 'danger' : ''}`} onClick={props.onClick}>{label}<span>›</span></button>);

  return (
    <>
      {title}
      <div className="stack" style={{ maxWidth: 520 }}>
        <div className="prof">
          <span className="av big">{user.name[0]}</span>
          <div><b style={{ fontSize: 16 }}>{user.name}</b><div className="mut sm">{user.email}</div></div>
        </div>
        {row('คลังของฉัน', { href: '/library' })}
        {row('คำสั่งซื้อของฉัน', { href: '/orders' })}
        {row('แก้ไขชื่อ', { onClick: () => setEdit('name') })}
        {row(user.has_password ? 'เปลี่ยนรหัสผ่าน' : 'ตั้งรหัสผ่าน', { onClick: () => setEdit('password') })}
        {shop.support_email && row('ติดต่อฝ่ายช่วยเหลือ', { href: `mailto:${shop.support_email}` })}
        {user.role === 'admin' && row('ระบบหลังร้าน', { href: '/admin' })}
        {row('ออกจากระบบ', { onClick: signOut, danger: true })}
      </div>
      {edit && <EditModal what={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function EditModal({ what, onClose }) {
  const { user, refresh, notify } = useStore();
  const [f, setF] = useState({ name: user.name, currentPassword: '', newPassword: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/auth/me', {
        method: 'PATCH',
        body: what === 'name' ? { name: f.name } : { currentPassword: f.currentPassword, newPassword: f.newPassword },
      });
      await refresh();
      notify(what === 'name' ? 'บันทึกชื่อแล้ว' : 'เปลี่ยนรหัสผ่านแล้ว อุปกรณ์อื่นถูกออกจากระบบ');
      onClose();
    } catch (e) {
      setErrors(e.data?.errors ?? { form: e.message });
    } finally {
      setBusy(false);
    }
  }

  const field = (k, label, type = 'text', autoComplete) => (
    <div>
      <input className={`inp ${errors[k] ? 'bad' : ''}`} type={type} aria-label={label} placeholder={label} autoComplete={autoComplete}
        value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} required />
      {errors[k] && <div className="err">{errors[k]}</div>}
    </div>
  );

  return (
    <Modal onClose={onClose}>
      <form className="stack" style={{ gap: 16 }} onSubmit={save}>
        <h2 className="h2">{what === 'name' ? 'แก้ไขชื่อ' : user.has_password ? 'เปลี่ยนรหัสผ่าน' : 'ตั้งรหัสผ่าน'}</h2>
        {what === 'name' ? field('name', 'ชื่อ-นามสกุล', 'text', 'name') : (
          <>
            {user.has_password && field('currentPassword', 'รหัสผ่านปัจจุบัน', 'password', 'current-password')}
            {field('newPassword', 'รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)', 'password', 'new-password')}
          </>
        )}
        {errors.form && <div className="err" style={{ margin: 0 }}>{errors.form}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn2" onClick={onClose}>ยกเลิก</button>
          <button className="btn" disabled={busy}>บันทึก</button>
        </div>
      </form>
    </Modal>
  );
}
