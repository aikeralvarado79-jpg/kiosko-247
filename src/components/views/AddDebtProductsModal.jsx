import { useState } from 'react';
import { useOverlay } from '../../hooks/overlay.js';
import { normalizePhoneDigits } from '../../utils/phone.js';
import { formatUsd, formatBs, usdToBs } from '../../utils/format.js';
import ProductImg from '../ui/ProductImg.jsx';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    package: <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    check: <path d="M20 6 9 17l-5-5" />,
    minus: <path d="M5 12h14" />,
    plus: <path d="M12 5v14M5 12h14" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

export default function AddDebtProductsModal({ products, rate, customers, onClose, onConfirm, headerHeight = 0 }) {
  useOverlay(true, onClose);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [category, setCategory] = useState('Todas');
  const [search, setSearch] = useState('');
  const [qty, setQty] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const categories = ['Todas', ...new Set((products || []).map((p) => p.category).filter(Boolean))];

  const filtered = (products || []).filter((p) => {
    if (category !== 'Todas' && p.category !== category) return false;
    if (search && !`${p.name} ${p.brand || ''} ${p.code || ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selectedItems = (products || [])
    .filter((p) => Number(qty[p.id]) > 0)
    .map((p) => ({ id: p.id, name: p.name, price: p.price, quantity: Number(qty[p.id]) }));
  const total = selectedItems.reduce((acc, it) => acc + Number(it.price || 0) * it.quantity, 0);

  const changeQty = (id, delta) => {
    setQty((prev) => {
      const next = Math.max(0, (Number(prev[id]) || 0) + delta);
      return { ...prev, [id]: next };
    });
  };

  const pickCustomer = (phone) => {
    const c = (customers || []).find((x) => normalizePhoneDigits(x.phone) === normalizePhoneDigits(phone));
    setCustomerPhone(phone);
    if (c) setCustomerName(c.customerName || '');
  };

  const handleConfirm = async () => {
    const key = customerPhone.replace(/\D/g, '').slice(-11);
    if (key.length < 7) {
      setError('Ingresa el número de teléfono del deudor');
      return;
    }
    if (selectedItems.length === 0) {
      setError('Selecciona al menos un producto');
      return;
    }
    setError('');
    setSubmitting(true);
    await onConfirm({ phone: key, name: customerName, items: selectedItems });
    setSubmitting(false);
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] overflow-hidden animate-fade-in"
      style={{ top: headerHeight }}
    >
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative h-full flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
      <div className="pointer-events-auto relative w-full sm:max-w-2xl glass-strong bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-screen-up max-h-full flex flex-col">
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Icon name="package" className="w-5 h-5 text-amber-400" />
              Añadir productos a la deuda
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Selecciona el cliente y los productos que debe (ventas presenciales o deudas viejas).
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Deudor (cliente registrado)</label>
              <select
                value=""
                onChange={(e) => e.target.value && pickCustomer(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none"
              >
                <option value="">— Seleccionar deudor existente —</option>
                {(customers || []).map((c) => (
                  <option key={c.phone} value={c.phone}>
                    {c.customerName || 'Cliente'} · {c.phone} · {formatUsd(Number(c.balance) || 0)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Teléfono *</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={customerPhone}
                  onChange={(e) => pickCustomer(e.target.value)}
                  placeholder="0414 1234567"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nombre del deudor"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Filtros del catálogo */}
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto…"
              className="flex-1 min-w-[180px] px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Catálogo con cantidades */}
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No hay productos en el catálogo.</p>
            ) : (
              filtered.map((p) => {
                const n = Number(qty[p.id]) || 0;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${n > 0 ? 'bg-amber-500/10 border-amber-500/40' : 'bg-slate-950 border-slate-800'}`}
                  >
                    <ProductImg
                      product={p}
                      alt={p.name}
                      className="w-11 h-11 rounded-lg object-cover bg-slate-900 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-100 truncate">{p.name}</p>
                      <p className="text-[11px] text-teal-400 font-semibold">
                        {formatUsd(p.price)}
                        {rate?.rate > 0 && (
                          <span className="block text-[10px] text-slate-500">{formatBs(usdToBs(p.price, rate.rate))}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700 shrink-0">
                      <button
                        onClick={() => changeQty(p.id, -1)}
                        className="p-1 rounded text-slate-400 hover:text-white"
                      >
                        <Icon name="minus" className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold w-6 text-center text-white">{n}</span>
                      <button
                        onClick={() => changeQty(p.id, 1)}
                        className="p-1 rounded text-slate-400 hover:text-white"
                      >
                        <Icon name="plus" className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Pie */}
        <div className="p-4 sm:p-6 border-t border-slate-800 shrink-0">
          {error && (
            <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 mb-3">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                Total a cargar a la deuda
              </span>
              <span className="text-lg font-black text-amber-400">
                {formatUsd(total)}
                {rate?.rate > 0 && (
                  <span className="block text-[10px] text-slate-500">{formatBs(usdToBs(total, rate.rate))}</span>
                )}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-bold hover:bg-slate-700 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-amber-500 text-slate-950 text-sm font-bold hover:from-red-400 hover:to-amber-400 shadow-lg shadow-red-500/20 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5"
              >
                <Icon name="check" className="w-4 h-4" />
                {submitting ? 'Guardando…' : 'Añadir a la deuda'}
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
