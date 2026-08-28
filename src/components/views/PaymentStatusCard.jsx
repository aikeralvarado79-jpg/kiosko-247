import { useState, useRef } from 'react';
import { api } from '../../api.js';
import { compressImage } from '../../utils/image.js';
import { formatUsd } from '../../utils/format.js';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    wallet: <><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></>,
    check: <><path d="M20 6 9 17l-5-5" /></>,
    alertTriangle: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
    creditCard: <><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="1" />}
    </svg>
  );
};

export default function PaymentStatusCard({ order, isBenefited, onOrderUpdated, addToast }) {
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState(false);
  const fileRef = useRef(null);

  const applyUpdated = (res) => {
    if (res.ok && res.data?.state?.orders) {
      const updated = res.data.state.orders.find((o) => o.id === order.id);
      if (updated) onOrderUpdated?.(updated);
    }
  };

  const handlePick = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      addToast('La imagen supera 8 MB. Elige una más liviana.', 'error');
      return;
    }
    setUploading(true);
    try {
      const proof = await compressImage(file);
      const res = await api.attachPaymentProof(order.id, order.phone, proof, order.paymentReference || '');
      if (res.ok) {
        applyUpdated(res);
        addToast('Comprobante enviado. Tu pago está en revisión.', 'success');
      } else {
        addToast(res.data?.error || 'No se pudo adjuntar el comprobante', 'error');
      }
    } catch {
      addToast('No se pudo procesar la imagen. Prueba con otra.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleToAccount = async () => {
    if (converting) return;
    setConverting(true);
    try {
      const res = await api.convertOrderToCredit(order.id, order.phone);
      if (res.ok) {
        applyUpdated(res);
        addToast('Pedido enviado a tu cuenta.', 'success');
      } else {
        addToast(res.data?.error || 'No se pudo pasar el pedido a cuenta', 'error');
      }
    } finally {
      setConverting(false);
    }
  };

  if (!order.paymentMethod || order.paymentMethod === 'efectivo') return null;

  const status = order.paymentStatus || 'pendiente';

  if (order.paymentMethod === 'cartera' || Number(order.walletApplied || 0) > 0) {
    return (
      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/40 p-3 flex items-center gap-2.5">
        <Icon name="wallet" className="w-5 h-5 text-emerald-400 shrink-0" />
        <div>
          <p className="text-sm font-bold text-emerald-300">Pagado con Mi Cartera</p>
          <p className="text-[11px] text-emerald-200/70">
            Se usó {formatUsd(Number(order.walletApplied || 0) || Number(order.total) || 0)} de tu saldo a favor. ¡Gracias!
          </p>
        </div>
      </div>
    );
  }

  if (status === 'confirmado') {
    return (
      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/40 p-3 flex items-center gap-2.5">
        <Icon name="check" className="w-5 h-5 text-emerald-400 shrink-0" />
        <div>
          <p className="text-sm font-bold text-emerald-300">Pago confirmado</p>
          <p className="text-[11px] text-emerald-200/70">¡Gracias! Tu pago fue aceptado.</p>
        </div>
      </div>
    );
  }

  if (status === 'rechazado') {
    return (
      <div className="rounded-xl bg-rose-500/10 border border-rose-500/40 p-3 space-y-3">
        <div className="flex items-center gap-2.5">
          <Icon name="alertTriangle" className="w-5 h-5 text-rose-400 shrink-0" />
          <div>
            <p className="text-sm font-bold text-rose-300">Tu pago fue rechazado</p>
            <p className="text-[11px] text-rose-200/70">
              {isBenefited
                ? 'Puedes subir otro comprobante o pasar el pedido a tu cuenta.'
                : 'Sube otro comprobante para que lo revisemos de nuevo.'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="py-2.5 px-3 rounded-xl bg-teal-500/15 border border-teal-500/40 text-teal-300 text-xs font-bold hover:bg-teal-500/25 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            <Icon name="upload" className="w-4 h-4" />
            {uploading ? 'Subiendo…' : 'Subir otro comprobante'}
          </button>
          {isBenefited && (
            <button
              onClick={handleToAccount}
              disabled={converting}
              className="py-2.5 px-3 rounded-xl bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 text-xs font-bold hover:bg-indigo-500/25 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              <Icon name="creditCard" className="w-4 h-4" />
              {converting ? 'Enviando…' : 'Añadir a mi cuenta'}
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePick} />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-amber-500/10 border border-amber-500/40 p-3 flex items-center gap-2.5">
      <Icon name="clock" className="w-5 h-5 text-amber-400 shrink-0" />
      <div>
        <p className="text-sm font-bold text-amber-300">Pago en revisión</p>
        <p className="text-[11px] text-amber-200/70">Estamos verificando tu comprobante.</p>
      </div>
    </div>
  );
}
