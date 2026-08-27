import { formatTimestamp, formatUsd } from '../../utils/format.js';
import { toYMD } from '../../utils/order.js';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    trendingUp: <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>,
    chevronUp: <path d="m18 15-6-6-6 6" />,
    chevronDown: <path d="m6 9 6 6 6-6" />,
    dollarSign: <><line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
    barChart: <><line x1="12" x2="12" y1="20" y2="10" /><line x1="18" x2="18" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="16" /></>,
    package: <><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></>,
    alertTriangle: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4M12 17h.01" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    whatsapp: <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />,
    zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

export default function AdminAnalytics({ finDash, totalFiado, cashDigitalTotal, salesByDay, topCustomers, allCustomers, lowStockProducts, lowStockMessage, jornadaSummary }) {
  return (
    <div className="p-4 sm:p-8 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-2xl space-y-5 sm:space-y-6 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Icon name="trendingUp" className="w-5 h-5 text-teal-400" />
            Finanzas en Vivo
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            KPIs del dia actualizados con cada pedido &middot; {formatTimestamp()}
          </p>
        </div>
        {lowStockMessage && (
          <a href={`https://wa.me/?text=${encodeURIComponent(lowStockMessage)}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 transition-all text-xs font-bold w-fit">
            <Icon name="whatsapp" className="w-4 h-4" />Alerta de stock bajo
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-teal-500/20 to-emerald-500/10 border border-teal-500/40 shadow-lg shadow-teal-500/10">
          <span className="text-[10px] sm:text-xs text-teal-300 font-semibold block">Ventas Hoy</span>
          <span className="text-2xl sm:text-3xl font-black text-white block mt-1">{formatUsd(finDash.today.revenue)}</span>
          <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
            {finDash.revenueDelta >= 0
              ? <span className="text-emerald-400 flex items-center gap-0.5 font-bold"><Icon name="chevronUp" className="w-3 h-3" />{Math.abs(finDash.revenueDelta).toFixed(0)}%</span>
              : <span className="text-rose-400 flex items-center gap-0.5 font-bold"><Icon name="chevronDown" className="w-3 h-3" />{Math.abs(finDash.revenueDelta).toFixed(0)}%</span>}
            vs ayer ({formatUsd(finDash.yesterday.revenue)})
          </span>
        </div>
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-700/80">
          <span className="text-[10px] sm:text-xs text-slate-400 font-semibold block">Tickets Hoy</span>
          <span className="text-2xl sm:text-3xl font-black text-white block mt-1">{finDash.today.tickets}</span>
          <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
            {finDash.ticketsDelta >= 0
              ? <span className="text-emerald-400 flex items-center gap-0.5 font-bold"><Icon name="chevronUp" className="w-3 h-3" />{Math.abs(finDash.ticketsDelta).toFixed(0)}%</span>
              : <span className="text-rose-400 flex items-center gap-0.5 font-bold"><Icon name="chevronDown" className="w-3 h-3" />{Math.abs(finDash.ticketsDelta).toFixed(0)}%</span>}
            vs ayer ({finDash.yesterday.tickets})
          </span>
        </div>
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-700/80">
          <span className="text-[10px] sm:text-xs text-slate-400 font-semibold block">Ticket Promedio</span>
          <span className="text-2xl sm:text-3xl font-black text-white block mt-1">{finDash.ticketAvg > 0 ? formatUsd(finDash.ticketAvg) : '\u2014'}</span>
          <span className="text-[10px] text-slate-400 mt-1 block">{finDash.today.orders} pedidos entregados</span>
        </div>
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-700/80">
          <span className="text-[10px] sm:text-xs text-slate-400 font-semibold block">Fiado Pendiente</span>
          <span className="text-2xl sm:text-3xl font-black text-amber-400 block mt-1">{formatUsd(totalFiado)}</span>
          <span className="text-[10px] text-slate-400 mt-1 block">Deuda activa de clientes</span>
        </div>
      </div>

      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-emerald-500/40 space-y-4">
        <div className="flex items-center gap-2">
          <Icon name="dollarSign" className="w-4 h-4 text-emerald-400" />
          <h4 className="font-bold text-slate-200 text-sm">Ganancia Neta de Hoy</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="rounded-xl bg-slate-900/60 border border-slate-700/70 p-3.5">
            <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Ganancia (ventas - costos)</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-300 block mt-1">{formatUsd(finDash.grossProfit)}</span>
          </div>
          <div className="rounded-xl bg-slate-900/60 border border-slate-700/70 p-3.5">
            <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Margen bruto</span>
            <span className="text-xl sm:text-2xl font-black text-white block mt-1">{finDash.grossMarginPct.toFixed(0)}%</span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">del total vendido</span>
          </div>
          <div className="rounded-xl bg-slate-900/60 border border-slate-700/70 p-3.5">
            <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Costo de mercaderia vendida</span>
            <span className="text-xl sm:text-2xl font-black text-amber-300 block mt-1">{formatUsd(finDash.today.cost)}</span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              {finDash.today.cost > 0 && finDash.today.revenue > 0
                ? `= ${((finDash.today.cost / finDash.today.revenue) * 100).toFixed(0)}% de las ventas`
                : 'Define el "Costo" en cada producto'}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-indigo-500/40 bg-gradient-to-br from-indigo-500/15 via-slate-900/80 to-slate-900/80 overflow-hidden">
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-300 shrink-0 self-start sm:self-center">
            <Icon name="zap" className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-white text-base flex items-center gap-2">
              Kiosko Operator
              <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-indigo-500/25 text-indigo-300">Resumen de jornada</span>
            </h4>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs">
              <div className="rounded-xl bg-slate-900/60 border border-slate-700/70 p-2.5">
                <span className="text-slate-400 block text-[9px] font-semibold uppercase tracking-wider">Ventas hoy</span>
                <span className="text-white font-black">{formatUsd(finDash.today.revenue)}</span>
              </div>
              <div className="rounded-xl bg-slate-900/60 border border-slate-700/70 p-2.5">
                <span className="text-slate-400 block text-[9px] font-semibold uppercase tracking-wider">Tickets</span>
                <span className="text-white font-black">{finDash.today.tickets}</span>
              </div>
              <div className="rounded-xl bg-slate-900/60 border border-slate-700/70 p-2.5">
                <span className="text-slate-400 block text-[9px] font-semibold uppercase tracking-wider">Entregados</span>
                <span className="text-white font-black">{finDash.today.orders}</span>
              </div>
              <div className="rounded-xl bg-slate-900/60 border border-slate-700/70 p-2.5">
                <span className="text-slate-400 block text-[9px] font-semibold uppercase tracking-wider">vs ayer</span>
                <span className={`font-black ${finDash.revenueDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {finDash.revenueDelta >= 0 ? '\u25b2' : '\u25bc'} {Math.abs(finDash.revenueDelta).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
          <a href={`https://wa.me/?text=${encodeURIComponent(jornadaSummary)}`} target="_blank" rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/30 transition-all text-xs font-bold w-full sm:w-auto">
            <Icon name="whatsapp" className="w-4 h-4" />Compartir jornada
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
            <Icon name="dollarSign" className="w-4 h-4 text-emerald-400" />Efectivo vs Digital (hoy)
          </h4>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Efectivo</span><span className="text-emerald-400 font-bold">{formatUsd(finDash.today.cash)}</span></div>
              <div className="h-2.5 rounded-full bg-slate-700/60 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-700" style={{ width: `${finDash.today.revenue > 0 ? (finDash.today.cash / finDash.today.revenue) * 100 : 0}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Digital (pago movil / transferencia / cartera)</span><span className="text-sky-400 font-bold">{formatUsd(finDash.today.digital)}</span></div>
              <div className="h-2.5 rounded-full bg-slate-700/60 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-400 transition-all duration-700" style={{ width: `${finDash.today.revenue > 0 ? (finDash.today.digital / finDash.today.revenue) * 100 : 0}%` }} />
              </div>
            </div>
            {finDash.today.credit > 0 && (
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Fiado del dia</span><span className="text-amber-400 font-bold">{formatUsd(finDash.today.credit)}</span></div>
                <div className="h-2.5 rounded-full bg-slate-700/60 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-700" style={{ width: `${finDash.today.revenue > 0 ? (finDash.today.credit / finDash.today.revenue) * 100 : 0}%` }} />
                </div>
              </div>
            )}
            <p className="text-[11px] text-slate-500">
              Historico total: <span className="text-emerald-400 font-bold">{formatUsd(cashDigitalTotal.cash)}</span> efectivo &middot;{' '}
              <span className="text-sky-400 font-bold">{formatUsd(cashDigitalTotal.digital)}</span> digital
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
            <Icon name="barChart" className="w-4 h-4 text-teal-400" />Ventas por Dia (ultimos 7 dias)
          </h4>
          <div className="flex items-end gap-2 h-36">
            {salesByDay.map((d) => {
              const max = Math.max(...salesByDay.map((x) => x.revenue), 1);
              const h = Math.round((d.revenue / max) * 100);
              const isToday = d.key === toYMD(new Date());
              return (
                <div key={d.key} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                  <span className="text-[9px] font-bold text-slate-300 truncate max-w-full">{d.revenue > 0 ? formatUsd(d.revenue) : ''}</span>
                  <div className="w-full flex items-end justify-center h-16">
                    <div className={`w-full rounded-t-lg transition-all duration-700 ${d.revenue > 0 ? (isToday ? 'bg-gradient-to-t from-teal-500 to-emerald-300 shadow-lg shadow-teal-500/30' : 'bg-gradient-to-t from-teal-700 to-teal-500') : 'bg-slate-700/50'}`} style={{ height: `${Math.max(d.revenue > 0 ? h : 4, 4)}%` }} />
                  </div>
                  <span className="text-[9px] text-slate-500 capitalize truncate">{isToday ? 'Hoy' : d.label}</span>
                </div>
              );
            })}
          </div>
          {salesByDay.some((d) => d.revenue > 0) && (
            <p className="text-[11px] text-slate-400">
              Ingresos (entregados) 7 dias: <span className="font-bold text-teal-300">{formatUsd(salesByDay.reduce((a, d) => a + d.revenue, 0))}</span>
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
            <Icon name="package" className="w-4 h-4 text-teal-400" />Top Productos de Hoy
          </h4>
          {finDash.topToday.length === 0 ? (
            <p className="text-xs text-slate-400">Aun no hay ventas registradas hoy.</p>
          ) : (
            <ul className="space-y-3">
              {finDash.topToday.map((p, idx) => (
                <li key={p.id} className="flex items-center justify-between text-xs gap-2">
                  <span className="text-slate-300 font-medium truncate flex items-center gap-1.5">
                    #{idx + 1} {p.name}
                    {p.marginUnit > 0 && <span className="text-[9px] font-bold text-emerald-400 shrink-0">+{formatUsd(p.marginUnit)}/un</span>}
                  </span>
                  <span className="text-teal-400 font-bold shrink-0">{p.quantity} un. &middot; {formatUsd(p.margin)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
            <Icon name="alertTriangle" className="w-4 h-4 text-amber-400" />Estado de Stock Critico
          </h4>
          <ul className="space-y-3">
            {lowStockProducts.length === 0 ? (
              <p className="text-xs text-emerald-400">Excelente! Todo el catalogo cuenta con stock suficiente.</p>
            ) : (
              lowStockProducts.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">{p.name}</span>
                  <span className="text-amber-400 font-bold">{p.stock} un. restantes</span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
            <Icon name="users" className="w-4 h-4 text-indigo-400" />Clientes con Mayor Actividad
          </h4>
          {topCustomers.length === 0 ? (
            <p className="text-xs text-slate-400">Aun no hay pedidos registrados.</p>
          ) : (
            <ul className="space-y-3">
              {topCustomers.map((c, idx) => (
                <li key={c.phone} className="flex items-center justify-between text-xs gap-2">
                  <span className="text-slate-300 font-medium truncate">#{idx + 1} {c.phone}</span>
                  <span className="text-teal-400 font-bold shrink-0">{c.orders} pedidos</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-slate-500">
            Total clientes registrados: <span className="font-bold text-white">{allCustomers.length}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
