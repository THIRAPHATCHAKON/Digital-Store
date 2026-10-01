'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, LICENSES } from '../../../lib/api';
import { useStore } from '../../../lib/store';
import { Empty, Pager, ProductCard, Title } from '../../../components/ui';

const KEYS = ['q', 'category', 'min', 'max', 'rating', 'file', 'license', 'sort', 'page'];
// price presets as "min-max" (empty side = open)
const PRICES = [['-199', 'ต่ำกว่า ฿200'], ['200-500', '฿200–฿500'], ['501-', 'มากกว่า ฿500']];
const SORTS = [['popular', 'ยอดนิยม'], ['newest', 'ใหม่ล่าสุด'], ['rating', 'คะแนนสูงสุด'], ['price_asc', 'ราคาต่ำ–สูง'], ['price_desc', 'ราคาสูง–ต่ำ']];

// Product catalog and search results — every filter lives in the query string (shareable, back button works)
export default function Catalog() {
  const sp = useSearchParams();
  const router = useRouter();
  const { cats } = useStore();
  const [res, setRes] = useState(null);
  const f = Object.fromEntries(KEYS.map((k) => [k, sp.get(k) ?? '']));

  const set = (patch) => {
    const next = new URLSearchParams({ ...f, page: '', ...patch }); // any filter change goes back to page 1
    for (const [k, v] of [...next]) if (!v) next.delete(k);
    router.replace(`/search?${next}`);
  };

  useEffect(() => {
    setRes(null);
    api(`/products?${sp}`).then(setRes).catch(() => setRes({ items: [], total: 0, page: 1, pageSize: 12, categories: {} }));
  }, [sp]);

  // one group of the filter rail: "ทั้งหมด" plus the options, single choice
  const group = (title, options, current, pick) => (
    <section>
      <h3>{title}</h3>
      <div>
        {[['', 'ทั้งหมด'], ...options].map(([v, label]) => (
          <label key={v} className="chk"><input type="checkbox" checked={current === v} onChange={() => pick(v)} />{label}</label>
        ))}
      </div>
    </section>
  );
  const price = f.min || f.max ? `${f.min}-${f.max}` : '';
  const rail = (
    <div className="pnl flt">
      <div className="between"><b style={{ fontSize: 16 }}>ตัวกรอง</b><Link href="/search" className="sm">ล้าง</Link></div>
      {group('หมวดหมู่', cats.map((c) => [c.slug, `${c.name} (${res?.categories?.[c.slug] ?? 0})`]), f.category, (v) => set({ category: v }))}
      {group('ช่วงราคา', PRICES, price, (v) => { const [min = '', max = ''] = v.split('-'); set({ min, max }); })}
      {group('คะแนน', [['4', '4★ ขึ้นไป'], ['3', '3★ ขึ้นไป']], f.rating, (v) => set({ rating: v }))}
      {group('ประเภทไฟล์', [['zip', 'ZIP'], ['pdf', 'PDF'], ['mp4', 'MP4']], f.file, (v) => set({ file: v }))}
      {group('สิทธิ์การใช้งาน', Object.entries(LICENSES), f.license, (v) => set({ license: v }))}
    </div>
  );

  return (
    <>
      <Title title={f.q ? `ผลการค้นหา “${f.q}”` : 'สินค้าทั้งหมด'} desc="สำรวจสินค้าดิจิทัลจากครีเอเตอร์อิสระ" />
      <form className="only-m" onSubmit={(e) => { e.preventDefault(); set({ q: new FormData(e.target).get('q') }); }}>
        <input className="srch" name="q" defaultValue={f.q} key={f.q} aria-label="ค้นหา" placeholder="ค้นหาสินค้าดิจิทัล" />
      </form>
      <div className="rail">
        <div className="sticky">
          <div className="hide-m">{rail}</div>
          <details className="only-m"><summary className="chip">ตัวกรอง</summary><div style={{ marginTop: 12 }}>{rail}</div></details>
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <div className="between">
            <span className="mut">{res ? `${res.total.toLocaleString('th-TH')} รายการ` : 'กำลังโหลด…'}</span>
            <select className="chip" aria-label="เรียงตาม" value={f.sort || 'popular'} onChange={(e) => set({ sort: e.target.value })}>
              {SORTS.map(([v, label]) => <option key={v} value={v}>เรียง: {label}</option>)}
            </select>
          </div>
          {res?.items.length === 0 && (
            <Empty title="ไม่พบสินค้าที่ค้นหา" text="ลองใช้คำค้นที่สั้นลง ตรวจการสะกด หรือล้างตัวกรองออก">
              <Link className="btn" href="/search">ล้างตัวกรอง</Link>
            </Empty>
          )}
          <div className="grid">{res?.items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          {res && <Pager page={res.page} total={res.total} size={res.pageSize} onPage={(n) => set({ page: String(n) })} />}
        </div>
      </div>
    </>
  );
}
