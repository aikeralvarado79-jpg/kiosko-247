import { useState, useRef } from 'react';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    store: <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7M2 7v13a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7M2 7h20M12 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
    bag: <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />,
    shoppingBag: <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />,
    creditCard: <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM2 10h20M6 15h4" />,
    sparkles: <path d="m12 3 1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || null}
    </svg>
  );
};

export default function KioskoOnboarding({ onFinish }) {
  const steps = [
    {
      icon: 'store',
      title: 'Kiosko 24/7',
      subtitle: 'Empresas Alvarados',
      desc: 'Tu kiosko de confianza, siempre abierto. Antojos, bebidas frías, snacks y todo lo que se te antoje.',
      gradient: 'from-teal-600 via-cyan-700 to-slate-950',
      chip: 'bg-teal-500/20 text-teal-300 border-teal-500/30'
    },
    {
      icon: 'bag',
      title: '¿Qué vendemos?',
      subtitle: 'Anímate a explorar',
      desc: 'Refrescos, papas, chichas, dulces, pan, huevos, queso… miles de productos con precios en $ y Bs.',
      gradient: 'from-orange-600 via-amber-700 to-slate-950',
      chip: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    },
    {
      icon: 'shoppingBag',
      title: 'Pedir es fácil',
      subtitle: 'En 3 pasos',
      desc: '① Elige tus productos · ② Confirma tu pedido · ③ Pagas a la entrega o retiras en tienda sin filas.',
      gradient: 'from-indigo-600 via-violet-700 to-slate-950',
      chip: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
    },
    {
      icon: 'creditCard',
      title: 'Paga como quieras',
      subtitle: 'Efectivo o digital',
      desc: 'Pago móvil, transferencia, cartera de saldo e incluso a crédito si eres beneficiado. A domicilio o retiro.',
      gradient: 'from-emerald-600 via-teal-700 to-slate-950',
      chip: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    }
  ];
  const [idx, setIdx] = useState(0);
  const touchX = useRef(null);

  const go = (next) => {
    if (next === idx) return;
    setIdx(next);
  };

  const s = steps[Math.min(Math.max(idx, 0), steps.length - 1)];

  return (
    <div
      className="fixed inset-0 z-[95] flex flex-col overflow-hidden select-none touch-manipulation"
      role="dialog"
      aria-label="Bienvenida al Kiosko 24/7"
      onTouchStart={(e) => (touchX.current = e.touches?.[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const delta = (e.changedTouches?.[0]?.clientX ?? 0) - touchX.current;
        if (Math.abs(delta) > 45) go(Math.max(0, Math.min(steps.length - 1, idx + (delta < 0 ? 1 : -1))));
        touchX.current = null;
      }}
    >
      {/* Fondo con gradiente animado */}
      <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient}`} />
      <div className="absolute inset-0 onboard-bg-drift opacity-40 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.25),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(45,212,191,0.3),transparent_45%)]" />

      {/* Contenido de la pantalla actual */}
      <div key={idx} className="relative flex-1 flex flex-col items-center justify-center px-8 text-center onboard-slide-in">
        <div className="onboard-float w-24 h-24 sm:w-32 sm:h-32 mb-8 rounded-[2rem] bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-2xl shadow-black/30">
          <Icon name={s.icon} className="w-12 h-12 sm:w-16 sm:h-16 text-white" />
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${s.chip} backdrop-blur-md mb-4 onboard-pop`}>
          <Icon name="sparkles" className="w-3 h-3" /> {s.subtitle}
        </span>
        <h2 className="font-display text-3xl sm:text-5xl font-black text-white leading-tight mb-3 onboard-pop" style={{ animationDelay: '0.08s' }}>
          {s.title}
        </h2>
        <p className="text-sm sm:text-base text-white/80 max-w-md leading-relaxed onboard-pop" style={{ animationDelay: '0.16s' }}>
          {s.desc}
        </p>
      </div>

      {/* Indicadores de punto + navegación */}
      <div className="relative pb-10 px-6 flex flex-col items-center gap-5">
        <div className="flex items-center gap-2">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              aria-label={`Paso ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === idx ? 'w-7 bg-white' : 'w-2 bg-white/30'}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-3 w-full max-w-sm">
          {idx > 0 && (
            <button
              onClick={() => go(idx - 1)}
              className="px-4 py-3 rounded-2xl bg-white/10 border border-white/15 text-white text-sm font-semibold backdrop-blur-md active:scale-95 transition-all"
            >
              Atrás
            </button>
          )}
          <button
            onClick={() => (idx < steps.length - 1 ? go(idx + 1) : onFinish())}
            className={`flex-1 py-3 rounded-2xl bg-white text-slate-950 text-sm font-black shadow-xl shadow-black/20 active:scale-95 transition-all ${idx < steps.length - 1 ? '' : 'showcase-pulse-cta'}`}
          >
            {idx < steps.length - 1 ? 'Siguiente' : 'Entrar al kiosko'}
          </button>
        </div>
      </div>
    </div>
  );
}
