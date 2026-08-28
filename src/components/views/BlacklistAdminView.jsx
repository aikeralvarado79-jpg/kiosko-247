import { useState } from 'react';
import { createPortal } from 'react-dom';
import { formatUsd } from '../../utils/format.js';
import DebtDetailModal from './DebtDetailModal.jsx';
import AddDebtProductsModal from './AddDebtProductsModal.jsx';
import AddDebtAmountModal from './AddDebtAmountModal.jsx';
import { ConfirmActionModal } from '../../App.jsx';

const Icon = ({ name, className = "w-5 h-5", ...props }) => {
  const icons = {
    plus: <path d="M12 5v14M5 12h14" />,
    alertTriangle: <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3zM12 9v4M12 17h.01" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
    package: <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />,
    wallet: <path d="M21 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2M21 12h-5a2 2 0 0 0 0 4h5a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1z" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    checkCircle: <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9 12l2 2 4-4" />,
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

export default function BlacklistAdminView({
  customers,
  orders,
  rate,
  products,
  payments,
  onLoadCustomers,
  onAddToBlacklist,
  onAddBlacklistDebt,
  collections,
  onUpsertCollection,
  onDeleteCollection,
  headerHeight = 0
}) {
  const [selectedDebtor, setSelectedDebtor] = useState(null); // customer abierto
  const [isAddProductsOpen, setIsAddProductsOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isAddAmountOpen, setIsAddAmountOpen] = useState(false);
  const [clearDebtTarget, setClearDebtTarget] = useState(null);

  const debtors = customers.filter((c) => (Number(c.balance) || 0) > 0);

  const handleAddDebt = async ({ phone: targetPhone, name: targetName, items, description: targetDescription }) => {
    const ok = await onAddBlacklistDebt({ phone: targetPhone, name: targetName, items, description: targetDescription });
    if (ok) {
      setIsAddProductsOpen(false);
      setIsAddAmountOpen(false);
      setIsRegisterOpen(false);
      setSelectedDebtor(null);
    }
  };

  const handleClearDebt = (customer) => {
    setClearDebtTarget(customer);
  };

  return (
    <div className="p-4 sm:p-8 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-2xl backdrop-blur-md space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">Lista Negra · Deudores</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Clientes con saldo pendiente. Toca un deudor para ver el desglose, enviar la cuenta por WhatsApp o programar el cobro.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsRegisterOpen(true)}
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-red-500 to-amber-500 text-slate-950 text-xs font-bold hover:from-red-400 hover:to-amber-400 shadow-lg shadow-red-500/20 transition-colors flex items-center gap-1.5"
          >
            <Icon name="plus" className="w-4 h-4" />
            Registrar
          </button>
          <button
            onClick={onLoadCustomers}
            className="px-3 py-2 rounded-xl bg-slate-700 text-slate-100 text-xs font-bold hover:bg-slate-600 transition-colors"
          >
            Actualizar lista
          </button>
        </div>
      </div>

      {debtors.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">No hay deudores registrados.</p>
      ) : (
        <div className="grid gap-2">
          {debtors.map((c) => (
            <div
              key={c.phone}
              className="flex items-center gap-3 p-3 rounded-2xl glass-strong bg-slate-900 border border-slate-700/60 hover:border-amber-500/40 cursor-pointer transition-all"
              onClick={() => setSelectedDebtor(c)}
            >
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                <Icon name="alertTriangle" className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-100 truncate">{c.customerName || 'Cliente'}</p>
                <p className="text-[11px] text-slate-400">{c.phone}</p>
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                <span className="block text-base font-black text-red-400">
                  {formatUsd(Number(c.balance) || 0)}
                </span>
                <span className="text-[10px] text-amber-400/80 flex items-center gap-0.5">
                  <Icon name="chevronRight" className="w-3 h-3" />
                  Ver detalle
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de detalle de deuda */}
      {selectedDebtor &&
        createPortal(
          <DebtDetailModal
            customer={selectedDebtor}
            orders={orders}
            rate={rate}
            onClose={() => setSelectedDebtor(null)}
            onClearDebt={handleClearDebt}
            collections={collections}
            onUpsertCollection={onUpsertCollection}
            onDeleteCollection={onDeleteCollection}
            headerHeight={headerHeight}
            payments={payments}
          />,
          document.body
        )}

      {/* Modal para añadir productos a la deuda de un cliente */}
      {isAddProductsOpen &&
        createPortal(
          <AddDebtProductsModal
            products={products}
            rate={rate}
            customers={customers}
            onClose={() => setIsAddProductsOpen(false)}
            onConfirm={handleAddDebt}
            headerHeight={headerHeight}
          />,
          document.body
        )}

      {/* Modal de elección de registro (productos o monto) */}
      {isRegisterOpen &&
        createPortal(
          <div
            className="fixed inset-x-0 bottom-0 z-[70] overflow-hidden animate-fade-in"
            style={{ top: headerHeight }}
          >
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsRegisterOpen(false)} />
            <div className="relative h-full flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
              <div className="pointer-events-auto relative w-full sm:max-w-md glass-strong bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-modal-spring max-h-full flex flex-col">
                <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Icon name="plus" className="w-5 h-5 text-amber-400" />
                      Registrar deuda
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Elige cómo quieres cargar la deuda del cliente.
                    </p>
                  </div>
                  <button onClick={() => setIsRegisterOpen(false)} className="p-2 text-slate-400 hover:text-white rounded-xl">
                    <Icon name="x" className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-4 sm:p-6 space-y-3 overflow-y-auto flex-1 min-h-0">
                  <button
                    onClick={() => {
                      setIsRegisterOpen(false);
                      setIsAddProductsOpen(true);
                    }}
                    className="w-full p-4 rounded-2xl bg-slate-800/80 border border-slate-700 hover:border-teal-500/50 text-left transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="p-2.5 rounded-xl bg-teal-500/15 text-teal-300 shrink-0">
                        <Icon name="package" className="w-5 h-5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-100">Añadir productos</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Elige productos del catálogo que el cliente debe (ventas presenciales o deudas viejas).
                        </p>
                      </div>
                      <Icon name="chevronRight" className="w-4 h-4 text-slate-500 shrink-0" />
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setIsRegisterOpen(false);
                      setIsAddAmountOpen(true);
                    }}
                    className="w-full p-4 rounded-2xl bg-slate-800/80 border border-slate-700 hover:border-amber-500/50 text-left transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="p-2.5 rounded-xl bg-amber-500/15 text-amber-300 shrink-0">
                        <Icon name="wallet" className="w-5 h-5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-100">Registrar monto</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Carga una deuda directa en dólares con teléfono, nombre y motivo.
                        </p>
                      </div>
                      <Icon name="chevronRight" className="w-4 h-4 text-slate-500 shrink-0" />
                    </div>
                  </button>
                  <button
                    onClick={() => setIsRegisterOpen(false)}
                    className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-bold hover:bg-slate-700 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Modal para registrar una deuda por monto directo (teléfono, nombre, monto, motivo) */}
      {isAddAmountOpen &&
        createPortal(
          <AddDebtAmountModal
            customers={customers}
            rate={rate}
            onClose={() => setIsAddAmountOpen(false)}
            onConfirm={handleAddDebt}
            headerHeight={headerHeight}
          />,
          document.body
        )}

      {clearDebtTarget && (
        <ConfirmActionModal
          title={`¿Saldar deuda de ${clearDebtTarget.customerName || clearDebtTarget.phone}?`}
          message={`${clearDebtTarget.customerName || 'Cliente'} debe ${formatUsd(Number(clearDebtTarget.balance) || 0)}. Al saldar, el saldo queda en cero.`}
          note="Esta acción no se puede deshacer."
          confirmLabel="Saldar"
          icon="checkCircle"
          tone="danger"
          onConfirm={() => {
            onAddToBlacklist(clearDebtTarget.phone.replace(/\D/g, ''), clearDebtTarget.customerName, '0');
            setClearDebtTarget(null);
          }}
          onClose={() => setClearDebtTarget(null)}
        />
      )}
    </div>
  );
}
