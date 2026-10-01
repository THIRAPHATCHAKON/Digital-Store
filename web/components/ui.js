'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '../lib/store';
import { baht } from '../lib/api';

// Line icons for the navigation (24px grid, stroke follows the text colour).
const ICONS = {
  house: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  store: <><path d="M3 9l1.5-5h15L21 9" /><path d="M4 9v11h16V9" /><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /><path d="M10 20v-6h4v6" /></>,
  library: <><path d="m16 6 4 14" /><path d="M12 6v14" /><path d="M8 8v12" /><path d="M4 4v16" /></>,
  cart: <><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></>,
  user: <><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" /></>,
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
  package: <><path d="M21 8l-9-5-9 5v8l9 5 9-5z" /><path d="m3 8 9 5 9-5" /><path d="M12 13v8" /></>,
  grid: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  files: <><path d="M20 7h-3a2 2 0 0 1-2-2V2" /><path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2Z" /><path d="M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8" /></>,
  wallet: <><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></>,
  transfer: <><path d="M3 5v14" /><path d="M21 12H7" /><path d="m15 18 6-6-6-6" /></>,
  settings: <><path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" /></>,
  upload: <><path d="M12 13v8" /><path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24" /><path d="m8 17 4-4 4 4" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>,
};
export const Icon = ({ name, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>
);

export function Logo({ href = '/' }) {
  const { shop } = useStore();
  return <Link href={href} className="lg">◆ {shop.store_name}</Link>;
}

// "Digital Store" → "DS": the mark on artwork that has no cover image
const initials = (name) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export const Title = ({ title, desc, eyebrow, children }) => (
  <div className="ttl">
    <div>
      {eyebrow && <div className="eyb">{eyebrow}</div>}
      <h1>{title}</h1>
      {desc && <p>{desc}</p>}
    </div>
    {children && <div className="row">{children}</div>}
  </div>
);

// Cover image when the product has one, otherwise the category colour. Takes cover_url or coverUrl.
export function Art({ p, className = '', children }) {
  const { cat } = useStore();
  const src = p.cover_url ?? p.coverUrl;
  return (
    <div className={`art ${className}`} style={{ background: cat(p.category).color }}>
      {src && <img src={src} alt="" />}
      {children}
    </div>
  );
}

export const Rating = ({ p }) => (p.review_count > 0
  ? <span className="rt">★ {Number(p.rating).toFixed(1)}</span>
  : <span className="pd">ยังไม่มีรีวิว</span>);

// `footer` replaces price + rating (the library puts its download button there)
export function ProductCard({ p, href = `/products/${p.id}`, footer }) {
  const { cat, shop } = useStore();
  const c = cat(p.category);
  return (
    <div className="pc">
      <Link href={href}>
        <Art p={p}>
          <span className="badge" style={{ color: c.color }}>{c.name}</span>
          {!(p.cover_url ?? p.coverUrl) && <b>{initials(shop.store_name)}</b>}
        </Art>
      </Link>
      <Link href={href} className="pt">{p.name}</Link>
      <span className="pd">{p.seller || shop.store_name}</span>
      <div className="prow">{footer ?? <><span className="pp">{baht(p.price)}</span><Rating p={p} /></>}</div>
    </div>
  );
}

const STATUS = {
  PAID: 'ชำระแล้ว', PENDING: 'รอตรวจสอบ', FAILED: 'ไม่สำเร็จ', REFUNDED: 'คืนเงินแล้ว',
  PUBLISHED: 'เผยแพร่แล้ว', DRAFT: 'ฉบับร่าง', ACTIVE: 'ใช้งานอยู่', DISABLED: 'ถูกระงับ',
};
export const statusOptions = (...keys) => keys.map((k) => [k, STATUS[k]]); // for the admin filter chips
export const Status = ({ s }) => <span className={`st st-${s}`}>{STATUS[s] ?? s}</span>;

export function Empty({ title, text, children }) {
  return (
    <div className="empty">
      <div className="eic" />
      <b>{title}</b>
      {text && <p>{text}</p>}
      {children && <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>{children}</div>}
    </div>
  );
}

export const TestBanner = ({ text = 'ระบบทดสอบ Stripe — ไม่มีการตัดเงินจริง ใช้บัตรทดสอบเท่านั้น' }) => (
  <div className="test"><span className="tb">TEST MODE</span><span>{text}</span></div>
);

const active = (path, href) => (href === '/' ? path === '/' : path.startsWith(href));
const NAV = [['/', 'หน้าแรก'], ['/search', 'ร้านค้า'], ['/categories', 'หมวดหมู่'], ['/library', 'คลังของฉัน'], ['/orders', 'คำสั่งซื้อ']];

// Top navigation (desktop). On mobile only the logo and the bag stay; <Tabs/> carries the links.
export function Header() {
  const { cartCount, user } = useStore();
  const path = usePathname();
  return (
    <header className="hdr">
      <Logo />
      <nav className="nav hide-m">
        {NAV.map(([href, label]) => <Link key={href} href={href} className={active(path, href) ? 'on' : ''}>{label}</Link>)}
      </nav>
      <form action="/search" className="hide-m">
        <input className="srch" name="q" aria-label="ค้นหา" placeholder="ค้นหาเทมเพลต ซอร์สโค้ด คอร์ส และอื่น ๆ" />
      </form>
      <Link href="/cart" className="icb" aria-label={`ตะกร้า ${cartCount} รายการ`}>
        <img src="/icons/shopping-bag.svg" alt="" width="18" height="18" />
        {cartCount > 0 && <span className="cb">{cartCount}</span>}
      </Link>
      {user && <Link href="/account" className="av hide-m" aria-label="บัญชีของฉัน">{user.name[0]}</Link>}
      {user === null && <Link href="/login" className="btn2 hide-m">เข้าสู่ระบบ</Link>}
    </header>
  );
}

const TABS = [['/', 'หน้าแรก', 'house'], ['/search', 'ร้านค้า', 'store'], ['/library', 'คลัง', 'library'], ['/cart', 'ตะกร้า', 'cart'], ['/account', 'โปรไฟล์', 'user']];

export function Tabs({ disabled }) {
  const path = usePathname();
  const { cartCount } = useStore();
  return (
    <nav className={`tabs ${disabled ? 'off' : ''}`}>
      {TABS.map(([href, label, icon]) => (
        <Link key={href} href={href} className={active(path, href) ? 'on' : ''}>
          <Icon name={icon} size={19} />{label}
          {href === '/cart' && cartCount > 0 && <span className="cb">{cartCount}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function CategoryChips({ active: on, children }) {
  const { cats } = useStore();
  return (
    <div className="chips">
      {cats.map((c) => (
        <Link key={c.slug} href={`/search?category=${c.slug}`} className={`chip ${on === c.slug ? 'on' : ''}`}>{c.name}</Link>
      ))}
      {children}
    </div>
  );
}

export function SignedOut({ title, text, next }) {
  return (
    <Empty title={title} text={text}>
      <Link className="btn" href={`/login?next=${encodeURIComponent(next)}`}>เข้าสู่ระบบ</Link>
      <Link className="btn2" href={`/login?tab=register&next=${encodeURIComponent(next)}`}>สมัครสมาชิก</Link>
    </Empty>
  );
}

export function Modal({ children, onClose }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

// Page-number chips: the current page with its neighbours, plus previous / next.
export function Pager({ page, total, size, onPage }) {
  const pages = Math.ceil(total / size);
  if (pages <= 1) return null;
  const from = Math.max(1, Math.min(page - 1, pages - 2));
  const nums = [from, from + 1, from + 2].filter((n) => n <= pages);
  return (
    <div className="chips">
      {page > 1 && <button className="chip" onClick={() => onPage(page - 1)}>← ก่อนหน้า</button>}
      {nums.map((n) => <button key={n} className={`chip ${n === page ? 'on' : ''}`} onClick={() => onPage(n)}>{n}</button>)}
      {page < pages && <button className="chip" onClick={() => onPage(page + 1)}>ถัดไป →</button>}
    </div>
  );
}

// Admin opened below 1280px
export function Narrow() {
  return (
    <Empty title="ระบบหลังร้านรองรับเดสก์ท็อปเท่านั้น" text="กรุณาเปิดบนหน้าจอกว้างอย่างน้อย 1280px เพื่อใช้ตารางข้อมูลและฟอร์มได้ครบทุกคอลัมน์">
      <Link className="btn" href="/">กลับไปหน้าร้าน</Link>
    </Empty>
  );
}
