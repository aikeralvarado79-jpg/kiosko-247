import { formatUsd, formatBs, usdToBs } from '../../utils/format.js';
import { STATUS_STYLES, parseOrderDate } from '../../utils/order.js';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    list: <><line x1="8" x2="21" y1="6" y2="6" /><line x1="8" x2="21" y1="12" y2="12" /><line x1="8" x2="21" y1="18" y2="18" /><line x1="3" x2="3.01" y1="6" y2="6" /><line x1="3" x2="3.01" y1="12" y2="12" /><line x1="3" x2="3.01" y1="18" y2="18" /></>,
    search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
    x: <path d="M18 6 6 18M6 6l12 12" />,
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

export default function AdminHistorialView({
  finalizedOrders,
  histFiltered,
  histEntregados,
  histCancelados,
  histRevenue,
  histStatus,
  setHistStatus,
  histSearch,
  setHistSearch,
  histRange,
  setHistRange,
  rate,
  onOpenFicha,
  onDeleteOrder,
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
          <span className="text-[10px] sm:text-xs text-slate-400 font-medium block">Finalizados</span>
          <span className="text-xl sm:text-2xl font-black text-white">{histFiltered.length}</span>
        </div>
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
          <span className="text-[10px] sm:text-xs text-slate-400 font-medium block">Entregados</span>
          <span className="text-xl sm:text-2xl font-black text-emerald-400">{histEntregados.length}</span>
        </div>
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
          <span className="text-[10px] sm:text-xs text-slate-400 font-medium block">Cancelados</span>
          <span className="text-xl sm:text-2xl font-black text-rose-400">{histCancelados.length}</span>
        </div>
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
          <span className="text-[10px] sm:text-xs text-slate-400 font-medium block">Ingresos (entregados)</span>
          <span className="text-lg sm:text-xl font-black text-teal-400 truncate">
            {formatUsd(histRevenue)}
            {rate?.rate > 0 && (
              <span className="hidden sm:block text-[10px] text-slate-400 font-semibold">
                {formatBs(usdToBs(histRevenue, rate.rate))}
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
          {[
            { key: 'todos', label: 'Todos', count: finalizedOrders.length },
            { key: 'entregado', label: 'Entregados', count: finalizedOrders.filter((o) => o.status === 'entregado').length },
            { key: 'cancelado', label: 'Cancelados', count: finalizedOrders.filter((o) => o.status === 'cancelado').length }
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setHistStatus(f.key)}
              className={`px-3.5 sm:px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap border transition-all shrink-0 ${
                histStatus === f.key
                  ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-lg shadow-teal-500/20'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-white'
              }`}
            >
              {f.label}
              <span className="ml-1.5 px-1.5 py-0.5 rounded-lg bg-black/20 text-[10px]">{f.count}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0 flex-1">
            {[
              { key: 'hoy', label: 'Hoy' },
              { key: '7d', label: 'Últimos 7 días' },
              { key: 'todo', label: 'Todo' }
            ].map((r) => (
              <button
                key={r.key}
                onClick={() => setHistRange(r.key)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all shrink-0 ${
                  histRange === r.key
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 sm:max-w-xs">
            <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={histSearch}
              onChange={(e) => setHistSearch(e.target.value)}
              placeholder="Buscar por pedido, cliente o teléfono…"
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-slate-900/70 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/60 transition-all"
            />
            {histSearch && (
              <button
                onClick={() => setHistSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                title="Limpiar búsqueda"
              >
                <Icon name="x" className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {histFiltered.length === 0 ? (
        <div className="py-12 text-center text-slate-500 space-y-2 bg-slate-800/40 rounded-2xl border border-slate-700/50">
          <Icon name="list" className="w-10 h-10 text-slate-700 mx-auto" />
          <p className="font-bold text-slate-400">No hay pedidos finalizados con este filtro</p>
          <button
            onClick={() => { setHistStatus('todos'); setHistSearch(''); setHistRange('7d'); }}
            className="text-[11px] font-semibold text-teal-400 hover:text-teal-300"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <>
          {/* Desktop: tabla */}
          <div className="hidden sm:block rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-900/40">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700/80 bg-slate-900/60 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="p-3">Pedido</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Ítems</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-sm">
                {histFiltered.map((o) => {
                  const st = STATUS_STYLES[o.status] || STATUS_STYLES.entregado;
                  const d = parseOrderDate(o);
                  return (
                    <tr key={o.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="p-3 font-mono text-xs font-bold text-teal-400">{o.id}</td>
                      <td className="p-3">
                        <p className="font-bold text-slate-100 text-xs">{o.customerName}</p>
                        <p className="text-[11px] text-slate-400">{o.phone}</p>
                      </td>
                      <td className="p-3 text-xs text-slate-400 whitespace-nowrap">
                        {isNaN(d) ? '—' : `${d.toLocaleDateString('es-VE')} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </td>
                      <td className="p-3 text-xs text-slate-300">{o.type === 'delivery' ? 'Entrega a domicilio' : 'Retiro por mostrador'}</td>
                      <td className="p-3 text-xs text-slate-400 line-clamp-1 max-w-xs">
                        {o.items.map((it) => `${it.quantity}x ${it.name}`).join(' · ')}
                      </td>
                      <td className="p-3 font-bold text-white text-xs whitespace-nowrap">{formatUsd(o.total)}</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${st.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {({ entregado: 'Entregado', cancelado: 'Cancelado' })[o.status]}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => onOpenFicha(o)}
                            title="Ver ficha del pedido"
                            className="p-2 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-300 hover:bg-teal-500/25 transition-all inline-flex items-center gap-1.5 text-[11px] font-bold"
                          >
                            <Icon name="eye" className="w-3.5 h-3.5" /> Ficha
                          </button>
                          {o.status === 'cancelado' && (
                            <button
                              onClick={() => onDeleteOrder(o)}
                              className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 transition-all inline-flex items-center gap-1.5 text-[11px] font-bold"
                            >
                              <Icon name="trash" className="w-3.5 h-3.5" /> Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <div className="grid grid-cols-1 gap-3 sm:hidden">
            {histFiltered.map((o) => {
              const st = STATUS_STYLES[o.status] || STATUS_STYLES.entregado;
              const d = parseOrderDate(o);
              return (
                <div key={o.id} className={`p-3 rounded-2xl bg-slate-800/60 border ${st.ring} space-y-1.5`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-teal-400">{o.id}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${st.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      {({ entregado: 'Entregado', cancelado: 'Cancelado' })[o.status]}
                    </span>
                  </div>
                  <p className="font-bold text-white text-sm">{o.customerName}</p>
                  <p className="text-[11px] text-slate-400">
                    {isNaN(d) ? '—' : `${d.toLocaleDateString('es-VE')} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    {' · '}{o.type === 'delivery' ? 'Entrega' : 'Retiro'}
                  </p>
                  <p className="text-[11px] text-slate-400 line-clamp-2">
                    {o.items.map((it) => `${it.quantity}x ${it.name}`).join(' · ')}
                  </p>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-sm font-black text-teal-400">{formatUsd(o.total)}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onOpenFicha(o)}
                        className="p-2 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-300 hover:bg-teal-500/25 transition-all"
                        title="Ver ficha del pedido"
                      >
                        <Icon name="eye" className="w-3.5 h-3.5" />
                      </button>
                      {o.status === 'cancelado' && (
                        <button
                          onClick={() => onDeleteOrder(o)}
                          className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 transition-all"
                          title="Eliminar pedido"
                        >
                          <Icon name="trash" className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
