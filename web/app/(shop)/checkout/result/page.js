'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, baht, when } from '../../../../lib/api';
import { useStore } from '../../../../lib/store';
import { useDownload } from '../../../../lib/download';
import { Status, Title } from '../../../../components/ui';

// Payment result. The truth comes from the Stripe webhook, so poll while PENDING.
export default function Result() {
  const no = useSearchParams().get('order');
  const { user, shop, refresh } = useStore();
  const [o, setO] = useState(null);
  const [slow, setSlow] = useState(false);
  const { downloadAll, busyAll } = useDownload();

  useEffect(() => {
    if (!user) return;
    let alive = true, tries = 0;
    const tick = async () => {
      const r = await api(`/orders/${no}`).catch(() => null);
      if (!alive) return;
      if (r) setO(r);
      if (r?.status === 'PENDING' && ++tries < 30) setTimeout(tick, 2000);
      else { if (r?.status === 'PENDING') setSlow(true); refresh(); } // cart count drops to 0 on PAID
    };
    tick();
    return () => { alive = false; };
  }, [user, no, refresh]);

  if (!o) return <div className="ph" style={{ height: 320 }} />;

  const view = {
    PAID: ['ชำระเงินสำเร็จ!', `สินค้าของคุณพร้อมดาวน์โหลดแล้ว เราส่งใบเสร็จไปที่ ${o.billing_email}`, ''],
    FAILED: ['ชำระเงินไม่สำเร็จ', `ยังไม่มีการเรียกเก็บเงิน และสินค้ายังอยู่ในตะกร้าของคุณ${o.failure_code ? ` (${o.failure_code})` : ''}`, 'no'],
    PENDING: ['กำลังตรวจสอบการชำระเงิน', slow ? 'ใช้เวลานานกว่าปกติ ตรวจสถานะได้อีกครั้งที่หน้าคำสั่งซื้อ' : 'โปรดอย่าปิดหน้านี้หรือกดย้อนกลับ ขั้นตอนนี้ใช้เวลาไม่เกิน 30 วินาที', 'wait'],
    REFUNDED: ['คืนเงินแล้ว', 'คำสั่งซื้อนี้ถูกคืนเงิน สิทธิ์ดาวน์โหลดถูกยกเลิก', 'wait'],
  }[o.status];

  return (
    <>
      <Title eyebrow={`คำสั่งซื้อ #${o.order_no}`} title={view[0]} desc={view[1]} />
      <section className="pnl" style={{ maxWidth: 620, padding: 28, borderRadius: 18 }}>
        <div className={`ok-ic ${view[2]}`}>
          {o.status === 'PAID' ? <img src="/icons/check-circle.svg" alt="" /> : o.status === 'FAILED' ? '✕' : '…'}
        </div>
        <div className="tblw">
          <table className="tbl">
            <thead><tr><th>คำสั่งซื้อ</th><th>สินค้า</th><th>วันที่</th><th>ราคา</th><th>สถานะ</th></tr></thead>
            <tbody>
              {o.items.map((i) => (
                <tr key={i.itemId}>
                  <td>#{o.order_no}</td><td>{i.name}</td><td>{when(o.created_at, false)}</td>
                  <td>{baht(i.price)}</td><td><Status s={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="between"><b>ยอดรวม</b><span style={{ fontSize: 20 }}>{baht(o.total)}</span></div>
        <div className="row">
          {o.status === 'PAID' && (
            <>
              <Link className="btn" href="/library">ไปที่คลังของฉัน</Link>
              <button className="btn2" disabled={busyAll} onClick={() => downloadAll(o.items.map((i) => i.itemId))}>
                {busyAll ? 'กำลังเตรียมไฟล์…' : 'ดาวน์โหลดทั้งหมด'}
              </button>
            </>
          )}
          {o.status === 'FAILED' && (
            <>
              <Link className="btn" href={`/checkout/payment?products=${o.items.map((i) => i.productId).join(',')}`}>ลองอีกครั้ง</Link>
              <a className="btn2" href={`mailto:${shop.support_email}?subject=${encodeURIComponent(`ชำระเงินไม่สำเร็จ #${o.order_no}`)}`}>ติดต่อฝ่ายช่วยเหลือ</a>
            </>
          )}
          {(o.status === 'PENDING' || o.status === 'REFUNDED') && <Link className="btn2" href="/orders">ดูคำสั่งซื้อของฉัน</Link>}
        </div>
      </section>
    </>
  );
}
