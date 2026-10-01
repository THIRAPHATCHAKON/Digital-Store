'use client';
import { useState } from 'react';
import { api, saveFile } from '../../../../lib/api';
import { useStore } from '../../../../lib/store';
import { Title } from '../../../../components/ui';

const EXPORTS = [['products', 'สินค้า'], ['orders', 'คำสั่งซื้อ'], ['customers', 'ลูกค้า'], ['payments', 'การชำระเงิน']];

// Import / Export: products come in from CSV as drafts; any data set goes out as CSV or JSON
export default function ImportExport() {
  const { shop } = useStore();
  return (
    <>
      <Title title="นำเข้า / ส่งออก" desc={`ย้ายข้อมูลเข้าและออกจาก ${shop.store_name}`} />
      <div className="pform" style={{ gridTemplateColumns: '1fr 400px' }}>
        <ImportPanel />
        <ExportPanel />
      </div>
    </>
  );
}

function ImportPanel() {
  const { notify } = useStore();
  const [name, setName] = useState('');
  const [csv, setCsv] = useState(null);
  const [report, setReport] = useState(null); // dry-run result from the server
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);

  // choosing a file immediately runs a dry run: the server parses and validates, nothing is saved yet
  async function choose(e) {
    const file = e.target.files[0];
    e.target.value = ''; // let the same file be picked again after fixing it
    if (!file) return;
    setBusy(true); setReport(null); setDone(0);
    try {
      const text = await file.text();
      setName(file.name); setCsv(text);
      setReport(await api('/admin/import/products?dryRun=1', { method: 'POST', body: text, type: 'text/csv' }));
    } catch (e) { notify(e.message); } finally { setBusy(false); }
  }

  async function run() {
    setBusy(true);
    try {
      const r = await api('/admin/import/products', { method: 'POST', body: csv, type: 'text/csv' });
      setDone(r.imported);
      notify(`นำเข้า ${r.imported} รายการเป็นฉบับร่างแล้ว`);
    } catch (e) {
      if (e.data?.errors) setReport(e.data); // the file changed nothing on the server; show what is wrong
      notify(e.message);
    } finally { setBusy(false); }
  }

  const chip = (state, label) => <span className={`chip ${state === 'ok' ? 'on' : ''}`} style={state === 'bad' ? { color: 'var(--bad)', borderColor: 'var(--bad)' } : undefined}>{label}</span>;
  const r = report;
  const columnsOk = r && !r.missing.length;
  const rowsOk = columnsOk && !r.errorCount && r.rows > 0;

  return (
    <section className="pnl">
      <h2 className="h2">นำเข้าสินค้า</h2>
      <span className="mut">
        อัปโหลดไฟล์ CSV ที่มีคอลัมน์ name, category, price (และ compare_at, short_description, description, seller, tags, license, version ถ้ามี)
        สินค้าจะถูกสร้างเป็นฉบับร่าง แล้วค่อยอัปโหลดไฟล์และเผยแพร่จากฟอร์มสินค้า · <button className="lnk" onClick={() => saveFile('/admin/export/products').catch((e) => notify(e.message))}>ดาวน์โหลดไฟล์ตัวอย่าง</button>
      </span>
      <div className="step"><span>1. เลือกไฟล์ CSV{name && ` — ${name}`}</span>{chip(csv ? 'ok' : '', csv ? 'เลือกแล้ว' : 'รอไฟล์')}</div>
      <div className="step">
        <span>2. ตรวจคอลัมน์{r && (r.missing.length ? ` — ขาด ${r.missing.join(', ')}` : ` — พบ ${r.columns.join(', ')}`)}</span>
        {chip(!r ? '' : columnsOk ? 'ok' : 'bad', !r ? 'รอไฟล์' : columnsOk ? 'ผ่าน' : 'ไม่ผ่าน')}
      </div>
      <div className="step">
        <span>3. ตรวจข้อมูล{columnsOk && ` — ${r.rows} แถว${r.truncated ? ' (ตัดที่ 1,000 แถวแรก)' : ''}`}</span>
        {chip(!columnsOk ? '' : rowsOk ? 'ok' : 'bad', !columnsOk ? 'รอ' : rowsOk ? 'ผ่าน' : r.rows ? `ผิด ${r.errorCount} แถว` : 'ไม่มีข้อมูล')}
      </div>
      <div className="step"><span>4. นำเข้าเป็นฉบับร่าง</span>{chip(done ? 'ok' : '', done ? `นำเข้า ${done} รายการ` : rowsOk ? 'พร้อม' : 'รอ')}</div>
      {r?.errors.length > 0 && (
        <div className="alert"><div>
          {r.errors.map((e) => <div key={e.row}>แถวที่ {e.row}: {e.error}</div>)}
          {r.errorCount > r.errors.length && <div>และอีก {r.errorCount - r.errors.length} แถว</div>}
        </div></div>
      )}
      <div className="row">
        <label className="btn2">{csv ? 'เลือกไฟล์อื่น' : 'เลือกไฟล์ CSV'}<input type="file" accept=".csv,text/csv" hidden onChange={choose} /></label>
        <button className="btn" disabled={busy || !rowsOk || done > 0} onClick={run}>{busy ? 'กำลังดำเนินการ…' : 'เริ่มนำเข้า'}</button>
      </div>
    </section>
  );
}

function ExportPanel() {
  const { notify } = useStore();
  const [picked, setPicked] = useState(EXPORTS.map(([k]) => k));
  const [format, setFormat] = useState('csv');
  const [busy, setBusy] = useState(false);

  // one file per data set
  async function run() {
    setBusy(true);
    try {
      for (const type of picked) await saveFile(`/admin/export/${type}?format=${format}`);
    } catch (e) { notify(e.message); } finally { setBusy(false); }
  }

  return (
    <section className="pnl">
      <h2 className="h2">ส่งออกข้อมูล</h2>
      {EXPORTS.map(([k, label]) => (
        <label key={k} className="step" style={{ minHeight: 46, cursor: 'pointer' }}>
          <span>{label}</span>
          <input type="checkbox" checked={picked.includes(k)} style={{ accentColor: 'var(--ac)' }}
            onChange={(e) => setPicked(e.target.checked ? [...picked, k] : picked.filter((x) => x !== k))} />
        </label>
      ))}
      <div className="chips">
        {['csv', 'json'].map((x) => <button key={x} className={`chip ${format === x ? 'on' : ''}`} onClick={() => setFormat(x)}>{x.toUpperCase()}</button>)}
      </div>
      <button className="btn btnl" disabled={busy || !picked.length} onClick={run}>{busy ? 'กำลังส่งออก…' : 'ดาวน์โหลดไฟล์ส่งออก'}</button>
    </section>
  );
}
