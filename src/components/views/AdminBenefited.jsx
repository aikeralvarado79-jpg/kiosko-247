const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    user: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

export default function AdminBenefited({ allCustomers, onLoadCustomers, onToggleBenefited, onSetCreditLimit, CreditLimitComponent }) {
  return (
    <div className="p-4 sm:p-8 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-2xl backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-lg font-bold text-white">Clientes Beneficiados</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Los beneficiados pueden enviar pedidos a crédito (sumar a su cuenta).
          </p>
        </div>
        <button
          onClick={onLoadCustomers}
          className="px-3 py-2 rounded-xl bg-slate-700 text-slate-100 text-xs font-bold hover:bg-slate-600 transition-colors"
        >
          Actualizar lista
        </button>
      </div>

      {allCustomers.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">No hay clientes registrados aún.</p>
      ) : (
        <div className="grid gap-2">
          {allCustomers.map((c) => (
            <div
              key={c.phone}
              className="flex flex-wrap items-center gap-3 p-3 rounded-2xl glass-strong bg-slate-900 border border-slate-700/60"
            >
              <span
                className={`p-2 rounded-xl shrink-0 ${
                  c.isBenefited ? 'bg-teal-500/20 text-teal-400' : 'bg-slate-800 text-slate-500'
                }`}
              >
                <Icon name="user" className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-100 truncate">{c.customerName || 'Cliente'}</p>
                <p className="text-[11px] text-slate-400">{c.phone}</p>
              </div>
              {c.isBenefited && (
                <CreditLimitComponent customer={c} onSetCreditLimit={onSetCreditLimit} />
              )}
              <button
                onClick={() => onToggleBenefited(c.phone, !c.isBenefited)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  c.isBenefited
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 hover:from-teal-400 hover:to-emerald-400'
                }`}
              >
                {c.isBenefited ? 'Revocar beneficio' : 'Dar beneficio'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
