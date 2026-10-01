'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Empty, Title } from '../../../components/ui';
import { BillingFields, billingErrors, Summary, useBilling, useCheckout } from '../../../components/checkout';

// Checkout step 1: billing information. The card is entered on the next step (/checkout/payment).
export default function Checkout() {
  const { user, items, qs } = useCheckout();
  const router = useRouter();
  const [b, set] = useBilling(user);
  const [tried, setTried] = useState(false);

  if (!user || !items) return <div className="ph" style={{ height: 320 }} />;
  if (!items.length) return (
    <Empty title="ไม่มีสินค้าที่ชำระเงินได้" text="ตะกร้าว่าง หรือคุณเป็นเจ้าของสินค้าเหล่านี้อยู่แล้ว">
      <Link className="btn" href="/search">เลือกซื้อสินค้า</Link>
    </Empty>
  );

  const errors = billingErrors(b);
  const next = () => {
    setTried(true);
    if (!Object.values(errors).some(Boolean)) router.push(`/checkout/payment${qs}`);
  };

  return (
    <>
      <Title title="ข้อมูลผู้ซื้อ" desc="ขั้นตอนที่ 1 จาก 2 · ชำระเงินปลอดภัย รับสินค้าทันที" />
      <div className="split">
        <section className="pnl">
          <h2 className="h2">ข้อมูลสำหรับออกใบเสร็จ</h2>
          <BillingFields b={b} set={set} errors={tried ? errors : {}} />
        </section>
        <Summary items={items}>
          <button className="btn btnl" onClick={next}>ไปหน้าชำระเงิน</button>
          <Link href="/cart" className="sm">← กลับไปที่ตะกร้า</Link>
        </Summary>
      </div>
    </>
  );
}
