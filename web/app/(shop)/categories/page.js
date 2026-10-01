'use client';
import Link from 'next/link';
import { useStore } from '../../../lib/store';
import { Empty, Title } from '../../../components/ui';

// "หมวดหมู่" in the top navigation: one card per category, linking into the catalog
export default function Categories() {
  const { cats } = useStore();
  return (
    <>
      <Title title="หมวดหมู่" desc="เลือกดูสินค้าตามประเภทที่คุณสนใจ" />
      {cats.length === 0 && <Empty title="ยังไม่มีหมวดหมู่" />}
      <div className="cg">
        {cats.map((c) => (
          <Link key={c.slug} href={`/search?category=${c.slug}`} className="cc" style={{ color: 'inherit' }}>
            <span className="sw38" style={{ background: c.color }} />
            <b>{c.name} · {c.count.toLocaleString('th-TH')}</b>
            <span className="sm" style={{ color: 'var(--ac)' }}>ดูสินค้าในหมวดนี้</span>
          </Link>
        ))}
      </div>
    </>
  );
}
