import { useState } from 'react';
import useSwipeToClose from '../../hooks/useSwipeToClose.js';
import { useOverlay } from '../../hooks/overlay.js';
import { STATUS_STYLES, STATUS_LABELS, needsPaymentValidation, pickupCodeOf } from '../../utils/order.js';
import { formatUsd, formatBs, usdToBs } from '../../utils/format.js';
import { OrderStepsTimeline } from '../../App.jsx';
import PaymentStatusCard from './PaymentStatusCard.jsx';
import DeliveryMap from './DeliveryMap.jsx';
import FacturaQr360 from './FacturaQr360.jsx';
import ThermalTicketModal from './ThermalTicketModal.jsx';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    x: <><path d="M18 6 6 18M6 6l12 12" /></>,
    list: <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    mapPin: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="1" />}
    </svg>
  );
};

export default function OrderDetailModal({ order, rate, onClose, onTrackLiveOrder, onRequestCancelOrder, isBenefited, onOrderUpdated, addToast, headerHeight = 0 }) {
  useOverlay(true, onClose);
  const sheetRef = useSwipeToClose(onClose);
  const [showTicket, setShowTicket] = useState(false);
  const style = STATUS_STYLES[order.status] || STATUS_STYLES.pendiente;
  const cancellable = order.status === 'pendiente' || order.status === 'en_preparacion';
  const trackable = order.type === 'delivery' && order.status !== 'cancelado' && order.status !== 'entregado';
  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] overflow-hidden animate-fade-in" style={{ top: headerHeight }}>
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative h-full flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div ref={sheetRef} className="pointer-events-auto relative w-full sm:max-w-lg glass-strong bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden z-10 animate-modal-spring max-h-full flex flex-col">
        <div className="sm:hidden absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-slate-600/70 pointer-events-none z-20" aria-hidden="true" />
        <div className="p-4 sm:p-6 border-b border-slate-800 shrink-0 bg-slate-900 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white">
              Detalle del Pedido <span className="text-teal-400">#{order.id}</span>
            </h3>
            <span className={`inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${needsPaymentValidation(order) ? 'border-amber-400/40 bg-amber-500/15 text-amber-300' : style.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${needsPaymentValidation(order) ? 'bg-amber-400' : style.dot}`} />
              {needsPaymentValidation(order) ? 'Pago en revisión' : STATUS_LABELS[order.status] || 'Pendiente'}
            </span>
          </div>
          <button onClick={onClose} data-no-swipe className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>

        <div data-sheet-scroll className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          {order.type !== 'delivery' && !['entregado', 'cancelado'].includes(order.status) && (
            <div className="rounded-2xl border border-teal-500/40 bg-teal-500/10 p-4 text-center">
              <p className="text-[11px] uppercase tracking-wider text-teal-300/80 font-black">🔑 Código de retiro</p>
              <p className="font-mono text-3xl font-black tracking-[0.35em] text-white mt-1 pl-[0.35em]">
                {pickupCodeOf(order.id)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Mostralo al retirar tu pedido</p>
            </div>
          )}
          <button onClick={() => setShowTicket(true)} className="w-full py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-teal-300 font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-700 transition-all">
            <Icon name="list" className="w-4 h-4" /> Ver ticket de compra
          </button>
          {needsPaymentValidation(order) && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2.5 text-xs text-amber-300 font-semibold">
              <Icon name="clock" className="w-4 h-4 shrink-0" />
              Esperando validación del pago. El pedido avanzará al confirmarse el pago.
            </div>
          )}
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

          <PaymentStatusCard order={order} isBenefited={isBenefited} onOrderUpdated={onOrderUpdated} addToast={addToast} />
          <OrderStepsTimeline order={order} />
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

          <FacturaQr360 order={order} rate={rate} />

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
      {showTicket && <ThermalTicketModal order={order} rate={rate} onClose={() => setShowTicket(false)} />}
    </div>
  );
}
