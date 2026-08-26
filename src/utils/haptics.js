import { sfx, hapticTicks } from '../experience';

export const playChime = () => sfx.success();

export const HAPTIC_LANG = {
  tap: 12,
  added: [12, 30, 12],
  success: [15, 40, 15],
  warn: [30, 50, 30],
  deliver: [16, 45, 16],
  error: [40, 60, 40]
};

export const haptic = (pattern = 12) => {
  const seq = typeof pattern === 'string' ? (HAPTIC_LANG[pattern] ?? 12) : pattern;
  try {
    if (navigator.vibrate) { navigator.vibrate(seq); return; }
  } catch {}
  try {
    if (window.matchMedia('(pointer: coarse)').matches) hapticTicks(seq);
  } catch {}
};

export const CELEBRATE_EVENT = 'kiosko:celebrate';
export const celebrate = () => {
  try { window.dispatchEvent(new CustomEvent(CELEBRATE_EVENT)); } catch {}
};

const inflightActions = new Set();
export const withInflightGuard = (key, fn) => {
  if (inflightActions.has(key)) return Promise.resolve(false);
  inflightActions.add(key);
  let p;
  try { p = Promise.resolve(fn()); } catch (err) { inflightActions.delete(key); throw err; }
  return p.finally(() => inflightActions.delete(key));
};
