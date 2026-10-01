'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, baht, when } from '../../../../lib/api';
import { useStore } from '../../../../lib/store';
import { Art, Empty, Pager, Status, statusOptions, Title } from '../../../../components/ui';
import { Tools, useList } from '../../../../components/admin';

// All orders of the shop + side drawer; ?open=DS-… opens a drawer directly
export default function AdminOrders() {
  const { shop } = useStore();
  const { res, f, set, load } = useList('/admin/orders', ['q', 'status', 'open']);

  return (
    <>
      <Title title="คำสั่งซื้อ"
        desc={`จัดการคำสั่งซื้อทั้งหมดของ ${shop.store_name}${res?.counts ? ` · รอตรวจสอบ ${res.counts.pending} · ไม่สำเร็จ ${res.counts.failed}` : ''}`} />
      <Tools f={f} set={set} placeholder="ค้นหาเลขคำสั่งซื้อ ชื่อ หรืออีเมลลูกค้า" options={statusOptions('PENDING', 'PAID', 'FAILED', 'REFUNDED')} exportType="orders" />

      {res?.items.length === 0 ? (
        f.q || f.status
          ? <Empty title="ไม่พบคำสั่งซื้อตามเงื่อนไข" text="ลองเปลี่ยนคำค้น หรือเลือกสถานะเป็นทั้งหมด"><Link className="btn" href="/admin/orders">ล้างตัวกรอง</Link></Empty>
          : <Empty title="ยังไม่มีคำสั่งซื้อเข้ามา" text="คำสั่งซื้อจะปรากฏที่นี่ทันทีที่ลูกค้าเริ่มชำระเงิน" />
      ) : (
        <div className="tblw">
          <table className="tbl">
            <thead><tr><th>คำสั่งซื้อ</th><th>ลูกค้า</th><th>วันที่ / รายการ</th><th>ยอดรวม</th><th>สถานะ</th></tr></thead>
            <tbody>
              {res?.items.map((o) => (
                <tr key={o.order_no} className={`click ${f.open === o.order_no ? 'sel' : ''}`} onClick={() => set({ open: o.order_no, page: f.page })}>
                  <td>#{o.order_no}</td>
                  <td>{o.name}<div className="mut sm">{o.email}</div></td>
                  <td>{when(o.created_at)} · {o.item_count} รายการ</td>
                  <td>{baht(o.total)}</td>
                  <td><Status s={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {res && <Pager page={res.page} total={res.total} size={20} onPage={(n) => set({ page: String(n) })} />}
      {f.open && <Drawer no={f.open} onClose={() => set({ open: '', page: f.page })} onChange={load} />}
    </>
  );
}

function Drawer({ no, onClose, onChange }) {
  const { notify } = useStore();
  const [o, setO] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setO(null); api(`/admin/orders/${no}`).then(setO).catch(() => onClose()); }, [no]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  async function refund() {
    // two-step confirm: native dialogs are enough for a desktop-only admin
    if (!confirm(`คืนเงิน ${baht(o.total)} ให้ ${o.customer.email}?`)) return;
    if (!confirm('ยืนยันอีกครั้ง: ลูกค้าจะเสียสิทธิ์ดาวน์โหลดสินค้าในคำสั่งซื้อนี้ทันที')) return;
    setBusy(true);
    try {
      await api(`/admin/orders/${no}/refund`, { method: 'POST' });
      notify('คืนเงินแล้ว');
      setO({ ...o, status: 'REFUNDED' }); onChange();
    } catch (e) { notify(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={no}>
        {!o ? <div className="ph" style={{ height: 200, margin: 24 }} /> : (
          <div className="stack pad" style={{ gap: 20 }}>
            <div className="between">
              <div><div className="h2">#{o.order_no}</div><span className="mut sm">{when(o.created_at)} น.</span></div>
              <div className="row"><Status s={o.status} /><button className="btn2" onClick={onClose} aria-label="ปิด">✕</button></div>
            </div>

            {o.status === 'FAILED' && (
              <div className="alert"><div><b>ชำระเงินไม่สำเร็จ · {o.failure_code}</b><div>ไม่ปล่อยไฟล์ให้ลูกค้า และคืนเงินไม่ได้ในสถานะนี้</div></div></div>
            )}

            <section className="card pad stack">
              <div><span className="lbl">ลูกค้า</span><b>{o.customer.name}</b><div className="mut">{o.customer.email}</div></div>
              <dl className="kv">
                <dt>คำสั่งซื้อทั้งหมด</dt><dd>{o.customer.orderCount} ครั้ง</dd>
                <dt>ยอดซื้อสะสม</dt><dd>{baht(o.customer.lifetimeTotal)}</dd>
                <dt>สมาชิกตั้งแต่</dt><dd>{when(o.customer.memberSince, false)}</dd>
              </dl>
            </section>

            <section className="card pad">
              <span className="lbl">ข้อมูลออกใบเสร็จ</span>
              <dl className="kv">
                <dt>ชื่อ</dt><dd>{o.billing.name || '—'}</dd>
                <dt>อีเมล</dt><dd>{o.billing.email || '—'}</dd>
                <dt>ประเทศ / ภูมิภาค</dt><dd>{o.billing.country || '—'}</dd>
                <dt>ที่อยู่</dt><dd>{o.billing.address || '—'}</dd>
              </dl>
            </section>

            <section className="stack">
              <span className="lbl" style={{ margin: 0 }}>รายการสินค้า ({o.items.length})</span>
              {o.items.map((i, n) => (
                <div key={n} className="ci">
                  <Art p={i} className="th" />
                  <div className="cit"><div className="pt" style={{ fontSize: 14 }}>{i.name}</div>
                    <span className="pd">ดาวน์โหลดแล้ว {i.downloads}/{o.downloadLimit}</span></div>
                  <b>{baht(i.price)}</b>
                </div>
              ))}
            </section>

            <section className="card pad">
              <div className="between"><span className="lbl">การชำระเงิน</span>{o.testMode && <span className="tb">TEST MODE</span>}</div>
              <dl className="kv">
                <dt>Payment Intent</dt><dd className="mono">{o.payment_intent ? `${o.payment_intent.slice(0, 12)}••••` : '—'}</dd>
                <dt>เวลายืนยัน (webhook)</dt><dd>{o.paid_at ? when(o.paid_at) : '—'}</dd>
                <dt>ยอดรวม</dt><dd>{baht(o.total)}</dd>
              </dl>
            </section>

            <div className="row">
              {o.stripeUrl && <a className="btn2" href={o.stripeUrl} target="_blank" rel="noreferrer">ดูใน Stripe</a>}
              {/* refund only for PAID */}
              {o.status === 'PAID' && <button className="btn2 danger" disabled={busy} onClick={refund}>คืนเงิน</button>}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
