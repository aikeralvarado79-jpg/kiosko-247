import { useState, useEffect } from 'react';
import { formatBs, formatUsd } from '../../utils/format.js';
import { api } from '../../api.js';

const Icon = ({ name, className = "w-5 h-5", ...props }) => {
  const icons = {
    eye: <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
    refresh: <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />,
    check: <path d="M20 6 9 17l-5-5" />,
    image: <path d="M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    wallet: <path d="M21 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2M21 12h-5a2 2 0 0 0 0 4h5a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1z" />,
    creditCard: <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM2 10h20M6 15h4" />,
    chevronUp: <path d="m18 15-6-6-6 6" />,
    chevronDown: <path d="m6 9 6 6 6-6" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name]}
    </svg>
  );
};

export default function PaymentsAdminView({ payments, onLoadPayments, onApprovePayment, onRejectPayment }) {
  const [showProofId, setShowProofId] = useState(null);
  const [proof, setProof] = useState(null);
  const [loadingProof, setLoadingProof] = useState(false);
  const [note, setNote] = useState('');
  const [rejectingId, setRejectingId] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [expandedClient, setExpandedClient] = useState(null);

  useEffect(() => {
    onLoadPayments();
  }, [onLoadPayments]);

  const openProof = async (payment) => {
    setShowProofId(payment.id);
    setProof(null);
    setLoadingProof(true);
    try {
      const res = await api.getPaymentProof(payment.id, payment.phone);
      setProof(res.ok ? res.data?.proof : null);
    } catch {
      setProof(null);
    } finally {
      setLoadingProof(false);
    }
  };

  const approve = async (payment) => {
    setActionLoading(payment.id);
    try {
      const ok = await onApprovePayment(payment.id);
      if (ok) {
        setShowProofId(null);
        setNote('');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const reject = async (payment) => {
    setActionLoading(payment.id);
    try {
      const ok = await onRejectPayment(payment.id, note);
      if (ok) {
        setShowProofId(null);
        setRejectingId(null);
        setNote('');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const paymentsByClient = payments.reduce((acc, p) => {
    const key = p.phone;
    if (!acc[key]) acc[key] = { phone: key, name: p.customerName, payments: [] };
    acc[key].payments.push(p);
    return acc;
  }, {});

  const clients = Object.values(paymentsByClient).map((client) => {
    client.payments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return client;
  });

  const STATUS_BADGE = {
    pendiente: { text: 'Por verificar', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
    aprobado: { text: 'Aprobado', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
    rechazado: { text: 'Rechazado', cls: 'text-rose-300 bg-rose-500/10 border-rose-500/30' }
  };

  const renderPayment = (p, clientPhone) => (
    <div key={p.id} className="rounded-2xl glass-strong bg-slate-900 border border-slate-700/70 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-cyan-400 text-xs">{p.id}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${(STATUS_BADGE[p.status] || STATUS_BADGE.pendiente).cls}`}>
              {(STATUS_BADGE[p.status] || STATUS_BADGE.pendiente).text}
            </span>
          </div>
          <p className="text-sm font-bold text-white mt-1.5">{p.customerName}</p>
          <p className="text-[11px] text-slate-500">{p.phone}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-black text-white">{formatBs(Number(p.amountBs))}</p>
          <p className="text-xs font-bold text-teal-300">≈ {formatUsd(Number(p.amountUsd))}</p>
          <p className="text-[10px] text-slate-500">a Bs {Number(p.rate).toFixed(2)}</p>
        </div>
      </div>
      <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
        <span>{new Date(p.createdAt).toLocaleString('es-VE')}</span>
        {p.reference ? <span>Ref: {p.reference}</span> : null}
      </div>

      {p.status === 'pendiente' && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openProof(p)}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-sky-500/15 border border-sky-500/40 text-sky-300 hover:bg-sky-500/25 transition-all inline-flex items-center justify-center gap-1.5"
          >
            <Icon name="eye" className="w-4 h-4" />
            Ver comprobante
          </button>
          <button
            onClick={() => approve(p)}
            disabled={actionLoading === p.id}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 transition-all inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {actionLoading === p.id ? (
              <Icon name="refresh" className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Icon name="check" className="w-4 h-4" /> Aprobar
              </>
            )}
          </button>
        </div>
      )}
      {p.status === 'rechazado' && p.note && (
        <p className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/20 p-2 rounded-xl">
          Nota: {p.note}
        </p>
      )}

      {showProofId === p.id && (
        <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 space-y-3 animate-fade-in">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Icon name="image" className="w-3.5 h-3.5" /> Comprobante
          </span>
          {loadingProof ? (
            <div className="w-full h-40 flex items-center justify-center bg-slate-800/60 rounded-xl">
              <Icon name="refresh" className="w-6 h-6 text-teal-400 animate-spin" />
            </div>
          ) : proof ? (
            <img src={proof} alt="Comprobante del abono" className="w-full max-h-72 rounded-xl object-contain bg-slate-900 border border-slate-800" />
          ) : (
            <p className="text-xs text-slate-500 bg-slate-800/60 p-3 rounded-xl text-center">
              No se pudo cargar el comprobante.
            </p>
          )}
          {p.status === 'pendiente' && (
            <div className="space-y-2">
              {rejectingId === p.id ? (
                <div className="space-y-2">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Motivo del rechazo (se envía al cliente)…"
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:border-rose-500 focus:outline-none resize-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setRejectingId(null);
                        setNote('');
                      }}
                      className="py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                    >
                      Volver
                    </button>
                    <button
                      onClick={() => reject(p)}
                      disabled={actionLoading === p.id}
                      className="py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold disabled:opacity-60"
                    >
                      {actionLoading === p.id ? (
                        <Icon name="refresh" className="w-4 h-4 animate-spin mx-auto" />
                      ) : (
                        'Confirmar rechazo'
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setRejectingId(p.id);
                    setNote('');
                  }}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/25 transition-all inline-flex items-center justify-center gap-1.5"
                >
                  <Icon name="x" className="w-4 h-4" />
                  Rechazar abono
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderClient = (client) => {
    const pendientes = client.payments.filter((p) => p.status === 'pendiente');
    const aprobados = client.payments.filter((p) => p.status === 'aprobado');
    const rechazados = client.payments.filter((p) => p.status === 'rechazado');
    const isExpanded = expandedClient === client.phone;

    const totalAprobado = aprobados.reduce((sum, p) => sum + Number(p.amountUsd || 0), 0);
    const totalPendiente = pendientes.reduce((sum, p) => sum + Number(p.amountUsd || 0), 0);

    return (
      <div key={client.phone} className="rounded-2xl glass-strong bg-slate-900 border border-slate-700/70 overflow-hidden">
        <button
          onClick={() => setExpandedClient(isExpanded ? null : client.phone)}
          className="w-full p-4 flex items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              totalAprobado > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'
            }`}>
              <Icon name={totalAprobado > 0 ? 'wallet' : 'creditCard'} className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-white truncate">{client.name || 'Cliente'}</p>
                <span className="font-mono text-cyan-400 text-xs">{client.phone}</span>
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-2">
                <span>{client.payments.length} pagos</span>
                <span>·</span>
                <span className="text-teal-300 font-bold">Aprobados: {formatUsd(totalAprobado)}</span>
                <span>·</span>
                <span className="text-amber-300 font-bold">Pendientes: {formatUsd(totalPendiente)}</span>
                <span>·</span>
                <span className="text-rose-300 font-bold">Rechazados: {rechazados.length}</span>
              </p>
            </div>
          </div>
          <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} className="w-5 h-5 text-slate-400 shrink-0" />
        </button>

        {isExpanded && (
          <div className="border-t border-slate-800 p-4 space-y-4">
            {pendientes.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Por verificar ({pendientes.length})
                </span>
                {pendientes.map((p) => renderPayment(p, client.phone))}
              </div>
            )}
            {aprobados.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Aprobados ({aprobados.length}) — Total: {formatUsd(totalAprobado)}
                </span>
                {aprobados.map((p) => renderPayment(p, client.phone))}
              </div>
            )}
            {rechazados.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Rechazados ({rechazados.length})
                </span>
                {rechazados.map((p) => renderPayment(p, client.phone))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="p-4 sm:p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-2xl backdrop-blur-md">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Icon name="wallet" className="w-5 h-5 text-teal-400" />
          Abonos y depósitos
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Los clientes suben comprobantes para abonar deuda o depositar en cartera. Verifica el pago y aprueba:
          el monto (en USD, según la tasa del día) se descuenta de su deuda; el excedente queda como "Mi Cartera".
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4 text-center">
          <div className="rounded-2xl bg-slate-900/80 border border-slate-700/60 p-3">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Clientes con pagos</span>
            <span className="text-2xl font-black text-teal-300">{Object.keys(paymentsByClient).length}</span>
          </div>
          <div className="rounded-2xl bg-slate-900/80 border border-slate-700/60 p-3">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Pagos por verificar</span>
            <span className="text-2xl font-black text-amber-300">{payments.filter((p) => p.status === 'pendiente').length}</span>
          </div>
          <div className="rounded-2xl bg-slate-900/80 border border-slate-700/60 p-3">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Total aprobado (USD)</span>
            <span className="text-2xl font-black text-emerald-300">
              {formatUsd(payments.filter((p) => p.status === 'aprobado').reduce((sum, p) => sum + Number(p.amountUsd || 0), 0))}
            </span>
          </div>
        </div>
      </div>

      {Object.keys(paymentsByClient).length === 0 ? (
        <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-sm text-slate-400 text-center">
          Aún no hay pagos. Cuando un cliente suba un comprobante, aparecerá aquí agrupado por cliente.
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map(renderClient)}
        </div>
      )}
    </div>
  );
}
