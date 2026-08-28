import { useMemo } from 'react';
import { useOverlay } from '../../hooks/overlay.js';
import useSwipeToClose from '../../hooks/useSwipeToClose.js';
import { normalizePhoneDigits } from '../../utils/phone.js';
import { formatUsd, formatBs, usdToBs } from '../../utils/format.js';
import ProductImg from '../ui/ProductImg.jsx';
import Btn from '../ui/Btn.jsx';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    zap: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></>,
    x: <><path d="M18 6 6 18M6 6l12 12" /></>,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="1" />}
    </svg>
  );
};

export default function MyKioskoModal({ customer, customerName, orders, products, rate, onClose, onRepeatLastOrder, headerHeight = 0 }) {
  useOverlay(true, onClose);
  const sheetRef = useSwipeToClose(onClose);
  const customerOrders = useMemo(() => {
    if (!customer?.phone) return [];
    const key = normalizePhoneDigits(customer.phone);
    const now = new Date();
    return (orders || []).filter((o) => {
      if (normalizePhoneDigits(o.phone) !== key) return false;
      const d = new Date(o.createdAt || o.timestamp);
      return !isNaN(d) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
  }, [customer, orders]);

  const stats = useMemo(() => {
    const totalOrders = customerOrders.length;
    const totalSpent = customerOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
    const activeOrders = customerOrders.filter((o) => !['entregado', 'cancelado'].includes(o.status));

    const byProduct = {};
    customerOrders.forEach((o) => {
      (o.items || []).forEach((it) => {
        byProduct[it.id] = (byProduct[it.id] || 0) + (Number(it.quantity) || 0);
      });
    });
    const topProducts = Object.entries(byProduct)
      .map(([id, qty]) => ({ product: (products || []).find((p) => p.id === id), qty }))
      .filter((t) => t.product)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 3);

    const totalItems = customerOrders.reduce((acc, o) => acc + (o.items || []).reduce((a, it) => a + (Number(it.quantity) || 0), 0), 0);

    return { totalOrders, totalSpent, activeOrders, topProducts, totalItems };
  }, [customerOrders, products]);

  const balance = Number(customer?.balance) || 0;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] overflow-hidden animate-fade-in"
      style={{ top: headerHeight }}
    >
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative h-full flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div ref={sheetRef} className="pointer-events-auto relative w-full sm:max-w-lg glass-strong bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-screen-up max-h-full flex flex-col">
        <div className="sm:hidden absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-slate-600/70 pointer-events-none z-20" aria-hidden="true" />
<div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Icon name="zap" className="w-5 h-5 text-teal-400" />
                Mi historial
              </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Hola {customerName?.split(' ')[0] || 'cliente'} · Tu resumen del mes
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div data-sheet-scroll className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Gasto del mes</span>
              <span className="block text-lg font-black text-white mt-0.5">{formatUsd(stats.totalSpent)}</span>
              {rate?.rate > 0 && <span className="text-[10px] text-slate-500">{formatBs(usdToBs(stats.totalSpent, rate.rate))}</span>}
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Pedidos del mes</span>
              <span className="block text-lg font-black text-teal-400 mt-0.5">{stats.totalOrders}</span>
              <span className="text-[10px] text-slate-500">en lo que va del mes</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Artículos del mes</span>
              <span className="block text-lg font-black text-white mt-0.5">{stats.totalItems}</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Pedidos activos</span>
              <span className="block text-lg font-black text-white mt-0.5">{stats.activeOrders.length}</span>
              <span className="text-[10px] text-slate-500">en preparación / en camino</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Saldo pendiente</span>
              <span className={`block text-lg font-black mt-0.5 ${balance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {formatUsd(balance)}
              </span>
            </div>
            {customer?.isBenefited ? (
              <span className="px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[10px] font-bold">
                ✓ Beneficiado
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-slate-700/40 text-slate-300 text-[10px] font-bold">Pago a la entrega</span>
            )}
          </div>

          <div>
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Tus favoritos del mes</span>
            {stats.topProducts.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-900/50 p-3 rounded-xl mt-1.5">
                Aún no tienes pedidos este mes. ¡Tu primer antojo aparecerá aquí!
              </p>
            ) : (
              <div className="space-y-2 mt-1.5">
                {stats.topProducts.map((t) => (
                  <div key={t.product.id} className="flex items-center gap-3 p-2 rounded-xl bg-slate-800/50 border border-slate-700/60">
                    <ProductImg product={t.product} alt={t.product.name} className="w-9 h-9 rounded-lg object-cover bg-slate-900 shrink-0" />
                    <span className="flex-1 min-w-0 text-xs font-semibold text-slate-200 truncate">{t.product.name}</span>
                    <span className="text-[11px] font-black text-teal-400">{t.qty}x</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {customerOrders.length > 0 && (
            <Btn
              onClick={() => {
                onClose();
                onRepeatLastOrder?.();
              }}
              className="w-full !py-2.5"
              icon="refresh"
              variant="primary"
              size="md"
            >
              Repetir mi último pedido
            </Btn>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
