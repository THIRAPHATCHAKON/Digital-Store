'use client';
import { useEffect, useState } from 'react';
import { api } from '../../../../lib/api';
import { useStore } from '../../../../lib/store';
import { Title } from '../../../../components/ui';

// key → label; the order is the order on the page
const SETTINGS = [
  ['store_name', 'ชื่อร้าน'],
  ['support_email', 'อีเมลฝ่ายช่วยเหลือ'],
  ['hero_title', 'ข้อความหลักบนหน้าแรก'],
  ['hero_text', 'ข้อความรองบนหน้าแรก'],
  ['download_limit', 'จำนวนครั้งที่ดาวน์โหลดได้ต่อสินค้า'],
  ['download_days', 'อายุสิทธิ์ดาวน์โหลด (วัน)'],
];

// Settings: one row per setting, edited in place
export default function Settings() {
  const { shop, loadShop, notify } = useStore();
  const [s, setS] = useState(null);
  const [edit, setEdit] = useState(null); // key being edited
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => { api('/admin/settings').then(setS); }, []);

  async function save(e) {
    e.preventDefault();
    try {
      setS(await api('/admin/settings', { method: 'PUT', body: { [edit]: value } }));
      loadShop(); // the storefront header, hero and support links read the same values
      notify('บันทึกการตั้งค่าแล้ว');
      setEdit(null);
    } catch (e) { setError(e.data?.errors?.[edit] ?? e.message); }
  }

  return (
    <>
      <Title title="ตั้งค่า" desc={`ตั้งค่าร้าน ${shop.store_name}`} />
      {!s ? <div className="ph" style={{ height: 408 }} /> : (
        <section className="pnl" style={{ maxWidth: 820, gap: 12 }}>
          {SETTINGS.map(([key, label]) => (edit === key ? (
            <form key={key} className="step" onSubmit={save}>
              <div style={{ flex: 1 }}>
                <input className={`inp ${error ? 'bad' : ''}`} style={{ height: 40 }} aria-label={label} value={value} autoFocus
                  onChange={(e) => setValue(e.target.value)} />
                {error && <div className="err">{error}</div>}
              </div>
              <button type="button" className="btn2" onClick={() => setEdit(null)}>ยกเลิก</button>
              <button className="btn">บันทึก</button>
            </form>
          ) : (
            <div key={key} className="step">
              <span>{label}<div className="mut sm">{s[key]}</div></span>
              <button className="btn2" onClick={() => { setEdit(key); setValue(s[key]); setError(null); }}>แก้ไข</button>
            </div>
          )))}
        </section>
      )}
    </>
  );
}
