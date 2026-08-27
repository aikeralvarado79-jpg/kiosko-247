import { formatPhoneWhatsApp } from '../../utils/phone.js';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    mapPin: <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0zM12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />,
    eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
    whatsapp: <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />,
    check: <path d="M20 6 9 17l-5-5" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

export default function AdminDeliveriesView({
  activeDeliveries,
  courierOrderId,
  courierActive,
  onOpenFicha,
  onUpdateOrderStatus,
  onStartCourierTracking,
  onStopCourierTracking,
  storeLocation,
  DeliveriesRouteMap,
}) {
  return (
    <div className="space-y-4">
      <DeliveriesRouteMap storeLocation={storeLocation} deliveries={activeDeliveries.ordered} />
      {activeDeliveries.ordered.length === 0 && activeDeliveries.withoutCoords.length === 0 ? (
        <div className="py-10 text-center text-slate-500 space-y-2 bg-slate-800/40 rounded-2xl border border-slate-700/50">
          <Icon name="mapPin" className="w-10 h-10 text-slate-700 mx-auto" />
          <p className="font-bold text-slate-400">No hay entregas activas</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {activeDeliveries.ordered.map((o) => {
            const wa = formatPhoneWhatsApp(o.phone);
            const isTracking = courierActive && courierOrderId === o.id;
            return (
              <div key={o.id} className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2.5">
                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  <span
                    className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${
                      o.status === 'en_camino'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    {o.routeNumber}
                  </span>
                  <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-teal-400">{o.id}</span>
                      <span className="text-xs font-bold text-white truncate">{o.customerName}</span>
                      {isTracking && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          GPS en vivo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">{o.address}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    <button
                      onClick={() => onOpenFicha(o)}
                      title="Ver ficha del pedido"
                      className="px-2.5 py-1.5 rounded-xl bg-slate-700/40 border border-slate-600 text-slate-200 text-[11px] font-bold hover:border-teal-500/50 hover:text-teal-300 transition-all inline-flex items-center gap-1"
                    >
                      <Icon name="eye" className="w-3 h-3" /> Ficha
                    </button>
                    {o.lat != null && o.lng != null && (
                      <a
                        href={`https://www.google.com/maps?q=${o.lat},${o.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-xl bg-sky-500/15 border border-sky-500/40 text-sky-300 text-[11px] font-bold hover:bg-sky-500/25 transition-all inline-flex items-center gap-1"
                      >
                        <Icon name="mapPin" className="w-3 h-3" /> Maps
                      </a>
                    )}
                    {wa && (
                      <a
                        href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hola ${o.customerName}, tu pedido ${o.id} en Kiosko 247 está en camino`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[11px] font-bold hover:bg-emerald-500/25 transition-all inline-flex items-center gap-1"
                      >
                        <Icon name="whatsapp" className="w-3 h-3" /> WA
                      </a>
                    )}
                  </div>
                </div>

                {o.status === 'listo' && (
                  <button
                    onClick={() => {
                      onUpdateOrderStatus(o.id, 'en_camino');
                      onStartCourierTracking(o.id);
                    }}
                    className="w-full py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Icon name="mapPin" className="w-4 h-4" /> Iniciar entrega (rastreo GPS en vivo)
                  </button>
                )}
                {o.status === 'en_camino' && (
                  <div className="space-y-2">
                    {isTracking ? (
                      <button
                        onClick={onStopCourierTracking}
                        className="w-full py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold hover:bg-rose-500/25 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Icon name="mapPin" className="w-4 h-4" /> Detener rastreo en vivo
                      </button>
                    ) : (
                      <button
                        onClick={() => onStartCourierTracking(o.id)}
                        className="w-full py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Icon name="mapPin" className="w-4 h-4" /> Compartir GPS en vivo
                      </button>
                    )}
                    <button
                      onClick={() => onUpdateOrderStatus(o.id, 'entregado')}
                      className="w-full py-2.5 rounded-xl bg-sky-500/15 border border-sky-500/40 text-sky-300 text-xs font-bold hover:bg-sky-500/25 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Icon name="check" className="w-4 h-4" /> Marcar entregado
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {activeDeliveries.withoutCoords.length > 0 && (
            <div className="px-3 py-2 rounded-2xl bg-slate-800/40 border border-slate-700/50 text-[11px] text-slate-400">
              {activeDeliveries.withoutCoords.length} entrega(s) sin coordenadas (no aparecen en el mapa):{' '}
              {activeDeliveries.withoutCoords.map((o) => o.id).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
