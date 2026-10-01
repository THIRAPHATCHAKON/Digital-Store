'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, when } from '../../../lib/api';
import { useStore } from '../../../lib/store';
import { useDownload } from '../../../lib/download';
import { Empty, ProductCard, SignedOut, Title } from '../../../components/ui';

const VIEWS = [['all', 'สินค้าทั้งหมด'], ['downloaded', 'ดาวน์โหลดแล้ว'], ['updates', 'มีอัปเดต']];

// My library — only items from PAID orders
export default function Library() {
  const { user, shop } = useStore();
  const [items, setItems] = useState(null);
  const [view, setView] = useState('all');
  const [term, setTerm] = useState('');
  // a download clears "มีอัปเดต": the buyer now has the latest file
  const { download, busy, error } = useDownload((id) =>
    setItems((xs) => xs.map((x) => (x.item_id === id ? { ...x, downloads: x.downloads + 1, has_update: false } : x))));

  useEffect(() => { if (user) api('/library').then((r) => setItems(r.items)); }, [user]);

  const title = <Title title="คลังของฉัน" desc="ทุกอย่างที่คุณเป็นเจ้าของ รวมไว้ในที่เดียว" />;
  if (user === null) return <>{title}<SignedOut title="เข้าสู่ระบบเพื่อดูคลังของคุณ" text="สินค้าที่ซื้อแล้วผูกกับบัญชีของคุณ เข้าสู่ระบบด้วยบัญชีเดิมเพื่อดาวน์โหลดไฟล์ซ้ำ" next="/library" /></>;
  if (!items) return <>{title}<div className="ph" style={{ height: 266 }} /></>;
  if (!items.length) return (
    <>
      {title}
      <Empty title="ยังไม่มีอะไรในคลัง" text="สินค้าที่ซื้อแล้วและไฟล์ดาวน์โหลดจะมาอยู่ที่นี่ทันทีหลังชำระเงินสำเร็จ">
        <Link className="btn" href="/search">เลือกซื้อสินค้า</Link><Link className="btn2" href="/orders">ดูคำสั่งซื้อ</Link>
      </Empty>
    </>
  );

  const shown = items.filter((x) => x.name.toLowerCase().includes(term.toLowerCase())
    && (view === 'all' || (view === 'downloaded' ? x.downloads > 0 : x.has_update)));

  return (
    <>
      {title}
      <div className="tools">
        <form onSubmit={(e) => e.preventDefault()}>
          <input className="srch" aria-label="ค้นหาในคลัง" placeholder="ค้นหาในคลังของฉัน" value={term} onChange={(e) => setTerm(e.target.value)} />
        </form>
        {VIEWS.map(([v, label]) => (
          <button key={v} className={`chip ${view === v ? 'on' : ''}`} onClick={() => setView(v)}>{label}</button>
        ))}
      </div>
      {shown.length === 0 && <Empty title="ไม่พบสินค้าในมุมมองนี้" text="ลองเปลี่ยนคำค้นหรือกลับไปดูสินค้าทั้งหมด" />}
      <div className="grid">
        {shown.map((x) => {
          const left = x.download_limit - x.downloads;
          const expired = new Date(x.expires_at) < new Date();
          const usable = left > 0 && !expired;
          return (
            <div key={x.item_id} className="stack" style={{ gap: 6 }}>
              <ProductCard p={x} href={`/products/${x.product_id}`} footer={usable ? (
                <>
                  <button className="btn" disabled={busy === x.item_id} onClick={() => download(x.item_id)}>
                    {busy === x.item_id ? 'กำลังเตรียม…' : x.has_update ? 'ดาวน์โหลดอัปเดต' : 'ดาวน์โหลด'}
                  </button>
                  <span className="pd">เหลือ {left}/{x.download_limit}</span>
                </>
              ) : (
                <a className="btn2 btnl" href={`mailto:${shop.support_email}?subject=${encodeURIComponent(`ขอลิงก์ใหม่ #${x.order_no} ${x.name}`)}`}>ขอลิงก์ใหม่</a>
              )} />
              <span className={`sm ${usable ? 'mut' : 'bad'}`}>
                {error[x.item_id] ? <span className="bad">{error[x.item_id]}</span>
                  : expired ? 'สิทธิ์ดาวน์โหลดหมดอายุแล้ว'
                    : left <= 0 ? `ดาวน์โหลดครบ ${x.download_limit} ครั้งแล้ว`
                      : `${x.version ? `${x.version} · ` : ''}ดาวน์โหลดได้ถึง ${when(x.expires_at, false)}`}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
