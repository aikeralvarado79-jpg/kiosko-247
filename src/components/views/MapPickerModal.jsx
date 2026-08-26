import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useOverlay } from '../../hooks/overlay.js';

const makePinIcon = (color, label) =>
  L.divIcon({
    className: '',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))">
        <span style="font-size:10px;font-weight:800;color:${color};background:#0f172a;border:1px solid ${color};border-radius:999px;padding:0 6px;white-space:nowrap">${label || ''}</span>
        <svg width="26" height="34" viewBox="0 0 26 34" style="overflow:visible">
          <path d="M13 1C6.4 1 1 6.4 1 13c0 8.8 12 20 12 20s12-11.2 12-20C25 6.4 19.6 1 13 1z" fill="${color}" stroke="#fff" stroke-width="2"/>
          <circle cx="13" cy="13" r="4.5" fill="#fff"/>
        </svg>
      </div>`,
    iconSize: [26, 44],
    iconAnchor: [13, 42]
  });

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    x: <path d="M18 6 6 18M6 6l12 12" />,
    mapPin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
    search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
    check: <polyline points="20 6 9 17 4 12" />,
    alertTriangle: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4M12 17h.01" /></>,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

export default function MapPickerModal({ title, initial, onPick, onClose }) {
  useOverlay(true, onClose);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const initialPointRef = useRef(initial?.lat != null && initial?.lng != null ? { lat: initial.lat, lng: initial.lng } : null);
  const [point, setPoint] = useState(initialPointRef.current);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const start = initialPointRef.current;
    const defaultCenter = start ? [start.lat, start.lng] : [10.4806, -66.9036];
    const map = L.map(containerRef.current, { zoomControl: true }).setView(defaultCenter, start ? 16 : 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    mapRef.current = map;

    const marker = L.marker(defaultCenter, { icon: makePinIcon('#14b8a6', 'PUNTO'), draggable: true }).addTo(map);
    markerRef.current = marker;
    if (!initialPointRef.current) marker.setOpacity(0.6);

    map.on('click', (e) => {
      setPoint({ lat: e.latlng.lat, lng: e.latlng.lng });
      marker.setLatLng(e.latlng);
      marker.setOpacity(1);
    });
    marker.on('dragend', (e) => {
      setPoint({ lat: e.target.getLatLng().lat, lng: e.target.getLatLng().lng });
      marker.setOpacity(1);
    });

    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
  }, []);

  const searchTimer = useRef(null);
  const handleSearch = (e) => {
    const q = e.target.value;
    setSearch(q);
    clearTimeout(searchTimer.current);
    if (q.trim().length < 4) { setSuggestions([]); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q.trim())}&limit=6&addressdetails=1`);
        const data = await res.json();
        if (Array.isArray(data)) setSuggestions(data);
      } catch { setSuggestions([]); }
    }, 400);
  };

  const applySuggestion = (s) => {
    const lat = Number(s.lat);
    const lng = Number(s.lon);
    setPoint({ lat, lng });
    setSearch(s.display_name || s.name || '');
    setSuggestions([]);
    const map = mapRef.current;
    if (map) {
      map.setView([lat, lng], 17);
      if (markerRef.current) { markerRef.current.setLatLng([lat, lng]); markerRef.current.setOpacity(1); }
    }
  };

  const useMyLocation = () => {
    setLocError('');
    if (!navigator.geolocation) { setLocError('Tu navegador no soporta geolocalizacion.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPoint({ lat, lng });
        const map = mapRef.current;
        if (map) { map.setView([lat, lng], 17); if (markerRef.current) { markerRef.current.setLatLng([lat, lng]); markerRef.current.setOpacity(1); } }
        setLocating(false);
      },
      (err) => { setLocating(false); setLocError(err && err.code === 1 ? 'Permiso de ubicacion denegado. Activalo en los ajustes del navegador.' : 'No se pudo obtener la ubicacion.'); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  const confirm = () => {
    if (!point) { setLocError('Toca el mapa o busca una direccion para elegir el punto.'); return; }
    onPick({ lat: Number(point.lat), lng: Number(point.lng), address: search.trim() || null });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg glass-strong bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 max-h-[92vh] flex flex-col overflow-hidden animate-modal-spring">
        <div className="pt-[max(1rem,env(safe-area-inset-top))] p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Icon name="mapPin" className="w-5 h-5 text-teal-400" />
              {title || 'Elegir punto en el mapa'}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Busca una direccion, toca el mapa o arrastra el marcador.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1 min-h-0">
          <div className="relative">
            <input type="text" value={search} onChange={handleSearch} placeholder="Buscar direccion o lugar (ej: Av. Bolivar 123)"
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none pr-10" />
            <Icon name="search" className="w-4 h-4 text-slate-500 absolute right-3 top-3.5" />
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl overflow-hidden z-20">
                {suggestions.map((s) => (
                  <button key={s.place_id} type="button" onClick={() => applySuggestion(s)}
                    className="w-full text-left px-3 py-2.5 text-xs text-slate-200 hover:bg-slate-700/70 transition-colors border-b border-slate-700/50 last:border-0">
                    {s.display_name || s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" onClick={useMyLocation} disabled={locating}
            className="w-full px-4 py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-sm font-bold hover:bg-cyan-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
            <Icon name="mapPin" className="w-4 h-4" />
            {locating ? 'Obteniendo ubicacion...' : 'Usar mi ubicacion actual'}
          </button>
          <div className="rounded-2xl overflow-hidden border border-slate-700 bg-slate-900">
            <div ref={containerRef} className="w-full h-56 sm:h-64" />
          </div>
          {point && (
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Icon name="check" className="w-3.5 h-3.5 text-emerald-400" />
              Punto elegido: <span className="text-white font-bold">{point.lat.toFixed(6)}, {point.lng.toFixed(6)}</span>
            </p>
          )}
          {locError && (
            <p className="text-xs text-rose-400 flex items-center gap-1.5">
              <Icon name="alertTriangle" className="w-3.5 h-3.5 flex-shrink-0" />{locError}
            </p>
          )}
          <button type="button" onClick={confirm}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-sm hover:from-teal-400 hover:to-emerald-400 shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2">
            <Icon name="check" className="w-4 h-4" />Confirmar punto
          </button>
        </div>
      </div>
    </div>
  );
}
