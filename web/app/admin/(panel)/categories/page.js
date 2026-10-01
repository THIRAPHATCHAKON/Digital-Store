'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../../lib/api';
import { useStore } from '../../../../lib/store';
import { Empty, Modal, Title } from '../../../../components/ui';

// Categories: one card each (colour, name · product count), created and edited in a modal
export default function Categories() {
  const { shop, loadShop } = useStore();
  const [items, setItems] = useState(null);
  const [edit, setEdit] = useState(null); // category being edited, or {} for a new one

  const load = useCallback(() => api('/admin/categories').then((r) => setItems(r.items)), []);
  useEffect(() => { load(); }, [load]);
  // the storefront reads categories from the shared store, so refresh that copy too
  const saved = () => { setEdit(null); load(); loadShop(); };

  return (
    <>
      <Title title="หมวดหมู่" desc={`จัดการหมวดหมู่สินค้าของ ${shop.store_name}`}>
        <button className="btn" onClick={() => setEdit({})}>+ หมวดหมู่ใหม่</button>
      </Title>
      {items?.length === 0 && <Empty title="ยังไม่มีหมวดหมู่" text="สร้างหมวดหมู่แรกก่อนเพิ่มสินค้า" />}
      <div className="cg">
        {items?.map((c) => (
          <div key={c.slug} className="cc">
            <span className="sw38" style={{ background: c.color }} />
            <b>{c.name} · {c.count.toLocaleString('th-TH')}</b>
            <button className="lnk sm" style={{ alignSelf: 'flex-start' }} onClick={() => setEdit(c)}>แก้ไขหมวดหมู่</button>
          </div>
        ))}
      </div>
      {edit && <CategoryModal c={edit} onClose={() => setEdit(null)} onSaved={saved} />}
    </>
  );
}

function CategoryModal({ c, onClose, onSaved }) {
  const { notify } = useStore();
  const isNew = !c.slug;
  const [f, setF] = useState({ name: c.name ?? '', slug: c.slug ?? '', color: c.color ?? '#6366f1' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const run = async (fn, done) => {
    setBusy(true);
    try { await fn(); notify(done); onSaved(); } catch (e) { setErrors(e.data?.errors ?? { form: e.message }); } finally { setBusy(false); }
  };
  const save = (e) => {
    e.preventDefault();
    run(() => api(isNew ? '/admin/categories' : `/admin/categories/${c.slug}`, { method: isNew ? 'POST' : 'PUT', body: f }), 'บันทึกหมวดหมู่แล้ว');
  };
  const remove = () => run(() => api(`/admin/categories/${c.slug}`, { method: 'DELETE' }), 'ลบหมวดหมู่แล้ว');

  return (
    <Modal onClose={onClose}>
      <form className="stack" style={{ gap: 16 }} onSubmit={save}>
        <h2 className="h2">{isNew ? 'หมวดหมู่ใหม่' : 'แก้ไขหมวดหมู่'}</h2>
        <div>
          <input className={`inp ${errors.name ? 'bad' : ''}`} aria-label="ชื่อหมวดหมู่" placeholder="ชื่อหมวดหมู่" value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })} required />
          {errors.name && <div className="err">{errors.name}</div>}
        </div>
        <div>
          {/* the slug is in product rows and catalog links, so it can't change after creation */}
          <input className={`inp ${errors.slug ? 'bad' : ''}`} aria-label="slug" placeholder="slug สำหรับ URL เช่น audio-pack" value={f.slug}
            onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase() })} disabled={!isNew} required />
          {errors.slug && <div className="err">{errors.slug}</div>}
        </div>
        <label className="row">สีของหมวดหมู่
          <input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} />
        </label>
        {errors.color && <div className="err" style={{ margin: 0 }}>{errors.color}</div>}
        {errors.form && <div className="err" style={{ margin: 0 }}>{errors.form}</div>}
        <div className="between">
          {isNew ? <span /> : <button type="button" className="lnk bad" disabled={busy} onClick={remove}>ลบหมวดหมู่</button>}
          <div className="row">
            <button type="button" className="btn2" onClick={onClose}>ยกเลิก</button>
            <button className="btn" disabled={busy}>บันทึก</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
