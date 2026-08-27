import { formatUsd } from '../../utils/format.js';
import { parseOrderDate, paymentInfoOf, needsPaymentAttention, pickupCodeOf } from '../../utils/order.js';
import { haptic } from '../../utils/haptics.js';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    edit: <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />,
    clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    lock: <><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
    image: <><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></>,
    eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
    check: <polyline points="20 6 9 17 4 12" />,
    checkCircle: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>,
    alertTriangle: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4M12 17h.01" /></>,
    refresh: <path d="M21 12a9 9 0 1 1-6.219-8.56" />,
    maximize: <><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></>,
    creditCard: <><rect width="20" height="14" x="2" y="5" rx="2" /><path d="M2 10h20" /></>,
    dollarSign: <><line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
    package: <><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></>,
    navigation: <><polygon points="3 11 22 2 13 21 11 13 3 11" /></>,
    x: <path d="M18 6 6 18M6 6l12 12" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
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

export default function AdminMostradorView({ orders, products, mostradorNow, busyActions, onRunExclusive, onUpdateOrderStatus, onUpdateOrderPayment, onSetRetiroVerify, onSetProofOrder, onOpenFicha, onSetTvMode }) {
  const active = (orders || []).filter((o) => !['entregado', 'cancelado'].includes(o.status));
  const withWait = active.map((o) => {
    const d = parseOrderDate(o);
    const waitMs = isNaN(d) ? 0 : Math.max(0, mostradorNow - d.getTime());
    return { o, waitMs };
  });
  const queue = withWait.sort((a, b) => b.waitMs - a.waitMs);

  const stageChips = [
    { label: 'Recibidos', n: queue.filter(({ o }) => o.status === 'pendiente' && !needsPaymentAttention(o)).length, cls: 'bg-slate-700 text-slate-200 border-slate-600' },
    { label: 'Por validar', n: queue.filter(({ o }) => needsPaymentAttention(o)).length, cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
    { label: 'Armando', n: queue.filter(({ o }) => o.status === 'en_preparacion').length, cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40' },
    { label: 'Listos', n: queue.filter(({ o }) => o.status === 'listo').length, cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
    { label: 'Camino', n: queue.filter(({ o }) => o.status === 'en_camino').length, cls: 'bg-sky-500/15 text-sky-300 border-sky-500/40' }
  ];

  return (
    <div className="max-w-md mx-auto sm:max-w-xl space-y-3 animate-fade-in">
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {stageChips.map((c) => (
          <span key={c.label} className={`px-3 py-1.5 rounded-xl border text-[11px] font-black whitespace-nowrap shrink-0 ${c.cls}`}>
            {c.label} &middot; {c.n}
          </span>
        ))}
        <button onClick={() => onSetTvMode(true)} className="px-3 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 text-[11px] font-black whitespace-nowrap shrink-0 flex items-center gap-1">
          <Icon name="maximize" className="w-3.5 h-3.5" /> TV
        </button>
        <span className="ml-auto text-[10px] text-slate-500 font-semibold whitespace-nowrap shrink-0">
          &rarr; desliza tarjeta para avanzar
        </span>
      </div>

      {queue.length === 0 ? (
        <div className="py-16 text-center space-y-2 text-slate-500">
          <Icon name="checkCircle" className="w-12 h-12 mx-auto text-emerald-500/60" />
          <p className="font-bold text-slate-400">Sin pedidos activos</p>
        </div>
      ) : (
        queue.map(({ o, waitMs }) => {
          const mm = Math.floor(waitMs / 60000);
          const ss = Math.floor((waitMs % 60000) / 1000);
          const est = Number(o.estimatedMinutes) || 0;
          const tone = (est > 0 && mm > est) || mm >= 10 ? 'rose' : mm >= 5 ? 'amber' : 'emerald';
          const toneCls = tone === 'rose' ? 'text-rose-400' : tone === 'amber' ? 'text-amber-300' : 'text-emerald-300';
          const pay = paymentInfoOf(o);
          const payAttn = needsPaymentAttention(o);
          const cardTone = payAttn
            ? 'border-amber-500/60 bg-amber-950/30'
            : tone === 'rose' ? 'border-rose-500/60 bg-rose-950/40'
            : tone === 'amber' ? 'border-amber-500/50 bg-amber-950/30'
            : 'border-slate-700 bg-slate-800/80';
          const busy = Boolean(busyActions[`st:${o.id}`]);
          const payBusy = Boolean(busyActions[`pay:${o.id}`]);
          const missing = lowStockInOrder(o, products);
          const isDelivery = o.type === 'delivery';

          let action;
          if (!payAttn) {
            if (o.status === 'pendiente') {
              action = o.credit
                ? { next: 'en_preparacion', label: 'Aprobar pedido a cuenta', icon: 'creditCard' }
                : { next: 'en_preparacion', label: 'Aceptar pedido', icon: 'check' };
            } else if (o.status === 'en_preparacion') {
              action = { next: 'listo', label: 'Pedido listo', icon: 'package' };
            } else if (o.status === 'listo') {
              action = isDelivery
                ? { next: 'en_camino', label: 'Despachar pedido', icon: 'navigation' }
                : { next: 'entregado', label: 'Cliente retiro', icon: 'checkCircle', verify: true };
            } else if (o.status === 'en_camino') {
              action = { next: 'entregado', label: 'Marcar entregado', icon: 'checkCircle' };
            }
          }

          return (
            <div key={o.id} className={`p-4 rounded-3xl border shadow-xl space-y-3 ${cardTone}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span className="font-mono text-sm font-bold text-teal-400">{o.id}</span>
                  <span className="px-2 py-0.5 rounded-full border border-slate-600 bg-slate-900/60 text-[10px] font-bold text-slate-300 shrink-0">
                    {isDelivery ? 'Delivery' : 'Retiro'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold shrink-0 flex items-center gap-1 ${pay.cls}`}>
                    <Icon name={pay.icon} className="w-3 h-3" />
                    {pay.label}{pay.suffix ? ` \u00b7 ${pay.suffix}` : ''}
                  </span>
                </div>
                <span className={`font-mono font-black text-2xl leading-none tabular-nums shrink-0 ${toneCls}`}>
                  {mm}:{String(ss).padStart(2, '0')}
                </span>
              </div>

              {o.customerName && <p className="text-xs font-bold text-slate-300 truncate">{o.customerName}</p>}

              {o.notes && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-400/15 border border-amber-400/50 text-amber-200 text-xs font-bold">
                  <Icon name="edit" className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="min-w-0 flex-1">{o.notes}</span>
                </div>
              )}

              {!payAttn && (
                <ul className="space-y-1">
                  {(o.items || []).map((it, idx) => (
                    <li key={`${it.id}-${idx}`} className="flex items-baseline gap-2 text-sm">
                      <span className="font-black text-white tabular-nums">{it.quantity}x</span>
                      <span className="text-slate-200 min-w-0 truncate">{it.name}</span>
                    </li>
                  ))}
                </ul>
              )}

              {!payAttn && missing.length > 0 && (
                <p className="text-[11px] font-bold text-rose-300 flex items-center gap-1.5">
                  <Icon name="alertTriangle" className="w-3.5 h-3.5" />
                  Sin stock: {missing.map((m) => m.name).join(', ')}
                </p>
              )}

              {!o.credit && pay.key === 'efectivo' && o.status !== 'en_camino' && (
                <p className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                  <Icon name="dollarSign" className="w-3.5 h-3.5" />
                  Cobrar {formatUsd(o.total)}{isDelivery ? ' al entregar' : ' al retirar'}
                </p>
              )}
              {o.credit && o.status === 'pendiente' && (
                <p className="text-[11px] font-semibold text-indigo-300">
                  Fiado: el cliente paga despues. Aprobar lo pasa directo a preparacion.
                </p>
              )}

              {!payAttn && !isDelivery && ['en_preparacion', 'listo'].includes(o.status) && (
                <p className="text-[11px] font-black font-mono tracking-widest text-teal-300">
                  Codigo: {pickupCodeOf(o.id)}
                </p>
              )}

              {payAttn ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                    <Icon name="lock" className="w-3.5 h-3.5" />
                    {o.paymentStatus === 'rechazado'
                      ? 'Pago rechazado: el cliente debe subir nuevo comprobante.'
                      : 'Pago digital por validar: el pedido no avanza hasta confirmarlo.'}
                  </p>
                  {o.hasProof && (
                    <button
                      onClick={() => onSetProofOrder(o)}
                      data-no-swipe
                      disabled={payBusy}
                      className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-700 hover:border-teal-500/40 transition-all text-left disabled:opacity-60"
                    >
                      <span className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                        <Icon name="image" className="w-4 h-4 text-teal-400" />
                      </span>
                      <span className="text-xs font-bold text-white flex-1">Ver comprobante</span>
                      {o.paymentReference && <span className="font-mono text-[10px] text-slate-400 mr-1">{o.paymentReference}</span>}
                      <Icon name="eye" className="w-4 h-4 text-teal-400" />
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onRunExclusive(`pay:${o.id}`, () => onUpdateOrderPayment(o.id, 'confirmado'))}
                      disabled={payBusy}
                      className="py-3 rounded-xl bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all disabled:opacity-70 disabled:pointer-events-none"
                    >
                      <Icon name={payBusy ? 'refresh' : 'check'} className={`w-3.5 h-3.5 ${payBusy ? 'animate-spin' : ''}`} />
                      {payBusy ? 'Procesando...' : 'Confirmar'}
                    </button>
                    <button
                      onClick={() => onRunExclusive(`pay:${o.id}`, () => onUpdateOrderPayment(o.id, 'rechazado'))}
                      disabled={payBusy}
                      className="py-3 rounded-xl bg-rose-500/90 text-white text-xs font-black shadow-lg shadow-rose-500/20 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all disabled:opacity-70 disabled:pointer-events-none"
                    >
                      <Icon name={payBusy ? 'refresh' : 'x'} className={`w-3.5 h-3.5 ${payBusy ? 'animate-spin' : ''}`} />
                      {payBusy ? 'Procesando...' : 'Rechazar'}
                    </button>
                  </div>
                </div>
              ) : action ? (
                <button
                  onClick={() => {
                    if (action.verify) onSetRetiroVerify(o);
                    else onRunExclusive(`st:${o.id}`, () => onUpdateOrderStatus(o.id, action.next));
                  }}
                  disabled={busy}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 text-sm font-black shadow-lg shadow-teal-500/25 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-70 disabled:pointer-events-none"
                >
                  {busy
                    ? <><Icon name="refresh" className="w-4 h-4 animate-spin" /> Procesando...</>
                    : <><Icon name={action.icon} className="w-4 h-4" /> {action.label}</>}
                </button>
              ) : null}

              <button
                onClick={() => onOpenFicha(o)}
                data-no-swipe
                disabled={busy}
                className="w-full py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 text-[11px] font-bold hover:text-white transition-all disabled:opacity-60"
              >
                Ver ficha completa
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
