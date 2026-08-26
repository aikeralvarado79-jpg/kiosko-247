import { flushSync } from 'react-dom';

export const VIEW_AXIS = {
  customer: ['store', 'calc', 'cart', 'orders', 'account'],
  admin: ['inventory', 'ventas', 'orders', 'benefited', 'blacklist', 'abonos', 'analytics', 'profile']
};

export const tabDirection = (axisKey, prevTab, nextTab) => {
  const axis = VIEW_AXIS[axisKey] || [];
  const a = axis.indexOf(prevTab);
  const b = axis.indexOf(nextTab);
  if (a < 0 || b < 0 || a === b) return 'forward';
  return b > a ? 'forward' : 'back';
};

export const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

export const withViewTransition = (update, dir = 'forward') => {
  try {
    if (!prefersReducedMotion() && typeof document !== 'undefined' && typeof document.startViewTransition === 'function') {
      try { document.documentElement.dataset.vtDir = dir === 'back' ? 'back' : 'forward'; } catch {}
      document.startViewTransition(() => { flushSync(update); });
      return;
    }
  } catch {}
  update();
};
