import { useRef, useEffect } from 'react';
import { haptic } from '../utils/haptics.js';

export default function useSwipeToClose(onClose, enabled = true, { detents = false } = {}) {
  const sheetRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const el = sheetRef.current;
    if (!el || !enabled) return undefined;
    let match;
    try { match = window.matchMedia('(min-width: 640px)'); } catch { match = null; }
    if (match && match.matches) return undefined;

    let startX = 0;
    let startY = 0;
    let dy = 0;
    let tracking = false;
    let locked = false;
    let growing = false;
    let baseH = 0;
    let scrollEl = null;
    let closeTimer = null;

    const onStart = (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      const t = e.target;
      if (t && t.closest && t.closest('button, a, input, textarea, select, [data-no-swipe]')) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dy = 0;
      locked = false;
      growing = false;
      baseH = 0;
      tracking = true;
      scrollEl = t && t.closest ? t.closest('[data-sheet-scroll]') : null;
    };

    const onMove = (e) => {
      if (!tracking || !e.touches || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - startX;
      const ddy = e.touches[0].clientY - startY;
      if (!locked && !growing) {
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(ddy)) { tracking = false; return; }
        if (detents && ddy < -22 && (!scrollEl || scrollEl.scrollTop <= 2)) {
          growing = true;
          baseH = el.offsetHeight;
          el.style.transition = 'none';
          el.style.animation = 'none';
          haptic(8);
        } else if (ddy > 10) {
          if (scrollEl && scrollEl.scrollTop > 2) { tracking = false; return; }
          locked = true;
          el.style.transition = 'none';
          el.style.animation = 'none';
        } else {
          return;
        }
      }
      if (growing) {
        const target = Math.min(
          window.innerHeight * 0.94,
          Math.max(baseH, baseH + (-ddy))
        );
        el.style.height = `${target}px`;
        if (e.cancelable) e.preventDefault();
        return;
      }
      dy = Math.max(0, ddy);
      el.style.transform = `translateY(${dy}px)`;
      if (dy > 8) e.preventDefault();
    };

    const onEnd = () => {
      if (!tracking) return;
      tracking = false;
      if (growing) {
        growing = false;
        const grownPx = parseFloat(el.style.height) || baseH;
        el.style.transition = 'height 0.3s cubic-bezier(0.22, 1, 0.36, 1)';
        if (grownPx > baseH * 1.08) {
          el.style.height = `${Math.round(window.innerHeight * 0.92)}px`;
          haptic('tap');
        } else {
          el.style.height = '';
        }
        baseH = 0;
        return;
      }
      if (!locked) return;
      locked = false;
      el.style.transition = 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)';
      if (dy > 110) {
        el.style.transform = 'translateY(105%)';
        haptic(10);
        closeTimer = setTimeout(() => onCloseRef.current(), 200);
      } else {
        dy = 0;
        el.style.transform = '';
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      clearTimeout(closeTimer);
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled, detents]);

  return sheetRef;
}
