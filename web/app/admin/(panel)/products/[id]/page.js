'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, LICENSES, mb, upload, when } from '../../../../../lib/api';
import { useStore } from '../../../../../lib/store';
import { useDeleteProduct } from '../../../../../lib/deleteProduct';
import { Icon, statusOptions, Title } from '../../../../../components/ui';

const MAX_DESC = 2000;
const check = {
  name: (v) => !v.trim() && 'กรุณากรอกชื่อสินค้า',
  category: (v) => !v && 'เลือกหมวดหมู่',
  price: (v) => !(Number(v) >= 10) && 'ราคาต้องไม่ต่ำกว่า 10 บาท',
  short_description: (v) => v.length > 200 && 'คำอธิบายสั้นยาวเกิน 200 ตัวอักษร',
  description: (v) => v.length > MAX_DESC && `ยาวเกิน ${MAX_DESC.toLocaleString()} ตัวอักษร`,
};
const EMPTY = {
  name: '', short_description: '', description: '', category: '', price: '', compare_at: '', seller: '', tags: '',
  version: '', license: 'personal', status: 'DRAFT',
};

// Add product (/admin/products/new) and edit product share this form
export default function ProductForm() {
  const { id } = useParams();
  const isNew = id === 'new';
  const router = useRouter();
  const { cats, shop, notify } = useStore();
  const [p, setP] = useState(null); // saved record
  const [f, setF] = useState(EMPTY);
  const [cover, setCover] = useState(null); // File
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [dirty, setDirty] = useState(false);
  const [progress, setProgress] = useState(null); // { loaded, total }
  const job = useRef(null);
  const del = useDeleteProduct(() => { setDirty(false); router.push('/admin/products'); });

  useEffect(() => {
    if (isNew) return;
    api(`/admin/products/${id}`).then((r) => {
      setP(r);
      setF(Object.fromEntries(Object.keys(EMPTY).map((k) => [k, k === 'tags' ? r.tags.join(', ') : r[k] == null ? '' : String(r[k])])));
    });
  }, [id, isNew]);

  // unsaved edits or a running upload: warn before the tab closes or reloads
  useEffect(() => {
    if (!dirty && !progress) return;
    const h = (e) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty, progress]);

  const change = (k, v) => { setF({ ...f, [k]: v }); setDirty(true); };
  const blur = (k) => setErrors({ ...errors, [k]: check[k]?.(f[k]) || null });

  async function save() {
    const local = Object.fromEntries(Object.entries(check).map(([k, fn]) => [k, fn(f[k])]).filter(([, v]) => v));
    if (Object.keys(local).length) { setErrors(local); document.getElementById(Object.keys(local)[0])?.focus(); return; }
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => fd.append(k, v));
    if (cover) fd.append('cover', cover);
    if (file) fd.append('file', file);
    setProgress({ loaded: 0, total: (cover?.size ?? 0) + (file?.size ?? 0) || 1 });
    job.current = upload(isNew ? '/admin/products' : `/admin/products/${id}`, isNew ? 'POST' : 'PUT', fd,
      (loaded, total) => setProgress({ loaded, total }));
    try {
      await job.current.promise;
      setDirty(false);
      notify(f.status === 'PUBLISHED' ? 'บันทึกและเผยแพร่แล้ว' : 'บันทึกเป็นฉบับร่างแล้ว');
      router.push('/admin/products');
    } catch (e) {
      if (!e.aborted) { setErrors(e.data?.errors ?? {}); notify(e.message); }
    } finally {
      setProgress(null); job.current = null;
    }
  }

  if (!isNew && !p) return <div className="ph" style={{ height: 400 }} />;
  const pct = progress ? Math.round((progress.loaded / progress.total) * 100) : 0;
  const fileName = file?.name ?? p?.file_name;
  // labels sit above the fields: a placeholder alone can't be read once the field has a value
  const text = (k, label, props) => (
    <div style={props?.style}>
      <label className="lbl" htmlFor={k}>{label}</label>
      <input id={k} className={`inp ${errors[k] ? 'bad' : ''}`}
        value={f[k]} onChange={(e) => change(k, e.target.value)} onBlur={() => blur(k)} {...props} style={undefined} />
      {errors[k] && <div className="err">{errors[k]}</div>}
    </div>
  );

  return (
    <>
      <Title title={isNew ? 'เพิ่มสินค้า' : 'แก้ไขสินค้า'}
        desc={p ? `${p.sku} · บันทึกล่าสุด ${when(p.updated_at)}` : `เพิ่มสินค้าใหม่ให้ ${shop.store_name}`} />
      <div className="pform">
        <section className="pnl">
          <h2 className="h2">ข้อมูลสินค้า</h2>
          {text('name', 'ชื่อสินค้า')}
          {text('short_description', 'คำอธิบายสั้น (แสดงใต้ราคา ไม่เกิน 200 ตัวอักษร)', { maxLength: 200 })}
          <div>
            <label className="lbl" htmlFor="description">รายละเอียดเต็ม (รองรับ Markdown)</label>
            <textarea id="description" className={`inp ${errors.description ? 'bad' : ''}`}
              value={f.description} onChange={(e) => change('description', e.target.value)} onBlur={() => blur('description')} />
            <div className="between"><span className="err">{errors.description}</span>
              <span className={`sm ${f.description.length > MAX_DESC ? 'bad' : 'mut'}`}>{f.description.length.toLocaleString()} / {MAX_DESC.toLocaleString()}</span></div>
          </div>
          <div>
            <label className="lbl" htmlFor="category">หมวดหมู่</label>
            <select id="category" className={`inp ${errors.category ? 'bad' : ''}`} value={f.category}
              onChange={(e) => change('category', e.target.value)} onBlur={() => blur('category')}>
              <option value="">เลือกหมวดหมู่</option>{cats.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            {errors.category && <div className="err">{errors.category}</div>}
          </div>
          <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            {text('price', 'ราคา (บาท)', { type: 'number', min: 1, step: '0.01', style: { flex: 1 } })}
            {text('compare_at', 'ราคาก่อนลด (ไม่บังคับ)', { type: 'number', min: 0, step: '0.01', style: { flex: 1 } })}
          </div>
          {text('seller', `ผู้ขาย (เว้นว่าง = ${shop.store_name})`)}
          {text('tags', 'แท็ก (คั่นด้วยจุลภาค)', { placeholder: 'เช่น notion, planner' })}
        </section>

        <aside className="stack sticky" style={{ top: 84 }}>
          <label className={`drop ${errors.file ? 'bad' : ''}`} id="file">
            <Icon name="upload" size={30} />
            <b>{file ? file.name : 'อัปโหลดไฟล์ดิจิทัล'}</b>
            <small>{file ? `${mb(file.size)} · จะอัปโหลดตอนบันทึก` : 'ZIP, PDF, MP4 ไม่เกิน 500 MB'}</small>
            <input type="file" accept=".zip,.pdf,.mp4" hidden
              onChange={(e) => { setFile(e.target.files[0] ?? null); setDirty(true); setErrors({ ...errors, file: null }); }} />
          </label>
          {errors.file && <div className="err" style={{ margin: 0 }}>{errors.file}</div>}
          {progress && (
            <div className="mf" style={{ flexDirection: 'column', alignItems: 'stretch', padding: 12 }}>
              <div className="between"><span>กำลังอัปโหลด {pct}%</span><button className="lnk" onClick={() => job.current?.abort()}>ยกเลิก</button></div>
              <div className="bar"><i style={{ width: `${pct}%` }} /></div>
            </div>
          )}
          <label className="mf">เวอร์ชัน<input value={f.version} placeholder="เช่น 1.0" onChange={(e) => change('version', e.target.value)} /></label>
          <label className="mf">สิทธิ์การใช้งาน
            <select value={f.license} onChange={(e) => change('license', e.target.value)}>
              {Object.entries(LICENSES).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </label>
          <div className="mf">ไฟล์: {fileName ? `${fileName} · ${mb(file?.size ?? p?.file_size)}` : <span className="mut">ยังไม่มีไฟล์</span>}</div>
          <label className="mf" id="cover" style={{ cursor: 'pointer' }}>
            ภาพปก: <span className="mut" style={{ flex: 1 }}>{cover ? cover.name : p?.cover ? 'มีภาพปกแล้ว · คลิกเพื่อเปลี่ยน' : 'ไม่บังคับ · JPG, PNG ไม่เกิน 2 MB'}</span>
            <input type="file" accept="image/jpeg,image/png" hidden onChange={(e) => {
              const c = e.target.files[0];
              if (c && c.size > 2 * 1048576) return setErrors({ ...errors, cover: 'ภาพปกต้องไม่เกิน 2 MB' });
              setCover(c ?? null); setDirty(true); setErrors({ ...errors, cover: null });
            }} />
          </label>
          {errors.cover && <div className="err" style={{ margin: 0 }}>{errors.cover}</div>}
          <label className="mf">สถานะ
            <select value={f.status} onChange={(e) => change('status', e.target.value)}>
              {statusOptions('DRAFT', 'PUBLISHED').map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </label>
          <button className="btn btnl" disabled={!!progress} onClick={save}>{progress ? `กำลังอัปโหลด ${pct}%` : isNew ? 'บันทึกสินค้า' : 'บันทึกการเปลี่ยนแปลง'}</button>
          {!isNew && <button className="btn2 btnl danger" disabled={!!progress} onClick={() => del.ask(p)}>ลบสินค้านี้</button>}
        </aside>
      </div>
      {del.modal}
    </>
  );
}
