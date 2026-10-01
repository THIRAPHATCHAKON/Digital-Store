'use client';
import { api, baht, when } from '../../../../lib/api';
import { useStore } from '../../../../lib/store';
import { Empty, Pager, Status, Title } from '../../../../components/ui';
import { Tools, useList } from '../../../../components/admin';

// Customers: who bought what in total, with suspend / restore
export default function Customers() {
  const { shop, notify } = useStore();
  const { res, f, set, load } = useList('/admin/customers', ['q', 'status']);

  async function toggle(u) {
    if (!u.disabled && !confirm(`ระงับบัญชี ${u.email}? ลูกค้าจะถูกออกจากระบบทันทีและเข้าสู่ระบบไม่ได้จนกว่าจะยกเลิกการระงับ`)) return;
    try {
      await api(`/admin/customers/${u.id}`, { method: 'PATCH', body: { disabled: !u.disabled } });
      notify(u.disabled ? 'ยกเลิกการระงับแล้ว' : 'ระงับบัญชีแล้ว');
      load();
    } catch (e) { notify(e.message); }
  }

  return (
    <>
      <Title title="ลูกค้า" desc={`จัดการลูกค้าทั้งหมดของ ${shop.store_name}`} />
      <Tools f={f} set={set} placeholder="ค้นหาชื่อหรืออีเมลลูกค้า" options={[['active', 'ใช้งานอยู่'], ['disabled', 'ถูกระงับ']]} exportType="customers" />

      {res?.items.length === 0 ? (
        <Empty title={f.q || f.status ? 'ไม่พบลูกค้าตามเงื่อนไข' : 'ยังไม่มีลูกค้า'} text="ลูกค้าที่สมัครสมาชิกจะแสดงที่นี่" />
      ) : (
        <div className="tblw">
          <table className="tbl">
            <thead><tr><th>ลูกค้า</th><th>สมัครเมื่อ</th><th>คำสั่งซื้อ</th><th>ยอดซื้อสะสม</th><th>สถานะ</th><th /></tr></thead>
            <tbody>
              {res?.items.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}<div className="mut sm">{u.email}</div></td>
                  <td>{when(u.created_at, false)}</td>
                  <td>{u.order_count} ครั้ง</td>
                  <td>{baht(u.total_spent)}</td>
                  <td><Status s={u.disabled ? 'DISABLED' : 'ACTIVE'} /></td>
                  <td style={{ textAlign: 'right' }}>
                    <button className={`lnk ${u.disabled ? '' : 'bad'}`} onClick={() => toggle(u)}>{u.disabled ? 'ยกเลิกการระงับ' : 'ระงับบัญชี'}</button>
                  </td>
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
