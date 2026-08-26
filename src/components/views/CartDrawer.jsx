import { useState, useEffect } from 'react';
import { useOverlay } from '../../hooks/overlay.js';
import useSwipeToClose from '../../hooks/useSwipeToClose.js';
import Theo from '../Theo.jsx';
import ProductImg from '../ui/ProductImg.jsx';
import Money from '../ui/Money.jsx';
import Btn from '../ui/Btn.jsx';
import { formatUsd, formatBs, usdToBs } from '../../utils/format.js';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    shoppingBag: <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    minus: <path d="M5 12h14" />,
    plus: <path d="M12 5v14M5 12h14" />,
    trash: <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

export default function CartDrawer({ isOpen, onClose, cart, cartTotal, rate, onUpdateQty, onRemove, onProceedToCheckout, holdDeadline, onShare }) {
  const [nowMs, setNowMs] = useState(Date.now());

  useOverlay(isOpen, onClose);
  const sheetRef = useSwipeToClose(onClose, isOpen, { detents: true });

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const holdLeft = holdDeadline ? Math.max(0, holdDeadline - nowMs) : 0;
  const holdMin = Math.floor(holdLeft / 60000);
  const holdSec = Math.floor((holdLeft % 60000) / 1000);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-end bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div ref={sheetRef} className="relative w-full sm:max-w-md glass-strong bg-slate-900 sm:h-full h-[92dvh] sm:border-l border-t sm:border-t-0 border-slate-800 shadow-2xl flex flex-col z-10 sm:animate-slide-left animate-screen-up">
        <div className="sm:hidden absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-slate-600/70 pointer-events-none z-20" aria-hidden="true" />
        <div className="pt-[max(1rem,env(safe-area-inset-top))] p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
              <Icon name="shoppingBag" className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Tu Carrito</h2>
              {holdLeft > 0 && (
                <p className={`text-[11px] font-bold ${holdLeft <= 60000 ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`}>
                  Reservado por {holdMin}:{String(holdSec).padStart(2, '0')}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div data-sheet-scroll className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 sm:space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 text-slate-500">
              <Theo mood="idle" className="w-36 h-32" />
              <p className="font-semibold text-slate-400">Theo cuida tu carrito... esta vacio</p>
              <p className="text-xs">Agrega algunos productos del catalogo para comenzar.</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 group hover:border-slate-600 transition-all">
                <ProductImg product={item.product} alt={item.product.name} className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover bg-slate-900 shrink-0" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-200 text-xs sm:text-sm truncate">{item.product.name}</h4>
                  <span className="text-xs text-teal-400 font-semibold block mt-1">
                    {formatUsd(item.product.price)} c/u
                    {rate?.rate > 0 && (
                      <span className="block text-[10px] text-slate-400 font-medium">
                        {formatBs(usdToBs(item.product.price, rate.rate))} c/u
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
                      <button onClick={() => onUpdateQty(item.product.id, -1)} className="p-1 rounded text-slate-400 hover:text-white">
                        <Icon name="minus" className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold w-5 text-center text-white">{item.quantity}</span>
                      <button onClick={() => onUpdateQty(item.product.id, 1)} className="p-1 rounded text-slate-400 hover:text-white">
                        <Icon name="plus" className="w-3 h-3" />
                      </button>
                    </div>
                    <button onClick={() => onRemove(item.product.id)} className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors ml-auto" title="Eliminar del carrito">
                      <Icon name="trash" className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/90 space-y-4 shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Subtotal</span>
                <span>
                  {formatUsd(cartTotal)}
                  {rate?.rate > 0 && <span className="block text-[10px] text-slate-500 text-right">{formatBs(usdToBs(cartTotal, rate.rate))}</span>}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Costo de preparacion</span>
                <span className="text-teal-400 font-semibold">GRATIS!</span>
              </div>
              <div className="flex justify-between text-base font-black text-white pt-2 border-t border-slate-800">
                <span>Total a Pagar</span>
                <span className="text-teal-400 text-right">
                  <Money value={cartTotal} />
                  {rate?.rate > 0 && <span className="block text-[11px] text-teal-300/90">{formatBs(usdToBs(cartTotal, rate.rate))}</span>}
                </span>
              </div>
            </div>
            <Btn onClick={onProceedToCheckout} variant="primary" size="xl" icon="check" className="shadow-xl shadow-teal-500/25">
              Confirmar y Elegir Forma de Pago
            </Btn>
            <Btn onClick={onShare} variant="tonal" size="md" icon="share2" className="w-full py-3">
              Compartir carrito
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}
