import AdminOrderCard from './AdminOrderCard.jsx';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    alertTriangle: <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3zM12 9v4M12 17h.01" />,
    clock: <path d="M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

export default function AdminActiveOrders({
  orders,
  ACTIVE_ORDER_STATUSES,
  statusFilter,
  setStatusFilter,
  activeStatus,
  lowStockOrdersCount,
  productFilter,
  setProductFilter,
  productFilterOptions,
  statusFiltered,
  ageSortOldest,
  setAgeSortOldest,
  filteredOrders,
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
  return (
    <>
      {/* Status Quick Filters (solo estados activos; los finalizados van a Historial) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
        {[
          { key: 'todos', label: 'Todos', count: orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status)).length },
          { key: 'pendiente', label: 'Pendientes', count: orders.filter((o) => o.status === 'pendiente').length },
          { key: 'en_preparacion', label: 'Preparación', count: orders.filter((o) => o.status === 'en_preparacion').length },
          { key: 'listo', label: 'Listos', count: orders.filter((o) => o.status === 'listo').length },
          { key: 'en_camino', label: 'En Camino', count: orders.filter((o) => o.status === 'en_camino').length }
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3.5 sm:px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap border transition-all shrink-0 ${
              activeStatus === f.key
                ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-lg shadow-teal-500/20'
                : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-white'
            }`}
          >
            {f.label}
            <span className="ml-1.5 px-1.5 py-0.5 rounded-lg bg-black/20 text-[10px]">{f.count}</span>
          </button>
        ))}
      </div>

      {/* Filtro rápido por producto + alerta de stock + orden por antigüedad */}
      <div className="space-y-2.5">
        {lowStockOrdersCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold">
            <Icon name="alertTriangle" className="w-4 h-4" />
            {lowStockOrdersCount} pedido(s) incluyen productos sin stock suficiente
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0 flex-1">
            <span className="px-2 py-1 rounded-lg bg-slate-800/80 text-slate-500 text-[10px] font-black uppercase tracking-wider shrink-0">
              Producto
            </span>
            <button
              onClick={() => setProductFilter(null)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all shrink-0 ${
                productFilter === null
                  ? 'bg-teal-500 text-slate-950 border-teal-400'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-white'
              }`}
            >
              Todos
              <span className="ml-1.5 px-1.5 py-0.5 rounded-lg bg-black/20 text-[10px]">{statusFiltered.length}</span>
            </button>
            {productFilterOptions.map((p) => (
              <button
                key={p.id}
                onClick={() => setProductFilter(productFilter === p.id ? null : p.id)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all shrink-0 ${
                  productFilter === p.id
                    ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-lg shadow-teal-500/20'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-white'
                }`}
                title={p.name}
              >
                {p.name.split(' ').slice(0, 3).join(' ')}
                <span className="ml-1.5 px-1.5 py-0.5 rounded-lg bg-black/20 text-[10px]">{p.count}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setAgeSortOldest((v) => !v)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                ageSortOldest
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-lg shadow-indigo-500/10'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-white'
              }`}
              title="Ordenar por el más antiguo primero (semáforo de espera)"
            >
              <Icon name="clock" className="w-4 h-4" />
              {ageSortOldest ? 'Más antiguos primero' : 'Antigüedad'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {filteredOrders.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-500 space-y-2">
            <Icon name="clock" className="w-12 h-12 text-slate-700 mx-auto" />
            <p className="font-bold text-slate-400">No hay pedidos con este estado</p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <AdminOrderCard
              key={order.id}
              order={order}
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
          ))
        )}
      </div>
    </>
  );
}
