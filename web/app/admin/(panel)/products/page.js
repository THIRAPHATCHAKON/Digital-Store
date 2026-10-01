'use client';
import Link from 'next/link';
import { baht } from '../../../../lib/api';
import { useStore } from '../../../../lib/store';
import { useDeleteProduct } from '../../../../lib/deleteProduct';
import { Empty, Pager, Status, statusOptions, Title } from '../../../../components/ui';
import { Tools, useList } from '../../../../components/admin';

// Products
export default function Products() {
  const { cat, shop, notify } = useStore();
  const { res, f, set, load } = useList('/admin/products', ['q', 'status']);
  const del = useDeleteProduct((what) => { notify(what === 'deleted' ? 'ลบสินค้าแล้ว' : 'เปลี่ยนเป็นฉบับร่างแล้ว'); load(); });

  return (
    <>
      <Title title="สินค้า" desc={`จัดการสินค้าทั้งหมดของ ${shop.store_name}`}>
        <Link className="btn" href="/admin/products/new">+ เพิ่มสินค้า</Link>
      </Title>
      <Tools f={f} set={set} placeholder="ค้นหาชื่อสินค้า ผู้ขาย หรือรหัส SKU" options={statusOptions('PUBLISHED', 'DRAFT')} exportType="products" />

      {res?.items.length === 0 ? (
        f.q || f.status
          ? <Empty title="ไม่พบสินค้าตามเงื่อนไข" text="ลองล้างตัวกรองสถานะ หรือค้นด้วยคำที่สั้นลง"><Link className="btn" href="/admin/products">ล้างตัวกรอง</Link></Empty>
          : <Empty title="ยังไม่มีสินค้าในร้าน" text="เริ่มจากเพิ่มสินค้าชิ้นแรก อัปโหลดไฟล์ แล้วเปลี่ยนสถานะเป็นเผยแพร่เพื่อให้แสดงบนหน้าร้าน"><Link className="btn" href="/admin/products/new">+ เพิ่มสินค้า</Link></Empty>
      ) : (
        <div className="tblw">
          <table className="tbl">
            <thead><tr><th>สินค้า</th><th>หมวดหมู่ / ผู้ขาย</th><th>ราคา</th><th>ขายแล้ว</th><th>สถานะ</th><th /></tr></thead>
            <tbody>
              {res?.items.map((p) => (
                <tr key={p.id}>
                  <td style={{ maxWidth: 360 }}>
                    <Link href={`/admin/products/${p.id}`} className="pt" style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</Link>
                    <span className="mut sm">{p.sku}{!p.has_file && ' · ยังไม่อัปโหลดไฟล์'}</span>
                  </td>
                  <td>{cat(p.category).name}<div className="mut sm">{p.seller || shop.store_name}</div></td>
                  <td>{baht(p.price)}</td>
                  <td>{p.sold.toLocaleString('th-TH')}</td>
                  <td><Status s={p.status} /></td>
                  <td>
                    <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                      <Link href={`/admin/products/${p.id}`}>แก้ไข</Link>
                      <button className="lnk bad" onClick={() => del.ask(p)}>ลบ</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {res && <Pager page={res.page} total={res.total} size={20} onPage={(n) => set({ page: String(n) })} />}
      {del.modal}
    </>
  );
}
