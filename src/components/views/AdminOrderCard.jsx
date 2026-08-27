import { useState, useEffect, useRef } from 'react';
import { formatPhoneWhatsApp } from '../../utils/phone.js';
import { formatUsd, formatBs, usdToBs } from '../../utils/format.js';
import { STATUS_STYLES, STATUS_FLOW, nextOrderStatus, pickupCodeOf, needsPaymentValidation, parseOrderDate } from '../../utils/order.js';
import { SEM_TONES } from '../../utils/category.js';
import { haptic } from '../../utils/haptics.js';
import { api } from '../../api.js';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    edit: <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />,
      clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    wallet: <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a3 3 0 0 0-3-3h-3" />,
    creditCard: <><rect width="20" height="14" x="2" y="5" rx="2" /><path d="M2 10h20" /></>,
    phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />,
    whatsapp: <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />,
    mapPin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
    store: <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4M2 7h20" />,
    pin: <path d="M12 17v5M9 2h6l-1 7h4l-7 8 1-7H5l4-7z" />,
    check: <polyline points="20 6 9 17 4 12" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    alertTriangle: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4M12 17h.01" /></>,
    refresh: <path d="M21 12a9 9 0 1 1-6.219-8.56" />,
    lock: <><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
    image: <><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></>,
    eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
    trash: <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

function OrderCardGestures({ onLongPress, onSwipeRight, onSwipeLeft, children, ...rest }) {
  const wrapRef = useRef(null);
  const cardRef = useRef(null);
  const cbRef = useRef({});
  cbRef.current = { onLongPress, onSwipeRight, onSwipeLeft };

  useEffect(() => {
    const el = wrapRef.current;
    const card = cardRef.current;
    if (!el || !card) return undefined;
    let sx = 0, sy = 0, dx = 0, mode = null, longTimer = null;
    const clearLong = () => { clearTimeout(longTimer); longTimer = null; };
    const springBack = () => {
      card.style.transition = 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)';
      card.style.transform = 'translateX(0)';
      setTimeout(() => { el.dataset.hint = ''; }, 220);
    };
    const onStart = (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      const t = e.target;
      if (t && t.closest && t.closest('button, a, input, textarea, select, [data-no-swipe]')) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0; mode = null;
      card.style.transition = 'none';
      if (cbRef.current.onLongPress) {
        clearTimeout(longTimer);
        longTimer = setTimeout(() => { if (mode === null && Math.abs(dx) < 8) { haptic(16); mode = 'done'; cbRef.current.onLongPress(); } }, 480);
      }
    };
    const onMove = (e) => {
      if (mode === 'done' || !e.touches || e.touches.length !== 1) return;
      const tx = e.touches[0].clientX - sx;
      const ty = e.touches[0].clientY - sy;
      if (mode === null) {
        if (Math.abs(tx) > 18 && Math.abs(tx) > Math.abs(ty) * 1.15) { mode = 'h'; clearLong(); }
        else if (Math.abs(ty) > 14) { mode = 'v'; clearLong(); }
        else return;
      }
      if (mode === 'h') { e.preventDefault(); dx = tx; card.style.transform = `translateX(${tx}px)`; }
    };
    const onEnd = () => {
      clearLong();
      if (mode === 'h') {
        if (dx > 80 && cbRef.current.onSwipeRight) { haptic(20); cbRef.current.onSwipeRight(); }
        else if (dx < -80 && cbRef.current.onSwipeLeft) { haptic(12); cbRef.current.onSwipeLeft(); }
      }
      springBack(); mode = null; dx = 0;
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchmove', onMove); el.removeEventListener('touchend', onEnd); clearTimeout(longTimer); };
  }, []);

  return (
    <div ref={wrapRef} {...rest}>
      <div ref={cardRef}>{children}</div>
    </div>
  );
}

function OrderChat({ order }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const load = async () => {
    const res = await api.getOrderMessages(order.id, order.phone);
    if (res.ok && Array.isArray(res.data.messages)) setMessages(res.data.messages);
  };

  useEffect(() => { load(); const timer = setInterval(load, 5000); return () => clearInterval(timer); }, [order.id]);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages]);

  const send = async (valueOverride) => {
    const value = String(valueOverride ?? text).trim();
    if (!value || sending) return;
    setSending(true);
    const res = await api.sendOrderMessage(order.id, order.phone, value);
    setSending(false);
    if (res.ok) { setText(''); load(); }
  };

  const TEMPLATES = [
    { label: 'Listo', text: (n, id) => `Hola ${n}, tu pedido ${id} esta listo para retirar en Kiosko 24/7. Te esperamos!` },
    { label: 'En camino', text: (n, id) => `Hola ${n}, tu pedido ${id} ya va en camino. Pronto llega!` },
    { label: 'Llego el repartidor', text: (n, id) => `Hola ${n}, el repartidor llego con tu pedido ${id}. Que lo disfrutes!` },
    { label: 'En preparacion', text: (n, id) => `Hola ${n}, estamos preparando tu pedido ${id}. Cualquier cambio te avisamos` },
    { label: 'Confirmar pago', text: (n, id) => `Hola ${n}, sobre el pago de tu pedido ${id}. Necesitas ayuda?` }
  ];

  const ChatBubble = ({ m }) => {
    const isAdmin = m.sender === 'admin';
    return (
      <div className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs ${isAdmin ? 'bg-teal-500/20 text-teal-100 rounded-br-md' : 'bg-slate-800 text-slate-200 rounded-bl-md'}`}>
          <p className="whitespace-pre-wrap">{m.text}</p>
          <span className="text-[9px] text-slate-500 mt-0.5 block">{m.timestamp ? new Date(m.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-2xl bg-slate-900/60 border border-slate-700 overflow-hidden">
      <div className="p-2.5 border-b border-slate-700/70 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
          <Icon name="whatsapp" className="w-3.5 h-3.5 text-emerald-400" />Chat con el cliente
        </span>
        <span className="text-[9px] text-slate-500">se actualiza solo</span>
      </div>
      <div ref={listRef} className="p-2.5 space-y-2 max-h-44 overflow-y-auto">
        {messages.length === 0 && <p className="text-[11px] text-slate-500 text-center py-2">Sin mensajes todavia.</p>}
        {messages.map((m, idx) => <ChatBubble key={m.id || idx} m={m} />)}
      </div>
      <div className="px-2.5 pt-2.5 flex flex-wrap gap-1.5">
        {TEMPLATES.map((t) => (
          <button key={t.label} onClick={() => send(t.text(order.customerName, order.id))} disabled={sending}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 text-[10px] font-bold hover:bg-emerald-500/20 transition-all disabled:opacity-50 active:scale-95">
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-2.5 border-t border-slate-700/70 flex gap-2">
        <input type="text" value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder="Responder al cliente..." maxLength={300}
          className="flex-1 min-w-0 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:border-teal-500 focus:outline-none" />
        <button onClick={() => send()} disabled={sending || !text.trim()}
          className="shrink-0 px-3 py-2 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs disabled:opacity-50 transition-all active:scale-95">
          Enviar
        </button>
      </div>
    </div>
  );
}

const orderAgeMinutes = (o) => {
  const d = parseOrderDate(o);
  if (isNaN(d)) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
};

const semaforoOf = (o) => {
  const mins = orderAgeMinutes(o);
  const est = Number(o.estimatedMinutes) || 0;
  if (est > 0 && mins > est) return { tone: 'rose', text: `${mins} min (+${mins - est})`, label: 'Supera lo estimado' };
  if (mins >= 10) return { tone: 'rose', text: `${mins} min`, label: 'Espera alta' };
  if (mins >= 5) return { tone: 'amber', text: `${mins} min`, label: 'Espera media' };
  return { tone: 'emerald', text: `${mins} min`, label: 'Reciente' };
};

const lowStockInOrder = (order, products) => {
  const missing = [];
  (order.items || []).forEach((it) => {
    const p = products.find((pr) => pr.id === it.id);
    if (p && Number(p.stock) < Number(it.quantity)) {
      missing.push({ name: it.name, have: p.stock, need: it.quantity });
    }
  });
  return missing;
};

export default function AdminOrderCard({ order, rate, inFicha = false, products, pinnedOrders, busyActions, courierOrderId, courierActive, onRunExclusive, onUpdateOrderStatus, onUpdateOrderPayment, onDeleteOrder, onTogglePin, onOpenFicha, onSetQuickMenu, onSetProofOrder, onSetConfirmCancel, onStopCourierTracking, onStartCourierTracking }) {
  const st = STATUS_STYLES[order.status] || STATUS_STYLES.pendiente;
  const wa = formatPhoneWhatsApp(order.phone);
  const sem = semaforoOf(order);
  const missingStock = lowStockInOrder(order, products);
  const isPinned = pinnedOrders.includes(order.id);
  const payPending = needsPaymentValidation(order);
  const stBusy = Boolean(busyActions[`st:${order.id}`]);
  const payBusy = Boolean(busyActions[`pay:${order.id}`]);
  const delBusy = Boolean(busyActions[`del:${order.id}`]);
  const gpsBusy = Boolean(busyActions[`gps:${order.id}`]);
  const isActiveStatus = ['pendiente', 'en_preparacion', 'listo', 'en_camino'].includes(order.status);
  const agingClass = !payPending && isActiveStatus && sem.tone !== 'emerald'
    ? (sem.tone === 'rose' ? 'border-rose-500/60 bg-rose-950/40 shadow-rose-900/20 animate-pulse' : 'border-amber-500/50 bg-amber-950/30')
    : '';
  const swipeNext = !payPending ? nextOrderStatus(order) : null;
  const CardShell = inFicha ? 'div' : OrderCardGestures;
  const shellProps = inFicha ? {} : {
    onLongPress: () => onSetQuickMenu(order),
    onSwipeRight: swipeNext ? () => onRunExclusive(`st:${order.id}`, () => onUpdateOrderStatus(order.id, swipeNext)) : null,
    onSwipeLeft: () => onOpenFicha(order)
  };

  return (
    <CardShell {...shellProps}
      className={`p-4 sm:p-5 space-y-4 flex flex-col justify-between shadow-xl ${payPending ? 'bg-slate-800/80 border border-amber-500/50' : agingClass || `bg-slate-800/80 border ${st.ring}`}`}>
      <div className="space-y-3">
        {order.notes && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-400/15 border border-amber-400/50 text-amber-200 text-xs font-bold">
            <Icon name="edit" className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="min-w-0 flex-1">{order.notes}</span>
          </div>
        )}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono text-xs font-bold text-teal-400">{order.id}</span>
            {!payPending && isActiveStatus && (
              <span className={`px-2 py-0.5 rounded-full border text-[11px] font-black flex items-center gap-1 shrink-0 tabular-nums ${SEM_TONES[sem.tone]} ${sem.tone === 'rose' ? 'animate-pulse' : ''}`}>
                <Icon name="clock" className="w-3 h-3" />{sem.text}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {payPending ? (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-amber-400/40 bg-amber-500/15 text-amber-300 text-[11px] font-bold">
                <Icon name="clock" className="w-3 h-3" />Pago en revision
              </span>
            ) : (
              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${st.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${st.dot} animate-pulse`} />
                {({ pendiente: 'Pendiente', en_preparacion: 'En Preparacion', listo: 'Listo', en_camino: 'En Camino', entregado: 'Entregado', cancelado: 'Cancelado' })[order.status]}
              </span>
            )}
            {(order.paymentMethod === 'cartera' || Number(order.walletApplied) > 0) && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-300 text-[11px] font-bold">
                <Icon name="wallet" className="w-3 h-3" />Pagado con cartera
                {Number(order.walletApplied) > 0 && <span className="text-[10px] opacity-80">({formatUsd(Number(order.walletApplied))})</span>}
              </span>
            )}
            {order.paymentMethod && order.paymentMethod !== 'efectivo' && order.paymentMethod !== 'cartera' && (
              <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-bold ${
                order.paymentStatus === 'confirmado' ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                : order.paymentStatus === 'rechazado' ? 'border-rose-400/40 bg-rose-500/15 text-rose-300'
                : 'border-amber-400/40 bg-amber-500/15 text-amber-300'
              }`}>
                <Icon name="creditCard" className="w-3 h-3" />
                {({ pago_movil: 'Pago Movil', transferencia: 'Transferencia' })[order.paymentMethod] || 'Pago'} · {({ pendiente: 'En revision', confirmado: 'Confirmado', rechazado: 'Rechazado' })[order.paymentStatus] || 'Pendiente'}
              </span>
            )}
            {order.credit && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-indigo-400/40 bg-indigo-500/15 text-indigo-300 text-[11px] font-bold">
                <Icon name="creditCard" className="w-3 h-3" />A cuenta
              </span>
            )}
            {order.type !== 'delivery' && ['en_preparacion', 'listo'].includes(order.status) && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-teal-400/40 bg-teal-500/10 text-teal-300 text-[11px] font-black font-mono tabular-nums" title="Codigo de retiro">
                {pickupCodeOf(order.id)}
              </span>
            )}
            <button onClick={() => onTogglePin(order.id)}
              className={`p-1.5 rounded-lg border transition-all ${isPinned ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'bg-slate-900/60 text-slate-500 border-slate-700 hover:text-amber-300'}`}
              title={isPinned ? 'Quitar de fijados' : 'Fijar pedido arriba'}>
              <Icon name="pin" className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div>
          <h4 className="font-bold text-white text-base">{order.customerName}</h4>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-slate-300 flex items-center gap-1">
              <Icon name="phone" className="w-3.5 h-3.5 text-slate-400" />{order.phone}
            </p>
            {wa && (
              <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hola ${order.customerName}, sobre tu pedido ${order.id} en Kiosko 247`)}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold hover:bg-emerald-500/25 transition-all">
                <Icon name="whatsapp" className="w-3.5 h-3.5" />WhatsApp
              </a>
            )}
          </div>
          {order.type === 'delivery' ? (
            inFicha ? (
              <span className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 text-xs font-semibold">
                <Icon name="mapPin" className="w-3 h-3" />Entrega a Domicilio
              </span>
            ) : (
              <p className="text-xs text-amber-300 flex items-center gap-1 mt-1 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                <Icon name="mapPin" className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Entrega: {order.address}</span>
                {order.lat != null && order.lng != null && (
                  <a href={`https://www.google.com/maps?q=${order.lat},${order.lng}`} target="_blank" rel="noopener noreferrer"
                    className="ml-auto shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300 text-[10px] font-bold hover:bg-sky-500/25 transition-all">
                    <Icon name="mapPin" className="w-3 h-3" />Abrir en Maps
                  </a>
                )}
                {order.courier_lat != null && order.courier_lng != null && (
                  <span className="text-[10px] font-bold text-emerald-300 ml-auto">Repartidor en vivo</span>
                )}
              </p>
            )
          ) : (
            <span className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-lg bg-teal-500/10 text-teal-300 text-xs font-semibold">
              <Icon name="store" className="w-3 h-3" />Retiro por Mostrador
            </span>
          )}
        </div>

        <div className="p-3 rounded-2xl bg-slate-900/80 space-y-1.5 text-xs text-slate-300">
          {order.items.map((it, idx) => (
            <div key={idx} className="flex justify-between">
              <span>{it.quantity}x {it.name}</span>
              <span className="font-bold text-white">
                {formatUsd(it.price * it.quantity)}
                {rate?.rate > 0 && <span className="block text-[10px] text-slate-500 text-right">{formatBs(usdToBs(it.price * it.quantity, rate.rate))}</span>}
              </span>
            </div>
          ))}
          <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-white text-sm">
            <span>Total</span>
            <span className="text-teal-400 text-right">
              {formatUsd(order.total)}
              {rate?.rate > 0 && <span className="block text-[10px] text-teal-300/90">{formatBs(usdToBs(order.total, rate.rate))}</span>}
            </span>
          </div>
        </div>

        {missingStock.length > 0 && (
          <div className="flex items-start gap-1.5 p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] font-semibold">
            <Icon name="alertTriangle" className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Sin stock suficiente: {missingStock.map((m) => `${m.name} (${m.have}/${m.need})`).join(', ')}</span>
          </div>
        )}
        {sem.tone === 'rose' && sem.label === 'Supera lo estimado' && (
          <div className="flex items-center gap-1.5 p-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-[11px] font-bold">
            <Icon name="alertTriangle" className="w-3.5 h-3.5 shrink-0" />Lleva mas del tiempo estimado
          </div>
        )}

        {order.paymentMethod === 'cartera' || Number(order.walletApplied || 0) > 0 ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
            <Icon name="wallet" className="w-4 h-4 shrink-0" />Pagado con cartera
            {Number(order.walletApplied || 0) > 0 && <span className="text-[10px] opacity-80">({formatUsd(Number(order.walletApplied))})</span>}
          </div>
        ) : order.paymentMethod && order.paymentMethod !== 'efectivo' ? (
          <div className="space-y-2">
            {order.paymentReference && (
              <p className="text-xs text-slate-300 bg-slate-900/40 p-2 rounded-xl">
                Ref: <span className="font-mono font-bold text-white">{order.paymentReference}</span>
              </p>
            )}
            {order.hasProof ? (
              <button onClick={() => onSetProofOrder(order)}
                className="w-full flex items-center gap-3 p-2 rounded-xl bg-slate-900/60 border border-slate-700 hover:border-teal-500/40 transition-all text-left">
                <span className="w-14 h-14 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                  <Icon name="image" className="w-5 h-5 text-teal-400" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-white">Ver comprobante</span>
                  <span className="block text-[11px] text-slate-400">Toca para ampliar</span>
                </span>
                <Icon name="eye" className="w-4 h-4 text-teal-400 ml-auto shrink-0" />
              </button>
            ) : (
              <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl flex items-center gap-1.5">
                <Icon name="alertTriangle" className="w-3.5 h-3.5" />Pago digital sin comprobante adjunto
              </p>
            )}
            {order.paymentStatus === 'rechazado' && (
              <p className="text-xs text-rose-300/90 bg-rose-500/10 border border-rose-500/30 p-2 rounded-xl flex items-start gap-1.5">
                <Icon name="alertTriangle" className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                Pago rechazado: el cliente debe subir otro comprobante o pasar el pedido a cuenta (si es beneficiado) antes de avanzar.
              </p>
            )}
            {order.paymentStatus === 'pendiente' && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => onRunExclusive(`pay:${order.id}`, () => onUpdateOrderPayment(order.id, 'confirmado'))} disabled={payBusy}
                  className="py-2 px-2 rounded-xl text-xs font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:pointer-events-none">
                  <Icon name={payBusy ? 'refresh' : 'check'} className={`w-3.5 h-3.5 ${payBusy ? 'animate-spin' : ''}`} />{payBusy ? 'Procesando...' : 'Confirmar pago'}
                </button>
                <button onClick={() => onRunExclusive(`pay:${order.id}`, () => onUpdateOrderPayment(order.id, 'rechazado'))} disabled={payBusy}
                  className="py-2 px-2 rounded-xl text-xs font-bold bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:pointer-events-none">
                  <Icon name={payBusy ? 'refresh' : 'x'} className={`w-3.5 h-3.5 ${payBusy ? 'animate-spin' : ''}`} />{payBusy ? 'Procesando...' : 'Rechazar pago'}
                </button>
              </div>
            )}
          </div>
        ) : null}

        <OrderChat order={order} />
      </div>

      <div data-no-swipe className={`pt-3 border-t border-slate-700/60 space-y-2 ${inFicha ? 'sticky bottom-0 z-20 -mx-4 sm:-mx-5 px-4 sm:px-5 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-3 bg-slate-900/95 backdrop-blur-md' : ''}`}>
        {payPending ? (
          <p className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl flex items-center gap-1.5">
            <Icon name="lock" className="w-3.5 h-3.5 shrink-0" />Confirma o rechaza el pago arriba para poder avanzar el estado del pedido.
          </p>
        ) : (
          <>
            <span className="text-[11px] text-slate-400 font-semibold block">Cambiar Estado:</span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'pendiente', label: 'Pendiente' }, { key: 'en_preparacion', label: 'En Prep.' },
                { key: 'listo', label: 'Listo' },
                ...(order.type === 'delivery' ? [{ key: 'en_camino', label: 'En Camino' }] : []),
                { key: 'entregado', label: 'Entregado' }, { key: 'cancelado', label: 'Cancelado' }
              ].map((stBtn) => (
                <button key={stBtn.key}
                  onClick={() => onRunExclusive(`st:${order.id}`, () => {
                    if (stBtn.key === 'cancelado') onSetConfirmCancel(order);
                    else onUpdateOrderStatus(order.id, stBtn.key);
                  })} disabled={stBusy}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:pointer-events-none ${
                    order.status === stBtn.key ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-md' : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:text-white'
                  }`}>
                  {stBusy && <Icon name="refresh" className="w-3 h-3 animate-spin" />}{stBtn.label}
                </button>
              ))}
            </div>

            {order.type === 'delivery' && order.status === 'en_camino' && (
              <div className="pt-1">
                {courierOrderId === order.id && courierActive ? (
                  <button onClick={() => onRunExclusive(`gps:${order.id}`, () => onStopCourierTracking())} disabled={gpsBusy}
                    className="w-full py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold hover:bg-rose-500/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:pointer-events-none">
                    <Icon name={gpsBusy ? 'refresh' : 'mapPin'} className={`w-3.5 h-3.5 ${gpsBusy ? 'animate-spin' : ''}`} />{gpsBusy ? 'Deteniendo...' : 'Detener rastreo en vivo'}
                  </button>
                ) : (
                  <button onClick={() => onRunExclusive(`gps:${order.id}`, () => onStartCourierTracking(order.id))} disabled={gpsBusy}
                    className="w-full py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:pointer-events-none">
                    <Icon name={gpsBusy ? 'refresh' : 'mapPin'} className={`w-3.5 h-3.5 ${gpsBusy ? 'animate-spin' : ''}`} />{gpsBusy ? 'Iniciando...' : 'Comenzar entrega (GPS en vivo)'}
                  </button>
                )}
              </div>
            )}

            {order.credit && order.status === 'pendiente' && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => onRunExclusive(`st:${order.id}`, () => onUpdateOrderStatus(order.id, 'en_preparacion'))} disabled={stBusy}
                  className="py-2 px-2 rounded-xl text-xs font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:pointer-events-none">
                  <Icon name={stBusy ? 'refresh' : 'check'} className={`w-3.5 h-3.5 ${stBusy ? 'animate-spin' : ''}`} />{stBusy ? 'Procesando...' : 'Aceptar y preparar'}
                </button>
                <button onClick={() => onRunExclusive(`st:${order.id}`, () => onSetConfirmCancel(order))} disabled={stBusy}
                  className="py-2 px-2 rounded-xl text-xs font-bold bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:pointer-events-none">
                  <Icon name="x" className="w-3.5 h-3.5" />Rechazar
                </button>
              </div>
            )}

            {order.status === 'cancelado' && (
              <button onClick={() => onRunExclusive(`del:${order.id}`, () => onDeleteOrder(order))} disabled={delBusy}
                className="w-full py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold text-xs hover:bg-rose-500/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:pointer-events-none">
                <Icon name={delBusy ? 'refresh' : 'trash'} className={`w-3.5 h-3.5 ${delBusy ? 'animate-spin' : ''}`} />{delBusy ? 'Eliminando...' : 'Eliminar pedido'}
              </button>
            )}
          </>
        )}
      </div>
    </CardShell>
  );
}
