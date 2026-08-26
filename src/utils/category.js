export const CATEGORY_IDENTITY = {
  comida: { chip: 'bg-amber-500 text-slate-950 border-amber-400', solid: 'bg-amber-400 text-slate-950', accent: 'text-amber-400', icon: 'burger' },
  confitería: { chip: 'bg-fuchsia-500 text-white border-fuchsia-400', solid: 'bg-fuchsia-400 text-slate-950', accent: 'text-fuchsia-400', icon: 'candy' },
  golosinas: { chip: 'bg-fuchsia-500 text-white border-fuchsia-400', solid: 'bg-fuchsia-400 text-slate-950', accent: 'text-fuchsia-400', icon: 'candy' },
  snacks: { chip: 'bg-orange-500 text-slate-950 border-orange-400', solid: 'bg-orange-400 text-slate-950', accent: 'text-orange-400', icon: 'chips' },
  bebidas: { chip: 'bg-sky-500 text-slate-950 border-sky-400', solid: 'bg-sky-400 text-slate-950', accent: 'text-sky-400', icon: 'cup' },
  lácteos: { chip: 'bg-indigo-500 text-white border-indigo-400', solid: 'bg-indigo-400 text-slate-950', accent: 'text-indigo-400', icon: 'milk' },
  lacteos: { chip: 'bg-indigo-500 text-white border-indigo-400', solid: 'bg-indigo-400 text-slate-950', accent: 'text-indigo-400', icon: 'milk' },
  higiene: { chip: 'bg-emerald-500 text-slate-950 border-emerald-400', solid: 'bg-emerald-400 text-slate-950', accent: 'text-emerald-400', icon: 'spray' },
  farmacia: { chip: 'bg-emerald-500 text-slate-950 border-emerald-400', solid: 'bg-emerald-400 text-slate-950', accent: 'text-emerald-400', icon: 'spray' },
  limpieza: { chip: 'bg-cyan-500 text-slate-950 border-cyan-400', solid: 'bg-cyan-400 text-slate-950', accent: 'text-cyan-400', icon: 'spray' },
  panadería: { chip: 'bg-yellow-500 text-slate-950 border-yellow-400', solid: 'bg-yellow-400 text-slate-950', accent: 'text-yellow-400', icon: 'burger' },
  helados: { chip: 'bg-violet-500 text-white border-violet-400', solid: 'bg-violet-400 text-slate-950', accent: 'text-violet-400', icon: 'iceCream' },
  postres: { chip: 'bg-pink-500 text-white border-pink-400', solid: 'bg-pink-400 text-slate-950', accent: 'text-pink-400', icon: 'iceCream' },
  pizza: { chip: 'bg-rose-500 text-white border-rose-400', solid: 'bg-rose-400 text-slate-950', accent: 'text-rose-400', icon: 'pizza' }
};

export const CATEGORY_FALLBACK = { chip: 'bg-teal-600 text-white border-teal-500', solid: 'bg-teal-400 text-slate-950', accent: 'text-teal-400', icon: 'layers' };

export const categoryIdentity = (name) => {
  const key = String(name || '').toLowerCase().trim();
  return CATEGORY_IDENTITY[key] || CATEGORY_FALLBACK;
};

export const SEM_TONES = {
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  rose: 'bg-rose-500/15 text-rose-300 border-rose-500/40'
};
