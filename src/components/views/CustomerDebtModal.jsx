import { useState, useEffect, useMemo } from 'react';
import { useOverlay } from '../../hooks/overlay.js';
import useSwipeToClose from '../../hooks/useSwipeToClose.js';
import { normalizePhoneDigits } from '../../utils/phone.js';
import { formatUsd, formatBs, parseAmount, formatAmountBsInput, usdToBs } from '../../utils/format.js';
import { api } from '../../api.js';
import { withInflightGuard } from '../../utils/haptics.js';
import { compressImage } from '../../utils/image.js';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    wallet: <path d="M21 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2M21 12h-5a2 2 0 0 0 0 4h5a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1z" />,
    creditCard: <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM2 10h20M6 15h4" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    check: <path d="M20 6 9 17l-5-5" />,
    alertTriangle: <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3zM12 9v4M12 17h.01" />,
    upload: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />,
    refresh: <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || null}
    </svg>
  );
};

// Modal que el cliente ve en "Mi Cuenta": desglose de su deuda con conversión
// a bolívares según la tasa del día.
export default function CustomerDebtModal({ customer, orders, rate, onClose, addToast, mode = 'deuda', headerHeight = 0 }) {
  useOverlay(true, onClose);
  // Swipe hacia abajo para cerrar (solo móvil / bottom sheet).
  const sheetRef = useSwipeToClose(onClose);
  const key = normalizePhoneDigits(customer.phone);
  const debtOrders = (orders || [])
    .filter((o) => normalizePhoneDigits(o.phone) === key && o.credit && o.status === 'entregado')
    .sort((a, b) => new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp));
  // El balance del cliente es la fuente autoritativa (lo actualiza el servidor al
  // pasar un pedido a entregado o al saldar la deuda). balance < 0 = saldo a favor.
  const balance = Number(customer.balance) || 0;
  const hasWallet = balance < 0;
  // Solo hay saldo "disponible" cuando el cliente tiene saldo a favor (balance < 0).
  const walletAmount = hasWallet ? Math.abs(balance) : 0;
  const debtTotal = hasWallet ? 0 : balance;
  // 'saldo' = solo muestra el saldo disponible y el historial de abonos/descuentos.
  // 'deuda' = muestra el desglose de la deuda y permite abonar.
  const isSaldoView = mode === 'saldo';

  // Formulario de abono: monto en Bs + referencia + comprobante. El servidor lo
  // convierte a USD con la tasa del día y queda pendiente de aprobación.
  const [showAbono, setShowAbono] = useState(false);
  const [amountBs, setAmountBs] = useState('');
  const [reference, setReference] = useState('');
  const [proof, setProof] = useState(null);
  const [sending, setSending] = useState(false);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    let active = true;
    api
      .listPayments(key)
      .then((res) => {
        if (active && res.ok && Array.isArray(res.data)) setPayments(res.data);
      });
    return () => {
      active = false;
    };
  }, [key]);

  // Estado de cuenta (extracto mensual): un pedido a crédito deja saldo negativo
  // (deuda, rojo) y un abono aprobado deja saldo positivo (a favor, verde). El
  // saldo inicial del mes es el punto de partida del desglose.
  const approvedPayments = (payments || []).filter((p) => p.status === 'aprobado');
  const nowD = new Date();
  const monthStart = new Date(nowD.getFullYear(), nowD.getMonth(), 1);
  const rawMovements = [
    ...debtOrders.map((o) => ({
      id: `ORD-${o.id}`,
      kind: 'deuda',
      date: new Date(o.createdAt || o.timestamp || 0),
      label: `Pedido ${o.id}`,
      detail: Array.isArray(o.items) ? o.items.map((it) => `${it.quantity}x ${it.name}`).join(', ') : '',
      amount: -(Number(o.total) || 0)
    })),
    ...approvedPayments.map((p) => ({
      id: `PAG-${p.id}`,
      kind: 'abono',
      date: new Date(p.decidedAt || p.createdAt || 0),
      label: `Abono ${p.id}`,
      detail: p.reference ? `Ref: ${p.reference}` : `Bs ${formatBs(Number(p.amountBs))}`,
      amount: Number(p.amountUsd) || 0
    }))
  ];
  // Saldo actual en convención de extracto: deuda = negativo, saldo a favor = positivo.
  const currentSaldo = -balance;
  const monthMovements = rawMovements
    .filter((m) => m.date >= monthStart)
    .sort((a, b) => a.date - b.date || a.label.localeCompare(b.label));
  const sumMonth = monthMovements.reduce((acc, m) => acc + m.amount, 0);
  const saldoInicialMes = currentSaldo - sumMonth;
  let customerRunning = saldoInicialMes;
  const customerTimeline = monthMovements.map((m) => {
    customerRunning += m.amount;
    return { ...m, balance: customerRunning };
  });
  const monthName = monthStart.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });

  // Fiado Digital: el admin parametriza un tope por cliente beneficiado. Si no
  // lo definió (creditLimit null/0) el cliente fiado NO tiene límite.
  const fiadoTope = useMemo(() => {
    const adminLimit = Number(customer?.creditLimit);
    return Number.isFinite(adminLimit) && adminLimit > 0 ? adminLimit : null;
  }, [customer?.creditLimit]);
  const fiadoUso = fiadoTope ? Math.min(100, (Math.abs(balance) / fiadoTope) * 100) : 0;

  // Abono rápido 1-toque: rellena el monto en Bs (según el % del total a pagar).
  const quickAbono = (pct) => {
    if (!(rate?.rate > 0) || !(balance > 0)) return;
    const montoUsd = (balance * pct) / 100;
    const montoBs = montoUsd * Number(rate.rate);
    setAmountBs(formatAmountBsInput(montoBs.toFixed(2).replace('.', ',')));
    setShowAbono(true);
    addToast(`Monto listo: abonar ${pct}% (${formatUsd(montoUsd)})`, 'success');
  };

  const handleAbono = async (e) => {
    e.preventDefault();
    if (sending) return;
    const monto = parseAmount(amountBs);
    if (!(monto > 0)) {
      addToast('Indica cuánto abonaste en bolívares', 'error');
      return;
    }
    if (!proof) {
      addToast('Adjunta el comprobante del abono', 'error');
      return;
    }
    // Garantía anti-doble-envío de pagos: un solo submit concurrente por
    // cliente aunque el estado tarde en refrescarse.
    return withInflightGuard(`pago:${key}`, async () => {
    setSending(true);
    try {
      const res = await api.createPayment({
        phone: key,
        customerName: customer.customerName || 'Cliente',
        amountBs: monto,
        reference,
        proof
      });
      if (!res.ok) {
        addToast(res.data?.error || 'No se pudo enviar el abono', 'error');
        return;
      }
      addToast('Abono enviado. El kiosko lo verificará y lo aplicará a tu cuenta.', 'success');
      setAmountBs('');
      setReference('');
      setProof(null);
      setShowAbono(false);
      const list = await api.listPayments(key);
      if (list.ok && Array.isArray(list.data)) setPayments(list.data);
    } catch {
      addToast('No se pudo enviar el abono. Intenta de nuevo.', 'error');
    } finally {
      setSending(false);
    }
    });
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] overflow-hidden animate-fade-in"
      style={{ top: headerHeight }}
    >
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative h-full flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div ref={sheetRef} className="pointer-events-auto relative w-full sm:max-w-lg glass-strong bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-screen-up max-h-full flex flex-col">
        {/* Asa de arrastre (móvil): la hoja se cierra deslizando hacia abajo */}
        <div className="sm:hidden absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-slate-600/70 pointer-events-none z-20" aria-hidden="true" />
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Icon name={isSaldoView ? 'wallet' : 'creditCard'} className={`w-5 h-5 ${isSaldoView ? 'text-emerald-400' : 'text-indigo-400'}`} />
              {isSaldoView ? 'Mi saldo' : hasWallet ? 'Mi Cartera' : 'Mi deuda'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {customer.customerName || customer.phone} ·{' '}
              {isSaldoView ? (
                walletAmount > 0 ? (
                  <span className="text-emerald-400 font-bold">Saldo disponible {formatUsd(walletAmount)}</span>
                ) : balance > 0 ? (
                  <span className="text-rose-400 font-bold">Saldo pendiente por pagar {formatUsd(balance)}</span>
                ) : (
                  <span className="text-slate-400 font-bold">Sin saldo a favor</span>
                )
              ) : hasWallet ? (
                <span className="text-emerald-400 font-bold">Saldo a favor {formatUsd(walletAmount)}</span>
              ) : (
                <>Total {formatUsd(debtTotal)}</>
              )}
              {rate?.rate > 0 && (
                <span className="block text-[10px] text-slate-500">
                  {formatBs(usdToBs(isSaldoView ? (walletAmount > 0 ? walletAmount : balance) : hasWallet ? walletAmount : debtTotal, rate.rate))} a Bs {Number(rate.rate).toFixed(2)}
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div data-sheet-scroll className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          {isSaldoView ? (
            <div className="space-y-3">
              {walletAmount > 0 ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                  <span className="text-[11px] uppercase tracking-wider text-emerald-400/80 font-semibold">Disponible para usar</span>
                  <div className="flex items-end justify-between mt-1">
                    <span className="font-display text-3xl font-black tracking-tight text-emerald-400">{formatUsd(walletAmount)}</span>
                    {rate?.rate > 0 && (
                      <span className="text-[10px] text-emerald-400/70">{formatBs(usdToBs(walletAmount, rate.rate))}</span>
                    )}
                  </div>
                  <p className="text-xs text-emerald-200/80 mt-2 flex items-start gap-1.5">
                    <Icon name="check" className="w-4 h-4 mt-0.5 shrink-0" />
                    Al pagar tu próximo pedido elige <b>Mi Cartera</b> como método de pago para usarlo.
                  </p>
                </div>
              ) : balance > 0 ? (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/40 text-rose-300">
                  <span className="text-[11px] uppercase tracking-wider text-rose-400/80 font-semibold">Saldo pendiente por pagar</span>
                  <div className="flex items-end justify-between mt-1">
                    <span className="font-display text-3xl font-black tracking-tight text-rose-400">{formatUsd(balance)}</span>
                    {rate?.rate > 0 && (
                      <span className="text-[10px] text-rose-400/70">{formatBs(usdToBs(balance, rate.rate))}</span>
                    )}
                  </div>
                  <p className="text-xs text-rose-200/80 mt-2 flex items-start gap-1.5">
                    <Icon name="alertTriangle" className="w-4 h-4 mt-0.5 shrink-0" />
                    Tienes pedidos a cuenta por pagar. Puedes abonar desde <b>Mi deuda</b> para descontar este saldo.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-700">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Saldo disponible</span>
                  <div className="font-display text-3xl font-black tracking-tight text-slate-500 mt-1">{formatUsd(0)}</div>
                  <p className="text-xs text-slate-400 mt-2">
                    Sin saldo a favor por el momento.
                  </p>
                </div>
              )}
              {/* Formulario de depósito a cartera */}
              {showAbono && (
                <form onSubmit={handleAbono} className="space-y-2.5 rounded-2xl bg-slate-950 border border-slate-700 p-4 animate-fade-in">
                  <span className="text-xs text-slate-300 font-bold flex items-center gap-1.5">
                    <Icon name="wallet" className="w-4 h-4 text-teal-400" />
                    Depositar en mi cartera
                  </span>
                  {rate?.rate > 0 && (
                    <p className="text-[10px] text-slate-500">
                      Tasa del día: Bs {Number(rate.rate).toFixed(2)} ·{' '}
                      {amountBs && Number(parseAmount(amountBs)) > 0
                        ? <>equivale a <b className="text-teal-300">{formatUsd(parseAmount(amountBs) / rate.rate)}</b></>
                        : 'se convierte sola al enviar'}
                    </p>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Monto a depositar en bolívares *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amountBs}
                      onChange={(e) => setAmountBs(formatAmountBsInput(e.target.value))}
                      placeholder="Ej: 1.500,00"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Número de referencia / comprobante</label>
                    <input
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Ej: 12H3456789"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Foto del comprobante *</label>
                    <label className="w-full flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/60 cursor-pointer hover:border-teal-500/50 transition-all text-center">
                      {proof ? (
                        <>
                          <img src={proof} alt="Comprobante del abono" className="max-h-32 rounded-lg object-contain" />
                          <span className="text-[11px] text-teal-300 font-semibold flex items-center gap-1">
                            <Icon name="check" className="w-3.5 h-3.5" />
                            Adjunto — toca para cambiarlo
                          </span>
                        </>
                      ) : (
                        <>
                          <Icon name="upload" className="w-6 h-6 text-slate-500" />
                          <span className="text-xs text-slate-400">Toca para tomar una foto o subir el comprobante</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files && e.target.files[0];
                          if (!file) return;
                          if (file.size > 8 * 1024 * 1024) {
                            addToast('La imagen supera 8 MB. Elige una más liviana.', 'error');
                            e.target.value = '';
                            return;
                          }
                          try {
                            const compressed = await compressImage(file);
                            setProof(compressed);
                          } catch {
                            addToast('No se pudo procesar la imagen. Prueba con otra.', 'error');
                          } finally {
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAbono(false)}
                      className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={sending}
                      className="py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-1.5"
                    >
                      {sending ? (
                        <>
                          <Icon name="refresh" className="w-4 h-4 animate-spin" /> Procesando…
                        </>
                      ) : (
                        <>
                          <Icon name="check" className="w-4 h-4" /> Enviar depósito
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : hasWallet ? (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300 flex items-start gap-2">
              <Icon name="check" className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Tienes <b>{formatUsd(walletAmount)}</b> a tu favor. Al pagar tu próximo pedido,
                elige <b>Mi Cartera</b> como método de pago para usarlo.
              </span>
            </div>
          ) : null}

          {!isSaldoView && !hasWallet && (
            <div className="space-y-2">
              {/* Billetera Fiado Digital: tope de crédito + abonos rápidos 1-toque */}
              {balance > 0 && (
                <div className="rounded-2xl bg-gradient-to-br from-indigo-500/15 via-slate-900 to-teal-500/10 border border-indigo-500/30 p-4 animate-fade-in">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                      <Icon name="wallet" className="w-4 h-4" /> Billetera Fiado
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {fiadoTope ? (
                        <>Tope <b className="text-teal-400">{formatUsd(fiadoTope)}</b></>
                      ) : (
                        <><b className="text-teal-400">Sin tope</b> · sin límite</>
                      )}
                    </span>
                  </div>
                  {fiadoTope ? (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-300">Uso del fiado</span>
                        <span className={`font-black ${fiadoUso >= 85 ? 'text-rose-400' : fiadoUso >= 60 ? 'text-amber-400' : 'text-teal-400'}`}>
                          {Math.round(fiadoUso)}% · {formatUsd(Math.abs(balance))}
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            fiadoUso >= 85
                              ? 'bg-gradient-to-r from-rose-500 to-orange-500'
                              : fiadoUso >= 60
                                ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                                : 'bg-gradient-to-r from-teal-500 to-emerald-400'
                          }`}
                          style={{ width: `${Math.max(4, fiadoUso)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1.5">
                        {fiadoUso >= 85
                          ? 'Estás cerca del tope. Considera abonar para liberar tu fiado.'
                          : fiadoUso >= 60
                            ? 'Has usado buena parte de tu fiado. Abona para seguir comprando a cuenta.'
                            : 'Tu fiado tiene espacio disponible para tus próximos pedidos.'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 mt-3">
                      El kiosko te dio fiado sin tope de crédito. Puedes comprar a cuenta y abonar cuando quieras.
                    </p>
                  )}
                  {rate?.rate > 0 && (
                    <div className="mt-3 space-y-2">
                      <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Abono rápido</span>
                      <div className="grid grid-cols-3 gap-2">
                        {[25, 50, 100].map((pct) => (
                          <button
                            key={pct}
                            onClick={() => quickAbono(pct)}
                            className="py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 hover:border-teal-500/60 hover:text-teal-300 transition-all active:scale-95"
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Toca el % y completa con tu comprobante para aplicar el abono al instante.
                      </p>
                    </div>
                  )}
                </div>
              )}
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider flex items-center justify-between">
                <span>Detalle de la deuda ({debtOrders.length} pedidos)</span>
                <span className="text-red-400 font-black text-sm">{formatUsd(debtTotal)}</span>
              </span>
              {debtOrders.length === 0 ? (
                <p className="text-xs text-slate-500 bg-slate-900/50 p-3 rounded-xl">
                  {debtTotal > 0
                    ? 'Tu saldo deudor está registrado manualmente; no hay pedidos a crédito pendientes en el historial.'
                    : 'No tienes deudas registradas en este momento.'}
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
          )}

          {/* Estado de cuenta del mes: saldo inicial en el header, fecha y hora de
              cada movimiento, y saldo final diferenciado (negativo = rojo, positivo = verde) */}
          {customerTimeline.length > 0 && (
            <div className="space-y-2">
              <div className="rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Saldo inicial · {monthName}</p>
                  <p className={`text-lg font-black ${saldoInicialMes < 0 ? 'text-red-400' : saldoInicialMes > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {formatUsd(saldoInicialMes)}
                  </p>
                </div>
                <span className="text-[10px] text-slate-500 text-right">
                  Estado de cuenta
                  <br />
                  {customerTimeline.length} movimientos
                </span>
              </div>
              <div className="space-y-0">
                {customerTimeline.map((m, idx) => (
                  <div key={m.id} className="relative flex gap-3 pb-3">
                    {idx < customerTimeline.length - 1 && (
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
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-200 capitalize">
                          {m.date.getTime() ? m.date.toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Sin fecha'}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {m.date.getTime() ? m.date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <p className="text-xs font-bold text-slate-200 truncate">{m.label}</p>
                        <span className={`font-mono font-bold shrink-0 ${m.kind === 'deuda' ? 'text-red-400' : 'text-emerald-300'}`}>
                          {m.kind === 'deuda' ? '−' : '+'}{formatUsd(Math.abs(m.amount))}
                        </span>
                      </div>
                      {m.detail && <p className="text-[10px] text-slate-500 truncate">{m.detail}</p>}
                      <p className={`text-[10px] font-bold mt-1.5 ${m.balance < 0 ? 'text-red-300' : m.balance > 0 ? 'text-emerald-300' : 'text-slate-400'}`}>
                        Saldo: {formatUsd(m.balance)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between px-1 pt-2 border-t border-slate-800">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Saldo del mes</span>
                <span className={`text-lg font-black ${currentSaldo < 0 ? 'text-red-400' : currentSaldo > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {formatUsd(currentSaldo)}
                </span>
              </div>
            </div>
          )}

          {/* Formulario de abono / depósito a cartera */}
          {!isSaldoView && showAbono && (
            <form onSubmit={handleAbono} className="space-y-2.5 rounded-2xl bg-slate-950 border border-slate-700 p-4 animate-fade-in">
              <span className="text-xs text-slate-300 font-bold flex items-center gap-1.5">
                <Icon name={hasWallet ? 'wallet' : 'upload'} className="w-4 h-4 text-teal-400" />
                {hasWallet ? 'Depositar en mi cartera' : 'Abonar a mi cuenta'}
              </span>
              {rate?.rate > 0 && (
                <p className="text-[10px] text-slate-500">
                  Tasa del día: Bs {Number(rate.rate).toFixed(2)} ·{' '}
                  {amountBs && Number(parseAmount(amountBs)) > 0
                    ? <>equivale a <b className="text-teal-300">{formatUsd(parseAmount(amountBs) / rate.rate)}</b></>
                    : 'se convierte sola al enviar'}
                </p>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Monto abonado en bolívares *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountBs}
                  onChange={(e) => setAmountBs(formatAmountBsInput(e.target.value))}
                  placeholder="Ej: 1.500,00"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Número de referencia / comprobante</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Ej: 12H3456789"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Foto del comprobante *</label>
                <label className="w-full flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/60 cursor-pointer hover:border-teal-500/50 transition-all text-center">
                  {proof ? (
                    <>
                      <img src={proof} alt="Comprobante del abono" className="max-h-32 rounded-lg object-contain" />
                      <span className="text-[11px] text-teal-300 font-semibold flex items-center gap-1">
                        <Icon name="check" className="w-3.5 h-3.5" />
                        Adjunto — toca para cambiarlo
                      </span>
                    </>
                  ) : (
                    <>
                      <Icon name="upload" className="w-6 h-6 text-slate-500" />
                      <span className="text-xs text-slate-400">Toca para tomar una foto o subir el comprobante</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files && e.target.files[0];
                      if (!file) return;
                      if (file.size > 8 * 1024 * 1024) {
                        addToast('La imagen supera 8 MB. Elige una más liviana.', 'error');
                        e.target.value = '';
                        return;
                      }
                      try {
                        const compressed = await compressImage(file);
                        setProof(compressed);
                      } catch {
                        addToast('No se pudo procesar la imagen. Prueba con otra.', 'error');
                      } finally {
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAbono(false)}
                  className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {sending ? (
                    <>
                      <Icon name="refresh" className="w-4 h-4 animate-spin" /> Procesando…
                    </>
                  ) : (
                    <>
                      <Icon name="check" className="w-4 h-4" /> Enviar abono
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

        </div>

        <div className="p-4 sm:p-6 border-t border-slate-800 shrink-0 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              {isSaldoView
                ? walletAmount > 0
                  ? 'Saldo disponible'
                  : balance > 0
                  ? 'Saldo pendiente por pagar'
                  : 'Saldo disponible'
                : hasWallet
                ? 'Saldo a favor'
                : 'Total deuda'}
            </span>
            <span
              className={`text-base font-black ${
                isSaldoView ? (walletAmount > 0 ? 'text-emerald-400' : balance > 0 ? 'text-red-400' : 'text-slate-400') : hasWallet ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {formatUsd(isSaldoView ? (walletAmount > 0 ? walletAmount : balance) : hasWallet ? walletAmount : debtTotal)}
              {rate?.rate > 0 && (
                <span className="block text-[10px] font-bold text-slate-400 text-right">
                  {formatBs(usdToBs(isSaldoView ? (walletAmount > 0 ? walletAmount : balance) : hasWallet ? walletAmount : debtTotal, rate.rate))}
                </span>
              )}
            </span>
          </div>
          {!showAbono && (
            <button
              onClick={() => setShowAbono(true)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 text-sm font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <Icon name={isSaldoView || hasWallet ? 'wallet' : 'upload'} className="w-4 h-4" />
              {isSaldoView || hasWallet ? 'Depositar en cartera' : 'Abonar'}
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm font-bold transition-all"
          >
            Entendido
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
