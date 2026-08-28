import { useState } from 'react';
import { formatPhoneWhatsApp } from '../../utils/phone.js';
import { buildAccountMessage } from '../../App.jsx';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    clock: <path d="M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />,
    trash: <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    check: <path d="M20 6 9 17l-5-5" />,
    plus: <path d="M12 5v14M5 12h14" />,
  };
  const icon = icons[name];
  if (!icon) return null;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icon}
    </svg>
  );
};

// Formulario para programar una fecha/hora de cobro y listar los programados.
export default function CollectionScheduler({ customer, orders, collections, onUpsertCollection, onDeleteCollection }) {
  const [dueAt, setDueAt] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!dueAt) return;
    setSaving(true);
    await onUpsertCollection({
      phone: customer.phone,
      customerName: customer.customerName || 'Cliente',
      dueAt: new Date(dueAt).toISOString(),
      note,
      status: 'programado'
    });
    setSaving(false);
    setDueAt('');
    setNote('');
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-500/30 space-y-3">
      <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
        <Icon name="clock" className="w-3.5 h-3.5" />
        Programar cobro automático
      </span>
      <form onSubmit={handleSchedule} className="space-y-2">
        <label className="block text-[11px] text-slate-400 font-semibold">Fecha y hora del envío automático *</label>
        <input
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-cyan-500 focus:outline-none"
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota opcional (ej: recordatorio de tu compra pendiente)"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-cyan-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={saving || !dueAt}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 text-xs font-bold hover:from-cyan-400 hover:to-teal-400 disabled:opacity-40 transition-all"
        >
          {saving ? 'Guardando...' : 'Programar envío'}
        </button>
      </form>

      {collections.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Cobros programados</span>
          {collections.map((c) => {
            const isPast = new Date(c.dueAt || 0) < new Date();
            return (
              <div key={c.id} className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800">
                <span className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-400 shrink-0">
                  <Icon name="clock" className="w-3.5 h-3.5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-100">
                    {c.dueAt ? new Date(c.dueAt).toLocaleString('es-VE') : 'Sin fecha'}
                    {isPast && c.status === 'programado' && <span className="text-rose-400"> · vencido</span>}
                  </p>
                  {c.note && <p className="text-[10px] text-slate-500 truncate">{c.note}</p>}
                </div>
                <div className="flex items-center gap-1">
                  {isPast && c.status === 'programado' && (
                    <button
                      onClick={() => {
                        const wa = formatPhoneWhatsApp(customer.phone);
                        const msg = c.note
                          ? `${buildAccountMessage(customer, orders)}\n\n_${c.note}_`
                          : buildAccountMessage(customer, orders);
                        if (wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
                      }}
                      className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-[10px] font-bold hover:bg-emerald-500/25"
                    >
                      Enviar ahora
                    </button>
                  )}
                  <button
                    onClick={() => onDeleteCollection(c.id)}
                    className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-300 text-[10px] font-bold hover:bg-rose-500/25"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
