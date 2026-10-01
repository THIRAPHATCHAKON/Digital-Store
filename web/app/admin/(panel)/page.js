'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, baht, when } from '../../../lib/api';
import { Empty, Status, Title } from '../../../components/ui';

// "↑ 18.2%" against the previous period of the same length; nothing to compare with → no line
function Delta({ cur, prev }) {
  if (!prev) return <small className="mut">ยังไม่มีช่วงก่อนหน้าให้เทียบ</small>;
  const d = ((cur - prev) / prev) * 100;
  return <small className={d >= 0 ? 'up' : 'down'}>{d >= 0 ? '↑' : '↓'} {Math.abs(d).toFixed(1)}%</small>;
}

// Dashboard
export default function Dashboard() {
  const router = useRouter();
  const [days, setDays] = useState(30);
  const [s, setS] = useState(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    api(`/admin/stats?days=${days}`).then(setS).catch(() => setError(true));
  }, [days]);
  useEffect(load, [load]);

  const max = Math.max(1, ...(s?.series ?? []).map((p) => p.sales));
  const noData = s && s.products_published + s.products_draft === 0 && !s.recentOrders.length;

  return (
    <>
      <Title title="แดชบอร์ด" desc="สุขภาพของร้านและผลการขาย" />
      {error && <div className="alert between"><span>โหลดสถิติไม่สำเร็จ</span><button className="btn2" onClick={load}>ลองโหลดใหม่</button></div>}

      <div className="stats">
        <div className="stat"><span>ยอดขาย</span><b>{s ? baht(s.sales) : '…'}</b>{s && <Delta cur={s.sales} prev={s.sales_prev} />}</div>
        <div className="stat"><span>คำสั่งซื้อ</span><b>{s ? s.orders.toLocaleString('th-TH') : '…'}</b>{s && <Delta cur={s.orders} prev={s.orders_prev} />}</div>
        <div className="stat"><span>ลูกค้า</span><b>{s ? s.customers.toLocaleString('th-TH') : '…'}</b>{s && <small>ใหม่ {s.new_users} คนในช่วงนี้</small>}</div>
        <div className="stat"><span>สินค้า</span><b>{s ? (s.products_published + s.products_draft).toLocaleString('th-TH') : '…'}</b>{s && <small>{s.products_draft} ฉบับร่าง</small>}</div>
      </div>

      {noData ? (
        <Empty title="ยังไม่มีข้อมูลยอดขาย" text="เพิ่มสินค้าและเผยแพร่ขึ้นร้านก่อน กราฟและตารางคำสั่งซื้อจะเริ่มแสดงข้อมูลเมื่อมีการซื้อครั้งแรก">
          <Link className="btn" href="/admin/products/new">เพิ่มสินค้าชิ้นแรก</Link>
        </Empty>
      ) : (
        <>
          <div className="dash">
            <section className="pnl">
              <div className="between">
                <h2 className="h2">ภาพรวมยอดขาย</h2>
                <select className="chip" aria-label="ช่วงเวลา" value={days} onChange={(e) => setDays(+e.target.value)}>
                  <option value={7}>7 วันล่าสุด</option><option value={30}>30 วันล่าสุด</option><option value={90}>90 วันล่าสุด</option><option value={365}>1 ปีล่าสุด</option>
                </select>
              </div>
              {/* ponytail: CSS bars, swap for a chart library if axes/tooltips are needed */}
              <div className="chart">
                {s?.series.map((p) => <i key={p.t} style={{ height: `${(p.sales / max) * 100}%` }} title={`${when(p.t, false)} · ${baht(p.sales)}`} />)}
              </div>
            </section>
            <section className="pnl">
              <h2 className="h2">หมวดหมู่ขายดี</h2>
              {s?.topCategories.map((c) => (
                <div key={c.name} className="between"><span>{c.name}</span><b>{s.sales ? Math.round((c.sales / s.sales) * 100) : 0}%</b></div>
              ))}
            </section>
          </div>

          <h2 className="h2">คำสั่งซื้อล่าสุด</h2>
          <div className="tblw">
            <table className="tbl">
              <thead><tr><th>คำสั่งซื้อ</th><th>ลูกค้า</th><th>วันที่ / รายการ</th><th>ยอดรวม</th><th>สถานะ</th></tr></thead>
              <tbody>
                {s?.recentOrders.map((o) => (
                  <tr key={o.order_no} className="click" onClick={() => router.push(`/admin/orders?open=${o.order_no}`)}>
                    <td>#{o.order_no}</td><td>{o.name}</td><td>{when(o.created_at, false)} · {o.item_count} รายการ</td>
                    <td>{baht(o.total)}</td><td><Status s={o.status} /></td>
                  </tr>
                ))}
                {s?.recentOrders.length === 0 && <tr><td colSpan={5} className="mut">ยังไม่มีคำสั่งซื้อ</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
