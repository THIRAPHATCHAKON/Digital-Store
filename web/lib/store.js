'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, store } from './api';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

// Guests keep the cart in localStorage; it's merged into the server cart on login.
const guestCart = () => store.get('guestCart') ?? [];
// shown until /api/settings answers; the admin Settings page overrides them
const SHOP = { store_name: 'Digital Store', support_email: '', hero_title: '', hero_text: '' };

export function StoreProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still loading, null = signed out
  const [cartCount, setCartCount] = useState(0);
  const [toast, setToast] = useState(null);
  const [cats, setCats] = useState([]);
  const [shop, setShop] = useState(SHOP);

  const refresh = useCallback(async () => {
    if (!store.get('token')) { setUser(null); setCartCount(guestCart().length); return; }
    try {
      const r = await api('/auth/me');
      setUser(r.user); setCartCount(r.cartCount);
    } catch {
      store.set('token', null); setUser(null); setCartCount(guestCart().length);
    }
  }, []);
  // categories and shop settings are edited in the admin, so every page reads them from here
  const loadShop = useCallback(() => {
    api('/categories').then((r) => setCats(r.items)).catch(() => {});
    api('/settings').then((r) => setShop({ ...SHOP, ...r })).catch(() => {});
  }, []);
  useEffect(() => { refresh(); loadShop(); }, [refresh, loadShop]);

  // unknown slug (category list still loading, or deleted) → the slug itself in the accent colour
  const cat = useCallback((slug) => cats.find((c) => c.slug === slug) ?? { slug, name: slug, color: 'var(--ac)' }, [cats]);

  const notify = useCallback((msg, action) => {
    setToast({ msg, action, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.action ? 5000 : 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function signIn(token) {
    store.set('token', token);
    const g = guestCart();
    if (g.length) {
      await api('/cart', { method: 'POST', body: { productIds: g } }).catch(() => {});
      store.set('guestCart', null);
    }
    await refresh();
  }
  async function signOut() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    store.set('token', null);
    store.set('billing', null); // name and address typed at checkout shouldn't outlive the session on a shared device
    await refresh();
  }
  async function addToCart(id) {
    if (user) {
      const r = await api('/cart', { method: 'POST', body: { productId: id } });
      setCartCount(r.cartCount);
    } else {
      const g = guestCart();
      if (g.includes(id)) throw new Error('สินค้านี้อยู่ในตะกร้าแล้ว');
      store.set('guestCart', [...g, id]);
      setCartCount(g.length + 1);
    }
  }
  async function removeFromCart(id) {
    if (user) await api(`/cart/${id}`, { method: 'DELETE' });
    else store.set('guestCart', guestCart().filter((x) => x !== id));
    setCartCount((n) => Math.max(0, n - 1));
  }

  return (
    <Ctx.Provider value={{ user, cartCount, cats, cat, shop, loadShop, refresh, signIn, signOut, addToCart, removeFromCart, guestCart, notify }}>
      {children}
      {toast && (
        <div className="toast" key={toast.id} role="status">
          {toast.msg}
          {toast.action && <button className="lnk" onClick={() => { toast.action.fn(); setToast(null); }}>{toast.action.label}</button>}
        </div>
      )}
    </Ctx.Provider>
  );
}
