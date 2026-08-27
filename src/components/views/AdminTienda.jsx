const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    store: <><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" /><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" /><path d="M2 7h20" /><path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" /></>,
    mapPin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

export default function AdminTienda({ storeLocation, showStorePicker, setShowStorePicker, MapPickerModal, onSaveStoreLocation }) {
  return (
    <div className="p-4 sm:p-8 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-2xl backdrop-blur-md space-y-4">
      <div>
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Icon name="store" className="w-5 h-5 text-teal-400" />
          Ubicación del Comercio
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Esta es la dirección fija del negocio. Aparece en el rastreo del cliente como punto de origen
          de la entrega. Cualquier administrador puede actualizarla.
        </p>
      </div>

      {storeLocation ? (
        <div className="rounded-2xl glass-strong bg-slate-900 border border-slate-700/60 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="p-2.5 rounded-xl bg-teal-500/20 text-teal-400 shrink-0">
            <Icon name="store" className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400">Comercio configurado</p>
            {storeLocation.address && (
              <p className="text-sm font-bold text-white truncate">{storeLocation.address}</p>
            )}
            <p className="text-[11px] text-slate-500">
              {Number(storeLocation.lat).toFixed(6)}, {Number(storeLocation.lng).toFixed(6)}
            </p>
          </div>
          <a
            href={`https://www.google.com/maps?q=${Number(storeLocation.lat)},${Number(storeLocation.lng)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-xl bg-sky-500/15 border border-sky-500/40 text-sky-300 text-xs font-bold hover:bg-sky-500/25 transition-all inline-flex items-center gap-1.5"
          >
            <Icon name="mapPin" className="w-3.5 h-3.5" />
            Abrir en Maps
          </a>
        </div>
      ) : (
        <div className="rounded-2xl glass-strong bg-slate-900 border border-slate-700/60 p-4 text-sm text-slate-400">
          Aún no configuraste la ubicación del comercio. Usa el botón para elegirla en el mapa.
        </div>
      )}

      <button
        onClick={() => setShowStorePicker(true)}
        className="px-5 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-sm hover:from-teal-400 hover:to-emerald-400 shadow-lg shadow-teal-500/20 transition-all inline-flex items-center gap-2"
      >
        <Icon name="mapPin" className="w-4 h-4" />
        {storeLocation ? 'Cambiar ubicación del comercio' : 'Configurar ubicación'}
      </button>

      {showStorePicker && (
        <MapPickerModal
          title="Ubicación del comercio"
          initial={storeLocation?.lat != null ? { lat: storeLocation.lat, lng: storeLocation.lng } : null}
          onPick={async (p) => {
            const ok = await onSaveStoreLocation(p);
            if (ok) setShowStorePicker(false);
          }}
          onClose={() => setShowStorePicker(false)}
        />
      )}
    </div>
  );
}
