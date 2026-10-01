'use client';
import { useState } from 'react';
import { api, openExternal } from './api';

// Shared by the library, order history and payment result: all spend the same download quota.
export function useDownload(onDone) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState({});
  async function download(itemId) {
    setBusy(itemId); setError((e) => ({ ...e, [itemId]: null }));
    try {
      const r = await api(`/library/${itemId}/download`, { method: 'POST' });
      openExternal(r.url);
      onDone?.(itemId, r.downloadsLeft);
    } catch (e) {
      setError((x) => ({ ...x, [itemId]: e.message }));
    } finally {
      setBusy(null);
    }
  }
  // "ดาวน์โหลดทั้งหมด": one file after another — a browser drops downloads that start at the same instant
  const [all, setAll] = useState(false);
  async function downloadAll(itemIds) {
    setAll(true);
    for (const id of itemIds) {
      await download(id);
      await new Promise((r) => setTimeout(r, 1500));
    }
    setAll(false);
  }
  return { download, downloadAll, busy, busyAll: all, error };
}
