'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { useStore } from '../../lib/store';
import { CategoryChips, Empty, ProductCard, Title } from '../../components/ui';

// Home: hero search, category chips, popular and newest products
export default function Home() {
  const { shop } = useStore();
  const [popular, setPopular] = useState(null);
  const [fresh, setFresh] = useState([]);
  const [error, setError] = useState(null);
  const search = useRef(null);

  useEffect(() => {
    api('/products?sort=popular&limit=8').then((r) => setPopular(r.items)).catch((e) => setError(e.message));
    api('/products?sort=newest&limit=8').then((r) => setFresh(r.items)).catch(() => {});
  }, []);

  // the hero search shows a ⌘K hint, so the shortcut has to work
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); search.current?.focus(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // a shop with no sales yet ranks "popular" by date too: don't show the same row twice
  const sameRows = popular && popular.map((p) => p.id).join() === fresh.map((p) => p.id).join();

  return (
    <>
      <Title title="หน้าแรก" desc="ค้นพบเครื่องมือที่ช่วยให้ไอเดียของคุณไปได้ไกลขึ้น" />
      <section className="hero">
        <div>
          <h2>{shop.hero_title}</h2>
          <p>{shop.hero_text}</p>
          <form action="/search" className="sw">
            <input ref={search} className="srch big" name="q" aria-label="ค้นหา" placeholder="ค้นหาเทมเพลต ซอร์สโค้ด คอร์ส และอื่น ๆ" />
            <span className="kbd hide-m">⌘ K</span>
          </form>
        </div>
        <div className="hero-art" />
      </section>

      <CategoryChips><Link href="/search?file=zip" className="chip">ไฟล์ ZIP</Link></CategoryChips>

      {error && <div className="alert">{error}</div>}
      {popular?.length === 0 && <Empty title="ยังไม่มีสินค้าในร้าน" text="สินค้าที่เผยแพร่แล้วจะแสดงที่นี่" />}
      {popular?.length > 0 && (
        <>
          <div className="between"><h2 className="h2">ยอดนิยมตอนนี้</h2><Link href="/search?sort=popular">ดูทั้งหมด</Link></div>
          <div className="grid">{popular.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </>
      )}
      {fresh.length > 0 && !sameRows && (
        <>
          <div className="between"><h2 className="h2">มาใหม่ล่าสุด</h2><Link href="/search?sort=newest">ดูทั้งหมด</Link></div>
          <div className="grid">{fresh.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </>
      )}
    </>
  );
}
