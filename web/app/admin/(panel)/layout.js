'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { useStore } from '../../../lib/store';
import { Empty, Icon, Logo, Narrow } from '../../../components/ui';

const NAV = [
  ['/admin', 'แดชบอร์ด', 'dashboard'], ['/admin/products', 'สินค้า', 'package'], ['/admin/categories', 'หมวดหมู่', 'grid'],
  ['/admin/orders', 'คำสั่งซื้อ', 'cart'], ['/admin/customers', 'ลูกค้า', 'users'], ['/admin/files', 'ไฟล์', 'files'],
  ['/admin/payments', 'การชำระเงิน', 'wallet'], ['/admin/import-export', 'นำเข้า / ส่งออก', 'transfer'], ['/admin/settings', 'ตั้งค่า', 'settings'],
];

// Admin console shell: sidebar + header, admin role required, desktop ≥1280px only (CSS swaps in <Narrow/>)
export default function AdminLayout({ children }) {
  const { user, signOut } = useStore();
  const path = usePathname();
  const router = useRouter();
  const [badges, setBadges] = useState({});

  useEffect(() => { if (user === null) router.replace('/admin/login'); }, [user, router]);
  useEffect(() => {
    if (user?.role !== 'admin') return;
    api('/admin/stats').then((s) => setBadges({ '/admin/products': s.products_draft, '/admin/orders': s.orders_pending })).catch(() => {});
  }, [user, path]);

  if (!user) return null;
  if (user.role !== 'admin') return ( // signed-in customer → 403, not the login page
    <div className="wrap"><Empty title="403 — ไม่มีสิทธิ์เข้าถึงระบบหลังร้าน" text="บัญชีนี้เป็นบัญชีลูกค้า">
      <Link className="btn" href="/">กลับไปหน้าร้าน</Link>
    </Empty></div>
  );

  return (
    <>
      <div className="narrow"><Narrow /></div>
      <div className="adm">
        <aside className="sb">
          <Logo href="/admin" />
          <small>ADMIN CONSOLE</small>
          {NAV.map(([href, label, icon]) => (
            <Link key={href} href={href} className={`sbi ${(href === '/admin' ? path === href : path.startsWith(href)) ? 'on' : ''}`}>
              <Icon name={icon} />{label}{badges[href] > 0 && <span className="cb">{badges[href]}</span>}
            </Link>
          ))}
          <button className="sbi" style={{ marginTop: 'auto' }} onClick={() => signOut().then(() => router.replace('/admin/login'))}>
            <Icon name="logout" />ออกจากระบบ
          </button>
        </aside>
        <div className="admw">
          <header className="admh">
            <form action="/admin/products">
              <input className="srch" name="q" aria-label="ค้นหาสินค้า" placeholder="ค้นหาสินค้าจากชื่อ ผู้ขาย หรือรหัส SKU" />
            </form>
            <Link href="/" className="mut sm">ดูหน้าร้าน</Link>
            <span className="mut sm">แอดมิน · {user.name}</span>
            <span className="av" style={{ width: 32, height: 32 }}>{user.name[0]}</span>
          </header>
          <main className="admain">{children}</main>
        </div>
      </div>
    </>
  );
}
