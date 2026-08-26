export const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

export const parseOrderDate = (o) => {
  if (o.createdAt) { const d = new Date(o.createdAt); if (!isNaN(d)) return d; }
  const m = String(o.timestamp || '').match(/^(\d{1,2})\/(\d{1,2})[,]?\s*(\d{1,2}):(\d{2})/);
  if (!m) return new Date(NaN);
  const year = new Date().getFullYear();
  return new Date(year, Number(m[2]) - 1, Number(m[1]), Number(m[3]), Number(m[4]));
};

export const toYMD = (d) => isNaN(d) ? '' : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const NEW_PRODUCT_HOURS = 4;
export const isNewProduct = (product) => {
  if (!product || !product.createdAt) return false;
  const created = new Date(product.createdAt);
  if (isNaN(created)) return false;
  return Date.now() - created.getTime() <= NEW_PRODUCT_HOURS * 3600 * 1000;
};

export const NEW_VIEWED_KEY = 'kiosko_new_product_views';
export const loadNewProductViews = () => {
  try { return JSON.parse(localStorage.getItem(NEW_VIEWED_KEY)) || []; } catch { return []; }
};
export const markNewProductViewed = (id) => {
  try {
    const list = loadNewProductViews();
    if (!list.includes(id)) localStorage.setItem(NEW_VIEWED_KEY, JSON.stringify([...list, id]));
  } catch {}
};
export const wasNewProductViewed = (id) => loadNewProductViews().includes(id);

// Flujo completo de estados (corregido: incluye en_camino para delivery).
// Antes había un bug donde data.js no incluía 'en_camino'.
export const STATUS_FLOW = ['pendiente', 'en_preparacion', 'listo', 'en_camino', 'entregado'];

export const STATUS_LABELS = {
  pendiente: 'Pendiente',
  en_preparacion: 'En Preparación',
  listo: 'Listo',
  en_camino: 'En Camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado'
};

export const nextOrderStatus = (order) => {
  if (!order) return null;
  const flow = order.type === 'delivery'
    ? ['pendiente', 'en_preparacion', 'listo', 'en_camino', 'entregado']
    : ['pendiente', 'en_preparacion', 'listo', 'entregado'];
  const i = flow.indexOf(order.status);
  return i >= 0 && i < flow.length - 1 ? flow[i + 1] : null;
};

export const pickupCodeOf = (orderId) => {
  const s = `${orderId}:kiosko-retiro`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) >>> 0;
  return String(h % 10000).padStart(4, '0');
};

export const paymentInfoOf = (o) => {
  if (o.credit) {
    return { key: 'credit', label: 'A cuenta', suffix: '', icon: 'creditCard', cls: 'border-indigo-400/40 bg-indigo-500/15 text-indigo-300' };
  }
  switch (o.paymentMethod) {
    case 'pago_movil':
    case 'transferencia': {
      const label = o.paymentMethod === 'pago_movil' ? 'Pago Móvil' : 'Transferencia';
      if (o.paymentStatus === 'confirmado') return { key: o.paymentMethod, label, suffix: 'Confirmado', icon: 'checkCircle', cls: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300' };
      if (o.paymentStatus === 'rechazado') return { key: o.paymentMethod, label, suffix: 'Rechazado', icon: 'xCircle', cls: 'border-rose-400/40 bg-rose-500/15 text-rose-300' };
      return { key: o.paymentMethod, label, suffix: 'En revisión', icon: 'clock', cls: 'border-amber-400/40 bg-amber-500/15 text-amber-300' };
    }
    case 'cartera':
      return { key: 'cartera', label: 'Pagado con cartera', suffix: '', icon: 'wallet', cls: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300' };
    default:
      return { key: 'efectivo', label: 'Efectivo', suffix: '', icon: 'dollarSign', cls: 'border-slate-600 bg-slate-900/60 text-slate-300' };
  }
};

export const needsPaymentAttention = (o) =>
  !!o.paymentMethod &&
  o.paymentMethod !== 'efectivo' &&
  o.paymentMethod !== 'cartera' &&
  !o.credit &&
  (o.paymentStatus === 'pendiente' || o.paymentStatus === 'rechazado');

export const needsPaymentValidation = (o) =>
  !!o.paymentMethod &&
  o.paymentMethod !== 'efectivo' &&
  o.paymentMethod !== 'cartera' &&
  o.paymentStatus === 'pendiente' &&
  !o.credit;

export const HOLD_CART_MS = 5 * 60 * 1000;
export const HOLD_CHECKOUT_MS = 7 * 60 * 1000;

export const STATUS_STYLES = {
  pendiente: { badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40', ring: 'border-amber-500/50', dot: 'bg-amber-400' },
  en_preparacion: { badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40', ring: 'border-cyan-500/50', dot: 'bg-cyan-400' },
  listo: { badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', ring: 'border-emerald-500/50', dot: 'bg-emerald-400' },
  en_camino: { badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40', ring: 'border-sky-500/50', dot: 'bg-sky-400' },
  entregado: { badge: 'bg-slate-500/20 text-slate-300 border-slate-500/40', ring: 'border-slate-500/50', dot: 'bg-slate-400' },
  cancelado: { badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40', ring: 'border-rose-500/50', dot: 'bg-rose-400' }
};
