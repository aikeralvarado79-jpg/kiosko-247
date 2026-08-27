import { formatUsd } from '../../utils/format.js';
import { SEM_TONES } from '../../utils/category.js';
import { formatPhoneWhatsApp } from '../../utils/phone.js';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    package: <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />,
    clock: <path d="M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />,
    check: <path d="M20 6 9 17l-5-5" />,
    checkCircle: <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9 12l2 2 4-4" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    eye: <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
    trash: <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />,
    refresh: <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />,
    mapPin: <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0zM12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />,
    image: <path d="M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21" />,
    creditCard: <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM2 10h20M6 15h4" />,
    lock: <><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
    wallet: <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M18 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />,
    store: <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7M2 7v13a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7M2 7h20M12 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
    whatsapp: <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

export default function AdminDespachoView({
  despachoOrders,
  cajaOrders,
  semaforoOf,
  lowStockInOrder,
  OrderStepsTimeline,
  onUpdateOrderStatus,
  onUpdateOrderPayment,
  onSetProofOrder,
  onOpenFicha,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-200 flex items-center gap-2">
            <Icon name="package" className="w-4 h-4 text-cyan-400" />
            Por alistar
          </h3>
          <span className="text-[11px] text-slate-500">{despachoOrders.length} pedido(s)</span>
        </div>
        {despachoOrders.length === 0 ? (
          <div className="py-10 text-center text-slate-500 space-y-2 bg-slate-800/40 rounded-2xl border border-slate-700/50">
            <Icon name="checkCircle" className="w-10 h-10 text-slate-700 mx-auto" />
            <p className="font-bold text-slate-400">Nada por alistar</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {despachoOrders.map((o) => {
              const sem = semaforoOf(o);
              const missing = lowStockInOrder(o);
              const wa = formatPhoneWhatsApp(o.phone);
              const isPickup = o.type !== 'delivery';
              const nxt =
                o.status === 'pendiente'
                  ? 'en_preparacion'
                  : o.status === 'en_preparacion'
                    ? 'listo'
                    : isPickup && o.status === 'listo'
                      ? 'entregado'
                      : null;
              const nxtLabel =
                nxt === 'en_preparacion' ? 'Iniciar ▸' : nxt === 'listo' ? 'Marcar listo ✓' : nxt === 'entregado' ? 'Retirado ✓' : null;
              const nxtTone =
                nxt === 'en_preparacion'
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25'
                  : nxt === 'listo'
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                    : nxt === 'entregado'
                      ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/25'
                      : 'bg-slate-700/40 border-slate-600 text-slate-300';
              return (
                <div key={o.id} className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-teal-400">{o.id}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold flex items-center gap-1 ${SEM_TONES[sem.tone]}`}>
                        <Icon name="clock" className="w-3 h-3" />
                        {sem.text}
                      </span>
                      <button
                        onClick={() => onOpenFicha(o)}
                        title="Ver ficha del pedido"
                        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-700/40 border border-slate-600 text-slate-200 text-[10px] font-bold hover:border-teal-500/50 hover:text-teal-300 transition-all"
                      >
                        <Icon name="eye" className="w-3 h-3" />
                        Ficha
                      </button>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-white">{o.customerName}</p>
                  <p className="text-[11px] text-slate-400 line-clamp-2">
                    {o.items.map((it) => `${it.quantity}x ${it.name}`).join(' · ')}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-teal-400">{formatUsd(o.total)}</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                        o.type === 'delivery'
                          ? 'text-amber-300 border-amber-500/40 bg-amber-500/10'
                          : 'text-teal-300 border-teal-500/40 bg-teal-500/10'
                      }`}
                    >
                      {o.type === 'delivery' ? (
                        <Icon name="mapPin" className="w-3 h-3" />
                      ) : (
                        <Icon name="store" className="w-3 h-3" />
                      )}
                      {o.type === 'delivery' ? 'Entrega' : 'Retiro'}
                    </span>
                  </div>
                  <OrderStepsTimeline order={o} />
                  {missing.length > 0 && (
                    <p className="text-[11px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-2 py-1.5">
                      ⚠️ Sin stock suficiente: {missing.map((m) => m.name).join(', ')}
                    </p>
                  )}
                  <div className="flex gap-2">
                    {nxt && nxtLabel ? (
                      <button
                        onClick={() => onUpdateOrderStatus(o.id, nxt)}
                        className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${nxtTone}`}
                      >
                        {nxtLabel}
                      </button>
                    ) : (
                      <div className="flex-1 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 text-xs font-bold text-center">
                        {isPickup ? 'Esperando retiro' : 'Pasa a Entregas'}
                      </div>
                    )}
                    {wa && (
                      <a
                        href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hola ${o.customerName}, sobre tu pedido ${o.id} en Kiosko 247`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold hover:bg-emerald-500/25 transition-all"
                      >
                        <Icon name="whatsapp" className="w-3.5 h-3.5" /> WA
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-200 flex items-center gap-2">
            <Icon name="creditCard" className="w-4 h-4 text-amber-400" />
            Por validar (caja)
          </h3>
          <span className="text-[11px] text-slate-500">{cajaOrders.length} pago(s)</span>
        </div>
        {cajaOrders.length === 0 ? (
          <div className="py-10 text-center text-slate-500 space-y-2 bg-slate-800/40 rounded-2xl border border-slate-700/50">
            <Icon name="checkCircle" className="w-10 h-10 text-slate-700 mx-auto" />
            <p className="font-bold text-slate-400">Sin pagos por validar</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {cajaOrders.map((o) => {
              const wa = formatPhoneWhatsApp(o.phone);
              return (
                <div key={o.id} className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-teal-400">{o.id}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                        o.paymentStatus === 'rechazado'
                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      {o.paymentStatus === 'rechazado' ? 'Rechazado' : 'En revisión'}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-white">{o.customerName}</p>
                  <p className="text-[11px] text-slate-400">
                    {(o.paymentMethod === 'pago_movil' ? 'Pago Móvil' : 'Transferencia')} · Ref:{' '}
                    <span className="font-mono text-white">{o.paymentReference || '—'}</span>
                  </p>
                  {o.hasProof ? (
                    <button
                      onClick={() => onSetProofOrder(o)}
                      className="w-full flex items-center gap-2 p-2 rounded-xl bg-slate-900/60 border border-slate-700 hover:border-teal-500/40 transition-all text-left"
                    >
                      <span className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                        <Icon name="image" className="w-4 h-4 text-teal-400" />
                      </span>
                      <span className="text-xs font-bold text-white flex-1">Ver comprobante</span>
                      <Icon name="eye" className="w-4 h-4 text-teal-400" />
                    </button>
                  ) : (
                    <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1.5">
                      Sin comprobante adjunto
                    </p>
                  )}
                  {o.paymentStatus === 'rechazado' && (
                    <p className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-2 py-1.5">
                      El cliente debe subir otro comprobante o pasar el pedido a cuenta.
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {o.paymentStatus === 'pendiente' && (
                      <>
                        <button
                          onClick={() => onUpdateOrderPayment(o.id, 'confirmado')}
                          className="flex-1 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition-all"
                        >
                          Confirmar ✓
                        </button>
                        <button
                          onClick={() => onUpdateOrderPayment(o.id, 'rechazado')}
                          className="flex-1 py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold hover:bg-rose-500/25 transition-all"
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                    {wa && (
                      <a
                        href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hola ${o.customerName}, sobre el pago de tu pedido ${o.id} en Kiosko 247`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold hover:bg-emerald-500/25 transition-all"
                      >
                        <Icon name="whatsapp" className="w-3.5 h-3.5" /> WA
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
