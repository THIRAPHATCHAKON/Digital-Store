'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { CardCvcElement, CardExpiryElement, CardNumberElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { api, baht } from '../../../../lib/api';
import { Empty, TestBanner, Title } from '../../../../components/ui';
import { BillingFields, billingErrors, Summary, useBilling, useCheckout } from '../../../../components/checkout';

const PK = process.env.NEXT_PUBLIC_STRIPE_PK;
const stripePromise = PK ? loadStripe(PK) : null;
// Stripe fields render in an iframe, so the design tokens are repeated here instead of inherited
const FIELD = { style: { base: { fontSize: '14px', color: '#111827', fontFamily: 'Inter, system-ui, sans-serif', '::placeholder': { color: '#667085' } } } };

// Checkout step 2: billing details (still editable) + card
export default function Payment() {
  const co = useCheckout();

  if (!co.user || !co.items) return <div className="ph" style={{ height: 320 }} />;
  if (!co.items.length) return (
    <Empty title="ไม่มีสินค้าที่ชำระเงินได้" text="ตะกร้าว่าง หรือคุณเป็นเจ้าของสินค้าเหล่านี้อยู่แล้ว">
      <Link className="btn" href="/search">เลือกซื้อสินค้า</Link>
    </Empty>
  );

  return (
    <>
      <Title title="ชำระเงิน" desc="ขั้นตอนที่ 2 จาก 2 · ชำระเงินปลอดภัย รับสินค้าทันที" />
      {PK?.startsWith('pk_test_') && (
        <TestBanner text={<>ระบบทดสอบ Stripe ไม่มีการตัดเงินจริง · บัตรทดสอบ <b className="mono">4242 4242 4242 4242</b> วันหมดอายุในอนาคตและ CVC ใดก็ได้ · บัตรที่ถูกปฏิเสธ <span className="mono">4000 0000 0000 0002</span></>} />
      )}
      {stripePromise
        ? <Elements stripe={stripePromise} options={{ locale: 'th' }}><PayForm {...co} /></Elements>
        : <div className="alert">ยังไม่ได้ตั้งค่า Stripe publishable key (NEXT_PUBLIC_STRIPE_PK)</div>}
    </>
  );
}

function PayForm({ user, items, ids, qs }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [b, set] = useBilling(user);
  const [card, setCard] = useState({}); // which of the three card fields are complete
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null); // kept so a retry after decline reuses the same order
  const total = items.reduce((s, p) => s + p.price, 0);
  const errors = billingErrors(b);
  const cardDone = card.number && card.expiry && card.cvc;

  async function pay() {
    setTried(true);
    if (Object.values(errors).some(Boolean) || !cardDone || !stripe) return;
    setBusy(true); setError(null);
    try {
      const o = order ?? await api('/checkout', { method: 'POST', body: { ...(ids && { productIds: ids }), billing: b } });
      setOrder(o);
      const { error: err } = await stripe.confirmCardPayment(o.clientSecret, {
        payment_method: { card: elements.getElement(CardNumberElement), billing_details: { name: b.name, email: b.email } },
      });
      if (err) { setError(`${err.message}${err.decline_code || err.code ? ` (${err.decline_code || err.code})` : ''}`); return; }
      router.push(`/checkout/result?order=${o.orderNo}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const field = (Element, key, placeholder) => (
    <div className={`inp ${error ? 'bad' : ''}`}>
      <Element options={{ ...FIELD, placeholder }} onChange={(e) => setCard((c) => ({ ...c, [key]: e.complete }))} />
    </div>
  );

  return (
    <div className="split">
      <section className="pnl">
        <h2 className="h2">วิธีชำระเงิน</h2>
        <BillingFields b={b} set={set} errors={tried ? errors : {}} />
        {field(CardNumberElement, 'number', 'หมายเลขบัตร')}
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          {field(CardExpiryElement, 'expiry', 'วันหมดอายุ (ดด / ปป)')}
          {field(CardCvcElement, 'cvc', 'CVC')}
        </div>
        {tried && !cardDone && !error && <div className="err" style={{ margin: 0 }}>กรอกข้อมูลบัตรให้ครบก่อนชำระเงิน</div>}
        {error && <div className="err" style={{ margin: 0 }}>{error} — ข้อมูลในฟอร์มยังอยู่ ลองบัตรอื่นได้เลย</div>}
      </section>
      <Summary items={items}>
        <button className="btn btnl" disabled={busy} onClick={pay}>{busy ? 'กำลังดำเนินการ…' : error ? 'ลองชำระเงินอีกครั้ง' : `ชำระเงิน ${baht(total)}`}</button>
        <span className="mut sm">เมื่อกดชำระเงิน ถือว่าคุณรับทราบว่าสินค้าดิจิทัลไม่สามารถขอคืนเงินได้</span>
        <Link href={`/checkout${qs}`} className="sm">← แก้ไขข้อมูลผู้ซื้อ</Link>
      </Summary>
    </div>
  );
}
