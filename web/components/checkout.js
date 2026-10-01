'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, baht, EMAIL_RE, store } from '../lib/api';
import { useStore } from '../lib/store';

// Shared by the checkout (billing) and payment steps.
// ?products=1,2 is "ซื้อเลย" or a retry; no param = the whole cart. `qs` carries the choice to the next step.
export function useCheckout() {
  const { user } = useStore();
  const router = useRouter();
  const param = useSearchParams().get('products');
  const ids = param?.split(',').map(Number).filter(Boolean);
  const [items, setItems] = useState(null);

  useEffect(() => {
    if (user === null) router.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    if (!user) return;
    (ids ? Promise.all(ids.map((id) => api(`/products/${id}`).catch(() => null))).then((xs) => xs.filter((p) => p && !p.owned_since))
      : api('/cart').then((r) => r.items)).then(setItems).catch(() => setItems([]));
  }, [user, param]); // eslint-disable-line react-hooks/exhaustive-deps

  return { user, items, ids, qs: param ? `?products=${param}` : '' };
}

// Billing details typed in the checkout step, kept for the payment step (and the next purchase on this device).
export function useBilling(user) {
  const [b, setB] = useState({ name: '', email: '', country: 'ประเทศไทย', address: '' });
  useEffect(() => {
    if (user) setB((x) => ({ ...x, name: user.name, email: user.email, ...store.get('billing') }));
  }, [user]);
  const set = (k, v) => setB((x) => { const next = { ...x, [k]: v }; store.set('billing', next); return next; });
  return [b, set];
}

export const billingErrors = (b) => ({
  name: !b.name.trim() && 'กรุณากรอกชื่อ-นามสกุล',
  email: !EMAIL_RE.test(b.email) && 'รูปแบบอีเมลไม่ถูกต้อง',
  country: !b.country.trim() && 'กรุณาระบุประเทศ / ภูมิภาค',
});

export function BillingFields({ b, set, errors = {} }) {
  const field = (k, label, type, autoComplete) => (
    <div>
      <input className={`inp ${errors[k] ? 'bad' : ''}`} type={type} aria-label={label} placeholder={label}
        autoComplete={autoComplete} value={b[k]} onChange={(e) => set(k, e.target.value)} />
      {errors[k] && <div className="err">{errors[k]}</div>}
    </div>
  );
  return (
    <>
      {field('name', 'ชื่อ-นามสกุล', 'text', 'name')}
      {field('email', 'อีเมลรับใบเสร็จ', 'email', 'email')}
      {field('country', 'ประเทศ / ภูมิภาค', 'text', 'country-name')}
      {field('address', 'ที่อยู่สำหรับใบเสร็จ (ไม่บังคับ)', 'text', 'street-address')}
    </>
  );
}

// Order summary card on the cart, checkout and payment pages; children = the action button(s).
export function Summary({ items, children }) {
  const total = items.reduce((s, p) => s + p.price, 0);
  return (
    <aside className="pnl sum sticky">
      <h2 className="h2">สรุปคำสั่งซื้อ</h2>
      {items.map((p) => <div key={p.id} className="srow"><span>{p.name}</span><span>{baht(p.price)}</span></div>)}
      <div className="tot"><b>ยอดรวม</b><span>{baht(total)}</span></div>
      {children}
    </aside>
  );
}
