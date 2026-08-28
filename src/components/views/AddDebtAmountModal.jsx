import { useState } from 'react';
import { useOverlay } from '../../hooks/overlay.js';
import { normalizePhoneDigits } from '../../utils/phone.js';
import { formatUsd, formatBs, usdToBs, parseAmount, formatAmountBsInput } from '../../utils/format.js';

const Icon = ({ name, className = "w-5 h-5", ...props }) => {
  const icons = {
    wallet: <path d="M21 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2M21 12h-5a2 2 0 0 0 0 4h5a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1z" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    check: <path d="M20 6 9 17l-5-5" />,
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

export default function AddDebtAmountModal({ customers, rate, onClose, onConfirm, headerHeight = 0 }) {
  useOverlay(true, onClose);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAmount, setCustomerAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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
    const monto = parseAmount(customerAmount);
    if (!monto || monto <= 0) {
      setError('Ingresa un monto de deuda válido');
      return;
    }
    setError('');
    setSubmitting(true);
    await onConfirm({
      phone: key,
      name: customerName,
      items: [{ name: description ? `Deuda manual · ${description}` : 'Deuda manual', price: monto, quantity: 1 }],
      description
    });
    setSubmitting(false);
  };

  const totalBs = usdToBs(parseAmount(customerAmount) || 0, rate?.rate || 0);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] overflow-hidden animate-fade-in"
      style={{ top: headerHeight }}
    >
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative h-full flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
      <div className="pointer-events-auto relative w-full sm:max-w-md glass-strong bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-screen-up max-h-full flex flex-col">
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Icon name="wallet" className="w-5 h-5 text-amber-400" />
              Registrar monto de la deuda
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Carga una deuda directa en dólares con su motivo.
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
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

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Deuda (USD) *</label>
            <input
              type="text"
              inputMode="decimal"
              value={customerAmount}
              onChange={(e) => setCustomerAmount(formatAmountBsInput(e.target.value))}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none"
            />
            {rate?.rate > 0 && totalBs > 0 && (
              <span className="block text-[11px] text-slate-500 mt-1">
                ≈ {formatBs(totalBs)}
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Descripción del motivo</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej.: Compra a crédito no registrada, préstamo, saldo de la semana…"
              rows={2}
              maxLength={300}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none resize-none"
            />
            <span className="block text-[10px] text-slate-600 text-right">{description.length}/300</span>
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
                Total a cargar
              </span>
              <span className="text-lg font-black text-amber-400">
                {formatUsd(parseAmount(customerAmount) || 0)}
                {rate?.rate > 0 && (
                  <span className="block text-[10px] text-slate-500">{formatBs(totalBs)}</span>
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
                {submitting ? 'Guardando…' : 'Registrar deuda'}
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
