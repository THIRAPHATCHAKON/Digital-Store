'use client';
import Link from 'next/link';
import { mb, when } from '../../../../lib/api';
import { useStore } from '../../../../lib/store';
import { Empty, Pager, Status, Title } from '../../../../components/ui';
import { Tools, useList } from '../../../../components/admin';

// Files: every uploaded product file, with how often buyers downloaded it. Replace a file from its product form.
export default function Files() {
  const { shop } = useStore();
  const { res, f, set } = useList('/admin/files', ['q', 'type']);

  return (
    <>
      <Title title="ไฟล์" desc={`ไฟล์ดิจิทัลทั้งหมดของ ${shop.store_name}`} />
      <Tools f={f} set={set} placeholder="ค้นหาชื่อไฟล์หรือชื่อสินค้า" optionKey="type" allLabel="ทุกประเภทไฟล์"
        options={[['zip', 'ZIP'], ['pdf', 'PDF'], ['mp4', 'MP4']]} exportType="files" />

      {res?.items.length === 0 ? (
        <Empty title={f.q || f.type ? 'ไม่พบไฟล์ตามเงื่อนไข' : 'ยังไม่มีไฟล์'} text="ไฟล์จะแสดงที่นี่เมื่ออัปโหลดจากฟอร์มสินค้า" />
      ) : (
        <div className="tblw">
          <table className="tbl">
            <thead><tr><th>ไฟล์</th><th>สินค้า</th><th>ขนาด / เวอร์ชัน</th><th>ดาวน์โหลด</th><th>สถานะสินค้า</th></tr></thead>
            <tbody>
              {res?.items.map((x) => (
                <tr key={x.id}>
                  <td>{x.file_name}<div className="mut sm">อัปเดต {when(x.updated_at, false)}</div></td>
                  <td><Link href={`/admin/products/${x.id}`}>{x.name}</Link></td>
                  <td>{mb(x.file_size)}{x.version && ` · ${x.version}`}</td>
                  <td>{x.downloads.toLocaleString('th-TH')} ครั้ง</td>
                  <td><Status s={x.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {res && <Pager page={res.page} total={res.total} size={20} onPage={(n) => set({ page: String(n) })} />}
    </>
  );
}
