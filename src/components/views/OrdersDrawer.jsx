import { useState, useEffect, useMemo } from 'react';
import { useOverlay } from '../../hooks/overlay.js';
import useSwipeToClose from '../../hooks/useSwipeToClose.js';
import { parseOrderDate, toYMD, startOfDay, STATUS_LABELS, STATUS_STYLES, needsPaymentValidation } from '../../utils/order.js';
import { formatUsd } from '../../utils/format.js';
import MiniCalendar from '../ui/MiniCalendar.jsx';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    package: <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    minus: <path d="M5 12h14" />,
    plus: <path d="M12 5v14M5 12h14" />,
    filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
    search: <path d="m21 21-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />,
    eye: <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
    mapPin: <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0zM12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />,
    wallet: <path d="M21 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2M21 12h-5a2 2 0 0 0 0 4h5a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1z" />,
    alertTriangle: <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3zM12 9v4M12 17h.01" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

export default function OrdersDrawer({ isOpen, onClose, orders, onViewOrderDetail, onTrackLiveOrder, onRequestCancelOrder, isBenefited }) {
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState({ preset: 'all', date: null });
  const [showCalendar, setShowCalendar] = useState(false);
  const PAGE_SIZE = 6;

  useOverlay(isOpen, onClose);
  const sheetRef = useSwipeToClose(onClose, isOpen);

  const filtered = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const dow = (todayStart.getDay() + 6) % 7;
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

      <div ref={sheetRef} className="relative w-full sm:max-w-md glass-strong bg-slate-900 sm:h-full h-[92dvh] sm:border-l border-t sm:border-t-0 border-slate-800 shadow-2xl flex flex-col z-10 sm:animate-slide-left animate-screen-up">
        <div className="sm:hidden absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-slate-600/70 pointer-events-none z-20" aria-hidden="true" />
        <div className="pt-[max(1rem,env(safe-area-inset-top))] p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
              <Icon name="package" className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Mis Pedidos</h2>
              <span className="block text-[11px] text-slate-400">{orders?.length || 0} pedido{(orders?.length || 0) !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div data-sheet-scroll className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {(!orders || orders.length === 0) ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 text-slate-500">
              <Icon name="package" className="w-16 h-16 stroke-1 text-slate-700" />
              <p className="font-semibold text-slate-400">Todavia no tienes pedidos</p>
              <p className="text-xs">Haz tu primer pedido y aparecera aqui.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { key: 'all', label: 'Todos' },
                    { key: 'today', label: 'Hoy' },
                    { key: 'thisWeek', label: 'Esta semana' },
                    { key: 'lastWeek', label: 'Semana anterior' }
                  ].map((f) => (
                    <button key={f.key} onClick={() => setDateFilter({ preset: f.key, date: null })}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                        dateFilter.preset === f.key ? 'bg-teal-500 text-slate-950 shadow-sm' : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-700/60'
                      }`}>
                      {f.label}
                    </button>
                  ))}
                  <div className="relative">
                    <button onClick={() => setShowCalendar(!showCalendar)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-300 text-[11px] font-medium hover:bg-slate-700/60 flex items-center gap-1.5">
                      <Icon name="filter" className="w-3.5 h-3.5" />
                      {dateFilter.preset === 'day' && dateFilter.date ? dateFilter.date : 'Calendario'}
                    </button>
                    {showCalendar && (
                      <MiniCalendar value={dateFilter.date}
                        onChange={(d) => { setDateFilter({ preset: 'day', date: d }); setShowCalendar(false); }}
                        onClose={() => setShowCalendar(false)} />
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                  <span>Mostrando {paged.length > 0 ? ((safePage - 1) * PAGE_SIZE + 1) : 0}–{Math.min(safePage * PAGE_SIZE, filtered.length)} de {filtered.length}</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                      className="px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700/60">
                      <Icon name="minus" className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 font-semibold text-white">{safePage} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                      className="px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700/60">
                      <Icon name="plus" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {paged.length === 0 ? (
                <div className="text-center py-8 space-y-2 text-slate-500">
                  <Icon name="search" className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs font-semibold text-slate-400">No hay pedidos en este filtro</p>
                </div>
              ) : (
                paged.map((o) => {
                  const style = STATUS_STYLES[o.status] || STATUS_STYLES.pendiente;
                  const cancellable = o.status === 'pendiente' || o.status === 'en_preparacion';
                  const payRejected = o.paymentMethod && o.paymentMethod !== 'efectivo' && o.paymentStatus === 'rechazado';
                  const payPending = needsPaymentValidation(o);
                  return (
                    <div key={o.id} className={`p-3 rounded-xl sm:rounded-2xl bg-slate-900/60 border ${payRejected ? 'border-rose-500/50' : 'border-slate-700/50'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm font-bold text-white">Pedido <span className="text-teal-400">#{o.id}</span></span>
                        {payPending ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 border border-amber-500/40 text-amber-300">Pago en revision</span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${payRejected ? STATUS_STYLES.cancelado.badge : style.badge}`}>
                            {payRejected ? 'Pago rechazado' : STATUS_LABELS[o.status] || 'Pendiente'}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1">
                        {o.timestamp} · {o.items.length} articulo{o.items.length !== 1 ? 's' : ''} · {formatUsd(o.total)}
                      </p>
                      {(o.paymentMethod === 'cartera' || Number(o.walletApplied) > 0) && (
                        <p className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-300 text-[10px] font-bold">
                          <Icon name="wallet" className="w-3 h-3" /> Pagado con cartera
                        </p>
                      )}
                      <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
                        {o.type === 'delivery' ? `Envio a ${o.address || 'domicilio'}` : 'Retiro en tienda'}
                      </p>
                      {payRejected && (
                        <div className="mt-2 flex items-start gap-1.5 rounded-xl bg-rose-500/10 border border-rose-500/40 p-2 text-[11px] text-rose-200/90">
                          <Icon name="alertTriangle" className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-400" />
                          <span>Tu pago fue rechazado. Suministra otro comprobante{isBenefited ? ' o pasalo a tu cuenta' : ''} en Ver detalle.</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2.5">
                        <button onClick={() => onViewOrderDetail(o)}
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold hover:bg-cyan-500/25 transition-all flex items-center justify-center gap-1">
                          <Icon name="eye" className="w-3 h-3" /> Ver detalle
                        </button>
                        {o.type === 'delivery' && o.status !== 'cancelado' && o.status !== 'entregado' && (
                          <button onClick={() => onTrackLiveOrder(o)}
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1">
                            <Icon name="mapPin" className="w-3 h-3" /> Rastrear
                          </button>
                        )}
                        {cancellable && (
                          <button onClick={() => onRequestCancelOrder(o)}
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-bold hover:bg-rose-500/25 transition-all flex items-center justify-center gap-1">
                            <Icon name="x" className="w-3 h-3" /> Cancelar
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
