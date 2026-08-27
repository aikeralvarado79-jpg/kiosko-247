import { useState, useMemo, useEffect } from 'react';
import { haptic } from '../../utils/haptics.js';
import { formatUsd, formatBs, usdToBs } from '../../utils/format.js';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    store: <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7M2 7v13a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7M2 7h20M12 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || null}
    </svg>
  );
};

export default function ShowcaseMode({ products, promos, rate, onResume, onOrderNow, onOpenProduct }) {
  const [stepIdx, setStepIdx] = useState(0);

  // Carrusel de items: promos con imagen + productos con stock.
  const items = useMemo(() => {
    const list = [];
    const activePromos = Array.isArray(promos) ? promos.filter((p) => p.active && p.image) : [];
    activePromos.forEach((p) => list.push({ kind: 'promo', label: p.title, sub: p.subtitle, image: p.image }));
    const withImage = (Array.isArray(products) ? products : []).filter((p) => p.image && Math.max(0, (Number(p.stock) || 0) - (Number(p.reserved) || 0)) > 0);
    withImage.slice(0, 8).forEach((p) => list.push({ kind: 'product', product: p, label: p.name, sub: p.brand || p.category, image: p.image }));
    if (!list.length && Array.isArray(products) && products.length) {
      products.slice(0, 6).forEach((p) => list.push({ kind: 'product', product: p, label: p.name, sub: p.category, image: p.image }));
    }
    return list;
  }, [promos, products]);

  useEffect(() => {
    if (items.length <= 1) return undefined;
    const id = setInterval(() => setStepIdx((i) => (i + 1) % items.length), 4000);
    return () => clearInterval(id);
  }, [items.length]);

  // Silencio: cualquier tap reanuda la navegación normal.
  const resume = () => {
    haptic(8);
    onResume?.();
  };

  const item = items.length ? items[stepIdx % items.length] : null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950 overflow-hidden select-none"
      role="region"
      aria-label="Modo vitrina del kiosko"
      onClick={resume}
    >
      {/* Fondo de la tarjeta actual en rotación */}
      {item?.image && (
        <div
          key={stepIdx}
          className="absolute inset-0 bg-cover bg-center showcase-kenburns"
          style={{ backgroundImage: `url(${item.image.replace('w=500', 'w=1400')})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/25" />

      <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 text-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[10px] font-bold uppercase tracking-[0.25em] mb-6">
          <Icon name="store" className="w-3 h-3" /> Kiosko 24/7 · Abierto
        </span>

        <div key={`card-${stepIdx}`} className="showcase-fade">
          {item?.kind === 'promo' ? (
            <>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 mb-2 block">Oferta especial</span>
              <h2 className="font-display text-3xl sm:text-5xl font-black text-white leading-tight max-w-xl">{item.label}</h2>
              {item.sub && <p className="text-white/80 text-sm mt-3 max-w-md">{item.sub}</p>}
            </>
          ) : item?.product ? (
            <>
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300 mb-2 block">
                {item.product.category} {item.product.brand ? `· ${item.product.brand}` : ''}
              </span>
              <h2 className="font-display text-3xl sm:text-5xl font-black text-white leading-tight max-w-xl">{item.product.name}</h2>
              <p className="text-amber-300 font-black text-2xl sm:text-4xl mt-3">
                {formatUsd(item.product.price)}
                {rate?.rate > 0 && (
                  <span className="text-white/70 text-sm sm:text-base font-semibold block mt-1">
                    {formatBs(usdToBs(item.product.price, rate.rate))}
                  </span>
                )}
              </p>
            </>
          ) : (
            <span className="text-lg text-white/80">Descubre el kiosko digital de Empresas Alvarados</span>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (item?.product) onOpenProduct?.(item.product);
            else {
              haptic(12);
              onOrderNow?.();
            }
          }}
          className="mt-10 showcase-pulse-cta px-8 py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 text-base font-black shadow-2xl shadow-teal-500/30 active:scale-95 transition-all"
        >
          {item?.product ? 'Ver detalle y agregar' : 'Pedir ahora'}
        </button>

        <p className="mt-6 text-[11px] text-white/50">Toca en cualquier lugar para continuar navegando</p>
        {items.length > 1 && (
          <div className="mt-3 flex gap-1.5">
            {items.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === stepIdx % items.length ? 'w-5 bg-white' : 'w-1.5 bg-white/25'}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
