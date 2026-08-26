const BrandLogo = ({ className = 'w-9 h-9' }) => (
  <span
    className={`inline-flex items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-500 via-emerald-500 to-cyan-400 shadow-lg shadow-teal-500/25 ring-2 ring-white/15 shrink-0 select-none ${className}`}
    aria-hidden="true"
  >
    <svg viewBox="0 0 24 24" className="w-[66%] h-[66%] fill-slate-950" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 3h2.5l2.4 12.2a2 2 0 0 0 1.98 1.62h9.8a2 2 0 0 0 1.97-1.6L22 7H5.6M9 20a1.4 1.4 0 1 0 0-2.8A1.4 1.4 0 0 0 9 20zM17 20a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8z" />
    </svg>
  </span>
);

export default BrandLogo;
