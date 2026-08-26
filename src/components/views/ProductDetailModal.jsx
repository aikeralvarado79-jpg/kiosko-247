import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useOverlay, exitThen } from '../../hooks/overlay.js';
import ProductImg from '../ui/ProductImg.jsx';
import Btn from '../ui/Btn.jsx';
import { formatUsd, formatBs, usdToBs, formatSize } from '../../utils/format.js';
import { categoryIdentity } from '../../utils/category.js';
import { dominantColorFromUrl } from '../../experience.js';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    x: <path d="M18 6 6 18M6 6l12 12" />,
    heart: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" />,
    heartFilled: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" fill="currentColor" stroke="none" />,
    maximize: <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />,
    chevronLeft: <path d="m15 18-6-6 6-6" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
    minus: <path d="M5 12h14" />,
    plus: <path d="M12 5v14M5 12h14" />,
    shoppingBag: <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

export default function ProductDetailModal({ product, sameBrandProducts = [], rate, onClose, onAddToCart, isFavorite, onToggleFavorite, onNavigate }) {
  const [quantity, setQuantity] = useState(1);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [touchX, setTouchX] = useState(null);
  const [slideDir, setSlideDir] = useState('right');
  const [accent, setAccent] = useState(null);
  const isOut = product.stock <= 0 || product.reserved >= product.stock;
  const unitBs = usdToBs(product.price, rate?.rate);
  const lineTotal = product.price * quantity;

  useEffect(() => {
    let dead = false;
    setAccent(null);
    dominantColorFromUrl(product?.image).then((rgb) => { if (!dead && rgb) setAccent(rgb); });
    return () => { dead = true; };
  }, [product?.id]);

  const panelExitRef = useRef(null);
  const requestClose = () => {
    if (showFullscreen) setShowFullscreen(false);
    else exitThen(panelExitRef, onClose)();
  };
  useOverlay(true, requestClose);

  const currentIndex = useMemo(() => {
    const idx = (sameBrandProducts || []).findIndex((p) => p.id === product.id);
    return idx >= 0 ? idx : 0;
  }, [product.id, sameBrandProducts]);

  const totalInBrand = (sameBrandProducts || []).length;
  const hasSameBrand = totalInBrand > 1;

  const goTo = useCallback(
    (dir) => {
      if (!hasSameBrand) return;
      const next = currentIndex + dir;
      if (next < 0 || next >= totalInBrand) return;
      setSlideDir(dir > 0 ? 'right' : 'left');
      onNavigate?.(sameBrandProducts[next]);
      setQuantity(1);
    },
    [currentIndex, hasSameBrand, totalInBrand, onNavigate, sameBrandProducts]
  );

  const handleTouchStart = (e) => setTouchX(e.touches?.[0]?.clientX ?? null);
  const handleTouchEnd = (e) => {
    if (touchX == null) return;
    const delta = (e.changedTouches?.[0]?.clientX ?? 0) - touchX;
    if (Math.abs(delta) > 40) goTo(delta > 0 ? -1 : 1);
    setTouchX(null);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') goTo(-1);
      if (e.key === 'ArrowRight') goTo(1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goTo]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={requestClose} />

      <div ref={panelExitRef} className="relative w-full sm:max-w-2xl max-h-[92vh] glass-strong bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-screen-up flex flex-col mx-auto">
        <div className="sm:hidden absolute top-2.5 left-1/2 -translate-x-1/2 z-20 w-12 h-1.5 rounded-full bg-slate-700" />

        <button onClick={requestClose} className="absolute top-4 right-4 z-20 p-2 rounded-full bg-slate-950/60 text-slate-300 hover:text-white backdrop-blur-md hover:bg-slate-800 transition-all">
          <Icon name="x" className="w-5 h-5" />
        </button>

        <button onClick={onToggleFavorite} className="absolute top-4 left-4 z-20 p-2 rounded-full bg-slate-950/60 text-slate-300 hover:text-white backdrop-blur-md hover:bg-slate-800 transition-all active:scale-75"
          aria-label={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}>
          <Icon name={isFavorite ? 'heartFilled' : 'heart'} className={`w-5 h-5 ${isFavorite ? 'text-rose-400' : ''}`} />
        </button>

        <div key={`img-${product.id}`}
          style={{ viewTransitionName: 'active-product-photo', ...(accent ? { '--accent': accent } : {}) }}
          className={`relative h-40 sm:h-56 bg-slate-950 shrink-0 ${slideDir === 'right' ? 'animate-brand-slide-right' : 'animate-brand-slide-left'}`}
          onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {accent && (
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(circle at 72% 18%, rgba(var(--accent), 0.4), transparent 62%)' }} />
          )}
          <ProductImg product={product} alt={product.name} className="w-full h-full object-cover" />
          <div className="absolute top-4 left-4 sm:left-4">
            <span className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl ${categoryIdentity(product.category).chip} backdrop-blur-md text-xs font-bold border shadow-sm`}>
              <Icon name={categoryIdentity(product.category).icon} className="w-3 h-3" />
              {product.category}
            </span>
          </div>
          <button onClick={() => setShowFullscreen(true)}
            className="absolute bottom-3 right-3 z-20 p-2 rounded-xl bg-slate-950/70 backdrop-blur-md border border-white/15 text-slate-200 hover:text-white hover:border-teal-400/50 transition-all active:scale-90"
            aria-label="Ver imagen en pantalla completa">
            <Icon name="maximize" className="w-5 h-5" />
          </button>
          {hasSameBrand && (
            <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5">
              <button onClick={() => goTo(-1)} className="p-1.5 rounded-lg bg-slate-950/70 backdrop-blur-md border border-white/15 text-slate-200 hover:text-white hover:border-teal-400/50 transition-all active:scale-90" aria-label="Producto anterior de la marca">
                <Icon name="chevronLeft" className="w-4 h-4" />
              </button>
              <span className="px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md border border-teal-500/30 text-[10px] font-bold text-teal-300">
                {currentIndex + 1}/{totalInBrand} · {product.brand}
              </span>
              <button onClick={() => goTo(1)} className="p-1.5 rounded-lg bg-slate-950/70 backdrop-blur-md border border-white/15 text-slate-200 hover:text-white hover:border-teal-400/50 transition-all active:scale-90" aria-label="Siguiente producto de la marca">
                <Icon name="chevronRight" className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {hasSameBrand && (
          <div className="flex gap-2 px-4 sm:px-6 pt-3 pb-1 shrink-0">
            {sameBrandProducts.map((p, i) => (
              <button key={p.id} onClick={() => { setSlideDir(i > currentIndex ? 'right' : 'left'); onNavigate?.(p); setQuantity(1); }}
                className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                  i === currentIndex ? 'border-teal-400 ring-2 ring-teal-500/30' : 'border-slate-700 hover:border-teal-500/50'
                }`} aria-label={`Ver ${p.name}`}>
                <ProductImg product={p} alt={p.name} className="w-full h-full object-cover" />
                {i === currentIndex && <span className="absolute inset-0 bg-teal-500/20" />}
              </button>
            ))}
          </div>
        )}

        <div key={`body-${product.id}`}
          className={`p-4 sm:p-6 flex flex-col overflow-y-auto flex-1 min-h-0 ${slideDir === 'right' ? 'animate-brand-slide-right' : 'animate-brand-slide-left'}`}>
          <div className="mb-5 sm:mb-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-mono">CODIGO: {product.code}</span>
                {product.brand && <span className="text-xs font-semibold text-teal-400">{product.brand}</span>}
              </div>
              <span className={`text-xs font-semibold ${product.stock - product.reserved > 5 ? 'text-teal-400' : product.stock - product.reserved > 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                {product.stock - product.reserved > 0 ? `Stock: ${product.stock - product.reserved} un.` : 'Agotado'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">{product.name}</h2>
            {formatSize(product) && <span className="text-xs font-semibold text-teal-400 mt-1 block">Tamano: {formatSize(product)}</span>}
            <p className="text-slate-300 text-sm mt-3 leading-relaxed">{product.description}</p>
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 mb-5 sm:mb-6">
            <div>
              <span className="text-xs text-slate-400 block">Precio Unitario</span>
              <span className="text-2xl font-black text-white">{formatUsd(product.price)}</span>
              {rate?.rate > 0 && <span className="block text-xs font-bold text-teal-300/90 mt-0.5">{formatBs(unitBs)}</span>}
            </div>
            {!isOut && (
              <div className="flex items-center gap-3 bg-slate-900 p-1.5 rounded-xl border border-slate-700">
                <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800">
                  <Icon name="minus" className="w-4 h-4" />
                </button>
                <span className="font-bold text-slate-100 text-sm w-6 text-center">{quantity}</span>
                <button onClick={() => setQuantity((q) => Math.min(product.stock - product.reserved, q + 1))} className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800">
                  <Icon name="plus" className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div>
            <Btn onClick={(e) => { onAddToCart(quantity, e.currentTarget.getBoundingClientRect()); setQuantity(1); }}
              disabled={isOut} variant="primary" size="xl" icon={isOut ? undefined : 'shoppingBag'}
              className={isOut ? '!bg-slate-800 !text-slate-500 !shadow-none' : 'shadow-xl shadow-teal-500/25'}>
              {isOut ? 'Sin Stock Disponible' : `Agregar al Carrito · ${formatUsd(lineTotal)}${rate?.rate > 0 ? ` (${formatBs(usdToBs(lineTotal, rate.rate))})` : ''}`}
            </Btn>
          </div>
        </div>
      </div>

      {showFullscreen && (
        <div className="fixed inset-0 z-[70] bg-slate-950/98 bg-black flex flex-col" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div className="pt-[max(0.75rem,env(safe-area-inset-top))] flex items-center justify-between px-4 py-3 shrink-0">
            <div className="flex items-center gap-2">
              {hasSameBrand && (
                <>
                  <button onClick={() => goTo(-1)} className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:text-white transition-all active:scale-90" aria-label="Producto anterior de la marca">
                    <Icon name="chevronLeft" className="w-5 h-5" />
                  </button>
                  <span className="text-xs font-bold text-teal-300 px-2">{currentIndex + 1}/{totalInBrand} · {product.brand}</span>
                  <button onClick={() => goTo(1)} className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:text-white transition-all active:scale-90" aria-label="Siguiente producto de la marca">
                    <Icon name="chevronRight" className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
            <button onClick={() => setShowFullscreen(false)} className="p-2 rounded-full bg-slate-800 text-slate-200 hover:text-white transition-all active:scale-90" aria-label="Cerrar imagen en pantalla completa">
              <Icon name="x" className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-2 pb-6 min-h-0">
            <ProductImg product={product} alt={product.name} className="max-w-full max-h-full object-contain select-none" />
          </div>
          <div className="px-4 pb-6 text-center shrink-0">
            <p className="text-sm font-bold text-white line-clamp-1">{product.name}</p>
            {product.brand && <p className="text-xs text-teal-400 mt-0.5">{product.brand}</p>}
            {hasSameBrand && <p className="text-[10px] text-slate-500 mt-1">Desliza para ver mas productos de {product.brand}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
