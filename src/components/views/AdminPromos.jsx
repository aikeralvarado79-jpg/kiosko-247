import { useState } from 'react';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    sparkles: <path d="m12 3 1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></>,
    edit: <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />,
    trash: <><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" /></>,
    eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /></>,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" /></>,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="1" />}
    </svg>
  );
};

export default function AdminPromos({
  promos,
  openNewPromo,
  openEditPromo,
  onSavePromos,
  adminPhone,
  handleAdminSubscribePush,
  broadcastTitle,
  setBroadcastTitle,
  broadcastBody,
  setBroadcastBody,
  handlePushBroadcast,
  handlePushTest,
  reminderPhone,
  setReminderPhone,
  handlePushReminder,
  isPromoModalOpen,
  setIsPromoModalOpen,
  promoDraft,
  setPromoDraft,
  handleSavePromo,
  handleDeletePromo,
}) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Icon name="sparkles" className="w-5 h-5 text-teal-400" />
            Promos de la Tienda
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Estas ofertas se muestran como banner en la vista de clientes. Se guardan en la nube al instante.
          </p>
        </div>
        <button
          onClick={openNewPromo}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-teal-500 text-slate-950 text-sm font-bold hover:bg-teal-400 transition-all shadow-lg shadow-teal-500/20 self-start sm:self-auto"
        >
          <Icon name="plus" className="w-4 h-4" />
          Nueva Promo
        </button>
      </div>

      {promos.length === 0 ? (
        <div className="py-16 text-center text-slate-500 space-y-2 bg-slate-800/40 border border-slate-800 rounded-3xl">
          <Icon name="sparkles" className="w-12 h-12 text-slate-700 mx-auto" />
          <p className="font-bold text-slate-400">No hay promos activas</p>
          <p className="text-xs">Crea tu primera oferta para destacarla en la tienda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {promos.map((promo) => (
            <div
              key={promo.id}
              className={`p-4 sm:p-5 rounded-3xl bg-gradient-to-br border shadow-xl flex gap-3 sm:gap-4 items-center ${
                promo.active
                  ? 'from-teal-500/15 to-slate-800/60 border-teal-500/40'
                  : 'from-slate-800/40 to-slate-800/20 border-slate-700/50 opacity-70'
              }`}
            >
              {promo.image ? (
                <img src={promo.image} alt={promo.title} className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover bg-slate-800 flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                  <Icon name="sparkles" className="w-6 h-6 text-slate-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-white text-sm sm:text-base truncate">{promo.title}</h4>
                  {!promo.active && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[10px] font-bold">Inactiva</span>
                  )}
                </div>
                {promo.subtitle && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{promo.subtitle}</p>}
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button
                  onClick={() => openEditPromo(promo)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-700 text-xs font-bold text-slate-200 hover:text-white"
                >
                  Editar
                </button>
                <button
                  onClick={() => onSavePromos(promos.filter((p) => p.id !== promo.id))}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-bold text-rose-400 hover:bg-rose-500/20"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notificaciones Push */}
      <div className="p-4 sm:p-6 rounded-3xl bg-slate-800/60 border border-slate-700 space-y-4">
        <div className="flex items-center gap-2">
          <Icon name="bell" className="w-5 h-5 text-teal-400" />
          <div>
            <h4 className="font-bold text-white text-sm">Notificaciones Push</h4>
            <p className="text-[11px] text-slate-400">
              Envía avisos directos al teléfono de los clientes que activaron las notificaciones.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/30 space-y-2.5">
          <span className="text-xs font-bold text-teal-300 block">Avisos para vos (admin)</span>
          <p className="text-[11px] text-slate-400 leading-snug">
            Recibí un aviso real cuando llegue un pedido nuevo, aunque la app esté cerrada. Se registra este dispositivo con el teléfono del admin ({adminPhone}).
          </p>
          <button
            onClick={() => handleAdminSubscribePush()}
            className="w-full py-2.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs hover:bg-teal-400 transition-all active:scale-95"
          >
            Activar notificaciones en este dispositivo
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2.5">
            <span className="text-xs font-bold text-slate-200 block">Notificación a todos</span>
            <input
              type="text"
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              placeholder="Título (ej: ¡Nuevas promos!)"
              maxLength={80}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:border-teal-500 focus:outline-none"
            />
            <input
              type="text"
              value={broadcastBody}
              onChange={(e) => setBroadcastBody(e.target.value)}
              placeholder="Mensaje (ej: Visita la tienda y aprovecha 2x1 esta semana)"
              maxLength={200}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:border-teal-500 focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => handlePushBroadcast()}
                disabled={!broadcastTitle.trim()}
                className="py-2.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs disabled:opacity-50 disabled:pointer-events-none transition-all active:scale-95"
              >
                Enviar a todos
              </button>
              <button
                onClick={() => handlePushTest()}
                className="py-2.5 rounded-xl bg-slate-700 text-slate-200 font-bold text-xs hover:bg-slate-600 transition-all active:scale-95"
              >
                Enviar prueba
              </button>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2.5">
            <span className="text-xs font-bold text-slate-200 block">Recordatorio de deuda</span>
            <input
              type="tel"
              inputMode="numeric"
              value={reminderPhone}
              onChange={(e) => setReminderPhone(e.target.value)}
              placeholder="Teléfono del cliente (0412 1234567)"
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:border-teal-500 focus:outline-none"
            />
            <button
              onClick={() => handlePushReminder()}
              disabled={!reminderPhone.trim()}
              className="w-full py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs hover:bg-amber-500/30 transition-all disabled:opacity-50 disabled:pointer-events-none active:scale-95"
            >
              Enviar recordatorio
            </button>
            <p className="text-[10px] text-slate-500">
              El cliente recibe: "Recordatorio de deuda" con el saldo pendiente.
            </p>
          </div>
        </div>
      </div>

      {/* Promo Editor Modal */}
      {isPromoModalOpen && promoDraft && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full sm:max-w-md pt-[max(1.25rem,env(safe-area-inset-top))] p-5 sm:p-6 rounded-t-3xl sm:rounded-3xl glass-strong bg-slate-900 border border-slate-700 shadow-2xl animate-screen-up space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-white text-lg">{promoDraft.id.startsWith('promo-') ? 'Nueva Promo' : 'Editar Promo'}</h4>
              <button onClick={() => setIsPromoModalOpen(false)} className="text-slate-400 hover:text-white">
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Título *</label>
                <input
                  type="text"
                  value={promoDraft.title}
                  onChange={(e) => setPromoDraft({ ...promoDraft, title: e.target.value })}
                  placeholder="Ej: 2x1 en refrescos"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Subtítulo</label>
                <input
                  type="text"
                  value={promoDraft.subtitle || ''}
                  onChange={(e) => setPromoDraft({ ...promoDraft, subtitle: e.target.value })}
                  placeholder="Ej: Válido solo por esta semana"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Imagen (URL opcional)</label>
                <input
                  type="text"
                  value={promoDraft.image || ''}
                  onChange={(e) => setPromoDraft({ ...promoDraft, image: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={promoDraft.active}
                  onChange={(e) => setPromoDraft({ ...promoDraft, active: e.target.checked })}
                  className="w-4 h-4 accent-teal-500"
                />
                Promo activa
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleSavePromo(promoDraft)}
                disabled={!promoDraft.title.trim()}
                className="flex-1 py-3 rounded-2xl bg-teal-500 text-slate-950 font-bold text-sm hover:bg-teal-400 transition-all disabled:opacity-40"
              >
                Guardar Promo
              </button>
              {promoDraft.id.startsWith('promo-') && (
                <button
                  onClick={() => handleDeletePromo(promoDraft.id)}
                  className="px-4 py-3 rounded-2xl bg-rose-500/10 text-rose-400 font-bold text-sm border border-rose-500/30 hover:bg-rose-500/20"
                >
                  Eliminar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
