import { useState, useEffect, useMemo, useCallback, useRef, Component } from 'react';
import { startRegistration, startAuthentication, browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser';
import { api, getToken, setToken, clearToken } from './api.js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// SVG Icons Helper Components for full visual depth without external dependencies
const Icon = ({ name, className = "w-5 h-5", ...props }) => {
  const icons = {
    store: <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7M2 7v13a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7M2 7h20M12 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
    shoppingBag: <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />,
    search: <path d="m21 21-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    trash: <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />,
    edit: <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    check: <path d="M20 6 9 17l-5-5" />,
    bell: <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />,
    package: <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />,
    alertTriangle: <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3zM12 9v4M12 17h.01" />,
    trendingUp: <path d="m22 7-8.5 8.5-5-5L1 18M16 7h6v6" />,
    user: <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
    users: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
    creditCard: <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM2 10h20M6 15h4" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
    chevronLeft: <path d="m15 18-6-6 6-6" />,
    maximize: <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />,
    phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />,
    mapPin: <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0zM12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />,
    clock: <path d="M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />,
    filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
    eye: <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
    dollarSign: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
    layers: <path d="m12 2 10 5-10 5L2 7zm0 10 10 5-10 5-10-5zm0 10 10 5-10 5-10-5z" />,
    refresh: <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />,
    sparkles: <path d="m12 3 1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />,
    upload: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />,
    sun: <path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />,
    moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
    whatsapp: <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />,
     arrowRight: <path d="M5 12h14M12 5l7 7-7 7" />,
    image: <path d="M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21" />,
     xCircle: <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM15 9l-6 6M9 9l6 6" />,
     checkCircle: <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9 12l2 2 4-4" />,
     info: <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-6M12 8h.01" />,
     key: <path d="M12 2a9.92 9.92 0 0 0-7 2.82L2.82 7.01a1 1 0 0 0 0 1.42l2.59 2.59a1 1 0 0 0 1.42 0L12 5.34l6.17 6.17a1 1 0 0 0 1.42 0l2.59-2.59a1 1 0 0 0 0-1.42L13 4.83c-.35-.35-.5-.83-.5-1.31A5.5 5.5 0 0 0 12 2z" />,
     fingerprint: <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4M14 13.12c0 2.38 0 6.38-1 8.88M17.29 21.02c.12-.6.43-2.3.5-3.02M2 12a10 10 0 0 1 18-6M2 16h.01M21.8 16c.2-2 .131-5.354 0-6M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2M8.65 22c.21-.66.45-1.32.57-2M9 6.8a6 6 0 0 1 9 5.2v2" />,
     heart: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" />,
     heartFilled: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" fill="currentColor" stroke="none" />,
      home: <path d="M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" />,
      logOut: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
     list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
     settings: <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
     zap: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
     bag: <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />,
     apple: <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.58,7.86 7.09,6.91 8.65,6.88C9.94,6.86 11.17,7.68 12.06,7.68C12.96,7.68 14.42,6.74 15.95,6.88C16.57,6.91 18.23,7.09 19.3,8.68C19.2,8.74 16.79,10.05 16.83,12.9C16.88,16.24 19.88,17.37 19.92,17.39C19.88,17.47 19.25,19.11 18.71,19.5ZM13.3,5.41C13.98,4.57 14.46,3.4 14.32,2.21C13.28,2.26 12.05,2.88 11.34,3.72C10.7,4.48 10.13,5.65 10.28,6.83C11.44,6.94 12.62,6.26 13.3,5.41Z" fill="currentColor" stroke="none" />,
     faceId: (
       <>
         <path d="M3 7V5a2 2 0 0 1 2-2h2" />
         <path d="M17 3h2a2 2 0 0 1 2 2v2" />
         <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
         <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
         <path d="M8 14s1.5 2 4 2 4-2 4-2" />
         <path d="M9 9h.01" />
         <path d="M15 9h.01" />
       </>
     ),
    };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

// Detección de plataforma para elegir el logo de biometría correcto:
// iOS → manzana de Apple + Face ID; Android/otros → huella dactilar.
const IS_IOS =
  /iPad|iPhone|iPod/.test(typeof navigator !== 'undefined' ? navigator.userAgent : '') ||
  (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const formatTimestamp = (date = new Date()) =>
  date.toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const formatSize = (product) => {
  if (!product || product.sizeValue === undefined || product.sizeValue === null || product.sizeValue === '') return '';
  const num = Number(product.sizeValue);
  const formatted = Number.isInteger(num) ? String(num) : num.toLocaleString('es-AR');
  return `${formatted}${product.sizeUnit || ''}`;
};

const formatUsd = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;

// Formatea un número como monto con separador de miles (.) y decimales (,),
// ej: 1100 → "1.100,00". Se usa en la calculadora del header.
const formatAmount = (n, decimals = 2) =>
  Number.isFinite(n) ? n.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '';

// Convierte un texto de monto (con formato es-VE "1.100,00" o simple "1000.00")
// a número, tolerando ambos estilos de separadores.
const parseAmount = (value) => {
  const s = String(value || '').replace(/[^\d.,]/g, '').trim();
  if (!s) return NaN;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  if (hasComma && !hasDot) return parseFloat(s.replace(',', '.'));
  if (!hasComma && hasDot && (s.match(/\./g) || []).length > 1) return parseFloat(s.replace(/\./g, ''));
  return parseFloat(s);
};

const formatBs = (n) => `Bs ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const usdToBs = (usd, rate) => Number(usd || 0) * (rate || 0);

const PHONE_CODES = ['0412', '0414', '0416', '0422', '0424', '0426'];

// Administradores reconocidos por teléfono (formato 11 dígitos, sin espacios).
const ADMIN_PHONES = ['04129862577', '04141823718', '04242980404', '04242963490'];

const CUSTOMER_KEY = 'kiosko_customer';

// Memoria de login ("Recordarme"): conserva los campos de identificación para
// que el siguiente login los pre-cargue sin vaciarlos.
const LOGIN_MEMORY_KEY = 'kiosko_login_memory';
const loadLoginMemory = () => {
  try {
    const raw = localStorage.getItem(LOGIN_MEMORY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const saveLoginMemory = (data) => {
  try {
    localStorage.setItem(LOGIN_MEMORY_KEY, JSON.stringify(data));
  } catch {}
};
const clearLoginMemory = () => {
  try {
    localStorage.removeItem(LOGIN_MEMORY_KEY);
  } catch {}
};

// Parse fecha de pedido: prioriza createdAt (ISO), fallback timestamp "DD/MM, HH:MM" asumiendo año actual.
const parseOrderDate = (o) => {
  if (o.createdAt) { const d = new Date(o.createdAt); if (!isNaN(d)) return d; }
  const m = String(o.timestamp || '').match(/^(\d{1,2})\/(\d{1,2})[,]?\s*(\d{1,2}):(\d{2})/);
  if (!m) return new Date(NaN);
  const year = new Date().getFullYear();
  return new Date(year, Number(m[2]) - 1, Number(m[1]), Number(m[3]), Number(m[4]));
};

const toYMD = (d) => isNaN(d) ? '' : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Productos "nuevos": creados en las últimas 4 horas. Se considera la fecha del
// dispositivo del cliente como referencia razonable para la app.
const NEW_PRODUCT_HOURS = 4;
const isNewProduct = (product) => {
  if (!product || !product.createdAt) return false;
  const created = new Date(product.createdAt);
  if (isNaN(created)) return false;
  return Date.now() - created.getTime() <= NEW_PRODUCT_HOURS * 3600 * 1000;
};

// Marca productos vistos (la etiqueta NUEVO desaparece al hacer click).
const NEW_VIEWED_KEY = 'kiosko_new_product_views';
const loadNewProductViews = () => {
  try { return JSON.parse(localStorage.getItem(NEW_VIEWED_KEY)) || []; } catch { return []; }
};
const markNewProductViewed = (id) => {
  try {
    const list = loadNewProductViews();
    if (!list.includes(id)) localStorage.setItem(NEW_VIEWED_KEY, JSON.stringify([...list, id]));
  } catch {}
};
const wasNewProductViewed = (id) => loadNewProductViews().includes(id);

// Convierte la clave VAPID (base64url) al ArrayBuffer que exige el navegador.
const urlBase64ToUint8Array = (base64) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
};

// Suscribe el dispositivo a Web Push usando la clave VAPID del servidor.
const subscribeToPush = async (phone) => {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return false;
    }
    const reg = await navigator.serviceWorker.ready;
    if (!reg.pushManager) return false;
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      const keyRes = await api.getVapidKey();
      if (!keyRes.ok || !keyRes.data?.publicKey) return false;
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyRes.data.publicKey)
      });
    }
    const key = String(phone || '').replace(/\D/g, '').slice(-11);
    if (!key || key.length < 7) return false;
    await api.subscribePush(key, {
      endpoint: subscription.endpoint,
      keys: subscription.toJSON().keys
    });
    return true;
  } catch {
    return false;
  }
};

// Mini calendario compacto (popover) para filtro de fecha
function MiniCalendar({ value, onChange, onClose }) {
  const [month, setMonth] = useState(new Date());
  const today = new Date();
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Lun=0
  const daysInMonth = new Date(month.getFullYear(), month.getMonth()+1, 0).getDate();
  const prevMonthDays = new Date(month.getFullYear(), month.getMonth(), 0).getDate();
  const weeks = [];
  for (let i = 0; i < 6; i++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const idx = i * 7 + d - startOffset;
      if (idx < 0) week.push({ day: prevMonthDays + idx + 1, muted: true, date: null });
      else if (idx >= daysInMonth) week.push({ day: idx - daysInMonth + 1, muted: true, date: null });
      else {
        const date = new Date(month.getFullYear(), month.getMonth(), idx + 1);
        week.push({ day: idx + 1, muted: false, date });
      }
    }
    weeks.push(week);
  }
  const isSelected = (date) => value && date && toYMD(date) === value;
  const isToday = (date) => date && toYMD(date) === toYMD(today);
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 w-64 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()-1, 1))} className="p-1 text-slate-400 hover:text-white"><Icon name="minus" className="w-4 h-4" /></button>
        <span className="font-semibold text-white text-sm">{monthNames[month.getMonth()]} {month.getFullYear()}</span>
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()+1, 1))} className="p-1 text-slate-400 hover:text-white"><Icon name="plus" className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-[11px] mb-3">
        {['Lu','Ma','Mi','Ju','Vi','Sá','Do'].map(d => <div key={d} className="text-center text-slate-500 font-semibold">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {weeks.map((week, wi) => week.map(({ day, muted, date }, di) => (
          <button key={`${wi}-${di}`} onClick={() => date && (onChange(toYMD(date)), onClose())} className={`w-8 h-8 rounded-xl text-[11px] font-medium transition-all ${
            muted ? 'text-slate-600 hover:bg-slate-800' : 'text-slate-100 hover:bg-slate-800'
          } ${isSelected(date) ? 'bg-teal-500 text-white' : ''} ${isToday(date) && !isSelected(date) ? 'ring-2 ring-teal-500' : ''}`}>
            {day}
          </button>
        )))}
      </div>
      <div className="flex items-center justify-center gap-2 mt-3 pt-2 border-t border-slate-800">
        <button onClick={() => { onChange(toYMD(today)); onClose(); }} className="px-3 py-1.5 text-[11px] font-semibold text-teal-300 hover:text-teal-200">Hoy</button>
        <button onClick={onClose} className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-200">Cerrar</button>
      </div>
    </div>
  );
}

const normalizePhoneDigits = (phone) => String(phone || '').replace(/\D/g, '').slice(-11);

const parsePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  const num = digits.length >= 11 ? digits.slice(-11) : digits;
  if (num.length < 7) return { code: '', number: '' };
  return { code: num.slice(0, 4), number: num.slice(-7) };
};

const loadSavedCustomer = () => {
  try {
    const raw = localStorage.getItem(CUSTOMER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveCustomerData = (data) => {
  try {
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(data));
  } catch {}
};

// Construye el registro de clientes conocidos a partir del historial de pedidos
// (último pedido gana por teléfono). Falla back a los datos locales del cliente.
const buildKnownCustomers = (orders, saved) => {
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

const formatPhoneWhatsApp = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('58')) return digits;
  if (digits.startsWith('0')) return '58' + digits.slice(1);
  return '58' + digits;
};

const STATUS_STYLES = {
  pendiente: { badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40', ring: 'border-amber-500/50', dot: 'bg-amber-400' },
  en_preparacion: { badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40', ring: 'border-cyan-500/50', dot: 'bg-cyan-400' },
  listo: { badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', ring: 'border-emerald-500/50', dot: 'bg-emerald-400' },
  en_camino: { badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40', ring: 'border-sky-500/50', dot: 'bg-sky-400' },
  entregado: { badge: 'bg-slate-500/20 text-slate-300 border-slate-500/40', ring: 'border-slate-500/50', dot: 'bg-slate-400' },
  cancelado: { badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40', ring: 'border-rose-500/50', dot: 'bg-rose-400' }
};

const playChime = (() => {
  let ctx = null;
  const note = (freq, start, dur, type = 'sine', gain = 0.12) => {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, ctx.currentTime + start);
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + dur + 0.05);
  };
  return () => {
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      note(880, 0, 0.22, 'sine', 0.1);
      note(1320, 0.16, 0.3, 'sine', 0.08);
    } catch {}
  };
})();

// Vibración sutil en dispositivos móviles (no soportada en iOS Safari: no-op).
const haptic = (ms = 12) => {
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch {}
};

// Persistencia de favoritos del cliente (ids de productos, localStorage)
const FAVORITES_KEY = 'kiosko_favorites';
const loadFavorites = () => {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const STATUS_FLOW = ['pendiente', 'en_preparacion', 'listo', 'en_camino', 'entregado'];

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  en_preparacion: 'En Preparación',
  listo: 'Listo',
  en_camino: 'En Camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado'
};

function RateBanner({ rate }) {
  const [usdInput, setUsdInput] = useState('');
  const [bsInput, setBsInput] = useState('');
  const r = rate?.rate || 0;

  const handleUsd = (value) => {
    const v = value.replace(/[^\d.,]/g, '');
    setUsdInput(v);
    const num = parseAmount(v);
    setBsInput(Number.isFinite(num) ? formatAmount(num * r) : '');
  };

  const handleBs = (value) => {
    const v = value.replace(/[^\d.,]/g, '');
    setBsInput(v);
    const num = parseAmount(v);
    setUsdInput(Number.isFinite(num) && r > 0 ? formatAmount(num / r) : '');
  };

  return (
    <div className="border-b border-slate-800 bg-slate-900/90 px-3 sm:px-4 lg:px-8 py-2.5 sm:py-3">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center">
          <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl sm:rounded-2xl bg-teal-500/10 border border-teal-500/30 text-[11px] sm:text-xs font-bold text-teal-300">
            <Icon name="dollarSign" className="w-3.5 h-3.5" />
            Tasa BCV
          </span>
          <span className="text-sm text-slate-300 font-semibold">
            1 US$ = <span className="text-teal-300 font-black">{r ? r.toLocaleString('es-AR') : '—'} Bs</span>
          </span>
          {rate?.date && (
            <span className="hidden md:inline text-[11px] text-slate-500">
              {rate.source} · {new Date(rate.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-800/70 border border-slate-700/80 rounded-xl px-2.5 sm:px-3 py-1.5">
            <Icon name="dollarSign" className="w-4 h-4 text-teal-400" />
            <input
              type="text"
              inputMode="decimal"
              value={usdInput}
              onChange={(e) => handleUsd(e.target.value)}
              placeholder="0.00"
              className="w-16 sm:w-20 bg-transparent text-slate-100 text-sm font-semibold placeholder-slate-600 focus:outline-none"
            />
          </div>
          <Icon name="refresh" className="w-4 h-4 text-slate-600 rotate-90" />
          <div className="flex items-center gap-1.5 bg-slate-800/70 border border-slate-700/80 rounded-xl px-2.5 sm:px-3 py-1.5">
            <span className="text-teal-300 font-bold text-sm">Bs</span>
            <input
              type="text"
              inputMode="decimal"
              value={bsInput}
              onChange={(e) => handleBs(e.target.value)}
              placeholder="0,00"
              className="w-20 sm:w-24 bg-transparent text-slate-100 text-sm font-semibold placeholder-slate-600 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // App views: 'customer' | 'admin'
  const [activeView, setActiveView] = useState('customer');

  // Theme: 'dark' | 'light'
  const [theme, setTheme] = useState(() => localStorage.getItem('kiosko_theme') || 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('kiosko_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  // Alto del header sticky: se pasa a la tienda para anclar el buscador justo debajo
  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    const measure = () => setHeaderHeight(headerRef.current?.offsetHeight || 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Server state
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [promos, setPromos] = useState([]);
  const [storeLocation, setStoreLocation] = useState(null);
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [rate, setRate] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Admin session state
  const [isAdminAuthed, setIsAdminAuthed] = useState(() => Boolean(getToken()));
  const [refreshingDb, setRefreshingDb] = useState(false);

  const loadState = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true);
      setLoadError('');
    }
    const res = await api.getState();
    if (!res.ok) {
      if (!silent) {
        setLoadError('No se pudo conectar con el servidor. Verifica tu conexión a internet e intenta de nuevo.');
      }
      setIsLoading(false);
      return;
    }
    setProducts(res.data.products || []);
    setCategories(res.data.categories || []);
    setOrders(res.data.orders || []);
    if (Array.isArray(res.data.settings?.promos)) setPromos(res.data.settings.promos);
    if (res.data.settings?.storeLocation) setStoreLocation(res.data.settings.storeLocation);
    if (res.data.settings?.paymentConfig) setPaymentConfig(res.data.settings.paymentConfig);
    if (res.data.rate) setRate(res.data.rate);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  // Polling: keep products, orders and tracking fresh in real time
  useEffect(() => {
    const POLL_INTERVAL = Number(import.meta.env.VITE_POLL_INTERVAL) || 5000;

    const poll = () => {
      if (document.hidden) return; // no gastar requests con la pestaña oculta
      loadState({ silent: true });
    };

    const id = setInterval(poll, POLL_INTERVAL);
    document.addEventListener('visibilitychange', poll);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [loadState]);

  // Cart State
  const [cart, setCart] = useState(() => {
    try {
      const saved = sessionStorage.getItem('kiosko_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrdersDrawerOpen, setIsOrdersDrawerOpen] = useState(false);
  const [isDebtDrawerOpen, setIsDebtDrawerOpen] = useState(false);

  // Pestaña activa del cliente en la barra inferior (móvil)
  const [customerTab, setCustomerTab] = useState('store'); // 'store' | 'orders' | 'account'
  const [focusCustomerSection, setFocusCustomerSection] = useState(null); // pedido de scroll/expansión

  // Favoritos: ids de productos marcados con corazón (persistidos localmente)
  const [favorites, setFavorites] = useState(loadFavorites);

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch {}
  }, [favorites]);

  const toggleFavorite = (id) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
    haptic(8);
  };

  // Vuelo del ítem agregado al carrito: imagen clonada animada hacia la barra
  const [flyItem, setFlyItem] = useState(null);
  const flyTimerRef = useRef(null);

  const flyToCart = (product, sourceRect) => {
    const target = document.querySelector('[data-cart-target]');
    const toRect = target ? target.getBoundingClientRect() : null;
    if (!sourceRect || !toRect) return;
    const fromX = sourceRect.left + sourceRect.width / 2;
    const fromY = sourceRect.top + sourceRect.height / 2;
    const toX = toRect.left + toRect.width / 2;
    const toY = toRect.top + toRect.height / 2;
    setFlyItem({
      id: `${product.id}-${Date.now()}`,
      image: product.image,
      fx: fromX,
      fy: fromY,
      tx: toX,
      ty: toY
    });
    if (flyTimerRef.current) clearTimeout(flyTimerRef.current);
    flyTimerRef.current = setTimeout(() => setFlyItem(null), 750);
  };

  // Cliente reconocido (pre-llenado automático del checkout)
  const [savedCustomer, setSavedCustomer] = useState(() => loadSavedCustomer());

  // Bienvenida a pantalla completa tras iniciar sesión (cliente o admin).
  // { name, tag, isNew }: name = primer nombre a mostrar, tag = texto superior.
  // Se muestra justo tras identificarse y se cierra al instante con un toque.
  const [welcome, setWelcome] = useState(null);

  // Tour tutorial para usuarios nuevos (se muestra tras la bienvenida).
  const [showTour, setShowTour] = useState(false);

  // Banner de notificaciones: ocultable, se recuerda la decisión del usuario.
  const [pushBannerHidden, setPushBannerHidden] = useState(() => {
    try { return localStorage.getItem('kiosko_push_banner_hidden') === '1'; } catch { return false; }
  });

  // True si el cliente identificado figura en la lista de administradores por teléfono
  const isCurrentAdmin = useMemo(() => {
    if (!savedCustomer?.phoneNumber) return false;
    const key = `${savedCustomer.phoneCode || ''}${savedCustomer.phoneNumber}`.replace(/\D/g, '').slice(-11);
    return ADMIN_PHONES.includes(key);
  }, [savedCustomer]);

  // Identificación obligatoria: se abre al entrar como cliente sin datos guardados.
  // identityMode: 'login' (formulario) | 'confirm' (solo biometría para volver/salir).
  // identityConfirmKind: 'switchback' | 'logout'.
  const [isIdentityOpen, setIsIdentityOpen] = useState(() => !loadSavedCustomer());
  const [identityMode, setIdentityMode] = useState('login');
  const [identityConfirmKind, setIdentityConfirmKind] = useState('switchback');

  // Abre el login normal (cambiar de usuario / identificarse).
  const openIdentityLogin = () => {
    setIdentityMode('login');
    setIdentityConfirmKind('switchback');
    setIsIdentityOpen(true);
  };

  // Abre la confirmación por biometría para cerrar sesión.
  const openIdentityLogout = () => {
    setIdentityMode('confirm');
    setIdentityConfirmKind('logout');
    setIsIdentityOpen(true);
  };

  // Reabrir la identificación si el usuario entra a la tienda sin estar identificado
  useEffect(() => {
    if (activeView === 'customer' && !savedCustomer) {
      setIdentityMode('login');
      setIsIdentityOpen(true);
    }
  }, [activeView, savedCustomer]);

  // Perfil del cliente desde el servidor (direcciones guardadas, balance, etc.)
  // Se recarga también cuando cambia orders (polling) para que el saldo de Mi
  // Cuenta se actualice al pasar un pedido a entregado o al saldar la deuda.
  const [customerProfile, setCustomerProfile] = useState(null);

  // Al reconocer un cliente con teléfono, buscar su perfil y direcciones guardadas
  useEffect(() => {
    let cancelled = false;
    const phoneKey = savedCustomer?.phoneNumber
      ? `${savedCustomer.phoneCode || ''}${savedCustomer.phoneNumber}`.replace(/\D/g, '').slice(-11)
      : '';
    if (!phoneKey || phoneKey.length < 7) {
      setCustomerProfile(null);
      return;
    }
    api.getCustomer(phoneKey).then((res) => {
      if (!cancelled && res.ok && res.data?.phone) setCustomerProfile(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [savedCustomer?.phoneCode, savedCustomer?.phoneNumber, orders]);

  // Historial de pedidos del cliente reconocido, para "Mis Pedidos"
  const customerOrders = useMemo(() => {
    if (!savedCustomer?.phoneNumber) return [];
    const key = `${savedCustomer.phoneCode || ''}${savedCustomer.phoneNumber}`.replace(/\D/g, '').slice(-11);
    if (!key) return [];
    return orders.filter((o) => normalizePhoneDigits(o.phone) === key);
  }, [orders, savedCustomer]);

  // Registro de clientes conocidos derivado del historial de pedidos + datos locales
  const knownCustomers = useMemo(
    () => buildKnownCustomers(orders, savedCustomer),
    [orders, savedCustomer]
  );

  // Último pedido del cliente reconocido, para "Repetir mi último pedido"
  const lastOrderForCustomer = useMemo(() => {
    if (!savedCustomer?.phoneNumber) return null;
    const key = `${savedCustomer.phoneCode || ''}${savedCustomer.phoneNumber}`.replace(/\D/g, '').slice(-11);
    if (!key) return null;
    return orders.find((o) => normalizePhoneDigits(o.phone) === key) || null;
  }, [orders, savedCustomer]);

  // Persist cart across reloads/navigation (per browser session)
  useEffect(() => {
    sessionStorage.setItem('kiosko_cart', JSON.stringify(cart));
  }, [cart]);

  // Reconcile restored cart with live products (fresh price/stock)
  useEffect(() => {
    if (products.length === 0) return;
    setCart((prev) => {
      const next = prev
        .map((item) => {
          const live = products.find((p) => p.id === item.product.id);
          if (!live) return null; // product no longer exists
          return {
            product: live,
            quantity: Math.min(item.quantity, Math.max(0, live.stock))
          };
        })
        .filter(Boolean)
        .filter((item) => item.quantity > 0);
      return next.length === prev.length ? prev : next;
    });
  }, [products]);

  // Search & Filters
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('relevancia'); // relevancia | precio-asc | precio-desc | stock | popular

  // Modals state
  const [productDetailModal, setProductDetailModal] = useState(null); // Product object
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [currentOrderTracking, setCurrentOrderTracking] = useState(null); // Order id for customer view
  const [liveTrackingOrder, setLiveTrackingOrder] = useState(null); // Order for re-open live tracking from Mis Pedidos

  // Admin Specific States
  const [adminTab, setAdminTab] = useState('inventory'); // 'inventory' | 'orders' | 'analytics'
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState(null);
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState(null);
  const [orderDetailOrder, setOrderDetailOrder] = useState(null);
  const [cancelConfirmOrder, setCancelConfirmOrder] = useState(null);
  const [deleteOrderTarget, setDeleteOrderTarget] = useState(null);

  // Clientes registrados (para Beneficiados / Lista Negra del panel admin)
  const [allCustomers, setAllCustomers] = useState([]);

  const loadCustomers = async () => {
    const res = await api.listCustomers();
    if (res.ok) setAllCustomers(res.data || []);
  };

  // Cobros programados (cuentas por cobrar a enviar por WhatsApp)
  const [collections, setCollections] = useState([]);

  const loadCollections = async () => {
    const res = await api.getCollections();
    if (res.ok) setCollections(res.data || []);
  };

  const handleUpsertCollection = async (data) => {
    const res = await api.upsertCollection(data);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo guardar el cobro', 'error');
      return false;
    }
    setCollections(res.data.list || []);
    addToast('Cobro programado', 'success');
    return true;
  };

  const handleDeleteCollection = async (id) => {
    const res = await api.deleteCollection(id);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo eliminar el cobro', 'error');
      return;
    }
    setCollections(res.data.list || []);
    addToast('Cobro eliminado', 'info');
  };

  // Toast notifications
  const [toasts, setToasts] = useState([]);

  const TOAST_META = {
    success: { icon: 'checkCircle', color: 'from-emerald-500/20 to-emerald-500/5', border: 'border-emerald-500/40', text: 'text-emerald-300', bar: 'bg-emerald-400' },
    error: { icon: 'xCircle', color: 'from-rose-500/20 to-rose-500/5', border: 'border-rose-500/40', text: 'text-rose-300', bar: 'bg-rose-400' },
    warning: { icon: 'alertTriangle', color: 'from-amber-500/20 to-amber-500/5', border: 'border-amber-500/40', text: 'text-amber-300', bar: 'bg-amber-400' },
    info: { icon: 'info', color: 'from-sky-500/20 to-sky-500/5', border: 'border-sky-500/40', text: 'text-sky-300', bar: 'bg-sky-400' }
  };

  const addToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  };

  const handleAdminLogin = async (phone, password) => {
    try {
      const res = await api.login(phone, password);
      if (!res.ok) {
        addToast(res.data.error || 'Contraseña incorrecta', 'error');
        return false;
      }
      setToken(res.data.token);
      setIsAdminAuthed(true);
      // Bienvenida a pantalla completa con el nombre del administrador. Se resuelve
      // desde el cliente reconocido, la lista de clientes o el perfil en el server.
      const phoneKey = String(phone || '').replace(/\D/g, '').slice(-11);
      const adminName = await resolveAdminName(phoneKey);
      setWelcome({ name: adminName.split(' ')[0] || 'Administrador', tag: 'Panel de administración' });
      addToast('Sesión iniciada en el panel admin');
      return true;
    } catch {
      addToast('No se pudo conectar con el servidor. Intenta de nuevo.', 'error');
      return false;
    }
  };

  // Login admin por biometría (huella/Face ID): el teléfono identifica al admin
  // y la biometría lo autentica sin contraseña. Solo para el panel admin.
  const handleAdminBiometricLogin = async (phone, response) => {
    try {
      const res = await api.adminBiometricLogin(phone, response);
      if (!res.ok) {
        addToast(res.data.error || 'La biometría no coincidió', 'error');
        return false;
      }
      setToken(res.data.token);
      setIsAdminAuthed(true);
      const phoneKey = String(phone || '').replace(/\D/g, '').slice(-11);
      const adminName = await resolveAdminName(phoneKey);
      setWelcome({ name: adminName.split(' ')[0] || 'Administrador', tag: 'Panel de administración' });
      addToast('Sesión iniciada en el panel admin');
      return true;
    } catch {
      addToast('No se pudo conectar con el servidor. Intenta de nuevo.', 'error');
      return false;
    }
  };

  // Primer registro de biometría del admin: guarda huella/Face ID y emite token.
  const handleAdminBiometricRegister = async (phone, response) => {
    try {
      const res = await api.adminBiometricRegister(phone, response);
      if (!res.ok) {
        addToast(res.data.error || 'No se pudo guardar tu biometría', 'error');
        return false;
      }
      setToken(res.data.token);
      setIsAdminAuthed(true);
      const phoneKey = String(phone || '').replace(/\D/g, '').slice(-11);
      const adminName = await resolveAdminName(phoneKey);
      setWelcome({ name: adminName.split(' ')[0] || 'Administrador', tag: 'Panel de administración' });
      addToast('Sesión iniciada en el panel admin');
      return true;
    } catch {
      addToast('No se pudo conectar con el servidor. Intenta de nuevo.', 'error');
      return false;
    }
  };

  // Resuelve el nombre del admin desde el cliente guardado, los clientes conocidos
  // o el perfil en el server. Devuelve '' si no se encuentra.
  const resolveAdminName = async (phoneKey) => {
    const savedKey = savedCustomer
      ? `${savedCustomer.phoneCode || ''}${savedCustomer.phoneNumber || ''}`.replace(/\D/g, '').slice(-11)
      : '';
    if (savedKey === phoneKey && savedCustomer?.customerName) {
      return savedCustomer.customerName;
    }
    const known = (allCustomers || []).find(
      (c) => normalizePhoneDigits(c.phone) === phoneKey && c.customerName
    );
    if (known) {
      return known.customerName;
    }
    const profile = await api.getCustomer(phoneKey);
    if (profile.ok && profile.data?.customerName) return profile.data.customerName;
    return '';
  };

  const handleAdminLogout = () => {
    clearToken();
    setIsAdminAuthed(false);
    setActiveView('customer');
    setAdminTab('inventory');
    setCustomerTab('store');
    addToast('Sesión cerrada', 'info');
  };

  // Cambio de tab del admin desde la barra inferior: carga clientes/cobros
  // cuando hace falta (mismo comportamiento que las pestañas del panel).
  const handleAdminTabChange = (key) => {
    setActiveView('admin');
    if (key === 'benefited' || key === 'blacklist') loadCustomers();
    if (key === 'blacklist') loadCollections();
    setAdminTab(key);
  };

  const handleToggleBenefited = async (phone, benefited) => {
    const res = await api.setCustomerBenefited(phone, benefited);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo actualizar el beneficio', 'error');
      return;
    }
    await loadCustomers();
    addToast(benefited ? 'Cliente añadido a beneficiados' : 'Beneficio revocado');
  };

  const handleAddToBlacklist = async (phone, name, amount) => {
    const res = await api.addToBlacklist({ phone, name, amount });
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo añadir a la lista negra', 'error');
      return false;
    }
    await loadCustomers();
    addToast('Cliente añadido a la lista negra', 'success');
    return true;
  };

  const handleAddBlacklistDebt = async ({ phone, name, items }) => {
    const res = await api.addBlacklistDebt({ phone, name, items });
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo registrar la deuda', 'error');
      return false;
    }
    await loadCustomers();
    await loadState({ silent: true });
    addToast('Productos añadidos a la deuda', 'success');
    return true;
  };

  const addToCart = (product, quantityToAdd = 1, sourceRect = null) => {
    if (product.stock <= 0) {
      addToast('Este producto no tiene stock disponible', 'error');
      return;
    }

    const existing = cart.find((item) => item.product.id === product.id);
    const currentQty = existing ? existing.quantity : 0;
    const newQty = currentQty + quantityToAdd;

    if (newQty > product.stock) {
      addToast(`Solo hay ${product.stock} unidades en stock`, 'warning');
      return;
    }

    if (existing) {
      setCart(cart.map((item) =>
        item.product.id === product.id ? { ...item, quantity: newQty } : item
      ));
    } else {
      setCart([...cart, { product, quantity: quantityToAdd }]);
    }

    haptic(12);
    if (sourceRect) flyToCart(product, sourceRect);
    addToast(`Agregado: ${product.name} (x${quantityToAdd})`);
  };

  const updateCartQty = (productId, delta) => {
    const item = cart.find((i) => i.product.id === productId);
    if (!item) return;

    const newQty = item.quantity + delta;
    if (newQty > item.product.stock) {
      addToast(`Máximo disponible: ${item.product.stock}`, 'warning');
      return;
    }

    if (newQty <= 0) {
      setCart(cart.filter((i) => i.product.id !== productId));
      return;
    }

    setCart(cart.map((i) =>
      i.product.id === productId ? { ...i, quantity: newQty } : i
    ));
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
    addToast('Producto removido del carrito', 'info');
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  }, [cart]);

  const cartCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  const filteredProducts = useMemo(() => {
    let list = products.filter((p) => {
      const matchesCategory =
        selectedCategory === 'Todas' ||
        (selectedCategory === 'Favoritos' ? favorites.includes(p.id) : p.category === selectedCategory);
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });

    if (sortOption === 'precio-asc') {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (sortOption === 'precio-desc') {
      list = [...list].sort((a, b) => b.price - a.price);
    } else if (sortOption === 'stock') {
      list = [...list].sort((a, b) => b.stock - a.stock);
    } else if (sortOption === 'popular') {
      const demand = {};
      orders.forEach((o) =>
        o.items.forEach((it) => {
          demand[it.id] = (demand[it.id] || 0) + it.quantity;
        })
      );
      list = [...list].sort((a, b) => (demand[b.id] || 0) - (demand[a.id] || 0));
    }

    return list;
  }, [products, selectedCategory, searchQuery, sortOption, orders, favorites]);

  const handlePlaceOrder = async (formData) => {
    if (cart.length === 0 || isPlacingOrder) return;
    setIsPlacingOrder(true);

    const orderPayload = {
      customerName: formData.customerName,
      phone: formData.phone,
      type: formData.type,
      address: formData.type === 'delivery' ? formData.address : undefined,
      lat: formData.type === 'delivery' && formData.lat != null ? formData.lat : undefined,
      lng: formData.type === 'delivery' && formData.lng != null ? formData.lng : undefined,
      notes: formData.notes,
      items: cart.map((item) => ({
        id: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity
      })),
      total: cartTotal,
      credit: Boolean(formData.credit),
      paymentMethod: formData.paymentMethod || 'efectivo',
      paymentReference: formData.paymentReference || '',
      timestamp: formatTimestamp(),
      estimatedMinutes: formData.type === 'delivery' ? 25 : 10
    };

    try {
      const res = await api.createOrder(orderPayload);
      if (!res.ok) {
        addToast(res.data.error || 'No se pudo realizar el pedido', 'error');
        return;
      }

      // El servidor confirmó el pedido: cerrar el modal y el carrito de inmediato,
      // antes de cualquier otra operación, para que nunca quede atascado.
      setCart([]);
      setIsCheckoutOpen(false);
      setIsCartOpen(false);
      setCurrentOrderTracking(res.data.order?.id);

      // Guardar cliente reconocido para pre-llenado automático en el próximo pedido
      const parsedPhone = parsePhone(orderPayload.phone);
      const customerRecord = {
        customerName: orderPayload.customerName,
        phoneCode: parsedPhone.code || formData.phoneCode,
        phoneNumber: parsedPhone.number || formData.phoneNumber,
        address: orderPayload.address || '',
        type: orderPayload.type
      };
      saveCustomerData(customerRecord);
      setSavedCustomer(customerRecord);
      autoSubscribePushIfAllowed();

      if (res.data.state) {
        setProducts(res.data.state.products || []);
        setOrders(res.data.state.orders || []);
      }

      // Adjuntar el comprobante de pago digital tras confirmar el pedido.
      if (formData.paymentProof && res.data.order?.id) {
        try {
          const attach = await api.attachPaymentProof(
            res.data.order.id,
            orderPayload.phone,
            formData.paymentProof,
            orderPayload.paymentReference
          );
          if (!attach.ok) {
            console.warn('[kiosko] No se pudo adjuntar el comprobante:', attach.data?.error);
          }
        } catch (proofErr) {
          console.warn('[kiosko] Error al adjuntar comprobante:', proofErr);
        }
      }

      haptic([20, 40, 20]);
      playChime();
      addToast('¡Pedido realizado con éxito!', 'success');
    } catch (err) {
      console.error('[kiosko] Error al crear pedido:', err);
      addToast('No se pudo enviar el pedido. Revisa tu conexión e intenta de nuevo.', 'error');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Rellena el carrito con los artículos del último pedido del cliente reconocido
  const handleRepeatLastOrder = () => {
    if (!lastOrderForCustomer) {
      addToast('No encontramos un pedido anterior para repetir', 'info');
      return;
    }
    const order = lastOrderForCustomer;
    const restored = [];
    let skipped = 0;
    order.items.forEach((it) => {
      const live = products.find((p) => p.id === it.id);
      if (!live || live.stock <= 0) {
        skipped++;
        return;
      }
      restored.push({
        product: live,
        quantity: Math.min(it.quantity, Math.max(0, live.stock))
      });
    });
    if (restored.length === 0) {
      addToast('Los productos de tu último pedido ya no están disponibles', 'warning');
      return;
    }
    setCart(restored);
    setIsCartOpen(true);
    addToast(
      skipped > 0
        ? `Repetido tu último pedido (${restored.length} artículos, ${skipped} no disponibles)`
        : `Repetido tu último pedido (${restored.length} artículos)`
    );
  };

  // Guarda una dirección en el perfil del cliente (servidor + local)
  const handleSaveCustomerAddress = async (phone, customerName, address) => {
    if (!phone || !address) return;
    const res = await api.upsertCustomer(phone, { customerName, address });
    if (res.ok && res.data?.phone) {
      setCustomerProfile(res.data);
      addToast('Dirección guardada en tu perfil', 'success');
    } else {
      addToast('No se pudo guardar la dirección', 'error');
    }
  };

  // Identificación obligatoria del cliente al entrar
  const handleIdentifyCustomer = async ({ customerName, phoneCode, phoneNumber }) => {
    const phoneKey = `${phoneCode}${phoneNumber}`.replace(/\D/g, '').slice(-11);
    // "Nuevo" = sin historial de pedidos previo Y sin registro previo en la app
    // (servidor). Se calcula ANTES de guardar el registro local para no
    // contarse a sí mismo como conocido. El tutorial solo se muestra a nuevos.
    const hasOrderHistory = orders.some((o) => normalizePhoneDigits(o.phone) === phoneKey);
    let alreadyRegistered = false;
    if (phoneKey.length >= 7) {
      try {
        const existing = await api.getCustomer(phoneKey);
        alreadyRegistered = !!(existing.ok && existing.data?.phone);
      } catch {
        alreadyRegistered = false; // sin conexión: no bloquear el acceso
      }
    }
    const isNew = !hasOrderHistory && !alreadyRegistered;
    const record = {
      customerName,
      phoneCode,
      phoneNumber,
      address: savedCustomer?.address || '',
      type: savedCustomer?.type || 'pickup'
    };
    saveCustomerData(record);
    setSavedCustomer(record);
    setIsIdentityOpen(false);
    // Bienvenida a pantalla completa con el nombre del usuario (primer nombre).
    // Se monta en el mismo render en que se cierra el modal, así la app nunca
    // se ve antes de la animación.
    setWelcome({ name: customerName.trim().split(' ')[0] || customerName.trim(), tag: 'Bienvenido', isNew });
    addToast(isNew ? `¡Bienvenido, ${customerName.split(' ')[0]}!` : `¡Hola de nuevo, ${customerName.split(' ')[0]}!`);
    // Registrar/actualizar el cliente en el servidor para que aparezca en el historial
    if (phoneKey.length >= 7) {
      const res = await api.upsertCustomer(phoneKey, { customerName });
      if (res.ok && res.data?.phone) setCustomerProfile(res.data);
    }
    autoSubscribePushIfAllowed();
  };

  // Confirmación por biometría del modal de identidad. "switchback" = volver al
  // cliente actual sin pedir datos; "logout" = cerrar sesión.
  const handleIdentityConfirmBiometric = (kind) => {
    setIsIdentityOpen(false);
    if (kind === 'logout') handleCustomerLogout();
  };

  // Cerrar sesión del cliente: limpia identidad y carrito, y reabre el login.
  const handleCustomerLogout = () => {
    localStorage.removeItem(CUSTOMER_KEY);
    setSavedCustomer(null);
    setCustomerProfile(null);
    setCart([]);
    setIdentityMode('login');
    setIsIdentityOpen(false);
    addToast('Sesión cerrada', 'info');
  };

  // Pide permiso de notificaciones y suscribe el dispositivo al teléfono activo.
  const handleEnableNotifications = async () => {
    if (!('Notification' in window) || !('PushManager' in window)) {
      addToast('Tu navegador no soporta notificaciones', 'error');
      return;
    }
    if (Notification.permission === 'denied') {
      addToast('Notificaciones bloqueadas. Actívalas en los ajustes del navegador', 'error');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      addToast('Notificaciones no activadas', 'info');
      return;
    }
    const ok = await subscribeToPush(savedCustomer?.phoneNumber || '');
    addToast(ok ? 'Notificaciones activadas. Te avisaremos de tu pedido.' : 'No se pudieron activar las notificaciones', ok ? 'success' : 'error');
  };

  // Re-suscribe en silencio si el permiso ya está concedido (al entrar o pedir).
  const autoSubscribePushIfAllowed = async () => {
    if (!savedCustomer?.phoneNumber) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    subscribeToPush(savedCustomer.phoneNumber).catch(() => {});
  };

  const handleSaveProduct = async (productData) => {
    if (productData.id) {
      // Edit existing
      const res = await api.updateProduct(productData.id, productData);
      if (!res.ok) {
        addToast(res.data.error || 'No se pudo actualizar el producto', 'error');
        return;
      }
      setProducts(res.data.state.products || []);
      setCategories(res.data.state.categories || []);
      addToast(`Producto "${productData.name}" actualizado`);
    } else {
      // Create new (id y code los genera el servidor)
      const res = await api.createProduct(productData);
      if (!res.ok) {
        addToast(res.data.error || 'No se pudo crear el producto', 'error');
        return;
      }
      setProducts(res.data.state.products || []);
      setCategories(res.data.state.categories || []);
      addToast(`Producto "${productData.name}" creado con éxito`);
    }

    setIsAddEditModalOpen(false);
    setProductToEdit(null);
  };

  const handleDeleteProduct = async (productId) => {
    const res = await api.deleteProduct(productId);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo eliminar el producto', 'error');
      return;
    }
    setProducts(res.data.state.products || []);
    addToast('Producto eliminado del inventario', 'info');
    setDeleteConfirmProduct(null);
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    const res = await api.updateOrderStatus(orderId, newStatus);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo actualizar el pedido', 'error');
      return;
    }
    setOrders(res.data.state.orders || []);
    addToast(`Estado del pedido ${orderId} actualizado a ${STATUS_LABELS[newStatus] || newStatus}`);
  };

  // Admin confirma o rechaza el pago digital de un pedido (dispara push al cliente).
  const handleUpdateOrderPayment = async (orderId, newStatus) => {
    const res = await api.updateOrderPayment(orderId, newStatus);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo actualizar el pago', 'error');
      return;
    }
    setOrders(res.data.state.orders || []);
    addToast(`Pago del pedido ${orderId} ${newStatus === 'confirmado' ? 'confirmado' : 'rechazado'}`);
  };

  // Envía la posición en vivo del repartidor (el admin que entrega) al servidor.
  const handleUpdateCourierLocation = async (orderId, lat, lng) => {
    const res = await api.updateCourierLocation(orderId, lat, lng);
    if (!res.ok) {
      addToast('No se pudo enviar la ubicación del repartidor', 'error');
      return false;
    }
    return true;
  };

  const handleCancelOrder = async (orderId, phone) => {
    const res = await api.cancelOrder(orderId, phone);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo cancelar el pedido', 'error');
      return;
    }
    setOrders(res.data.state.orders || []);
    setCancelConfirmOrder(null);
    addToast(`Pedido ${orderId} cancelado`, 'info');
  };

  const handleDeleteOrder = async (orderId) => {
    const res = await api.deleteOrder(orderId);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo eliminar el pedido', 'error');
      return;
    }
    setOrders(res.data.state.orders || []);
    setDeleteOrderTarget(null);
    addToast(`Pedido ${orderId} eliminado`, 'info');
  };

  const handleSavePromos = async (newPromos) => {
    const res = await api.saveSettings({ promos: newPromos });
    if (!res.ok) {
      addToast(res.data.error || 'No se pudieron guardar los promos', 'error');
      return false;
    }
    if (Array.isArray(res.data.settings?.promos)) setPromos(res.data.settings.promos);
    addToast('Promociones guardadas correctamente');
    return true;
  };

  const handleSaveStoreLocation = async (location) => {
    const res = await api.saveSettings({ promos, storeLocation: location });
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo guardar la ubicación del comercio', 'error');
      return false;
    }
    if (res.data.settings?.storeLocation) setStoreLocation(res.data.settings.storeLocation);
    addToast('Ubicación del comercio guardada');
    return true;
  };

  const handleSavePaymentConfig = async (cfg) => {
    const res = await api.saveSettings({ promos, paymentConfig: cfg });
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo guardar la configuración de pagos', 'error');
      return false;
    }
    if (res.data.settings?.paymentConfig) setPaymentConfig(res.data.settings.paymentConfig);
    addToast('Configuración de pagos guardada');
    return true;
  };

  const handleRefreshDb = async () => {
    setRefreshingDb(true);
    const res = await api.refreshDb();
    setRefreshingDb(false);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo refrescar el espejo de la base de datos', 'error');
      return false;
    }
    addToast('Datos de producción copiados a calidad');
    await loadState({ silent: true });
    return true;
  };

  // Derive live tracking order from current orders so status changes reflect in customer view
  const trackedOrder = currentOrderTracking
    ? orders.find((o) => o.id === currentOrderTracking) || null
    : null;

  // Sound notification when a tracked order advances status
  const lastTrackedStatus = useRef(null);
  useEffect(() => {
    if (!trackedOrder) {
      lastTrackedStatus.current = null;
      return;
    }
    const status = trackedOrder.status;
    if (lastTrackedStatus.current && status !== lastTrackedStatus.current) {
      playChime();
      if (status === 'en_preparacion') {
        addToast(`¡Tu pedido ${trackedOrder.id} está en preparación!`, 'info');
      } else if (status === 'listo') {
        addToast(`¡Tu pedido ${trackedOrder.id} está listo para retirar!`, 'info');
      } else if (status === 'en_camino') {
        addToast(`¡Tu pedido ${trackedOrder.id} está en camino!`, 'warning');
      } else if (status === 'entregado') {
        addToast(`¡Tu pedido ${trackedOrder.id} fue entregado! 🎉`, 'success');
      } else if (status === 'cancelado') {
        addToast(`Tu pedido ${trackedOrder.id} fue cancelado.`, 'error');
      }
    }
    lastTrackedStatus.current = status;
  }, [trackedOrder?.status, trackedOrder?.id]);

  // Notificaciones de cambio de estatus para TODOS los pedidos del cliente
  // (envío en camino, entregado, cancelado) aunque no estén en el rastreo activo.
  const lastStatusesRef = useRef({});
  useEffect(() => {
    const seen = lastStatusesRef.current;
    customerOrders.forEach((o) => {
      if (currentOrderTracking && o.id === currentOrderTracking) return;
      const prev = seen[o.id];
      if (prev && prev !== o.status && o.status !== 'pendiente' && o.status !== 'en_preparacion') {
        playChime();
        if (o.status === 'en_camino') {
          addToast(`¡Tu pedido ${o.id} está en camino!`, 'warning');
        } else if (o.status === 'entregado') {
          addToast(`¡Tu pedido ${o.id} fue entregado! 🎉`, 'success');
        } else if (o.status === 'cancelado') {
          addToast(`Tu pedido ${o.id} fue cancelado.`, 'error');
        }
      }
      seen[o.id] = o.status;
    });
  }, [customerOrders, currentOrderTracking]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-slate-950">
      {/* Toast Notification Container */}
      <div className="fixed top-4 left-4 right-4 sm:top-5 sm:left-auto sm:right-5 sm:w-full sm:max-w-sm z-[90] flex flex-col gap-2.5 pointer-events-none">
        {toasts.map((toast) => {
          const meta = TOAST_META[toast.type] || TOAST_META.success;
          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto relative overflow-hidden p-3.5 pr-4 rounded-2xl shadow-2xl backdrop-blur-xl bg-gradient-to-r ${meta.color} border ${meta.border} flex items-center gap-3 text-sm font-medium transition-all duration-300 animate-toast-in`}
            >
              <span className={`shrink-0 p-2 rounded-xl bg-slate-950/40 border border-white/10 ${meta.text}`}>
                <Icon name={meta.icon} className="w-5 h-5" />
              </span>
              <p className="flex-1 text-slate-100 leading-snug">{toast.message}</p>
              <span className={`absolute bottom-0 left-0 h-0.5 ${meta.bar} animate-toast-progress`} />
            </div>
          );
        })}
      </div>

      {/* Modern Glassmorphic Top Navbar */}
      <header ref={headerRef} className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-lg border-b border-slate-800/80 px-3 sm:px-4 lg:px-8 py-2.5 sm:py-3 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-teal-500/20 ring-2 ring-white/10 shrink-0 animate-glow-pulse">
              <Icon name="store" className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-white via-slate-200 to-teal-400 bg-clip-text text-transparent leading-tight truncate">
                Empresas Alvarados
              </h1>
              <span className="hidden sm:flex text-xs text-teal-400/90 font-medium items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping inline-block" />
                Abierto Ahora • Atención Rápida
              </span>
            </div>
          </div>

          {/* Mode Switcher: Customer vs Admin Panel */}
          <div className="flex items-center gap-1 sm:gap-2 bg-slate-800/90 p-1 rounded-xl sm:p-1.5 sm:rounded-2xl border border-slate-700/60 shadow-inner shrink-0">
            <button
              onClick={() => setActiveView('customer')}
              className={`px-2.5 sm:px-4 py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center gap-1.5 sm:gap-2 ${
                activeView === 'customer'
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 shadow-md shadow-teal-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
              }`}
            >
              <Icon name="shoppingBag" className="w-4 h-4 shrink-0" />
              <span className="hidden min-[420px]:inline">Tienda</span>
            </button>
            {(isCurrentAdmin || isAdminAuthed) && (
              <button
                onClick={() => setActiveView('admin')}
                className={`px-2.5 sm:px-4 py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center gap-1.5 sm:gap-2 ${
                  activeView === 'admin'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
                }`}
              >
                <Icon name="layers" className="w-4 h-4 shrink-0" />
                <span className="hidden min-[560px]:inline">Panel</span>
                {orders.filter((o) => o.status === 'pendiente').length > 0 && (
                  <span className="min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center animate-pulse">
                    {orders.filter((o) => o.status === 'pendiente').length}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 sm:p-2.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 hover:border-teal-500/50 hover:bg-slate-800 transition-all text-slate-200 hover:text-teal-400 shrink-0"
            aria-label="Cambiar tema claro/oscuro"
            title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="w-5 h-5" />
          </button>

          {/* Customer identity chip */}
          {activeView === 'customer' && savedCustomer?.customerName && (
            <button
              onClick={openIdentityLogin}
              className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-2xl bg-slate-800/90 border border-slate-700/80 hover:border-teal-500/50 hover:bg-slate-800 transition-all shrink-0"
              title="Cambiar de usuario"
              aria-label="Cambiar de usuario"
            >
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-slate-950 text-[10px] sm:text-xs font-black flex items-center justify-center shrink-0">
                {savedCustomer.customerName.charAt(0).toUpperCase()}
              </span>
              <span className="hidden min-[380px]:block max-w-20 sm:max-w-28 truncate text-[11px] sm:text-xs font-semibold text-slate-200">
                {savedCustomer.customerName.split(' ')[0]}
              </span>
            </button>
          )}

          {/* Customer Cart Quick Button */}
          {activeView === 'customer' && (
            <button
              data-cart-target
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 sm:p-2.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 hover:border-teal-500/50 hover:bg-slate-800 transition-all text-slate-200 hover:text-teal-400 group shrink-0"
              aria-label="Abrir carrito"
            >
              <Icon name="shoppingBag" className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:scale-110" />
              {cartCount > 0 && (
                <span
                  key={cartCount}
                  className="absolute -top-1.5 -right-1.5 bg-teal-400 text-slate-950 text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg animate-badge-pop ring-2 ring-slate-900"
                >
                  {cartCount}
                </span>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Tasa BCV del día + Calculadora */}
      <RateBanner rate={rate} />

      {/* Main Container */}
      <main className={`flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8 ${activeView === 'customer' && cartCount > 0 ? 'pb-36 sm:pb-8' : 'pb-24 sm:pb-8'}`}>
        {isLoading ? (
          <LoadingScreen />
        ) : loadError ? (
          <LoadErrorScreen error={loadError} onRetry={loadState} />
        ) : activeView === 'customer' ? (
          <CustomerView
            products={filteredProducts}
            allProducts={products}
            stickyTop={headerHeight}
            categories={categories}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            sortOption={sortOption}
            setSortOption={setSortOption}
            rate={rate}
            promos={promos}
            onAddToCart={addToCart}
            onOpenProductModal={(product) => setProductDetailModal(product)}
            currentOrderTracking={trackedOrder}
            setCurrentOrderTracking={setCurrentOrderTracking}
            savedCustomer={savedCustomer}
            lastOrderForCustomer={lastOrderForCustomer}
            onRepeatLastOrder={handleRepeatLastOrder}
            customerOrders={customerOrders}
            orders={orders}
            customerProfile={customerProfile}
            onViewOrderDetail={(order) => setOrderDetailOrder(order)}
            onRequestCancelOrder={(order) => setCancelConfirmOrder(order)}
            onTrackLiveOrder={(order) => setLiveTrackingOrder(order)}
            storeLocation={storeLocation}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            focusSection={focusCustomerSection}
            onOpenDebt={() => setIsDebtDrawerOpen(true)}
          />
        ) : isAdminAuthed ? (
          <AdminView
            products={products}
            orders={orders}
            rate={rate}
            promos={promos}
            onSavePromos={handleSavePromos}
            adminTab={adminTab}
            setAdminTab={setAdminTab}
            onLogout={handleAdminLogout}
            refreshingDb={refreshingDb}
            onRefreshDb={handleRefreshDb}
            onOpenAddModal={() => {
              setProductToEdit(null);
              setIsAddEditModalOpen(true);
            }}
            onEditProduct={(product) => {
              setProductToEdit(product);
              setIsAddEditModalOpen(true);
            }}
            onDeleteProduct={(product) => setDeleteConfirmProduct(product)}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onUpdateOrderPayment={handleUpdateOrderPayment}
            onUpdateCourierLocation={handleUpdateCourierLocation}
            onDeleteOrder={(order) => setDeleteOrderTarget(order)}
            allCustomers={allCustomers}
            onLoadCustomers={loadCustomers}
            onToggleBenefited={handleToggleBenefited}
            onAddToBlacklist={handleAddToBlacklist}
            onAddBlacklistDebt={handleAddBlacklistDebt}
            collections={collections}
            onLoadCollections={loadCollections}
            onUpsertCollection={handleUpsertCollection}
            onDeleteCollection={handleDeleteCollection}
            addToast={addToast}
            storeLocation={storeLocation}
            onSaveStoreLocation={handleSaveStoreLocation}
            adminPhone={savedCustomer ? `${savedCustomer.phoneCode || ''} ${savedCustomer.phoneNumber || ''}`.trim() : ''}
          />
        ) : (
          <AdminLoginView
            onLogin={handleAdminLogin}
            onBiometricLogin={handleAdminBiometricLogin}
            onBiometricRegister={handleAdminBiometricRegister}
            onBack={() => setActiveView('customer')}
          />
        )}
      </main>

      {/* 1. Customer Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        cartTotal={cartTotal}
        rate={rate}
        onUpdateQty={updateCartQty}
        onRemove={removeFromCart}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      {/* 1b. Orders Drawer (Mis Pedidos) */}
      <OrdersDrawer
        isOpen={isOrdersDrawerOpen}
        onClose={() => setIsOrdersDrawerOpen(false)}
        orders={customerOrders}
        rate={rate}
        onViewOrderDetail={(order) => {
          setIsOrdersDrawerOpen(false);
          setOrderDetailOrder(order);
        }}
        onTrackLiveOrder={(order) => {
          setIsOrdersDrawerOpen(false);
          setLiveTrackingOrder(order);
        }}
        onRequestCancelOrder={(order) => {
          setIsOrdersDrawerOpen(false);
          setCancelConfirmOrder(order);
        }}
      />

      {/* 1c. Debt Drawer (Mi Deuda) */}
      {isDebtDrawerOpen && customerProfile && (
        <ErrorBoundary>
          <CustomerDebtModal
            customer={customerProfile}
            orders={orders}
            rate={rate}
            onClose={() => setIsDebtDrawerOpen(false)}
          />
        </ErrorBoundary>
      )}

      {/* 2. Product Detail Modal */}
      {productDetailModal && (
        <ProductDetailModal
          product={productDetailModal}
          sameBrandProducts={productDetailModal.brand
            ? products.filter((p) => p.brand === productDetailModal.brand)
            : [productDetailModal]}
          rate={rate}
          isFavorite={favorites.includes(productDetailModal.id)}
          onToggleFavorite={() => toggleFavorite(productDetailModal.id)}
          onNavigate={(p) => setProductDetailModal(p)}
          onClose={() => setProductDetailModal(null)}
          onAddToCart={(qty, rect) => {
            addToCart(productDetailModal, qty, rect);
          }}
        />
      )}

      {/* 3. Checkout Modal */}
      {isCheckoutOpen && (
        <CheckoutModal
          onClose={() => setIsCheckoutOpen(false)}
          cart={cart}
          cartTotal={cartTotal}
          rate={rate}
          isPlacingOrder={isPlacingOrder}
          onSubmit={handlePlaceOrder}
          savedCustomer={savedCustomer}
          knownCustomers={knownCustomers}
          onSaveCustomer={setSavedCustomer}
          customerProfile={customerProfile}
          onSaveAddress={handleSaveCustomerAddress}
          addToast={addToast}
          paymentConfig={paymentConfig}
        />
      )}

      {/* 4. Admin Add/Edit Product Modal */}
      {isAddEditModalOpen && (
        <ProductFormModal
          productToEdit={productToEdit}
          categories={categories}
          onClose={() => setIsAddEditModalOpen(false)}
          onSave={handleSaveProduct}
        />
      )}

      {/* 5. Delete Confirm Modal */}
      {deleteConfirmProduct && (
        <DeleteConfirmModal
          product={deleteConfirmProduct}
          onClose={() => setDeleteConfirmProduct(null)}
          onConfirm={() => handleDeleteProduct(deleteConfirmProduct.id)}
        />
      )}

      {/* 5b. Order Detail Modal */}
      {orderDetailOrder && (
        <OrderDetailModal
          order={orderDetailOrder}
          rate={rate}
          onClose={() => setOrderDetailOrder(null)}
          onTrackLiveOrder={(order) => {
            setOrderDetailOrder(null);
            setLiveTrackingOrder(order);
          }}
          onRequestCancelOrder={(order) => {
            setOrderDetailOrder(null);
            setCancelConfirmOrder(order);
          }}
        />
      )}

      {/* 5b2. Live Tracking Modal (cliente reabre el rastreo de una entrega) */}
      {liveTrackingOrder && (
        <LiveTrackingModal
          order={liveTrackingOrder}
          onClose={() => setLiveTrackingOrder(null)}
          storeLocation={storeLocation}
        />
      )}

      {/* 5c. Cancel Order Confirm Modal */}
      {cancelConfirmOrder && (
        <CancelOrderModal
          order={cancelConfirmOrder}
          onClose={() => setCancelConfirmOrder(null)}
          onConfirm={() => {
            const key = `${savedCustomer?.phoneCode || ''}${savedCustomer?.phoneNumber || ''}`.replace(/\D/g, '').slice(-11);
            handleCancelOrder(cancelConfirmOrder.id, key);
          }}
        />
      )}

      {/* 5d. Delete Order Confirm Modal (Admin) */}
      {deleteOrderTarget && (
        <DeleteOrderModal
          order={deleteOrderTarget}
          onClose={() => setDeleteOrderTarget(null)}
          onConfirm={() => handleDeleteOrder(deleteOrderTarget.id)}
        />
      )}

      {/* Fixed bottom cart bar */}
      {activeView === 'customer' && cartCount > 0 && (
        <CartFloatBar
          cartCount={cartCount}
          cartTotal={cartTotal}
          rate={rate}
          onOpen={() => setIsCartOpen(true)}
        />
      )}

      {/* Identity modal: obligatorio para consumir como cliente */}
      {isIdentityOpen && activeView === 'customer' && (
        <IdentityModal
          knownCustomers={knownCustomers}
          savedCustomer={savedCustomer}
          mode={identityMode}
          confirmKind={identityConfirmKind}
          onConfirm={handleIdentifyCustomer}
          onConfirmBiometric={handleIdentityConfirmBiometric}
          onClose={() => setIsIdentityOpen(false)}
          isCurrentAdmin={isCurrentAdmin}
          onGoToAdmin={() => {
            setIsIdentityOpen(false);
            setActiveView('admin');
          }}
        />
      )}

      {/* Item volando al carrito (overlay animado) */}
      {flyItem && (
        <img
          key={flyItem.id}
          src={flyItem.image}
          alt=""
          className="fly-to-cart-img"
          style={{
            '--fx': `${flyItem.fx}px`,
            '--fy': `${flyItem.fy}px`,
            '--tx': `${flyItem.tx}px`,
            '--ty': `${flyItem.ty}px`
          }}
          onAnimationEnd={() => setFlyItem(null)}
        />
      )}

      {/* Barra de navegación inferior (móvil) */}
      <BottomTabBar
        activeView={activeView}
        customerTab={customerTab}
        onCustomerTab={(tab) => {
          setActiveView('customer');
          setCustomerTab(tab);
          setFocusCustomerSection(null);
          if (tab === 'orders') setIsOrdersDrawerOpen(true);
          if (tab === 'account') setIsDebtDrawerOpen(true);
        }}
        cartCount={cartCount}
        hasCustomer={Boolean(savedCustomer)}
        isAdmin={isCurrentAdmin || isAdminAuthed}
        onOpenCart={() => {
          setActiveView('customer');
          setIsCartOpen(true);
        }}
        onGoAdmin={() => {
          setIsIdentityOpen(false);
          setActiveView('admin');
          setAdminTab('inventory');
        }}
        onGoStore={() => {
          setActiveView('customer');
          setCustomerTab('store');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onCustomerLogout={openIdentityLogout}
        adminTab={adminTab}
        onAdminTab={handleAdminTabChange}
        pendingOrders={orders.filter((o) => o.status === 'pendiente').length}
        onLogout={handleAdminLogout}
        isAdminAuthed={isAdminAuthed}
      />

      {/* Footer */}
      <footer
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        className="mt-auto border-t border-slate-800/80 bg-slate-950/60 pt-5 pb-20 sm:py-6 px-4 text-center text-[11px] sm:text-xs text-slate-500"
      >
        <p>© 2026 Empresas Alvarados • Gestión inteligente de inventario y pedidos al instante.</p>
      </footer>

      {/* Banner de notificaciones push (solo cliente identificado y permiso sin decidir) */}
      {activeView === 'customer' &&
        savedCustomer?.phoneNumber &&
        !pushBannerHidden &&
        'Notification' in window &&
        'PushManager' in window &&
        Notification.permission === 'default' && (
        <PushBanner
          onEnable={handleEnableNotifications}
          onDismiss={() => {
            setPushBannerHidden(true);
            try { localStorage.setItem('kiosko_push_banner_hidden', '1'); } catch {}
          }}
        />
      )}

      {/* Bienvenida a pantalla completa tras el inicio de sesión */}
      {welcome && (
        <WelcomeOverlay
          name={welcome.name}
          tag={welcome.tag}
          onDone={() => {
            setWelcome(null);
            if (welcome.isNew) setShowTour(true);
          }}
        />
      )}

      {/* Tour tutorial para usuarios nuevos */}
      {showTour && <NewUserTour onClose={() => setShowTour(false)} />}
    </div>
  );
}

function WelcomeOverlay({ name, tag = 'Bienvenido', onDone }) {
  // Cualquier toque/click cierra la bienvenida al instante. También se cierra
  // sola tras unos segundos por si el cliente no toca la pantalla.
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);

  const isAdmin = tag.toLowerCase().includes('panel');

  return (
    <div
      onClick={onDone}
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-gradient-to-br from-teal-700 via-cyan-800 to-slate-950 animate-welcome-overlay cursor-pointer select-none touch-manipulation"
      role="dialog"
      aria-label={`${tag} ${name}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(45,212,191,0.15),transparent_60%)] animate-welcome-glow pointer-events-none" />
      <div className="relative flex flex-col items-center text-center px-6">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center mb-6 sm:mb-8 animate-welcome-pop shadow-2xl shadow-teal-500/20">
          <Icon name={isAdmin ? 'users' : 'sparkles'} className="w-8 h-8 sm:w-10 sm:h-10 text-teal-200" />
        </div>
        <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.35em] text-teal-200/80 mb-3 animate-welcome-pop">
          {tag}
        </p>
        <h2 className="text-4xl sm:text-6xl font-black text-white leading-tight mb-4 sm:mb-6 animate-welcome-name break-words max-w-[90vw]">
          {name}
        </h2>
        <p className="text-xs sm:text-sm text-teal-100/70 animate-welcome-pop">
          Toca en cualquier parte para continuar
        </p>
      </div>
    </div>
  );
}

// Banner que invita a activar las notificaciones push tras identificarse.
function PushBanner({ onEnable, onDismiss }) {
  return (
    <div className="fixed left-4 right-4 sm:left-6 sm:right-auto bottom-24 sm:bottom-6 z-[45] sm:max-w-sm rounded-2xl border border-teal-500/40 bg-slate-900/95 p-4 shadow-2xl backdrop-blur animate-screen-up">
      <div className="flex items-start gap-3">
        <span className="p-2 rounded-xl bg-teal-500/20 text-teal-400 shrink-0">
          <Icon name="bell" className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">Activa las notificaciones</p>
          <p className="text-xs text-slate-400 mt-0.5 leading-snug">
            Te avisamos al instante cuando tu pedido está listo o en camino.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={onEnable}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 text-xs font-bold hover:from-teal-400 hover:to-emerald-400 transition-all active:scale-95"
            >
              Activar ahora
            </button>
            <button
              onClick={onDismiss}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tour tutorial para clientes nuevos: se muestra tras la bienvenida para que
// descubran cómo pedir, seguir sus pedidos y revisar su saldo.
function NewUserTour({ onClose }) {  const steps = [
    {
      icon: 'store',
      title: 'Explora el catálogo',
      desc: 'Busca productos por nombre o navega por categorías y marcas para descubrir todo lo que tenemos para ti.'
    },
    {
      icon: 'shoppingBag',
      title: 'Agrega al carrito',
      desc: 'Toca cualquier producto para ver sus fotos y precio en $ y Bs. Presiona "Agregar al Carrito" cuando lo decidas.'
    },
    {
      icon: 'list',
      title: 'Sigue tus pedidos',
      desc: 'En "Mis Pedidos" puedes ver tu historial y rastrear en vivo la entrega a domicilio desde la barra inferior.'
    },
    {
      icon: 'creditCard',
      title: 'Pago a la entrega',
      desc: 'Elige retiro en tienda o delivery. Los beneficiados pueden pedir a crédito y revisar su saldo en "Mi Cuenta".'
    }
  ];
  const [stepIdx, setStepIdx] = useState(0);

  // Avanza automáticamente al siguiente paso; al terminar, cierra el tour.
  useEffect(() => {
    const t = setTimeout(() => {
      if (stepIdx < steps.length - 1) setStepIdx((i) => i + 1);
      else onClose();
    }, 7000);
    return () => clearTimeout(t);
  }, [stepIdx, steps.length, onClose]);

  const s = steps[stepIdx];

  return (
    <div className="fixed inset-0 z-[75] flex flex-col justify-end bg-slate-950/70 backdrop-blur-sm animate-fade-in" role="dialog" aria-label="Tour de bienvenida">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative m-4 sm:m-6 bg-slate-900 border border-teal-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl animate-screen-up space-y-4">
        <div className="flex items-start gap-3.5">
          <span className="p-2.5 rounded-2xl bg-teal-500/20 text-teal-400 shrink-0">
            <Icon name={s.icon} className="w-6 h-6" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-teal-400 mb-1">
              Conoce la app · {stepIdx + 1}/{steps.length}
            </p>
            <h3 className="text-base font-black text-white">{s.title}</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{s.desc}</p>
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs text-slate-500 hover:text-white transition-colors"
          >
            Omitir
          </button>
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === stepIdx ? 'w-6 bg-teal-400' : 'w-1.5 bg-slate-700'}`}
              />
            ))}
          </div>
          <button
            onClick={() => {
              if (stepIdx < steps.length - 1) setStepIdx((i) => i + 1);
              else onClose();
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 text-xs font-bold hover:from-teal-400 hover:to-emerald-400 transition-all active:scale-95"
          >
            {stepIdx < steps.length - 1 ? 'Siguiente' : '¡Listo!'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in" aria-busy="true" aria-label="Cargando la tienda">
      {/* Hero skeleton */}
      <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-8 bg-slate-800/40 border border-slate-700/40">
        <div className="skeleton-block w-32 h-5 mb-3" />
        <div className="skeleton-block w-56 h-8 mb-2" />
        <div className="skeleton-block w-40 h-4" />
      </div>

      {/* Buscador + pills skeleton */}
      <div className="space-y-3">
        <div className="skeleton-block h-12 rounded-2xl w-full" />
        <div className="flex gap-2 overflow-hidden">
          <div className="skeleton-block h-9 w-20 shrink-0" />
          <div className="skeleton-block h-9 w-24 shrink-0" />
          <div className="skeleton-block h-9 w-28 shrink-0" />
          <div className="skeleton-block h-9 w-20 shrink-0" />
        </div>
      </div>

      {/* Grid de tarjetas skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl sm:rounded-3xl bg-slate-800/40 border border-slate-700/40 overflow-hidden">
            <div className="skeleton-block aspect-square w-full rounded-none" />
            <div className="p-3 sm:p-4 space-y-2">
              <div className="skeleton-block h-4 w-3/4" />
              <div className="skeleton-block h-3 w-1/2" />
              <div className="flex justify-between items-center pt-2">
                <div className="skeleton-block h-5 w-14" />
                <div className="skeleton-block h-9 w-9 rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadErrorScreen({ error, onRetry }) {
  return (
    <div className="py-24 flex flex-col items-center justify-center text-center space-y-5 max-w-md mx-auto">
      <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
        <Icon name="alertTriangle" className="w-7 h-7" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-white">No se pudo conectar</h2>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{error}</p>
      </div>
      <button
        onClick={onRetry}
        className="px-5 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-sm hover:from-teal-400 hover:to-emerald-400 shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
      >
        <Icon name="refresh" className="w-4 h-4" />
        Reintentar
      </button>
    </div>
  );
}

function AdminLoginView({ onLogin, onBiometricLogin, onBiometricRegister, onBack }) {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Login state
  const [loginPhone, setLoginPhone] = useState({ code: '0412', number: '' });

  // Biometric login state
  const [bioStatus, setBioStatus] = useState('idle'); // 'idle' | 'working' | 'register'
  const [bioError, setBioError] = useState('');
  const [bioOptions, setBioOptions] = useState(null);
  const [bioNeedsRegister, setBioNeedsRegister] = useState(false);
  const bioFetchKeyRef = useRef('');

  // Recovery state
  const [recoverMode, setRecoverMode] = useState(false);
  const [recoverStep, setRecoverStep] = useState('phone'); // 'phone' | 'biometric' | 'newpass'
  const [recoverPhone, setRecoverPhone] = useState({ code: '0412', number: '' });
  const [recoverOptions, setRecoverOptions] = useState(null);
  const [biometricResponse, setBiometricResponse] = useState(null);
  const [newPassword, setNewPassword] = useState({ a: '', b: '' });
  const [recoverError, setRecoverError] = useState('');

  // Pre-carga los options de WebAuthn al completar el teléfono para que
  // startAuthentication se llame de forma síncrona en el tap (requisito de iOS
  // para mostrar el prompt de Face ID en lugar de solo la biometría).
  // Solo se hace UN fetch por teléfono: prefetches solapados pisan el challenge
  // en el server y rompen la verificación ("Unexpected authentication response challenge").
  const recoveryFetchKeyRef = useRef('');
  useEffect(() => {
    const valid = recoverMode && recoverStep === 'phone' && /^\d{7}$/.test(recoverPhone.number);
    if (!valid) return undefined;
    const phoneKey = `${recoverPhone.code}${recoverPhone.number}`.replace(/\D/g, '').slice(-11);
    if (recoveryFetchKeyRef.current === phoneKey) return undefined;
    let cancelled = false;
    api
      .webauthnLoginOptions({ phone: phoneKey })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          recoveryFetchKeyRef.current = phoneKey;
          setRecoverOptions(res.data.options);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [recoverMode, recoverStep, recoverPhone.code, recoverPhone.number]);

  // Pre-carga las opciones de biometría del login admin al completar el teléfono.
  // Solo se hace UN fetch por teléfono: prefetches solapados pisan el challenge
  // en el server y rompen la verificación.
  useEffect(() => {
    const valid = !recoverMode && /^\d{7}$/.test(loginPhone.number);
    if (!valid) return undefined;
    const phoneKey = `${loginPhone.code}${loginPhone.number}`.replace(/\D/g, '').slice(-11);
    if (bioFetchKeyRef.current === phoneKey) return undefined;
    let cancelled = false;
    api
      .webauthnLoginOptions({ phone: phoneKey })
      .then((res) => {
        if (cancelled) return;
        bioFetchKeyRef.current = phoneKey;
        if (res.ok) {
          setBioNeedsRegister(false);
          setBioOptions(res.data.options);
        } else if (res.status === 404) {
          // No hay biometría registrada en este dominio: el tap debe REGISTRAR
          // (primera vez en este ambiente) en vez de mostrar "no está lista".
          setBioNeedsRegister(true);
          setBioOptions(null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [recoverMode, loginPhone.code, loginPhone.number]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^\d{7}$/.test(loginPhone.number)) {
      setError('Ingresa tu teléfono de administrador.');
      return;
    }
    if (!password) {
      setError('Ingresa la contraseña de administrador.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const phoneKey = `${loginPhone.code}${loginPhone.number}`.replace(/\D/g, '').slice(-11);
      const ok = await onLogin(phoneKey, password);
      if (!ok) setError('Contraseña incorrecta. Verifica tu teléfono y contraseña.');
    } catch {
      setError('No se pudo conectar con el servidor. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Login admin con biometría (huella/Face ID). El teléfono es obligatorio y
  // la biometría reemplaza la contraseña. Si no hay biometría registrada para
  // ese teléfono en este dominio, se registra en el momento (primera vez).
  const handleBiometricLogin = async () => {
    if (!/^\d{7}$/.test(loginPhone.number)) {
      setError('Ingresa tu teléfono de administrador.');
      return;
    }
    const phoneKey = `${loginPhone.code}${loginPhone.number}`.replace(/\D/g, '').slice(-11);
    setError('');
    setBioError('');
    // Si el prefetch aún no cargó las options, las pedimos ahora en lugar de
    // fallar con "no está lista". Así el tap siempre funciona.
    if (bioFetchKeyRef.current !== phoneKey) {
      try {
        const res = await api.webauthnLoginOptions({ phone: phoneKey });
        if (res.ok) {
          bioFetchKeyRef.current = phoneKey;
          setBioNeedsRegister(false);
          setBioOptions(res.data.options);
        } else if (res.status === 404) {
          bioFetchKeyRef.current = phoneKey;
          setBioNeedsRegister(true);
          setBioOptions(null);
        } else {
          setBioError('No se pudo iniciar la verificación con biometría. Intenta de nuevo.');
          return;
        }
      } catch {
        setBioError('No se pudo conectar con el servidor. Intenta de nuevo.');
        return;
      }
    }
    setBioStatus('working');
    try {
      // Primera vez en este dominio (staging/producción): registra la biometría.
      if (bioNeedsRegister || !bioOptions) {
        setBioStatus('register');
        const rres = await api.webauthnRegisterOptions({ phone: phoneKey, customerName: 'Administrador' });
        if (!rres.ok) throw new Error(rres.data.error || 'No se pudo iniciar el registro');
        const regResponse = await startRegistration({ optionsJSON: rres.data.options });
        const ok = await onBiometricRegister(phoneKey, regResponse);
        if (!ok) setBioError('No se pudo guardar tu biometría. Intenta de nuevo.');
        setBioNeedsRegister(false);
        return;
      }
      const authResponse = await startAuthentication({ optionsJSON: bioOptions });
      const ok = await onBiometricLogin(phoneKey, authResponse);
      if (!ok) setBioError('La biometría no coincidió. Verifica que tu número sea de administrador.');
    } catch (err) {
      // Si la credencial se registró bajo un rpID anterior (dominio distinto),
      // el navegador la rechaza con NotAllowedError. Re-registramos en el rpID
      // actual para que quede válida.
      const isRpidMismatch = err?.name === 'NotAllowedError';
      if (!isRpidMismatch) {
        setBioError(friendlyAuthError(err));
        setBioStatus('idle');
        return;
      }
      try {
        setBioStatus('register');
        const rres = await api.webauthnRegisterOptions({ phone: phoneKey, customerName: 'Administrador' });
        if (!rres.ok) throw new Error(rres.data.error || 'No se pudo iniciar el re-registro');
        const regResponse = await startRegistration({ optionsJSON: rres.data.options });
        const ok = await onBiometricRegister(phoneKey, regResponse);
        if (!ok) setBioError('No se pudo guardar tu biometría. Intenta de nuevo.');
      } catch (regErr) {
        setBioError(friendlyAuthError(regErr));
      }
    } finally {
      setBioStatus('idle');
    }
  };

  const startRecovery = async () => {
    if (!/^\d{7}$/.test(recoverPhone.number)) {
      setRecoverError('Ingresa el número de teléfono de administrador.');
      return;
    }
    const phoneKey = `${recoverPhone.code}${recoverPhone.number}`.replace(/\D/g, '').slice(-11);
    setRecoverError('');
    // Si el prefetch no terminó, pedimos las options ahora en vez de fallar.
    if (recoveryFetchKeyRef.current !== phoneKey || !recoverOptions) {
      try {
        const res = await api.webauthnLoginOptions({ phone: phoneKey });
        if (!res.ok) {
          setRecoverError('Este número no tiene biometría registrada para verificar.');
          return;
        }
        recoveryFetchKeyRef.current = phoneKey;
        setRecoverOptions(res.data.options);
      } catch {
        setRecoverError('No se pudo conectar con el servidor. Intenta de nuevo.');
        return;
      }
    }
    setRecoverStep('biometric');
    try {
      const authResponse = await startAuthentication({ optionsJSON: recoverOptions });
      setBiometricResponse(authResponse);
      setRecoverStep('newpass');
      setRecoverError('');
    } catch {
      setRecoverError('No se pudo verificar la biometría. Si la cancelaste o no coincidió, intenta de nuevo.');
      setRecoverStep('phone');
    }
  };

  const submitNewPassword = async () => {
    if (newPassword.a !== newPassword.b) {
      setRecoverError('Las contraseñas no coinciden.');
      return;
    }
    if (newPassword.a.length < 6) {
      setRecoverError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    const phoneKey = `${recoverPhone.code}${recoverPhone.number}`.replace(/\D/g, '').slice(-11);
    setRecoverError('');
    const res = await api.recoverPassword(phoneKey, biometricResponse, newPassword.a);
    if (!res.ok) {
      setRecoverError(res.data.error || 'No se pudo recuperar la contraseña.');
      return;
    }
    setRecoverMode(false);
    setRecoverStep('phone');
    setNewPassword({ a: '', b: '' });
    recoveryFetchKeyRef.current = '';
    setRecoverOptions(null);
    setBiometricResponse(null);
    setRecoverPhone({ code: '0412', number: '' });
    setError('Contraseña restablecida. Ahora puedes iniciar sesión.');
  };

  if (recoverMode) {
    return (
      <div className="py-8 sm:py-16 flex items-center justify-center">
        <div className="w-full max-w-md bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 sm:p-8 shadow-2xl backdrop-blur-md space-y-6">
          <div className="text-center space-y-2">
            <span className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <Icon name="key" className="w-7 h-7" />
            </span>
            <h2 className="text-xl font-black text-white">Recuperar Contraseña</h2>
            <p className="text-xs text-slate-400">Verifica con biometría y crea una nueva contraseña.</p>
          </div>

          {recoverStep === 'phone' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Teléfono de administrador</label>
                <div className="flex gap-2">
                  <select
                    value={recoverPhone.code}
                    onChange={(e) => setRecoverPhone({ ...recoverPhone, code: e.target.value })}
                    className="w-24 shrink-0 px-3 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm font-bold focus:border-amber-500 focus:outline-none"
                  >
                    {PHONE_CODES.map((code) => (<option key={code} value={code}>{code}</option>))}
                  </select>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={recoverPhone.number}
                    onChange={(e) => setRecoverPhone({ ...recoverPhone, number: e.target.value.replace(/\D/g, '').slice(0, 7) })}
                    placeholder="1234567"
                    maxLength={7}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              {recoverError && <p className="text-xs text-rose-400 mt-2">{recoverError}</p>}
              <button
                onClick={startRecovery}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-bold text-sm hover:from-amber-400 hover:to-rose-400 shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                Verificar con biometría
              </button>
            </div>
          )}

          {recoverStep === 'biometric' && (
            <div className="text-center space-y-3">
              <p className="text-xs text-slate-400">Esperando verificación biométrica...</p>
            </div>
          )}

          {recoverStep === 'newpass' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nueva contraseña</label>
                <input
                  type="password"
                  value={newPassword.a}
                  onChange={(e) => setNewPassword({ ...newPassword, a: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Repetir contraseña</label>
                <input
                  type="password"
                  value={newPassword.b}
                  onChange={(e) => setNewPassword({ ...newPassword, b: e.target.value })}
                  placeholder="Repite la contraseña"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              {recoverError && <p className="text-xs text-rose-400 mt-2">{recoverError}</p>}
              <button
                onClick={submitNewPassword}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-bold text-sm hover:from-amber-400 hover:to-rose-400 shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                Guardar nueva contraseña
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => { setRecoverMode(false); setRecoverStep('phone'); setRecoverError(''); setNewPassword({ a: '', b: '' }); recoveryFetchKeyRef.current = ''; setRecoverOptions(null); setBiometricResponse(null); setRecoverPhone({ code: '0412', number: '' }); }}
            className="w-full py-2 text-xs text-slate-400 hover:text-white transition-colors"
          >
            ← Volver al login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 sm:py-16 flex items-center justify-center">
      <div className="w-full max-w-md bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 sm:p-8 shadow-2xl backdrop-blur-md space-y-6">
        <div className="text-center space-y-2">
          <span className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-cyan-500/20">
            <Icon name="layers" className="w-7 h-7" />
          </span>
          <h2 className="text-xl font-black text-white">Acceso al Panel Admin</h2>
          <p className="text-xs text-slate-400">Inicia sesión con tu contraseña o biometría para gestionar inventario y pedidos.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Teléfono de administrador</label>
            <div className="flex gap-2">
              <select
                value={loginPhone.code}
                onChange={(e) => setLoginPhone({ ...loginPhone, code: e.target.value })}
                className="w-24 shrink-0 px-3 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm font-bold focus:border-cyan-500 focus:outline-none"
              >
                {PHONE_CODES.map((code) => (<option key={code} value={code}>{code}</option>))}
              </select>
              <input
                type="tel"
                inputMode="numeric"
                value={loginPhone.number}
                onChange={(e) => setLoginPhone({ ...loginPhone, number: e.target.value.replace(/\D/g, '').slice(0, 7) })}
                placeholder="1234567"
                maxLength={7}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-cyan-500 focus:outline-none"
              />
            </div>
            {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
            {bioError && <p className="text-xs text-rose-400 mt-2">{bioError}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-bold text-sm hover:from-cyan-400 hover:to-blue-400 shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60"
          >
            <Icon name="check" className="w-4 h-4" />
            {isSubmitting ? 'Verificando...' : 'Iniciar sesión'}
          </button>

          {/* Biometría: debajo de Iniciar sesión, sin separador */}
          <button
            type="button"
            onClick={handleBiometricLogin}
            disabled={isSubmitting || bioStatus === 'working' || bioStatus === 'register'}
            className="w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl bg-slate-800/70 border border-cyan-500/30 hover:border-cyan-400/60 hover:bg-slate-700/60 text-slate-200 transition-all disabled:opacity-60"
          >
            {bioStatus === 'working' || bioStatus === 'register' ? (
              <>
                {IS_IOS ? <Icon name="apple" className="w-5 h-5" /> : <Icon name="fingerprint" className="w-5 h-5" />}
                <span>{bioStatus === 'working' ? 'Esperando...' : 'Registrando...'}</span>
              </>
            ) : IS_IOS ? (
              <>
                <Icon name="apple" className="w-5 h-5" />
                <Icon name="faceId" className="w-5 h-5" />
                <span className="font-semibold">Entrar con Face ID</span>
              </>
            ) : (
              <>
                <Icon name="fingerprint" className="w-6 h-6" />
                <span className="font-semibold">Entrar con huella</span>
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-slate-800 space-y-2">
          <button
            type="button"
            onClick={() => setRecoverMode(true)}
            className="w-full py-2 text-xs text-amber-300 hover:text-amber-200 hover:bg-slate-800/60 rounded-xl transition-all flex items-center justify-center gap-1.5"
          >
            <Icon name="key" className="w-3.5 h-3.5" />
            ¿Olvidaste tu contraseña? Recuperar con biometría
          </button>
          <button
            type="button"
            onClick={onBack}
            className="w-full py-2 text-xs text-slate-400 hover:text-white transition-colors"
          >
            ← Volver a la tienda
          </button>
        </div>
      </div>
    </div>
  );
}

// Captura errores de render para no dejar la pantalla en blanco sin aviso.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-red-500/40 rounded-3xl p-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center mb-3">
              <Icon name="alertTriangle" className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-base font-black text-white mb-1">Algo salió mal</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Ocurrió un problema inesperado al cargar esta sección. Toca Reintentar para intentarlo de nuevo.
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="w-full py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-sm font-bold hover:bg-red-500/30 transition-all"
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function CustomerView({
  products,
  allProducts,
  categories,
  selectedCategory,
  setSelectedCategory,
  searchQuery,
  setSearchQuery,
  sortOption,
  setSortOption,
  stickyTop,
  rate,
  promos,
  onAddToCart,
  onOpenProductModal,
  currentOrderTracking,
  setCurrentOrderTracking,
  savedCustomer,
  lastOrderForCustomer,
  onRepeatLastOrder,
  customerOrders,
  orders,
  customerProfile,
  onViewOrderDetail,
  onRequestCancelOrder,
  onTrackLiveOrder,
  storeLocation,
  favorites,
  onToggleFavorite,
  focusSection,
  onOpenDebt
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showMyOrders, setShowMyOrders] = useState(false);
  const [myOrdersPage, setMyOrdersPage] = useState(1);
  const [orderDateFilter, setOrderDateFilter] = useState({ preset: 'all', date: null });
  const [showCalendar, setShowCalendar] = useState(false);
  const [promoIdx, setPromoIdx] = useState(0);
  const PAGE_SIZE = 5;

  // Carrusel de promos con autoplay (solo cuando hay más de una activa)
  const activePromos = promos.filter((p) => p.active);
  useEffect(() => {
    if (activePromos.length <= 1) return undefined;
    const id = setInterval(() => setPromoIdx((i) => (i + 1) % activePromos.length), 5000);
    return () => clearInterval(id);
  }, [activePromos.length]);
  const safePromoIdx = activePromos.length > 0 ? promoIdx % activePromos.length : 0;

  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allProducts
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [allProducts, searchQuery]);

  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const dow = (todayStart.getDay() + 6) % 7; // 0 = Monday
    const thisMon = new Date(todayStart); thisMon.setDate(thisMon.getDate() - dow);
    const thisSun = new Date(thisMon); thisSun.setDate(thisSun.getDate() + 6);
    const lastMon = new Date(thisMon); lastMon.setDate(lastMon.getDate() - 7);
    const lastSun = new Date(thisMon); lastSun.setDate(lastSun.getDate() - 1);

    return customerOrders.filter((o) => {
      const d = parseOrderDate(o);
      if (isNaN(d)) return true;
      switch (orderDateFilter.preset) {
        case 'today': return startOfDay(d).getTime() === todayStart.getTime();
        case 'thisWeek': return d >= thisMon && d <= thisSun;
        case 'lastWeek': return d >= lastMon && d <= lastSun;
        case 'day': return orderDateFilter.date && toYMD(d) === orderDateFilter.date;
        default: return true;
      }
    });
  }, [customerOrders, orderDateFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const safePage = Math.min(myOrdersPage, totalPages);
  const pagedOrders = filteredOrders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setMyOrdersPage(1); }, [orderDateFilter]);

  // La barra inferior (móvil) pide expandir y scrollear a Mis Pedidos o Mi Cuenta
  useEffect(() => {
    if (!focusSection) return;
    const timer = setTimeout(() => {
      const id = focusSection === 'orders' ? 'pedidos-seccion' : 'cuenta-seccion';
      if (focusSection === 'orders') setShowMyOrders(true);
      if (focusSection === 'account') onOpenDebt?.();
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
    return () => clearTimeout(timer);
  }, [focusSection]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Compact Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-teal-900/40 via-slate-800 to-indigo-950/50 animate-gradient-x border border-slate-700/60 p-4 sm:p-8 shadow-2xl backdrop-blur-md">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-5">
          <div className="space-y-2 sm:space-y-3 max-w-xl">
            <span className="px-2.5 sm:px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">
              ⚡ Pedidos al momento
            </span>
            <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
              ¿Qué se te antoja hoy?
            </h2>
            <p className="hidden sm:block text-slate-300 text-sm leading-relaxed">
              Explora nuestros antojos, bebidas frías y snacks. Paga y retira sin hacer filas o recibe en tu puerta.
            </p>
          </div>

          {/* Tasa BCV card */}
          <div className="w-full sm:w-auto shrink-0 p-3 sm:p-4 rounded-2xl bg-slate-950/60 border border-teal-500/30 backdrop-blur-md">
            <span className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Icon name="dollarSign" className="w-3.5 h-3.5 text-teal-400" />
              Tasa BCV
            </span>
            <span className="block text-lg sm:text-xl font-black text-white mt-0.5 sm:mt-1">
              1 US$ = <span className="text-teal-300">{rate?.rate ? rate.rate.toLocaleString('es-AR') : '—'} Bs</span>
            </span>
            {rate?.date && (
              <span className="text-[10px] text-slate-500 mt-0.5 sm:mt-1 block">
                {rate.source} · {new Date(rate.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
              </span>
            )}
          </div>
        </div>
        {/* Decorative graphic background */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Promos Carousel */}
      {activePromos.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl">
          <div
            key={activePromos[safePromoIdx].id}
            className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-rose-500/10 border border-amber-500/30 animate-fade-in"
          >
            {activePromos[safePromoIdx].image && (
              <img
                src={activePromos[safePromoIdx].image}
                alt={activePromos[safePromoIdx].title}
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl object-cover border border-amber-500/30 shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <Icon name="sparkles" className="w-3 h-3" /> Promo {activePromos.length > 1 ? `${safePromoIdx + 1}/${activePromos.length}` : ''}
              </span>
              <h4 className="font-bold text-white text-sm truncate">{activePromos[safePromoIdx].title}</h4>
              {activePromos[safePromoIdx].subtitle && (
                <p className="text-xs text-slate-300 line-clamp-1 sm:line-clamp-2">{activePromos[safePromoIdx].subtitle}</p>
              )}
            </div>
          </div>

          {/* Dots del carrusel */}
          {activePromos.length > 1 && (
            <div className="absolute bottom-1.5 right-2 flex items-center gap-1">
              {activePromos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPromoIdx(i)}
                  aria-label={`Ver promo ${i + 1}`}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === safePromoIdx ? 'bg-amber-400 w-3' : 'bg-amber-400/30'}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Repetir último pedido del cliente reconocido */}
      {savedCustomer?.customerName && lastOrderForCustomer && (
        <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-teal-500/15 via-cyan-500/10 to-emerald-500/15 border border-teal-500/30 flex items-center gap-3 sm:gap-4">
          <span className="p-2 sm:p-2.5 rounded-xl bg-teal-500/20 text-teal-400 shrink-0">
            <Icon name="refresh" className="w-4 h-4 sm:w-5 sm:h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm sm:text-base font-bold text-white truncate">
              ¡Hola de nuevo, {savedCustomer.customerName.split(' ')[0]}!
            </p>
            <p className="text-[11px] sm:text-xs text-slate-400 truncate">
              Tu último pedido #{lastOrderForCustomer.id} ({lastOrderForCustomer.items.length} artículos) está listo para repetirse.
            </p>
          </div>
          <button
            onClick={onRepeatLastOrder}
            className="shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 text-xs font-bold hover:from-teal-400 hover:to-emerald-400 shadow-lg shadow-teal-500/20 transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Icon name="refresh" className="w-3.5 h-3.5" />
            <span className="hidden min-[360px]:inline">Repetir pedido</span>
          </button>
        </div>
      )}

      {/* Mi Cuenta: saldo pendiente del cliente reconocido */}
      {savedCustomer?.customerName && customerProfile && (
        <div id="cuenta-seccion" className="rounded-2xl sm:rounded-3xl bg-slate-800/60 border border-slate-700/60 overflow-hidden backdrop-blur-md">
          <div className="p-3 sm:p-4 flex items-center gap-3">
            <span className="p-2 sm:p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0">
              <Icon name="creditCard" className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            <div className="flex-1 min-w-0">
              <span className="block text-sm sm:text-base font-bold text-white">Mi Cuenta</span>
              {customerProfile.isBenefited ? (
                <span className="block text-[11px] sm:text-xs text-teal-400">
                  Beneficiado · puedes pedir a crédito
                </span>
              ) : (
                <span className="block text-[11px] sm:text-xs text-slate-400">
                  Pago a la entrega
                </span>
              )}
            </div>
            <button
              onClick={onOpenDebt}
              className="text-right shrink-0 flex flex-col items-end gap-1 hover:opacity-90 transition-opacity"
              aria-label="Ver detalle de mi deuda"
            >
              <span className="block text-lg sm:text-xl font-black text-white">
                {formatUsd(Number(customerProfile.balance) || 0)}
              </span>
              <span className="flex items-center gap-0.5 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                Ver saldo <Icon name="chevronRight" className="w-3 h-3" />
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Mis Pedidos: historial del cliente reconocido */}
      {savedCustomer?.customerName && customerOrders.length > 0 && (
        <div id="pedidos-seccion" className="rounded-2xl sm:rounded-3xl bg-slate-800/60 border border-slate-700/60 overflow-hidden backdrop-blur-md">
          <button
            onClick={() => setShowMyOrders((v) => !v)}
            className="w-full p-3 sm:p-4 flex items-center gap-3 hover:bg-slate-800/80 transition-colors text-left"
          >
            <span className="p-2 sm:p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 shrink-0">
              <Icon name="package" className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm sm:text-base font-bold text-white">Mis Pedidos</span>
              <span className="block text-[11px] sm:text-xs text-slate-400 truncate">
                {customerOrders.length} pedido{customerOrders.length !== 1 ? 's' : ''}
                {customerProfile && customerProfile.addresses?.length > 0 ? ' · direcciones guardadas' : ''}
              </span>
            </span>
            <span className={`p-1.5 rounded-lg bg-slate-700/50 text-slate-300 transition-transform duration-300 ${showMyOrders ? 'rotate-180' : ''}`}>
              <Icon name="minus" className="w-3.5 h-3.5" />
            </span>
          </button>

          {showMyOrders && (
            <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-2 sm:space-y-2.5 animate-fade-in">
              {/* Filtro de fecha + Paginación */}
              <div className="space-y-3">
                {/* Chips rápidos + selector fecha */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { key: 'all', label: 'Todos' },
                      { key: 'today', label: 'Hoy' },
                      { key: 'thisWeek', label: 'Esta semana' },
                      { key: 'lastWeek', label: 'Semana anterior' }
                    ].map((f) => (
                      <button
                        key={f.key}
                        onClick={() => { setOrderDateFilter({ preset: f.key, date: null }); setMyOrdersPage(1); }}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                          orderDateFilter.preset === f.key
                            ? 'bg-teal-500 text-slate-950 shadow-sm'
                            : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-700/60'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setShowCalendar(!showCalendar)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-300 text-[11px] font-medium hover:bg-slate-700/60 flex items-center gap-1.5"
                    >
                      <Icon name="filter" className="w-3.5 h-3.5" />
                      {orderDateFilter.preset === 'day' && orderDateFilter.date
                        ? orderDateFilter.date
                        : 'Calendario'}
                    </button>
                    {showCalendar && (
                      <MiniCalendar
                        value={orderDateFilter.date}
                        onChange={(d) => { setOrderDateFilter({ preset: 'day', date: d }); setMyOrdersPage(1); }}
                        onClose={() => setShowCalendar(false)}
                      />
                    )}
                  </div>
                </div>

                {/* Paginación */}
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                  <span>
                    Mostrando {pagedOrders.length > 0 ? ((myOrdersPage - 1) * PAGE_SIZE + 1) : 0}–{Math.min(myOrdersPage * PAGE_SIZE, filteredOrders.length)} de {filteredOrders.length}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setMyOrdersPage(p => Math.max(1, p - 1))}
                      disabled={myOrdersPage === 1}
                      className="px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700/60"
                    >
                      <Icon name="minus" className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 font-semibold text-white">{myOrdersPage} / {totalPages}</span>
                    <button
                      onClick={() => setMyOrdersPage(p => Math.min(totalPages, p + 1))}
                      disabled={myOrdersPage === totalPages}
                      className="px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700/60"
                    >
                      <Icon name="plus" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Lista paginada */}
              {pagedOrders.map((o) => {
                const style = STATUS_STYLES[o.status] || STATUS_STYLES.pendiente;
                const cancellable = o.status === 'pendiente' || o.status === 'en_preparacion';
                return (
                  <div
                    key={o.id}
                    className="p-3 rounded-xl sm:rounded-2xl bg-slate-900/60 border border-slate-700/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm font-bold text-white">
                        Pedido <span className="text-teal-400">#{o.id}</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${style.badge}`}>
                        {STATUS_LABELS[o.status] || 'Pendiente'}
                      </span>
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1">
                      {o.timestamp} · {o.items.length} artículo{o.items.length !== 1 ? 's' : ''} · {formatUsd(o.total)}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
                      {o.type === 'delivery' ? `Envío a ${o.address || 'domicilio'}` : 'Retiro en tienda'}
                    </p>
                    <div className="flex items-center gap-2 mt-2.5">
                      <button
                        onClick={() => onViewOrderDetail(o)}
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold hover:bg-cyan-500/25 transition-all flex items-center justify-center gap-1"
                      >
                        <Icon name="eye" className="w-3 h-3" />
                        Ver detalle
                      </button>
                      {o.type === 'delivery' && o.status !== 'cancelado' && o.status !== 'entregado' && (
                        <button
                          onClick={() => onTrackLiveOrder(o)}
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1"
                        >
                          <Icon name="mapPin" className="w-3 h-3" />
                          Rastrear
                        </button>
                      )}
                      {cancellable && (
                        <button
                          onClick={() => onRequestCancelOrder(o)}
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-bold hover:bg-rose-500/25 transition-all flex items-center justify-center gap-1"
                        >
                          <Icon name="x" className="w-3 h-3" />
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Live Order Tracker Banner (If customer placed an order recently) */}
      {currentOrderTracking && (
        <div className="p-4 sm:p-6 rounded-3xl bg-slate-800/90 border border-teal-500/40 shadow-xl space-y-4 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <span className="p-2 sm:p-2.5 rounded-2xl bg-teal-500/20 text-teal-400 shrink-0">
                <Icon name="clock" className="w-5 h-5 sm:w-6 sm:h-6 animate-spin-slow" />
              </span>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 truncate">
                  Pedido <span className="text-teal-400">#{currentOrderTracking.id}</span>
                </h3>
                <p className="text-xs text-slate-400">Estimado: ~{currentOrderTracking.estimatedMinutes} mins</p>
              </div>
            </div>
            <button
              onClick={() => setCurrentOrderTracking(null)}
              className="text-xs text-slate-400 hover:text-white p-2 shrink-0"
            >
              Cerrar
            </button>
          </div>

          {/* Stepper Status Bar */}
          <div
            className={`grid gap-1.5 sm:gap-2 pt-1 sm:pt-2 ${
              currentOrderTracking.type === 'delivery' ? 'grid-cols-5' : 'grid-cols-4'
            }`}
          >
            {[
              { key: 'pendiente', label: '1. Recibido' },
              { key: 'en_preparacion', label: '2. Preparando' },
              { key: 'listo', label: '3. Listo' },
              ...(currentOrderTracking.type === 'delivery'
                ? [{ key: 'en_camino', label: '4. En camino' }]
                : []),
              { key: 'entregado', label: currentOrderTracking.type === 'delivery' ? '5. Entregado' : '4. Entregado' }
            ].map((step, idx) => {
              const currentIdx = STATUS_FLOW.indexOf(currentOrderTracking.status);
              const isPassed = idx <= currentIdx;
              const isCurrent = idx === currentIdx;

              return (
                <div key={step.key} className="flex flex-col items-center gap-1.5 sm:gap-2">
                  <div
                    className={`w-full h-1.5 sm:h-2 rounded-full transition-all duration-500 ${
                      isPassed
                        ? 'bg-teal-400 shadow-lg shadow-teal-500/50'
                        : 'bg-slate-700/60'
                    }`}
                  />
                  <span
                    className={`text-[9px] sm:text-xs font-semibold text-center leading-tight ${
                      isCurrent
                        ? 'text-teal-300 font-bold scale-105'
                        : isPassed
                        ? 'text-slate-300'
                        : 'text-slate-500'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Mapa de entrega a domicilio (destino + repartidor en vivo) */}
          {currentOrderTracking.type === 'delivery' && (
            <DeliveryMap order={currentOrderTracking} storeLocation={storeLocation} />
          )}
        </div>
      )}

      {/* Search Bar & Category Filter Bar (fija debajo del header) */}
      <div
        className="sticky z-20 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 py-2 sm:py-3 bg-slate-900/95 backdrop-blur-lg border-b border-slate-800/60 space-y-4"
        style={{ top: stickyTop }}
      >
        <div className="relative">
          <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Buscar productos, marcas..."
            className="w-full pl-12 pr-10 py-3.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl text-slate-100 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-sm backdrop-blur-md"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <Icon name="x" className="w-4 h-4" />
            </button>
          )}

          {/* Autocomplete suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 z-20 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-scale-up">
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSearchQuery(p.name);
                    setShowSuggestions(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/80 transition-all text-left"
                >
                  <img src={p.image} alt={p.name} className="w-9 h-9 rounded-lg object-cover bg-slate-800" />
                  <div className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-slate-200 truncate">{p.name}</span>
                    <span className="text-[11px] text-teal-400 font-bold">{formatUsd(p.price)}</span>
                  </div>
                  <Icon name="arrowRight" className="w-4 h-4 text-slate-500" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2.5">
          {/* Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {['Todas', 'Favoritos', ...categories].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 sm:px-4 py-2 rounded-2xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-300 border shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-lg shadow-teal-500/20 scale-105'
                    : 'bg-slate-800/60 text-slate-300 border-slate-700/80 hover:bg-slate-700/60 hover:text-white'
                }`}
              >
                {cat === 'Favoritos' ? `❤ Favoritos (${favorites.length})` : cat}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="w-full px-3 py-2.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-xs font-semibold text-slate-300 focus:border-teal-500 focus:outline-none"
            aria-label="Ordenar productos"
          >
            <option value="relevancia">✨ Ordenar: Relevancia</option>
            <option value="popular">🔥 Más vendidos</option>
            <option value="precio-asc">💲 Precio: menor a mayor</option>
            <option value="precio-desc">💲 Precio: mayor a menor</option>
            <option value="stock">📦 Mayor stock</option>
          </select>
        </div>
      </div>

      {/* Product Grid */}
      {products.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/30 rounded-3xl border border-slate-800 space-y-3">
          <Icon name="search" className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-slate-300">No encontramos productos</h3>
          <p className="text-slate-500 text-xs">Intenta cambiar la categoría o limpiar el término de búsqueda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              rate={rate}
              isFavorite={favorites.includes(product.id)}
              onToggleFavorite={() => onToggleFavorite(product.id)}
              onAddToCart={(e) => onAddToCart(product, 1, e.currentTarget.getBoundingClientRect())}
              onOpenDetail={() => onOpenProductModal(product)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, rate, onAddToCart, onOpenDetail, isFavorite, onToggleFavorite }) {
  const isOut = product.stock <= 0;
  const isLow = product.stock > 0 && product.stock <= 5;
  const [justAdded, setJustAdded] = useState(false);

  const handleAdd = (e) => {
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
    onAddToCart(e);
  };

  return (
    <div className="group bg-slate-800/70 border border-slate-700/60 rounded-2xl sm:rounded-3xl overflow-hidden hover:border-teal-500/40 transition-all duration-300 hover:shadow-2xl hover:shadow-teal-500/5 hover:-translate-y-1 flex flex-col justify-between backdrop-blur-sm">
      <div onClick={onOpenDetail} className="cursor-pointer relative overflow-hidden aspect-square sm:aspect-[4/3] bg-slate-900">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex flex-wrap gap-1">
          {isNewProduct(product) && !wasNewProductViewed(product.id) && (
            <span
              onClick={(e) => { e.stopPropagation(); markNewProductViewed(product.id); }}
              className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl bg-gradient-to-r from-fuchsia-500 to-teal-400 text-slate-950 text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-lg shadow-fuchsia-500/30 animate-bounce-short cursor-pointer"
            >
              NUEVO
            </span>
          )}
          {product.brand && (
            <span className="hidden sm:inline px-2.5 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md text-xs font-medium text-teal-300 border border-teal-500/30">
              {product.brand}
            </span>
          )}
          <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl bg-slate-950/80 backdrop-blur-md text-[10px] sm:text-xs font-medium text-slate-200 border border-white/10">
            {product.category}
          </span>
        </div>

        {/* Favorito */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="absolute top-2 right-2 sm:top-3 sm:right-3 p-1.5 sm:p-2 rounded-xl bg-slate-950/70 backdrop-blur-md border border-white/10 transition-all active:scale-75 hover:scale-110"
          aria-label={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
        >
          <Icon
            name={isFavorite ? 'heartFilled' : 'heart'}
            className={`w-4 h-4 sm:w-5 sm:h-5 transition-all ${isFavorite ? 'text-rose-400 drop-shadow-[0_0_6px_rgba(244,63,94,0.7)]' : 'text-slate-300'}`}
          />
        </button>

        {/* Stock Badge Overlay */}
        {isOut ? (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center">
            <span className="px-3 py-1.5 rounded-full bg-rose-500/90 text-white font-bold text-xs shadow-lg uppercase tracking-wider">
              Agotado
            </span>
          </div>
        ) : isLow ? (
          <span className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl bg-amber-500/90 text-slate-950 font-extrabold text-[10px] sm:text-[11px] shadow-lg">
            ¡Últimas {product.stock} un.!
          </span>
        ) : null}
      </div>

      <div className="p-2.5 sm:p-5 flex-1 flex flex-col justify-between space-y-2 sm:space-y-4">
        <div>
          <h3
            onClick={onOpenDetail}
            className="font-bold text-slate-100 group-hover:text-teal-300 transition-colors cursor-pointer line-clamp-1 text-sm sm:text-base"
          >
            {product.name}
          </h3>
          {formatSize(product) && (
            <span className="inline-block mt-1 px-1.5 sm:px-2 py-0.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-[10px] sm:text-[11px] font-bold text-teal-300">
              {formatSize(product)}
            </span>
          )}
          <p className="hidden sm:block text-slate-400 text-xs line-clamp-2 mt-1 leading-relaxed">
            {product.description}
          </p>
        </div>

        <div className="flex items-center justify-between pt-1.5 sm:pt-2 border-t border-slate-700/50">
          <div>
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium block">Precio</span>
            <span className="text-base sm:text-lg font-black text-white">
              {formatUsd(product.price)}
            </span>
            {rate?.rate > 0 && (
              <span className="block text-[10px] sm:text-[11px] font-bold text-teal-300/90 mt-0.5 truncate">
                {formatBs(usdToBs(product.price, rate.rate))}
              </span>
            )}
          </div>

          <button
            onClick={handleAdd}
            disabled={isOut}
            className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl font-semibold text-xs flex items-center gap-1.5 transition-all duration-300 active:scale-90 ${
              justAdded
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : isOut
                ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                : 'bg-teal-500 text-slate-950 hover:bg-teal-400 shadow-md shadow-teal-500/20'
            }`}
            aria-label="Agregar al carrito"
          >
            {justAdded ? (
              <Icon name="check" className="w-4 h-4 animate-added-pop" />
            ) : (
              <Icon name="plus" className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{justAdded ? '¡Listo!' : 'Agregar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductDetailModal({ product, sameBrandProducts = [], rate, onClose, onAddToCart, isFavorite, onToggleFavorite, onNavigate }) {
  const [quantity, setQuantity] = useState(1);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [touchX, setTouchX] = useState(null);
  const [slideDir, setSlideDir] = useState('right');
  const isOut = product.stock <= 0;
  const unitBs = usdToBs(product.price, rate?.rate);
  const lineTotal = product.price * quantity;

  const currentIndex = useMemo(() => {
    const idx = (sameBrandProducts || []).findIndex((p) => p.id === product.id);
    return idx >= 0 ? idx : 0;
  }, [product.id, sameBrandProducts]);

  const totalInBrand = (sameBrandProducts || []).length;
  const hasSameBrand = totalInBrand > 1;

  const goTo = useCallback(
    (dir) => {
      if (!hasSameBrand) return;
      const next = currentIndex + dir;
      if (next < 0 || next >= totalInBrand) return;
      setSlideDir(dir > 0 ? 'right' : 'left');
      onNavigate?.(sameBrandProducts[next]);
      setQuantity(1);
    },
    [currentIndex, hasSameBrand, totalInBrand, onNavigate, sameBrandProducts]
  );

  // Navegación por swipe (deslizar) entre productos de la misma marca.
  const handleTouchStart = (e) => setTouchX(e.touches?.[0]?.clientX ?? null);
  const handleTouchEnd = (e) => {
    if (touchX == null) return;
    const delta = (e.changedTouches?.[0]?.clientX ?? 0) - touchX;
    if (Math.abs(delta) > 40) goTo(delta > 0 ? -1 : 1);
    setTouchX(null);
  };

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showFullscreen) setShowFullscreen(false);
        else onClose();
      }
      if (e.key === 'ArrowLeft') goTo(-1);
      if (e.key === 'ArrowRight') goTo(1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showFullscreen, goTo]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      {/* Backdrop Click */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-h-[92vh] bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-screen-up flex flex-col">
      {/* Handle visual para indicar arrastre en móvil */}
      <div className="sm:hidden absolute top-2.5 left-1/2 -translate-x-1/2 z-20 w-12 h-1.5 rounded-full bg-slate-700" />

      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 p-2 rounded-full bg-slate-950/60 text-slate-300 hover:text-white backdrop-blur-md hover:bg-slate-800 transition-all"
      >
        <Icon name="x" className="w-5 h-5" />
      </button>

      {/* Botón favorito */}
      <button
        onClick={onToggleFavorite}
        className="absolute top-4 left-4 z-20 p-2 rounded-full bg-slate-950/60 text-slate-300 hover:text-white backdrop-blur-md hover:bg-slate-800 transition-all active:scale-75"
        aria-label={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      >
        <Icon
          name={isFavorite ? 'heartFilled' : 'heart'}
          className={`w-5 h-5 ${isFavorite ? 'text-rose-400' : ''}`}
        />
      </button>

      {/* Imagen + full screen + paginación de la marca */}
      <div
        key={`img-${product.id}`}
        className={`relative h-40 sm:h-56 bg-slate-950 shrink-0 ${slideDir === 'right' ? 'animate-brand-slide-right' : 'animate-brand-slide-left'}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-4 left-4 sm:left-4">
            <span className="hidden sm:inline px-3 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md text-xs font-semibold text-teal-300 border border-teal-500/30">
              {product.category}
            </span>
          </div>

          {/* Botón full screen: agranda la imagen */}
          <button
            onClick={() => setShowFullscreen(true)}
            className="absolute bottom-3 right-3 z-20 p-2 rounded-xl bg-slate-950/70 backdrop-blur-md border border-white/15 text-slate-200 hover:text-white hover:border-teal-400/50 transition-all active:scale-90"
            aria-label="Ver imagen en pantalla completa"
          >
            <Icon name="maximize" className="w-5 h-5" />
          </button>

          {/* Paginación de la misma marca */}
          {hasSameBrand && (
            <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5">
              <button
                onClick={() => goTo(-1)}
                className="p-1.5 rounded-lg bg-slate-950/70 backdrop-blur-md border border-white/15 text-slate-200 hover:text-white hover:border-teal-400/50 transition-all active:scale-90"
                aria-label="Producto anterior de la marca"
              >
                <Icon name="chevronLeft" className="w-4 h-4" />
              </button>
              <span className="px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md border border-teal-500/30 text-[10px] font-bold text-teal-300">
                {currentIndex + 1}/{totalInBrand} · {product.brand}
              </span>
              <button
                onClick={() => goTo(1)}
                className="p-1.5 rounded-lg bg-slate-950/70 backdrop-blur-md border border-white/15 text-slate-200 hover:text-white hover:border-teal-400/50 transition-all active:scale-90"
                aria-label="Siguiente producto de la marca"
              >
                <Icon name="chevronRight" className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Miniaturas de la misma marca (paginación) */}
        {hasSameBrand && (
          <div className="flex gap-2 px-4 sm:px-6 pt-3 pb-1 shrink-0">
            {sameBrandProducts.map((p, i) => (
              <button
                key={p.id}
                onClick={() => {
                  setSlideDir(i > currentIndex ? 'right' : 'left');
                  onNavigate?.(p);
                  setQuantity(1);
                }}
                className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                  i === currentIndex
                    ? 'border-teal-400 ring-2 ring-teal-500/30'
                    : 'border-slate-700 hover:border-teal-500/50'
                }`}
                aria-label={`Ver ${p.name}`}
              >
                <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                {i === currentIndex && (
                  <span className="absolute inset-0 bg-teal-500/20" />
                )}
              </button>
            ))}
          </div>
        )}

        <div
          key={`body-${product.id}`}
          className={`p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-y-auto flex-1 ${slideDir === 'right' ? 'animate-brand-slide-right' : 'animate-brand-slide-left'}`}
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-mono">CÓDIGO: {product.code}</span>
                {product.brand && (
                  <span className="text-xs font-semibold text-teal-400">{product.brand}</span>
                )}
              </div>
              <span className={`text-xs font-semibold ${product.stock > 5 ? 'text-teal-400' : product.stock > 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                {product.stock > 0 ? `Stock: ${product.stock} un.` : 'Agotado'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">{product.name}</h2>
            {formatSize(product) && (
              <span className="text-xs font-semibold text-teal-400 mt-1 block">Tamaño: {formatSize(product)}</span>
            )}
            <p className="text-slate-300 text-sm mt-3 leading-relaxed">{product.description}</p>
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
            <div>
              <span className="text-xs text-slate-400 block">Precio Unitario</span>
              <span className="text-2xl font-black text-white">{formatUsd(product.price)}</span>
              {rate?.rate > 0 && (
                <span className="block text-xs font-bold text-teal-300/90 mt-0.5">
                  {formatBs(unitBs)}
                </span>
              )}
            </div>

            {/* Quantity Controls */}
            {!isOut && (
              <div className="flex items-center gap-3 bg-slate-900 p-1.5 rounded-xl border border-slate-700">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
                >
                  <Icon name="minus" className="w-4 h-4" />
                </button>
                <span className="font-bold text-slate-100 text-sm w-6 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
                >
                  <Icon name="plus" className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <button
            onClick={(e) => {
              onAddToCart(quantity, e.currentTarget.getBoundingClientRect());
              setQuantity(1);
            }}
            disabled={isOut}
            className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 ${
              isOut
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 hover:from-teal-400 hover:to-emerald-400 shadow-xl shadow-teal-500/20 active:scale-95'
            }`}
          >
            <Icon name="shoppingBag" className="w-5 h-5" />
            <span>
              {isOut
                ? 'Sin Stock Disponible'
                : `Agregar al Carrito • ${formatUsd(lineTotal)}${rate?.rate > 0 ? ` (${formatBs(usdToBs(lineTotal, rate.rate))})` : ''}`}
            </span>
          </button>
        </div>
      </div>

      {/* Visor full screen de la imagen (desliza para ver la misma marca) */}
      {showFullscreen && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/98 bg-black flex flex-col"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex items-center justify-between px-4 py-3 shrink-0">
            <div className="flex items-center gap-2">
              {hasSameBrand && (
                <>
                  <button
                    onClick={() => goTo(-1)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:text-white transition-all active:scale-90"
                    aria-label="Producto anterior de la marca"
                  >
                    <Icon name="chevronLeft" className="w-5 h-5" />
                  </button>
                  <span className="text-xs font-bold text-teal-300 px-2">
                    {currentIndex + 1}/{totalInBrand} · {product.brand}
                  </span>
                  <button
                    onClick={() => goTo(1)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:text-white transition-all active:scale-90"
                    aria-label="Siguiente producto de la marca"
                  >
                    <Icon name="chevronRight" className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
            <button
              onClick={() => setShowFullscreen(false)}
              className="p-2 rounded-full bg-slate-800 text-slate-200 hover:text-white transition-all active:scale-90"
              aria-label="Cerrar imagen en pantalla completa"
            >
              <Icon name="x" className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center px-2 pb-6 min-h-0">
            <img
              src={product.image}
              alt={product.name}
              className="max-w-full max-h-full object-contain select-none"
              draggable={false}
            />
          </div>

          <div className="px-4 pb-6 text-center shrink-0">
            <p className="text-sm font-bold text-white line-clamp-1">{product.name}</p>
            {product.brand && <p className="text-xs text-teal-400 mt-0.5">{product.brand}</p>}
            {hasSameBrand && (
              <p className="text-[10px] text-slate-500 mt-1">Desliza para ver más productos de {product.brand}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function IdentityModal({ knownCustomers, savedCustomer, onConfirm, onConfirmBiometric, onGoToAdmin, isCurrentAdmin, mode = 'login', confirmKind = 'switchback', onClose }) {
  const [customerName, setCustomerName] = useState('');
  const [phoneCode, setPhoneCode] = useState('0412');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [errors, setErrors] = useState({});
  const [isWorking, setIsWorking] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'webauthn'
  const [webAuthnStep, setWebAuthnStep] = useState(''); // '' | 'login' | 'register'
  const [webauthnError, setWebauthnError] = useState('');
  const [webauthnSupported, setWebauthnSupported] = useState(true);
  const [registerMode, setRegisterMode] = useState(false);
  const [remember, setRemember] = useState(false);
  const [panel, setPanel] = useState(mode === 'confirm' ? 'confirm' : 'login'); // 'login' | 'confirm'
  const [confirmKindState, setConfirmKindState] = useState(confirmKind);

  // Soporte WebAuthn (huella / Face ID)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = browserSupportsWebAuthn();
      let platformOk = false;
      if (supported) {
        try { platformOk = await platformAuthenticatorIsAvailable(); } catch { platformOk = false; }
      }
      if (!cancelled) setWebauthnSupported(supported && platformOk);
    })();
    return () => { cancelled = true; };
  }, []);

  // "Recordarme": precarga los campos del último login recordado (no los vacía).
  useEffect(() => {
    const mem = loadLoginMemory();
    if (mem) {
      setCustomerName(mem.customerName || '');
      setPhoneCode(mem.phoneCode || '0412');
      setPhoneNumber(mem.phoneNumber || '');
      setRemember(true);
    }
  }, []);

  // Autocompleta el nombre cuando el teléfono ya está registrado (historial),
  // sin interferir con el nombre que el usuario escriba manualmente.
  const phoneKey = `${phoneCode}${phoneNumber}`.replace(/\D/g, '').slice(-11);
  useEffect(() => {
    if (phoneNumber.length < 7) return;
    const match = (knownCustomers || []).find((c) => normalizePhoneDigits(c.phone) === phoneKey);
    if (match && match.name && !customerName.trim()) {
      setCustomerName(match.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneCode, phoneNumber, knownCustomers]);

  const handlePhoneNumber = (value) => {
    setPhoneNumber(value.replace(/\D/g, '').slice(0, 7));
  };

  // Interruptor "Recordarme": al activarlo guarda los campos; al desactivarlo los limpia.
  const toggleRemember = (on) => {
    setRemember(on);
    if (on) {
      saveLoginMemory({ customerName: customerName.trim(), phoneCode, phoneNumber });
    } else {
      clearLoginMemory();
    }
  };

  // Persiste (o limpia) los campos según el estado de "Recordarme" al iniciar sesión.
  const persistRemember = () => {
    if (remember) {
      saveLoginMemory({ customerName: customerName.trim(), phoneCode, phoneNumber });
    } else {
      clearLoginMemory();
    }
  };

  // Determina si el teléfono ya tiene biometría registrada
  const hasRegisteredBiometry = async (phoneKey) => {
    const res = await api.webauthnLoginOptions({ phone: phoneKey });
    if (res.ok) return true;
    if (res.status === 404) return false;
    throw new Error(res.data.error || 'No se pudo consultar tu registro biométrico');
  };

  const registerBiometry = async (phoneKey, customerName) => {
    setWebAuthnStep('register');
    const res = await api.webauthnRegisterOptions({ phone: phoneKey, customerName: customerName.trim() });
    if (!res.ok) throw new Error(res.data.error || 'No se pudo iniciar el registro');
    const regResponse = await startRegistration({ optionsJSON: res.data.options });
    const verifyRes = await api.webauthnRegisterVerify({ phone: phoneKey, response: regResponse });
    if (!verifyRes.ok) throw new Error(verifyRes.data.error || 'No se pudo guardar tu biometría');
  };

  // Login o registro con biometría. Si no hay credencial previa, la registra en
  // el momento (primera vez en este dispositivo/dominio).
  const authenticateWithBiometry = async ({ phoneKey, customerName }) => {
    const hasBio = await hasRegisteredBiometry(phoneKey);
    if (hasBio) {
      setWebAuthnStep('login');
      const res = await api.webauthnLoginOptions({ phone: phoneKey });
      if (!res.ok) throw new Error(res.data.error || 'No se pudo iniciar la verificación');
      try {
        const authResponse = await startAuthentication({ optionsJSON: res.data.options });
        const verifyRes = await api.webauthnLoginVerify({ phone: phoneKey, response: authResponse });
        if (!verifyRes.ok) throw new Error(verifyRes.data.error || 'La biometría no coincidió');
      } catch (authErr) {
        // rpID distinto (dominio anterior): re-registra en el dominio actual.
        const isRpidMismatch = authErr?.name === 'NotAllowedError';
        if (!isRpidMismatch) throw authErr;
        await registerBiometry(phoneKey, customerName);
      }
    } else {
      await registerBiometry(phoneKey, customerName);
    }
  };

  // Flujo del formulario (login o registro nuevo).
  const runWebAuthn = async () => {
    if (!webauthnSupported) {
      setStep('form');
      setWebauthnError('Tu dispositivo no soporta biometría. Usa un celular actualizado con huella o Face ID.');
      return;
    }
    setWebauthnError('');
    setStep('webauthn');
    setIsWorking(true);
    try {
      await authenticateWithBiometry({ phoneKey, customerName });
      setIsWorking(false);
      persistRemember();
      onConfirm({ customerName: customerName.trim(), phoneCode, phoneNumber });
    } catch (err) {
      setIsWorking(false);
      setWebauthnError(friendlyAuthError(err));
      setStep('form');
    }
  };

  // Botón de biometría del formulario: exige el número antes de continuar.
  const handleBiometricAction = () => {
    if (!/^\d{7}$/.test(phoneNumber)) {
      setErrors((prev) => ({ ...prev, phone: 'Ingresa los 7 dígitos del número para verificar con biometría' }));
      return;
    }
    runWebAuthn();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!customerName.trim()) newErrors.customerName = 'Ingresa tu nombre';
    if (!/^\d{7}$/.test(phoneNumber)) newErrors.phone = 'Ingresa los 7 dígitos del número';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    await runWebAuthn();
  };

  // Confirmación solo-biometría (volver al cliente actual / cerrar sesión):
  // NO vuelve a pedir nombre ni teléfono, solo huella o Face ID.
  const handleConfirmBiometric = async () => {
    const phone = savedCustomer?.phoneNumber || phoneNumber;
    const code = savedCustomer?.phoneCode || phoneCode;
    const name = savedCustomer?.customerName || customerName.trim();
    if (!/^\d{7}$/.test(phone)) {
      setWebauthnError('No hay un usuario activo para confirmar.');
      return;
    }
    if (!webauthnSupported) {
      setWebauthnError('Tu dispositivo no soporta biometría. Usa un celular actualizado con huella o Face ID.');
      return;
    }
    setWebauthnError('');
    setStep('webauthn');
    setIsWorking(true);
    const confirmKey = `${code}${phone}`.replace(/\D/g, '').slice(-11);
    try {
      await authenticateWithBiometry({ phoneKey: confirmKey, customerName: name });
      setIsWorking(false);
      onConfirmBiometric(confirmKindState);
    } catch (err) {
      setIsWorking(false);
      setWebauthnError(friendlyAuthError(err));
      setStep('form');
    }
  };

  const resetForm = () => {
    setStep('form');
    setWebAuthnStep('');
    setWebauthnError('');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
      <div className="relative w-full sm:max-w-md bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden z-10 animate-screen-up max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="relative p-5 sm:p-7 border-b border-slate-800 text-center">
          {(savedCustomer?.customerName || panel === 'confirm') && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <Icon name="x" className="w-5 h-5" />
            </button>
          )}
          <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-slate-950 shadow-lg shadow-teal-500/25">
            <Icon name={panel === 'confirm' && confirmKindState === 'logout' ? 'logOut' : 'user'} className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <h2 className="text-lg sm:text-xl font-black text-white mt-3">
            {panel === 'confirm'
              ? confirmKindState === 'logout'
                ? 'Cerrar sesión'
                : `Volver a ${savedCustomer?.customerName?.split(' ')[0] || 'tu cuenta'}`
              : registerMode
              ? 'Crea tu cuenta'
              : savedCustomer?.customerName
              ? 'Cambiar de usuario'
              : 'Bienvenido a Empresas Alvarados'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {panel === 'confirm'
              ? 'Confirma tu identidad con biometría para continuar.'
              : registerMode
              ? 'Regístrate en segundos con tu teléfono y biometría. El nombre se autocompleta en tus próximos accesos.'
              : 'Identifícate para pedir. Tu teléfono + biometría es tu tarjeta de cliente.'}
          </p>
        </div>

        {panel === 'confirm' ? (
          step === 'form' ? (
            <div className="p-5 sm:p-7 space-y-4">
              <button
                type="button"
                onClick={handleConfirmBiometric}
                disabled={isWorking}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-slate-800/70 border border-teal-500/30 hover:border-teal-400/60 hover:bg-slate-700/60 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="p-2 rounded-xl bg-teal-500/20 text-teal-400 shrink-0">
                  {IS_IOS ? (
                    <span className="flex items-center gap-1">
                      <Icon name="apple" className="w-4 h-4" />
                      <Icon name="faceId" className="w-4 h-4" />
                    </span>
                  ) : (
                    <Icon name="fingerprint" className="w-5 h-5" />
                  )}
                </span>
                <span className="flex-1 text-left">
                  <span className="block text-[11px] font-bold text-teal-300">Confirmar con biometría</span>
                  <span className="block text-[11px] text-slate-400 leading-snug">
                    {IS_IOS ? 'Usa tu Face ID' : 'Usa tu huella'}
                    {!webauthnSupported && <span className="text-rose-400"> · Tu dispositivo no lo soporta</span>}
                  </span>
                </span>
                <Icon name="arrowRight" className="w-4 h-4 text-teal-400 shrink-0" />
              </button>

              {webauthnError && (
                <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5">{webauthnError}</p>
              )}

              {confirmKindState === 'logout' && (
                <button
                  type="button"
                  onClick={() => onConfirmBiometric('logout')}
                  className="w-full py-2 text-[11px] text-slate-500 hover:text-rose-300 transition-colors"
                >
                  Prefiero salir sin biometría
                </button>
              )}
            </div>
          ) : (
            <div className="p-8 sm:p-10 flex flex-col items-center text-center space-y-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-slate-950 shadow-xl shadow-teal-500/30 animate-pulse">
                  <Icon name={webAuthnStep === 'login' ? 'user' : 'check'} className="w-10 h-10" />
                </div>
                <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-4 border-slate-900 flex items-center justify-center">
                  <Icon name="check" className="w-3 h-3 text-slate-950" />
                </span>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {webAuthnStep === 'login' ? 'Confirma tu identidad' : 'Registra tu biometría'}
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {webAuthnStep === 'login'
                    ? 'Usa tu huella o Face ID para confirmar que eres tú.'
                    : 'Usa tu huella o Face ID una vez. La próxima vez te reconoceremos al instante.'}
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                disabled={isWorking}
                className="text-xs text-slate-500 hover:text-teal-300 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          )
        ) : step === 'form' ? (
          <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-4">
            {/* Teléfono primero (el nombre se autocompleta si ya está registrado) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Teléfono / WhatsApp *</label>
              <div className="flex gap-2">
                <select
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                  className="w-24 shrink-0 px-3 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm font-bold focus:border-teal-500 focus:outline-none"
                >
                  {PHONE_CODES.map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phoneNumber}
                  onChange={(e) => handlePhoneNumber(e.target.value)}
                  placeholder="1234567"
                  maxLength={7}
                  autoFocus={!savedCustomer?.customerName}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
              {errors.phone && <p className="text-xs text-rose-400 mt-1">{errors.phone}</p>}
            </div>

            {/* Nombre */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Tu Nombre *</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ej: Juan Pérez"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
              />
              {errors.customerName && <p className="text-xs text-rose-400 mt-1">{errors.customerName}</p>}
            </div>

            {/* Recordarme: conserva los campos para el próximo login */}
            <button
              type="button"
              onClick={() => toggleRemember(!remember)}
              className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-800/50 border border-slate-700/70 hover:border-teal-500/40 transition-all"
            >
              <span className="flex items-center gap-2.5">
                <span className={`p-1.5 rounded-lg transition-all ${remember ? 'bg-teal-500/25 text-teal-400' : 'bg-slate-700/50 text-slate-500'}`}>
                  <Icon name="check" className="w-3.5 h-3.5" />
                </span>
                <span className="text-left">
                  <span className="block text-xs font-semibold text-slate-200">Recordarme</span>
                  <span className="block text-[10px] text-slate-500">Conservo estos datos para tu próxima visita</span>
                </span>
              </span>
              <span className={`relative w-11 h-6 rounded-full transition-all shrink-0 ${remember ? 'bg-teal-500' : 'bg-slate-700'}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${remember ? 'left-5' : 'left-0.5'}`} />
              </span>
            </button>

            {/* Botón de biometría accionable (huella / Face ID) */}
            <button
              type="button"
              onClick={handleBiometricAction}
              disabled={isWorking}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-slate-800/70 border border-teal-500/30 hover:border-teal-400/60 hover:bg-slate-700/60 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="p-2 rounded-xl bg-teal-500/20 text-teal-400 shrink-0">
                {IS_IOS ? (
                  <span className="flex items-center gap-1">
                    <Icon name="apple" className="w-4 h-4" />
                    <Icon name="faceId" className="w-4 h-4" />
                  </span>
                ) : (
                  <Icon name="fingerprint" className="w-5 h-5" />
                )}
              </span>
              <span className="flex-1 text-left">
                <span className="block text-[11px] font-bold text-teal-300">Verificar con biometría</span>
                <span className="block text-[11px] text-slate-400 leading-snug">
                  {IS_IOS ? 'Usa tu Face ID' : 'Usa tu huella'}
                  {!webauthnSupported && <span className="text-rose-400"> · Tu dispositivo no lo soporta</span>}
                </span>
              </span>
              <Icon name="arrowRight" className="w-4 h-4 text-teal-400 shrink-0" />
            </button>

            {webauthnError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5">{webauthnError}</p>
            )}

            {/* Acciones */}
            <div className="space-y-2.5 pt-1">
              <button
                type="submit"
                disabled={isWorking}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-sm hover:from-teal-400 hover:to-emerald-400 shadow-xl shadow-teal-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Icon name="check" className="w-4 h-4" />
                {registerMode ? 'Crear mi cuenta' : 'Entrar a Empresas Alvarados'}
              </button>
              {registerMode ? (
                <button
                  type="button"
                  onClick={() => setRegisterMode(false)}
                  className="w-full py-2.5 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-700/70 transition-all"
                >
                  ¿Ya tienes cuenta? Iniciar sesión
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setRegisterMode(true)}
                  className="w-full py-2.5 rounded-2xl bg-slate-800 border border-slate-700 text-teal-300 text-xs font-semibold hover:bg-slate-700/70 transition-all"
                >
                  ¿Primera vez? Regístrate
                </button>
              )}
              {savedCustomer?.customerName && (
                <button
                  type="button"
                  onClick={() => { setConfirmKindState('switchback'); setPanel('confirm'); }}
                  className="w-full py-2.5 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-700/70 transition-all"
                >
                  Volver a {savedCustomer.customerName.split(' ')[0]}
                </button>
              )}
              {(isCurrentAdmin || ADMIN_PHONES.includes(`${phoneCode}${phoneNumber}`.replace(/\D/g, '').slice(-11))) && (
                <button
                  type="button"
                  onClick={onGoToAdmin}
                  className="w-full py-2 text-[11px] text-slate-500 hover:text-teal-300 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Icon name="layers" className="w-3.5 h-3.5" />
                  ¿Eres el administrador? Ir al panel
                </button>
              )}
            </div>
          </form>
        ) : (
          <div className="p-8 sm:p-10 flex flex-col items-center text-center space-y-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-slate-950 shadow-xl shadow-teal-500/30 animate-pulse">
                {webAuthnStep === 'login' ? (
                  <Icon name="user" className="w-10 h-10" />
                ) : (
                  <Icon name="check" className="w-10 h-10" />
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-4 border-slate-900 flex items-center justify-center">
                <Icon name="check" className="w-3 h-3 text-slate-950" />
              </span>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {webAuthnStep === 'login' ? 'Confirma tu identidad' : 'Registra tu biometría'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {webAuthnStep === 'login'
                  ? 'Usa tu huella o Face ID para confirmar que eres tú.'
                  : 'Usa tu huella o Face ID una vez. La próxima vez te reconoceremos al instante.'}
              </p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              disabled={isWorking}
              className="text-xs text-slate-500 hover:text-teal-300 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CartDrawer({ isOpen, onClose, cart, cartTotal, rate, onUpdateQty, onRemove, onProceedToCheckout }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-end bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full sm:max-w-md bg-slate-900 sm:h-full h-[92dvh] sm:border-l border-t sm:border-t-0 border-slate-800 shadow-2xl flex flex-col z-10 sm:animate-slide-left animate-screen-up">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
              <Icon name="shoppingBag" className="w-5 h-5" />
            </span>
            <h2 className="text-base sm:text-lg font-bold text-white">Tu Carrito</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body - Items list */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 sm:space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 text-slate-500">
              <Icon name="shoppingBag" className="w-16 h-16 stroke-1 text-slate-700" />
              <p className="font-semibold text-slate-400">Tu carrito está vacío</p>
              <p className="text-xs">Agrega algunos productos del catálogo para comenzar.</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product.id}
                className="flex items-center gap-3 sm:gap-4 p-3 sm:p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 group hover:border-slate-600 transition-all"
              >
                <img
                  src={item.product.image}
                  alt={item.product.name}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover bg-slate-900 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-200 text-xs sm:text-sm truncate">
                    {item.product.name}
                  </h4>
                  <span className="text-xs text-teal-400 font-semibold block mt-1">
                    {formatUsd(item.product.price)} c/u
                    {rate?.rate > 0 && (
                      <span className="block text-[10px] text-slate-400 font-medium">
                        {formatBs(usdToBs(item.product.price, rate.rate))} c/u
                      </span>
                    )}
                  </span>

                  {/* Quantity bar */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
                      <button
                        onClick={() => onUpdateQty(item.product.id, -1)}
                        className="p-1 rounded text-slate-400 hover:text-white"
                      >
                        <Icon name="minus" className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold w-5 text-center text-white">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQty(item.product.id, 1)}
                        className="p-1 rounded text-slate-400 hover:text-white"
                      >
                        <Icon name="plus" className="w-3 h-3" />
                      </button>
                    </div>

<button
                      onClick={() => onRemove(item.product.id)}
                      className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors ml-auto"
                      title="Eliminar del carrito"
                    >
                      <Icon name="trash" className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer Summary */}
        {cart.length > 0 && (
          <div
            className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/90 space-y-4 shrink-0"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Subtotal</span>
                <span>
                  {formatUsd(cartTotal)}
                  {rate?.rate > 0 && (
                    <span className="block text-[10px] text-slate-500 text-right">
                      {formatBs(usdToBs(cartTotal, rate.rate))}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Costo de preparación</span>
                <span className="text-teal-400 font-semibold">¡GRATIS!</span>
              </div>
              <div className="flex justify-between text-base font-black text-white pt-2 border-t border-slate-800">
                <span>Total a Pagar</span>
                <span className="text-teal-400 text-right">
                  {formatUsd(cartTotal)}
                  {rate?.rate > 0 && (
                    <span className="block text-[11px] text-teal-300/90">
                      {formatBs(usdToBs(cartTotal, rate.rate))}
                    </span>
                  )}
                </span>
              </div>
            </div>

            <button
              onClick={onProceedToCheckout}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-sm hover:from-teal-400 hover:to-emerald-400 shadow-xl shadow-teal-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span>Confirmar y Elegir Forma de Pago</span>
              <Icon name="check" className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Drawer de Mis Pedidos (mismo patrón que el carrito: ante menú inferior, X para cerrar)
function OrdersDrawer({ isOpen, onClose, orders, rate, onViewOrderDetail, onTrackLiveOrder, onRequestCancelOrder }) {
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState({ preset: 'all', date: null });
  const [showCalendar, setShowCalendar] = useState(false);
  const PAGE_SIZE = 6;

  const filtered = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const dow = (todayStart.getDay() + 6) % 7; // 0 = Monday
    const thisMon = new Date(todayStart); thisMon.setDate(thisMon.getDate() - dow);
    const thisSun = new Date(thisMon); thisSun.setDate(thisSun.getDate() + 6);
    const lastMon = new Date(thisMon); lastMon.setDate(lastMon.getDate() - 7);
    const lastSun = new Date(thisMon); lastSun.setDate(lastSun.getDate() - 1);
    return (orders || []).filter((o) => {
      const d = parseOrderDate(o);
      if (isNaN(d)) return true;
      switch (dateFilter.preset) {
        case 'today': return startOfDay(d).getTime() === todayStart.getTime();
        case 'thisWeek': return d >= thisMon && d <= thisSun;
        case 'lastWeek': return d >= lastMon && d <= lastSun;
        case 'day': return dateFilter.date && toYMD(d) === dateFilter.date;
        default: return true;
      }
    });
  }, [orders, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [dateFilter]);
  useEffect(() => { if (isOpen) { setPage(1); setDateFilter({ preset: 'all', date: null }); } }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-end bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full sm:max-w-md bg-slate-900 sm:h-full h-[92dvh] sm:border-l border-t sm:border-t-0 border-slate-800 shadow-2xl flex flex-col z-10 sm:animate-slide-left animate-screen-up">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
              <Icon name="package" className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Mis Pedidos</h2>
              <span className="block text-[11px] text-slate-400">{orders?.length || 0} pedido{(orders?.length || 0) !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {(!orders || orders.length === 0) ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 text-slate-500">
              <Icon name="package" className="w-16 h-16 stroke-1 text-slate-700" />
              <p className="font-semibold text-slate-400">Todavía no tienes pedidos</p>
              <p className="text-xs">Haz tu primer pedido y aparecerá aquí.</p>
            </div>
          ) : (
            <>
              {/* Filtros de fecha */}
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { key: 'all', label: 'Todos' },
                    { key: 'today', label: 'Hoy' },
                    { key: 'thisWeek', label: 'Esta semana' },
                    { key: 'lastWeek', label: 'Semana anterior' }
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setDateFilter({ preset: f.key, date: null })}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                        dateFilter.preset === f.key
                          ? 'bg-teal-500 text-slate-950 shadow-sm'
                          : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-700/60'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                  <div className="relative">
                    <button
                      onClick={() => setShowCalendar(!showCalendar)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-300 text-[11px] font-medium hover:bg-slate-700/60 flex items-center gap-1.5"
                    >
                      <Icon name="filter" className="w-3.5 h-3.5" />
                      {dateFilter.preset === 'day' && dateFilter.date ? dateFilter.date : 'Calendario'}
                    </button>
                    {showCalendar && (
                      <MiniCalendar
                        value={dateFilter.date}
                        onChange={(d) => { setDateFilter({ preset: 'day', date: d }); setShowCalendar(false); }}
                        onClose={() => setShowCalendar(false)}
                      />
                    )}
                  </div>
                </div>

                {/* Paginación */}
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                  <span>
                    Mostrando {paged.length > 0 ? ((safePage - 1) * PAGE_SIZE + 1) : 0}–{Math.min(safePage * PAGE_SIZE, filtered.length)} de {filtered.length}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                      className="px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700/60"
                    >
                      <Icon name="minus" className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 font-semibold text-white">{safePage} / {totalPages}</span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                      className="px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700/60"
                    >
                      <Icon name="plus" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Lista de pedidos */}
              {paged.length === 0 ? (
                <div className="text-center py-8 space-y-2 text-slate-500">
                  <Icon name="search" className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs font-semibold text-slate-400">No hay pedidos en este filtro</p>
                </div>
              ) : (
                paged.map((o) => {
                  const style = STATUS_STYLES[o.status] || STATUS_STYLES.pendiente;
                  const cancellable = o.status === 'pendiente' || o.status === 'en_preparacion';
                  return (
                    <div key={o.id} className="p-3 rounded-xl sm:rounded-2xl bg-slate-900/60 border border-slate-700/50">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm font-bold text-white">
                          Pedido <span className="text-teal-400">#{o.id}</span>
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${style.badge}`}>
                          {STATUS_LABELS[o.status] || 'Pendiente'}
                        </span>
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1">
                        {o.timestamp} · {o.items.length} artículo{o.items.length !== 1 ? 's' : ''} · {formatUsd(o.total)}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
                        {o.type === 'delivery' ? `Envío a ${o.address || 'domicilio'}` : 'Retiro en tienda'}
                      </p>
                      <div className="flex items-center gap-2 mt-2.5">
                        <button
                          onClick={() => onViewOrderDetail(o)}
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold hover:bg-cyan-500/25 transition-all flex items-center justify-center gap-1"
                        >
                          <Icon name="eye" className="w-3 h-3" />
                          Ver detalle
                        </button>
                        {o.type === 'delivery' && o.status !== 'cancelado' && o.status !== 'entregado' && (
                          <button
                            onClick={() => onTrackLiveOrder(o)}
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1"
                          >
                            <Icon name="mapPin" className="w-3 h-3" />
                            Rastrear
                          </button>
                        )}
                        {cancellable && (
                          <button
                            onClick={() => onRequestCancelOrder(o)}
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-bold hover:bg-rose-500/25 transition-all flex items-center justify-center gap-1"
                          >
                            <Icon name="x" className="w-3 h-3" />
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CartFloatBar({ cartCount, cartTotal, rate, onOpen }) {
  return (
    <button
      data-cart-target
      onClick={onOpen}
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      className="fixed bottom-[4.6rem] sm:bottom-4 left-0 right-0 sm:left-1/2 sm:-translate-x-1/2 sm:w-[calc(100%-2rem)] sm:max-w-lg z-40 px-4 sm:px-5 pt-3.5 sm:pt-4 bg-slate-950/90 sm:rounded-3xl border-t sm:border border-teal-500/40 shadow-2xl shadow-teal-500/20 backdrop-blur-xl flex items-center justify-between gap-4 animate-screen-up hover:border-teal-400/60 transition-all group"
    >
      <div className="flex items-center gap-2.5 sm:gap-3">
        <span className="relative p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-teal-500/15 text-teal-400">
          <Icon name="shoppingBag" className="w-5 h-5" />
          <span key={cartCount} className="absolute -top-1 -right-1 bg-teal-400 text-slate-950 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-badge-pop">
            {cartCount}
          </span>
        </span>
        <div className="text-left min-w-0">
          <span className="block text-[11px] text-slate-400 font-semibold">
            {cartCount} {cartCount === 1 ? 'producto' : 'productos'}
          </span>
          <span className="block text-base sm:text-lg font-black text-white truncate">
            {formatUsd(cartTotal)}
            {rate?.rate > 0 && (
              <span className="text-[10px] sm:text-[11px] font-bold text-teal-300/90 ml-1.5 sm:ml-2">
                {formatBs(usdToBs(cartTotal, rate.rate))}
              </span>
            )}
          </span>
        </div>
      </div>
      <span className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-teal-500/20 group-hover:from-teal-400 group-hover:to-emerald-400 transition-all flex items-center gap-1.5 shrink-0">
        Ver
        <Icon name="arrowRight" className="w-4 h-4" />
      </span>
    </button>
  );
}

// Barra de navegación inferior fija (solo móvil). Ofrece acceso a una mano a
// Tienda, Carrito, Mis Pedidos, Mi Cuenta y al Panel. En vista admin muestra
// los accesos principales del panel.
function BottomTabBar({
  activeView,
  customerTab,
  onCustomerTab,
  cartCount,
  hasCustomer,
  isAdmin,
  onOpenCart,
  onGoAdmin,
  onGoStore,
  onCustomerLogout,
  adminTab,
  onAdminTab,
  pendingOrders,
  onLogout,
  isAdminAuthed
}) {
  const base =
    'flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 flex-1 min-w-0 rounded-2xl transition-all duration-300 active:scale-95';
  const activeTab =
    'bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-lg shadow-teal-500/10';
  const idleTab = 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 border border-transparent';

  const customerTabs = [
    {
      key: 'store',
      label: 'Tienda',
      icon: 'home',
      onClick: onGoStore,
      badge: null
    },
    {
      key: 'cart',
      label: 'Carrito',
      icon: 'bag',
      onClick: onOpenCart,
      badge: cartCount > 0 ? cartCount : null
    },
    {
      key: 'orders',
      label: 'Mis Pedidos',
      icon: 'list',
      onClick: () => {
        if (!hasCustomer) {
          onOpenCart(); // el checkout/identidad obliga a identificarse
          return;
        }
        onCustomerTab('orders');
      },
      badge: null
    },
    {
      key: 'account',
      label: 'Mi Cuenta',
      icon: 'user',
      onClick: () => {
        if (!hasCustomer) {
          onOpenCart();
          return;
        }
        onCustomerTab('account');
      },
      badge: null
    }
  ];

  const adminTabs = [
    { key: 'inventory', label: 'Inventario', icon: 'package', onClick: () => onAdminTab('inventory'), badge: null },
    { key: 'orders', label: 'Pedidos', icon: 'clock', onClick: () => onAdminTab('orders'), badge: pendingOrders > 0 ? pendingOrders : null },
    { key: 'benefited', label: 'Beneficiados', icon: 'users', onClick: () => onAdminTab('benefited'), badge: null },
    { key: 'blacklist', label: 'Lista Negra', icon: 'alertTriangle', onClick: () => onAdminTab('blacklist'), badge: null },
    { key: 'analytics', label: 'Estadísticas', icon: 'trendingUp', onClick: () => onAdminTab('analytics'), badge: null }
  ];

  const tabs = activeView === 'admin' && isAdminAuthed ? adminTabs : customerTabs;

  // En vista cliente: si el tab actual es orders/account y el usuario tocó esa
  // sección, se marca activo. Carrito siempre "activo" mientras tenga items.
  const isTabActive = (t) => {
    if (activeView === 'admin' && isAdminAuthed) return adminTab === t.key;
    if (t.key === 'cart') return cartCount > 0;
    return customerTab === t.key;
  };

  // En el login admin (admin sin autenticar) no se muestran opciones de navegación.
  if (activeView === 'admin' && !isAdminAuthed) return null;

  return (
    <nav
      style={{ paddingBottom: 'max(0.4rem, env(safe-area-inset-bottom))' }}
      className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/80 flex items-stretch gap-1 px-2 pt-2 pb-1 animate-screen-up"
      aria-label="Navegación principal"
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={t.onClick}
          className={`${base} ${isTabActive(t) ? activeTab : idleTab}`}
          aria-label={t.label}
        >
          <span className="relative">
            <Icon name={t.icon} className="w-5 h-5" />
            {t.badge != null && (
              <span
                key={`${t.key}-${t.badge}`}
                className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[9px] font-black min-w-4 h-4 px-1 rounded-full flex items-center justify-center animate-badge-pop"
              >
                {t.badge}
              </span>
            )}
          </span>
          <span className="text-[10px] font-bold leading-none truncate">{t.label}</span>
        </button>
      ))}
      {activeView === 'customer' && isAdmin && (
        <button
          onClick={onGoAdmin}
          className={`${base} text-cyan-400 hover:text-cyan-300 ${idleTab}`}
          aria-label="Ir al panel de administración"
        >
          <Icon name="layers" className="w-5 h-5" />
          <span className="text-[10px] font-bold leading-none">Panel</span>
        </button>
      )}
      {activeView === 'customer' && hasCustomer && (
        <button
          onClick={onCustomerLogout}
          className={`${base} text-rose-400 hover:text-rose-300 ${idleTab}`}
          aria-label="Cerrar sesión"
        >
          <Icon name="logOut" className="w-5 h-5" />
          <span className="text-[10px] font-bold leading-none">Salir</span>
        </button>
      )}
      {activeView === 'admin' && isAdminAuthed && (
        <button
          onClick={onLogout}
          className={`${base} text-rose-400 hover:text-rose-300 ${idleTab}`}
          aria-label="Cerrar sesión"
        >
          <Icon name="x" className="w-5 h-5" />
          <span className="text-[10px] font-bold leading-none">Salir</span>
        </button>
      )}
    </nav>
  );
}

// Marcador Leaflet personalizado (divIcon con SVG inline) para no depender de
// imágenes externas. Evita que Leaflet intente cargar sus iconos por defecto.
const makePinIcon = (color, label) =>
  L.divIcon({
    className: '',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))">
        <span style="font-size:10px;font-weight:800;color:${color};background:#0f172a;border:1px solid ${color};border-radius:999px;padding:0 6px;white-space:nowrap">${label || ''}</span>
        <svg width="26" height="34" viewBox="0 0 26 34" style="overflow:visible">
          <path d="M13 1C6.4 1 1 6.4 1 13c0 8.8 12 20 12 20s12-11.2 12-20C25 6.4 19.6 1 13 1z" fill="${color}" stroke="#fff" stroke-width="2"/>
          <circle cx="13" cy="13" r="4.5" fill="#fff"/>
        </svg>
      </div>`,
    iconSize: [26, 44],
    iconAnchor: [13, 42]
  });

// Mapa interactivo (Leaflet + OpenStreetMap, sin API key) para la entrega a
// domicilio. Muestra el comercio (origen), el destino del cliente, la posición
// en vivo del repartidor y el camino sugerido repartidor → destino (OSRM).
function DeliveryMap({ order, storeLocation }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerGroupRef = useRef(null);
  const fittedRef = useRef(false);
  const courierMarkerRef = useRef(null);
  const routeRef = useRef(null);

  const dest = order && order.lat != null && order.lng != null;
  const courier = order && order.courier_lat != null && order.courier_lng != null;
  const store = storeLocation && storeLocation.lat != null && storeLocation.lng != null;
  const showMap = order && order.type === 'delivery' && (dest || courier || store);

  // Crea el mapa una sola vez.
  useEffect(() => {
    if (!showMap || !containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    mapRef.current = map;
    layerGroupRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      fittedRef.current = false;
      courierMarkerRef.current = null;
      routeRef.current = null;
    };
  }, [showMap]);

  // Dibuja/actualiza marcadores y ruta cuando cambian los datos. El viewport
  // solo se ajusta la primera vez (o si aún no hay repartidor); después el mapa
  // conserva el zoom y el desplazamiento que el usuario estableció, y cuando el
  // repartidor sale de la vista se centra suavemente en él sin cambiar el zoom.
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    const pts = [];
    if (store) pts.push({ lat: Number(storeLocation.lat), lng: Number(storeLocation.lng), kind: 'store' });
    if (dest) pts.push({ lat: Number(order.lat), lng: Number(order.lng), kind: 'dest' });
    if (courier) pts.push({ lat: Number(order.courier_lat), lng: Number(order.courier_lng), kind: 'courier' });

    // Marcadores estáticos (comercio y destino) se recrean; el del repartidor se
    // reutiliza para no parpadear ni resetear el mapa en cada update.
    layerGroup.clearLayers();
    let courierMarker = courierMarkerRef.current;
    pts.forEach((m) => {
      const icon =
        m.kind === 'courier'
          ? makePinIcon('#10b981', 'REPARTIDOR')
          : m.kind === 'store'
          ? makePinIcon('#22d3ee', 'COMERCIO')
          : makePinIcon('#f43f5e', 'DESTINO');
      if (m.kind === 'courier') {
        if (!courierMarker) {
          courierMarker = L.marker([m.lat, m.lng], { icon }).addTo(layerGroup);
          courierMarkerRef.current = courierMarker;
        } else {
          courierMarker.setLatLng([m.lat, m.lng]);
          courierMarker.setIcon(icon);
          courierMarker.addTo(layerGroup);
        }
      } else {
        L.marker([m.lat, m.lng], { icon }).addTo(layerGroup);
      }
    });

    // Ruta (línea recta provisional → OSRM cuando responde).
    if (routeRef.current) {
      layerGroup.removeLayer(routeRef.current);
      routeRef.current = null;
    }
    if (courier && dest) {
      routeRef.current = L.polyline(
        [
          [Number(order.courier_lat), Number(order.courier_lng)],
          [Number(order.lat), Number(order.lng)]
        ],
        { color: '#10b981', weight: 3, dashArray: '6 6', opacity: 0.7 }
      ).addTo(layerGroup);
      const url = `https://router.project-osrm.org/route/v1/driving/${Number(order.courier_lng)},${Number(order.courier_lat)};${Number(order.lng)},${Number(order.lat)}?overview=full&geometries=geojson`;
      fetch(url)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => {
          const coords = data?.routes?.[0]?.geometry?.coordinates;
          if (!Array.isArray(coords) || coords.length < 2) return;
          if (routeRef.current) layerGroup.removeLayer(routeRef.current);
          const poly = L.polyline(
            coords.map((c) => [c[1], c[0]]),
            { color: '#10b981', weight: 5, opacity: 0.9 }
          ).addTo(layerGroup);
          routeRef.current = poly;
        })
        .catch(() => {});
    }

    // Ajuste de viewport: solo en el primer render (o cuando aún no hay
    // repartidor en vivo). No se vuelve a llamar en cada update del rastreo.
    const shouldFit = !fittedRef.current || !courier;
    if (pts.length && shouldFit) {
      const latLngs = pts.map((p) => [p.lat, p.lng]);
      map.fitBounds(L.latLngBounds(latLngs).pad(0.25), { animate: false });
      fittedRef.current = true;
    } else if (courier) {
      // Sigue al repartidor: si salió del viewport actual, lo centra con pan
      // suave SIN cambiar el zoom que el usuario dejó.
      const courierLatLng = L.latLng(Number(order.courier_lat), Number(order.courier_lng));
      if (!map.getBounds().contains(courierLatLng)) {
        map.panTo(courierLatLng, { animate: true, duration: 0.5 });
      }
    }
  }, [courier, dest, store, storeLocation?.lat, storeLocation?.lng, order?.lat, order?.lng, order?.courier_lat, order?.courier_lng]);

  const destUrl = dest ? `https://www.google.com/maps?q=${Number(order.lat)},${Number(order.lng)}` : null;
  const courierUrl = courier ? `https://www.google.com/maps?q=${Number(order.courier_lat)},${Number(order.courier_lng)}` : null;
  const storeUrl = store ? `https://www.google.com/maps?q=${Number(storeLocation.lat)},${Number(storeLocation.lng)}` : null;

  if (!showMap) return null;

  return (
    <div className="space-y-2">
      <div className="rounded-2xl overflow-hidden border border-slate-700 bg-slate-900">
        <div ref={containerRef} className="w-full h-44 sm:h-52" />
      </div>
      <div className="flex flex-wrap gap-2">
        {store && storeUrl && (
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold hover:bg-cyan-500/25 transition-all"
          >
            <Icon name="store" className="w-3.5 h-3.5" />
            Comercio
          </a>
        )}
        {courier && courierUrl && (
          <a
            href={courierUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold hover:bg-emerald-500/25 transition-all"
          >
            <Icon name="mapPin" className="w-3.5 h-3.5" />
            Ubicación del repartidor
          </a>
        )}
        {dest && destUrl && (
          <a
            href={destUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/15 border border-teal-500/40 text-teal-300 text-[11px] font-bold hover:bg-teal-500/25 transition-all"
          >
            <Icon name="mapPin" className="w-3.5 h-3.5" />
            Destino de la entrega
          </a>
        )}
      </div>
    </div>
  );
}

// Modal selector de punto en el mapa (Leaflet + OpenStreetMap). Lo usan el
// cliente (para elegir dónde recibir distinto de su ubicación actual) y el
// admin (para fijar la ubicación del comercio).
function MapPickerModal({ title, initial, onPick, onClose }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const initialPointRef = useRef(initial?.lat != null && initial?.lng != null ? { lat: initial.lat, lng: initial.lng } : null);
  const [point, setPoint] = useState(initialPointRef.current);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');

  // Crea el mapa y coloca un marcador arrastrable.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const start = initialPointRef.current;
    const defaultCenter = start ? [start.lat, start.lng] : [10.4806, -66.9036];
    const map = L.map(containerRef.current, { zoomControl: true }).setView(defaultCenter, start ? 16 : 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    mapRef.current = map;

    const marker = L.marker(defaultCenter, { icon: makePinIcon('#14b8a6', 'PUNTO'), draggable: true }).addTo(map);
    markerRef.current = marker;
    if (!initialPointRef.current) marker.setOpacity(0.6);

    map.on('click', (e) => {
      setPoint({ lat: e.latlng.lat, lng: e.latlng.lng });
      marker.setLatLng(e.latlng);
      marker.setOpacity(1);
    });
    marker.on('dragend', (e) => {
      setPoint({ lat: e.target.getLatLng().lat, lng: e.target.getLatLng().lng });
      marker.setOpacity(1);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Geocodificación con Nominatim (gratuita, sin key) para buscar direcciones.
  const searchTimer = useRef(null);
  const handleSearch = (e) => {
    const q = e.target.value;
    setSearch(q);
    clearTimeout(searchTimer.current);
    if (q.trim().length < 4) {
      setSuggestions([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q.trim())}&limit=6&addressdetails=1`);
        const data = await res.json();
        if (Array.isArray(data)) setSuggestions(data);
      } catch {
        setSuggestions([]);
      }
    }, 400);
  };

  const applySuggestion = (s) => {
    const lat = Number(s.lat);
    const lng = Number(s.lon);
    setPoint({ lat, lng });
    setSearch(s.display_name || s.name || '');
    setSuggestions([]);
    const map = mapRef.current;
    if (map) {
      map.setView([lat, lng], 17);
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
        markerRef.current.setOpacity(1);
      }
    }
  };

  // Ubicación actual del dispositivo (con guía de permiso como en checkout).
  const useMyLocation = () => {
    setLocError('');
    if (!navigator.geolocation) {
      setLocError('Tu navegador no soporta geolocalización.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPoint({ lat, lng });
        const map = mapRef.current;
        if (map) {
          map.setView([lat, lng], 17);
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
            markerRef.current.setOpacity(1);
          }
        }
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setLocError(err && err.code === 1 ? 'Permiso de ubicación denegado. Activalo en los ajustes del navegador.' : 'No se pudo obtener la ubicación.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  const confirm = () => {
    if (!point) {
      setLocError('Toca el mapa o busca una dirección para elegir el punto.');
      return;
    }
    onPick({ lat: Number(point.lat), lng: Number(point.lng), address: search.trim() || null });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 max-h-[92vh] flex flex-col overflow-hidden animate-scale-up">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Icon name="mapPin" className="w-5 h-5 text-teal-400" />
              {title || 'Elegir punto en el mapa'}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Busca una dirección, toca el mapa o arrastra el marcador.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={handleSearch}
              placeholder="Buscar dirección o lugar (ej: Av. Bolívar 123)"
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none pr-10"
            />
            <Icon name="search" className="w-4 h-4 text-slate-500 absolute right-3 top-3.5" />
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl overflow-hidden z-20">
                {suggestions.map((s) => (
                  <button
                    key={s.place_id}
                    type="button"
                    onClick={() => applySuggestion(s)}
                    className="w-full text-left px-3 py-2.5 text-xs text-slate-200 hover:bg-slate-700/70 transition-colors border-b border-slate-700/50 last:border-0"
                  >
                    {s.display_name || s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="w-full px-4 py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-sm font-bold hover:bg-cyan-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Icon name="mapPin" className="w-4 h-4" />
            {locating ? 'Obteniendo ubicación...' : 'Usar mi ubicación actual'}
          </button>

          <div className="rounded-2xl overflow-hidden border border-slate-700 bg-slate-900">
            <div ref={containerRef} className="w-full h-56 sm:h-64" />
          </div>

          {point && (
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Icon name="check" className="w-3.5 h-3.5 text-emerald-400" />
              Punto elegido: <span className="text-white font-bold">{point.lat.toFixed(6)}, {point.lng.toFixed(6)}</span>
            </p>
          )}
          {locError && (
            <p className="text-xs text-rose-400 flex items-center gap-1.5">
              <Icon name="alertTriangle" className="w-3.5 h-3.5 flex-shrink-0" />
              {locError}
            </p>
          )}

          <button
            type="button"
            onClick={confirm}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-sm hover:from-teal-400 hover:to-emerald-400 shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Icon name="check" className="w-4 h-4" />
            Confirmar punto
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal de rastreo en vivo para el cliente: consulta el estado del pedido y la
// posición del repartidor cada 5s mientras está abierto, mostrando el mapa.
function LiveTrackingModal({ order, onClose, storeLocation }) {
  const [track, setTrack] = useState(order);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  const loadMessages = async () => {
    const res = await api.getOrderMessages(order.id, order.phone);
    if (res.ok && Array.isArray(res.data.messages)) setMessages(res.data.messages);
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const res = await api.getOrderTracking(order.id);
      if (!alive) return;
      if (res.ok && res.data) {
        setTrack(res.data);
        setError('');
      } else {
        setError(res.data?.error || 'No se pudo obtener el rastreo del pedido.');
      }
      loadMessages();
    };
    load();
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [order.id]);

  const handleSendMessage = async () => {
    const text = messageText.trim();
    if (!text || sending) return;
    setSending(true);
    const res = await api.sendOrderMessage(order.id, order.phone, text);
    setSending(false);
    if (res.ok) {
      setMessageText('');
      loadMessages();
    } else {
      setError(res.data?.error || 'No se pudo enviar el mensaje.');
    }
  };

  const status = track?.status || order.status;
  const style = STATUS_STYLES[status] || STATUS_STYLES.pendiente;
  const currentIdx = STATUS_FLOW.indexOf(status);
  const steps = [
    { key: 'pendiente', label: '1. Recibido' },
    { key: 'en_preparacion', label: '2. Preparando' },
    { key: 'listo', label: '3. Listo' },
    ...(order.type === 'delivery' ? [{ key: 'en_camino', label: '4. En camino' }] : []),
    { key: 'entregado', label: order.type === 'delivery' ? '5. Entregado' : '4. Entregado' }
  ];

  const courierLive = track?.courier_lat != null && track?.courier_lng != null;
  const updatedAt = track?.courier_updated_at
    ? new Date(track.courier_updated_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 max-h-[92vh] overflow-y-auto animate-scale-up">
        <div className="p-5 sm:p-6 border-b border-slate-800 sticky top-0 bg-slate-900 z-10 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Icon name="mapPin" className="w-5 h-5 text-emerald-400" />
              Rastreo en vivo <span className="text-teal-400">#{order.id}</span>
            </h3>
            <span className={`inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${style.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${style.dot} ${status === 'en_camino' ? 'animate-pulse' : ''}`} />
              {STATUS_LABELS[status] || 'Pendiente'}
            </span>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          {/* Stepper de estados */}
          <div className={`grid gap-1.5 sm:gap-2 pt-1 ${order.type === 'delivery' ? 'grid-cols-5' : 'grid-cols-4'}`}>
            {steps.map((step, idx) => {
              const isPassed = idx <= currentIdx;
              const isCurrent = idx === currentIdx;
              return (
                <div key={step.key} className="flex flex-col items-center gap-1.5 sm:gap-2">
                  <div className={`w-full h-1.5 sm:h-2 rounded-full transition-all duration-500 ${isPassed ? 'bg-emerald-400 shadow-lg shadow-emerald-500/50' : 'bg-slate-700/60'}`} />
                  <span className={`text-[9px] sm:text-xs font-semibold text-center leading-tight ${isCurrent ? 'text-emerald-300 font-bold scale-105' : isPassed ? 'text-slate-300' : 'text-slate-500'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Mapa: destino + repartidor en vivo */}
          <DeliveryMap order={track} storeLocation={storeLocation} />

          {/* Estado del repartidor */}
          <div className="rounded-xl bg-slate-800/60 p-3 text-xs space-y-1">
            <div className="flex items-center gap-2">
              <Icon name="mapPin" className="w-3.5 h-3.5 text-emerald-400" />
              {courierLive ? (
                <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Repartidor en camino {updatedAt ? `· ${updatedAt}` : ''}
                </span>
              ) : (
                <span className="text-slate-400">
                  {status === 'en_camino' ? 'Buscando la posición del repartidor…' : 'El repartidor aún no inició el envío.'}
                </span>
              )}
            </div>
            {order.address && <p className="text-slate-400">Destino: <span className="text-white font-bold">{order.address}</span></p>}
            <p className="text-slate-500">La posición se actualiza automáticamente cada 5 segundos.</p>
          </div>

          {/* Chat del pedido con la tienda */}
          <div className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-hidden">
            <div className="p-3 border-b border-slate-700/70 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span className="text-xs font-bold text-white">Chat con la tienda</span>
            </div>
            <div className="p-3 space-y-2 max-h-52 overflow-y-auto">
              {messages.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-3">
                  Sin mensajes todavía. Escríbenos si necesitas algo.
                </p>
              )}
              {messages.map((m, idx) => {
                const mine = m.from === 'customer';
                return (
                  <div key={idx} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-snug ${
                        mine
                          ? 'bg-teal-500/20 text-teal-100 rounded-br-md'
                          : 'bg-slate-700/70 text-slate-200 rounded-bl-md'
                      }`}
                    >
                      <p className="break-words">{m.text}</p>
                      {m.createdAt && (
                        <p className={`text-[9px] mt-1 ${mine ? 'text-teal-300/70' : 'text-slate-400'}`}>
                          {new Date(m.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-3 border-t border-slate-700/70 flex gap-2">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendMessage();
                }}
                placeholder="Escribe un mensaje…"
                maxLength={300}
                className="flex-1 min-w-0 px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:border-teal-500 focus:outline-none"
              />
              <button
                onClick={handleSendMessage}
                disabled={sending || !messageText.trim()}
                className="shrink-0 px-3.5 py-2.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs disabled:opacity-50 disabled:pointer-events-none transition-all active:scale-95"
              >
                Enviar
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              {error} Se seguirá intentando.
            </p>
          )}

          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-slate-800 text-slate-300 font-bold text-sm hover:bg-slate-700 transition-all"
          >
            Cerrar rastreo
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckoutModal({ onClose, cart, cartTotal, rate, isPlacingOrder, onSubmit, savedCustomer, knownCustomers, onSaveCustomer, customerProfile, onSaveAddress, addToast, paymentConfig }) {
  const [formData, setFormData] = useState({
    customerName: savedCustomer?.customerName || '',
    phoneCode: savedCustomer?.phoneCode || '0412',
    phoneNumber: savedCustomer?.phoneNumber || '',
    type: savedCustomer?.type || 'pickup', // 'pickup' | 'delivery'
    address: savedCustomer?.address || '',
    notes: '',
    credit: false,
    lat: null,
    lng: null,
    mapAddress: null,
    paymentMethod: '',
    paymentReference: '',
    paymentProof: null
  });

  const [errors, setErrors] = useState({});
  const [showPhoneSuggestions, setShowPhoneSuggestions] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Comprueba el estado del permiso de ubicación (si el navegador lo soporta).
  const getGeoPermission = () =>
    navigator.permissions && navigator.permissions.query
      ? navigator.permissions.query({ name: 'geolocation' })
      : null;

  // Captura la ubicación GPS del cliente para entregas a domicilio (sin usar
  // Google Maps API; solo se guardan lat/lng y se muestra un enlace a Maps).
  const handleUseMyLocation = async () => {
    setLocError('');
    if (!navigator.geolocation) {
      setLocError('Tu navegador no soporta geolocalización. Ingresa la dirección manualmente.');
      addToast('Tu navegador no soporta geolocalización', 'error');
      return;
    }
    // Si el navegador ya guardó "denegado", no volverá a preguntar; lo avisamos
    // con instrucciones para habilitarlo en lugar de pedirlo en silencio.
    try {
      const perm = getGeoPermission();
      if (perm) {
        const state = await perm;
        if (state && state.state === 'denied') {
          setLocError(
            'El navegador tiene la ubicación bloqueada. Para que pregunte de nuevo, activa el permiso de ubicación para este sitio en los ajustes del navegador (icono del candado junto a la URL) y recarga la página.'
          );
          addToast('Permiso de ubicación bloqueado en el navegador', 'error');
          return;
        }
      }
    } catch {}
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        }));
        setLocating(false);
        addToast('Ubicación capturada. La entrega se hará en este punto.', 'success');
      },
      (err) => {
        setLocating(false);
        const denied = err && err.code === 1;
        const msg = denied
          ? 'Permiso de ubicación denegado. Actívalo en los ajustes del navegador (candado junto a la URL) y recarga, o ingresa la dirección manualmente.'
          : 'No se pudo obtener la ubicación. Ingresa la dirección manualmente.';
        setLocError(msg);
        addToast(msg, 'error');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  // Autocompletado por teléfono: busca clientes conocidos cuyos 7 dígitos coincidan
  const phoneSuggestions = useMemo(() => {
    if (formData.phoneNumber.length < 3) return [];
    const q = formData.phoneNumber;
    return knownCustomers
      .filter((c) => (c.number || '').startsWith(q))
      .slice(0, 3);
  }, [knownCustomers, formData.phoneNumber]);

  const applyCustomer = (customer) => {
    setFormData((prev) => ({
      ...prev,
      customerName: customer.name || prev.customerName,
      phoneCode: customer.code || prev.phoneCode,
      phoneNumber: customer.number || prev.phoneNumber,
      address: customer.address || prev.address
    }));
    setShowPhoneSuggestions(false);
    if (customer.address) setFormData((prev) => ({ ...prev, type: 'delivery' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.customerName.trim()) newErrors.customerName = 'Ingresa tu nombre completo';
    if (!/^\d{7}$/.test(formData.phoneNumber)) newErrors.phone = 'Ingresa los 7 dígitos del número';
    if (formData.type === 'delivery' && !formData.address.trim() && (formData.lat == null || formData.lng == null)) {
      newErrors.address = 'Ingresa la dirección o comparte tu ubicación';
    }
    if (!formData.credit && formData.paymentMethod !== 'efectivo' && !formData.paymentProof) {
      newErrors.payment = 'Adjunta el comprobante del pago (foto de la transferencia o pago móvil)';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isPlacingOrder) return;
    if (validate()) {
      const full = {
        ...formData,
        phone: `${formData.phoneCode} ${formData.phoneNumber}`
      };
      if (onSaveCustomer) {
        onSaveCustomer({
          customerName: formData.customerName,
          phoneCode: formData.phoneCode,
          phoneNumber: formData.phoneNumber,
          address: formData.address || '',
          type: formData.type
        });
      }
      onSubmit(full);
    }
  };

  const handlePhoneNumber = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 7);
    setFormData({ ...formData, phoneNumber: digits });
    setShowPhoneSuggestions(digits.length >= 3);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-screen-up flex flex-col">
        {/* Handle visual para indicar arrastre en móvil */}
        <div className="sm:hidden absolute top-2.5 left-1/2 -translate-x-1/2 z-20 w-12 h-1.5 rounded-full bg-slate-700" />

        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Finalizar Pedido</h2>
            {savedCustomer?.customerName ? (
              <p className="text-xs text-teal-400 mt-0.5 flex items-center gap-1">
                <Icon name="user" className="w-3 h-3" />
                ¡Hola de nuevo, {savedCustomer.customerName.split(' ')[0]}! Tus datos ya están listos.
              </p>
            ) : (
              <p className="text-xs text-slate-400 mt-0.5">Completa tus datos para enviarlo a la tienda</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {/* Order Method Selector */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 p-1 sm:p-1.5 rounded-2xl bg-slate-800 border border-slate-700">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'pickup' })}
              className={`py-2.5 sm:py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                formData.type === 'pickup'
                  ? 'bg-teal-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon name="store" className="w-4 h-4" />
              Retiro en Tienda
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'delivery' })}
              className={`py-2.5 sm:py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                formData.type === 'delivery'
                  ? 'bg-teal-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon name="mapPin" className="w-4 h-4" />
              Envío a Domicilio
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nombre y Apellido *
              </label>
              <input
                type="text"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="Ej: Juan Pérez"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
              />
              {errors.customerName && <p className="text-xs text-rose-400 mt-1">{errors.customerName}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Teléfono / WhatsApp *
              </label>
              <div className="flex gap-2">
                <select
                  value={formData.phoneCode}
                  onChange={(e) => setFormData({ ...formData, phoneCode: e.target.value })}
                  className="w-24 shrink-0 px-3 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm font-bold focus:border-teal-500 focus:outline-none"
                >
                  {PHONE_CODES.map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={formData.phoneNumber}
                  onChange={(e) => handlePhoneNumber(e.target.value)}
                  onBlur={() => setTimeout(() => setShowPhoneSuggestions(false), 150)}
                  placeholder="1234567"
                  maxLength={7}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
              {showPhoneSuggestions && phoneSuggestions.length > 0 && (
                <div className="mt-2 space-y-1.5 animate-fade-in">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                    Clientes conocidos — toca para autocompletar
                  </p>
                  {phoneSuggestions.map((c) => (
                    <button
                      key={c.phone}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyCustomer(c);
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-slate-800 border border-teal-500/30 hover:border-teal-400/60 hover:bg-slate-700/60 transition-all text-left"
                    >
                      <span className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400 shrink-0">
                        <Icon name="user" className="w-3.5 h-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-white truncate">{c.name}</span>
                        <span className="block text-[10px] text-slate-400 truncate">
                          {c.code} {c.number}
                          {c.address ? ` · ${c.address}` : ''}
                        </span>
                      </span>
                      <Icon name="arrowRight" className="w-3.5 h-3.5 text-teal-400 shrink-0 ml-auto" />
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-slate-500 mt-1">Código móvil + 7 dígitos (ej: {formData.phoneCode} 1234567)</p>
              {errors.phone && <p className="text-xs text-rose-400 mt-1">{errors.phone}</p>}
            </div>

            {formData.type === 'delivery' && (
              <div className="animate-fade-in space-y-2">
                {customerProfile?.addresses?.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300 mb-0.5">
                      Tus direcciones guardadas
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {customerProfile.addresses.map((addr) => (
                        <button
                          key={addr}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, address: addr }))}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all text-left ${
                            formData.address === addr
                              ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-teal-500/40'
                          }`}
                        >
                          {addr}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Dirección de Entrega
                    </label>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <button
                        type="button"
                        onClick={handleUseMyLocation}
                        disabled={locating}
                        className={`px-2 py-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          formData.lat != null && formData.lng != null
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-teal-500/15 border-teal-500/40 text-teal-300 hover:bg-teal-500/25'
                        } ${locating ? 'opacity-60 pointer-events-none' : ''}`}
                      >
                        <Icon name="mapPin" className="w-3.5 h-3.5 shrink-0" />
                        {locating ? 'Obteniendo...' : 'Mi ubicación (GPS)'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMapPicker(true)}
                        className={`px-2 py-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          formData.mapAddress
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-sky-500/15 border-sky-500/40 text-sky-300 hover:bg-sky-500/25'
                        }`}
                      >
                        <Icon name="search" className="w-3.5 h-3.5 shrink-0" />
                        Elegir punto en el mapa
                      </button>
                    </div>
                    {(formData.lat != null || formData.mapAddress) && (
                      <a
                        href={`https://www.google.com/maps?q=${formData.lat},${formData.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-[11px] text-sky-300 underline mb-2"
                      >
                        Ver punto en Google Maps
                      </a>
                    )}
                  {locError && (
                    <p className="text-xs text-rose-400 mb-2 flex items-center gap-1.5">
                      <Icon name="alertTriangle" className="w-3.5 h-3.5 flex-shrink-0" />
                      {locError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Calle, Número, Piso/Depto (opcional si compartiste ubicación)"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const phone = `${formData.phoneCode}${formData.phoneNumber}`.replace(/\D/g, '').slice(-11);
                        if (!formData.address.trim() || !/^\d{7}$/.test(formData.phoneNumber)) {
                          addToast('Completa la dirección y el teléfono para guardarla', 'warning');
                          return;
                        }
                        onSaveAddress?.(phone, formData.customerName, formData.address.trim());
                      }}
                      className="shrink-0 px-3 py-3 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-300 hover:bg-teal-500/30 transition-all flex items-center gap-1.5 text-xs font-bold"
                      title="Guardar esta dirección en tu perfil"
                    >
                      <Icon name="plus" className="w-3.5 h-3.5" />
                      Guardar
                    </button>
                  </div>
                  {errors.address && <p className="text-xs text-rose-400 mt-1">{errors.address}</p>}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Aclaraciones o Notas (Opcional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Ej: Si no hay Sprite reemplazar por 7Up..."
                rows={2}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Mini Summary Box */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Resumen del Pedido</span>
            <div className="text-xs text-slate-300 flex justify-between">
              <span>Productos ({cart.length})</span>
              <span className="font-bold text-white text-right">
                {formatUsd(cartTotal)}
                {rate?.rate > 0 && (
                  <span className="block text-[11px] text-teal-300/90">
                    {formatBs(usdToBs(cartTotal, rate.rate))}
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Pedido a crédito (solo clientes beneficiados) */}
          {customerProfile?.isBenefited && (
            <div
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                formData.credit
                  ? 'bg-indigo-500/10 border-indigo-400'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
              onClick={() => setFormData({ ...formData, credit: !formData.credit })}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`p-2 rounded-xl shrink-0 ${
                    formData.credit ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Icon name="creditCard" className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">Enviar pedido a la cuenta</p>
                  <p className="text-[11px] text-slate-400">
                    Lo pagas luego; se suma a tu saldo. La tienda debe aceptarlo antes de prepararlo.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Método de pago */}
          {!formData.credit && (
            <div className="space-y-2.5">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Método de pago</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'efectivo', label: 'Efectivo', icon: 'dollarSign' },
                  { key: 'pago_movil', label: 'Pago Móvil', icon: 'zap' },
                  { key: 'transferencia', label: 'Transferencia', icon: 'creditCard' }
                ].map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, paymentMethod: formData.paymentMethod === m.key ? '' : m.key })
                    }
                    className={`px-2 py-3 rounded-xl border text-[11px] sm:text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                      formData.paymentMethod === m.key
                        ? 'bg-teal-500/15 border-teal-500/50 text-teal-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-teal-500/40'
                    }`}
                  >
                    <Icon name={m.icon} className="w-4 h-4" />
                    {m.label}
                  </button>
                ))}
              </div>

              {formData.paymentMethod === 'pago_movil' && paymentConfig?.pagoMovil && (
                <p className="text-[11px] text-slate-300 bg-slate-800/60 rounded-xl p-3 border border-slate-700">
                  <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider mb-1">
                    Datos para el pago móvil
                  </span>
                  Banco: <span className="text-white font-bold">{paymentConfig.pagoMovil.bank || '—'}</span> · Teléfono:{' '}
                  <span className="text-white font-bold">{paymentConfig.pagoMovil.phone || '—'}</span> · Cedula:{' '}
                  <span className="text-white font-bold">{paymentConfig.pagoMovil.id || '—'}</span>
                </p>
              )}

              {formData.paymentMethod === 'transferencia' && paymentConfig?.bank && (
                <p className="text-[11px] text-slate-300 bg-slate-800/60 rounded-xl p-3 border border-slate-700">
                  <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider mb-1">
                    Datos para la transferencia
                  </span>
                  Banco: <span className="text-white font-bold">{paymentConfig.bank.name || '—'}</span> · Número de cuenta:{' '}
                  <span className="text-white font-bold">{paymentConfig.bank.account || '—'}</span>
                  {paymentConfig.bank.titular ? (
                    <> · Titular: <span className="text-white font-bold">{paymentConfig.bank.titular}</span></>
                  ) : null}
                </p>
              )}

              {formData.paymentMethod !== '' && formData.paymentMethod !== 'efectivo' && (
                <div className="space-y-2.5 animate-fade-in">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Número de referencia / comprobante (opcional)
                    </label>
                    <input
                      type="text"
                      value={formData.paymentReference}
                      onChange={(e) => setFormData({ ...formData, paymentReference: e.target.value })}
                      placeholder="Ej: 12H3456789"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Foto del comprobante *
                    </label>
                    <label className="w-full flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/60 cursor-pointer hover:border-teal-500/50 transition-all text-center">
                      {formData.paymentProof ? (
                        <>
                          <img
                            src={formData.paymentProof}
                            alt="Comprobante de pago"
                            className="max-h-36 rounded-lg object-contain"
                          />
                          <span className="text-[11px] text-teal-300 font-semibold flex items-center gap-1">
                            <Icon name="check" className="w-3.5 h-3.5" />
                            Comprobante adjunto — toca para cambiarlo
                          </span>
                        </>
                      ) : (
                        <>
                          <Icon name="upload" className="w-6 h-6 text-slate-500" />
                          <span className="text-xs text-slate-400">
                            Toca para tomar o subir la foto de la transferencia / pago móvil
                          </span>
                          <span className="text-[10px] text-slate-500">Máx 1.5 MB</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files && e.target.files[0];
                          if (!file) return;
                          if (file.size > 1.5 * 1024 * 1024) {
                            addToast('La imagen supera 1.5 MB. Elige una más liviana.', 'error');
                            e.target.value = '';
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () =>
                            setFormData({ ...formData, paymentProof: String(reader.result) });
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  </div>
                  {errors.payment && <p className="text-xs text-rose-400 mt-1">{errors.payment}</p>}
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isPlacingOrder}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-sm hover:from-teal-400 hover:to-emerald-400 shadow-xl shadow-teal-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
          >
            <Icon name="check" className="w-5 h-5" />
            <span>{isPlacingOrder ? 'Enviando pedido…' : 'Confirmar y Enviar Pedido'}</span>
          </button>
        </form>

        {showMapPicker && (
          <MapPickerModal
            title="¿Dónde recibís el pedido?"
            initial={formData.lat != null ? { lat: formData.lat, lng: formData.lng } : null}
            onPick={(p) => {
              setFormData((prev) => ({
                ...prev,
                lat: p.lat,
                lng: p.lng,
                address: p.address || prev.address || '',
                mapAddress: p.address || prev.address || ''
              }));
              setLocError('');
              setShowMapPicker(false);
              addToast('Punto de entrega elegido en el mapa', 'success');
            }}
            onClose={() => setShowMapPicker(false)}
          />
        )}
      </div>
    </div>
  );
}

function AdminView({
  products,
  orders,
  rate,
  promos,
  onSavePromos,
  adminTab,
  setAdminTab,
  onLogout,
  refreshingDb,
  onRefreshDb,
  onOpenAddModal,
  onEditProduct,
  onDeleteProduct,
  onUpdateOrderStatus,
  onUpdateOrderPayment,
  onUpdateCourierLocation,
  onDeleteOrder,
  allCustomers,
  onLoadCustomers,
  onToggleBenefited,
  onAddToBlacklist,
  onAddBlacklistDebt,
  collections,
  onLoadCollections,
  onUpsertCollection,
  onDeleteCollection,
  addToast,
  storeLocation,
  onSaveStoreLocation,
  adminPhone
}) {
  // Order status filter state
  const [statusFilter, setStatusFilter] = useState('todos');
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [proofOrder, setProofOrder] = useState(null);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [reminderPhone, setReminderPhone] = useState('');

  const handlePushBroadcast = async () => {
    if (!broadcastTitle.trim()) return;
    const res = await api.pushBroadcast(broadcastTitle.trim(), broadcastBody.trim());
    if (res.ok) {
      addToast(`Promoción enviada a ${res.data.sent || 0} dispositivo(s)`, 'success');
      setBroadcastTitle('');
      setBroadcastBody('');
    } else {
      addToast(res.data?.error || 'No se pudo enviar la notificación', 'error');
    }
  };

  const handlePushTest = async () => {
    const phone = (reminderPhone || adminPhone || '').trim();
    if (!phone) {
      addToast('Escribe tu teléfono para enviar la prueba', 'warning');
      return;
    }
    const res = await api.pushTest(phone, 'Notificación de prueba', 'Si ves esto, las notificaciones están funcionando.');
    if (res.ok) {
      addToast(`Prueba enviada${res.data.sent > 0 ? '' : ' (sin suscripciones activas)'}`, res.data.sent > 0 ? 'success' : 'warning');
    } else {
      addToast(res.data?.error || 'No se pudo enviar la prueba', 'error');
    }
  };

  const handlePushReminder = async () => {
    if (!reminderPhone.trim()) return;
    const res = await api.pushReminder(reminderPhone.trim());
    if (res.ok) {
      addToast(`Recordatorio enviado a ${res.data.sent || 0} dispositivo(s)`, 'success');
      setReminderPhone('');
    } else {
      addToast(res.data?.error || 'No se pudo enviar el recordatorio', 'error');
    }
  };

  // Modo Repartidor: cuando un pedido a domicilio está en "En Camino", el admin
  // (que reparte) comparte su GPS en vivo para que el cliente lo rastree.
  const [courierActive, setCourierActive] = useState(false);
  const [courierOrderId, setCourierOrderId] = useState(null);
  const courierPosRef = useRef(null);
  const courierWatchIdRef = useRef(null);

  const stopCourierTracking = () => {
    if (courierWatchIdRef.current != null) {
      navigator.geolocation.clearWatch(courierWatchIdRef.current);
      courierWatchIdRef.current = null;
    }
    courierPosRef.current = null;
    setCourierActive(false);
    setCourierOrderId(null);
  };

  // Inicia el seguimiento GPS y lo reporta periódicamente al servidor.
  const startCourierTracking = (orderId) => {
    if (!navigator.geolocation) {
      addToast('Tu navegador no soporta geolocalización', 'error');
      return;
    }
    setCourierActive(true);
    setCourierOrderId(orderId);
    addToast('Modo Repartidor activo: compartiendo tu ubicación en vivo', 'success');
    courierWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        courierPosRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
  };

  // Reporta la posición cada 5s mientras el modo repartidor esté activo.
  const onUpdateCourierLocationRef = useRef(onUpdateCourierLocation);
  useEffect(() => {
    onUpdateCourierLocationRef.current = onUpdateCourierLocation;
  }, [onUpdateCourierLocation]);

  useEffect(() => {
    if (!courierActive || !courierOrderId) return;
    const report = () => {
      const pos = courierPosRef.current;
      if (pos) onUpdateCourierLocationRef.current?.(courierOrderId, pos.lat, pos.lng);
    };
    const timer = setInterval(report, 5000);
    return () => clearInterval(timer);
  }, [courierActive, courierOrderId]);

  // Detiene el seguimiento al desmontar el panel.
  useEffect(() => () => {
    if (courierWatchIdRef.current != null) navigator.geolocation.clearWatch(courierWatchIdRef.current);
  }, []);

  // Promos editor state
  const [promoDraft, setPromoDraft] = useState(null);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);

  // Cobros vencidos pendientes de enviar: mientras el panel esté abierto se
  // revisa cada 30s (y al montar) si algún cobro programado ya venció. El admin
  // decide enviarlo o descartarlo; no se envía solo. Lo descartado se olvida
  // al recargar la app, así que si estaba cerrada vuelve a aparecer.
  const [overdueList, setOverdueList] = useState([]);
  const dismissedOverdueRef = useRef([]);

  useEffect(() => {
    const refresh = () => {
      const now = Date.now();
      const due = collections.filter(
        (c) => c.status === 'programado' && c.phone && new Date(c.dueAt || 0).getTime() <= now
      );
      setOverdueList(due.filter((c) => !dismissedOverdueRef.current.includes(c.id)));
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [collections]);

  const handleSendOverdue = async (c) => {
    const cust = (allCustomers || []).find((x) => normalizePhoneDigits(x.phone) === normalizePhoneDigits(c.phone)) || {
      phone: c.phone,
      customerName: c.customerName
    };
    const wa = formatPhoneWhatsApp(cust.phone);
    if (wa) {
      const msg = c.note ? `${buildAccountMessage(cust, orders)}\n\n_${c.note}_` : buildAccountMessage(cust, orders);
      window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
    }
    const ok = await onUpsertCollection({ id: c.id, status: 'enviado' });
    if (ok) setOverdueList((prev) => prev.filter((x) => x.id !== c.id));
  };

  const handleDismissOverdue = (c) => {
    dismissedOverdueRef.current.push(c.id);
    setOverdueList((prev) => prev.filter((x) => x.id !== c.id));
  };

  const filteredOrders = statusFilter === 'todos'
    ? orders
    : orders.filter((o) => o.status === statusFilter);

  // Calculated Analytics
  const lowStockProducts = products.filter((p) => p.stock <= 5);
  const completedOrders = orders.filter((o) => o.status === 'entregado');
  const totalRevenue = completedOrders.reduce((acc, o) => acc + o.total, 0);
  const pendingOrders = orders.filter((o) => o.status === 'pendiente' || o.status === 'en_preparacion');

  const openNewPromo = () => {
    setPromoDraft({ id: `promo-${Date.now()}`, title: '', subtitle: '', image: '', active: true });
    setIsPromoModalOpen(true);
  };

  const openEditPromo = (promo) => {
    setPromoDraft({ ...promo });
    setIsPromoModalOpen(true);
  };

  const handleSavePromo = (data) => {
    if (!data.id) return;
    const exists = promos.some((p) => p.id === data.id);
    const next = exists ? promos.map((p) => (p.id === data.id ? data : p)) : [...promos, data];
    onSavePromos(next);
    setIsPromoModalOpen(false);
    setPromoDraft(null);
  };

  const handleDeletePromo = (id) => {
    onSavePromos(promos.filter((p) => p.id !== id));
    setIsPromoModalOpen(false);
    setPromoDraft(null);
  };

  const topByDemand = useMemo(() => {
    const counts = {};
    orders.forEach((o) =>
      o.items.forEach((it) => {
        counts[it.id] = (counts[it.id] || 0) + it.quantity;
      })
    );
    return Object.entries(counts)
      .map(([id, quantity]) => ({ id, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .map(({ id, quantity }) => {
        const p = products.find((prod) => prod.id === id);
        return p ? { ...p, quantity } : null;
      })
      .filter(Boolean)
      .slice(0, 4);
  }, [orders, products]);

  // Tendencia de ventas por día (últimos 7 días): cantidad de pedidos y ventas en $.
  const salesByDay = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({
        key: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString('es-ES', { weekday: 'short' }),
        orders: 0,
        revenue: 0
      });
    }
    const map = {};
    days.forEach((d) => (map[d.key] = d));
    orders.forEach((o) => {
      const ts = o.timestamp ? new Date(o.timestamp) : null;
      const key = ts && !isNaN(ts) ? new Date(ts.getFullYear(), ts.getMonth(), ts.getDate()).toISOString().slice(0, 10) : null;
      if (key && map[key]) {
        map[key].orders += 1;
        if (o.status === 'entregado') map[key].revenue += o.total || 0;
      }
    });
    return days;
  }, [orders]);

  // Clientes con mayor volumen de pedidos (segmentación por actividad).
  const topCustomers = useMemo(() => {
    const counts = {};
    orders.forEach((o) => {
      const key = (o.phone || 'desconocido').trim();
      counts[key] = counts[key] || { phone: key, orders: 0, revenue: 0 };
      counts[key].orders += 1;
      if (o.status === 'entregado') counts[key].revenue += o.total || 0;
    });
    return Object.values(counts)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5);
  }, [orders]);

  const lowStockMessage = useMemo(() => {
    if (lowStockProducts.length === 0) return '';
    const lines = lowStockProducts.slice(0, 10).map((p) => `• ${p.name}: ${p.stock} un.`);
    return `⚠️ *ALERTA DE STOCK BAJO* en Kiosko 247\n\nProductos con pocas unidades:\n${lines.join('\n')}\n\nRevisa el inventario y repón lo antes posible.`;
  }, [lowStockProducts]);

  return (
    <div className="space-y-5 sm:space-y-8 animate-fade-in">
      {/* Admin Top Dashboard Header */}
      <div className="flex flex-col sm:flex-row md:items-center justify-between gap-4 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-2xl backdrop-blur-md">
        <div>
          <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold uppercase tracking-wider">
            🛡️ Panel Administrativo
          </span>
          <h2 className="text-lg sm:text-2xl font-black text-white mt-2">Control de Inventario y Ventas</h2>
          <p className="text-xs text-slate-400 mt-1">Gestiona tus productos en tiempo real y atiende pedidos entrantes.</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAddModal}
            className="flex-1 sm:flex-none px-4 sm:px-5 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-bold text-sm hover:from-teal-400 hover:to-cyan-400 shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Icon name="plus" className="w-5 h-5" />
            <span>Nuevo Producto</span>
          </button>
          {window.location.hostname === 'kiosko-247-staging.onrender.com' && (
            <button
              onClick={() => {
                if (window.confirm('¿Reemplazar los datos de calidad con una copia de producción? Esta acción no se puede deshacer.')) {
                  onRefreshDb();
                }
              }}
              disabled={refreshingDb}
              className="px-3 sm:px-4 py-3 rounded-2xl bg-slate-900/70 border border-slate-700 text-slate-300 font-bold text-sm hover:text-teal-300 hover:border-teal-500/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              title="Copiar datos de producción hacia calidad (reemplaza el contenido actual de calidad)"
            >
              <Icon name="refresh" className="w-4 h-4" />
              <span className="hidden sm:inline">{refreshingDb ? 'Refrescando…' : 'Refrescar datos'}</span>
            </button>
          )}
          <button
            onClick={onLogout}
            className="px-3 sm:px-4 py-3 rounded-2xl bg-slate-900/70 border border-slate-700 text-slate-300 font-bold text-sm hover:text-rose-300 hover:border-rose-500/40 transition-all flex items-center justify-center gap-2"
            title="Cerrar sesión"
          >
            <Icon name="x" className="w-4 h-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>

      {/* Analytics Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="p-3.5 sm:p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-teal-500/20 text-teal-400">
            <Icon name="package" className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium block">Total Productos</span>
            <span className="text-xl sm:text-2xl font-black text-white">{products.length}</span>
          </div>
        </div>

        <div className="p-3.5 sm:p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-amber-500/20 text-amber-400">
            <Icon name="alertTriangle" className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium block">Stock Bajo</span>
            <span className="text-xl sm:text-2xl font-black text-amber-400">{lowStockProducts.length}</span>
          </div>
        </div>

        <div className="p-3.5 sm:p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-cyan-500/20 text-cyan-400">
            <Icon name="clock" className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium block">Pedidos Activos</span>
            <span className="text-xl sm:text-2xl font-black text-cyan-400">{pendingOrders.length}</span>
          </div>
        </div>

        <div className="p-3.5 sm:p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-emerald-500/20 text-emerald-400">
            <Icon name="dollarSign" className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium block">Ingresos</span>
            <span className="text-lg sm:text-2xl font-black text-emerald-400 truncate">
              {formatUsd(totalRevenue)}
              {rate?.rate > 0 && (
                <span className="hidden sm:block text-[11px] text-slate-400 font-semibold">
                  {formatBs(usdToBs(totalRevenue, rate.rate))}
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex border-b border-slate-800 gap-4 sm:gap-6 overflow-x-auto scrollbar-none -mx-3 sm:mx-0 px-3 sm:px-0">
        {[
          { key: 'inventory', label: 'Inventario', full: 'Inventario de Productos', icon: 'package' },
          { key: 'orders', label: `Pedidos (${pendingOrders.length})`, full: `Pedidos en Vivo (${pendingOrders.length})`, icon: 'clock' },
          { key: 'promos', label: 'Promos', full: 'Promos de Tienda', icon: 'sparkles' },
          { key: 'benefited', label: 'Beneficiados', full: 'Clientes Beneficiados', icon: 'users' },
          { key: 'blacklist', label: 'Lista Negra', full: 'Lista Negra (Deudores)', icon: 'alertTriangle' },
          { key: 'tienda', label: 'Tienda', full: 'Ubicación del Comercio', icon: 'store' },
          { key: 'analytics', label: 'Estadísticas', full: 'Estadísticas del Negocio', icon: 'trendingUp' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              if (tab.key === 'benefited' || tab.key === 'blacklist') onLoadCustomers();
              if (tab.key === 'blacklist') onLoadCollections();
              setAdminTab(tab.key);
            }}
            className={`pb-3 sm:pb-4 text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 border-b-2 transition-all whitespace-nowrap shrink-0 ${
              adminTab === tab.key
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon name={tab.icon} className="w-4 h-4" />
            <span className="sm:hidden">{tab.label}</span>
            <span className="hidden sm:inline">{tab.full}</span>
          </button>
        ))}
      </div>

      {/* Tab 1: Inventory Management */}
      {adminTab === 'inventory' && (
        <div className="space-y-4">
          {/* Mobile: card list */}
          <div className="grid grid-cols-1 gap-3 sm:hidden">
            {products.map((p) => {
              const isLow = p.stock <= 5;
              const isOut = p.stock === 0;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60"
                >
                  <img
                    src={p.image}
                    alt={p.name}
                    className="w-14 h-14 rounded-xl object-cover bg-slate-900 border border-slate-700 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-100 text-sm truncate">{p.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{p.code} · {p.category}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-bold text-white text-xs">{formatUsd(p.price)}</span>
                      {rate?.rate > 0 && (
                        <span className="text-[10px] text-slate-400 font-semibold">
                          {formatBs(usdToBs(p.price, rate.rate))}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        isOut
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                          : isLow
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      {isOut ? 'Agotado' : `${p.stock} un.`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onEditProduct(p)}
                        className="p-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-cyan-400 transition-all"
                        title="Editar producto"
                      >
                        <Icon name="edit" className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteProduct(p)}
                        className="p-2 rounded-xl bg-slate-700/60 hover:bg-rose-500/20 text-rose-400 transition-all"
                        title="Eliminar producto"
                      >
                        <Icon name="trash" className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block bg-slate-800/60 border border-slate-700/60 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-700/80 bg-slate-900/60 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <th className="p-4">Producto</th>
                    <th className="p-4">Código</th>
                    <th className="p-4">Categoría</th>
                    <th className="p-4">Precio</th>
                    <th className="p-4">Stock</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 text-sm">
                  {products.map((p) => {
                    const isLow = p.stock <= 5;
                    const isOut = p.stock === 0;

                    return (
                      <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="p-4 flex items-center gap-3">
                          <img
                            src={p.image}
                            alt={p.name}
                            className="w-12 h-12 rounded-xl object-cover bg-slate-900 border border-slate-700"
                          />
                          <div>
                            <p className="font-bold text-slate-100">{p.name}</p>
                            <p className="text-xs text-slate-400 line-clamp-1 max-w-xs">
                              {[formatSize(p), p.description].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-xs text-slate-400">{p.code}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-300">
                            {p.category}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-white">
                          {formatUsd(p.price)}
                          {rate?.rate > 0 && (
                            <span className="block text-[10px] text-slate-400 font-semibold">
                              {formatBs(usdToBs(p.price, rate.rate))}
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                              isOut
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : isLow
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {p.stock} unidades
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => onEditProduct(p)}
                            className="p-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-cyan-400 transition-all"
                            title="Editar producto"
                          >
                            <Icon name="edit" className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteProduct(p)}
                            className="p-2 rounded-xl bg-slate-700/60 hover:bg-rose-500/20 text-rose-400 transition-all"
                            title="Eliminar producto"
                          >
                            <Icon name="trash" className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Orders */}
      {adminTab === 'orders' && (
        <div className="space-y-4">
          {/* Status Quick Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
            {[
              { key: 'todos', label: 'Todos', count: orders.length },
              { key: 'pendiente', label: 'Pendientes', count: orders.filter((o) => o.status === 'pendiente').length },
              { key: 'en_preparacion', label: 'Preparación', count: orders.filter((o) => o.status === 'en_preparacion').length },
              { key: 'listo', label: 'Listos', count: orders.filter((o) => o.status === 'listo').length },
              { key: 'en_camino', label: 'En Camino', count: orders.filter((o) => o.status === 'en_camino').length },
              { key: 'entregado', label: 'Entregados', count: orders.filter((o) => o.status === 'entregado').length },
              { key: 'cancelado', label: 'Cancelados', count: orders.filter((o) => o.status === 'cancelado').length }
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3.5 sm:px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap border transition-all shrink-0 ${
                  statusFilter === f.key
                    ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-lg shadow-teal-500/20'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-white'
                }`}
              >
                {f.label}
                <span className="ml-1.5 px-1.5 py-0.5 rounded-lg bg-black/20 text-[10px]">{f.count}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredOrders.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-500 space-y-2">
                <Icon name="clock" className="w-12 h-12 text-slate-700 mx-auto" />
                <p className="font-bold text-slate-400">No hay pedidos con este estado</p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const st = STATUS_STYLES[order.status] || STATUS_STYLES.pendiente;
                const wa = formatPhoneWhatsApp(order.phone);
                return (
                  <div
                    key={order.id}
                    className={`p-4 sm:p-5 rounded-3xl bg-slate-800/80 border shadow-xl space-y-4 flex flex-col justify-between ${st.ring}`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-teal-400">{order.id}</span>
                        <span
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${st.badge}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot} animate-pulse`} />
                          {({ pendiente: 'Pendiente', en_preparacion: 'En Preparación', listo: 'Listo', en_camino: 'En Camino', entregado: 'Entregado', cancelado: 'Cancelado' })[order.status]}
                        </span>
                        {order.paymentMethod && order.paymentMethod !== 'efectivo' && (
                          <span
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-bold ${
                              order.paymentStatus === 'confirmado'
                                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                                : order.paymentStatus === 'rechazado'
                                  ? 'border-rose-400/40 bg-rose-500/15 text-rose-300'
                                  : 'border-amber-400/40 bg-amber-500/15 text-amber-300'
                            }`}
                          >
                            <Icon name="creditCard" className="w-3 h-3" />
                            {({ pago_movil: 'Pago Móvil', transferencia: 'Transferencia' })[order.paymentMethod] || 'Pago'} ·{' '}
                            {({ pendiente: 'En revisión', confirmado: 'Confirmado', rechazado: 'Rechazado' })[order.paymentStatus] || 'Pendiente'}
                          </span>
                        )}
                        {order.credit && (
                          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-indigo-400/40 bg-indigo-500/15 text-indigo-300 text-[11px] font-bold">
                            <Icon name="creditCard" className="w-3 h-3" />
                            A cuenta
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="font-bold text-white text-base">{order.customerName}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-slate-300 flex items-center gap-1">
                            <Icon name="phone" className="w-3.5 h-3.5 text-slate-400" />
                            {order.phone}
                          </p>
                          {wa && (
                            <a
                              href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hola ${order.customerName}, sobre tu pedido ${order.id} en Kiosko 247`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold hover:bg-emerald-500/25 transition-all"
                            >
                              <Icon name="whatsapp" className="w-3.5 h-3.5" />
                              WhatsApp
                            </a>
                          )}
                        </div>
                        {order.type === 'delivery' ? (
                          <p className="text-xs text-amber-300 flex items-center gap-1 mt-1 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                            <Icon name="mapPin" className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>Entrega: {order.address}</span>
                            {order.lat != null && order.lng != null && (
                              <a
                                href={`https://www.google.com/maps?q=${order.lat},${order.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-auto shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300 text-[10px] font-bold hover:bg-sky-500/25 transition-all"
                              >
                                <Icon name="mapPin" className="w-3 h-3" />
                                Abrir en Maps
                              </a>
                            )}
                            {order.courier_lat != null && order.courier_lng != null && (
                              <span className="text-[10px] font-bold text-emerald-300 ml-auto">
                                Repartidor en vivo
                              </span>
                            )}
                          </p>
                        ) : (
                          <span className="inline-block mt-1 px-2.5 py-0.5 rounded-lg bg-teal-500/10 text-teal-300 text-xs font-semibold">
                            🛍️ Retiro por Mostrador
                          </span>
                        )}
                      </div>

                      {/* Order Line Items */}
                      <div className="p-3 rounded-2xl bg-slate-900/80 space-y-1.5 text-xs text-slate-300">
                        {order.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>{it.quantity}x {it.name}</span>
                            <span className="font-bold text-white">
                              {formatUsd(it.price * it.quantity)}
                              {rate?.rate > 0 && (
                                <span className="block text-[10px] text-slate-500 text-right">
                                  {formatBs(usdToBs(it.price * it.quantity, rate.rate))}
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                        <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-white text-sm">
                          <span>Total</span>
                          <span className="text-teal-400 text-right">
                            {formatUsd(order.total)}
                            {rate?.rate > 0 && (
                              <span className="block text-[10px] text-teal-300/90">
                                {formatBs(usdToBs(order.total, rate.rate))}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      {order.notes && (
                        <p className="text-xs text-slate-400 italic bg-slate-900/40 p-2 rounded-xl">
                          "{order.notes}"
                        </p>
                      )}

                      {/* Pago digital: comprobante y estado */}
                      {order.paymentMethod && order.paymentMethod !== 'efectivo' && (
                        <div className="space-y-2">
                          {order.paymentReference && (
                            <p className="text-xs text-slate-300 bg-slate-900/40 p-2 rounded-xl">
                              Ref: <span className="font-mono font-bold text-white">{order.paymentReference}</span>
                            </p>
                          )}
                          {order.paymentProof ? (
                            <button
                              onClick={() => setProofOrder(order)}
                              className="w-full flex items-center gap-3 p-2 rounded-xl bg-slate-900/60 border border-slate-700 hover:border-teal-500/40 transition-all text-left"
                            >
                              <img
                                src={order.paymentProof}
                                alt="Comprobante de pago"
                                className="w-14 h-14 rounded-lg object-cover border border-slate-700"
                              />
                              <span className="min-w-0">
                                <span className="block text-xs font-bold text-white">Ver comprobante</span>
                                <span className="block text-[11px] text-slate-400">Toca para ampliar</span>
                              </span>
                              <Icon name="eye" className="w-4 h-4 text-teal-400 ml-auto shrink-0" />
                            </button>
                          ) : (
                            <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl flex items-center gap-1.5">
                              <Icon name="alertTriangle" className="w-3.5 h-3.5" />
                              Pago digital sin comprobante adjunto
                            </p>
                          )}
                          {order.paymentStatus === 'pendiente' && (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => onUpdateOrderPayment(order.id, 'confirmado')}
                                className="py-2 px-2 rounded-xl text-xs font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1.5"
                              >
                                <Icon name="check" className="w-3.5 h-3.5" />
                                Confirmar pago
                              </button>
                              <button
                                onClick={() => onUpdateOrderPayment(order.id, 'rechazado')}
                                className="py-2 px-2 rounded-xl text-xs font-bold bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/25 transition-all flex items-center justify-center gap-1.5"
                              >
                                <Icon name="x" className="w-3.5 h-3.5" />
                                Rechazar pago
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Chat con el cliente */}
                      <OrderChat order={order} />
                    </div>

                    {/* Status Update Controls */}
                    <div className="pt-3 border-t border-slate-700/60 space-y-2">
                      <span className="text-[11px] text-slate-400 font-semibold block">Cambiar Estado:</span>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { key: 'pendiente', label: 'Pendiente' },
                          { key: 'en_preparacion', label: 'En Prep.' },
                          { key: 'listo', label: 'Listo' },
                          ...(order.type === 'delivery' ? [{ key: 'en_camino', label: 'En Camino' }] : []),
                          { key: 'entregado', label: 'Entregado' },
                          { key: 'cancelado', label: 'Cancelado' }
                        ].map((stBtn) => (
                          <button
                            key={stBtn.key}
                            onClick={() => onUpdateOrderStatus(order.id, stBtn.key)}
                            className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                              order.status === stBtn.key
                                ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-md'
                                : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:text-white'
                            }`}
                          >
                            {stBtn.label}
                          </button>
                        ))}
                      </div>

                      {/* Modo Repartidor: comparte el GPS mientras el pedido va en camino */}
                      {order.type === 'delivery' && order.status === 'en_camino' && (
                        <div className="pt-1">
                          {courierOrderId === order.id && courierActive ? (
                            <button
                              onClick={stopCourierTracking}
                              className="w-full py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold hover:bg-rose-500/25 transition-all flex items-center justify-center gap-1.5"
                            >
                              <Icon name="mapPin" className="w-3.5 h-3.5" />
                              Detener rastreo en vivo
                            </button>
                          ) : (
                            <button
                              onClick={() => startCourierTracking(order.id)}
                              className="w-full py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1.5"
                            >
                              <Icon name="mapPin" className="w-3.5 h-3.5" />
                              Comenzar entrega (GPS en vivo)
                            </button>
                          )}
                        </div>
                      )}

                      {/* Aprobar / Rechazar pedido a crédito (solo pendiente) */}
                      {order.credit && order.status === 'pendiente' && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => onUpdateOrderStatus(order.id, 'en_preparacion')}
                            className="py-2 px-2 rounded-xl text-xs font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1.5"
                          >
                            <Icon name="check" className="w-3.5 h-3.5" />
                            Aceptar y preparar
                          </button>
                          <button
                            onClick={() => onUpdateOrderStatus(order.id, 'cancelado')}
                            className="py-2 px-2 rounded-xl text-xs font-bold bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/25 transition-all flex items-center justify-center gap-1.5"
                          >
                            <Icon name="x" className="w-3.5 h-3.5" />
                            Rechazar
                          </button>
                        </div>
                      )}

                      {/* Eliminar pedido cancelado (para no acumular en la lista) */}
                      {order.status === 'cancelado' && (
                        <button
                          onClick={() => onDeleteOrder(order)}
                          className="w-full py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold text-xs hover:bg-rose-500/25 transition-all flex items-center justify-center gap-1.5"
                        >
                          <Icon name="trash" className="w-3.5 h-3.5" />
                          Eliminar pedido
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Promos */}
      {adminTab === 'promos' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Icon name="sparkles" className="w-5 h-5 text-teal-400" />
                Promos de la Tienda
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Estas ofertas se muestran como banner en la vista de clientes. Se guardan en la nube al instante.
              </p>
            </div>
            <button
              onClick={openNewPromo}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-teal-500 text-slate-950 text-sm font-bold hover:bg-teal-400 transition-all shadow-lg shadow-teal-500/20 self-start sm:self-auto"
            >
              <Icon name="plus" className="w-4 h-4" />
              Nueva Promo
            </button>
          </div>

          {promos.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-2 bg-slate-800/40 border border-slate-800 rounded-3xl">
              <Icon name="sparkles" className="w-12 h-12 text-slate-700 mx-auto" />
              <p className="font-bold text-slate-400">No hay promos activas</p>
              <p className="text-xs">Crea tu primera oferta para destacarla en la tienda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {promos.map((promo) => (
                <div
                  key={promo.id}
                  className={`p-4 sm:p-5 rounded-3xl bg-gradient-to-br border shadow-xl flex gap-3 sm:gap-4 items-center ${
                    promo.active
                      ? 'from-teal-500/15 to-slate-800/60 border-teal-500/40'
                      : 'from-slate-800/40 to-slate-800/20 border-slate-700/50 opacity-70'
                  }`}
                >
                  {promo.image ? (
                    <img src={promo.image} alt={promo.title} className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover bg-slate-800 flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <Icon name="sparkles" className="w-6 h-6 text-slate-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-sm sm:text-base truncate">{promo.title}</h4>
                      {!promo.active && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[10px] font-bold">Inactiva</span>
                      )}
                    </div>
                    {promo.subtitle && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{promo.subtitle}</p>}
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEditPromo(promo)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-700 text-xs font-bold text-slate-200 hover:text-white"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => onSavePromos(promos.filter((p) => p.id !== promo.id))}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-bold text-rose-400 hover:bg-rose-500/20"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Notificaciones Push */}
          <div className="p-4 sm:p-6 rounded-3xl bg-slate-800/60 border border-slate-700 space-y-4">
            <div className="flex items-center gap-2">
              <Icon name="bell" className="w-5 h-5 text-teal-400" />
              <div>
                <h4 className="font-bold text-white text-sm">Notificaciones Push</h4>
                <p className="text-[11px] text-slate-400">
                  Envía avisos directos al teléfono de los clientes que activaron las notificaciones.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2.5">
                <span className="text-xs font-bold text-slate-200 block">Notificación a todos</span>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="Título (ej: ¡Nuevas promos!)"
                  maxLength={80}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:border-teal-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={broadcastBody}
                  onChange={(e) => setBroadcastBody(e.target.value)}
                  placeholder="Mensaje (ej: Visita la tienda y aprovecha 2x1 esta semana)"
                  maxLength={200}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:border-teal-500 focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => handlePushBroadcast()}
                    disabled={!broadcastTitle.trim()}
                    className="py-2.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs disabled:opacity-50 disabled:pointer-events-none transition-all active:scale-95"
                  >
                    Enviar a todos
                  </button>
                  <button
                    onClick={() => handlePushTest()}
                    className="py-2.5 rounded-xl bg-slate-700 text-slate-200 font-bold text-xs hover:bg-slate-600 transition-all active:scale-95"
                  >
                    Enviar prueba
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2.5">
                <span className="text-xs font-bold text-slate-200 block">Recordatorio de deuda</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={reminderPhone}
                  onChange={(e) => setReminderPhone(e.target.value)}
                  placeholder="Teléfono del cliente (0412 1234567)"
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:border-teal-500 focus:outline-none"
                />
                <button
                  onClick={() => handlePushReminder()}
                  disabled={!reminderPhone.trim()}
                  className="w-full py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs hover:bg-amber-500/30 transition-all disabled:opacity-50 disabled:pointer-events-none active:scale-95"
                >
                  Enviar recordatorio
                </button>
                <p className="text-[10px] text-slate-500">
                  El cliente recibe: "Recordatorio de deuda" con el saldo pendiente.
                </p>
              </div>
            </div>
          </div>

          {/* Promo Editor Modal */}
          {isPromoModalOpen && promoDraft && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
              <div className="w-full sm:max-w-md p-5 sm:p-6 rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl animate-screen-up space-y-4 max-h-[92vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-lg">{promoDraft.id.startsWith('promo-') ? 'Nueva Promo' : 'Editar Promo'}</h4>
                  <button onClick={() => setIsPromoModalOpen(false)} className="text-slate-400 hover:text-white">
                    <Icon name="x" className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Título *</label>
                    <input
                      type="text"
                      value={promoDraft.title}
                      onChange={(e) => setPromoDraft({ ...promoDraft, title: e.target.value })}
                      placeholder="Ej: 2x1 en refrescos"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Subtítulo</label>
                    <input
                      type="text"
                      value={promoDraft.subtitle || ''}
                      onChange={(e) => setPromoDraft({ ...promoDraft, subtitle: e.target.value })}
                      placeholder="Ej: Válido solo por esta semana"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Imagen (URL opcional)</label>
                    <input
                      type="text"
                      value={promoDraft.image || ''}
                      onChange={(e) => setPromoDraft({ ...promoDraft, image: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={promoDraft.active}
                      onChange={(e) => setPromoDraft({ ...promoDraft, active: e.target.checked })}
                      className="w-4 h-4 accent-teal-500"
                    />
                    Promo activa
                  </label>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleSavePromo(promoDraft)}
                    disabled={!promoDraft.title.trim()}
                    className="flex-1 py-3 rounded-2xl bg-teal-500 text-slate-950 font-bold text-sm hover:bg-teal-400 transition-all disabled:opacity-40"
                  >
                    Guardar Promo
                  </button>
                  {promoDraft.id.startsWith('promo-') && (
                    <button
                      onClick={() => handleDeletePromo(promoDraft.id)}
                      className="px-4 py-3 rounded-2xl bg-rose-500/10 text-rose-400 font-bold text-sm border border-rose-500/30 hover:bg-rose-500/20"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Beneficiados */}
      {adminTab === 'benefited' && (
        <div className="p-4 sm:p-8 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-2xl backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-lg font-bold text-white">Clientes Beneficiados</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Los beneficiados pueden enviar pedidos a crédito (sumar a su cuenta).
              </p>
            </div>
            <button
              onClick={onLoadCustomers}
              className="px-3 py-2 rounded-xl bg-slate-700 text-slate-100 text-xs font-bold hover:bg-slate-600 transition-colors"
            >
              Actualizar lista
            </button>
          </div>

          {allCustomers.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No hay clientes registrados aún.</p>
          ) : (
            <div className="grid gap-2">
              {allCustomers.map((c) => (
                <div
                  key={c.phone}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-700/60"
                >
                  <span
                    className={`p-2 rounded-xl shrink-0 ${
                      c.isBenefited ? 'bg-teal-500/20 text-teal-400' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <Icon name="user" className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-100 truncate">{c.customerName || 'Cliente'}</p>
                    <p className="text-[11px] text-slate-400">{c.phone}</p>
                  </div>
                  <button
                    onClick={() => onToggleBenefited(c.phone, !c.isBenefited)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      c.isBenefited
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        : 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 hover:from-teal-400 hover:to-emerald-400'
                    }`}
                  >
                    {c.isBenefited ? 'Revocar beneficio' : 'Dar beneficio'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Lista Negra */}
      {adminTab === 'blacklist' && (
        <BlacklistAdminView
          customers={allCustomers}
          orders={orders}
          rate={rate}
          products={products}
          onLoadCustomers={onLoadCustomers}
          onAddToBlacklist={onAddToBlacklist}
          onAddBlacklistDebt={onAddBlacklistDebt}
          collections={collections}
          onUpsertCollection={onUpsertCollection}
          onDeleteCollection={onDeleteCollection}
        />
      )}

      {/* Tab: Tienda — ubicación fija del comercio */}
      {adminTab === 'tienda' && (
        <div className="p-4 sm:p-8 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-2xl backdrop-blur-md space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Icon name="store" className="w-5 h-5 text-teal-400" />
              Ubicación del Comercio
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Esta es la dirección fija del negocio. Aparece en el rastreo del cliente como punto de origen
              de la entrega. Cualquier administrador puede actualizarla.
            </p>
          </div>

          {storeLocation ? (
            <div className="rounded-2xl bg-slate-900 border border-slate-700/60 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="p-2.5 rounded-xl bg-teal-500/20 text-teal-400 shrink-0">
                <Icon name="store" className="w-5 h-5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400">Comercio configurado</p>
                {storeLocation.address && (
                  <p className="text-sm font-bold text-white truncate">{storeLocation.address}</p>
                )}
                <p className="text-[11px] text-slate-500">
                  {Number(storeLocation.lat).toFixed(6)}, {Number(storeLocation.lng).toFixed(6)}
                </p>
              </div>
              <a
                href={`https://www.google.com/maps?q=${Number(storeLocation.lat)},${Number(storeLocation.lng)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl bg-sky-500/15 border border-sky-500/40 text-sky-300 text-xs font-bold hover:bg-sky-500/25 transition-all inline-flex items-center gap-1.5"
              >
                <Icon name="mapPin" className="w-3.5 h-3.5" />
                Abrir en Maps
              </a>
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-900 border border-slate-700/60 p-4 text-sm text-slate-400">
              Aún no configuraste la ubicación del comercio. Usa el botón para elegirla en el mapa.
            </div>
          )}

          <button
            onClick={() => setShowStorePicker(true)}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-sm hover:from-teal-400 hover:to-emerald-400 shadow-lg shadow-teal-500/20 transition-all inline-flex items-center gap-2"
          >
            <Icon name="mapPin" className="w-4 h-4" />
            {storeLocation ? 'Cambiar ubicación del comercio' : 'Configurar ubicación'}
          </button>

          {showStorePicker && (
            <MapPickerModal
              title="Ubicación del comercio"
              initial={storeLocation?.lat != null ? { lat: storeLocation.lat, lng: storeLocation.lng } : null}
              onPick={async (p) => {
                const ok = await onSaveStoreLocation(p);
                if (ok) setShowStorePicker(false);
              }}
              onClose={() => setShowStorePicker(false)}
            />
          )}
        </div>
      )}

      {/* Tab 6: Analytics */}
      {adminTab === 'analytics' && (
        <div className="p-4 sm:p-8 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-2xl space-y-5 sm:space-y-6 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <Icon name="trendingUp" className="w-5 h-5 text-teal-400" />
              Resumen de Métricas del Negocio
            </h3>
            {lowStockMessage && (
              <a
                href={`https://wa.me/?text=${encodeURIComponent(lowStockMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 transition-all text-xs font-bold w-fit"
              >
                <Icon name="whatsapp" className="w-4 h-4" />
                Enviar alerta de stock bajo por WhatsApp
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h4 className="font-bold text-slate-200 text-sm">Productos con Mayor Demanda</h4>
              {topByDemand.length === 0 ? (
                <p className="text-xs text-slate-400">Aún no hay ventas registradas para calcular la demanda.</p>
              ) : (
                <ul className="space-y-3">
                  {topByDemand.map((p, idx) => (
                    <li key={p.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">#{idx + 1} {p.name}</span>
                      <span className="text-teal-400 font-bold">{p.quantity} un. vendidas</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h4 className="font-bold text-slate-200 text-sm">Estado de Stock Crítico</h4>
              <ul className="space-y-3">
                {lowStockProducts.length === 0 ? (
                  <p className="text-xs text-emerald-400">¡Excelente! Todo el catálogo cuenta con stock suficiente.</p>
                ) : (
                  lowStockProducts.map((p) => (
                    <li key={p.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">{p.name}</span>
                      <span className="text-amber-400 font-bold">{p.stock} un. restantes</span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Tendencia de ventas por día */}
            <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h4 className="font-bold text-slate-200 text-sm">Ventas por Día (últimos 7 días)</h4>
              <div className="flex items-end gap-2 h-32">
                {salesByDay.map((d) => {
                  const max = Math.max(...salesByDay.map((x) => x.orders), 1);
                  const h = Math.round((d.orders / max) * 100);
                  return (
                    <div key={d.key} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                      <span className="text-[10px] font-bold text-slate-300">{d.orders}</span>
                      <div
                        className={`w-full rounded-t-lg ${d.orders > 0 ? 'bg-gradient-to-t from-teal-600 to-emerald-400' : 'bg-slate-700/50'}`}
                        style={{ height: `${Math.max(d.orders > 0 ? h : 4, 4)}%` }}
                      />
                      <span className="text-[9px] text-slate-500 capitalize truncate">{d.label}</span>
                    </div>
                  );
                })}
              </div>
              {salesByDay.some((d) => d.revenue > 0) && (
                <p className="text-[11px] text-slate-400">
                  Ingresos (entregados) 7 días:{' '}
                  <span className="font-bold text-teal-300">{formatUsd(salesByDay.reduce((a, d) => a + d.revenue, 0))}</span>
                </p>
              )}
            </div>

            {/* Segmentación de clientes */}
            <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h4 className="font-bold text-slate-200 text-sm">Clientes con Mayor Actividad</h4>
              {topCustomers.length === 0 ? (
                <p className="text-xs text-slate-400">Aún no hay pedidos registrados.</p>
              ) : (
                <ul className="space-y-3">
                  {topCustomers.map((c, idx) => (
                    <li key={c.phone} className="flex items-center justify-between text-xs gap-2">
                      <span className="text-slate-300 font-medium truncate">
                        #{idx + 1} {c.phone}
                      </span>
                      <span className="text-teal-400 font-bold shrink-0">{c.orders} pedidos</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-slate-500">
                Total clientes registrados: <span className="font-bold text-white">{allCustomers.length}</span>
              </p>
            </div>
          </div>
        </div>
      )}
      {overdueList.length === 1 && (
        <OverdueCollectionToast
          collection={overdueList[0]}
          onSend={() => handleSendOverdue(overdueList[0])}
          onDismiss={() => handleDismissOverdue(overdueList[0])}
        />
      )}
      {overdueList.length > 1 && (
        <OverdueCollectionsModal
          collections={overdueList}
          onSend={handleSendOverdue}
          onDismiss={handleDismissOverdue}
        />
      )}

      {proofOrder && (
        <PaymentProofModal
          order={proofOrder}
          onClose={() => setProofOrder(null)}
          onUpdateOrderPayment={onUpdateOrderPayment}
        />
      )}
    </div>
  );
}

// Modal para que el admin revise el comprobante de pago a pantalla completa
// y confirme o rechace el pago digital.
function PaymentProofModal({ order, onClose, onUpdateOrderPayment }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden z-10 animate-scale-up">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-black text-white">
              Comprobante #{order.id}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {({ pago_movil: 'Pago Móvil', transferencia: 'Transferencia' })[order.paymentMethod] || 'Pago digital'} ·{' '}
              {order.customerName}
              {order.paymentReference ? ` · Ref ${order.paymentReference}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          {order.paymentProof ? (
            <img
              src={order.paymentProof}
              alt="Comprobante de pago"
              className="w-full rounded-2xl border border-slate-700 object-contain max-h-[55vh]"
            />
          ) : (
            <p className="text-xs text-slate-400 bg-slate-800/60 p-4 rounded-2xl text-center">
              Este pedido no tiene comprobante adjunto.
            </p>
          )}
          {order.paymentStatus === 'pendiente' && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onUpdateOrderPayment(order.id, 'confirmado')}
                className="py-3 rounded-xl text-xs font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1.5"
              >
                <Icon name="check" className="w-4 h-4" />
                Confirmar pago
              </button>
              <button
                onClick={() => onUpdateOrderPayment(order.id, 'rechazado')}
                className="py-3 rounded-xl text-xs font-bold bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/25 transition-all flex items-center justify-center gap-1.5"
              >
                <Icon name="x" className="w-4 h-4" />
                Rechazar pago
              </button>
            </div>
          )}
          {order.paymentStatus === 'confirmado' && (
            <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl text-center font-bold">
              Pago confirmado
            </p>
          )}
          {order.paymentStatus === 'rechazado' && (
            <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl text-center font-bold">
              Pago rechazado
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Chat interno de un pedido para el admin: consulta y envía mensajes con el
// cliente (el cliente responde desde el rastreo del pedido). Se actualiza cada 5s.
function OrderChat({ order }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const load = async () => {
    const res = await api.getOrderMessages(order.id, order.phone);
    if (res.ok && Array.isArray(res.data.messages)) setMessages(res.data.messages);
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [order.id]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    const res = await api.sendOrderMessage(order.id, order.phone, value);
    setSending(false);
    if (res.ok) {
      setText('');
      load();
    }
  };

  return (
    <div className="rounded-2xl bg-slate-900/60 border border-slate-700 overflow-hidden">
      <div className="p-2.5 border-b border-slate-700/70 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
          <Icon name="whatsapp" className="w-3.5 h-3.5 text-emerald-400" />
          Chat con el cliente
        </span>
        <span className="text-[9px] text-slate-500">se actualiza solo</span>
      </div>
      <div ref={listRef} className="p-2.5 space-y-1.5 max-h-44 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-[11px] text-slate-500 text-center py-2">Sin mensajes aún.</p>
        )}
        {messages.map((m, idx) => {
          const mine = m.from === 'admin';
          return (
            <div key={idx} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-2.5 py-1.5 rounded-2xl text-[11px] leading-snug ${
                  mine ? 'bg-teal-500/20 text-teal-100 rounded-br-md' : 'bg-slate-700/70 text-slate-200 rounded-bl-md'
                }`}
              >
                <p className="break-words">{m.text}</p>
                {m.createdAt && (
                  <p className={`text-[9px] mt-0.5 ${mine ? 'text-teal-300/70' : 'text-slate-400'}`}>
                    {new Date(m.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="p-2.5 border-t border-slate-700/70 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
          placeholder="Responder al cliente…"
          maxLength={300}
          className="flex-1 min-w-0 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:border-teal-500 focus:outline-none"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="shrink-0 px-3 py-2 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs disabled:opacity-50 disabled:pointer-events-none transition-all active:scale-95"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}

const BEAUTY_CATEGORIES = ['higiene', 'limpieza', 'perfum', 'cosmetic', 'belleza', 'farmacia', 'salud', 'cuidado'];
// Toast persistente de cobro vencido. No se quita solo; el admin debe pulsar
// "Enviar cobro" (abre WhatsApp) o "✕" (descartar en esta sesión).
function OverdueCollectionToast({ collection, onSend, onDismiss }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-xl border border-amber-500/40 bg-slate-900/95 p-4 shadow-2xl backdrop-blur">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-400">Cobro programado vencido</p>
        <p className="mt-1 text-sm text-slate-200">
          Envío de cobro programado para <span className="font-bold text-white">{collection.customerName || collection.phone}</span>
        </p>
      </div>
      <button
        onClick={onSend}
        className="shrink-0 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-400"
      >
        Enviar cobro
      </button>
      <button
        onClick={onDismiss}
        aria-label="Descartar"
        className="shrink-0 rounded-lg bg-slate-700 px-2 py-2 text-xs font-bold text-slate-200 hover:bg-slate-600"
      >
        ✕
      </button>
    </div>
  );
}

// Modal con todos los cobros vencidos. El admin los envía uno a uno; al
// enviar uno se quita de la lista. Si lo descarta, se oculta en esta sesión.
function OverdueCollectionsModal({ collections, onSend, onDismiss }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-800 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-100">Cobros programados vencidos</h3>
            <p className="text-xs text-slate-400">Envía cada uno a WhatsApp manualmente.</p>
          </div>
        </div>
        <ul className="max-h-[60vh] divide-y divide-slate-800 overflow-y-auto">
          {collections.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-200">{c.customerName || c.phone}</p>
                <p className="text-xs text-slate-400">{c.id}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => onSend(c)}
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-400"
                >
                  Enviar cobro
                </button>
                <button
                  onClick={() => onDismiss(c)}
                  aria-label="Descartar"
                  className="rounded-lg bg-slate-700 px-2 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-600"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function BlacklistAdminView({
  customers,
  orders,
  rate,
  products,
  onLoadCustomers,
  onAddToBlacklist,
  onAddBlacklistDebt,
  collections,
  onUpsertCollection,
  onDeleteCollection
}) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedDebtor, setSelectedDebtor] = useState(null); // customer abierto
  const [isAddProductsOpen, setIsAddProductsOpen] = useState(false);

  const debtors = customers.filter((c) => (Number(c.balance) || 0) > 0);

  const handleAdd = async (e) => {
    e.preventDefault();
    const ok = await onAddToBlacklist(phone.replace(/\D/g, ''), name, amount);
    if (ok) {
      setPhone('');
      setName('');
      setAmount('');
    }
  };

  const handleAddDebt = async ({ phone: targetPhone, name: targetName, items }) => {
    const ok = await onAddBlacklistDebt({ phone: targetPhone, name: targetName, items });
    if (ok) {
      setIsAddProductsOpen(false);
      setSelectedDebtor(null);
    }
  };

  const handleClearDebt = (customer) => {
    if (window.confirm(`¿Saldar la deuda de ${customer.customerName || customer.phone}?`)) {
      onAddToBlacklist(customer.phone.replace(/\D/g, ''), customer.customerName, '0');
    }
  };

  return (
    <div className="p-4 sm:p-8 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-2xl backdrop-blur-md space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">Lista Negra · Deudores</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Clientes con saldo pendiente. Toca un deudor para ver el desglose, enviar la cuenta por WhatsApp o programar el cobro.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsAddProductsOpen(true)}
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 text-xs font-bold hover:from-teal-400 hover:to-emerald-400 transition-colors flex items-center gap-1.5"
          >
            <Icon name="plus" className="w-4 h-4" />
            Añadir productos
          </button>
          <button
            onClick={onLoadCustomers}
            className="px-3 py-2 rounded-xl bg-slate-700 text-slate-100 text-xs font-bold hover:bg-slate-600 transition-colors"
          >
            Actualizar lista
          </button>
        </div>
      </div>

      <form
        onSubmit={handleAdd}
        className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end p-4 rounded-2xl bg-slate-900 border border-slate-700/60"
      >
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Teléfono *</label>
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0414 1234567"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del deudor"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Deuda (USD) *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-amber-500 text-slate-950 text-sm font-bold hover:from-red-400 hover:to-amber-400 shadow-lg shadow-red-500/20 transition-all"
        >
          Añadir a la lista negra
        </button>
      </form>

      {debtors.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">No hay deudores registrados.</p>
      ) : (
        <div className="grid gap-2">
          {debtors.map((c) => (
            <div
              key={c.phone}
              className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-700/60 hover:border-amber-500/40 cursor-pointer transition-all"
              onClick={() => setSelectedDebtor(c)}
            >
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                <Icon name="alertTriangle" className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-100 truncate">{c.customerName || 'Cliente'}</p>
                <p className="text-[11px] text-slate-400">{c.phone}</p>
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                <span className="block text-base font-black text-red-400">
                  {formatUsd(Number(c.balance) || 0)}
                </span>
                <span className="text-[10px] text-amber-400/80 flex items-center gap-0.5">
                  <Icon name="chevronRight" className="w-3 h-3" />
                  Ver detalle
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de detalle de deuda */}
      {selectedDebtor && (
        <DebtDetailModal
          customer={selectedDebtor}
          orders={orders}
          rate={rate}
          onClose={() => setSelectedDebtor(null)}
          onClearDebt={handleClearDebt}
          collections={collections}
          onUpsertCollection={onUpsertCollection}
          onDeleteCollection={onDeleteCollection}
        />
      )}

      {/* Modal para añadir productos a la deuda de un cliente */}
      {isAddProductsOpen && (
        <AddDebtProductsModal
          products={products}
          rate={rate}
          customers={customers}
          onClose={() => setIsAddProductsOpen(false)}
          onConfirm={handleAddDebt}
        />
      )}
    </div>
  );
}

// Modal que permite registrar una deuda por productos (ventas presenciales o
// deudas anteriores a la app). Muestra el catálogo actual y deja elegir
// cantidades; al confirmar crea un pedido a crédito entregado para el cliente.
function AddDebtProductsModal({ products, rate, customers, onClose, onConfirm }) {
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [category, setCategory] = useState('Todas');
  const [search, setSearch] = useState('');
  const [qty, setQty] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const categories = ['Todas', ...new Set((products || []).map((p) => p.category).filter(Boolean))];

  const filtered = (products || []).filter((p) => {
    if (category !== 'Todas' && p.category !== category) return false;
    if (search && !`${p.name} ${p.brand || ''} ${p.code || ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selectedItems = (products || [])
    .filter((p) => Number(qty[p.id]) > 0)
    .map((p) => ({ id: p.id, name: p.name, price: p.price, quantity: Number(qty[p.id]) }));
  const total = selectedItems.reduce((acc, it) => acc + Number(it.price || 0) * it.quantity, 0);

  const changeQty = (id, delta) => {
    setQty((prev) => {
      const next = Math.max(0, (Number(prev[id]) || 0) + delta);
      return { ...prev, [id]: next };
    });
  };

  const pickCustomer = (phone) => {
    const c = (customers || []).find((x) => normalizePhoneDigits(x.phone) === normalizePhoneDigits(phone));
    setCustomerPhone(phone);
    if (c) setCustomerName(c.customerName || '');
  };

  const handleConfirm = async () => {
    const key = customerPhone.replace(/\D/g, '').slice(-11);
    if (key.length < 7) {
      setError('Ingresa el número de teléfono del deudor');
      return;
    }
    if (selectedItems.length === 0) {
      setError('Selecciona al menos un producto');
      return;
    }
    setError('');
    setSubmitting(true);
    await onConfirm({ phone: key, name: customerName, items: selectedItems });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-screen-up max-h-[92vh] flex flex-col">
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Icon name="package" className="w-5 h-5 text-amber-400" />
              Añadir productos a la deuda
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Selecciona el cliente y los productos que debe (ventas presenciales o deudas viejas).
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Deudor (cliente registrado)</label>
              <select
                value=""
                onChange={(e) => e.target.value && pickCustomer(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none"
              >
                <option value="">— Seleccionar deudor existente —</option>
                {(customers || []).map((c) => (
                  <option key={c.phone} value={c.phone}>
                    {c.customerName || 'Cliente'} · {c.phone} · {formatUsd(Number(c.balance) || 0)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Teléfono *</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={customerPhone}
                  onChange={(e) => pickCustomer(e.target.value)}
                  placeholder="0414 1234567"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nombre del deudor"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Filtros del catálogo */}
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto…"
              className="flex-1 min-w-[180px] px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Catálogo con cantidades */}
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No hay productos en el catálogo.</p>
            ) : (
              filtered.map((p) => {
                const n = Number(qty[p.id]) || 0;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${n > 0 ? 'bg-amber-500/10 border-amber-500/40' : 'bg-slate-950 border-slate-800'}`}
                  >
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-11 h-11 rounded-lg object-cover bg-slate-900 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-100 truncate">{p.name}</p>
                      <p className="text-[11px] text-teal-400 font-semibold">
                        {formatUsd(p.price)}
                        {rate?.rate > 0 && (
                          <span className="block text-[10px] text-slate-500">{formatBs(usdToBs(p.price, rate.rate))}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700 shrink-0">
                      <button
                        onClick={() => changeQty(p.id, -1)}
                        className="p-1 rounded text-slate-400 hover:text-white"
                      >
                        <Icon name="minus" className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold w-6 text-center text-white">{n}</span>
                      <button
                        onClick={() => changeQty(p.id, 1)}
                        className="p-1 rounded text-slate-400 hover:text-white"
                      >
                        <Icon name="plus" className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Pie */}
        <div className="p-4 sm:p-6 border-t border-slate-800 shrink-0">
          {error && (
            <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 mb-3">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                Total a cargar a la deuda
              </span>
              <span className="text-lg font-black text-amber-400">
                {formatUsd(total)}
                {rate?.rate > 0 && (
                  <span className="block text-[10px] text-slate-500">{formatBs(usdToBs(total, rate.rate))}</span>
                )}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-bold hover:bg-slate-700 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-amber-500 text-slate-950 text-sm font-bold hover:from-red-400 hover:to-amber-400 shadow-lg shadow-red-500/20 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5"
              >
                <Icon name="check" className="w-4 h-4" />
                {submitting ? 'Guardando…' : 'Añadir a la deuda'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Desglosa los pedidos de un deudor y ofrece enviar la cuenta por WhatsApp
// o programar el cobro (cuenta + fecha) para envío automático.
function DebtDetailModal({
  customer,
  orders,
  rate,
  onClose,
  onClearDebt,
  collections,
  onUpsertCollection,
  onDeleteCollection
}) {
  const [showScheduler, setShowScheduler] = useState(false);

  const key = normalizePhoneDigits(customer.phone);
  // Pedidos del cliente que han sido entregados y a crédito = deuda contraída.
  const debtOrders = (orders || [])
    .filter((o) => normalizePhoneDigits(o.phone) === key && o.credit && o.status === 'entregado')
    .sort((a, b) => new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp));
  const debtTotal = debtOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);

  const wa = formatPhoneWhatsApp(customer.phone);

  const accountMsg = buildAccountMessage(customer, orders);
  const waLink = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(accountMsg)}` : undefined;

  const upcoming = collections
    .filter((c) => normalizePhoneDigits(c.phone) === key && (c.status === 'programado' || c.status === 'pendiente'))
    .sort((a, b) => new Date(a.dueAt || 0) - new Date(b.dueAt || 0));

  const overdue = futureCollectionDue(upcoming); // helper para destacar vencidos

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-screen-up max-h-[92vh] flex flex-col">
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Icon name="alertTriangle" className="w-5 h-5 text-amber-400" />
              {customer.customerName || 'Cliente'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{customer.phone} · Deuda total {formatUsd(Number(customer.balance) || 0)}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Acciones principales */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={waLink ? undefined : (e) => e.preventDefault()}
              className="py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1.5 text-center"
            >
              <Icon name="whatsapp" className="w-4 h-4" />
              Enviar cuenta a WhatsApp
            </a>
            <button
              onClick={() => setShowScheduler((v) => !v)}
              className="py-3 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-bold hover:bg-cyan-500/25 transition-all flex items-center justify-center gap-1.5"
            >
              <Icon name="clock" className="w-4 h-4" />
              {showScheduler ? 'Cerrar cobro' : 'Programar cobro'}
            </button>
          </div>

          {/* Programador de cobro */}
          {showScheduler && (
            <CollectionScheduler
              customer={customer}
              orders={orders}
              collections={upcoming}
              onUpsertCollection={onUpsertCollection}
              onDeleteCollection={onDeleteCollection}
            />
          )}

          {/* Desglose de deuda */}
          <div className="space-y-2">
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider flex items-center justify-between">
              <span>Desglose de la deuda ({debtOrders.length} pedidos)</span>
              <span className="text-red-400 font-black text-sm">{formatUsd(debtTotal)}</span>
            </span>
            {debtOrders.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-900/50 p-3 rounded-xl">
                Este deudor no tiene pedidos a crédito entregados registrados en el historial; la deuda se cargó manualmente.
              </p>
            ) : (
              debtOrders.map((o) => (
                <div key={o.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-cyan-400">{o.id}</span>
                    <span className="text-slate-500">{new Date(o.createdAt || o.timestamp).toLocaleDateString('es-VE')}</span>
                  </div>
                  {Array.isArray(o.items) ? o.items.map((it, i) => (
                    <div key={i} className="flex justify-between text-xs text-slate-300">
                      <span>{it.quantity}x {it.name}</span>
                      <span className="font-bold text-white">
                        {formatUsd(it.price * it.quantity)}
                        {rate?.rate > 0 && (
                          <span className="block text-[10px] text-slate-500 text-right">
                            {formatBs(usdToBs(it.price * it.quantity, rate.rate))}
                          </span>
                        )}
                      </span>
                    </div>
                  )) : null}
                  <div className="pt-1.5 border-t border-slate-800 flex justify-between font-bold text-xs">
                    <span className="text-slate-400">Total</span>
                    <span className="text-amber-400 text-right">
                      {formatUsd(o.total)}
                      {rate?.rate > 0 && (
                        <span className="block text-[10px] text-slate-500">{formatBs(usdToBs(o.total, rate.rate))}</span>
                      )}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pie */}
        <div className="p-4 sm:p-6 border-t border-slate-800 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              {overdue > 0 ? `${overdue} cobro(s) vencido(s)` : 'Sin cobros programados pendientes'}
            </span>
            <button
              onClick={() => {
                if (window.confirm(`¿Saldar la deuda de ${customer.customerName || customer.phone}?`)) {
                  onClearDebt(customer);
                  onClose();
                }
              }}
              className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition-all"
            >
              Saldar deuda
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Modal que el cliente ve en "Mi Cuenta": desglose de su deuda con conversión
// a bolívares según la tasa del día.
function CustomerDebtModal({ customer, orders, rate, onClose }) {
  const key = normalizePhoneDigits(customer.phone);
  const debtOrders = (orders || [])
    .filter((o) => normalizePhoneDigits(o.phone) === key && o.credit && o.status === 'entregado')
    .sort((a, b) => new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp));
  // El balance del cliente es la fuente autoritativa (lo actualiza el servidor al
  // pasar un pedido a entregado o al saldar la deuda); el desglose por pedidos
  // es solo un detalle informativo.
  const debtTotal = Number(customer.balance) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-screen-up max-h-[92vh] flex flex-col">
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Icon name="creditCard" className="w-5 h-5 text-indigo-400" />
              Mi deuda
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {customer.customerName || customer.phone} · Total {formatUsd(debtTotal)}
              {rate?.rate > 0 && <span className="block text-[10px] text-slate-500">{formatBs(usdToBs(debtTotal, rate.rate))} a Bs {Number(rate.rate).toFixed(2)}</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          <div className="space-y-2">
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider flex items-center justify-between">
              <span>Detalle de la deuda ({debtOrders.length} pedidos)</span>
              <span className="text-red-400 font-black text-sm">{formatUsd(debtTotal)}</span>
            </span>
            {debtOrders.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-900/50 p-3 rounded-xl">
                {debtTotal > 0
                  ? 'Tu saldo deudor está registrado manualmente; no hay pedidos a crédito pendientes en el historial.'
                  : 'No tienes deudas registradas en este momento.'}
              </p>
            ) : (
              debtOrders.map((o) => (
                <div key={o.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-cyan-400">{o.id}</span>
                    <span className="text-slate-500">{new Date(o.createdAt || o.timestamp).toLocaleDateString('es-VE')}</span>
                  </div>
                  {Array.isArray(o.items) ? o.items.map((it, i) => (
                    <div key={i} className="flex justify-between text-xs text-slate-300">
                      <span>{it.quantity}x {it.name}</span>
                      <span className="font-bold text-white">
                        {formatUsd(it.price * it.quantity)}
                        {rate?.rate > 0 && (
                          <span className="block text-[10px] text-slate-500 text-right">
                            {formatBs(usdToBs(it.price * it.quantity, rate.rate))}
                          </span>
                        )}
                      </span>
                    </div>
                  )) : null}
                  <div className="pt-1.5 border-t border-slate-800 flex justify-between font-bold text-xs">
                    <span className="text-slate-400">Total</span>
                    <span className="text-amber-400 text-right">
                      {formatUsd(o.total)}
                      {rate?.rate > 0 && (
                        <span className="block text-[10px] text-slate-500">{formatBs(usdToBs(o.total, rate.rate))}</span>
                      )}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-4 sm:p-6 border-t border-slate-800 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">Total deuda en bolívares</span>
            <span className="text-base font-black text-red-400">
              {formatUsd(debtTotal)}
              {rate?.rate > 0 && (
                <span className="block text-[10px] font-bold text-slate-400 text-right">{formatBs(usdToBs(debtTotal, rate.rate))}</span>
              )}
            </span>
          </div>
          <button
            onClick={onClose}
            className="mt-3 w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm font-bold transition-all"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

// Formulario para programar una fecha/hora de cobro y listar los programados.
function CollectionScheduler({ customer, orders, collections, onUpsertCollection, onDeleteCollection }) {
  const [dueAt, setDueAt] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!dueAt) return;
    setSaving(true);
    await onUpsertCollection({
      phone: customer.phone,
      customerName: customer.customerName || 'Cliente',
      dueAt: new Date(dueAt).toISOString(),
      note,
      status: 'programado'
    });
    setSaving(false);
    setDueAt('');
    setNote('');
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-500/30 space-y-3">
      <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
        <Icon name="clock" className="w-3.5 h-3.5" />
        Programar cobro automático
      </span>
      <form onSubmit={handleSchedule} className="space-y-2">
        <label className="block text-[11px] text-slate-400 font-semibold">Fecha y hora del envío automático *</label>
        <input
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-cyan-500 focus:outline-none"
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota opcional (ej: recordatorio de tu compra pendiente)"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-cyan-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={saving || !dueAt}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 text-xs font-bold hover:from-cyan-400 hover:to-teal-400 disabled:opacity-40 transition-all"
        >
          {saving ? 'Guardando...' : 'Programar envío'}
        </button>
      </form>

      {collections.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Cobros programados</span>
          {collections.map((c) => {
            const isPast = new Date(c.dueAt || 0) < new Date();
            return (
              <div key={c.id} className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800">
                <span className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-400 shrink-0">
                  <Icon name="clock" className="w-3.5 h-3.5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-100">
                    {c.dueAt ? new Date(c.dueAt).toLocaleString('es-VE') : 'Sin fecha'}
                    {isPast && c.status === 'programado' && <span className="text-rose-400"> · vencido</span>}
                  </p>
                  {c.note && <p className="text-[10px] text-slate-500 truncate">{c.note}</p>}
                </div>
                <div className="flex items-center gap-1">
                  {isPast && c.status === 'programado' && (
                    <button
                      onClick={() => {
                        const wa = formatPhoneWhatsApp(customer.phone);
                        const msg = c.note
                          ? `${buildAccountMessage(customer, orders)}\n\n_${c.note}_`
                          : buildAccountMessage(customer, orders);
                        if (wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
                      }}
                      className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-[10px] font-bold hover:bg-emerald-500/25"
                    >
                      Enviar ahora
                    </button>
                  )}
                  <button
                    onClick={() => onDeleteCollection(c.id)}
                    className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-300 text-[10px] font-bold hover:bg-rose-500/25"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Cuenta los cobros programados vencidos (sin enviar).
function futureCollectionDue(list) {
  const now = new Date();
  return list.filter((c) => c.status === 'programado' && new Date(c.dueAt || 0) < now).length;
}

// Construye el mensaje con el desglose de la deuda de un cliente, para enviar
// por WhatsApp (transparencia ante discrepancias).
function buildAccountMessage(customer, orders) {
  const key = normalizePhoneDigits(customer.phone);
  const debtOrders = (orders || [])
    .filter((o) => normalizePhoneDigits(o.phone) === key && o.credit && o.status === 'entregado')
    .sort((a, b) => new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp));
  const debtTotal = debtOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);

  const lines = [
    `Hola ${customer.customerName || 'cliente'}, te enviamos el detalle de tu cuenta pendiente en *Empresas Alvarados*:`,
    ''
  ];
  if (debtOrders.length > 0) {
    debtOrders.forEach((o) => {
      lines.push(`▫️ Pedido ${o.id} (${new Date(o.createdAt || o.timestamp).toLocaleDateString('es-VE')}):`);
      o.items.forEach((it) => lines.push(`   - ${it.quantity}x ${it.name} = ${formatUsd(it.price * it.quantity)}`));
      lines.push(`   Total: ${formatUsd(o.total)}`);
      lines.push('');
    });
  }
  lines.push(`*Total a pagar: ${formatUsd(debtTotal)}*`);
  lines.push('');
  lines.push('Gracias por tu prontitud. 🙌');
  return lines.join('\n');
}

// Traduce errores del navegador/WebAuthn a un mensaje amigable para el usuario.
// Evita mostrar textos técnicos en inglés como "NotAllowedError".
const friendlyAuthError = (err) => {
  const name = err?.name || '';
  // Errores lanzados manualmente (new Error(...)) ya traen un mensaje en español
  // del servidor o un fallback amigable, así que se muestran tal cual.
  if (name === 'Error' && err?.message) return err.message;
  if (name === 'NotAllowedError') {
    return 'Verificación cancelada. Para continuar, acepta la huella o Face ID cuando tu teléfono lo pida.';
  }
  if (name === 'NotFoundError' || name === 'NotSupportedError') {
    return 'Tu dispositivo no tiene biometría configurada. Activa la huella o Face ID en los ajustes y prueba de nuevo.';
  }
  if (name === 'AbortError') {
    return 'La verificación tardó demasiado y se canceló. Intenta de nuevo.';
  }
  if (name === 'TimeoutError') {
    return 'El tiempo de espera se agotó. Intenta de nuevo.';
  }
  if (name === 'SecurityError' || name === 'InvalidStateError') {
    return 'Tu dispositivo no pudo completar la verificación. Intenta de nuevo o usa un teléfono más reciente.';
  }
  return 'No se pudo completar la verificación. Intenta de nuevo.';
};

// Recordatorio corto para un cobro programado que ya venció.
const OPENFACTS_FIELDS = 'code,product_name,brands,image_front_url';

const searchOpenFoodFacts = async (query, useBeauty) => {
  const base = useBeauty
    ? 'https://world.openbeautyfacts.org'
    : 'https://world.openfoodfacts.org';
  const res = await fetch(
    `${base}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=8&fields=${OPENFACTS_FIELDS}`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.products || [])
    .filter((p) => p.image_front_url)
    .map((p) => ({
      id: `${useBeauty ? 'openbeautyfacts' : 'openfoodfacts'}-${p.code}`,
      thumb: p.image_front_url,
      full: p.image_front_url,
      photographer: p.brands || 'Supermercado',
      page: `${base}/product/${p.code}`,
      source: useBeauty ? 'Open Beauty Facts' : 'Open Food Facts'
    }));
};

const searchPexels = async (query) => {
  const res = await fetch(
    `/pexels-api/search?query=${encodeURIComponent(query)}&per_page=8&size=medium`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.photos || []).map((photo) => ({
    id: `pexels-${photo.id}`,
    thumb: photo.src.medium || photo.src.small || photo.src.large,
    full: photo.src.large || photo.src.original,
    photographer: photo.photographer,
    page: photo.url
  }));
};

const searchWikimedia = async (query) => {
  const res = await fetch(
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=480&format=json&origin=*`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
  return pages
    .map((page) => {
      const info = page.imageinfo?.[0];
      return {
        id: `wikimedia-${page.pageid}`,
        thumb: info?.thumburl || info?.url,
        full: info?.thumburl || info?.url,
        photographer: info?.extmetadata?.Artist?.value
          ? info.extmetadata.Artist.value.replace(/<[^>]+>/g, '').trim()
          : 'Wikimedia Commons',
        page: info?.descriptionurl || ''
      };
    })
    .filter((r) => r.thumb && r.full);
};

function ProductFormModal({ productToEdit, categories, onClose, onSave }) {
  const [formData, setFormData] = useState({
    id: productToEdit?.id || '',
    code: productToEdit?.code || '',
    name: productToEdit?.name || '',
    brand: productToEdit?.brand || '',
    description: productToEdit?.description || '',
    price: productToEdit?.price || '',
    stock: productToEdit?.stock || '',
    category: productToEdit?.category || categories[0] || 'Comida',
    image: productToEdit?.image || 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&auto=format&fit=crop&q=80',
    sizeValue: productToEdit?.sizeValue || '',
    sizeUnit: productToEdit?.sizeUnit || 'ml'
  });

  const [newCatInput, setNewCatInput] = useState('');

  const sizeType = ['ml', 'L'].includes(formData.sizeUnit) ? 'liquid' : 'solid';
  const sizeUnits = sizeType === 'liquid' ? ['ml', 'L'] : ['g', 'kg'];

  const setSizeType = (type) => {
    setFormData((prev) => ({
      ...prev,
      sizeUnit: type === 'liquid' ? 'ml' : 'g'
    }));
  };

  const [imageResults, setImageResults] = useState([]);
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [imageSearchError, setImageSearchError] = useState('');
  const [imageSource, setImageSource] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingImage(true);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 800;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const ratio = MAX / Math.max(width, height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setFormData((prev) => ({ ...prev, image: dataUrl }));
        setIsUploadingImage(false);
      };
      img.onerror = () => {
        setIsUploadingImage(false);
        setImageSearchError('No se pudo leer la imagen seleccionada.');
      };
      img.src = reader.result;
    };
    reader.onerror = () => {
      setIsUploadingImage(false);
      setImageSearchError('No se pudo leer la imagen seleccionada.');
    };
    reader.readAsDataURL(file);
  };

  const searchImages = async () => {
    const query = [formData.brand, formData.name, formData.category]
      .filter(Boolean)
      .join(' ')
      .trim();

    if (!query) {
      setImageSearchError('Completa al menos el nombre o la marca del producto para buscar imágenes.');
      return;
    }

    setIsSearchingImages(true);
    setImageSearchError('');
    setImageResults([]);
    setImageSource('');

    let results = null;

    // 1. Open Food Facts / Open Beauty Facts: fotos reales de productos de supermercado
    const useBeauty = BEAUTY_CATEGORIES.some((k) =>
      formData.category.toLowerCase().includes(k)
    );

    const foodQuery = [formData.brand, formData.name]
      .filter(Boolean)
      .join(' ')
      .replace(/\b\d+(\.\d+)?\s*(ml|l|g|kg)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    try {
      results = await searchOpenFoodFacts(foodQuery || query, useBeauty);
    } catch (err) {
      console.error('[kiosko] Open Food Facts falló:', err);
    }

    if (results && results.length > 0) {
      setImageResults(results);
      setImageSource(results[0].source);
      setIsSearchingImages(false);
      return;
    }

    // 2. Pexels (vía proxy de dev)
    try {
      results = await searchPexels(query);
    } catch (err) {
      console.error('[kiosko] Pexels falló:', err);
    }

    if (results && results.length > 0) {
      setImageResults(results);
      setImageSource('Pexels');
      setIsSearchingImages(false);
      return;
    }

    // 3. Wikimedia Commons (CORS directo)
    try {
      results = await searchWikimedia(query);
    } catch (err) {
      console.error('[kiosko] Wikimedia falló:', err);
    }

    setIsSearchingImages(false);

    if (results && results.length > 0) {
      setImageResults(results);
      setImageSource('Wikimedia');
      return;
    }

    setImageSearchError(
      'No se pudieron cargar las sugerencias de imágenes. Verifica tu conexión a internet e intenta de nuevo.'
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.price || formData.stock === '') return;

    onSave({
      ...formData,
      price: Number(formData.price),
      stock: Number(formData.stock),
      sizeValue: formData.sizeValue === '' ? '' : Number(formData.sizeValue),
      category: newCatInput.trim() ? newCatInput.trim() : formData.category
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-screen-up max-h-[92vh] flex flex-col">
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-white">
            {productToEdit ? 'Editar Producto' : 'Crear Nuevo Producto'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre del Producto *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Chocolate Semi Amargo"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Marca (Opcional)</label>
            <input
              type="text"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              placeholder="Ej: Quilmes, La Serenísima, Milka..."
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Descripción</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detalles sobre ingredientes, tamaño, etc."
              rows={2}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Precio ($ ARS) *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="1500"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Stock Disponible *</label>
              <input
                type="number"
                required
                min="0"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                placeholder="20"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Tamaño del Producto</label>
            <div className="grid grid-cols-2 gap-3 p-1.5 rounded-2xl bg-slate-800 border border-slate-700 mb-3">
              <button
                type="button"
                onClick={() => setSizeType('liquid')}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  sizeType === 'liquid'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🥤 Líquido / Bebida
              </button>
              <button
                type="button"
                onClick={() => setSizeType('solid')}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  sizeType === 'solid'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📦 Sólido
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min="0"
                step="any"
                value={formData.sizeValue}
                onChange={(e) => setFormData({ ...formData, sizeValue: e.target.value })}
                placeholder={sizeType === 'liquid' ? 'Ej: 500' : 'Ej: 200'}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
              />
              <select
                value={formData.sizeUnit}
                onChange={(e) => setFormData({ ...formData, sizeUnit: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
              >
                {sizeUnits.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Categoría</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none mb-2"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <input
              type="text"
              value={newCatInput}
              onChange={(e) => setNewCatInput(e.target.value)}
              placeholder="O escribe una nueva categoría aquí..."
              className="w-full px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-xs focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Imagen del Producto</label>
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage}
                className="flex-1 py-2.5 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-300 font-bold text-xs hover:bg-teal-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Icon name="upload" className="w-4 h-4" />
                {isUploadingImage ? 'Procesando imagen...' : 'Subir imagen de archivo'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
            <input
              type="url"
              value={formData.image}
              onChange={(e) => setFormData({ ...formData, image: e.target.value })}
              placeholder="https://images.unsplash.com/..."
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
            />
            {formData.image && (
              <div className="mt-2">
                <img
                  src={formData.image}
                  alt="Preview del producto"
                  className="w-28 h-28 rounded-xl object-cover border border-slate-700 bg-slate-900"
                />
              </div>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={searchImages}
              disabled={isSearchingImages}
              className="w-full py-3 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold text-xs hover:bg-cyan-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Icon name="search" className="w-4 h-4" />
              {isSearchingImages ? 'Buscando sugerencias...' : 'Sugerir imágenes de la web'}
            </button>
            {imageSearchError && (
              <p className="text-xs text-rose-400 mt-2">{imageSearchError}</p>
            )}
            {imageResults.length > 0 && (
              <div className="mt-3">
                <span className="text-[11px] text-slate-400 font-semibold block mb-2">
                  Sugerencias para:{' '}
                  <span className="text-cyan-300">
                    {[formData.brand, formData.name, formData.category].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {imageResults.map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, image: img.full }))}
                      title={`Foto por ${img.photographer}`}
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all group ${
                        formData.image === img.full
                          ? 'border-teal-400 shadow-lg shadow-teal-500/30 scale-105'
                          : 'border-slate-700 hover:border-teal-500/50'
                      }`}
                    >
                      <img
                        src={img.thumb}
                        alt={`Sugerencia: ${img.photographer}`}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      {formData.image === img.full && (
                        <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-teal-400 text-slate-950 flex items-center justify-center">
                          <Icon name="check" className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  {imageSource === 'Wikimedia' ? (
                    <>
                      Imágenes de{' '}
                      <a
                        href={imageResults.find((i) => i.full === formData.image)?.page}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-slate-300"
                      >
                        Wikimedia Commons
                      </a>{' '}
                      (licencias CC).
                    </>
                  ) : imageSource.includes('Open') ? (
                    <>
                      Fotos del producto real de{' '}
                      <a
                        href={imageResults.find((i) => i.full === formData.image)?.page}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-slate-300"
                      >
                        {imageSource}
                      </a>{' '}
                      (CC BY-SA). Haz clic en una miniatura para usarla.
                    </>
                  ) : (
                    <>
                      Fotografías por{' '}
                      <a
                        href={imageResults.find((i) => i.full === formData.image)?.page}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-slate-300"
                      >
                        Pexels
                      </a>
                      . Haz clic en una miniatura para usarla.
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3.5 mt-4 rounded-2xl bg-teal-500 text-slate-950 font-bold text-sm hover:bg-teal-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20"
          >
            <Icon name="check" className="w-5 h-5" />
            <span>Guardar Producto</span>
          </button>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ product, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl z-10 text-center space-y-4 animate-scale-up">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <Icon name="alertTriangle" className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">¿Eliminar producto?</h3>
          <p className="text-xs text-slate-400 mt-1">
            Estás a punto de borrar <strong className="text-slate-200">{product.name}</strong> del catálogo. Esta acción no se puede deshacer.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={onClose}
            className="py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="py-2.5 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-600 shadow-lg shadow-rose-500/20"
          >
            Sí, Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteOrderModal({ order, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl z-10 text-center space-y-4 animate-scale-up">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <Icon name="trash" className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">¿Eliminar pedido #{order.id}?</h3>
          <p className="text-xs text-slate-400 mt-1">
            Solo se eliminan pedidos <strong className="text-slate-200">cancelados</strong>. Esta acción no se puede deshacer y lo sacará de la lista de pedidos.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={onClose}
            className="py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="py-2.5 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-600 shadow-lg shadow-rose-500/20"
          >
            Sí, Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderDetailModal({ order, rate, onClose, onTrackLiveOrder, onRequestCancelOrder }) {
  const style = STATUS_STYLES[order.status] || STATUS_STYLES.pendiente;
  const cancellable = order.status === 'pendiente' || order.status === 'en_preparacion';
  const trackable = order.type === 'delivery' && order.status !== 'cancelado' && order.status !== 'entregado';
  return (
    <div className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 max-h-[92vh] overflow-y-auto animate-scale-up">
        <div className="p-5 sm:p-6 border-b border-slate-800 sticky top-0 bg-slate-900 z-10 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white">
              Detalle del Pedido <span className="text-teal-400">#{order.id}</span>
            </h3>
            <span className={`inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${style.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
              {STATUS_LABELS[order.status] || 'Pendiente'}
            </span>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-800/60 rounded-xl p-3">
              <span className="text-slate-500 block text-[10px] font-semibold uppercase tracking-wider">Cliente</span>
              <span className="text-white font-bold">{order.customerName || 'Cliente'}</span>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-3">
              <span className="text-slate-500 block text-[10px] font-semibold uppercase tracking-wider">Fecha</span>
              <span className="text-white font-bold">{order.timestamp || '—'}</span>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 text-xs flex items-center gap-2">
            <span className="text-slate-500 font-semibold text-[10px] uppercase tracking-wider">Entrega</span>
            {order.type === 'delivery' ? (
              <>
                <Icon name="mapPin" className="w-3.5 h-3.5 text-amber-300" />
                <span className="text-amber-300 font-bold">{order.address || 'Domicilio'}</span>
                {order.lat != null && order.lng != null && (
                  <a
                    href={`https://www.google.com/maps?q=${order.lat},${order.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300 text-[10px] font-bold hover:bg-sky-500/25 transition-all"
                  >
                    <Icon name="mapPin" className="w-3 h-3" />
                    Abrir en Maps
                  </a>
                )}
                {order.courier_lat != null && order.courier_lng != null && (
                  <span className="text-[10px] font-bold text-emerald-300 ml-auto">Repartidor en vivo</span>
                )}
              </>
            ) : (
              <span className="text-teal-300 font-bold">Retiro por mostrador</span>
            )}
          </div>

          {/* Mapa de entrega a domicilio */}
          <DeliveryMap order={order} />

          <div className="rounded-2xl bg-slate-800/40 p-3 space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">Artículos</span>
            {order.items.map((it, idx) => (
              <div key={idx} className="flex justify-between text-xs">
                <span className="text-slate-300">{it.quantity}x {it.name} <span className="text-slate-500">· {formatUsd(it.price)} c/u</span></span>
                <span className="font-bold text-white">
                  {formatUsd(it.price * it.quantity)}
                  {rate?.rate > 0 && (
                    <span className="block text-[10px] text-slate-500 text-right">{formatBs(usdToBs(it.price * it.quantity, rate.rate))}</span>
                  )}
                </span>
              </div>
            ))}
            <div className="pt-2 border-t border-slate-700 flex justify-between font-bold text-sm text-white">
              <span>Total</span>
              <span className="text-teal-400 text-right">
                {formatUsd(order.total)}
                {rate?.rate > 0 && (
                  <span className="block text-[10px] text-teal-300/90">{formatBs(usdToBs(order.total, rate.rate))}</span>
                )}
              </span>
            </div>
          </div>

          {order.notes && (
            <div className="rounded-xl bg-slate-800/60 p-3 text-xs">
              <span className="text-slate-500 font-semibold text-[10px] uppercase tracking-wider">Notas</span>
              <p className="text-slate-300 italic mt-1">"{order.notes}"</p>
            </div>
          )}

          {trackable && onTrackLiveOrder && (
            <button
              onClick={() => onTrackLiveOrder(order)}
              className="w-full py-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold text-sm hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-2"
            >
              <Icon name="mapPin" className="w-4 h-4" />
              Rastrear en vivo
            </button>
          )}

          {cancellable && (
            <button
              onClick={() => onRequestCancelOrder(order)}
              className="w-full py-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold text-sm hover:bg-rose-500/25 transition-all flex items-center justify-center gap-2"
            >
              <Icon name="x" className="w-4 h-4" />
              Cancelar este pedido
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CancelOrderModal({ order, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl z-10 text-center space-y-4 animate-scale-up">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <Icon name="alertTriangle" className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">¿Cancelar pedido #{order.id}?</h3>
          <p className="text-xs text-slate-400 mt-1">
            El pedido quedará anulado y el stock de sus artículos se devolverá al inventario.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={onClose}
            className="py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700"
          >
            Volver
          </button>
          <button
            onClick={onConfirm}
            className="py-2.5 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-600 shadow-lg shadow-rose-500/20"
          >
            Sí, Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

