import { useState, useEffect } from 'react';
import { haversineKm } from '../../utils/order.js';

export default function EtaEstimate({ cLat, cLng, dLat, dLng }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const km = haversineKm(cLat, cLng, dLat, dLng);
  const kmRoad = km * 1.3;
  const minutes = Math.max(1, Math.round((kmRoad / 20) * 60));
  const eta = new Date(now + minutes * 60000);
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="rounded-xl bg-slate-900/60 border border-teal-500/20 p-2.5">
        <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Distancia</span>
        <span className="block text-lg font-black text-white mt-0.5">
          {km.toFixed(1)}<span className="text-[10px] font-semibold text-slate-400 ml-0.5">km</span>
        </span>
      </div>
      <div className="rounded-xl bg-slate-900/60 border border-teal-500/20 p-2.5">
        <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Llegada</span>
        <span className="block text-lg font-black text-teal-300 mt-0.5">
          {eta.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="rounded-xl bg-slate-900/60 border border-teal-500/20 p-2.5">
        <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Tiempo</span>
        <span className="block text-lg font-black text-white mt-0.5">
          ~{minutes}<span className="text-[10px] font-semibold text-slate-400 ml-0.5">min</span>
        </span>
      </div>
    </div>
  );
}
