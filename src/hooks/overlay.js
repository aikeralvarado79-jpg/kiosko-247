import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../utils/nav.js';

// Overlay layer system: manages stacked overlays with Android back button,
// ESC key, and body scroll locking. Each overlay gets a history entry.
let overlayLayers = new Set();
let overlayCount = 0;
let scrollLocks = 0;
let programmaticBack = false;
let lastCloseViaBack = false;

const closeTopOverlay = () => {
  const top = [...overlayLayers].pop();
  if (top) top();
};

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (programmaticBack) {
      programmaticBack = false;
      return;
    }
    lastCloseViaBack = true;
    closeTopOverlay();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeTopOverlay();
  });
}

export const lockBodyScroll = () => {
  scrollLocks += 1;
  document.body.style.overflow = 'hidden';
  document.body.style.overscrollBehaviorY = 'none';
};

export const unlockBodyScroll = () => {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) {
    document.body.style.overflow = '';
    document.body.style.overscrollBehaviorY = '';
  }
};

export const useOverlay = (active, onClose) => {
  const cbRef = useRef(onClose);
  cbRef.current = onClose;

  useEffect(() => {
    if (!active) return undefined;
    const handler = () => cbRef.current();
    overlayLayers.add(handler);
    overlayCount += 1;
    window.history.pushState({ __kioskoOverlay: overlayCount }, '');
    lockBodyScroll();
    return () => {
      overlayLayers.delete(handler);
      unlockBodyScroll();
      if (overlayCount <= 0) return;
      overlayCount -= 1;
      const closedViaBack = lastCloseViaBack;
      lastCloseViaBack = false;
      const state = window.history.state;
      if (!closedViaBack && state && state.__kioskoOverlay) {
        programmaticBack = true;
        window.history.back();
      }
    };
  }, [active]);
};

// Animated exit: adds overlay-exit class then fires callback after 150ms.
// Respects prefers-reduced-motion.
export const exitThen = (ref, cb) => () => {
  const el = ref?.current;
  if (!el || prefersReducedMotion()) return cb();
  el.classList.add('overlay-exit');
  setTimeout(cb, 150);
};
