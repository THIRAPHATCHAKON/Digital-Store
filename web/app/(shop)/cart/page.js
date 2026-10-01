'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, baht, LICENSES } from '../../../lib/api';
import { useStore } from '../../../lib/store';
import { Art, Empty, Title } from '../../../components/ui';
import { Summary } from '../../../components/checkout';

// Cart — no qty selector: digital goods are 1 per product
export default function Cart() {
  const { user, guestCart, removeFromCart, addToCart, notify } = useStore();
  const router = useRouter();
  const [items, setItems] = useState(null);
  const [removed, setRemoved] = useState([]);

  const load = useCallback(async () => {
    if (user) {
      const r = await api('/cart');
      setItems(r.items); setRemoved(r.removed);
    } else {
      // guest: resolve ids one by one; unpublished ones 404 and drop out
      const got = await Promise.all(guestCart().map((id) => api(`/products/${id}`).catch(() => null)));
      setItems(got.filter(Boolean));
    }
  }, [user, guestCart]);
  useEffect(() => { if (user !== undefined) load(); }, [user, load]);

  const remove = async (p) => {
    await removeFromCart(p.id);
    setItems((xs) => xs.filter((x) => x.id !== p.id));
    notify(`นำ “${p.name}” ออกแล้ว`, { label: 'เลิกทำ', fn: () => addToCart(p.id).then(load) });
  };

  return (
    <>
      <Title title="ตะกร้าสินค้า" desc="ชำระเงินปลอดภัย ดาวน์โหลดได้ทันทีหลังชำระเงิน" />
      {!items && <div className="ph" style={{ height: 240 }} />}
      {items?.length === 0 && (
        <Empty title="ตะกร้าของคุณยังว่างอยู่" text="เลือกดูเทมเพลต ซอร์สโค้ด อีบุ๊ก หรือคอร์สออนไลน์ แล้วเพิ่มลงตะกร้าได้เลย">
          <Link className="btn" href="/search">เลือกซื้อสินค้า</Link><Link className="btn2" href="/library">ดูคลังของฉัน</Link>
        </Empty>
      )}
      {removed.length > 0 && <div className="alert">มี {removed.length} รายการถูกถอนออกจากร้าน ระบบนำออกจากตะกร้าให้แล้ว</div>}
      {items?.length > 0 && (
        <div className="split">
          <section className="pnl">
            <h2 className="h2">ตะกร้าของคุณ ({items.length})</h2>
            {items.map((p) => (
              <div key={p.id} className="ci">
                <Art p={p} className="th" />
                <div className="cit">
                  <Link href={`/products/${p.id}`} className="pt" style={{ fontSize: 15 }}>{p.name}</Link>
                  <span className="pd">{LICENSES[p.license]} · จำนวน 1</span>
                </div>
                <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
                  <b>{baht(p.price)}</b>
                  <button className="lnk sm" onClick={() => remove(p)}>นำออก</button>
                </div>
              </div>
            ))}
          </section>
          <Summary items={items}>
            <button className="btn btnl" onClick={() => router.push(user ? '/checkout' : '/login?next=/checkout')}>ดำเนินการชำระเงิน</button>
            <Link href="/search" className="sm">← เลือกซื้อสินค้าต่อ</Link>
          </Summary>
        </div>
      )}
    </>
  );
}
