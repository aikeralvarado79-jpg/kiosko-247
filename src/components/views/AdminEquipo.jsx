import { useState } from 'react';
import { formatRelative } from '../../utils/format.js';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    users: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
    clock: <path d="M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />,
    refresh: <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />,
    userPlus: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    trash: <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />,
    logOut: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name]}
    </svg>
  );
};

export default function AdminEquipo({
  activeSessions,
  loadingEmployees,
  employees,
  adminPhone,
  allCustomers,
  filteredSystemUsers,
  usersFilter,
  setUsersFilter,
  usersBusy,
  onLoadEmployees,
  onRevokeSession,
  onAddEmployee,
  onRemoveEmployee,
  onToggleCustomerDisabled,
  onDeleteCustomerAccount,
  onLoadCustomers,
  newEmployeeName,
  setNewEmployeeName,
  newEmployeePhone,
  setNewEmployeePhone,
}) {
  return (
    <div className="p-4 sm:p-8 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-2xl space-y-5 sm:space-y-6 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <Icon name="users" className="w-5 h-5 text-amber-300" />
        <h3 className="text-lg sm:text-xl font-bold text-white">Equipo y Sesiones Activas</h3>
      </div>

      {/* Sesiones activas */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-700/80 p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Icon name="clock" className="w-4 h-4 text-teal-400" />
            Quién está conectado ahora
          </h4>
          <button
            onClick={onLoadEmployees}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-xs font-bold text-slate-300 hover:text-teal-300 hover:border-teal-500/40 transition-all"
          >
            <Icon name="refresh" className="w-3.5 h-3.5" />
            Refrescar
          </button>
        </div>
        {loadingEmployees ? (
          <p className="text-xs text-slate-400">Cargando sesiones...</p>
        ) : activeSessions.length === 0 ? (
          <p className="text-xs text-slate-400">No hay sesiones activas de administradores.</p>
        ) : (
          <ul className="space-y-2">
            {activeSessions.map((s, i) => {
              const isSelf = s.phone === adminPhone;
              const emp = employees.find((e) => e.phone === s.phone);
              const displayName = emp?.name || s.name || (s.phone ? `Admin ${s.phone.slice(-4)}` : 'Desconocido');
              return (
                <li key={s.id || i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/70 border border-slate-700/70">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isSelf ? 'bg-emerald-400 animate-pulse' : 'bg-teal-400'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">
                      {displayName}
                      {s.role === 'superadmin' && (
                        <span className="ml-2 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-black align-middle">
                          Super Admin
                        </span>
                      )}
                      {isSelf && (
                        <span className="ml-2 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-black align-middle">
                          Este dispositivo
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {s.phone} · Última actividad {formatRelative(s.lastSeen)}
                    </p>
                  </div>
                  {!isSelf && (
                    <button
                      onClick={() => onRevokeSession(s.phone)}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-300 text-[10px] sm:text-xs font-bold hover:bg-rose-500/25 transition-all shrink-0"
                    >
                      <Icon name="logOut" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
                      Cerrar sesión
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Gestión de empleados */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-700/80 p-4 sm:p-5 space-y-3">
        <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Icon name="userPlus" className="w-4 h-4 text-teal-400" />
          Administradores del panel
        </h4>
        <p className="text-[11px] text-slate-400">
          Añade o quita teléfonos autorizados para entrar al panel. Los administradores fijos de la configuración
          no pueden quitarse desde aquí.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={newEmployeeName}
            onChange={(e) => setNewEmployeeName(e.target.value)}
            placeholder="Nombre (opcional)"
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500/60"
          />
          <input
            value={newEmployeePhone}
            onChange={(e) => setNewEmployeePhone(e.target.value.replace(/[^\d+]/g, ''))}
            placeholder="Teléfono (ej. 04129862577)"
            inputMode="tel"
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500/60"
          />
          <button
            onClick={onAddEmployee}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 text-xs sm:text-sm font-bold hover:from-teal-400 hover:to-cyan-400 transition-all inline-flex items-center justify-center gap-1.5"
          >
            <Icon name="plus" className="w-4 h-4" />
            Añadir
          </button>
        </div>
        {employees.length === 0 ? (
          <p className="text-xs text-slate-400">No hay administradores gestionados por el super admin.</p>
        ) : (
          <ul className="space-y-2">
            {employees.map((e) => {
              const isSelf = e.phone === adminPhone;
              const active = activeSessions.some((s) => s.phone === e.phone);
              return (
                <li key={e.phone} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/70 border border-slate-700/70">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${active ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' : 'bg-slate-700 text-slate-400'}`}>
                    {(e.name || e.phone.slice(-2)).toUpperCase().slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">
                      {e.name || `Admin ${e.phone.slice(-4)}`}
                      {active && (
                        <span className="ml-2 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-teal-500/20 text-teal-300 font-black align-middle">
                          En línea
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-400">{e.phone}</p>
                  </div>
                  {!isSelf && (
                    <button
                      onClick={() => onRemoveEmployee(e.phone)}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-300 text-[10px] sm:text-xs font-bold hover:bg-rose-500/25 transition-all shrink-0"
                    >
                      <Icon name="trash" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
                      Quitar
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Usuarios en el sistema */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-700/80 p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Icon name="users" className="w-4 h-4 text-amber-300" />
            Usuarios en el sistema
          </h4>
          <button
            onClick={() => { onLoadCustomers(); onLoadEmployees(); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-xs font-bold text-slate-300 hover:text-teal-300 hover:border-teal-500/40 transition-all"
          >
            <Icon name="refresh" className="w-3.5 h-3.5" />
            Refrescar
          </button>
        </div>
        <p className="text-[11px] text-slate-400">
          Todos los perfiles de clientes registrados. Un usuario inhabilitado no podrá pasar del login ni hacer pedidos.
        </p>
        <input
          value={usersFilter}
          onChange={(e) => setUsersFilter(e.target.value)}
          placeholder="Buscar por nombre o teléfono"
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500/60"
        />
        {allCustomers.length === 0 ? (
          <p className="text-xs text-slate-400">No hay usuarios registrados.</p>
        ) : filteredSystemUsers.length === 0 ? (
          <p className="text-xs text-slate-400">Ningún usuario coincide con la búsqueda.</p>
        ) : (
          <ul className="space-y-2 max-h-[60vh] min-h-24 overflow-y-auto overscroll-contain pr-1">
            {filteredSystemUsers.map((c) => (
              <li key={c.phone} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/70 border border-slate-700/70">
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${c.disabled ? 'bg-slate-700 text-slate-500' : 'bg-teal-500/20 text-teal-300 border border-teal-500/40'}`}>
                  {(c.customerName || c.phone.slice(-2)).toUpperCase().slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">
                    {c.customerName || `Cliente ${c.phone.slice(-4)}`}
                    {c.disabled && (
                      <span className="ml-2 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 font-black align-middle">
                        Inhabilitado
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-slate-400">{c.phone}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onToggleCustomerDisabled(c)}
                    disabled={usersBusy}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all disabled:opacity-50 shrink-0 ${
                      c.disabled
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                        : 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                    }`}
                  >
                    {c.disabled ? 'Habilitar' : 'Inhabilitar'}
                  </button>
                  <button
                    onClick={() => onDeleteCustomerAccount(c)}
                    disabled={usersBusy}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-300 text-[10px] font-bold hover:bg-rose-500/25 transition-all disabled:opacity-50 shrink-0"
                    title="Eliminar perfil"
                  >
                    <Icon name="trash" className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
