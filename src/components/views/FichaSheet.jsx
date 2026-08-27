const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    eye: <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

export default function FichaSheet({
  fichaOrder,
  closeFicha,
  headerHeight,
  fichaSheetRef,
  OrderStepsTimeline,
  AdminOrderCard,
  rate,
  products,
  pinnedOrders,
  busyActions,
  courierOrderId,
  courierActive,
  onRunExclusive,
  onUpdateOrderStatus,
  onUpdateOrderPayment,
  onDeleteOrder,
  onTogglePin,
  onOpenFicha,
  onSetQuickMenu,
  onSetProofOrder,
  onSetConfirmCancel,
  onStopCourierTracking,
  onStartCourierTracking,
}) {
  if (!fichaOrder) return null;
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] overflow-hidden animate-fade-in"
      style={{ top: headerHeight }}
      role="dialog"
      aria-label={`Ficha del pedido ${fichaOrder.id}`}
    >
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={closeFicha} />
      <div className="relative h-full flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div ref={fichaSheetRef} className="pointer-events-auto relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden z-10 animate-modal-spring flex flex-col max-h-full">
          <div className="sm:hidden absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-slate-600/70 pointer-events-none z-20" aria-hidden="true" />
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-slate-900/95">
            <div>
              <h3 className="font-black text-white text-sm flex items-center gap-2">
                <Icon name="eye" className="w-4 h-4 text-teal-400" />
                Ficha del pedido
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Diseño original — {fichaOrder.id}</p>
            </div>
            <button
              onClick={closeFicha}
              data-no-swipe
              className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-all shrink-0"
              aria-label="Cerrar ficha"
            >
              <Icon name="x" className="w-4 h-4" />
            </button>
          </div>
          <div data-sheet-scroll className="px-4 sm:px-5 pt-2 sm:pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6 overflow-y-auto flex-1 min-h-0">
            <OrderStepsTimeline order={fichaOrder} />
            <div className="mt-4">
              <AdminOrderCard
                order={fichaOrder}
                inFicha={true}
                rate={rate}
                products={products}
                pinnedOrders={pinnedOrders}
                busyActions={busyActions}
                courierOrderId={courierOrderId}
                courierActive={courierActive}
                onRunExclusive={onRunExclusive}
                onUpdateOrderStatus={onUpdateOrderStatus}
                onUpdateOrderPayment={onUpdateOrderPayment}
                onDeleteOrder={onDeleteOrder}
                onTogglePin={onTogglePin}
                onOpenFicha={onOpenFicha}
                onSetQuickMenu={onSetQuickMenu}
                onSetProofOrder={onSetProofOrder}
                onSetConfirmCancel={onSetConfirmCancel}
                onStopCourierTracking={onStopCourierTracking}
                onStartCourierTracking={onStartCourierTracking}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
