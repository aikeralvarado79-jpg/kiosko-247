export default function LoadingScreen({ variant = 'catalog' }) {
  // Skeleton de pedidos (panel admin): tarjetas con avatar, líneas, chips y
  // botones de estado — misma forma que las cards reales de Activos.
  if (variant === 'orders') {
    return (
      <div className="space-y-5 sm:space-y-8 animate-fade-in" aria-busy="true" aria-label="Cargando pedidos">
        <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-slate-800/40 border border-slate-700/40 flex items-center gap-3">
          <div className="skeleton-block w-10 h-10 rounded-xl" />
          <div className="space-y-2 flex-1">
            <div className="skeleton-block w-48 h-5" />
            <div className="skeleton-block w-32 h-3.5" />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-3.5 sm:p-5 rounded-2xl bg-slate-800/40 border border-slate-700/40 flex items-center gap-3">
              <div className="skeleton-block w-9 h-9 rounded-xl" />
              <div className="space-y-1.5 flex-1">
                <div className="skeleton-block h-3 w-3/4" />
                <div className="skeleton-block h-6 w-1/2" />
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 overflow-hidden">
          <div className="skeleton-block h-9 w-20 rounded-2xl shrink-0" />
          <div className="skeleton-block h-9 w-24 rounded-2xl shrink-0" />
          <div className="skeleton-block h-9 w-16 rounded-2xl shrink-0" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4 sm:p-5 rounded-3xl bg-slate-800/40 border border-slate-700/40 space-y-3">
              <div className="flex items-center gap-3">
                <div className="skeleton-block w-11 h-11 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <div className="skeleton-block h-4 w-2/3" />
                  <div className="skeleton-block h-3 w-1/3" />
                </div>
                <div className="skeleton-block h-6 w-16 rounded-full" />
              </div>
              <div className="space-y-1.5">
                <div className="skeleton-block h-3 w-full" />
                <div className="skeleton-block h-3 w-5/6" />
                <div className="skeleton-block h-3 w-2/3" />
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="skeleton-block h-8 w-24 rounded-xl" />
                <div className="skeleton-block h-8 w-16 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in" aria-busy="true" aria-label="Cargando la tienda">
      {/* Hero skeleton */}
      <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-8 bg-slate-800/40 border border-slate-700/40">
        <div className="skeleton-block w-32 h-5 mb-3" />
        <div className="skeleton-block w-56 h-8 mb-2" />
        <div className="skeleton-block w-40 h-4" />
      </div>

      {/* Buscador + pills skeleton */}
      <div className="space-y-3">
        <div className="skeleton-block h-12 rounded-2xl w-full" />
        <div className="flex gap-2 overflow-hidden">
          <div className="skeleton-block h-9 w-20 shrink-0" />
          <div className="skeleton-block h-9 w-24 shrink-0" />
          <div className="skeleton-block h-9 w-28 shrink-0" />
          <div className="skeleton-block h-9 w-20 shrink-0" />
        </div>
      </div>

      {/* Grid de tarjetas skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl sm:rounded-3xl bg-slate-800/40 border border-slate-700/40 overflow-hidden">
            <div className="skeleton-block aspect-square w-full rounded-none" />
            <div className="p-3 sm:p-4 space-y-2">
              <div className="skeleton-block h-4 w-3/4" />
              <div className="skeleton-block h-3 w-1/2" />
              <div className="flex justify-between items-center pt-2">
                <div className="skeleton-block h-5 w-14" />
                <div className="skeleton-block h-9 w-9 rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
