'use client';
import Link from 'next/link';
import { baht, when } from '../../../../lib/api';
import { useStore } from '../../../../lib/store';
import { Empty, Pager, Status, statusOptions, TestBanner, Title } from '../../../../components/ui';
import { Tools, useList } from '../../../../components/admin';

// Payments: every order that reached Stripe, one row per Payment Intent
export default function Payments() {
  const { shop } = useStore();
  const { res, f, set } = useList('/admin/payments', ['q', 'status']);

  return (
    <>
      <Title title="การชำระเงิน" desc={`รายการชำระเงินผ่าน Stripe ของ ${shop.store_name}`} />
      {res?.testMode && <TestBanner text="Stripe อยู่ในโหมดทดสอบ รายการทั้งหมดไม่มีการตัดเงินจริง" />}
      <Tools f={f} set={set} placeholder="ค้นหา Payment Intent เลขคำสั่งซื้อ หรืออีเมล" options={statusOptions('PENDING', 'PAID', 'FAILED', 'REFUNDED')} exportType="payments" />

      {res?.items.length === 0 ? (
        <Empty title={f.q || f.status ? 'ไม่พบรายการตามเงื่อนไข' : 'ยังไม่มีการชำระเงิน'} text="รายการจะแสดงที่นี่เมื่อลูกค้าเริ่มชำระเงิน" />
      ) : (
        <div className="tblw">
          <table className="tbl">
            <thead><tr><th>Payment Intent</th><th>คำสั่งซื้อ / ลูกค้า</th><th>วันที่</th><th>ยอดเงิน</th><th>สถานะ</th><th /></tr></thead>
            <tbody>
              {res?.items.map((x) => (
                <tr key={x.payment_intent}>
                  <td className="mono">{x.payment_intent.slice(0, 14)}••••</td>
                  <td><Link href={`/admin/orders?open=${x.order_no}`}>#{x.order_no}</Link><div className="mut sm">{x.email}</div></td>
                  <td>{when(x.at)}</td>
                  <td>{baht(x.total)}</td>
                  <td><Status s={x.status} />{x.failure_code && <div className="mut sm">{x.failure_code}</div>}</td>
                  <td style={{ textAlign: 'right' }}><a href={x.stripeUrl} target="_blank" rel="noreferrer">ดูใน Stripe</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {res && <Pager page={res.page} total={res.total} size={20} onPage={(n) => set({ page: String(n) })} />}
    </>
  );
}
