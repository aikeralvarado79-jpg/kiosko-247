const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    refresh: <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />,
    arrowRight: <path d="M5 12h14M12 5l7 7-7 7" />,
    eye: <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

export default function QuickMenuSheet({
  quickMenuOrder,
  setQuickMenuOrder,
  STATUS_LABELS,
  nextOrderStatus,
  needsPaymentValidation,
  busyActions,
  onRunExclusive,
  onUpdateOrderStatus,
  openFicha,
}) {
  if (!quickMenuOrder) return null;
  return (
    <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center pb-[calc(5rem+env(safe-area-inset-bottom))] sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={() => setQuickMenuOrder(null)} />
      <div role="menu" aria-label={`Acciones rápidas del pedido ${quickMenuOrder.id}`} className="relative w-full sm:max-w-xs glass-strong bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl p-4 space-y-2 z-10 animate-modal-spring">
        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-black px-1 pb-1">
          Pedido {quickMenuOrder.id} · {STATUS_LABELS[quickMenuOrder.status] || quickMenuOrder.status}
        </p>
        {(() => {
          const next = nextOrderStatus(quickMenuOrder);
          if (!next || needsPaymentValidation(quickMenuOrder)) return null;
          const qmBusy = Boolean(busyActions[`st:${quickMenuOrder.id}`]);
          return (
            <button
              onClick={() => {
                const n = next;
                onRunExclusive(`st:${quickMenuOrder.id}`, async () => {
                  await onUpdateOrderStatus(quickMenuOrder.id, n);
                  setQuickMenuOrder(null);
                });
              }}
              disabled={qmBusy}
              className="w-full py-3 px-3 rounded-xl bg-teal-500/15 border border-teal-500/40 text-teal-300 font-bold text-sm flex items-center gap-2 hover:bg-teal-500/25 transition-all disabled:opacity-60 disabled:pointer-events-none"
            >
              <Icon name={qmBusy ? 'refresh' : 'arrowRight'} className={`w-4 h-4 ${qmBusy ? 'animate-spin' : ''}`} />
              {qmBusy ? 'Procesando…' : `Avanzar a ${STATUS_LABELS[next] || next}`}
            </button>
          );
        })()}
        <button
          onClick={() => {
            const o = quickMenuOrder;
            setQuickMenuOrder(null);
            openFicha(o);
          }}
          className="w-full py-3 px-3 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 font-bold text-sm flex items-center gap-2 hover:bg-slate-700 transition-all"
        >
          <Icon name="eye" className="w-4 h-4" />
          Ver ficha completa
        </button>
        <button
          onClick={() => setQuickMenuOrder(null)}
          data-no-longpress
          className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-400 font-bold text-xs hover:text-white transition-all"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
