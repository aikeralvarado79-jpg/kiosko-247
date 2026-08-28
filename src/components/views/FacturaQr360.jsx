import { useState } from 'react';
import { formatUsd, formatBs, usdToBs } from '../../utils/format.js';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    scan: <><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><line x1="7" y1="12" x2="17" y2="12" /></>,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="1" />}
    </svg>
  );
};

export default function FacturaQr360({ order, rate }) {
  const [flipped, setFlipped] = useState(false);
  const lines = [
    `Factura Kiosko 24/7`,
    `Pedido #${order.id}`,
    `Fecha: ${order.timestamp || '—'}`,
    ...(Array.isArray(order.items) ? order.items.map((it) => `${it.quantity}x ${it.name}`) : []),
    `Total: ${formatUsd(order.total)}`
  ];
  const qrData = encodeURIComponent(lines.join('\n'));
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${qrData}`;
  const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className="rounded-2xl bg-slate-800/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Icon name="scan" className="w-4 h-4 text-teal-400" /> Factura QR 360
        </span>
        <span className="px-1.5 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-300 text-[9px] font-bold uppercase tracking-wider">
          {flipped ? 'Resumen' : 'Escaneable'}
        </span>
      </div>

      <div className="perspective-800" onClick={() => !reducedMotion && setFlipped((f) => !f)}>
        <div
          className="relative w-full aspect-[3/4] max-h-72 mx-auto preserve-3d cursor-pointer transition-transform duration-500"
          style={{ transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        >
          <div className="absolute inset-0 backface-hidden rounded-2xl glass-strong bg-slate-900 border border-slate-700 flex flex-col items-center justify-center gap-3 p-4">
            <img
              src={qrUrl}
              alt={`Código QR de la factura #${order.id}`}
              className="w-44 h-44 rounded-xl bg-white p-2"
              loading="lazy"
            />
            <p className="text-[11px] text-slate-400 text-center">
              Escanea para ver tu factura del pedido #{order.id}.
              {!reducedMotion && <span className="block text-teal-400 mt-1">Toca para girar y ver el resumen</span>}
            </p>
          </div>
          <div
            className="absolute inset-0 backface-hidden rounded-2xl bg-gradient-to-br from-teal-950/60 to-slate-900 border border-teal-500/30 flex flex-col justify-between p-4"
            style={{ transform: 'rotateY(180deg)' }}
          >
            <div>
              <p className="text-[9px] uppercase tracking-widest text-teal-400 font-bold">Empresas Alvarados</p>
              <p className="text-[10px] text-slate-400">Kiosko 24/7 · Resumen de factura</p>
            </div>
            <div className="space-y-1.5 my-2 max-h-28 overflow-y-auto scrollbar-none">
              {(order.items || []).map((it, i) => (
                <div key={i} className="flex justify-between text-[11px]">
                  <span className="text-slate-300 truncate pr-2">{it.quantity}x {it.name}</span>
                  <span className="text-white font-bold shrink-0">{formatUsd(it.price * it.quantity)}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="border-t border-slate-700 pt-2 flex justify-between items-center">
                <span className="text-[11px] text-slate-400">Total</span>
                <span className="text-base font-black text-teal-300">
                  {formatUsd(order.total)}
                  {rate?.rate > 0 && (
                    <span className="block text-[10px] text-teal-400/70 text-right">{formatBs(usdToBs(order.total, rate.rate))}</span>
                  )}
                </span>
              </div>
              <p className="text-[9px] text-slate-500 mt-2">Pedido #{order.id} · {order.timestamp}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
