const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    store: <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7M2 7v13a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7M2 7h20M12 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
    minimize: <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />,
    refresh: <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />,
    arrowRight: <path d="M5 12h14M12 5l7 7-7 7" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

export default function TvModeView({
  orders,
  tvMode,
  setTvMode,
  mostradorNow,
  parseOrderDate,
  needsPaymentAttention,
  STATUS_LABELS,
  STATUS_FLOW,
  busyActions,
  onRunExclusive,
  onUpdateOrderStatus,
}) {
  if (!tvMode) return null;
  const active = (orders || []).filter(o => !['entregado', 'cancelado'].includes(o.status));
  const q = active.map(o => {
    const d = parseOrderDate(o);
    const waitMs = isNaN(d) ? 0 : Math.max(0, mostradorNow - d.getTime());
    return { o, waitMs };
  }).sort((a, b) => b.waitMs - a.waitMs);
  return (
    <div className="fixed inset-0 z-[96] bg-slate-950 overflow-y-auto p-5 sm:p-8" role="dialog" aria-label="Modo TV Mostrador">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Icon name="store" className="w-7 h-7 text-teal-400" />
          <h2 className="font-display text-2xl font-black text-white">Mostrador · Modo TV</h2>
          <span className="text-xs text-slate-500 font-semibold tabular-nums">{new Date().toLocaleTimeString('es-VE')}</span>
        </div>
        <button onClick={() => setTvMode(false)} className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-bold text-sm hover:bg-slate-700 transition-all flex items-center gap-2">
          <Icon name="minimize" className="w-4 h-4" /> Salir
        </button>
      </div>
      {q.length === 0 ? (
        <div className="py-24 text-center text-4xl text-slate-400">🎉 Sin pedidos activos</div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {q.map(({ o, waitMs }) => {
            const mm = Math.floor(waitMs / 60000);
            const ss = Math.floor((waitMs % 60000) / 1000);
            const timerColor = waitMs > 1800000 ? 'text-rose-400' : waitMs > 600000 ? 'text-amber-400' : 'text-teal-300';
            const needsPay = needsPaymentAttention(o);
            const items = o.items || [];
            return (
              <div key={o.id} className="tv-card rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-mono font-black text-teal-400">#{o.id}</span>
                  <span className={`px-3 py-1 rounded-full border text-xs font-bold ${needsPay ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'bg-slate-700 border-slate-600 text-slate-200'}`}>
                    {needsPay ? 'Por validar' : STATUS_LABELS[o.status] || o.status}
                  </span>
                </div>
                <div className={`text-6xl font-black tabular-nums ${timerColor}`}>
                  {mm}:{String(ss).padStart(2, '0')}
                </div>
                <p className="text-lg text-slate-300 font-semibold truncate">{o.customerName || 'Cliente'}</p>
                {o.note && <p className="text-amber-400 text-base font-semibold truncate">📝 {o.note}</p>}
                <div className="space-y-1.5 text-xl leading-relaxed">
                  {items.map((it, i) => (
                    <div key={i} className="flex justify-between gap-2">
                      <span className="truncate">{it.quantity || 1}× <span className="font-black text-white">{it.name}</span></span>
                    </div>
                  ))}
                </div>
                {needsPay ? (
                  <div className="space-y-2 pt-2">
                    <p className="text-[11px] text-amber-300 font-bold text-center uppercase">Comprobante de pago pendiente</p>
                    {o.payment_proof_url && (
                      <a href={o.payment_proof_url} target="_blank" rel="noopener noreferrer" className="block py-3 rounded-xl bg-slate-800 border border-slate-700 text-center text-sm font-bold text-teal-300 hover:bg-slate-700 transition-all">
                        📷 Ver comprobante
                      </a>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => onRunExclusive(`pay:${o.id}`, async () => { await onUpdateOrderStatus(o.id, 'en_preparacion'); })} disabled={Boolean(busyActions[`pay:${o.id}`])} className="py-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-base transition-all disabled:opacity-60">
                        {busyActions[`pay:${o.id}`] ? '…' : '✅ Confirmar'}
                      </button>
                      <button onClick={() => onRunExclusive(`pay:${o.id}`, async () => { await onUpdateOrderStatus(o.id, 'cancelado'); })} disabled={Boolean(busyActions[`pay:${o.id}`])} className="py-4 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold text-base hover:bg-rose-500/30 transition-all disabled:opacity-60">
                        {busyActions[`pay:${o.id}`] ? '…' : '❌ Rechazar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => onRunExclusive(`tv:${o.id}`, async () => { const next = STATUS_FLOW[o.status]; if (next) await onUpdateOrderStatus(o.id, next); })} disabled={Boolean(busyActions[`tv:${o.id}`])} className="w-full py-5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-black text-xl shadow-lg shadow-teal-500/20 hover:from-teal-400 hover:to-emerald-400 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                    {busyActions[`tv:${o.id}`] ? <><Icon name="refresh" className="w-5 h-5 animate-spin" /> Procesando…</> : <><Icon name="arrowRight" className="w-5 h-5" /> Avanzar</>}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
