export default function LoadingScreen() {
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