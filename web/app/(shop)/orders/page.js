'use client';
import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, baht, when } from '../../../lib/api';
import { useStore } from '../../../lib/store';
import { useDownload } from '../../../lib/download';
import { Art, Empty, SignedOut, Status, statusOptions, Title } from '../../../components/ui';

const THIS_YEAR = new Date().getFullYear() + 543;

// My orders — click a row to expand its items in place, one at a time
export default function Orders() {
  const { user } = useStore();
  const [status, setStatus] = useState('');
  const [year, setYear] = useState('');
  const [orders, setOrders] = useState(null);
  const [open, setOpen] = useState(null);
  const { download, busy, error } = useDownload();

  useEffect(() => {
    if (!user) return;
    const qs = new URLSearchParams({ ...(status && { status }), ...(year && { year }) });
    api(`/orders?${qs}`).then((r) => setOrders(r.items));
  }, [user, status, year]);

  const title = (
    <Title title="คำสั่งซื้อของฉัน" desc="ทุกอย่างที่คุณซื้อ รวมไว้ในที่เดียว">
      {user && (
        <>
          <select className="chip" aria-label="สถานะ" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">ทุกสถานะ</option>
            {statusOptions('PAID', 'PENDING', 'FAILED', 'REFUNDED').map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="chip" aria-label="ปี" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">ทุกปี</option>{[0, 1, 2].map((d) => <option key={d}>{THIS_YEAR - d}</option>)}
          </select>
        </>
      )}
    </Title>
  );

  if (user === null) return <>{title}<SignedOut title="เข้าสู่ระบบเพื่อดูคำสั่งซื้อ" text="ประวัติการสั่งซื้อและใบเสร็จผูกกับบัญชีของคุณ" next="/orders" /></>;
  if (!orders) return <>{title}<div className="ph" style={{ height: 206 }} /></>;

  return (
    <>
      {title}
      {!orders.length ? (
        status || year
          ? <Empty title="ไม่พบคำสั่งซื้อตามตัวกรอง" text="ลองเปลี่ยนสถานะหรือปีที่เลือก"><button className="btn" onClick={() => { setStatus(''); setYear(''); }}>ล้างตัวกรอง</button></Empty>
          : <Empty title="ยังไม่มีคำสั่งซื้อ" text="เมื่อคุณสั่งซื้อสำเร็จ รายการทั้งหมดจะแสดงที่นี่"><Link className="btn" href="/search">เลือกซื้อสินค้า</Link></Empty>
      ) : (
        <div className="tblw">
          <table className="tbl">
            <thead><tr><th>คำสั่งซื้อ</th><th>สินค้า</th><th>วันที่</th><th>ยอดรวม</th><th>สถานะ</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <Fragment key={o.order_no}>
                  <tr className={`click ${open === o.order_no ? 'sel' : ''}`} onClick={() => setOpen(open === o.order_no ? null : o.order_no)}>
                    <td>#{o.order_no}</td>
                    <td>{o.items[0]?.name}{o.items.length > 1 && <span className="mut"> และอีก {o.items.length - 1} รายการ</span>}</td>
                    <td>{when(o.created_at, false)}</td>
                    <td>{baht(o.total)}</td>
                    <td><Status s={o.status} /></td>
                  </tr>
                  {open === o.order_no && (
                    <tr><td colSpan={5} style={{ background: 'var(--bg)', padding: 16 }}>
                      <div className="stack">
                        {o.items.map((i) => (
                          <div key={i.itemId} className="ci" style={{ background: '#fff' }}>
                            <Art p={i} className="th" />
                            <div className="cit">
                              <Link href={`/products/${i.productId}`} className="pt" style={{ fontSize: 15 }}>{i.name}</Link>
                              <span className="pd">{baht(i.price)}{error[i.itemId] && <span className="bad"> · {error[i.itemId]}</span>}</span>
                            </div>
                            {/* PENDING/FAILED/REFUNDED never release files */}
                            {o.status === 'PAID' && <button className="btn2" disabled={busy === i.itemId} onClick={() => download(i.itemId)}>ดาวน์โหลด</button>}
                          </div>
                        ))}
                        {o.status === 'FAILED' && (
                          <span><Link href={`/checkout/payment?products=${o.items.map((i) => i.productId).join(',')}`}>ชำระเงินอีกครั้ง</Link>{o.failure_code && <span className="mut"> · {o.failure_code}</span>}</span>
                        )}
                        {o.status === 'PENDING' && <span className="mut sm">รอการยืนยันจากระบบชำระเงิน · ยังดาวน์โหลดไม่ได้</span>}
                      </div>
                    </td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
