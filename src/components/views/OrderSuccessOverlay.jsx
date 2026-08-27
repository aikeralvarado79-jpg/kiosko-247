import { useMemo } from 'react';
import { formatUsd } from '../../utils/format.js';
import Theo from '../Theo.jsx';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    clock: <path d="M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />,
    navigation: <path d="M3 11 22 2-9 19-2-8-8-2z" />,
    whatsapp: <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || null}
    </svg>
  );
};

export default function OrderSuccessOverlay({ order, onClose, onTrack, onShare }) {
  const orderNum = order?.id ?? order?.orderId ?? order?.number ?? '';
  const isDelivery = order?.type === 'delivery';
  const eta = order?.estimatedMinutes || (isDelivery ? 25 : 10);
  const items = Array.isArray(order?.items) ? order.items : [];

  // Partículas de confeti con parámetros aleatorios estables por render.
  const confetti = useMemo(
    () =>
      Array.from({ length: 26 }).map((_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 9) * 0.18}s`,
        dur: `${2.2 + (i % 5) * 0.4}s`,
        rot: `${360 + (i % 3) * 240}deg`,
        x: `${(i % 2 === 0 ? 1 : -1) * (24 + (i % 5) * 18)}px`,
        color: ['#2dd4bf', '#34d399', '#fbbf24', '#f472b6', '#818cf8', '#38bdf8'][i % 6]
      })),
    []
  );

  return (
    <div className="fixed inset-0 z-[85] overflow-hidden bg-gradient-to-br from-teal-900 via-slate-950 to-emerald-950 animate-fade-in select-none" role="dialog" aria-label="Pedido realizado con éxito">
      {/* Confeti */}
      {confetti.map((c, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: c.left,
            background: c.color,
            '--confetti-delay': c.delay,
            '--confetti-dur': c.dur,
            '--confetti-rot': c.rot,
            '--confetti-x': c.x
          }}
        />
      ))}

      <div className="relative h-full flex flex-col items-center justify-center px-6 text-center">
        {/* Check dentro de anillo */}
        <div className="success-ring w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white/10 border-2 border-white/30 backdrop-blur-md flex items-center justify-center shadow-2xl shadow-teal-500/40 mb-8">
          <svg className="success-check w-12 h-12 sm:w-14 sm:h-14 text-teal-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>

        <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-teal-200/80 mb-3">Pedido confirmado</span>
        <h2 className="font-display text-3xl sm:text-5xl font-black text-white leading-tight">¡Gracias por tu compra!</h2>

        {/* THEO celebra la compra */}
        <Theo mood="celebrate" className="w-36 h-32 mt-6" />

        <div className="success-order-num mt-8 px-8 py-5 rounded-3xl bg-white/10 border border-white/20 backdrop-blur-md">
          <span className="block text-[11px] font-bold uppercase tracking-widest text-white/60 mb-1">Tu número de pedido</span>
          <span className="block font-display text-5xl sm:text-7xl font-black text-white tracking-tight">#{orderNum}</span>
        </div>

        <p className="mt-6 text-sm text-white/85 flex items-center gap-2">
          <Icon name="clock" className="w-4 h-4 text-teal-300" />
          Estimado: ~{eta} min {isDelivery ? 'para tu entrega' : 'para retirar en tienda'}
        </p>

        {items.length > 0 && (
          <div className="mt-4 w-full max-w-sm max-h-28 overflow-y-auto space-y-1 text-left scrollbar-none">
            {items.slice(0, 6).map((it, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-xs text-white/80">
                <span className="truncate">{it.quantity}× {it.name}</span>
                {Number(it.price) > 0 && <span className="text-white/60 shrink-0">{formatUsd(it.price * it.quantity)}</span>}
              </div>
            ))}
            {items.length > 6 && <p className="text-[11px] text-white/50 text-center pt-1">y {items.length - 6} más…</p>}
          </div>
        )}

        <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full max-w-sm">
          <button
            onClick={onTrack}
            className="flex-1 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 text-sm font-black shadow-xl shadow-teal-500/30 active:scale-95 transition-all showcase-pulse-cta"
          >
            <span className="flex items-center justify-center gap-2">
              <Icon name="navigation" className="w-4 h-4" /> {isDelivery ? 'Seguir mi pedido' : 'Ver mi pedido'}
            </span>
          </button>
          <button
            onClick={onShare}
            className="flex-1 px-5 py-3.5 rounded-2xl bg-green-500/20 border border-green-400/40 text-green-300 text-sm font-bold hover:bg-green-500/30 active:scale-95 transition-all"
          >
            <span className="flex items-center justify-center gap-2">
              <Icon name="whatsapp" className="w-4 h-4" /> Compartir
            </span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-6 text-xs text-white/50 hover:text-white transition-colors"
        >
          Seguir comprando
        </button>
      </div>
    </div>
  );
}
