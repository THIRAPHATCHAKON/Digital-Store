'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, baht, LICENSES, mb, when } from '../../../../lib/api';
import { useStore } from '../../../../lib/store';
import { Empty, ProductCard, Title } from '../../../../components/ui';

const stars = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));

// Product details
export default function Product() {
  const { id } = useParams();
  const router = useRouter();
  const { user, cat, shop, addToCart, guestCart, notify } = useStore();
  const [p, setP] = useState(null);
  const [missing, setMissing] = useState(false);
  const [inCart, setInCart] = useState(false);

  const load = useCallback(() => api(`/products/${id}`)
    .then((r) => { setP(r); setInCart(r.in_cart || guestCart().includes(r.id)); })
    .catch(() => setMissing(true)), [id, guestCart]);
  useEffect(() => {
    if (user !== undefined) load(); // wait for auth so owned/in_cart are right
  }, [user, load]);

  if (missing) return (
    <Empty title="ไม่พบสินค้านี้" text="สินค้าอาจถูกถอนออกจากร้านแล้ว ลองดูสินค้าอื่นในร้าน">
      <Link className="btn" href="/search">ดูสินค้าทั้งหมด</Link>
    </Empty>
  );
  if (!p) return <div className="ph" style={{ height: 500 }} />;

  const add = async () => {
    try { await addToCart(p.id); setInCart(true); notify('เพิ่มลงตะกร้าแล้ว'); } catch (e) { notify(e.message); }
  };
  const buy = `/checkout?products=${p.id}`;
  const off = p.compare_at > p.price ? Math.round((1 - p.price / p.compare_at) * 100) : 0;
  const c = cat(p.category);
  const top = p.reviews[0];
  const mine = p.reviews.find((r) => r.mine);

  return (
    <>
      <Title title="รายละเอียดสินค้า" desc={`${p.name} โดย ${p.seller || shop.store_name}`} />
      <div className="pdp">
        <div className="pmedia" style={{ background: c.color }}>
          {p.cover_url ? <img src={p.cover_url} alt={p.name} /> : p.name}
        </div>
        <div className="pinfo">
          <span className="stars">
            {p.review_count > 0
              ? `${stars(p.rating)} ${Number(p.rating).toFixed(1)} · ${p.review_count.toLocaleString('th-TH')} รีวิว`
              : <span className="mut">ยังไม่มีรีวิว · ขายแล้ว {p.sold.toLocaleString('th-TH')} ครั้ง</span>}
          </span>
          <div className="row">
            <span className="price">{baht(p.price)}</span>
            {off > 0 && <><s className="mut">{baht(p.compare_at)}</s><span className="tag">ลด {off}%</span></>}
          </div>
          <p className="desc">{p.short_description || p.excerpt}</p>

          {p.owned_since ? (
            <div className="alert ok">
              <span>คุณเป็นเจ้าของสินค้านี้แล้ว (ซื้อเมื่อ {when(p.owned_since, false)}) · <Link href="/library">ไปที่คลังของฉัน</Link></span>
            </div>
          ) : (
            <div className="row">
              {inCart
                ? <Link className="btn" style={{ width: 220 }} href="/cart">ดูในตะกร้า</Link>
                : <button className="btn" style={{ width: 220 }} onClick={add}>เพิ่มลงตะกร้า</button>}
              <button className="btn2" style={{ width: 180 }} onClick={() => router.push(user ? buy : `/login?next=${encodeURIComponent(buy)}`)}>ซื้อเลย</button>
            </div>
          )}

          <div className="ticks">
            <span>✓ ไฟล์: {[p.file_types, mb(p.file_size)].filter(Boolean).join(' · ') || '—'}</span>
            <span>✓ สิทธิ์การใช้งาน: {LICENSES[p.license]}</span>
            <span>✓ อัปเดตล่าสุด: {when(p.updated_at, false)}{p.version && ` · เวอร์ชัน ${p.version}`}</span>
          </div>
          {top?.body && (
            <div className="rev">
              <b>“{top.body}”</b>
              <small>{top.name} · ผู้ซื้อจริง</small>
            </div>
          )}
        </div>
      </div>

      {p.description && (
        <section className="pnl">
          <h2 className="h2">รายละเอียดสินค้า</h2>
          {/* stored as markdown; plain pre-wrap keeps line breaks and bullets readable */}
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, margin: 0 }}>{p.description}</p>
          {p.tags.length > 0 && (
            <div className="chips">{p.tags.map((t) => <Link key={t} className="chip" href={`/search?q=${encodeURIComponent(t)}`}>{t}</Link>)}</div>
          )}
        </section>
      )}

      <section className="stack">
        <h2 className="h2">รีวิวจากผู้ซื้อ ({p.review_count})</h2>
        {p.owned_since && <ReviewForm id={p.id} mine={mine} onSaved={load} />}
        {p.reviews.length === 0 && <span className="mut">ยังไม่มีรีวิว{!p.owned_since && ' — ผู้ที่ซื้อสินค้านี้แล้วเท่านั้นที่เขียนรีวิวได้'}</span>}
        {p.reviews.map((r) => (
          <div key={r.id} className="rev">
            <span className="stars">{stars(r.rating)}</span>
            {r.body && <p>{r.body}</p>}
            <small>{r.name} · ผู้ซื้อจริง · {when(r.created_at, false)}</small>
          </div>
        ))}
      </section>

      {p.related.length > 0 && (
        <section className="stack">
          <div className="between">
            <h2 className="h2">สินค้าที่เกี่ยวข้อง</h2>
            <Link href={`/search?category=${p.category}`}>ดูทั้งหมดในหมวด{c.name}</Link>
          </div>
          <div className="grid">{p.related.map((r) => <ProductCard key={r.id} p={r} />)}</div>
        </section>
      )}
    </>
  );
}

// Only shown to buyers. Posting again replaces the buyer's earlier review.
function ReviewForm({ id, mine, onSaved }) {
  const { notify } = useStore();
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [body, setBody] = useState(mine?.body ?? '');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/products/${id}/reviews`, { method: 'POST', body: { rating, body } });
      notify(mine ? 'อัปเดตรีวิวแล้ว' : 'ขอบคุณสำหรับรีวิว');
      onSaved();
    } catch (e) {
      notify(Object.values(e.data?.errors ?? {})[0] ?? e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="pnl" onSubmit={submit}>
      <b>{mine ? 'แก้ไขรีวิวของคุณ' : 'เขียนรีวิว'}</b>
      <div className="stars" role="radiogroup" aria-label="คะแนน">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} ดาว`}
            className={n <= rating ? 'on' : ''} onClick={() => setRating(n)}>★</button>
        ))}
      </div>
      <textarea className="inp" maxLength={1000} placeholder="เล่าประสบการณ์การใช้งานสินค้านี้ (ไม่บังคับ)" value={body} onChange={(e) => setBody(e.target.value)} />
      <button className="btn" style={{ alignSelf: 'flex-start' }} disabled={busy || !rating}>{mine ? 'บันทึกรีวิว' : 'ส่งรีวิว'}</button>
    </form>
  );
}
