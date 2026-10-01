'use client';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { api, saveFile } from '../lib/api';
import { useStore } from '../lib/store';

// Shared by every admin table page: filters live in the query string (shareable, back button works).
// `keys` are the query params this page owns; anything else (e.g. ?open=) is kept out of the API call.
export function useList(path, keys) {
  const sp = useSearchParams();
  const router = useRouter();
  const here = usePathname();
  const [res, setRes] = useState(null);
  const f = Object.fromEntries([...keys, 'page'].map((k) => [k, sp.get(k) ?? '']));

  const set = (patch) => {
    const next = new URLSearchParams({ ...f, page: '', ...patch }); // a filter change goes back to page 1
    for (const [k, v] of [...next]) if (!v) next.delete(k);
    router.replace(`${here}?${next}`, { scroll: false });
  };
  const qs = String(new URLSearchParams(Object.entries(f).filter(([k, v]) => v && k !== 'open')));
  const load = useCallback(
    () => api(`${path}?${qs}`).then(setRes).catch(() => setRes({ items: [], total: 0, page: 1 })),
    [path, qs]);
  useEffect(() => { load(); }, [load]);

  return { res, f, set, load };
}

// Search + status chip + "ส่งออก CSV" row above a table.
export function Tools({ f, set, placeholder, options, optionKey = 'status', allLabel = 'ทุกสถานะ', exportType }) {
  const { notify } = useStore();
  return (
    <div className="tools">
      <form onSubmit={(e) => { e.preventDefault(); set({ q: new FormData(e.target).get('q') }); }}>
        <input className="srch" name="q" defaultValue={f.q} key={f.q} aria-label={placeholder} placeholder={placeholder} />
      </form>
      {options && (
        <select className="chip" aria-label={allLabel} value={f[optionKey]} onChange={(e) => set({ [optionKey]: e.target.value })}>
          <option value="">{allLabel}</option>
          {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      )}
      {exportType && (
        <button className="chip" onClick={() => saveFile(`/admin/export/${exportType}`).catch((e) => notify(e.message))}>ส่งออก CSV</button>
      )}
    </div>
  );
}
