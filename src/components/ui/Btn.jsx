const Icon = ({ name, className = "w-5 h-5", ...props }) => {
  const icons = {
    check: <path d="M20 6 9 17l-5-5" />,
    alertTriangle: <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3zM12 9v4M12 17h.01" />,
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

const Btn = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  success = false,
  error = false,
  icon,
  children,
  className = '',
  style,
  ...props
}) => {
  const base =
    'relative inline-flex items-center justify-center gap-2 font-bold select-none whitespace-nowrap ' +
    'transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
    'focus-visible:ring-teal-400 focus-visible:ring-offset-slate-900 ' +
    'active:scale-[0.96] active:transition-transform active:duration-75 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ' +
    'aria-disabled:opacity-50 aria-disabled:cursor-not-allowed btn-sink';

  const sizes = {
    sm: 'px-3 py-1.5 rounded-xl text-xs gap-1.5',
    md: 'px-4 py-2.5 rounded-xl text-sm gap-2',
    lg: 'px-5 py-3 rounded-2xl text-sm gap-2',
    xl: 'w-full py-4 rounded-2xl text-sm gap-2'
  };

  const variants = {
    primary:
      'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 animate-btn-glow ' +
      'hover:from-teal-400 hover:to-emerald-400 hover:animate-none hover:shadow-xl hover:shadow-teal-500/30 hover:-translate-y-0.5 ' +
      'active:shadow-md active:shadow-teal-500/20 active:translate-y-0',
    secondary:
      'bg-slate-800/70 border border-slate-600 text-slate-200 shadow-md shadow-slate-900/40 ' +
      'hover:bg-slate-700/80 hover:border-slate-500 hover:-translate-y-0.5 ' +
      'active:shadow-sm',
    tonal:
      'bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 ' +
      'hover:bg-indigo-500/25 hover:border-indigo-500/60 hover:-translate-y-0.5 ' +
      'active:bg-indigo-500/30',
    danger:
      'bg-rose-600/20 border border-rose-500/50 text-rose-300 ' +
      'hover:bg-rose-600/35 hover:border-rose-500/80 hover:-translate-y-0.5 ' +
      'active:bg-rose-600/40',
    ghost: 'bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-white active:bg-slate-800/90'
  };

  const status = error
    ? { classes: '!bg-rose-600 !border-rose-500 text-white shadow-lg shadow-rose-600/30 !from-rose-600 !to-rose-500 animate-none', label: 'Ocurrió un error' }
    : success
      ? { classes: '!bg-emerald-500 !border-emerald-400 text-white shadow-lg shadow-emerald-500/30 !from-emerald-500 !to-emerald-400 animate-none', label: 'Listo' }
      : null;

  const cls = `${base} ${sizes[size] || sizes.md} ${variants[variant] || variants.primary} ${status?.classes || ''} ${className}`.replace(/\s+/g, ' ');

  const content = loading ? (
    <>
      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {children}
    </>
  ) : success ? (
    <>
      <Icon name="check" className="w-4 h-4" />
      {children}
    </>
  ) : error ? (
    <>
      <Icon name="alertTriangle" className="w-4 h-4" />
      {children}
    </>
  ) : (
    <>
      {icon && <Icon name={icon} className="w-4 h-4 shrink-0" />}
      {children}
    </>
  );

  return (
    <button className={cls} style={style} aria-busy={loading ? 'true' : undefined} {...props}>
      {content}
    </button>
  );
};

export default Btn;
