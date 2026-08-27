import { Fragment } from 'react';
import { formatUsd, formatBs, usdToBs, formatSize } from '../../utils/format.js';
import { categoryIdentity } from '../../utils/category.js';
import ProductImg from '../ui/ProductImg.jsx';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    layers: <><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>,
    edit: <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />,
    trash: <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />,
    whatsapp: <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />,
    refresh: <path d="M21 12a9 9 0 1 1-6.219-8.56" />,
    chevronUp: <path d="m18 15-6-6-6 6" />,
    chevronDown: <path d="m6 9 6 6 6-6" />,
    list: <><line x1="8" x2="21" y1="6" y2="6" /><line x1="8" x2="21" y1="12" y2="12" /><line x1="8" x2="21" y1="18" y2="18" /><line x1="3" x2="3.01" y1="6" y2="6" /><line x1="3" x2="3.01" y1="12" y2="12" /><line x1="3" x2="3.01" y1="18" y2="18" /></>,
    store: <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4M2 7h20" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

function ShelfScroller({ children, className }) {
  const ref = { current: null };
  return <div ref={ref} className={className}>{children}</div>;
}

function MobileCard({ p, rate, onEditProduct, onDeleteProduct }) {
  const isLow = p.stock <= 5;
  const isOut = p.stock === 0;
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
      <ProductImg product={p} alt={p.name}
        className="w-14 h-14 rounded-xl object-cover glass-strong bg-slate-900 border border-slate-700 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-100 text-sm truncate">{p.name}</p>
        <p className="text-[11px] text-slate-400 truncate">{p.code} &middot; {p.category}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="font-bold text-white text-xs">{formatUsd(p.price)}</span>
          {rate?.rate > 0 && <span className="text-[10px] text-slate-400 font-semibold">{formatBs(usdToBs(p.price, rate.rate))}</span>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${isOut ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : isLow ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
          {isOut ? 'Agotado' : `${p.stock} un.`}
        </span>
        <div className="flex items-center gap-1.5">
          <button onClick={() => onEditProduct(p)} className="p-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-cyan-400 transition-all" title="Editar producto">
            <Icon name="edit" className="w-4 h-4" />
          </button>
          <button onClick={() => onDeleteProduct(p)} className="p-2 rounded-xl bg-slate-700/60 hover:bg-rose-500/20 text-rose-400 transition-all" title="Eliminar producto">
            <Icon name="trash" className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function TableRow({ p, rate, onEditProduct, onDeleteProduct }) {
  const isLow = p.stock <= 5;
  const isOut = p.stock === 0;
  return (
    <tr className="hover:bg-slate-700/30 transition-colors">
      <td className="p-4 flex items-center gap-3">
        <ProductImg product={p} alt={p.name} className="w-12 h-12 rounded-xl object-cover glass-strong bg-slate-900 border border-slate-700" />
        <div>
          <p className="font-bold text-slate-100">{p.name}</p>
          <p className="text-xs text-slate-400 line-clamp-1 max-w-xs">{[formatSize(p), p.description].filter(Boolean).join(' &middot; ')}</p>
        </div>
      </td>
      <td className="p-4 font-mono text-xs text-slate-400">{p.code}</td>
      <td className="p-4">
        <span className="px-2.5 py-1 rounded-xl glass-strong bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-300">{p.category}</span>
      </td>
      <td className="p-4 font-bold text-white">
        {formatUsd(p.price)}
        {rate?.rate > 0 && <span className="block text-[10px] text-slate-400 font-semibold">{formatBs(usdToBs(p.price, rate.rate))}</span>}
      </td>
      <td className="p-4">
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${isOut ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : isLow ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
          {p.stock} unidades
        </span>
      </td>
      <td className="p-4 text-right space-x-2">
        <button onClick={() => onEditProduct(p)} className="p-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-cyan-400 transition-all" title="Editar producto">
          <Icon name="edit" className="w-4 h-4" />
        </button>
        <button onClick={() => onDeleteProduct(p)} className="p-2 rounded-xl bg-slate-700/60 hover:bg-rose-500/20 text-rose-400 transition-all" title="Eliminar producto">
          <Icon name="trash" className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

export default function AdminInventory({
  products, rate, lowStockProducts, reorderMessage, headerHeight,
  invSearch, setInvSearch, invStockFilter, setInvStockFilter,
  invSortStock, setInvSortStock, invGroupByBrand, setInvGroupByBrand,
  invView, setInvView, invCategory, setInvCategory,
  filteredProducts, groupedByBrand, inventoryCategories, catCount,
  clearInvFilters, inventoryProductsByCategory,
  onEditProduct, onDeleteProduct
}) {
  return (
    <div className="space-y-4">
      {lowStockProducts.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-slate-900/80 to-slate-900/80 overflow-hidden">
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 shrink-0 self-start sm:self-center">
              <Icon name="refresh" className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                Reorden al proveedor
                <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-amber-500/25 text-amber-300">{lowStockProducts.length} por reponer</span>
              </h4>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {lowStockProducts.slice(0, 6).map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/80 border border-slate-700/70 text-[10px] font-semibold text-slate-300">
                    {p.name} <span className="text-amber-400 font-black">x{Math.max(10, Math.ceil(p.stock * 2))}</span>
                  </span>
                ))}
                {lowStockProducts.length > 6 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-lg bg-slate-800/80 border border-slate-700/70 text-[10px] font-semibold text-slate-400">+{lowStockProducts.length - 6} mas</span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-2">Cantidad sugerida para reponer (min. 10 un.) segun el stock actual.</p>
            </div>
            <a href={`https://wa.me/?text=${encodeURIComponent(reorderMessage)}`} target="_blank" rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-all text-xs font-bold w-full sm:w-auto">
              <Icon name="whatsapp" className="w-4 h-4" />Enviar pedido
            </a>
          </div>
        </div>
      )}

      <div className="space-y-3" style={{ position: 'sticky', top: headerHeight, zIndex: 30 }}>
        <div className="flex flex-col sm:flex-row gap-2.5 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-slate-700/80 p-2.5 sm:p-3 shadow-2xl shadow-slate-950/60">
          <div className="relative flex-1">
            <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input value={invSearch} onChange={(e) => setInvSearch(e.target.value)} placeholder="Buscar por nombre, codigo o marca..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-800/70 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/60 transition-all" />
            {invSearch && (
              <button onClick={() => setInvSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors" title="Limpiar busqueda">
                <Icon name="x" className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <button onClick={() => setInvStockFilter((v) => (v === 'todas' ? 'bajo' : v === 'bajo' ? 'agotado' : 'todas'))}
              className={`shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${invStockFilter !== 'todas' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-lg shadow-emerald-500/10' : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-white'}`}
              title={invStockFilter === 'bajo' ? 'Mostrando solo productos con stock bajo (<=5)' : invStockFilter === 'agotado' ? 'Mostrando solo productos agotados' : 'Filtrar por stock: bajo / agotados'}>
              <Icon name="layers" className="w-4 h-4 shrink-0" />
              <span>{invStockFilter === 'todas' ? 'Stock' : invStockFilter === 'bajo' ? 'Solo bajo' : 'Agotados'}</span>
            </button>
            <button onClick={() => setInvSortStock((v) => (v === false ? 'asc' : v === 'asc' ? 'desc' : false))}
              className={`shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${invSortStock ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-lg shadow-sky-500/10' : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-white'}`}>
              <Icon name={invSortStock === 'asc' ? 'chevronUp' : invSortStock === 'desc' ? 'chevronDown' : 'list'} className="w-4 h-4 shrink-0" />
              <span>{invSortStock === 'asc' ? 'Stock \u2191' : invSortStock === 'desc' ? 'Stock \u2193' : 'Ordenar'}</span>
            </button>
            <button onClick={() => setInvGroupByBrand((v) => !v)}
              className={`shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${invGroupByBrand ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-lg shadow-indigo-500/10' : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-white'}`}>
              <Icon name="layers" className="w-4 h-4 shrink-0" />
              <span>{invGroupByBrand ? 'Por marca \u2713' : 'Agrupar por marca'}</span>
            </button>
            <button onClick={() => setInvView((v) => (v === 'lista' ? 'recorrido' : 'lista'))}
              className={`shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${invView === 'recorrido' ? 'bg-teal-500/20 text-teal-300 border-teal-500/40 shadow-lg shadow-teal-500/10' : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-white'}`}>
              <Icon name={invView === 'recorrido' ? 'list' : 'store'} className="w-4 h-4 shrink-0" />
              <span>{invView === 'recorrido' ? 'Ver lista' : 'Recorrido'}</span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
          {inventoryCategories.map((c) => {
            const id = c === 'todas' ? null : categoryIdentity(c);
            const isActive = invCategory === c;
            return (
              <button key={c} onClick={() => setInvCategory(c)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all shrink-0 ${isActive ? (c === 'todas' ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-lg shadow-teal-500/20' : `${id.solid} border-transparent shadow-lg`) : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-white'}`}>
                {c === 'todas' ? <Icon name="layers" className="w-3 h-3" /> : <Icon name={id.icon} className="w-3 h-3" />}
                {c === 'todas' ? 'Todas' : c}
                <span className="ml-1 px-1.5 py-0.5 rounded-lg bg-black/20 text-[10px]">{catCount(c)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {filteredProducts.length === 0 && (
        <div className="py-10 text-center text-slate-500 space-y-2 bg-slate-800/40 rounded-2xl border border-slate-700/50">
          <Icon name="search" className="w-10 h-10 text-slate-700 mx-auto" />
          <p className="font-bold text-slate-400">No hay productos con este filtro</p>
          <button onClick={clearInvFilters} className="text-[11px] font-semibold text-teal-400 hover:text-teal-300">Limpiar filtros</button>
        </div>
      )}

      {invView === 'recorrido' && filteredProducts.length > 0 && (
        <div className="space-y-5">
          {(invGroupByBrand ? groupedByBrand.map((g) => ({ key: g.brand, label: g.brand, items: g.items })) : inventoryProductsByCategory()).map((group) => (
            <div key={group.key}>
              <div className="flex items-center gap-2 px-1 pb-2">
                <span className="px-2.5 py-1 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-300 text-[10px] font-black uppercase tracking-wider">{group.label}</span>
                <span className="text-[10px] text-slate-500">{group.items.length} producto{group.items.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="shelf-panel px-3 sm:px-4 pb-3 pt-2 bg-slate-900/40 border border-slate-700/50 rounded-2xl">
                <ShelfScroller className="flex gap-3 overflow-x-auto shelf-scroll-x snap-x snap-mandatory -mx-1 px-1 pt-1 pb-2">
                  {group.items.map((p, i) => {
                    const isLow = p.stock <= 5;
                    const isOut = p.stock === 0;
                    return (
                      <div key={p.id} className="shelf-item" style={{ ['--sdel']: `${Math.min(i, 6) * 45}ms` }}>
                        <div className="shelf-product">
                          <div className="shelf-product__art">
                            <ProductImg product={p} alt={p.name} loading="lazy" className="shelf-product__img" />
                          </div>
                          <span className="shelf-product__shadow" />
                        </div>
                        <div className="mt-2 space-y-1.5">
                          <div className="flex items-center justify-between gap-1">
                            <p className="truncate text-[11px] font-bold text-slate-100">{p.name}</p>
                            <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-black border ${isOut ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : isLow ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
                              {isOut ? 'Agotado' : `${p.stock} un.`}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">{p.code}</p>
                          <div className="flex items-center justify-between gap-1">
                            <span className="min-w-0 text-[11px] font-extrabold text-teal-400">
                              {formatUsd(p.price)}
                              {rate?.rate > 0 && <span className="block text-[9px] text-slate-500 font-semibold">{formatBs(usdToBs(p.price, rate.rate))}</span>}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button onClick={() => onEditProduct(p)} className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-cyan-400 transition-all" title="Editar producto">
                                <Icon name="edit" className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => onDeleteProduct(p)} className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-rose-500/20 text-rose-400 transition-all" title="Eliminar producto">
                                <Icon name="trash" className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </ShelfScroller>
                <div className="shelf-lip" />
              </div>
            </div>
          ))}
        </div>
      )}

      {invView === 'lista' && (
        <div className="grid grid-cols-1 gap-3 sm:hidden">
          {invGroupByBrand ? groupedByBrand.map((g) => (
            <div key={g.brand}>
              <div className="flex items-center gap-2 px-1 pt-1 pb-1.5">
                <span className="px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-black uppercase tracking-wider">{g.brand}</span>
                <span className="text-[10px] text-slate-500">{g.items.length} producto{g.items.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-3">{g.items.map((p) => <MobileCard key={p.id} p={p} rate={rate} onEditProduct={onEditProduct} onDeleteProduct={onDeleteProduct} />)}</div>
            </div>
          )) : filteredProducts.map((p) => <MobileCard key={p.id} p={p} rate={rate} onEditProduct={onEditProduct} onDeleteProduct={onDeleteProduct} />)}
        </div>
      )}

      {invView === 'lista' && (
        <div className="hidden sm:block bg-slate-800/60 border border-slate-700/60 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700/80 bg-slate-900/60 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="p-4">Producto</th><th className="p-4">Codigo</th><th className="p-4">Categoria</th><th className="p-4">Precio</th><th className="p-4">Stock</th><th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-sm">
                {invGroupByBrand ? groupedByBrand.map((g) => (
                  <Fragment key={g.brand}>
                    <tr className="bg-slate-900/80"><td colSpan={6} className="p-2.5 pl-4">
                      <span className="px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-black uppercase tracking-wider">{g.brand}</span>
                      <span className="ml-2 text-[10px] text-slate-500">{g.items.length} producto{g.items.length !== 1 ? 's' : ''}</span>
                    </td></tr>
                    {g.items.map((p) => <TableRow key={p.id} p={p} rate={rate} onEditProduct={onEditProduct} onDeleteProduct={onDeleteProduct} />)}
                  </Fragment>
                )) : filteredProducts.map((p) => <TableRow key={p.id} p={p} rate={rate} onEditProduct={onEditProduct} onDeleteProduct={onDeleteProduct} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
