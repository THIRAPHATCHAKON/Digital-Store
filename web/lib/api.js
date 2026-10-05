export const LICENSES = { personal: 'ใช้งานส่วนตัว', commercial: 'ใช้งานเชิงพาณิชย์ได้' };
export const baht = (n) => '฿' + Number(n ?? 0).toLocaleString('th-TH');
export const when = (d, time = true) =>
  d ? new Date(d).toLocaleString('th-TH', time ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }) : '';
export const mb = (b) => (b ? `${(b / 1048576).toFixed(1)} MB` : '');
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// localStorage can throw (private mode, blocked storage): never let that break a page
export const store = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const authHeader = () => {
  const token = store.get('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// body: object → JSON; string → sent as-is with `type` (the CSV import)
export async function api(path, { method = 'GET', body, type } = {}) {
  const raw = typeof body === 'string';
  const res = await fetch('/api' + path, {
    method,
    headers: { ...authHeader(), ...(body && { 'Content-Type': raw ? type : 'application/json' }) },
    body: raw ? body : body && JSON.stringify(body),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(data?.error || 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง'), { status: res.status, data });
  return data;
}

// Multipart upload with progress (fetch can't report upload progress). Returns { promise, abort }.
export function upload(path, method, formData, onProgress) {
  const xhr = new XMLHttpRequest();
  const promise = new Promise((resolve, reject) => {
    xhr.open(method, '/api' + path);
    const token = store.get('token');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded, e.total);
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch {}
      xhr.status < 300 ? resolve(data)
        : reject(Object.assign(new Error(data?.error || 'บันทึกไม่สำเร็จ'), { status: xhr.status, data }));
    };
    xhr.onerror = () => reject(new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'));
    xhr.onabort = () => reject(Object.assign(new Error('ยกเลิกการอัปโหลดแล้ว'), { aborted: true }));
    xhr.send(formData);
  });
  return { promise, abort: () => xhr.abort() };
}

// TUS sends resumable chunks straight to Supabase Storage; file bytes never pass through Vercel.
export function uploadToSignedUrl(ticket, file, onProgress) {
  let activeXhr, aborted = false;
  const request = (method, url, headers, body, onUpload) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest(); activeXhr = xhr;
    xhr.open(method, url);
    Object.entries(headers).forEach(([k, v]) => v && xhr.setRequestHeader(k, v));
    if (onUpload) xhr.upload.onprogress = (e) => e.lengthComputable && onUpload(e.loaded);
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300
      ? resolve({ status: xhr.status, location: xhr.getResponseHeader('Location'), offset: xhr.getResponseHeader('Upload-Offset') })
      : reject(new Error(`Supabase Storage ตอบกลับ ${xhr.status}`));
    xhr.onerror = () => reject(new Error('เชื่อมต่อ Supabase Storage ไม่ได้'));
    xhr.onabort = () => reject(Object.assign(new Error('ยกเลิกการอัปโหลดแล้ว'), { aborted: true }));
    xhr.send(body);
  });
  const enc = (s) => btoa(unescape(encodeURIComponent(s)));
  const promise = (async () => {
    const headers = { 'Tus-Resumable': '1.0.0', apikey: ticket.apikey, 'x-signature': ticket.token };
    const metadata = { bucketName: ticket.bucketName, objectName: ticket.objectName,
      contentType: file.type || 'application/octet-stream', cacheControl: '3600' };
    const created = await request('POST', ticket.uploadEndpoint, { ...headers, 'Upload-Length': String(file.size),
      'Upload-Metadata': Object.entries(metadata).map(([k, v]) => `${k} ${enc(v)}`).join(',') }, null);
    if (!created.location) throw new Error('Supabase Storage ไม่ส่ง URL สำหรับอัปโหลดกลับมา');
    const target = new URL(created.location, ticket.uploadEndpoint).href;
    const chunkSize = 6 * 1024 * 1024;
    let offset = 0;
    let retriesAtOffset = 0;
    while (offset < file.size) {
      if (aborted) throw Object.assign(new Error('ยกเลิกการอัปโหลดแล้ว'), { aborted: true });
      const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
      try {
        await request('PATCH', target, { ...headers, 'Upload-Offset': String(offset), 'Content-Type': 'application/offset+octet-stream' }, chunk,
          (loaded) => onProgress(offset + loaded));
        offset += chunk.size; retriesAtOffset = 0; onProgress(offset);
      } catch (error) {
        if (error.aborted) throw error;
        let recovered = false;
        let serverOffset = offset;
        for (let attempt = 0; attempt < 3 && !recovered; attempt++) {
          await new Promise((r) => setTimeout(r, [1000, 3000, 6000][attempt]));
          try {
            const state = await request('HEAD', target, { ...headers, 'Tus-Resumable': '1.0.0' });
            serverOffset = Number(state.offset);
            if (Number.isFinite(serverOffset) && serverOffset > offset && serverOffset <= file.size) {
              offset = serverOffset; retriesAtOffset = 0; onProgress(offset); recovered = true;
            }
          } catch {}
        }
        if (serverOffset === file.size) { offset = file.size; onProgress(offset); recovered = true; }
        if (!recovered && retriesAtOffset++ >= 2) throw error;
      }
    }
  })();
  return { promise, abort: () => { aborted = true; activeXhr?.abort(); } };
}

// Admin exports need the Bearer header, which a plain <a href> can't send: fetch → blob → click.
export async function saveFile(path) {
  const res = await fetch('/api' + path, { headers: authHeader() });
  if (!res.ok) throw new Error('ส่งออกข้อมูลไม่สำเร็จ');
  const name = res.headers.get('content-disposition')?.match(/filename="?([^";]+)/)?.[1] ?? 'export';
  const url = URL.createObjectURL(await res.blob());
  Object.assign(document.createElement('a'), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// App Inventor's WebViewer can't download files. The app listens for WebViewStringChange
// and opens the URL with an ActivityStarter (Chrome). Plain browsers just open it.
export function openExternal(url) {
  if (typeof window !== 'undefined' && window.AppInventor) window.AppInventor.setWebViewString(url);
  else window.location.href = url;
}
