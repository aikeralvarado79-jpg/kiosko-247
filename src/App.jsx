import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { startRegistration, startAuthentication, browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser';
import { api, getToken, setToken, clearToken } from './api.js';

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
    package: <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />,
    alertTriangle: <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3zM12 9v4M12 17h.01" />,
    trendingUp: <path d="m22 7-8.5 8.5-5-5L1 18M16 7h6v6" />,
    user: <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
    users: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
    creditCard: <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM2 10h20M6 15h4" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
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
     key: <path d="M12 2a9.92 9.92 0 0 0-7 2.82L2.82 7.01a1 1 0 0 0 0 1.42l2.59 2.59a1 1 0 0 0 1.42 0L12 5.34l6.17 6.17a1 1 0 0 0 1.42 0l2.59-2.59a1 1 0 0 0 0-1.42L13 4.83c-.35-.35-.5-.83-.5-1.31A5.5 5.5 0 0 0 12 2z" />
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

const formatTimestamp = (date = new Date()) =>
  date.toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const formatSize = (product) => {
  if (!product || product.sizeValue === undefined || product.sizeValue === null || product.sizeValue === '') return '';
  const num = Number(product.sizeValue);
  const formatted = Number.isInteger(num) ? String(num) : num.toLocaleString('es-AR');
  return `${formatted}${product.sizeUnit || ''}`;
};

const formatUsd = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;

const formatBs = (n) => `Bs ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const usdToBs = (usd, rate) => Number(usd || 0) * (rate || 0);

const PHONE_CODES = ['0412', '0414', '0416', '0422', '0424', '0426'];

// Administradores reconocidos por teléfono (formato 11 dígitos, sin espacios).
const ADMIN_PHONES = ['04129862577', '04141823718', '04242980404', '04242963490'];

const CUSTOMER_KEY = 'kiosko_customer';

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

const STATUS_FLOW = ['pendiente', 'en_preparacion', 'listo', 'entregado'];

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  en_preparacion: 'En Preparación',
  listo: 'Listo',
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
    const num = parseFloat(v.replace(',', '.'));
    setBsInput(Number.isFinite(num) ? (num * r).toFixed(2) : '');
  };

  const handleBs = (value) => {
    const v = value.replace(/[^\d.,]/g, '');
    setBsInput(v);
    const num = parseFloat(v.replace(',', '.'));
    setUsdInput(Number.isFinite(num) && r > 0 ? (num / r).toFixed(2) : '');
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
        setLoadError('No se pudo conectar con el servidor. Asegurate de ejecutar "npm run dev:all".');
      }
      setIsLoading(false);
      return;
    }
    setProducts(res.data.products || []);
    setCategories(res.data.categories || []);
    setOrders(res.data.orders || []);
    if (Array.isArray(res.data.settings?.promos)) setPromos(res.data.settings.promos);
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

  // Cliente reconocido (pre-llenado automático del checkout)
  const [savedCustomer, setSavedCustomer] = useState(() => loadSavedCustomer());

  // True si el cliente identificado figura en la lista de administradores por teléfono
  const isCurrentAdmin = useMemo(() => {
    if (!savedCustomer?.phoneNumber) return false;
    const key = `${savedCustomer.phoneCode || ''}${savedCustomer.phoneNumber}`.replace(/\D/g, '').slice(-11);
    return ADMIN_PHONES.includes(key);
  }, [savedCustomer]);

  // Identificación obligatoria: se abre al entrar como cliente sin datos guardados
  const [isIdentityOpen, setIsIdentityOpen] = useState(() => !loadSavedCustomer());

  // Reabrir la identificación si el usuario entra a la tienda sin estar identificado
  useEffect(() => {
    if (activeView === 'customer' && !savedCustomer) {
      setIsIdentityOpen(true);
    }
  }, [activeView, savedCustomer]);

  // Perfil del cliente desde el servidor (direcciones guardadas, etc.)
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
  }, [savedCustomer?.phoneCode, savedCustomer?.phoneNumber]);

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
  const [currentOrderTracking, setCurrentOrderTracking] = useState(null); // Order id for customer view

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

  const addToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const handleAdminLogin = async (phone, password) => {
    const res = await api.login(phone, password);
    if (!res.ok) {
      addToast(res.data.error || 'Contraseña incorrecta', 'error');
      return false;
    }
    setToken(res.data.token);
    setIsAdminAuthed(true);
    addToast('Sesión iniciada en el panel admin');
    return true;
  };

  const handleAdminLogout = () => {
    clearToken();
    setIsAdminAuthed(false);
    setActiveView('customer');
    setAdminTab('inventory');
    addToast('Sesión cerrada', 'info');
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

  const addToCart = (product, quantityToAdd = 1) => {
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
      const matchesCategory = selectedCategory === 'Todas' || p.category === selectedCategory;
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
  }, [products, selectedCategory, searchQuery, sortOption, orders]);

  const handlePlaceOrder = async (formData) => {
    if (cart.length === 0) return;

    const orderPayload = {
      customerName: formData.customerName,
      phone: formData.phone,
      type: formData.type,
      address: formData.type === 'delivery' ? formData.address : undefined,
      notes: formData.notes,
      items: cart.map((item) => ({
        id: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity
      })),
      total: cartTotal,
      credit: Boolean(formData.credit),
      timestamp: formatTimestamp(),
      estimatedMinutes: formData.type === 'delivery' ? 25 : 10
    };

    const res = await api.createOrder(orderPayload);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo realizar el pedido', 'error');
      return;
    }

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

    const { state, order } = res.data;
    setProducts(state.products || []);
    setOrders(state.orders || []);
    setCart([]);
    setIsCheckoutOpen(false);
    setIsCartOpen(false);
    setCurrentOrderTracking(order.id);
    addToast('¡Pedido realizado con éxito!', 'success');
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
    const known = buildKnownCustomers(orders, record);
    const isReturning = known.some((c) => c.number === phoneNumber && c.code === phoneCode);
    addToast(isReturning ? `¡Hola de nuevo, ${customerName.split(' ')[0]}!` : `¡Bienvenido, ${customerName.split(' ')[0]}!`);
    // Registrar/actualizar el cliente en el servidor para que aparezca en el historial
    const phoneKey = `${phoneCode}${phoneNumber}`.replace(/\D/g, '').slice(-11);
    if (phoneKey.length >= 7) {
      const res = await api.upsertCustomer(phoneKey, { customerName });
      if (res.ok && res.data?.phone) setCustomerProfile(res.data);
    }
  };

  // Cambiar de cliente: limpia la identidad y reabre el modal
  const handleSwitchCustomer = () => {
    localStorage.removeItem(CUSTOMER_KEY);
    setSavedCustomer(null);
    setCustomerProfile(null);
    setCart([]);
    setIsIdentityOpen(true);
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

  // Sound notification when a tracked order advances to preparación or listo
  const lastTrackedStatus = useRef(null);
  useEffect(() => {
    if (!trackedOrder) {
      lastTrackedStatus.current = null;
      return;
    }
    const status = trackedOrder.status;
    if (lastTrackedStatus.current && status !== lastTrackedStatus.current) {
      if (status === 'en_preparacion' || status === 'listo') {
        playChime();
        addToast(
          status === 'en_preparacion'
            ? `¡Tu pedido ${trackedOrder.id} está en preparación!`
            : `¡Tu pedido ${trackedOrder.id} está listo para retirar!`,
          'info'
        );
      }
    }
    lastTrackedStatus.current = status;
  }, [trackedOrder?.status, trackedOrder?.id]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-slate-950">
      {/* Toast Notification Container */}
      <div className="fixed top-4 left-4 right-4 sm:top-5 sm:left-auto sm:right-5 sm:w-full sm:max-w-sm z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3 border text-sm font-medium transition-all duration-300 transform translate-y-0 animate-bounce-short ${
              toast.type === 'error'
                ? 'bg-rose-900/80 border-rose-500/50 text-rose-100'
                : toast.type === 'warning'
                ? 'bg-amber-900/80 border-amber-500/50 text-amber-100'
                : toast.type === 'info'
                ? 'bg-sky-900/80 border-sky-500/50 text-sky-100'
                : 'bg-emerald-900/80 border-emerald-500/50 text-emerald-100'
            }`}
          >
            <Icon
              name={
                toast.type === 'error' || toast.type === 'warning'
                  ? 'alertTriangle'
                  : 'sparkles'
              }
              className="w-5 h-5 flex-shrink-0"
            />
            <p className="flex-1">{toast.message}</p>
          </div>
        ))}
      </div>

      {/* Modern Glassmorphic Top Navbar */}
      <header ref={headerRef} className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-lg border-b border-slate-800/80 px-3 sm:px-4 lg:px-8 py-2.5 sm:py-3 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-teal-500/20 ring-2 ring-white/10 shrink-0">
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
              onClick={() => setIsIdentityOpen(true)}
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
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 sm:p-2.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 hover:border-teal-500/50 hover:bg-slate-800 transition-all text-slate-200 hover:text-teal-400 group shrink-0"
              aria-label="Abrir carrito"
            >
              <Icon name="shoppingBag" className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:scale-110" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-teal-400 text-slate-950 text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg animate-scale-up ring-2 ring-slate-900">
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
      <main className={`flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8 ${activeView === 'customer' && cartCount > 0 ? 'pb-28 sm:pb-8' : ''}`}>
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
            customerProfile={customerProfile}
            onViewOrderDetail={(order) => setOrderDetailOrder(order)}
            onRequestCancelOrder={(order) => setCancelConfirmOrder(order)}
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
            onDeleteOrder={(order) => setDeleteOrderTarget(order)}
            allCustomers={allCustomers}
            onLoadCustomers={loadCustomers}
            onToggleBenefited={handleToggleBenefited}
            onAddToBlacklist={handleAddToBlacklist}
            collections={collections}
            onLoadCollections={loadCollections}
            onUpsertCollection={handleUpsertCollection}
            onDeleteCollection={handleDeleteCollection}
          />
        ) : (
          <AdminLoginView onLogin={handleAdminLogin} onBack={() => setActiveView('customer')} />
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

      {/* 2. Product Detail Modal */}
      {productDetailModal && (
        <ProductDetailModal
          product={productDetailModal}
          rate={rate}
          onClose={() => setProductDetailModal(null)}
          onAddToCart={(qty) => {
            addToCart(productDetailModal, qty);
            setProductDetailModal(null);
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
          onSubmit={handlePlaceOrder}
          savedCustomer={savedCustomer}
          knownCustomers={knownCustomers}
          onSaveCustomer={setSavedCustomer}
          customerProfile={customerProfile}
          onSaveAddress={handleSaveCustomerAddress}
          addToast={addToast}
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
          onRequestCancelOrder={(order) => {
            setOrderDetailOrder(null);
            setCancelConfirmOrder(order);
          }}
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
          onConfirm={handleIdentifyCustomer}
          onSwitchCustomer={handleSwitchCustomer}
          isCurrentAdmin={isCurrentAdmin}
          onGoToAdmin={() => {
            setIsIdentityOpen(false);
            setActiveView('admin');
          }}
        />
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950/60 py-5 sm:py-6 px-4 text-center text-[11px] sm:text-xs text-slate-500">
        <p>© 2026 Empresas Alvarados • Gestión inteligente de inventario y pedidos al instante.</p>
      </footer>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="py-24 flex flex-col items-center justify-center text-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-teal-500/20 animate-pulse">
        <Icon name="store" className="w-7 h-7" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-white">Cargando Empresas Alvarados...</h2>
        <p className="text-xs text-slate-400 mt-1">Sincronizando productos y pedidos desde el servidor.</p>
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

function AdminLoginView({ onLogin, onBack }) {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Login state
  const [loginPhone, setLoginPhone] = useState({ code: '0412', number: '' });

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^\d{7}$/.test(loginPhone.number)) {
      setError('Ingresá tu teléfono de administrador.');
      return;
    }
    if (!password) {
      setError('Ingresá la contraseña de administrador.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    const phoneKey = `${loginPhone.code}${loginPhone.number}`.replace(/\D/g, '').slice(-11);
    const ok = await onLogin(phoneKey, password);
    setIsSubmitting(false);
    if (!ok) setError('Contraseña incorrecta. Verificá tu teléfono y contraseña.');
  };

  const startRecovery = async () => {
    if (!/^\d{7}$/.test(recoverPhone.number)) {
      setRecoverError('Ingresá el número de teléfono de administrador.');
      return;
    }
    const phoneKey = `${recoverPhone.code}${recoverPhone.number}`.replace(/\D/g, '').slice(-11);
    setRecoverError('');
    if (recoveryFetchKeyRef.current !== phoneKey || !recoverOptions) {
      setRecoverError('Aún no está lista la verificación. Esperá un segundo e intentá de nuevo.');
      return;
    }
    setRecoverStep('biometric');
    try {
      const authResponse = await startAuthentication({ optionsJSON: recoverOptions });
      setBiometricResponse(authResponse);
      setRecoverStep('newpass');
      setRecoverError('');
    } catch (err) {
      setRecoverError(err.message || 'No se pudo verificar la biometría.');
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
    setError('Contraseña restablecida. Ahora podés iniciar sesión.');
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
            <p className="text-xs text-slate-400">Verificá con biometría y creá una nueva contraseña.</p>
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
                  placeholder="Repetí la contraseña"
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
          <p className="text-xs text-slate-400">Ingresá la contraseña para gestionar inventario y pedidos.</p>
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
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-cyan-500 focus:outline-none"
            />
            {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-bold text-sm hover:from-cyan-400 hover:to-blue-400 shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60"
          >
            <Icon name="check" className="w-4 h-4" />
            {isSubmitting ? 'Verificando...' : 'Ingresar al Panel'}
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
  customerProfile,
  onViewOrderDetail,
  onRequestCancelOrder
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showMyOrders, setShowMyOrders] = useState(false);
  const [myOrdersPage, setMyOrdersPage] = useState(1);
  const [orderDateFilter, setOrderDateFilter] = useState({ preset: 'all', date: null });
  const [showCalendar, setShowCalendar] = useState(false);
  const PAGE_SIZE = 5;

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
  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Compact Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-teal-900/40 via-slate-800 to-indigo-950/50 border border-slate-700/60 p-4 sm:p-8 shadow-2xl backdrop-blur-md">
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

      {/* Promos Banner */}
      {promos.filter((p) => p.active).length > 0 && (
        <div className="space-y-2.5 sm:space-y-3">
          {promos
            .filter((p) => p.active)
            .map((promo) => (
              <div
                key={promo.id}
                className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-rose-500/10 border border-amber-500/30"
              >
                {promo.image && (
                  <img
                    src={promo.image}
                    alt={promo.title}
                    className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl object-cover border border-amber-500/30 shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                    <Icon name="sparkles" className="w-3 h-3" /> Promo
                  </span>
                  <h4 className="font-bold text-white text-sm truncate">{promo.title}</h4>
                  {promo.subtitle && (
                    <p className="text-xs text-slate-300 line-clamp-1 sm:line-clamp-2">{promo.subtitle}</p>
                  )}
                </div>
              </div>
            ))}
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
        <div className="rounded-2xl sm:rounded-3xl bg-slate-800/60 border border-slate-700/60 overflow-hidden backdrop-blur-md">
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
            <div className="text-right shrink-0">
              <span className="block text-lg sm:text-xl font-black text-white">
                {formatUsd(Number(customerProfile.balance) || 0)}
              </span>
              <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                saldo
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Mis Pedidos: historial del cliente reconocido */}
      {savedCustomer?.customerName && customerOrders.length > 0 && (
        <div className="rounded-2xl sm:rounded-3xl bg-slate-800/60 border border-slate-700/60 overflow-hidden backdrop-blur-md">
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
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 pt-1 sm:pt-2">
            {[
              { key: 'pendiente', label: '1. Recibido' },
              { key: 'en_preparacion', label: '2. Preparando' },
              { key: 'listo', label: '3. Listo' },
              { key: 'entregado', label: '4. Entregado' }
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
            {['Todas', ...categories].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 sm:px-4 py-2 rounded-2xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-300 border shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-lg shadow-teal-500/20 scale-105'
                    : 'bg-slate-800/60 text-slate-300 border-slate-700/80 hover:bg-slate-700/60 hover:text-white'
                }`}
              >
                {cat}
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
              onAddToCart={() => onAddToCart(product, 1)}
              onOpenDetail={() => onOpenProductModal(product)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, rate, onAddToCart, onOpenDetail }) {
  const isOut = product.stock <= 0;
  const isLow = product.stock > 0 && product.stock <= 5;

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
          {product.brand && (
            <span className="hidden sm:inline px-2.5 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md text-xs font-medium text-teal-300 border border-teal-500/30">
              {product.brand}
            </span>
          )}
          <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl bg-slate-950/80 backdrop-blur-md text-[10px] sm:text-xs font-medium text-slate-200 border border-white/10">
            {product.category}
          </span>
        </div>

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
            onClick={onAddToCart}
            disabled={isOut}
            className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl font-semibold text-xs flex items-center gap-1.5 transition-all duration-300 active:scale-95 ${
              isOut
                ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                : 'bg-teal-500 text-slate-950 hover:bg-teal-400 shadow-md shadow-teal-500/20'
            }`}
            aria-label="Agregar al carrito"
          >
            <Icon name="plus" className="w-4 h-4" />
            <span className="hidden sm:inline">Agregar</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductDetailModal({ product, rate, onClose, onAddToCart }) {
  const [quantity, setQuantity] = useState(1);
  const isOut = product.stock <= 0;
  const unitBs = usdToBs(product.price, rate?.rate);
  const lineTotal = product.price * quantity;

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      {/* Backdrop Click */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-scale-up max-h-[92vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-slate-950/60 text-slate-300 hover:text-white backdrop-blur-md hover:bg-slate-800 transition-all"
        >
          <Icon name="x" className="w-5 h-5" />
        </button>

        <div className="relative h-52 sm:h-64 bg-slate-950 shrink-0">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-4 left-4">
            <span className="px-3 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md text-xs font-semibold text-teal-300 border border-teal-500/30">
              {product.category}
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-y-auto flex-1">
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
            onClick={() => onAddToCart(quantity)}
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
    </div>
  );
}

function IdentityModal({ knownCustomers, savedCustomer, onConfirm, onSwitchCustomer, onGoToAdmin, isCurrentAdmin }) {
  const [customerName, setCustomerName] = useState('');
  const [phoneCode, setPhoneCode] = useState('0412');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [errors, setErrors] = useState({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'webauthn'
  const [webAuthnStep, setWebAuthnStep] = useState(''); // '' | 'login' | 'register'
  const [webauthnError, setWebauthnError] = useState('');
  const [webauthnSupported, setWebauthnSupported] = useState(true);

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

  const suggestions = useMemo(() => {
    if (phoneNumber.length < 3) return [];
    return knownCustomers
      .filter((c) => (c.number || '').startsWith(phoneNumber))
      .slice(0, 3);
  }, [knownCustomers, phoneNumber]);

  const handlePhoneNumber = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 7);
    setPhoneNumber(digits);
    setShowSuggestions(digits.length >= 3);
  };

  const applyCustomer = (customer) => {
    setCustomerName(customer.name || customerName);
    setPhoneCode(customer.code || phoneCode);
    setPhoneNumber(customer.number || phoneNumber);
    setShowSuggestions(false);
  };

  // Determina si el teléfono ya tiene biometría registrada
  const hasRegisteredBiometry = async (phoneKey) => {
    const res = await api.webauthnLoginOptions({ phone: phoneKey });
    if (res.ok) return true;
    if (res.status === 404) return false;
    throw new Error(res.data.error || 'No se pudo consultar tu registro biométrico');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!customerName.trim()) newErrors.customerName = 'Ingresa tu nombre';
    if (!/^\d{7}$/.test(phoneNumber)) newErrors.phone = 'Ingresa los 7 dígitos del número';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    if (!webauthnSupported) {
      setStep('form');
      setWebauthnError('Tu dispositivo no soporta biometría. Usá un celular actualizado con huella o Face ID.');
      return;
    }

    setWebauthnError('');
    setStep('webauthn');
    setIsWorking(true);

    try {
      const phoneKey = `${phoneCode}${phoneNumber}`.replace(/\D/g, '').slice(-11);
      const hasBio = await hasRegisteredBiometry(phoneKey);

      if (hasBio) {
        // Login: pedir huella / Face ID
        setWebAuthnStep('login');
        const res = await api.webauthnLoginOptions({ phone: phoneKey });
        if (!res.ok) throw new Error(res.data.error || 'No se pudo iniciar la verificación');
        const authResponse = await startAuthentication({ optionsJSON: res.data.options });
        const verifyRes = await api.webauthnLoginVerify({ phone: phoneKey, response: authResponse });
        if (!verifyRes.ok) throw new Error(verifyRes.data.error || 'La biometría no coincidió');
      } else {
        // Registro: crear biometría
        setWebAuthnStep('register');
        const res = await api.webauthnRegisterOptions({ phone: phoneKey, customerName: customerName.trim() });
        if (!res.ok) throw new Error(res.data.error || 'No se pudo iniciar el registro');
        const regResponse = await startRegistration({ optionsJSON: res.data.options });
        const verifyRes = await api.webauthnRegisterVerify({ phone: phoneKey, response: regResponse });
        if (!verifyRes.ok) throw new Error(verifyRes.data.error || 'No se pudo guardar tu biometría');
      }

      setIsWorking(false);
      onConfirm({ customerName: customerName.trim(), phoneCode, phoneNumber });
    } catch (err) {
      setIsWorking(false);
      setWebauthnError(err.message || 'No se pudo completar la verificación');
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
      <div className="relative w-full sm:max-w-md bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden z-10 animate-scale-up max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 sm:p-7 border-b border-slate-800 text-center">
          <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-slate-950 shadow-lg shadow-teal-500/25">
            <Icon name="user" className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <h2 className="text-lg sm:text-xl font-black text-white mt-3">
            {savedCustomer?.customerName ? 'Cambiar de usuario' : 'Bienvenido a Empresas Alvarados'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Identifícate para pedir. Tu teléfono + biometría es tu tarjeta de cliente.
          </p>
        </div>

        {step === 'form' ? (
          <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-4">
            {/* Nombre */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Tu Nombre *</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ej: Juan Pérez"
                autoFocus
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
              />
              {errors.customerName && <p className="text-xs text-rose-400 mt-1">{errors.customerName}</p>}
            </div>

            {/* Teléfono */}
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
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="1234567"
                  maxLength={7}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>

              {showSuggestions && suggestions.length > 0 && (
                <div className="mt-2 space-y-1.5 animate-fade-in">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                    Clientes conocidos — toca para autocompletar
                  </p>
                  {suggestions.map((c) => (
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
                        <span className="block text-[10px] text-slate-400 truncate">{c.code} {c.number}</span>
                      </span>
                      <Icon name="arrowRight" className="w-3.5 h-3.5 text-teal-400 shrink-0 ml-auto" />
                    </button>
                  ))}
                </div>
              )}
              {errors.phone && <p className="text-xs text-rose-400 mt-1">{errors.phone}</p>}
            </div>

            {/* Indicador de biometría */}
            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-800/70 border border-teal-500/25">
              <span className="p-2 rounded-xl bg-teal-500/20 text-teal-400 shrink-0">
                <Icon name="check" className="w-4 h-4" />
              </span>
              <p className="text-[11px] text-slate-300 leading-snug">
                Verificación por <span className="font-bold text-teal-300">biometría del celular</span> (huella o Face ID).
                {!webauthnSupported && <span className="block text-rose-400 mt-1">Tu dispositivo no lo soporta.</span>}
              </p>
            </div>

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
                Entrar a Empresas Alvarados
              </button>
              {savedCustomer?.customerName && (
                <button
                  type="button"
                  onClick={onSwitchCustomer}
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
                {webAuthnStep === 'login' ? 'Confirmá tu identidad' : 'Registrá tu biometría'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {webAuthnStep === 'login'
                  ? 'Usá tu huella o Face ID para confirmar que sos vos.'
                  : 'Usá tu huella o Face ID una vez. La próxima vez te reconoceremos al instante.'}
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

      <div className="relative w-full sm:max-w-md bg-slate-900 sm:h-full h-[92vh] sm:border-l border-t sm:border-t-0 border-slate-800 shadow-2xl flex flex-col z-10 sm:animate-slide-left animate-scale-up">
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

function CartFloatBar({ cartCount, cartTotal, rate, onOpen }) {
  return (
    <button
      onClick={onOpen}
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      className="fixed bottom-0 left-0 right-0 sm:bottom-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-[calc(100%-2rem)] sm:max-w-lg z-40 px-4 sm:px-5 pt-3.5 sm:pt-4 bg-slate-950/90 sm:rounded-3xl border-t sm:border border-teal-500/40 shadow-2xl shadow-teal-500/20 backdrop-blur-xl flex items-center justify-between gap-4 animate-scale-up hover:border-teal-400/60 transition-all group"
    >
      <div className="flex items-center gap-2.5 sm:gap-3">
        <span className="relative p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-teal-500/15 text-teal-400">
          <Icon name="shoppingBag" className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 bg-teal-400 text-slate-950 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
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

function CheckoutModal({ onClose, cart, cartTotal, rate, onSubmit, savedCustomer, knownCustomers, onSaveCustomer, customerProfile, onSaveAddress, addToast }) {
  const [formData, setFormData] = useState({
    customerName: savedCustomer?.customerName || '',
    phoneCode: savedCustomer?.phoneCode || '0412',
    phoneNumber: savedCustomer?.phoneNumber || '',
    type: savedCustomer?.type || 'pickup', // 'pickup' | 'delivery'
    address: savedCustomer?.address || '',
    notes: '',
    credit: false
  });

  const [errors, setErrors] = useState({});
  const [showPhoneSuggestions, setShowPhoneSuggestions] = useState(false);

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
    if (formData.type === 'delivery' && !formData.address.trim()) {
      newErrors.address = 'Ingresa la dirección de entrega';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
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

      <div className="relative w-full sm:max-w-lg bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-scale-up max-h-[92vh] flex flex-col">
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
                    Dirección Completa de Entrega *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Calle, Número, Piso/Depto..."
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

          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-sm hover:from-teal-400 hover:to-emerald-400 shadow-xl shadow-teal-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Icon name="check" className="w-5 h-5" />
            <span>Confirmar y Enviar Pedido</span>
          </button>
        </form>
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
  onDeleteOrder,
  allCustomers,
  onLoadCustomers,
  onToggleBenefited,
  onAddToBlacklist,
  collections,
  onLoadCollections,
  onUpsertCollection,
  onDeleteCollection
}) {
  // Order status filter state
  const [statusFilter, setStatusFilter] = useState('todos');

  // Promos editor state
  const [promoDraft, setPromoDraft] = useState(null);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);

  // Auto-envío de cobros programados: mientras el panel admin esté abierto,
  // cuando un cobro vence (programado -> vencido), abre WhatsApp con la cuenta
  // y lo marca como "enviado" para no repetirlo. Requiere sesión activa.
  useEffect(() => {
    const check = async () => {
      const now = Date.now();
      const due = collections.filter(
        (c) => c.status === 'programado' && c.phone && new Date(c.dueAt || 0).getTime() <= now
      );
      for (const c of due) {
        const cust = (allCustomers || []).find((x) => normalizePhoneDigits(x.phone) === normalizePhoneDigits(c.phone)) || {
          phone: c.phone,
          customerName: c.customerName
        };
        const wa = formatPhoneWhatsApp(cust.phone);
        if (wa) {
          const msg = c.note ? `${buildAccountMessage(cust, orders)}\n\n_${c.note}_` : buildAccountMessage(cust, orders);
          window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
        }
        await onUpsertCollection({ id: c.id, status: 'enviado' });
      }
    };
    check();
    const timer = setInterval(check, 30000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collections, allCustomers, orders]);

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
                          {({ pendiente: 'Pendiente', en_preparacion: 'En Preparación', listo: 'Listo', entregado: 'Entregado', cancelado: 'Cancelado' })[order.status]}
                        </span>
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
                    </div>

                    {/* Status Update Controls */}
                    <div className="pt-3 border-t border-slate-700/60 space-y-2">
                      <span className="text-[11px] text-slate-400 font-semibold block">Cambiar Estado:</span>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { key: 'pendiente', label: 'Pendiente' },
                          { key: 'en_preparacion', label: 'En Prep.' },
                          { key: 'listo', label: 'Listo' },
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

          {/* Promo Editor Modal */}
          {isPromoModalOpen && promoDraft && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
              <div className="w-full sm:max-w-md p-5 sm:p-6 rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl animate-scale-up space-y-4 max-h-[92vh] overflow-y-auto">
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
          onLoadCustomers={onLoadCustomers}
          onAddToBlacklist={onAddToBlacklist}
          collections={collections}
          onUpsertCollection={onUpsertCollection}
          onDeleteCollection={onDeleteCollection}
        />
      )}

      {/* Tab 6: Analytics */}
      {adminTab === 'analytics' && (
        <div className="p-4 sm:p-8 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-2xl space-y-5 sm:space-y-6 backdrop-blur-md">
          <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Icon name="trendingUp" className="w-5 h-5 text-teal-400" />
            Resumen de Métricas del Negocio
          </h3>

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
          </div>
        </div>
      )}
    </div>
  );
}

const BEAUTY_CATEGORIES = ['higiene', 'limpieza', 'perfum', 'cosmetic', 'belleza', 'farmacia', 'salud', 'cuidado'];

function BlacklistAdminView({
  customers,
  orders,
  rate,
  onLoadCustomers,
  onAddToBlacklist,
  collections,
  onUpsertCollection,
  onDeleteCollection
}) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedDebtor, setSelectedDebtor] = useState(null); // customer abierto

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
        <button
          onClick={onLoadCustomers}
          className="px-3 py-2 rounded-xl bg-slate-700 text-slate-100 text-xs font-bold hover:bg-slate-600 transition-colors"
        >
          Actualizar lista
        </button>
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
  const debtOrders = orders
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
      <div className="relative w-full sm:max-w-lg bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-scale-up max-h-[92vh] flex flex-col">
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
                  {o.items.map((it, i) => (
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
                  ))}
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
  const debtOrders = orders
    .filter((o) => normalizePhoneDigits(o.phone) === key && o.credit && o.status === 'entregado')
    .sort((a, b) => new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp));
  const debtTotal = debtOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);

  const lines = [
    `Hola ${customer.customerName || 'cliente'}, te enviamos el detalle de tu cuenta pendiente en *Kiosko 247*:`,
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
      'No se pudieron cargar las sugerencias. Verificá tu conexión. Si la app corre como build de producción, iniciá "npm run dev" para habilitar la búsqueda de Pexels (Open Food Facts y Wikimedia funcionan igual).'
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

      <div className="relative w-full sm:max-w-lg bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-scale-up max-h-[92vh] flex flex-col">
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
                      (CC BY-SA). Hacé clic en una miniatura para usarla.
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
                      . Hacé clic en una miniatura para usarla.
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

function OrderDetailModal({ order, rate, onClose, onRequestCancelOrder }) {
  const style = STATUS_STYLES[order.status] || STATUS_STYLES.pendiente;
  const cancellable = order.status === 'pendiente' || order.status === 'en_preparacion';
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
              </>
            ) : (
              <span className="text-teal-300 font-bold">Retiro por mostrador</span>
            )}
          </div>

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

