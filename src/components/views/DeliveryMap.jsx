import { useRef, useEffect } from 'react';
import L from 'leaflet';
import { STATUS_LABELS } from '../../utils/order.js';
import { makePinIcon, makeCourierIcon, makeDestIcon } from '../../utils/mapMarkers.js';
import EtaEstimate from './EtaEstimate.jsx';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    externalLink: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></>,
    store: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
    mapPin: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="1" />}
    </svg>
  );
};

export default function DeliveryMap({ order, storeLocation }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerGroupRef = useRef(null);
  const fittedRef = useRef(false);
  const courierMarkerRef = useRef(null);
  const routeRef = useRef(null);

  const dest = order && order.lat != null && order.lng != null;
  const courier = order && order.courier_lat != null && order.courier_lng != null;
  const store = storeLocation && storeLocation.lat != null && storeLocation.lng != null;
  const showMap = order && order.type === 'delivery' && (dest || courier || store);

  useEffect(() => {
    if (!showMap || !containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    mapRef.current = map;
    layerGroupRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      fittedRef.current = false;
      courierMarkerRef.current = null;
      routeRef.current = null;
    };
  }, [showMap]);

  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    const pts = [];
    if (store) pts.push({ lat: Number(storeLocation.lat), lng: Number(storeLocation.lng), kind: 'store' });
    if (dest) pts.push({ lat: Number(order.lat), lng: Number(order.lng), kind: 'dest' });
    if (courier) pts.push({ lat: Number(order.courier_lat), lng: Number(order.courier_lng), kind: 'courier' });

    layerGroup.clearLayers();
    let courierMarker = courierMarkerRef.current;
    pts.forEach((m) => {
      let icon;
      if (m.kind === 'courier') icon = makeCourierIcon();
      else if (m.kind === 'store') icon = makePinIcon('#22d3ee', 'COMERCIO');
      else icon = makeDestIcon();
      if (m.kind === 'courier') {
        if (!courierMarker) {
          courierMarker = L.marker([m.lat, m.lng], { icon, zIndexOffset: 1000 }).addTo(layerGroup);
          courierMarkerRef.current = courierMarker;
        } else {
          courierMarker.setLatLng([m.lat, m.lng]);
          courierMarker.setIcon(icon);
          courierMarker.addTo(layerGroup);
        }
      } else {
        L.marker([m.lat, m.lng], { icon }).addTo(layerGroup);
      }
    });

    if (routeRef.current) {
      layerGroup.removeLayer(routeRef.current);
      routeRef.current = null;
    }
    if (courier && dest) {
      routeRef.current = L.polyline(
        [
          [Number(order.courier_lat), Number(order.courier_lng)],
          [Number(order.lat), Number(order.lng)]
        ],
        { color: '#a7f3d0', weight: 5, opacity: 0.5, className: 'kiosko-route-animated' }
      ).addTo(layerGroup);
      const url = `https://router.project-osrm.org/route/v1/driving/${Number(order.courier_lng)},${Number(order.courier_lat)};${Number(order.lng)},${Number(order.lat)}?overview=full&geometries=geojson`;
      fetch(url)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => {
          const coords = data?.routes?.[0]?.geometry?.coordinates;
          if (!Array.isArray(coords) || coords.length < 2) return;
          if (routeRef.current) layerGroup.removeLayer(routeRef.current);
          const poly = L.polyline(
            coords.map((c) => [c[1], c[0]]),
            { color: '#10b981', weight: 5, opacity: 0.9, className: 'kiosko-route-animated' }
          ).addTo(layerGroup);
          routeRef.current = poly;
        })
        .catch(() => {});
    }

    const shouldFit = !fittedRef.current || !courier;
    if (pts.length && shouldFit) {
      const latLngs = pts.map((p) => [p.lat, p.lng]);
      map.fitBounds(L.latLngBounds(latLngs).pad(0.25), { animate: false });
      fittedRef.current = true;
    } else if (courier) {
      const courierLatLng = L.latLng(Number(order.courier_lat), Number(order.courier_lng));
      if (!map.getBounds().contains(courierLatLng)) {
        map.panTo(courierLatLng, { animate: true, duration: 0.5 });
      }
    }
  }, [courier, dest, store, storeLocation?.lat, storeLocation?.lng, order?.lat, order?.lng, order?.courier_lat, order?.courier_lng]);

  const destUrl = dest ? `https://www.google.com/maps?q=${Number(order.lat)},${Number(order.lng)}` : null;
  const courierUrl = courier ? `https://www.google.com/maps?q=${Number(order.courier_lat)},${Number(order.courier_lng)}` : null;
  const storeUrl = store ? `https://www.google.com/maps?q=${Number(storeLocation.lat)},${Number(storeLocation.lng)}` : null;

  if (!showMap) return null;

  const statusLabel = order.status === 'en_camino' ? 'En camino a tu destino' : STATUS_LABELS[order.status] || 'En preparación';

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900/80 border border-slate-700/80">
        <span className="relative flex w-3 h-3 shrink-0">
          <span className={`absolute inline-flex h-full w-full rounded-full ${courier ? 'bg-emerald-400 opacity-75 animate-ping' : 'bg-teal-400 opacity-75 animate-ping'}`} />
          <span className={`relative inline-flex rounded-full w-3 h-3 ${courier ? 'bg-emerald-400' : 'bg-teal-400'}`} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white truncate">{statusLabel}</p>
          <p className="text-[11px] text-slate-400 truncate">
            {courier
              ? 'Repartidor en vivo · la posición se actualiza cada 5 s'
              : dest
              ? 'Preparando tu pedido para la entrega'
              : 'Tu pedido de reparto se está preparando'}
          </p>
        </div>
        {courier && courierUrl && (
          <a
            href={courierUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold hover:bg-emerald-500/25 transition-all"
            title="Ver repartidor en Google Maps"
          >
            <Icon name="externalLink" className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      <div className="relative z-0 rounded-2xl overflow-hidden border border-slate-700 bg-slate-900">
        <div ref={containerRef} className="w-full h-48 sm:h-60" />
        {courier && (
          <div className="absolute top-2.5 left-2.5 z-[1000] flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950/85 border border-emerald-500/40 backdrop-blur-md text-emerald-300 text-[10px] font-bold pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            EN VIVO
          </div>
        )}
      </div>

      {courier && dest && (
        <EtaEstimate cLat={Number(order.courier_lat)} cLng={Number(order.courier_lng)} dLat={Number(order.lat)} dLng={Number(order.lng)} />
      )}

      <div className="flex flex-wrap gap-2">
        {store && storeUrl && (
          <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold hover:bg-cyan-500/25 transition-all">
            <Icon name="store" className="w-3.5 h-3.5" />
            Comercio
          </a>
        )}
        {courier && courierUrl && (
          <a href={courierUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold hover:bg-emerald-500/25 transition-all">
            <Icon name="mapPin" className="w-3.5 h-3.5" />
            Repartidor
          </a>
        )}
        {dest && destUrl && (
          <a href={destUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/15 border border-teal-500/40 text-teal-300 text-[11px] font-bold hover:bg-teal-500/25 transition-all">
            <Icon name="mapPin" className="w-3.5 h-3.5" />
            Destino
          </a>
        )}
      </div>
    </div>
  );
}
