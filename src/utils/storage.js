import { normalizePhoneDigits, parsePhone } from './phone';

export const CUSTOMER_KEY = 'kiosko_customer';
export const INSTALL_DISMISS_KEY = 'kiosko_install_dismissed';
export const INSTALL_DONE_KEY = 'kiosko_install_done';

const LOGIN_MEMORY_KEY = 'kiosko_login_memory';
export const loadLoginMemory = () => {
  try {
    const raw = localStorage.getItem(LOGIN_MEMORY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
export const saveLoginMemory = (data) => {
  try { localStorage.setItem(LOGIN_MEMORY_KEY, JSON.stringify(data)); } catch {}
};
export const clearLoginMemory = () => {
  try { localStorage.removeItem(LOGIN_MEMORY_KEY); } catch {}
};

export const loadSavedCustomer = () => {
  try {
    const raw = localStorage.getItem(CUSTOMER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export const saveCustomerData = (data) => {
  try { localStorage.setItem(CUSTOMER_KEY, JSON.stringify(data)); } catch {}
};

export const buildKnownCustomers = (orders, saved) => {
  const map = new Map();
  for (const o of orders) {
    const digits = normalizePhoneDigits(o.phone);
    if (!digits || map.has(digits)) continue;
    const { code, number } = parsePhone(o.phone);
    map.set(digits, { name: o.customerName || '', code, number, address: o.address || '', phone: o.phone });
  }
  if (saved && saved.phoneNumber) {
    const key = `${saved.phoneCode || ''}${saved.phoneNumber || ''}`.replace(/\D/g, '').slice(-11);
    if (key && !map.has(key)) {
      map.set(key, {
        name: saved.customerName || '',
        code: saved.phoneCode || '',
        number: saved.phoneNumber || '',
        address: saved.address || '',
        phone: `${saved.phoneCode || ''} ${saved.phoneNumber || ''}`.trim()
      });
    }
  }
  return Array.from(map.values());
};

export const FAVORITES_KEY = 'kiosko_favorites';
export const loadFavorites = () => {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

const PRICE_WATCH_KEY = 'kiosko_price_watch';
export const loadPriceWatch = () => {
  try {
    const raw = localStorage.getItem(PRICE_WATCH_KEY);
    const p = raw ? JSON.parse(raw) : {};
    return p && typeof p === 'object' ? p : {};
  } catch { return {}; }
};
export const savePriceWatch = (watch) => {
  try { localStorage.setItem(PRICE_WATCH_KEY, JSON.stringify(watch)); } catch {}
};
