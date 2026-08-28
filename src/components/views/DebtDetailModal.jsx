import { useState } from 'react';
import { useOverlay } from '../../hooks/overlay.js';
import { normalizePhoneDigits, formatPhoneWhatsApp } from '../../utils/phone.js';
import { formatUsd, formatBs, usdToBs } from '../../utils/format.js';
import { buildAccountMessage, futureCollectionDue, ConfirmActionModal } from '../../App.jsx';
import CollectionScheduler from './CollectionScheduler.jsx';

const Icon = ({ name, className = "w-5 h-5", ...props }) => {
  const icons = {
    alertTriangle: <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3zM12 9v4M12 17h.01" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    whatsapp: <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />,
    clock: <path d="M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />,
    wallet: <path d="M21 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2M21 12h-5a2 2 0 0 0 0 4h5a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1z" />,
    check: <path d="M20 6 9 17l-5-5" />,
  };
  const icon = icons[name];
  if (!icon) return null;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icon}
    </svg>
  );
};

// Desglosa los pedidos de un deudor y ofrece enviar la cuenta por WhatsApp
// o programar el cobro (cuenta + fecha) para envío automático.
export default function DebtDetailModal({
  customer,
  orders,
  rate,
  onClose,
  onClearDebt,
  collections,
  onUpsertCollection,
  onDeleteCollection,
  payments,
  headerHeight = 0
}) {
  useOverlay(true, onClose);
  const [showScheduler, setShowScheduler] = useState(false);
  const [confirmSaldar, setConfirmSaldar] = useState(false);

  const key = normalizePhoneDigits(customer.phone);
  // Pedidos del cliente que han sido entregados y a crédito = deuda contraída.
  const debtOrders = (orders || [])
    .filter((o) => normalizePhoneDigits(o.phone) === key && o.credit && o.status === 'entregado')
    .sort((a, b) => new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp));
  const debtTotal = debtOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);

  // Historial de pagos/abonos de este cliente (de admin PaymentsAdminView o lista global)
  // Se obtiene de los pagos aprobados/rechazados que coincidan con el teléfono.
  // Nota: los pagos no vienen en el estado público; se cargan aparte si se necesita.
  // Aquí usamos los pagos que vienen de props si existen (ver BlacklistAdminView).
  const clientPayments = (payments || []).filter((p) => normalizePhoneDigits(p.phone) === key);
  // Separa: depósitos a cartera (pagos aprobados cuando el cliente ya tenía saldo a favor
  // o el monto supera la deuda pendiente) vs abonos a deuda.
  // Heurística simple: pagos aprobados con amountUsd > 0. El tipo real se ve en el detalle.
  const approvedPayments = clientPayments.filter((p) => p.status === 'aprobado');
  const pendingPayments = clientPayments.filter((p) => p.status === 'pendiente');
  const rejectedPayments = clientPayments.filter((p) => p.status === 'rechazado');

  // Estado de cuenta cronológico: combina deudas (pedidos a crédito entregados,
  // +monto) y abonos aprobados (-monto) en una sola línea de tiempo ordenada por
  // fecha, con el saldo acumulado de cada movimiento. Los movimientos sin fecha
  // (deuda manual sin createdAt) se consideran los más antiguos.
  const movements = [
    ...debtOrders.map((o) => ({
      id: `ORD-${o.id}`,
      kind: 'deuda',
      date: new Date(o.createdAt || o.timestamp || 0),
      label: `Pedido ${o.id}`,
      detail: Array.isArray(o.items) ? o.items.map((it) => `${it.quantity}x ${it.name}`).join(', ') : '',
      amount: Number(o.total) || 0
    })),
    ...approvedPayments.map((p) => ({
      id: `PAG-${p.id}`,
      kind: 'abono',
      date: new Date(p.decidedAt || p.createdAt || 0),
      label: `Abono ${p.id}`,
      detail: p.reference ? `Ref: ${p.reference}` : `Bs ${formatBs(Number(p.amountBs))}`,
      amount: -(Number(p.amountUsd) || 0)
    }))
  ].sort((a, b) => a.date - b.date || a.label.localeCompare(b.label));
  let runningBalance = 0;
  const timeline = movements.map((m) => {
    runningBalance += m.amount;
    return { ...m, balance: runningBalance };
  });

  const wa = formatPhoneWhatsApp(customer.phone);

  const accountMsg = buildAccountMessage(customer, orders);
  const waLink = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(accountMsg)}` : undefined;

  const upcoming = collections
    .filter((c) => normalizePhoneDigits(c.phone) === key && (c.status === 'programado' || c.status === 'pendiente'))
    .sort((a, b) => new Date(a.dueAt || 0) - new Date(b.dueAt || 0));

  const overdue = futureCollectionDue(upcoming);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] overflow-hidden animate-fade-in"
      style={{ top: headerHeight }}
    >
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative h-full flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
      <div className="pointer-events-auto relative w-full sm:max-w-lg glass-strong bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-screen-up max-h-full flex flex-col">
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Icon name="alertTriangle" className="w-5 h-5 text-amber-400" />
              {customer.customerName || 'Cliente'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{customer.phone} · Deuda total {formatUsd(Number(customer.balance) || 0)}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Acciones principales */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={waLink ? undefined : (e) => e.preventDefault()}
              className="py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1.5 text-center"
            >
              <Icon name="whatsapp" className="w-4 h-4" />
              Enviar cuenta a WhatsApp
            </a>
            <button
              onClick={() => setShowScheduler((v) => !v)}
              className="py-3 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-bold hover:bg-cyan-500/25 transition-all flex items-center justify-center gap-1.5"
            >
              <Icon name="clock" className="w-4 h-4" />
              {showScheduler ? 'Cerrar cobro' : 'Programar cobro'}
            </button>
          </div>

          {/* Programador de cobro */}
          {showScheduler && (
            <CollectionScheduler
              customer={customer}
              orders={orders}
              collections={upcoming}
              onUpsertCollection={onUpsertCollection}
              onDeleteCollection={onDeleteCollection}
            />
          )}

          {/* Desglose de deuda */}
          <div className="space-y-2">
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider flex items-center justify-between">
              <span>Desglose de la deuda ({debtOrders.length} pedidos)</span>
              <span className="text-red-400 font-black text-sm">{formatUsd(debtTotal)}</span>
            </span>
            {debtOrders.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-900/50 p-3 rounded-xl">
                Este deudor no tiene pedidos a crédito entregados registrados en el historial; la deuda se cargó manualmente.
              </p>
            ) : (
              debtOrders.map((o) => (
                <div key={o.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-cyan-400">{o.id}</span>
                    <span className="text-slate-500">{new Date(o.createdAt || o.timestamp).toLocaleDateString('es-VE')}</span>
                  </div>
                  {Array.isArray(o.items) ? o.items.map((it, i) => (
                    <div key={i} className="flex justify-between text-xs text-slate-300">
                      <span>{it.quantity}x {it.name}</span>
                      <span className="font-bold text-white">
                        {formatUsd(it.price * it.quantity)}
                        {rate?.rate > 0 && (
                          <span className="block text-[10px] text-slate-500 text-right">
                            {formatBs(usdToBs(it.price * it.quantity, rate.rate))}
                          </span>
                        )}
                      </span>
                    </div>
                  )) : null}
                  {o.notes && o.notes !== 'Deuda registrada manualmente' && (
                    <p className="text-[10px] text-slate-500 italic truncate">{o.notes}</p>
                  )}
                  <div className="pt-1.5 border-t border-slate-800 flex justify-between font-bold text-xs">
                    <span className="text-slate-400">Total</span>
                    <span className="text-amber-400 text-right">
                      {formatUsd(o.total)}
                      {rate?.rate > 0 && (
                        <span className="block text-[10px] text-slate-500">{formatBs(usdToBs(o.total, rate.rate))}</span>
                      )}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Estado de cuenta cronológico (deudas y abonos mezclados) */}
          {timeline.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                Estado de cuenta ({timeline.length} movimientos)
              </span>
              <div className="space-y-0">
                {timeline.map((m, idx) => (
                  <div key={m.id} className="relative flex gap-3 pb-3">
                    {idx < timeline.length - 1 && (
                      <span className="absolute left-[7px] top-4 bottom-0 w-px bg-slate-700/60" />
                    )}
                    <div className="flex flex-col items-center shrink-0">
                      <span
                        className={`w-[15px] h-[15px] rounded-full border-2 flex items-center justify-center ${
                          m.kind === 'deuda'
                            ? 'bg-red-500/20 border-red-500/60'
                            : 'bg-emerald-500/20 border-emerald-500/60'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${m.kind === 'deuda' ? 'bg-red-400' : 'bg-emerald-400'}`} />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 bg-slate-900/70 border border-slate-800 rounded-xl px-3 py-2">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className={`font-mono font-bold ${m.kind === 'deuda' ? 'text-red-400' : 'text-emerald-300'}`}>
                          {m.kind === 'deuda' ? '+' : '−'}{formatUsd(Math.abs(m.amount))}
                        </span>
                        <span className="text-slate-500">
                          {m.date.getTime() ? m.date.toLocaleDateString('es-VE') : 'Sin fecha'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-200 mt-0.5">{m.label}</p>
                      {m.detail && <p className="text-[10px] text-slate-500 truncate">{m.detail}</p>}
                      <p className={`text-[10px] font-bold mt-1 ${m.balance > 0 ? 'text-red-300' : m.balance < 0 ? 'text-emerald-300' : 'text-slate-400'}`}>
                        Saldo: {formatUsd(m.balance)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historial de pagos y depósitos de este cliente (agrupado) */}
          {(approvedPayments.length > 0 || pendingPayments.length > 0 || rejectedPayments.length > 0) && (
            <div className="border-t border-slate-800 pt-4 space-y-4">
              <div className="flex items-center gap-2">
                <Icon name="wallet" className="w-4 h-4 text-teal-400" />
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Historial de pagos ({clientPayments.length})
                </span>
              </div>
              <div className="grid gap-3">
                {approvedPayments.length > 0 && (
                  <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-emerald-300 font-bold flex items-center gap-1">
                        <Icon name="check" className="w-3.5 h-3.5" />
                        Abonos aprobados ({approvedPayments.length})
                      </span>
                      <span className="text-emerald-300 font-black">
                        {formatUsd(approvedPayments.reduce((s, p) => s + Number(p.amountUsd || 0), 0))}
                      </span>
                    </div>
                    {approvedPayments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-[11px] py-1">
                        <span className="text-slate-300">{new Date(p.createdAt).toLocaleDateString('es-VE')}</span>
                        <span className="font-bold text-teal-300">
                          {formatUsd(p.amountUsd)} ({formatBs(Number(p.amountBs))})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {pendingPayments.length > 0 && (
                  <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-amber-300 font-bold flex items-center gap-1">
                        <Icon name="clock" className="w-3.5 h-3.5" />
                        Por verificar ({pendingPayments.length})
                      </span>
                      <span className="text-amber-300 font-black">
                        {formatUsd(pendingPayments.reduce((s, p) => s + Number(p.amountUsd || 0), 0))}
                      </span>
                    </div>
                    {pendingPayments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-[11px] py-1">
                        <span className="text-slate-400">{new Date(p.createdAt).toLocaleDateString('es-VE')}</span>
                        <span className="font-bold text-amber-300">
                          {formatUsd(p.amountUsd)} ({formatBs(Number(p.amountBs))})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {rejectedPayments.length > 0 && (
                  <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-rose-300 font-bold flex items-center gap-1">
                        <Icon name="x" className="w-3.5 h-3.5" />
                        Rechazados ({rejectedPayments.length})
                      </span>
                    </div>
                    {rejectedPayments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-[11px] py-1">
                        <span className="text-slate-500">{new Date(p.createdAt).toLocaleDateString('es-VE')}</span>
                        <span className="font-bold text-rose-300">
                          {formatUsd(p.amountUsd)} ({formatBs(Number(p.amountBs))})
                          {p.note && <span className="block text-[10px] text-slate-500">Nota: {p.note}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="p-4 sm:p-6 border-t border-slate-800 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              {overdue > 0 ? `${overdue} cobro(s) vencido(s)` : 'Sin cobros programados pendientes'}
            </span>
            <button
              onClick={() => setConfirmSaldar(true)}
              className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition-all"
            >
              Saldar deuda
            </button>
          </div>
        </div>
      </div>
      </div>

      {confirmSaldar && (
        <ConfirmActionModal
          title={`¿Saldar deuda de ${customer.customerName || customer.phone}?`}
          message={`${customer.customerName || 'Cliente'} debe ${formatUsd(Number(customer.balance) || 0)}. Al saldar, el saldo queda en cero.`}
          note="Esta acción no se puede deshacer."
          confirmLabel="Saldar"
          icon="checkCircle"
          tone="danger"
          onConfirm={() => {
            setConfirmSaldar(false);
            onClearDebt(customer);
            onClose();
          }}
          onClose={() => setConfirmSaldar(false)}
        />
      )}
    </div>
  );
}
