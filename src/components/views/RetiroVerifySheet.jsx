const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    refresh: <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />,
    checkCircle: <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9 12l2 2 4-4" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

export default function RetiroVerifySheet({
  retiroVerifyOrder,
  setRetiroVerifyOrder,
  pickupCodeOf,
  busyActions,
  onRunExclusive,
  onUpdateOrderStatus,
}) {
  if (!retiroVerifyOrder) return null;
  return (
    <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center pb-[calc(5rem+env(safe-area-inset-bottom))] sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={() => setRetiroVerifyOrder(null)} />
      <div role="dialog" aria-label={`Verificar retiro del pedido ${retiroVerifyOrder.id}`} className="relative w-full sm:max-w-sm glass-strong bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 z-10 animate-modal-spring text-center">
        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-black">Retiro en mostrador</p>
        <h3 className="text-base font-bold text-white -mt-2">
          Pedido {retiroVerifyOrder.id} · {retiroVerifyOrder.customerName || 'Cliente'}
        </h3>
        <div className="rounded-2xl border border-teal-500/40 bg-teal-500/10 py-4">
          <p className="font-mono text-4xl font-black tracking-[0.3em] text-white pl-[0.3em]">
            {pickupCodeOf(retiroVerifyOrder.id)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1.5 px-4">
            Verificá que coincida con el código que muestra el cliente en su app
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={() => setRetiroVerifyOrder(null)}
            data-no-swipe
            className="py-3 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 transition-all"
          >
            Cerrar
          </button>
          <button
            onClick={() => {
              const id = retiroVerifyOrder.id;
              onRunExclusive(`st:${id}`, async () => {
                await onUpdateOrderStatus(id, 'entregado');
                setRetiroVerifyOrder(null);
              });
            }}
            disabled={Boolean(busyActions[`st:${retiroVerifyOrder.id}`])}
            className="py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-all disabled:opacity-70 disabled:pointer-events-none"
          >
            {busyActions[`st:${retiroVerifyOrder.id}`]
              ? <><Icon name="refresh" className="w-3.5 h-3.5 animate-spin" /> Procesando…</>
              : <><Icon name="checkCircle" className="w-3.5 h-3.5" /> Dar como entregado</>}
          </button>
        </div>
      </div>
    </div>
  );
}
