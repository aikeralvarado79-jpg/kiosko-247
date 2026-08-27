import { useState, useMemo } from 'react';
import { formatUsd } from '../../utils/format.js';
import BarcodeScannerModal from './BarcodeScannerModal.jsx';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    shoppingBag: <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />,
    scan: <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />,
    cart: <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />,
    minus: <path d="M5 12h14" />,
    plus: <path d="M12 5v14M5 12h14" />,
    trash2: <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />,
    package: <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />,
    clock: <path d="M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />,
    check: <path d="M20 6 9 17l-5-5" />,
  };

  const iconPath = icons[name];
  if (!iconPath) return null;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {iconPath}
    </svg>
  );
};

export function CounterSalesPanel({ products = [], orders = [], onCounterSale, addToast }) {
  const [saleCart, setSaleCart] = useState([]); // [{ product, qty }]
  const [codeInput, setCodeInput] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [saving, setSaving] = useState(false);
  const [saleSearch, setSaleSearch] = useState('');

  const total = saleCart.reduce((acc, it) => acc + (Number(it.product.price) || 0) * it.qty, 0);
  const totalUnits = saleCart.reduce((acc, it) => acc + it.qty, 0);

  const addProduct = (product, qty = 1) => {
    const n = Math.max(1, Math.round(Number(qty) || 1));
    const available = Number(product.stock) || 0;
    setSaleCart((prev) => {
      const found = prev.find((it) => it.product.id === product.id);
      const current = found ? found.qty : 0;
      if (available < current + n) {
        addToast?.(`Stock insuficiente para "${product.name}"`, 'error');
        return prev;
      }
      if (found) {
        return prev.map((it) => (it.product.id === product.id ? { ...it, qty: it.qty + n } : it));
      }
      return [...prev, { product, qty: n }];
    });
  };

  const addByCode = (code) => {
    const p = (products || []).find((x) => String(x.code || '').trim() === String(code || '').trim());
    if (!p) {
      addToast?.(`No hay productos con el código ${code}`, 'error');
      return;
    }
    addProduct(p);
  };

  const changeQty = (id, delta) => {
    setSaleCart((prev) =>
      prev
        .map((it) => {
          if (it.product.id !== id) return it;
          const next = it.qty + delta;
          if (next < 1) return null;
          if (next > (Number(it.product.stock) || 0) && delta > 0) return it;
          return { ...it, qty: next };
        })
        .filter(Boolean)
    );
  };

  const removeItem = (id) => setSaleCart((prev) => prev.filter((it) => it.product.id !== id));

  const applyCode = () => {
    const c = codeInput.trim();
    if (!c) return;
    addByCode(c);
    setCodeInput('');
  };

  const registerSale = async () => {
    if (saleCart.length === 0) {
      addToast?.('Agregá al menos un producto para registrar la venta', 'error');
      return;
    }
    setSaving(true);
    const res = await onCounterSale({
      items: saleCart.map((it) => ({
        id: it.product.id,
        name: it.product.name,
        price: it.product.price,
        quantity: it.qty
      })),
      customerName,
      customerPhone,
      paymentMethod
    });
    setSaving(false);
    if (res && res.ok) {
      setSaleCart([]);
      setCodeInput('');
      setCustomerName('');
      setCustomerPhone('');
      setPaymentMethod('efectivo');
    }
  };

  const filteredProducts = useMemo(() => {
    const q = saleSearch.trim().toLowerCase();
    if (!q) return products || [];
    return (products || []).filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        String(p.code || '').toLowerCase().includes(q)
    );
  }, [products, saleSearch]);

  const recentCounterSales = useMemo(() => {
    return (orders || [])
      .filter((o) => o.status === 'entregado' && (o.notes || '').toLowerCase().includes('mostrador'))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 6);
  }, [orders]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-teal-500/30 bg-gradient-to-br from-teal-500/10 via-slate-900/80 to-slate-900/80 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-500/20 text-teal-300 shrink-0">
            <Icon name="shoppingBag" className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-white text-sm">Registrar venta en mostrador</h2>
            <p className="text-[11px] text-slate-400">
              Escaneá el código, escribilo o tocá el producto de la lista.
            </p>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyCode()}
            placeholder="Código de barras (ej: 7790070035394)"
            className="flex-1 min-w-0 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm placeholder-slate-500 focus:border-teal-500 focus:outline-none"
          />
          <button
            onClick={applyCode}
            disabled={!codeInput.trim()}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs hover:text-white transition-all disabled:opacity-40"
          >
            Agregar
          </button>
          <button
            onClick={() => setScannerOpen(true)}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs hover:bg-teal-400 transition-all flex items-center gap-1.5"
          >
            <Icon name="scan" className="w-4 h-4" />
            Escanear
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-3 sm:p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Icon name="cart" className="w-4 h-4 text-teal-400" />
            Venta actual · {totalUnits} un.
          </h3>
          <button
            onClick={() => setSaleCart([])}
            className="text-[11px] font-semibold text-slate-400 hover:text-rose-300 transition-colors"
          >
            Vaciar
          </button>
        </div>

        {saleCart.length === 0 ? (
          <p className="text-[11px] text-slate-500 text-center py-3">
            Sin productos todavía. Escaneá o buscá arriba.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {saleCart.map((it) => (
              <div key={it.product.id} className="flex items-center gap-2 rounded-xl bg-slate-900/60 border border-slate-700/60 p-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{it.product.name}</p>
                  <p className="text-[10px] text-slate-400">{formatUsd(it.product.price)} c/u</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => changeQty(it.product.id, -1)} className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center">
                    <Icon name="minus" className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-7 text-center text-sm font-black text-white">{it.qty}</span>
                  <button onClick={() => changeQty(it.product.id, 1)} className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center">
                    <Icon name="plus" className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="w-16 text-right text-xs font-bold text-white">{formatUsd((Number(it.product.price) || 0) * it.qty)}</span>
                <button onClick={() => removeItem(it.product.id)} className="text-slate-500 hover:text-rose-300 transition-colors">
                  <Icon name="trash2" className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-slate-700/60">
          <span className="text-xs font-semibold text-slate-400">Total</span>
          <span className="text-lg font-black text-teal-300">{formatUsd(total)}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { key: 'efectivo', label: 'Efectivo' },
            { key: 'qr', label: 'QR' },
            { key: 'tarjeta', label: 'Tarjeta' },
            { key: 'transferencia', label: 'Transferencia' }
          ].map((pm) => (
            <button
              key={pm.key}
              onClick={() => setPaymentMethod(pm.key)}
              className={`px-2 py-2 rounded-xl text-[11px] font-bold border transition-all ${
                paymentMethod === pm.key
                  ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-md'
                  : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              {pm.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Cliente (opcional)"
            className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-sm placeholder-slate-500 focus:border-teal-500 focus:outline-none"
          />
          <input
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="WhatsApp (opcional)"
            className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-sm placeholder-slate-500 focus:border-teal-500 focus:outline-none"
          />
        </div>

        <button
          onClick={registerSale}
          disabled={saving || saleCart.length === 0}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-black text-sm hover:from-teal-400 hover:to-emerald-400 shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Icon name={saving ? 'clock' : 'check'} className="w-4 h-4" />
          {saving ? 'Registrando…' : `Registrar venta · ${formatUsd(total)}`}
        </button>
      </div>

      <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3 sm:p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Icon name="package" className="w-4 h-4 text-teal-400" />
            Productos (tocá para agregar)
          </h3>
          <input
            type="text"
            value={saleSearch}
            onChange={(e) => setSaleSearch(e.target.value)}
            placeholder="Buscar…"
            className="w-36 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-80 overflow-y-auto pr-1">
          {filteredProducts.map((p) => (
            <button
              key={p.id}
              onClick={() => addProduct(p)}
              className="flex items-center gap-2 rounded-xl bg-slate-900/60 border border-slate-700/60 p-2 text-left hover:border-teal-500/50 transition-all"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{p.name}</p>
                <p className="text-[10px] text-slate-400">
                  {formatUsd(p.price)} · {p.stock} un.
                </p>
              </div>
              <span className="shrink-0 w-7 h-7 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-300 flex items-center justify-center">
                <Icon name="plus" className="w-3.5 h-3.5" />
              </span>
            </button>
          ))}
          {filteredProducts.length === 0 && (
            <p className="col-span-full text-[11px] text-slate-500 text-center py-3">
              No hay productos que coincidan.
            </p>
          )}
        </div>
      </div>

      {recentCounterSales.length > 0 && (
        <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3 sm:p-4 space-y-1.5">
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Icon name="clock" className="w-4 h-4 text-teal-400" />
            Últimas ventas de mostrador
          </h3>
          {recentCounterSales.map((o) => (
            <div key={o.id} className="flex items-center gap-2 rounded-xl bg-slate-900/60 border border-slate-700/60 p-2">
              <span className="font-mono text-[10px] font-bold text-teal-400 w-16 shrink-0">{o.id}</span>
              <span className="flex-1 min-w-0 text-xs text-slate-300 truncate">{o.customerName}</span>
              <span className="text-[10px] text-slate-500 shrink-0">
                {new Date(o.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-xs font-bold text-white shrink-0">{formatUsd(o.total)}</span>
            </div>
          ))}
        </div>
      )}

      {scannerOpen && (
        <BarcodeScannerModal
          onScan={(code) => {
            setScannerOpen(false);
            addByCode(code);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}
