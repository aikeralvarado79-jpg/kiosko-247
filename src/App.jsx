import { useState, useEffect, useMemo, useCallback, useRef, Component, Fragment } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { startRegistration, startAuthentication, browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser';
import { api, getToken, setToken, clearToken, setRememberSession, getRememberSession, outbox } from './api.js';
import { sfx, isSoundOn, setSoundOn, hapticTicks, distanceMeters, dominantColorFromUrl } from './experience.js';
import { ADMIN_PHONES } from './data.js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BrowserMultiFormatReader } from '@zxing/browser';
import LoadingScreen from './components/LoadingScreen.jsx';

// ---------------------------------------------------------------------------
// Mecanismo compartido de overlay: bloquea el scroll del body mientras hay una
// capa abierta, cierra la capa superior con el botón "atrás" de Android
// (history.popstate) y con la tecla ESC. Soporta capas apiladas (carrito →
// checkout → detalle, etc.) manteniendo una entrada de historial por capa.
// ---------------------------------------------------------------------------
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

const lockBodyScroll = () => {
  scrollLocks += 1;
  document.body.style.overflow = 'hidden';
  document.body.style.overscrollBehaviorY = 'none';
};

const unlockBodyScroll = () => {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) {
    document.body.style.overflow = '';
    document.body.style.overscrollBehaviorY = '';
  }
};

const useOverlay = (active, onClose) => {
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

// SVG Icons Helper Components for full visual depth without external dependencies
const Icon = ({ name, className = "w-5 h-5", ...props }) => {
  const icons = {
    store: <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7M2 7v13a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7M2 7h20M12 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
    shoppingBag: <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />,
    search: <path d="m21 21-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    trash: <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />,
    edit: <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    check: <path d="M20 6 9 17l-5-5" />,
    bell: <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />,
    package: <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />,
    alertTriangle: <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3zM12 9v4M12 17h.01" />,
    trendingUp: <path d="m22 7-8.5 8.5-5-5L1 18M16 7h6v6" />,
    user: <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
    userPlus: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6" />,
    users: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
    creditCard: <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM2 10h20M6 15h4" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
    chevronLeft: <path d="m15 18-6-6 6-6" />,
    chevronUp: <path d="m18 15-6-6-6 6" />,
    chevronDown: <path d="m6 9 6 6 6-6" />,
    maximize: <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />,
    minimize: <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />,
    phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />,
    mapPin: <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0zM12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />,
    pin: <path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z" />,
    clock: <path d="M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />,
    lock: <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 8v8M8 8h8" />,
    filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
    eye: <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
    eyeOff: <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12A3 3 0 1 1 9.88 9.88M1 1l22 22" /></>,
    dollarSign: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
    layers: <path d="m12 2 10 5-10 5L2 7zm0 10 10 5-10 5-10-5zm0 10 10 5-10 5-10-5z" />,
    refresh: <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />,
    sparkles: <path d="m12 3 1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />,
    upload: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />,
    sun: <path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />,
    moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
    whatsapp: <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />,
    arrowRight: <path d="M5 12h14M12 5l7 7-7 7" />,
    externalLink: <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />,
    image: <path d="M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21" />,
     xCircle: <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM15 9l-6 6M9 9l6 6" />,
     checkCircle: <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9 12l2 2 4-4" />,
     info: <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-6M12 8h.01" />,
     key: <path d="M12 2a9.92 9.92 0 0 0-7 2.82L2.82 7.01a1 1 0 0 0 0 1.42l2.59 2.59a1 1 0 0 0 1.42 0L12 5.34l6.17 6.17a1 1 0 0 0 1.42 0l2.59-2.59a1 1 0 0 0 0-1.42L13 4.83c-.35-.35-.5-.83-.5-1.31A5.5 5.5 0 0 0 12 2z" />,
     fingerprint: <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4M14 13.12c0 2.38 0 6.38-1 8.88M17.29 21.02c.12-.6.43-2.3.5-3.02M2 12a10 10 0 0 1 18-6M2 16h.01M21.8 16c.2-2 .131-5.354 0-6M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2M8.65 22c.21-.66.45-1.32.57-2M9 6.8a6 6 0 0 1 9 5.2v2" />,
     heart: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" />,
     heartFilled: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" fill="currentColor" stroke="none" />,
      home: <path d="M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" />,
      logOut: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
     list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
     settings: <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
     zap: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
     bag: <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />,
     apple: <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.58,7.86 7.09,6.91 8.65,6.88C9.94,6.86 11.17,7.68 12.06,7.68C12.96,7.68 14.42,6.74 15.95,6.88C16.57,6.91 18.23,7.09 19.3,8.68C19.2,8.74 16.79,10.05 16.83,12.9C16.88,16.24 19.88,17.37 19.92,17.39C19.88,17.47 19.25,19.11 18.71,19.5ZM13.3,5.41C13.98,4.57 14.46,3.4 14.32,2.21C13.28,2.26 12.05,2.88 11.34,3.72C10.7,4.48 10.13,5.65 10.28,6.83C11.44,6.94 12.62,6.26 13.3,5.41Z" fill="currentColor" stroke="none" />,
      faceId: (
       <>
         <path d="M3 7V5a2 2 0 0 1 2-2h2" />
         <path d="M17 3h2a2 2 0 0 1 2 2v2" />
         <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
         <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
         <path d="M8 14s1.5 2 4 2 4-2 4-2" />
         <path d="M9 9h.01" />
         <path d="M15 9h.01" />
       </>
      ),
      mic: <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8" />,
      volumeX: <><path d="M11 5 6 9H2v6h4l5 4z" /><path d="m23 9-6 6" /><path d="m17 9 6 6" /></>,
      wifiOff: <><path d="m2 2 20 20" /><path d="M8.5 16.5a5 5 0 0 1 7 0" /><path d="M5 12.86a10 10 0 0 1 2.17-1.51" /><path d="M19 12.86a10 10 0 0 0-3.34-2.07" /><path d="M2 8.82A15 15 0 0 1 6.18 6.18" /><path d="M22 8.82a15 15 0 0 0-11.29-3.76c-.9.06-1.79.19-2.65.38" /><circle cx="12" cy="20" r="0.75" fill="currentColor" /></>,
      volume2: <path d="M11 5 6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6" />,
      share2: <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />,
      barChart: <path d="M18 20V10M12 20V4M6 20v-6" />,
      star: <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />,
      wallet: <path d="M21 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2M21 12h-5a2 2 0 0 0 0 4h5a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1z" />,
      cash: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></>,
      bank: <path d="M3 21h18M2 9l10-6 10 6H2zM6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 3v3" />,
      smartphone: <><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></>,
      type: <path d="M4 7V4h16v3M9 20h6M12 4v16" />,
      contrast: <><circle cx="12" cy="12" r="9" /><path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor" stroke="none" /></>,
      scan: <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />,
      cube: <path d="m21 16-9 5-9-5V8l9-5 9 5v8zM3 8l9 5 9-5M12 13v8" />,
      chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
      headphones: <path d="M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />,
      gift: <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />,
      camera: <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" />,
      navigation: <path d="M3 11 22 2l-9 19-2-8-8-2z" />,
      download: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />,
      radio: <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4M16.2 7.8c2.3 2.3 2.3 6.1 0 8.4M19.1 4.9C23 8.8 23 15.2 19.1 19.1M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
      percent: <path d="M19 5 5 19M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM17.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />,
      burger: <path d="M3 11h18a9 9 0 0 0-18 0zM3 15h18M7 11l.01.01M12 11l.01.01M17 11l.01.01M5 19c0 1.1.9 2 2 2h10a2 2 0 0 0 2-2M6 15a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2" />,
      cup: <path d="M8 2v3M16 2v3M3 5h18M4 8h16l-1.5 12a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2L4 8zM7 14a5 5 0 0 0 10 0" />,
      milk: <path d="M8 2h8v3l-1.5 2V21a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V7L8 5V2zM10 10h4M10 14h4M10 18h4" />,
      candy: <path d="M7.5 6.5 4 4l2.5-2.5C7.5 2.5 7.5 5 7.5 6.5zM12.5 17.5 16 20l-2.5 2.5c-1-1-1-3.5-1-5zM6 6l12 12c1.5-1.5 1-4 0-6.5-2.5-1-5-1.5-6.5 0L6 6zM16 20 8 12M4 4l8 8" />,
      spray: <path d="M9 4h6a2 2 0 0 1 2 2v2M9 4a2 2 0 0 0-2 2v2m2-4h6M7 8h10v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8zM17 6l3-3M14 6l1-1" />,
      chips: <path d="M6 21h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2zM2 9h2M2 15h2M20 9h2M20 15h2M12 7v10" />,
      pizza: <path d="M12 2 4 7l8 15 8-15-8-5zM12 2v5M4 7h16M9 7l3 6 3-6M12 13v9" />,
      iceCream: <path d="M12 2a5 5 0 0 1 5 5c0 1.5-.5 2.5-1 3.5h-8C7.5 9.5 7 8.5 7 7a5 5 0 0 1 5-5zM8 11h8l-2.5 10a2 2 0 0 1-3 0L8 11z" />,
      calculator: <path d="M4 2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM6 6h12M9.5 13.5v6M6.5 16.5h6M17 12.5v5M14.75 15h4.5" />,
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

// Logo de marca: carrito de compras de kiosko (venta y entrega) sobre un sello
// redondeado con gradiente propio (no depende del tema) para que el logo se
// reconozca igual en modo claro y oscuro.
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

// Reveal on scroll: aplica reveal-on-scroll al envolver un bloque y activa la
// clase is-revealed cuando entra al viewport. Respeto total a prefers-reduced-motion.
const RevealOnScroll = ({ children, className = '', delay = 0, as: Tag = 'div', ...props }) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setVisible(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -36px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal-on-scroll ${visible ? 'is-revealed' : ''} ${className}`.trim()}
      style={{ '--reveal-delay': `${delay}ms`, ...props.style }}
      {...props}
    >
      {children}
    </Tag>
  );
};

// Precio con count-up: anima el número del valor anterior al nuevo en ~0.5s.
// Sin animación si el usuario prefiere reducir el movimiento del sistema.
const useCountUp = (value, duration = 500) => {
  const [display, setDisplay] = useState(value);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    const prev = display;
    if (Number(display) === Number(value)) return undefined;
    let raf = 0;
    const start = performance.now();
    const from = Number(prev) || 0;
    const to = Number(value) || 0;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(step);
      else setAnimKey((k) => k + 1);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return { display, animKey };
};

// Precio con count-up listo para usarse junto a los helpers formatUsd/formatBs.
const PriceCountUp = ({ value, rate, className = '', bsClass = '', donate = false }) => {
  const { display, animKey } = useCountUp(value);
  return (
    <div className={`animate-price-pop ${className}`} key={`pc-${animKey}`}>
      <span className="block">{formatUsd(display)}</span>
      {rate?.rate > 0 && (
        <span className={`block mt-0.5 truncate ${bsClass}`}>
          {formatBs(usdToBs(display, rate.rate))}
        </span>
      )}
      {donate && (
        <span className="block text-[9px] text-slate-500 uppercase tracking-wide mt-0.5">
          precio actualizado
        </span>
      )}
    </div>
  );
};

// Botón reusable con feedback visual completo: hover (lift + glow), press
// (scale + sombra hundida), focus-visible ring, estados de carga (spinner),
// éxito (check) y error. Variantes: primary | secondary | tonal | danger | ghost.
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

// Detección de plataforma para elegir el logo de biometría correcto:
// iOS → manzana de Apple + Face ID; Android/otros → huella dactilar.
const IS_IOS =
  /iPad|iPhone|iPod/.test(typeof navigator !== 'undefined' ? navigator.userAgent : '') ||
  (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const IS_ANDROID =
  typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');

// Nombre del método biométrico según plataforma para textos al usuario:
// iOS → Face ID; otros → huella (o biometría genérica cuando no hay sensor).
const BIO_METHOD_LABEL = IS_IOS ? 'Face ID' : IS_ANDROID ? 'huella' : 'biometría';

// ¿La app ya está instalada y abierta como app (fuera del navegador)?
const isInstalledPWA = () =>
  (typeof navigator !== 'undefined' && navigator.standalone) ||
  (typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches);

// ¿El dispositivo tiene biometría REAL (huella/Face ID)? platformAuthenticatorIsAvailable()
// también devuelve true en escritorios con Windows Hello por PIN o passcode de iCloud,
// donde NO existe Face ID ni sensor de huella. Para no ofrecer "Entrar con biometría"
// en equipos sin soporte, exigimos además que sea un dispositivo móvil o táctil.
const hasRealBiometrics = async () => {
  if (typeof navigator === 'undefined' || !browserSupportsWebAuthn()) return false;
  let platformOk = false;
  try {
    platformOk = await platformAuthenticatorIsAvailable();
  } catch {
    platformOk = false;
  }
  if (!platformOk) return false;
  return (
    navigator.maxTouchPoints > 0 ||
    'ontouchstart' in window ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
  );
};

const formatTimestamp = (date = new Date()) =>
  date.toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// Tiempo relativo en español ("hace 3 min", "hace 2 h"), para sesiones activas.
const formatRelative = (ts) => {
  if (!ts) return 'ahora';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 1000));
  if (seconds < 60) return 'hace segundos';
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)} h`;
  return `hace ${Math.floor(seconds / 86400)} d`;
};

const formatSize = (product) => {
  if (!product || product.sizeValue === undefined || product.sizeValue === null || product.sizeValue === '') return '';
  const num = Number(product.sizeValue);
  const formatted = Number.isInteger(num) ? String(num) : num.toLocaleString('es-AR');
  return `${formatted}${product.sizeUnit || ''}`;
};

const formatUsd = (n) => `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Formatea un número como monto con separador de miles (.) y decimales (,),
// ej: 1100 → "1.100,00". Se usa en la calculadora del header.
const formatAmount = (n, decimals = 2) =>
  Number.isFinite(n) ? n.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '';

// Convierte un texto de monto (con formato es-VE "1.100,00" o simple "1000.00")
// a número, tolerando ambos estilos de separadores.
const parseAmount = (value) => {
  const s = String(value || '').replace(/[^\d.,]/g, '').trim();
  if (!s) return NaN;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  if (hasComma && !hasDot) return parseFloat(s.replace(',', '.'));
  if (!hasComma && hasDot) {
    // Formato es-VE: el punto agrupa miles ("1.200" = 1200), la coma separa
    // decimales. Si la última parte tiene 3 dígitos, se trata de miles.
    const parts = s.split('.');
    const last = parts[parts.length - 1];
    if (parts.length > 1 && last.length === 3) return parseFloat(s.replace(/\./g, ''));
    return parseFloat(s);
  }
  return parseFloat(s);
};

const formatBs = (n) => `Bs ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Formatea bolívares mientras se escribe: agrega separadores de miles (.) y deja
// que el usuario agregue la coma para decimales. Ej: "1200" -> "1.200", "12000" -> "12.000".
const formatAmountBsInput = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return '';
  const cleaned = s.replace(/[^\d.,]/g, '');
  const commaIdx = cleaned.indexOf(',');
  const intPart = (commaIdx === -1 ? cleaned : cleaned.slice(0, commaIdx)).replace(/\D/g, '');
  const decPart = commaIdx === -1 ? '' : cleaned.slice(commaIdx + 1).replace(/\D/g, '').slice(0, 2);
  const formattedInt = intPart ? Number(intPart).toLocaleString('es-VE') : '';
  if (commaIdx === -1) return formattedInt;
  return decPart ? `${formattedInt},${decPart}` : `${formattedInt},`;
};

const usdToBs = (usd, rate) => Number(usd || 0) * (rate || 0);

const PHONE_CODES = ['0412', '0414', '0416', '0422', '0424', '0426'];

const CUSTOMER_KEY = 'kiosko_customer';

// Preferencias del tutorial de instalación PWA. Dismissed se respeta solo
// durante la sesión (se limpia al cerrar sesión); Done marca que el dispositivo
// ya instaló la app y no se vuelve a preguntar nunca.
const INSTALL_DISMISS_KEY = 'kiosko_install_dismissed';
const INSTALL_DONE_KEY = 'kiosko_install_done';

// Memoria de login ("Recordarme"): conserva los campos de identificación para
// que el siguiente login los pre-cargue sin vaciarlos.
const LOGIN_MEMORY_KEY = 'kiosko_login_memory';
const loadLoginMemory = () => {
  try {
    const raw = localStorage.getItem(LOGIN_MEMORY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const saveLoginMemory = (data) => {
  try {
    localStorage.setItem(LOGIN_MEMORY_KEY, JSON.stringify(data));
  } catch {}
};
const clearLoginMemory = () => {
  try {
    localStorage.removeItem(LOGIN_MEMORY_KEY);
  } catch {}
};

// Parse fecha de pedido: prioriza createdAt (ISO), fallback timestamp "DD/MM, HH:MM" asumiendo año actual.
const parseOrderDate = (o) => {
  if (o.createdAt) { const d = new Date(o.createdAt); if (!isNaN(d)) return d; }
  const m = String(o.timestamp || '').match(/^(\d{1,2})\/(\d{1,2})[,]?\s*(\d{1,2}):(\d{2})/);
  if (!m) return new Date(NaN);
  const year = new Date().getFullYear();
  return new Date(year, Number(m[2]) - 1, Number(m[1]), Number(m[3]), Number(m[4]));
};

const toYMD = (d) => isNaN(d) ? '' : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Distancia en km entre dos puntos (fórmula de Haversine). Se usa para armar la
// ruta del día de entregas ordenando los destinos por cercanía.
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

// Productos "nuevos": creados en las últimas 4 horas. Se considera la fecha del
// dispositivo del cliente como referencia razonable para la app.
const NEW_PRODUCT_HOURS = 4;
const isNewProduct = (product) => {
  if (!product || !product.createdAt) return false;
  const created = new Date(product.createdAt);
  if (isNaN(created)) return false;
  return Date.now() - created.getTime() <= NEW_PRODUCT_HOURS * 3600 * 1000;
};

// Marca productos vistos (la etiqueta NUEVO desaparece al hacer click).
const NEW_VIEWED_KEY = 'kiosko_new_product_views';
const loadNewProductViews = () => {
  try { return JSON.parse(localStorage.getItem(NEW_VIEWED_KEY)) || []; } catch { return []; }
};
const markNewProductViewed = (id) => {
  try {
    const list = loadNewProductViews();
    if (!list.includes(id)) localStorage.setItem(NEW_VIEWED_KEY, JSON.stringify([...list, id]));
  } catch {}
};
const wasNewProductViewed = (id) => loadNewProductViews().includes(id);

// Convierte la clave VAPID (base64url) al ArrayBuffer que exige el navegador.
const urlBase64ToUint8Array = (base64) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
};

// Suscribe el dispositivo a Web Push usando la clave VAPID del servidor.
const subscribeToPush = async (phone) => {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return false;
    }
    const reg = await navigator.serviceWorker.ready;
    if (!reg.pushManager) return false;
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      const keyRes = await api.getVapidKey();
      if (!keyRes.ok || !keyRes.data?.publicKey) return false;
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyRes.data.publicKey)
      });
    }
    const key = String(phone || '').replace(/\D/g, '').slice(-11);
    if (!key || key.length < 7) return false;
    await api.subscribePush(key, {
      endpoint: subscription.endpoint,
      keys: subscription.toJSON().keys
    });
    return true;
  } catch {
    return false;
  }
};

// Mini calendario compacto (popover) para filtro de fecha
function MiniCalendar({ value, onChange, onClose }) {
  const [month, setMonth] = useState(new Date());
  const today = new Date();
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Lun=0
  const daysInMonth = new Date(month.getFullYear(), month.getMonth()+1, 0).getDate();
  const prevMonthDays = new Date(month.getFullYear(), month.getMonth(), 0).getDate();
  const weeks = [];
  for (let i = 0; i < 6; i++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const idx = i * 7 + d - startOffset;
      if (idx < 0) week.push({ day: prevMonthDays + idx + 1, muted: true, date: null });
      else if (idx >= daysInMonth) week.push({ day: idx - daysInMonth + 1, muted: true, date: null });
      else {
        const date = new Date(month.getFullYear(), month.getMonth(), idx + 1);
        week.push({ day: idx + 1, muted: false, date });
      }
    }
    weeks.push(week);
  }
  const isSelected = (date) => value && date && toYMD(date) === value;
  const isToday = (date) => date && toYMD(date) === toYMD(today);
  return (
    <div className="glass-strong bg-slate-900 border border-slate-700 rounded-2xl p-4 w-64 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()-1, 1))} className="p-1 text-slate-400 hover:text-white"><Icon name="minus" className="w-4 h-4" /></button>
        <span className="font-semibold text-white text-sm">{monthNames[month.getMonth()]} {month.getFullYear()}</span>
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()+1, 1))} className="p-1 text-slate-400 hover:text-white"><Icon name="plus" className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-[11px] mb-3">
        {['Lu','Ma','Mi','Ju','Vi','Sá','Do'].map(d => <div key={d} className="text-center text-slate-500 font-semibold">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {weeks.map((week, wi) => week.map(({ day, muted, date }, di) => (
          <button key={`${wi}-${di}`} onClick={() => date && (onChange(toYMD(date)), onClose())} className={`w-8 h-8 rounded-xl text-[11px] font-medium transition-all ${
            muted ? 'text-slate-600 hover:bg-slate-800' : 'text-slate-100 hover:bg-slate-800'
          } ${isSelected(date) ? 'bg-teal-500 text-white' : ''} ${isToday(date) && !isSelected(date) ? 'ring-2 ring-teal-500' : ''}`}>
            {day}
          </button>
        )))}
      </div>
      <div className="flex items-center justify-center gap-2 mt-3 pt-2 border-t border-slate-800">
        <button onClick={() => { onChange(toYMD(today)); onClose(); }} className="px-3 py-1.5 text-[11px] font-semibold text-teal-300 hover:text-teal-200">Hoy</button>
        <button onClick={onClose} className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-200">Cerrar</button>
      </div>
    </div>
  );
}

const normalizePhoneDigits = (phone) => String(phone || '').replace(/\D/g, '').slice(-11);

const parsePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  const num = digits.length >= 11 ? digits.slice(-11) : digits;
  if (num.length < 7) return { code: '', number: '' };
  return { code: num.slice(0, 4), number: num.slice(-7) };
};

// Redimensiona y comprime una imagen (p. ej. comprobante de pago) a un data URL
// liviano para que quepa en los límites del servidor, sin perder legibilidad.
const compressImage = (file, maxDimension = 1280, quality = 0.72) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagen inválida'));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const out = canvas.toDataURL('image/jpeg', quality);
        resolve(out);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

const loadSavedCustomer = () => {
  try {
    const raw = localStorage.getItem(CUSTOMER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveCustomerData = (data) => {
  try {
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(data));
  } catch {}
};

// Construye el registro de clientes conocidos a partir del historial de pedidos
// (último pedido gana por teléfono). Falla back a los datos locales del cliente.
const buildKnownCustomers = (orders, saved) => {
  const map = new Map();
  for (const o of orders) {
    const digits = normalizePhoneDigits(o.phone);
    if (!digits || map.has(digits)) continue;
    const { code, number } = parsePhone(o.phone);
    map.set(digits, { name: o.customerName || '', code, number, address: o.address || '', phone: o.phone });
  }
  if (saved && saved.phoneNumber) {
    const key = `${saved.phoneCode || ''}${saved.phoneNumber || ''}`.replace(/\D/g, '').slice(-11);
    if (key && !map.has(key)) {
      map.set(key, {
        name: saved.customerName || '',
        code: saved.phoneCode || '',
        number: saved.phoneNumber || '',
        address: saved.address || '',
        phone: `${saved.phoneCode || ''} ${saved.phoneNumber || ''}`.trim()
      });
    }
  }
  return Array.from(map.values());
};

const formatPhoneWhatsApp = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('58')) return digits;
  if (digits.startsWith('0')) return '58' + digits.slice(1);
  return '58' + digits;
};

const STATUS_STYLES = {
  pendiente: { badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40', ring: 'border-amber-500/50', dot: 'bg-amber-400' },
  en_preparacion: { badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40', ring: 'border-cyan-500/50', dot: 'bg-cyan-400' },
  listo: { badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', ring: 'border-emerald-500/50', dot: 'bg-emerald-400' },
  en_camino: { badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40', ring: 'border-sky-500/50', dot: 'bg-sky-400' },
  entregado: { badge: 'bg-slate-500/20 text-slate-300 border-slate-500/40', ring: 'border-slate-500/50', dot: 'bg-slate-400' },
  cancelado: { badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40', ring: 'border-rose-500/50', dot: 'bg-rose-400' }
};

// Colores del semáforo de espera según la antigüedad del pedido.
const SEM_TONES = {
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  rose: 'bg-rose-500/15 text-rose-300 border-rose-500/40'
};

// Identidad visual por categoría: cada categoría tiene su color (chip sólido y
// oscuro para legibilidad sobre cualquier imagen), su tono sólido (estado
// activo en los filtros) y su icono. El fallback genérico cubre categorías
// nuevas sin necesidad de editar el código.
const CATEGORY_IDENTITY = {
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
const CATEGORY_FALLBACK = { chip: 'bg-teal-600 text-white border-teal-500', solid: 'bg-teal-400 text-slate-950', accent: 'text-teal-400', icon: 'layers' };
const categoryIdentity = (name) => {
  const key = String(name || '').toLowerCase().trim();
  return CATEGORY_IDENTITY[key] || CATEGORY_FALLBACK;
};

// Chime clásico de la marca = arpegio de éxito del paquete de sonido.
const playChime = () => sfx.success();

// Lenguaje táctil (#18): cada momento tiene su patrón. En iOS (sin
// navigator.vibrate) el patrón se traduce a ráfagas de ticks de audio.
const HAPTIC_LANG = {
  tap: 12,
  added: [12, 30, 12],
  success: [15, 40, 15],
  warn: [30, 50, 30],
  deliver: [16, 45, 16],
  error: [40, 60, 40]
};

// Vibración sutil en dispositivos móviles; en iPhone usa ticks sonoros
// cortos como sustituto háptico.
const haptic = (pattern = 12) => {
  const seq = typeof pattern === 'string' ? (HAPTIC_LANG[pattern] ?? 12) : pattern;
  try {
    if (navigator.vibrate) {
      navigator.vibrate(seq);
      return;
    }
  } catch {}
  try {
    if (window.matchMedia('(pointer: coarse)').matches) hapticTicks(seq);
  } catch {}
};

// ------------------------------------------------------------------
//  Celebración breve del panel: evento global + capa de confeti.
//  Se dispara al entregar un pedido o registrar una venta de mostrador.
// ------------------------------------------------------------------
const CELEBRATE_EVENT = 'kiosko:celebrate';
const celebrate = () => {
  try { window.dispatchEvent(new CustomEvent(CELEBRATE_EVENT)); } catch {}
};

// Bloqueo anti-doble-disparo: mientras una acción con la misma clave está en
// vuelo, los clics repetidos se ignoran. Evita toasts y efectos duplicados
// aunque el botón no quede deshabilitado (doble click, Enter sostenido, etc.).
const inflightActions = new Set();
const withInflightGuard = (key, fn) => {
  if (inflightActions.has(key)) return Promise.resolve(false);
  inflightActions.add(key);
  let p;
  try {
    p = Promise.resolve(fn());
  } catch (err) {
    inflightActions.delete(key);
    throw err;
  }
  return p.finally(() => inflightActions.delete(key));
};

// Siguiente estado natural del pedido (para la acción rápida de long-press).
const nextOrderStatus = (order) => {
  if (!order) return null;
  const flow = order.type === 'delivery'
    ? ['pendiente', 'en_preparacion', 'listo', 'en_camino', 'entregado']
    : ['pendiente', 'en_preparacion', 'listo', 'entregado'];
  const i = flow.indexOf(order.status);
  return i >= 0 && i < flow.length - 1 ? flow[i + 1] : null;
};

// Código de retiro de mostrador: 4 dígitos derivados del id del pedido.
// Determinista (cliente y admin lo calculan igual) sin cambios de servidor.
const pickupCodeOf = (orderId) => {
  const s = `${orderId}:kiosko-retiro`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) >>> 0;
  return String(h % 10000).padStart(4, '0');
};

// Chip de método de pago para las vistas operativas: qué se paga y cómo está.
const paymentInfoOf = (o) => {
  if (o.credit) {
    return { key: 'credit', label: 'A cuenta', suffix: '', icon: 'creditCard', cls: 'border-indigo-400/40 bg-indigo-500/15 text-indigo-300' };
  }
  switch (o.paymentMethod) {
    case 'pago_movil':
    case 'transferencia': {
      const label = o.paymentMethod === 'pago_movil' ? 'Pago Móvil' : 'Transferencia';
      if (o.paymentStatus === 'confirmado') return { key: o.paymentMethod, label, suffix: 'Confirmado', icon: 'checkCircle', cls: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300' };
      if (o.paymentStatus === 'rechazado') return { key: o.paymentMethod, label, suffix: 'Rechazado', icon: 'xCircle', cls: 'border-rose-400/40 bg-rose-500/15 text-rose-300' };
      return { key: o.paymentMethod, label, suffix: 'En revisión', icon: 'clock', cls: 'border-amber-400/40 bg-amber-500/15 text-amber-300' };
    }
    case 'cartera':
      return { key: 'cartera', label: 'Pagado con cartera', suffix: '', icon: 'wallet', cls: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300' };
    default:
      return { key: 'efectivo', label: 'Efectivo', suffix: '', icon: 'dollarSign', cls: 'border-slate-600 bg-slate-900/60 text-slate-300' };
  }
};

// ¿El pedido tiene un pago digital pendiente de validar O rechazado (revalidar)?
const needsPaymentAttention = (o) =>
  !!o.paymentMethod &&
  o.paymentMethod !== 'efectivo' &&
  o.paymentMethod !== 'cartera' &&
  !o.credit &&
  (o.paymentStatus === 'pendiente' || o.paymentStatus === 'rechazado');

// Transición entre pestañas con View Transitions API cuando existe
// (Chrome/Edge/Safari 18+); en el resto, el cambio de estado es directo y las
// vistas ya animan su montaje con animate-fade-in.
// Push horizontal direccional: se marca la dirección en <html data-vt-dir>
// según el orden de las pestañas en su eje (cliente o admin).
const VIEW_AXIS = {
  customer: ['store', 'calc', 'cart', 'orders', 'account'],
  admin: ['inventory', 'ventas', 'orders', 'benefited', 'blacklist', 'abonos', 'analytics', 'profile']
};

const tabDirection = (axisKey, prevTab, nextTab) => {
  const axis = VIEW_AXIS[axisKey] || [];
  const a = axis.indexOf(prevTab);
  const b = axis.indexOf(nextTab);
  if (a < 0 || b < 0 || a === b) return 'forward';
  return b > a ? 'forward' : 'back';
};

const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};
const withViewTransition = (update, dir = 'forward') => {
  try {
    if (!prefersReducedMotion() && typeof document !== 'undefined' && typeof document.startViewTransition === 'function') {
      try { document.documentElement.dataset.vtDir = dir === 'back' ? 'back' : 'forward'; } catch {}
      document.startViewTransition(() => { flushSync(update); });
      return;
    }
  } catch {}
  update();
};

// Swipe hacia abajo para cerrar bottom sheets (solo móvil). El gesto se toma
// desde cualquier punto de la hoja salvo que haya scroll pendiente hacia
// arriba dentro de [data-sheet-scroll]; arrastrar más de ~110px cierra.
function useSwipeToClose(onClose, enabled = true, { detents = false } = {}) {
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
    let locked = false;   // arrastre hacia abajo (cerrar)
    let growing = false;  // arrastre hacia arriba (#6 detents: expandir hoja)
    let baseH = 0;
    let scrollEl = null;
    let closeTimer = null;

    const onStart = (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      // No capturar gestos que empiezan sobre controles interactivos.
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
        // Detents (#6): tirar hacia arriba con la lista en el tope expande.
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
          // Las hojas entran con una animación de transform (fill-mode both)
          // que pisaría el estilo inline del arrastre: se retira al empezar.
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

// Número que "sube" animado entre valores (métricas del dashboard).
function AnimatedNumber({ value, format = (v) => String(Math.round(v)), className }) {
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) { setDisplay(target); return undefined; }
    const dur = 650;
    const t0 = performance.now();
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (target - from) * eased);
      if (p < 1) {
        raf = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
        setDisplay(target);
      }
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      fromRef.current = target;
    };
  }, [target]);

  return <span className={className}>{format(display)}</span>;
}

// Capa de celebración: confeti de una pasada + check pop. Se monta una vez en
// la raíz y reacciona al evento global CELEBRATE_EVENT.
// THEO — mascota de la marca: perrito marrón SVG animado por estados.
// moods: idle (parpadea y mueve la cola) · happy · celebrate · sleep · pull
// THEO 3.0 — perrito marrón realista e interactivo.
// Realismo: pelaje mechón a mechón, anca/pata trasera, bigotes, cejas punto,
// luz de borde, trufa húmeda y collar de la marca con chapita.
// Interactivo: los ojos siguen el puntero/dedo, acariciarlo hace flotar
// corazoncitos (y mueve la cola rápido) y tocarle la nariz provoca un boop.
const THEO_HEART = 'M12 21s-7.5-4.9-10-9.2C.4 8.6 2 5 5.5 5c2 0 3.4 1.1 4.3 2.6L12 10l2.2-2.4C15.1 6.1 16.5 5 18.5 5 22 5 23.6 8.6 22 11.8 19.5 16.1 12 21 12 21z';
function Theo({ mood = 'idle', className = 'w-20 h-16' }) {
  const happy = mood === 'happy' || mood === 'celebrate';
  const asleep = mood === 'sleep';
  const svgRef = useRef(null);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const [fx, setFx] = useState(null); // null | 'pet' | 'boop'
  const [hearts, setHearts] = useState([]);
  const press = useRef(false);
  const petAccum = useRef(0);
  const timersRef = useRef([]);

  useEffect(() => () => { timersRef.current.forEach(clearTimeout); }, []);

  const spawnHeart = () => {
    const id = Date.now() + Math.random();
    const x = 52 + Math.random() * 96;
    setHearts((h) => [...h, { id, x }]);
    timersRef.current.push(setTimeout(() => setHearts((h) => h.filter((v) => v.id !== id)), 1000));
  };

  const gazeFrom = (e) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    const nx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const ny = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    setGaze({
      x: Math.max(-1, Math.min(1, nx)),
      y: Math.max(-1, Math.min(1, ny))
    });
  };

  const onPointerDown = (e) => {
    press.current = true;
    petAccum.current = 0;
    if (!fx) setFx('pet');
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    gazeFrom(e);
  };
  const onPointerMove = (e) => {
    gazeFrom(e);
    if (!press.current) return;
    if (e.movementX != null) {
      petAccum.current += Math.abs(e.movementX) + Math.abs(e.movementY ?? 0);
      if (petAccum.current > 130) {
        petAccum.current = 0;
        spawnHeart();
        haptic('tap');
      }
    }
  };
  const onPointerUp = () => {
    press.current = false;
    if (fx === 'pet') {
      const t = setTimeout(() => setFx((f) => (f === 'pet' ? null : f)), 650);
      timersRef.current.push(t);
    }
  };
  const boop = (e) => {
    e.stopPropagation();
    if (fx === 'boop') return;
    setFx('boop');
    sfx.doubleTick();
    haptic('added');
    spawnHeart();
    const t = setTimeout(() => setFx(null), 600);
    timersRef.current.push(t);
  };

  const bliss = happy || fx === 'pet';

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 200 170"
      className={`${className} ${mood === 'happy' ? 'theo-happy' : ''} ${mood === 'celebrate' ? 'theo-celebrate' : ''} ${mood === 'sleep' ? 'theo-sleep' : ''} ${mood === 'pull' ? 'theo-pull' : ''} ${fx === 'pet' ? 'theo-petting' : ''} ${fx === 'boop' ? 'theo-boop' : ''}`}
      style={{ touchAction: 'pan-y', cursor: 'pointer' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => { press.current = false; }}
      role="img"
      aria-label="Theo, la mascota de Kiosko 24/7"
    >
      <defs>
        <radialGradient id="theoFur" cx="35%" cy="28%" r="85%">
          <stop offset="0%" stopColor="#bd8757" />
          <stop offset="55%" stopColor="#8f5f33" />
          <stop offset="100%" stopColor="#69401f" />
        </radialGradient>
        <radialGradient id="theoBody" cx="40%" cy="24%" r="90%">
          <stop offset="0%" stopColor="#a06f41" />
          <stop offset="65%" stopColor="#7d5228" />
          <stop offset="100%" stopColor="#5c3a1b" />
        </radialGradient>
        <linearGradient id="theoEar" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor="#7a4c26" />
          <stop offset="100%" stopColor="#452a12" />
        </linearGradient>
        <radialGradient id="theoCream" cx="50%" cy="36%" r="80%">
          <stop offset="0%" stopColor="#f8e7c9" />
          <stop offset="100%" stopColor="#ddb986" />
        </radialGradient>
        <linearGradient id="theoCollar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>
        <filter id="theoSoft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
      </defs>

      {/* Sombra en el suelo */}
      <ellipse cx="100" cy="160" rx="56" ry="9" fill="#000000" opacity="0.24" filter="url(#theoSoft)" />

      {/* Corazoncitos al acariciar */}
      {hearts.map((h) => (
        <path key={h.id} className="theo-heart" d={THEO_HEART} fill="#fb7185"
          transform={`translate(${h.x - 7}, 34) scale(0.62)`} />
      ))}

      <g className={asleep ? 'theo-inner theo-breathe' : 'theo-inner'}>
        {/* Cola esponjosa */}
        <g className="theo-tail">
          <path d="M136 120 Q158 112 166 92" stroke="#5f3c1e" strokeWidth="13" fill="none" strokeLinecap="round" />
          <path d="M140 116 Q156 108 163 94" stroke="#a9744a" strokeWidth="6.5" fill="none" strokeLinecap="round" opacity="0.85" />
        </g>

        {/* Cuerpo sentado + anca */}
        <ellipse cx="100" cy="120" rx="43" ry="37" fill="url(#theoBody)" />
        <circle cx="129" cy="127" r="26" fill="url(#theoBody)" />
        <path d="M60 108 q6 -6 12 -2 M138 104 q6 -4 10 2 M70 132 q5 -5 11 -3 M126 140 q6 -4 11 -1"
          stroke="#b98254" strokeWidth="2" fill="none" opacity="0.4" strokeLinecap="round" />

        {/* Pecho crema */}
        <ellipse cx="95" cy="129" rx="23" ry="26" fill="url(#theoCream)" />
        <path d="M88 118 q4 -6 9 -7 M96 124 q5 -5 10 -5 M84 128 q4 -4 8 -4"
          stroke="#fff3dc" strokeWidth="2" fill="none" opacity="0.55" strokeLinecap="round" />

        {/* Pata trasera asomando */}
        <ellipse cx="147" cy="152" rx="13" ry="7" fill="url(#theoCream)" transform="rotate(-10 147 152)" />
        <path d="M143 149 v5 M149 148.5 v5.5" stroke="#d9bd94" strokeWidth="1.6" strokeLinecap="round" />

        {/* Patas delanteras + pies con deditos */}
        <rect x="74" y="133" width="15" height="26" rx="7.5" fill="url(#theoBody)" />
        <rect x="106" y="133" width="15" height="26" rx="7.5" fill="url(#theoBody)" />
        <ellipse cx="81.5" cy="158" rx="11" ry="6.5" fill="url(#theoCream)" />
        <ellipse cx="113.5" cy="158" rx="11" ry="6.5" fill="url(#theoCream)" />
        <path d="M78.5 156 v3.4 M83 155.6 v3.8 M110.5 156 v3.4 M115 155.6 v3.8" stroke="#d9bd94" strokeWidth="1.6" strokeLinecap="round" />

        {/* Gorguera de pelaje bajo la cabeza */}
        <path d="M64 100 L72 91 L80 100 L88 90 L96 99 L104 89 L112 99 L120 90 L128 100 L136 92 L138 103 L64 106 Z"
          fill="#8f5f33" opacity="0.95" />
        <path d="M76 96 l5 -5 M92 93 l5 -5 M108 93 l5 -5 M124 96 l5 -5"
          stroke="#e8cf9f" strokeWidth="1.8" opacity="0.6" strokeLinecap="round" />

        {/* Collar teal + chapita dorada */}
        <rect x="70" y="102" width="60" height="10" rx="5" fill="url(#theoCollar)" />
        <circle cx="100" cy="116" r="5.5" fill="#fbbf24" stroke="#b45309" strokeWidth="1.2" />
        <circle cx="98.4" cy="114.4" r="1.3" fill="#fef3c7" opacity="0.9" />

        {/* Orejas caídas con vaivén sutil */}
        <g className="theo-ear-l">
          <path d="M66 28 C48 22 32 38 35 62 C36 79 47 90 54 84 C61 77 64 52 68 44 Z" fill="url(#theoEar)" />
          <path d="M60 38 C50 37 43 49 45 62" stroke="#c98a58" strokeWidth="3" fill="none" opacity="0.7" strokeLinecap="round" />
        </g>
        <g className="theo-ear-r">
          <path d="M134 28 C152 22 168 38 165 62 C164 79 153 90 146 84 C139 77 136 52 132 44 Z" fill="url(#theoEar)" />
          <path d="M140 38 C150 37 157 49 155 62" stroke="#c98a58" strokeWidth="3" fill="none" opacity="0.7" strokeLinecap="round" />
        </g>

        {/* Cabeza con volumen y luz de borde */}
        <ellipse cx="100" cy="60" rx="37" ry="35" fill="url(#theoFur)" />
        <path d="M68 42 Q74 30 88 25" stroke="#d9a86e" strokeWidth="2.6" fill="none" opacity="0.5" strokeLinecap="round" filter="url(#theoSoft)" />
        <path d="M90 29 Q100 22 110 29 M84 33 Q96 26 105 32" stroke="#a9744a" strokeWidth="2.2" fill="none" opacity="0.55" strokeLinecap="round" />
        {/* Cejas punto tan */}
        <ellipse cx="82" cy="43" rx="4.2" ry="2.5" fill="#c99b62" opacity="0.85" />
        <ellipse cx="118" cy="43" rx="4.2" ry="2.5" fill="#c99b62" opacity="0.85" />

        {/* Hocico + puente */}
        <ellipse cx="100" cy="66" rx="17" ry="11" fill="url(#theoFur)" opacity="0.6" />
        <ellipse cx="100" cy="78" rx="20" ry="15" fill="url(#theoCream)" />
        {/* Bigotes */}
        <g stroke="rgba(255,255,255,0.65)" strokeWidth="1.2" strokeLinecap="round">
          <path d="M81 76 Q64 73 56 66" /><path d="M81 79 Q63 79 55 76" /><path d="M81 82 Q65 85 58 90" />
          <path d="M119 76 Q136 73 144 66" /><path d="M119 79 Q137 79 145 76" /><path d="M119 82 Q135 85 142 90" />
        </g>
        {/* Trufa húmeda */}
        <path d="M92 70 Q100 66 108 70 Q106 77 100 79 Q94 77 92 70 Z" fill="#2b1a0e" />
        <circle cx="96.8" cy="70.4" r="1.7" fill="#ffffff" opacity="0.9" />
        <circle cx="102.6" cy="71.6" r="0.9" fill="#ffffff" opacity="0.5" />

        {/* Boca según ánimo */}
        {bliss ? (
          <g>
            <path d="M89 83 Q100 94 111 83 Z" fill="#7c2d3e" />
            <ellipse cx="100" cy="89.5" rx="6" ry="4.6" fill="#ef8ba0" />
            <path d="M100 85 L100 91.5" stroke="#b04a63" strokeWidth="1.4" />
          </g>
        ) : asleep ? (
          <path d="M96 84 Q100 87 104 84" stroke="#4a2d16" strokeWidth="2" fill="none" strokeLinecap="round" />
        ) : fx === 'boop' ? (
          <ellipse cx="100" cy="86" rx="3.4" ry="4.2" fill="#4a2d16" />
        ) : (
          <path d="M100 79 Q100 85 95 86 M100 79 Q100 85 105 86" stroke="#4a2d16" strokeWidth="2" fill="none" strokeLinecap="round" />
        )}

        {/* Ojos que siguen el puntero */}
        {bliss ? (
          <g stroke="#241505" strokeWidth="3.2" fill="none" strokeLinecap="round">
            <path d="M75 53 Q83 46 91 53" />
            <path d="M109 53 Q117 46 125 53" />
          </g>
        ) : asleep ? (
          <g stroke="#241505" strokeWidth="2.6" fill="none" strokeLinecap="round">
            <path d="M76 53 Q83 57 90 53" />
            <path d="M110 53 Q117 57 124 53" />
          </g>
        ) : (
          <g style={{ transition: 'transform 0.08s linear', transform: `translate(${(gaze.x * 2).toFixed(2)}px, ${(gaze.y * 1.5).toFixed(2)}px)` }}>
            <circle cx="83" cy="53" r="6.6" fill="#2f1c0d" />
            <circle cx="117" cy="53" r="6.6" fill="#2f1c0d" />
            <circle cx="83" cy="53" r="3.1" fill="#120a03" />
            <circle cx="117" cy="53" r="3.1" fill="#120a03" />
            <circle cx="80.8" cy="50.6" r="2" fill="#ffffff" opacity="0.92" />
            <circle cx="114.8" cy="50.6" r="2" fill="#ffffff" opacity="0.92" />
            <circle cx="85" cy="55.4" r="1" fill="#ffffff" opacity="0.55" />
            <circle cx="119" cy="55.4" r="1" fill="#ffffff" opacity="0.55" />
            <g className="theo-lids">
              <rect x="75.5" y="45.5" width="15" height="15" rx="7.5" fill="#8f5f33" />
              <rect x="109.5" y="45.5" width="15" height="15" rx="7.5" fill="#8f5f33" />
            </g>
          </g>
        )}
        {mood === 'celebrate' && (
          <g fill="#e2637a" opacity="0.35">
            <ellipse cx="71" cy="67" rx="6" ry="3.6" />
            <ellipse cx="129" cy="67" rx="6" ry="3.6" />
          </g>
        )}
        {mood === 'celebrate' && (
          <g stroke="#fbbf24" strokeWidth="3" strokeLinecap="round">
            <path d="M28 14 L36 22 M172 14 L164 22" />
            <path d="M12 46 L22 48 M188 46 L178 48" />
          </g>
        )}
        {mood === 'pull' && (
          <path d="M62 14 Q100 -4 138 14" stroke="#5eead4" strokeWidth="4.5" fill="none" strokeLinecap="round" />
        )}

        {/* Zona de boop: nariz interactiva */}
        <circle cx="100" cy="73" r="15" fill="transparent" onClickCapture={boop} style={{ cursor: 'pointer' }} />
      </g>
    </svg>
  );
}

// Money: total con dígitos que ruedan como odómetro (#12). El símbolo y los
// decimales van fijos; la parte entera sube dígito por dígito al cambiar.
function Money({ value, className = '' }) {
  const str = formatUsd(value);
  const intPart = str.replace(/[^0-9]/g, '').slice(0, -2) || '0';
  const tail = str.slice(str.indexOf(intPart.slice(-Math.max(intPart.length, 1))) + intPart.length);
  const symbol = str.startsWith('$') ? '$' : '';
  const digits = String(intPart).split('');
  return (
    <span className={`inline-flex items-baseline tabular-nums ${className}`}>
      {symbol}
      {digits.map((d, i) => (
        <span key={`${i}-${digits.length}`} className="odo-digit">
          <span className="odo-stack" style={{ transform: `translateY(-${Number(d)}em)` }}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <span key={n}>{n}</span>)}
          </span>
        </span>
      ))}
      {tail}
    </span>
  );
}

// Cierra un overlay con animación de salida (#11): encoge/desvanece el panel
// y luego ejecuta el cierre real. Respeta prefers-reduced-motion.
const exitThen = (ref, cb) => () => {
  const el = ref?.current;
  if (!el || prefersReducedMotion()) return cb();
  el.classList.add('overlay-exit');
  setTimeout(cb, 150);
};

function CelebrationBurst() {
  const [burstId, setBurstId] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    const onCelebrate = () => {
      setBurstId((b) => b + 1);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setBurstId(0), 2200);
    };
    window.addEventListener(CELEBRATE_EVENT, onCelebrate);
    return () => {
      window.removeEventListener(CELEBRATE_EVENT, onCelebrate);
      clearTimeout(timerRef.current);
    };
  }, []);

  const confetti = useMemo(
    () =>
      Array.from({ length: 30 }).map((_, i) => ({
        left: `${(i * 31 + 7) % 100}%`,
        delay: `${((i % 7) * 0.06).toFixed(2)}s`,
        dur: `${(1.3 + (i % 5) * 0.18).toFixed(2)}s`,
        rot: `${360 + (i % 4) * 180}deg`,
        x: `${((i % 2 === 0 ? 1 : -1) * (20 + (i % 6) * 22))}px`,
        color: ['#2dd4bf', '#34d399', '#fbbf24', '#f472b6', '#818cf8', '#38bdf8'][i % 6]
      })),
    []
  );

  if (!burstId) return null;

  return (
    <div key={burstId} className="fixed inset-0 z-[95] pointer-events-none overflow-hidden" aria-hidden="true">
      <div className="celebrate-check-pop absolute left-1/2 top-[24%]">
        <span className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-2xl shadow-emerald-500/40">
          <Icon name="check" className="w-8 h-8" strokeWidth={3} />
        </span>
      </div>
      {confetti.map((c, i) => (
        <span
          key={`${burstId}-${i}`}
          className="confetti-piece confetti-once"
          style={{
            left: c.left,
            background: c.color,
            '--confetti-delay': c.delay,
            '--confetti-dur': c.dur,
            '--confetti-rot': c.rot,
            '--confetti-x': c.x
          }}
        />
      ))}
    </div>
  );
}

// ── Isla Dinera (#1): píldora flotante de rastreo en vivo ────────────────
// Aparece cuando hay un delivery en camino que el cliente está siguiendo.
// Se arrastra verticalmente y se pega al borde izquierdo/derecho; muestra la
// distancia del repartidor en vivo y al tocarla abre el mapa completo.
const ISLAND_POS_KEY = 'kiosko_island_pos';
function OrderIslandTracker({ order, onOpen }) {
  const [pos, setPos] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(ISLAND_POS_KEY) || '{}');
      return { side: saved.side === 'left' ? 'left' : 'right', yPct: Number(saved.yPct) || 62 };
    } catch { return { side: 'right', yPct: 62 }; }
  });
  const drag = useRef({ active: false, startY: 0, startYPct: 0, moved: false });
  const [distLabel, setDistLabel] = useState('En camino');

  const courierOk = order && order.courier_lat != null && order.courier_lng != null;
  const destOk = order && order.lat != null && order.lng != null;

  useEffect(() => {
    if (!courierOk) { setDistLabel('En camino'); return undefined; }
    const calc = () => {
      try {
        const from = { lat: Number(order.courier_lat), lng: Number(order.courier_lng) };
        const to = destOk
          ? { lat: Number(order.lat), lng: Number(order.lng) }
          : null;
        if (!to) return setDistLabel('En camino');
        const m = distanceMeters(from, to);
        setDistLabel(m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.max(20, Math.round(m / 10) * 10)} m`);
      } catch { setDistLabel('En camino'); }
    };
    calc();
    return undefined;
  }, [order?.courier_lat, order?.courier_lng, destOk]);

  // Persistencia de posición
  useEffect(() => {
    try { localStorage.setItem(ISLAND_POS_KEY, JSON.stringify(pos)); } catch {}
  }, [pos]);

  const onTouchStart = (e) => {
    drag.current = { active: true, startY: e.touches[0].clientY, startYPct: pos.yPct, moved: false };
  };
  const onTouchMove = (e) => {
    if (!drag.current.active) return;
    const dy = e.touches[0].clientY - drag.current.startY;
    if (Math.abs(dy) > 6) drag.current.moved = true;
    const vh = window.innerHeight || 1;
    let pct = drag.current.startYPct + (dy / vh) * 100;
    pct = Math.max(18, Math.min(78, pct));
    setPos((p) => ({ ...p, yPct: pct }));
    if (e.cancelable) e.preventDefault();
  };
  const onTouchEnd = () => {
    drag.current.active = false;
  };

  if (!order) return null;

  return (
    <div
      role="button"
      tabIndex={0}
      className="order-island flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-full bg-slate-950/95 border border-teal-500/40 shadow-2xl shadow-teal-500/20 backdrop-blur-xl select-none cursor-pointer"
      style={{
        top: `${pos.yPct}vh`,
        [pos.side]: '0.75rem',
        transform: 'translateY(-50%)'
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={() => { if (!drag.current.moved) { haptic('tap'); onOpen(order); } }}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(order); }}
      aria-label="Ver seguimiento en vivo del pedido"
    >
      <span className="island-dot" />
      <span className="text-[11px] font-black text-white">#{order.id}</span>
      <span className="text-[11px] font-bold text-teal-300 tabular-nums">{distLabel}</span>
      <Icon name="navigation" className="w-3.5 h-3.5 text-slate-400" />
    </div>
  );
}

// Contenedor de tarjeta de pedido con gestos táctiles combinados:
//  · Press largo (~480ms) → acciones rápidas.
//  · Swipe horizontal: derecha = avanzar estado · izquierda = ver ficha,
//    con pista de color mientras se arrastra y deslizamiento fuera al soltar.
//  · El scroll vertical nunca se interrumpe: si el gesto arranca vertical,
//    el componente suelta el control y la lista scrollea normal.
function OrderCardGestures({ onLongPress, onSwipeRight, onSwipeLeft, children, ...rest }) {
  const wrapRef = useRef(null);
  const cardRef = useRef(null);
  const cbRef = useRef({});
  cbRef.current = { onLongPress, onSwipeRight, onSwipeLeft };

  useEffect(() => {
    const el = wrapRef.current;
    const card = cardRef.current;
    if (!el || !card) return undefined;

    let sx = 0;
    let sy = 0;
    let dx = 0;
    let mode = null; // null | 'h' | 'v' | 'done'
    let longTimer = null;

    const clearLong = () => { clearTimeout(longTimer); longTimer = null; };
    const springBack = () => {
      card.style.transition = 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)';
      card.style.transform = 'translateX(0)';
      setTimeout(() => { el.dataset.hint = ''; }, 220);
    };

    const onStart = (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      const t = e.target;
      if (t && t.closest && t.closest('button, a, input, textarea, select, [data-no-swipe]')) return;
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      dx = 0;
      mode = null;
      card.style.transition = 'none';
      if (cbRef.current.onLongPress) {
        clearTimeout(longTimer);
        longTimer = setTimeout(() => {
          if (mode === null && Math.abs(dx) < 8) {
            haptic(16);
            mode = 'done';
            cbRef.current.onLongPress();
          }
        }, 480);
      }
    };

    const onMove = (e) => {
      if (mode === 'done' || !e.touches || e.touches.length !== 1) return;
      const tx = e.touches[0].clientX - sx;
      const ty = e.touches[0].clientY - sy;
      if (mode === null) {
        if (Math.abs(tx) > 18 && Math.abs(tx) > Math.abs(ty) * 1.15) {
          mode = 'h';
          clearLong();
        } else if (Math.abs(ty) > 14) {
          mode = 'v';
          clearLong();
        } else {
          return;
        }
      }
      if (mode !== 'h') return;
      dx = tx;
      // Resistencia más allá del límite para que "frene" al final del recorrido.
      const limit = 150;
      const shown = Math.abs(dx) > limit
        ? Math.sign(dx) * (limit + (Math.abs(dx) - limit) * 0.35)
        : dx;
      card.style.transition = 'none';
      card.style.transform = `translateX(${shown}px)`;
      el.dataset.hint = dx > 6 ? 'right' : dx < -6 ? 'left' : '';
      if (Math.abs(dx) > 12) e.preventDefault();
    };

    const onEnd = () => {
      if (mode === 'h') {
        const dir = dx > 0 ? 'right' : 'left';
        const action = dir === 'right' ? cbRef.current.onSwipeRight : cbRef.current.onSwipeLeft;
        if (action && Math.abs(dx) > 96) {
          haptic(12);
          card.style.transition = 'transform 0.16s ease-in';
          card.style.transform = `translateX(${dir === 'right' ? 120 : -120}%)`;
          setTimeout(() => action(), 110);
          setTimeout(() => springBack(), 240);
          mode = 'done';
          return;
        }
      }
      if (mode === 'h') springBack();
      clearLong();
      mode = null;
      dx = 0;
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      clearLong();
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  return (
    <div ref={wrapRef} data-order-card className="group relative overflow-hidden rounded-3xl" {...rest}>
      {/* Pistas de acción detrás de la tarjeta */}
      <span
        aria-hidden="true"
        className="absolute left-3 top-1/2 -translate-y-1/2 z-0 px-3 py-2 rounded-2xl bg-emerald-500 text-slate-950 text-xs font-black flex items-center gap-1.5 opacity-0 transition-opacity duration-150 group-data-[hint=right]:opacity-100"
      >
        <Icon name="check" className="w-4 h-4" /> Avanzar
      </span>
      <span
        aria-hidden="true"
        className="absolute right-3 top-1/2 -translate-y-1/2 z-0 px-3 py-2 rounded-2xl bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 opacity-0 transition-opacity duration-150 group-data-[hint=left]:opacity-100"
      >
        Ficha <Icon name="eye" className="w-4 h-4" />
      </span>
      <div
        ref={cardRef}
        className={`relative z-10 ${rest.className || ''}`}
      >
        {children}
      </div>
    </div>
  );
}

// Toast deslizable: en móvil se descarta arrastrando hacia los lados.
// El gesto sigue el dedo con fade; al superar ~72px sale volando y se remueve.
function ToastItem({ toast, meta, onDismiss }) {
  const ref = useRef(null);
  const gesture = useRef({ x0: 0, y0: 0, dx: 0, locked: false, active: false });
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    let flyTimer = null;
    const finish = (dirX) => {
      clearTimeout(flyTimer);
      el.style.transition = 'transform 0.18s ease-in, opacity 0.18s ease-in';
      el.style.transform = `translateX(${dirX * 120}%)`;
      el.style.opacity = '0';
      flyTimer = setTimeout(() => dismissRef.current(), 180);
    };

    const onStart = (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      gesture.current = { x0: e.touches[0].clientX, y0: e.touches[0].clientY, dx: 0, locked: false, active: true };
    };
    const onMove = (e) => {
      const g = gesture.current;
      if (!g.active || !e.touches || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - g.x0;
      const dy = e.touches[0].clientY - g.y0;
      if (!g.locked) {
        if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy)) g.locked = true;
        else if (Math.abs(dy) > 14) { g.active = false; return; }
        else return;
      }
      g.dx = dx;
      el.style.transition = 'none';
      el.style.transform = `translateX(${dx}px)`;
      el.style.opacity = String(Math.max(0.25, 1 - Math.abs(dx) / 160));
    };
    const onEnd = () => {
      const g = gesture.current;
      if (!g.locked) { g.active = false; return; }
      g.active = false;
      if (Math.abs(g.dx) > 72) {
        finish(Math.sign(g.dx) || 1);
      } else {
        el.style.transition = 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s ease';
        el.style.transform = '';
        el.style.opacity = '';
      }
      g.locked = false;
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      clearTimeout(flyTimer);
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  return (
    <div
      ref={ref}
      role="status"
      className="pointer-events-auto relative overflow-hidden rounded-xl bg-slate-950/90 backdrop-blur-xl border border-white/10 animate-toast-in cursor-grab active:cursor-grabbing select-none touch-pan-y"
      style={{ boxShadow: `0 8px 32px -8px ${meta.glow}, 0 4px 16px rgba(0,0,0,0.5)` }}
    >
      <span className={`absolute top-0 left-0 h-full w-[3px] bg-gradient-to-b ${meta.progress} opacity-80`} />
      <div className="flex items-center gap-2.5 py-2.5 pl-3.5 pr-2.5">
        <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${meta.chip}`}>
          <Icon name={meta.icon} className="w-4 h-4" />
        </span>
        <p className="flex-1 text-[13px] text-slate-100 leading-snug min-w-0">{toast.message}</p>
        <button
          onClick={() => dismissRef.current()}
          aria-label="Cerrar notificación"
          data-no-swipe
          className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Icon name="x" className="w-3.5 h-3.5" />
        </button>
      </div>
      <span className={`absolute bottom-0 left-0 h-[2px] bg-gradient-to-r ${meta.progress} animate-toast-progress`} />
    </div>
  );
}

// Persistencia de favoritos del cliente (ids de productos, localStorage)
const FAVORITES_KEY = 'kiosko_favorites';

// Reserva de stock en tiempo real: tiempo que el cliente tiene para confirmar
// desde el carrito (5 min) y desde el paso de pago (7 min) antes de que el
// stock vuelva a estar disponible para los demás.
const HOLD_CART_MS = 5 * 60 * 1000;
const HOLD_CHECKOUT_MS = 7 * 60 * 1000;

const loadFavorites = () => {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// ------------------------------------------------------------------
//  Alertas de Precio de Preferidos: registra el último precio conocido
//  de cada favorito y detecta cambios para notificar al cliente.
// ------------------------------------------------------------------
const PRICE_WATCH_KEY = 'kiosko_price_watch';

const loadPriceWatch = () => {
  try {
    const raw = localStorage.getItem(PRICE_WATCH_KEY);
    const p = raw ? JSON.parse(raw) : {};
    return p && typeof p === 'object' ? p : {};
  } catch {
    return {};
  }
};

const savePriceWatch = (watch) => {
  try {
    localStorage.setItem(PRICE_WATCH_KEY, JSON.stringify(watch));
  } catch {}
};

const STATUS_FLOW = ['pendiente', 'en_preparacion', 'listo', 'en_camino', 'entregado'];

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  en_preparacion: 'En Preparación',
  listo: 'Listo',
  en_camino: 'En Camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado'
};

// Un pedido con pago digital "pendiente" aún no debe mostrar su estatus de avance
// (Pendiente/En prep./Listo/...): el estatus solo tiene sentido una vez validado
// el pago (confirmado) o rechazado. Los pagos en efectivo y por cartera se
// validan al instante, así que siempre muestran estatus.
const needsPaymentValidation = (o) =>
  !!o.paymentMethod &&
  o.paymentMethod !== 'efectivo' &&
  o.paymentMethod !== 'cartera' &&
  o.paymentStatus === 'pendiente' &&
  !o.credit;

// Time lapse de pasos de un pedido: muestra el avance con un color distinto por
// estatus. Retiro en tienda: Pendiente → En prep. → Listo → Retirado.
// Delivery: Pendiente → En prep. → Listo → En camino → Entregado.
function OrderStepsTimeline({ order, className = '' }) {
  if (!order) return null;
  // Si el pago digital aún no está validado, no se muestran los pasos de avance:
  // el pedido queda "congelado" hasta confirmar el pago.
  if (needsPaymentValidation(order)) {
    return (
      <div className={`flex items-center justify-center gap-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-[11px] text-amber-300 font-semibold ${className}`}>
        <Icon name="clock" className="w-3.5 h-3.5 shrink-0" />
        Esperando validación del pago
      </div>
    );
  }
  const isDelivery = order.type === 'delivery';
  const steps = isDelivery
    ? [
        { key: 'pendiente', label: 'Pendiente', color: '#fbbf24' },
        { key: 'en_preparacion', label: 'En prep.', color: '#22d3ee' },
        { key: 'listo', label: 'Listo', color: '#34d399' },
        { key: 'en_camino', label: 'En camino', color: '#38bdf8' },
        { key: 'entregado', label: 'Entregado', color: '#a78bfa' }
      ]
    : [
        { key: 'pendiente', label: 'Pendiente', color: '#fbbf24' },
        { key: 'en_preparacion', label: 'En prep.', color: '#22d3ee' },
        { key: 'listo', label: 'Listo', color: '#34d399' },
        { key: 'entregado', label: 'Retirado', color: '#818cf8' }
      ];
  const curIdx = steps.findIndex((s) => s.key === order.status);
  const n = steps.length;
  const W = 100; // viewBox width units
  const H = 26; // viewBox height units
  const cy = H / 2;
  const padX = 10; // dot radius + margin
  const dotR = 4.5;
  const space = (W - dotR * 2 - padX * 2) / (n - 1); // spacing between dot centers

  // Posición x de cada paso y del punto activo (viaja proporcionalmente).
  const xAt = (i) => padX + dotR + space * i;
  const progressX = curIdx < 0 ? 0 : Math.min(xAt(curIdx), W - padX);

  return (
    <div className={`w-full ${className}`} role="img" aria-label={`Avance del pedido: ${STATUS_LABELS[order.status] || order.status}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" preserveAspectRatio="none" aria-hidden="true">
        {/* Trenzado de fondo */}
        <line x1={xAt(0)} y1={cy} x2={xAt(n - 1)} y2={cy} stroke="currentColor" strokeOpacity="0.12" strokeWidth="2.5" strokeLinecap="round" className="order-timeline-track" />
        {/* Progreso animado con stroke-dashoffset */}
        <line
          x1={xAt(0)}
          y1={cy}
          x2={xAt(n - 1)}
          y2={cy}
          stroke="url(#tsg)"
          strokeWidth="3"
          strokeLinecap="round"
          className="order-timeline-progress"
          strokeDasharray={100}
          strokeDashoffset={100 - progressX * (100 / (xAt(n - 1) - xAt(0)))}
        />
        <defs>
          <linearGradient id="tsg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
      </svg>
      {/* Puntos + etiquetas superpuestos */}
      <div className="flex items-start" style={{ marginTop: -H * 0.45 }}>
        {steps.map((s, i) => {
          const done = i < curIdx;
          const active = i === curIdx;
          const isNext = i === curIdx + 1;
          return (
            <div key={s.key} style={{ width: `${100 / n}%` }} className="flex flex-col items-center">
              <span
                className={`rounded-full transition-all ${
                  active
                    ? `order-timeline-dot--active w-3.5 h-3.5 border-2 border-white shadow-lg`
                    : done
                      ? 'order-timeline-dot--done w-3 h-3'
                      : `w-3 h-3 border-2 ${isNext ? 'bg-slate-700' : 'bg-slate-800 border-slate-600'}`
                }`}
                style={{ backgroundColor: done || active ? s.color : undefined }}
              />
              <span className={`mt-1 text-[8px] font-bold whitespace-nowrap leading-none ${active ? 'text-teal-300' : done ? 'text-slate-400' : 'text-slate-600'}`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RateBanner({ rate }) {
  const [usdInput, setUsdInput] = useState('');
  const [bsInput, setBsInput] = useState('');
  const r = rate?.rate || 0;

  const handleUsd = (value) => {
    const v = value.replace(/[^\d.,]/g, '');
    setUsdInput(v);
    const num = parseAmount(v);
    setBsInput(Number.isFinite(num) ? formatAmount(num * r) : '');
  };

  const handleBs = (value) => {
    const v = value.replace(/[^\d.,]/g, '');
    setBsInput(v);
    const num = parseAmount(v);
    setUsdInput(Number.isFinite(num) && r > 0 ? formatAmount(num / r) : '');
  };

  return (
    <div className="border-b border-slate-800 bg-slate-900/90 px-3 sm:px-4 lg:px-8 py-2.5 sm:py-3">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center">
          <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl sm:rounded-2xl bg-teal-500/10 border border-teal-500/30 text-[11px] sm:text-xs font-bold text-teal-300">
            <Icon name="dollarSign" className="w-3.5 h-3.5" />
            Tasa BCV
          </span>
          <span className="text-sm text-slate-300 font-semibold">
            1 US$ = <span className="text-teal-300 font-black">{r ? r.toLocaleString('es-AR') : '—'} Bs</span>
          </span>
          {rate?.date && (
            <span className="hidden md:inline text-[11px] text-slate-500">
              {rate.source} · {new Date(rate.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-800/70 border border-slate-700/80 rounded-xl px-2.5 sm:px-3 py-1.5">
            <Icon name="dollarSign" className="w-4 h-4 text-teal-400" />
            <input
              type="text"
              inputMode="decimal"
              value={usdInput}
              onChange={(e) => handleUsd(e.target.value)}
              placeholder="0.00"
              className="w-16 sm:w-20 bg-transparent text-slate-100 text-sm font-semibold placeholder-slate-600 focus:outline-none"
            />
          </div>
          <Icon name="refresh" className="w-4 h-4 text-slate-600 rotate-90" />
          <div className="flex items-center gap-1.5 bg-slate-800/70 border border-slate-700/80 rounded-xl px-2.5 sm:px-3 py-1.5">
            <span className="text-teal-300 font-bold text-sm">Bs</span>
            <input
              type="text"
              inputMode="decimal"
              value={bsInput}
              onChange={(e) => handleBs(e.target.value)}
              placeholder="0,00"
              className="w-20 sm:w-24 bg-transparent text-slate-100 text-sm font-semibold placeholder-slate-600 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // App views: 'customer' | 'admin'
  const [activeView, setActiveView] = useState('customer');

  // Theme: 'dark' | 'light' | 'neon' — se aplica como data-theme en <html>.
  const [theme, setTheme] = useState(() => localStorage.getItem('kiosko_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('kiosko_theme', theme);
  }, [theme]);

  const THEME_ORDER = ['dark', 'light', 'neon'];
  const toggleTheme = () =>
    setTheme((t) => THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length]);

  // Aviso de versión nueva (dispara main.jsx cuando el SW nuevo toma control,
  // sin recargar) y estado de conexión para el badge "Modo sin conexión".
  const [updateReady, setUpdateReady] = useState(false);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  // Cola de acciones offline (pedidos pendientes de enviar al reconectar).
  const [queuedCount, setQueuedCount] = useState(() => outbox.count());
  // Refs puente: los listeners de conexión se registran antes de que existan
  // loadState/flushOutbox; estos refs se actualizan cuando quedan definidos.
  const flushOutboxRef = useRef(() => {});
  const loadStateRef = useRef(() => {});

  // Sonido de marca (#15): interruptor persistente.
  const [soundOn, setSoundState] = useState(() => isSoundOn());
  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundState(next);
    if (next) sfx.ready();
  };

  // Shared Element Transition producto→detalle (#2): el id activo lleva el
  // view-transition-name solo en la tarjeta tocada para evitar colisiones.
  const [vtProdId, setVtProdId] = useState(null);
  const openProductWithVT = (product) => {
    setVtProdId(product?.id ?? null);
    const run = () => flushSync(() => setProductDetailModal(product));
    try {
      if (!prefersReducedMotion() && typeof document.startViewTransition === 'function') {
        document.startViewTransition(run);
        return;
      }
    } catch {}
    run();
  };
  const closeProductDetail = () => {
    setProductDetailModal(null);
    requestAnimationFrame(() => setVtProdId(null));
  };

  // Tutorial de instalación PWA: notificación en cada recarga. Se respeta el
  // "no volver a preguntar" solo durante la sesión (al cerrar sesión se limpia
  // y vuelve a aparecer) y nunca se muestra si el dispositivo ya instaló la app.
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [installTutorial, setInstallTutorial] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (isInstalledPWA()) return;
        if (localStorage.getItem(INSTALL_DISMISS_KEY)) return;
        if (localStorage.getItem(INSTALL_DONE_KEY)) return;
      } catch {
        // si no hay localStorage, se muestra igual
      }
      setShowInstallPrompt(true);
    }, 2500);
    const onInstalled = () => {
      try {
        localStorage.setItem(INSTALL_DONE_KEY, '1');
        localStorage.setItem(INSTALL_DISMISS_KEY, '1');
      } catch {}
      setShowInstallPrompt(false);
      setInstallTutorial(false);
    };
    window.addEventListener('kiosko:app-installed', onInstalled);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('kiosko:app-installed', onInstalled);
    };
  }, []);

  // Pasos de la guía según la plataforma del dispositivo.
  const installSteps = useMemo(() => {
    if (IS_IOS) {
      return [
        'Abrí la tienda en Safari (iPhone/iPad).',
        'Tocá el botón Compartir (el cuadrado con la flecha ↑) en la barra inferior de Safari.',
        'Deslizá hacia abajo y tocá «Agregar a pantalla de inicio».',
        'Tocá «Agregar» arriba a la derecha. El acceso queda en tu pantalla de inicio.',
      ];
    }
    if (IS_ANDROID) {
      return [
        'Abrí la tienda en Chrome de Android.',
        'Tocá los tres puntos ⋮ del menú, arriba a la derecha.',
        'Tocá «Instalar aplicación» (o «Agregar a pantalla de inicio»).',
        'Confirmá con «Instalar». Queda un acceso en la pantalla de inicio.',
      ];
    }
    return [
      'En Chrome/Edge tocá el icono de instalación (monitor con flecha ↓) al final de la barra de direcciones.',
      'O abrí el menú ⋮ y tocá «Instalar Empresas Alvarados».',
    ];
  }, []);

  const handleInstallYes = () => {
    setShowInstallPrompt(false);
    setInstallTutorial(true);
  };

  const handleInstallNative = () => {
    if (typeof window === 'undefined' || typeof window.__kioskoGetDeferredPrompt !== 'function') return;
    const evt = window.__kioskoGetDeferredPrompt();
    if (evt) {
      evt.prompt();
      window.__kioskoClearDeferredPrompt();
    }
  };

  const handleDismissInstall = () => {
    try {
      localStorage.setItem(INSTALL_DISMISS_KEY, '1');
    } catch {}
    setShowInstallPrompt(false);
  };

  useEffect(() => {
    const onUpdate = () => setUpdateReady(true);
    const onOffline = () => setIsOffline(true);
    // Al volver la conexión: reenvía la cola de pedidos offline y refresca datos.
    const onOnline = () => {
      setIsOffline(false);
      flushOutboxRef.current();
      loadStateRef.current({ silent: true });
    };
    window.addEventListener('kiosko:sw-update', onUpdate);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    // Pull-to-refresh de marca (#14): la vista cliente pide recargar datos.
    const onPtrRefresh = () => loadStateRef.current({ silent: true });
    window.addEventListener('kiosko:ptr-refresh', onPtrRefresh);
    return () => {
      window.removeEventListener('kiosko:sw-update', onUpdate);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('kiosko:ptr-refresh', onPtrRefresh);
    };
  }, []);

  // Auxiliar para persistir el contraste/letra grande del cliente (fallback a tema simple)

  // Alto del header sticky: se pasa a la tienda para anclar el buscador justo debajo.
  // Se mide también con ResizeObserver para que el modo colapsado (scroll) mantenga
  // sincronizados los overlays que usan headerHeight (ficha, barras sticky).
  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const measure = () => setHeaderHeight(headerRef.current?.offsetHeight || 0);
    measure();
    window.addEventListener('resize', measure);
    let ro;
    if (typeof ResizeObserver !== 'undefined' && headerRef.current) {
      ro = new ResizeObserver(measure);
      ro.observe(headerRef.current);
    }
    return () => {
      window.removeEventListener('resize', measure);
      if (ro) ro.disconnect();
    };
  }, []);

  // Header colapsable + botón "volver arriba": un solo listener de scroll con rAF.
  useEffect(() => {
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const y = window.scrollY || 0;
        setHeaderCollapsed(y > 64);
        setShowScrollTop(y > 480);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Server state
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [promos, setPromos] = useState([]);
  const [storeLocation, setStoreLocation] = useState(null);
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [rate, setRate] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Calculadora flotante de conversión $ ⇄ Bs: botón fijo que abre un panel no modal.
  const [calcOpen, setCalcOpen] = useState(false);
  const toggleCalc = () => setCalcOpen((v) => !v);

  // true cuando ya se cargaron datos en esta sesión. Se usa para que el ETag de
  // /api/state solo se envíe en recargas posteriores (polling), nunca en la carga
  // inicial: si llega 304 sin datos en memoria la app quedaría vacía.
  const hasDataRef = useRef(false);

  // Admin session state
  const [isAdminAuthed, setIsAdminAuthed] = useState(() => Boolean(getToken()));
  const [refreshingDb, setRefreshingDb] = useState(false);

  // Admin actualmente autenticado: teléfono + rol ('admin' | 'superadmin').
  // Se persiste en sessionStorage para sobrevivir recargas sin pedir login otra vez.
  const [adminInfo, setAdminInfo] = useState(() => {
    try {
      const role = sessionStorage.getItem('kiosko_admin_role');
      const phone = sessionStorage.getItem('kiosko_admin_phone');
      return role && phone ? { role, phone } : null;
    } catch {
      return null;
    }
  });

  // Perfil visual del admin autenticado (nombre, foto, teléfono).
  const [adminProfile, setAdminProfile] = useState(null);

  // Teléfonos que tienen acceso al panel: fijos (config) + empleados añadidos
  // por el super admin. Viene en /api/state para que el cliente sepa quién
  // puede entrar al panel sin depender de una lista hardcodeada.
  const [adminPhones, setAdminPhones] = useState(ADMIN_PHONES);

  // Carga el perfil del admin (nombre, foto) desde el servidor.
  const loadAdminProfile = useCallback(async (phone) => {
    const res = await api.getAdminProfile();
    if (res.ok && res.data) {
      setAdminProfile(res.data);
      if (phone) {
        try { sessionStorage.setItem('kiosko_admin_phone', phone); } catch {}
      }
    }
  }, []);

  // Guarda el admin logueado en sessionStorage y recarga su perfil.
  const persistAdminInfo = (role, phone) => {
    const info = { role, phone };
    setAdminInfo(info);
    try {
      sessionStorage.setItem('kiosko_admin_role', role);
      sessionStorage.setItem('kiosko_admin_phone', phone);
    } catch {}
    loadAdminProfile(phone);
  };

  // Identidad de sesión para reservar stock en el servidor (persistente en la pestaña).
  const [clientId] = useState(() => {
    try {
      let id = sessionStorage.getItem('kiosko_client_id');
      if (!id) {
        id = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        sessionStorage.setItem('kiosko_client_id', id);
      }
      return id;
    } catch {
      return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
  });

  // Stock que el cliente VE disponible: el servidor ya excluye su propia reserva.
  const availableStock = (p) => Math.max(0, (Number(p.stock) || 0) - (Number(p.reserved) || 0));

  const loadState = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true);
      setLoadError('');
    }
    let res;
    try {
      res = await api.getState(clientId, { useEtag: hasDataRef.current });
    } catch {
      // Sin conexión y sin copia local del catálogo: pantalla de error con
      // reintento automático al volver la conexión.
      if (!silent) {
        setLoadError('No hay conexión a internet. Cargaremos todo automáticamente al reconectarte.');
      }
      setIsLoading(false);
      return;
    }
    if (res.offline && !silent) {
      addToast('Sin conexión: mostrando el último catálogo guardado', 'info');
    }
    if (res.notModified) {
      setIsLoading(false);
      return;
    }
    if (!res.ok) {
      if (!silent) {
        setLoadError('No se pudo conectar con el servidor. Verifica tu conexión a internet e intenta de nuevo.');
      }
      setIsLoading(false);
      return;
    }
    setProducts(res.data.products || []);
    setCategories(res.data.categories || []);
    setOrders(res.data.orders || []);
    // El estado público ya incluye customers (con balance); mantener la lista de
    // clientes del admin sincronizada en tiempo real para que la vista previa de
    // Lista Negra refleje los cambios sin tener que pulsar "Actualizar lista".
    if (isAdminAuthed && Array.isArray(res.data.customers)) setAllCustomers(res.data.customers);
    if (Array.isArray(res.data.settings?.promos)) setPromos(res.data.settings.promos);
    if (res.data.settings?.storeLocation) setStoreLocation(res.data.settings.storeLocation);
    if (res.data.settings?.paymentConfig) setPaymentConfig(res.data.settings.paymentConfig);
    if (res.data.rate) setRate(res.data.rate);
    // Unión de teléfonos admin: los fijos del cliente + los que envía el servidor
    // (env, config o empleados añadidos). El servidor puede devolver lista vacía
    // si no tiene ADMIN_PHONES configurado; no debe borrarse el fallback local.
    if (Array.isArray(res.data.adminPhones)) {
      setAdminPhones([...new Set([...ADMIN_PHONES, ...res.data.adminPhones])]);
    }
    hasDataRef.current = true;
    setIsLoading(false);
  }, [clientId, isAdminAuthed]);

  // Puente para los listeners de conexión registrados antes de esta definición.
  loadStateRef.current = loadState;

  // Badge en el ícono de la app instalada (#9): pedidos pendientes del panel.
  useEffect(() => {
    try {
      if (!('setAppBadge' in navigator)) return undefined;
      if (activeView === 'admin' && isAdminAuthed) {
        const n = orders.filter((o) => o.status === 'pendiente').length;
        if (n > 0) navigator.setAppBadge(Math.min(n, 99));
        else navigator.clearAppBadge();
      } else {
        navigator.clearAppBadge();
      }
    } catch {}
    return undefined;
  }, [orders, activeView, isAdminAuthed]);

  // Reenvía la cola de pedidos guardados sin conexión. Recorre en orden y se
  // detiene ante la primera falla de red (se reintenta en el próximo "online").
  const flushingOutboxRef = useRef(false);
  const flushOutbox = useCallback(async () => {
    if (flushingOutboxRef.current) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    flushingOutboxRef.current = true;
    try {
      for (const job of outbox.list()) {
        if (job.kind !== 'createOrder') continue;
        let res;
        try {
          res = await api.createOrder(job.payload);
        } catch {
          break; // sigue sin conexión
        }
        if (res.ok) {
          outbox.remove(job.id);
          setQueuedCount(outbox.count());
          playChime();
          addToast(`Pedido ${res.data.order?.id || ''} enviado (estaba en cola offline)`, 'success');
        } else if (res.status >= 400 && res.status < 500) {
          // Rechazado por el servidor (stock, validación): no reintentar eternamente.
          outbox.remove(job.id);
          setQueuedCount(outbox.count());
          addToast('Un pedido de la cola fue rechazado por el servidor', 'warning');
        } else {
          break; // error de red/5xx: reintentar después
        }
      }
    } finally {
      flushingOutboxRef.current = false;
      setQueuedCount(outbox.count());
    }
  }, []);
  flushOutboxRef.current = flushOutbox;

  // Al abrir la app con cola pendiente y conexión, se envía de inmediato.
  useEffect(() => {
    if (outbox.count() > 0) flushOutbox();
  }, [flushOutbox]);

  // Costos de productos: solo para el admin (no viajan en /api/state público).
  const loadProductCosts = useCallback(async () => {
    try {
      const res = await api.getProductCosts();
      if (res.ok && Array.isArray(res.data.costs)) {
        const map = {};
        res.data.costs.forEach((c) => { map[c.id] = Number(c.cost) || 0; });
        setCostMap(map);
      }
    } catch {
      // silencioso: los costos son secundarios para la navegación
    }
  }, []);

  useEffect(() => {
    if (!isAdminAuthed) return;
    loadProductCosts();
  }, [isAdminAuthed, loadProductCosts]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  // Polling: keep products, orders and tracking fresh in real time
  useEffect(() => {
    const POLL_INTERVAL = Number(import.meta.env.VITE_POLL_INTERVAL) || 5000;

    const poll = () => {
      if (document.hidden) return; // no gastar requests con la pestaña oculta
      loadState({ silent: true });
    };

    const id = setInterval(poll, POLL_INTERVAL);
    document.addEventListener('visibilitychange', poll);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [loadState]);

  // Al montar con sesión admin activa (recarga), recupera rol/teléfono y perfil.
  useEffect(() => {
    if (!isAdminAuthed) return;
    if (!adminInfo) {
      const res = api.getAdminProfile();
      res.then((r) => {
        if (r.ok && r.data?.phone) {
          setAdminInfo({ role: r.data.role || 'admin', phone: r.data.phone });
          try {
            sessionStorage.setItem('kiosko_admin_role', r.data.role || 'admin');
            sessionStorage.setItem('kiosko_admin_phone', r.data.phone);
          } catch {}
        }
      }).catch(() => {});
    }
    if (!adminProfile) loadAdminProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminAuthed]);

  // Mantiene sincronizadas las vistas del cliente (detalle / rastreo) con la
  // última copia del pedido que trae el polling, para que un cambio de pago o
  // de estado hecho por el admin se refleje en vivo.
  useEffect(() => {
    setOrderDetailOrder((prev) => (prev ? orders.find((o) => o.id === prev.id) || prev : prev));
    setLiveTrackingOrder((prev) => (prev ? orders.find((o) => o.id === prev.id) || prev : prev));
    setCurrentOrderTracking((prev) => (prev ? orders.find((o) => o.id === prev.id) || prev : prev));
  }, [orders]);

  // Cart State
  const [cart, setCart] = useState(() => {
    try {
      const saved = sessionStorage.getItem('kiosko_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrdersDrawerOpen, setIsOrdersDrawerOpen] = useState(false);
  const [isDebtDrawerOpen, setIsDebtDrawerOpen] = useState(false);
  const [debtDrawerMode, setDebtDrawerMode] = useState('deuda'); // 'deuda' | 'saldo'

  // Pestaña activa del cliente en la barra inferior (móvil)
  const [customerTab, setCustomerTab] = useState('store'); // 'store' | 'orders' | 'account'
  const [focusCustomerSection, setFocusCustomerSection] = useState(null); // pedido de scroll/expansión

  // Favoritos: ids de productos marcados con corazón (persistidos localmente)
  const [favorites, setFavorites] = useState(loadFavorites);

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch {}
  }, [favorites]);

  // Alertas de precio de preferidos: vigila el precio de los favoritos y
  // notifica al cliente cuando cambia (sube o baja) entre cargas de estado.
  const [priceWatch, setPriceWatch] = useState(loadPriceWatch);

  useEffect(() => {
    if (products.length === 0 || favorites.length === 0) return undefined;
    const next = { ...priceWatch };
    let changed = false;
    favorites.forEach((id) => {
      const p = products.find((x) => x.id === id);
      if (!p) return;
      const prev = next[id];
      const cur = Number(p.price);
      if (prev == null) {
        next[id] = cur;
        changed = true;
      } else if (prev !== cur) {
        if (cur < prev) {
          addToast(`${p.name} bajó a ${formatUsd(cur)}`, 'success');
        } else if (cur > prev) {
          addToast(`${p.name} subió a ${formatUsd(cur)}`, 'warning');
        }
        next[id] = cur;
        changed = true;
      }
    });
    if (changed) {
      setPriceWatch(next);
      savePriceWatch(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, favorites]);

  const toggleFavorite = (id) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
    haptic(8);
  };

  // Vuelo del ítem agregado al carrito: imagen clonada animada hacia la barra
  const [flyItem, setFlyItem] = useState(null);
  const flyTimerRef = useRef(null);

  const flyToCart = (product, sourceRect) => {
    const target = document.querySelector('[data-cart-target]');
    const toRect = target ? target.getBoundingClientRect() : null;
    if (!sourceRect || !toRect) return;
    const fromX = sourceRect.left + sourceRect.width / 2;
    const fromY = sourceRect.top + sourceRect.height / 2;
    const toX = toRect.left + toRect.width / 2;
    const toY = toRect.top + toRect.height / 2;
    setFlyItem({
      id: `${product.id}-${Date.now()}`,
      image: product.image,
      fx: fromX,
      fy: fromY,
      tx: toX,
      ty: toY
    });
    if (flyTimerRef.current) clearTimeout(flyTimerRef.current);
    flyTimerRef.current = setTimeout(() => setFlyItem(null), 750);
  };

  // Cliente reconocido (pre-llenado automático del checkout)
  const [savedCustomer, setSavedCustomer] = useState(() => loadSavedCustomer());

  // Bienvenida a pantalla completa tras iniciar sesión (cliente o admin).
  // { name, tag, isNew }: name = primer nombre a mostrar, tag = texto superior.
  // Se muestra justo tras identificarse y se cierra al instante con un toque.
  const [welcome, setWelcome] = useState(null);

  // Tour tutorial para usuarios nuevos (se muestra tras la bienvenida).
  const [showTour, setShowTour] = useState(false);

  // Onboarding visual del kiosko: secuencia de bienvenida antes de entrar a la
  // tienda. Se muestra una única vez (localStorage) o hasta que el usuario
  // pulse "Entrar". Complementa el tour (NewUserTour) para usuarios nuevos.
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return localStorage.getItem('kiosko_onboarding_done') !== '1'; }
    catch { return true; }
  });

  const finishOnboarding = () => {
    try { localStorage.setItem('kiosko_onboarding_done', '1'); } catch {}
    setShowOnboarding(false);
  };

  // Éxito de pedido cinematográfico: overlay de celebración tras confirmar.
  const [successOrder, setSuccessOrder] = useState(null);

  // Banner de notificaciones: ocultable, se recuerda la decisión del usuario.
  const [pushBannerHidden, setPushBannerHidden] = useState(() => {
    try { return localStorage.getItem('kiosko_push_banner_hidden') === '1'; } catch { return false; }
  });

  // True si el cliente identificado figura en la lista de administradores por
  // teléfono (fijos de config + empleados añadidos por el super admin).
  const isCurrentAdmin = useMemo(() => {
    if (!savedCustomer?.phoneNumber) return false;
    const key = `${savedCustomer.phoneCode || ''}${savedCustomer.phoneNumber}`.replace(/\D/g, '').slice(-11);
    return adminPhones.includes(key);
  }, [savedCustomer, adminPhones]);

  // Identificación obligatoria: se abre al entrar como cliente sin datos guardados.
  // identityMode: 'login' (formulario) | 'confirm' (solo biometría para volver/salir).
  // identityConfirmKind: 'switchback' | 'logout'.
  // Invitados: el login NO se abre automáticamente. Navegan la tienda libremente
  // (catálogo, recorrido horizontal, más pedidos) y solo se identifican al pulsar
  // "Iniciar sesión" en la barra inferior o al comprar (el checkout pide los datos).
  const [isIdentityOpen, setIsIdentityOpen] = useState(false);
  const [identityMode, setIdentityMode] = useState('login');
  const [identityConfirmKind, setIdentityConfirmKind] = useState('switchback');

  // Abre el login normal (cambiar de usuario / identificarse).
  const openIdentityLogin = () => {
    setIdentityMode('login');
    setIdentityConfirmKind('switchback');
    setIsIdentityOpen(true);
  };

  // Abre la confirmación por biometría para cerrar sesión.
  const openIdentityLogout = () => {
    setIdentityMode('confirm');
    setIdentityConfirmKind('logout');
    setIsIdentityOpen(true);
  };

  // Perfil del cliente desde el servidor (direcciones guardadas, balance, etc.)
  // Se recarga también cuando cambia orders (polling) para que el saldo de Mi
  // Cuenta se actualice al pasar un pedido a entregado o al saldar la deuda.
  const [customerProfile, setCustomerProfile] = useState(null);

  // Al reconocer un cliente con teléfono, buscar su perfil y direcciones guardadas
  useEffect(() => {
    let cancelled = false;
    const phoneKey = savedCustomer?.phoneNumber
      ? `${savedCustomer.phoneCode || ''}${savedCustomer.phoneNumber}`.replace(/\D/g, '').slice(-11)
      : '';
    if (!phoneKey || phoneKey.length < 7) {
      setCustomerProfile(null);
      return;
    }
    api.getCustomer(phoneKey).then((res) => {
      if (!cancelled && res.ok && res.data?.phone) setCustomerProfile(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [savedCustomer?.phoneCode, savedCustomer?.phoneNumber, orders]);

  // Historial de pedidos del cliente reconocido, para "Mis Pedidos"
  const customerOrders = useMemo(() => {
    if (!savedCustomer?.phoneNumber) return [];
    const key = `${savedCustomer.phoneCode || ''}${savedCustomer.phoneNumber}`.replace(/\D/g, '').slice(-11);
    if (!key) return [];
    return orders.filter((o) => normalizePhoneDigits(o.phone) === key);
  }, [orders, savedCustomer]);

  // Registro de clientes conocidos derivado del historial de pedidos + datos locales
  const knownCustomers = useMemo(
    () => buildKnownCustomers(orders, savedCustomer),
    [orders, savedCustomer]
  );

  // Último pedido del cliente reconocido, para "Repetir mi último pedido"
  const lastOrderForCustomer = useMemo(() => {
    if (!savedCustomer?.phoneNumber) return null;
    const key = `${savedCustomer.phoneCode || ''}${savedCustomer.phoneNumber}`.replace(/\D/g, '').slice(-11);
    if (!key) return null;
    return orders.find((o) => normalizePhoneDigits(o.phone) === key) || null;
  }, [orders, savedCustomer]);

  // Persist cart across reloads/navigation (per browser session)
  useEffect(() => {
    sessionStorage.setItem('kiosko_cart', JSON.stringify(cart));
  }, [cart]);

  // Reconcile restored cart with live products (fresh price/stock)
  useEffect(() => {
    if (products.length === 0) return;
    setCart((prev) => {
      const next = prev
        .map((item) => {
          const live = products.find((p) => p.id === item.product.id);
          if (!live) return null; // product no longer exists
          return {
            product: live,
            quantity: Math.min(item.quantity, Math.max(0, live.stock))
          };
        })
        .filter(Boolean)
        .filter((item) => item.quantity > 0);
      return next.length === prev.length ? prev : next;
    });
  }, [products]);

  // Search & Filters
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('relevancia'); // relevancia | precio-asc | precio-desc | stock | popular

  // Modals state
  const [productDetailModal, setProductDetailModal] = useState(null); // Product object
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [currentOrderTracking, setCurrentOrderTracking] = useState(null); // Order id for customer view
  const [liveTrackingOrder, setLiveTrackingOrder] = useState(null); // Order for re-open live tracking from Mis Pedidos

  // Dashboard personal "Mi Kiosko"
  const [isMyKioskoOpen, setIsMyKioskoOpen] = useState(false);

  // Compra rápida por voz
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [voiceItems, setVoiceItems] = useState([]);
  const [voiceLoading, setVoiceLoading] = useState(false);

  // Asistente IA "Don Aiker"
  const [isAikerOpen, setIsAikerOpen] = useState(false);

  // Carrito compartido (dueño e invitado)
  const [myShare, setMyShare] = useState(() => {
    try {
      const raw = sessionStorage.getItem('kiosko_share');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [guestShare, setGuestShare] = useState(() => {
    try {
      const raw = sessionStorage.getItem('kiosko_share_guest');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [guestAdded, setGuestAdded] = useState(0);

  // Admin Specific States
  const [adminTab, setAdminTab] = useState('inventory'); // 'inventory' | 'orders' | 'analytics'
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState(null);
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState(null);
  const [costMap, setCostMap] = useState({});
  const [orderDetailOrder, setOrderDetailOrder] = useState(null);
  const [cancelConfirmOrder, setCancelConfirmOrder] = useState(null);
  const [deleteOrderTarget, setDeleteOrderTarget] = useState(null);

  // Modo vitrina "kiosko siempre abierto": tras ~60s de inactividad en la home
  // se activa un carrusel de atracción. Cualquier tap reanuda la navegación.
  const [showcaseActive, setShowcaseActive] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const showcaseTimerRef = useRef(null);

  // Reinicia el contador de inactividad con cualquier gesto del usuario.
  const bumpActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (showcaseActive) setShowcaseActive(false);
  }, [showcaseActive]);

  useEffect(() => {
    const events = ['pointerdown', 'touchstart', 'keydown', 'scroll', 'wheel'];
    events.forEach((ev) => window.addEventListener(ev, bumpActivity, { passive: true }));
    return () => events.forEach((ev) => window.removeEventListener(ev, bumpActivity));
  }, [bumpActivity]);

  const overlayBlockingShowcase = Boolean(
    isIdentityOpen ||
    welcome ||
    showTour ||
    showOnboarding ||
    isCartOpen ||
    isCheckoutOpen ||
    productDetailModal ||
    isOrdersDrawerOpen ||
    isDebtDrawerOpen ||
    isMyKioskoOpen ||
    isAikerOpen ||
    liveTrackingOrder ||
    orderDetailOrder ||
    showcaseActive
  );

  useEffect(() => {
    const tick = () => {
      if (
        activeView === 'customer' &&
        !isLoading &&
        !overlayBlockingShowcase &&
        Date.now() - lastActivityRef.current > 60000
      ) {
        setShowcaseActive(true);
      }
    };
    showcaseTimerRef.current = setInterval(tick, 5000);
    return () => clearInterval(showcaseTimerRef.current);
  }, [activeView, isLoading, overlayBlockingShowcase]);

  // Clientes registrados (para Beneficiados / Lista Negra del panel admin)
  const [allCustomers, setAllCustomers] = useState([]);

  const loadCustomers = async () => {
    const res = await api.listCustomers();
    if (res.ok) setAllCustomers(res.data || []);
  };

  // Cobros programados (cuentas por cobrar a enviar por WhatsApp)
  const [collections, setCollections] = useState([]);

  const loadCollections = async () => {
    const res = await api.getCollections();
    if (res.ok) setCollections(res.data || []);
  };

  const handleUpsertCollection = async (data) => {
    const res = await api.upsertCollection(data);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo guardar el cobro', 'error');
      return false;
    }
    setCollections(res.data.list || []);
    addToast('Cobro programado', 'success');
    return true;
  };

  const handleDeleteCollection = async (id) => {
    const res = await api.deleteCollection(id);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo eliminar el cobro', 'error');
      return;
    }
    setCollections(res.data.list || []);
    addToast('Cobro eliminado', 'info');
  };

  // Abonos a la deuda ("Mi Cartera"): el admin aprueba o rechaza los abonos
  // que los clientes suben con su comprobante.
  const [payments, setPayments] = useState([]);

  const loadPayments = async () => {
    const res = await api.listPayments();
    if (res.ok) setPayments(res.data || []);
  };

  const handleApprovePayment = async (id) => {
    const res = await api.approvePayment(id);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo aprobar el abono', 'error');
      return false;
    }
    if (res.data.state) {
      setProducts(res.data.state.products || []);
      setOrders(res.data.state.orders || []);
      if (res.data.state.customers) setAllCustomers(res.data.state.customers);
    }
    await loadPayments();
    addToast('Abono aprobado y aplicado al cliente', 'success');
    // Refrescar perfil si el abono pertenece al cliente actual
    if (customerProfile) {
      const payment = payments.find((p) => p.id === id);
      if (payment && normalizePhoneDigits(payment.phone) === normalizePhoneDigits(customerProfile.phone)) {
        const fresh = await api.getCustomer(normalizePhoneDigits(customerProfile.phone));
        if (fresh.ok && fresh.data?.phone) setCustomerProfile(fresh.data);
      }
    }
    return true;
  };

  const handleRejectPayment = async (id, note) => {
    const res = await api.rejectPayment(id, note);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo rechazar el abono', 'error');
      return false;
    }
    if (res.data.state) {
      setProducts(res.data.state.products || []);
      setOrders(res.data.state.orders || []);
      if (res.data.state.customers) setAllCustomers(res.data.state.customers);
    }
    await loadPayments();
    addToast('Abono rechazado', 'info');
    if (customerProfile) {
      const payment = payments.find((p) => p.id === id);
      if (payment && normalizePhoneDigits(payment.phone) === normalizePhoneDigits(customerProfile.phone)) {
        const fresh = await api.getCustomer(normalizePhoneDigits(customerProfile.phone));
        if (fresh.ok && fresh.data?.phone) setCustomerProfile(fresh.data);
      }
    }
    return true;
  };

  // Toast notifications
  const [toasts, setToasts] = useState([]);

  const TOAST_META = {
    success: {
      icon: 'checkCircle',
      chip: 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/40 shadow-lg shadow-emerald-500/20',
      progress: 'from-emerald-400 to-teal-300',
      glow: 'rgba(16,185,129,0.25)'
    },
    error: {
      icon: 'xCircle',
      chip: 'bg-rose-500/15 text-rose-300 border border-rose-400/40 shadow-lg shadow-rose-500/20',
      progress: 'from-rose-400 to-orange-300',
      glow: 'rgba(244,63,94,0.25)'
    },
    warning: {
      icon: 'alertTriangle',
      chip: 'bg-amber-500/15 text-amber-300 border border-amber-400/40 shadow-lg shadow-amber-500/20',
      progress: 'from-amber-400 to-orange-300',
      glow: 'rgba(245,158,11,0.25)'
    },
    info: {
      icon: 'info',
      chip: 'bg-sky-500/15 text-sky-300 border border-sky-400/40 shadow-lg shadow-sky-500/20',
      progress: 'from-sky-400 to-cyan-300',
      glow: 'rgba(14,165,233,0.25)'
    }
  };

  const addToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    if (type === 'error') sfx.error();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  };

  // Hook para acciones idempotentes con feedback inmediato y prevención de doble click
  const useAction = (action, { 
    message = 'Procesando...', 
    onSuccess, 
    onError,
    idempotencyKey 
  } = {}) => {
    const [loading, setLoading] = useState(false);
    const pendingRef = useRef(new Set());
    
    const execute = useCallback(async (...args) => {
      const key = idempotencyKey ? idempotencyKey(...args) : JSON.stringify(args);
      if (pendingRef.current.has(key)) return;
      if (loading) return;
      
      pendingRef.current.add(key);
      setLoading(true);

      try {
        const result = await action(...args);
        addToast('Listo', 'success');
        onSuccess?.(result);
        return result;
      } catch (e) {
        addToast(e.message || 'Error', 'error');
        onError?.(e);
        throw e;
      } finally {
        setLoading(false);
        pendingRef.current.delete(key);
      }
    }, [action, loading, message, onSuccess, onError, idempotencyKey]);
    
    return { execute, loading };
  };

  const handleAdminLogin = async (phone, password) => {
    try {
      const res = await api.login(phone, password);
      if (!res.ok) {
        addToast(res.data.error || 'Contraseña incorrecta', 'error');
        return false;
      }
      setToken(res.data.token);
      setIsAdminAuthed(true);
      // Bienvenida a pantalla completa con el nombre del administrador. Se resuelve
      // desde el cliente reconocido, la lista de clientes o el perfil en el server.
      const phoneKey = String(phone || '').replace(/\D/g, '').slice(-11);
      persistAdminInfo(res.data.role || 'admin', res.data.phone || phoneKey);
      const adminName = await resolveAdminName(phoneKey);
      setWelcome({ name: adminName.split(' ')[0] || 'Administrador', tag: 'Panel de administración' });
      addToast('Sesión iniciada en el panel admin');
      return true;
    } catch {
      addToast('No se pudo conectar con el servidor. Intenta de nuevo.', 'error');
      return false;
    }
  };

  // Login admin por biometría (huella/Face ID): el teléfono identifica al admin
  // y la biometría lo autentica sin contraseña. Solo para el panel admin.
  const handleAdminBiometricLogin = async (phone, response) => {
    try {
      const res = await api.adminBiometricLogin(phone, response);
      if (!res.ok) {
        addToast(res.data.error || (IS_IOS ? 'Face ID no coincidió' : 'La biometría no coincidió'), 'error');
        return false;
      }
      setToken(res.data.token);
      setIsAdminAuthed(true);
      const phoneKey = String(phone || '').replace(/\D/g, '').slice(-11);
      persistAdminInfo(res.data.role || 'admin', res.data.phone || phoneKey);
      const adminName = await resolveAdminName(phoneKey);
      setWelcome({ name: adminName.split(' ')[0] || 'Administrador', tag: 'Panel de administración' });
      addToast('Sesión iniciada en el panel admin');
      return true;
    } catch {
      addToast('No se pudo conectar con el servidor. Intenta de nuevo.', 'error');
      return false;
    }
  };

  // Primer registro de biometría del admin: guarda huella/Face ID y emite token.
  const handleAdminBiometricRegister = async (phone, response) => {
    try {
      const res = await api.adminBiometricRegister(phone, response);
      if (!res.ok) {
        addToast(res.data.error || 'No se pudo guardar tu biometría', 'error');
        return false;
      }
      setToken(res.data.token);
      setIsAdminAuthed(true);
      const phoneKey = String(phone || '').replace(/\D/g, '').slice(-11);
      persistAdminInfo(res.data.role || 'admin', res.data.phone || phoneKey);
      const adminName = await resolveAdminName(phoneKey);
      setWelcome({ name: adminName.split(' ')[0] || 'Administrador', tag: 'Panel de administración' });
      addToast('Sesión iniciada en el panel admin');
      return true;
    } catch {
      addToast('No se pudo conectar con el servidor. Intenta de nuevo.', 'error');
      return false;
    }
  };

  // Resuelve el nombre del admin desde el cliente guardado, los clientes conocidos
  // o el perfil en el server. Devuelve '' si no se encuentra.
  const resolveAdminName = async (phoneKey) => {
    const savedKey = savedCustomer
      ? `${savedCustomer.phoneCode || ''}${savedCustomer.phoneNumber || ''}`.replace(/\D/g, '').slice(-11)
      : '';
    if (savedKey === phoneKey && savedCustomer?.customerName) {
      return savedCustomer.customerName;
    }
    const known = (allCustomers || []).find(
      (c) => normalizePhoneDigits(c.phone) === phoneKey && c.customerName
    );
    if (known) {
      return known.customerName;
    }
    const profile = await api.getCustomer(phoneKey);
    if (profile.ok && profile.data?.customerName) return profile.data.customerName;
    return '';
  };

  const handleAdminLogout = () => {
    // Cierra la sesión activa en el servidor (el token deja de valer).
    api.adminLogout().catch(() => {});
    clearToken();
    try {
      sessionStorage.removeItem('kiosko_admin_role');
      sessionStorage.removeItem('kiosko_admin_phone');
      localStorage.removeItem(INSTALL_DISMISS_KEY);
    } catch {}
    setAdminInfo(null);
    setAdminProfile(null);
    setIsAdminAuthed(false);
    setActiveView('customer');
    setAdminTab('inventory');
    setCustomerTab('store');
    addToast('Sesión cerrada', 'info');
  };

  // Cambio de contraseña del admin desde el panel (verifica la actual).
  const handleChangeAdminPassword = async (currentPassword, newPassword) => {
    const res = await api.changeAdminPassword(currentPassword, newPassword);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo cambiar la contraseña', 'error');
      return false;
    }
    addToast('Contraseña actualizada');
    return true;
  };

  // Guarda el perfil visual del admin (nombre y foto) y refresca la copia local.
  const handleSaveAdminProfile = async (data) => {
    const res = await api.updateAdminProfile(data);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo guardar el perfil', 'error');
      return false;
    }
    setAdminProfile(res.data.profile || adminProfile);
    addToast('Perfil guardado');
    return true;
  };

  // Cambio de tab del admin desde la barra inferior: carga clientes/cobros
  // cuando hace falta (mismo comportamiento que las pestañas del panel).
  const handleAdminTabChange = (key) => {
    if (key === 'benefited' || key === 'blacklist') loadCustomers();
    if (key === 'blacklist') loadCollections();
    withViewTransition(() => {
      setActiveView('admin');
      setAdminTab(key);
    }, tabDirection('admin', adminTab, key));
  };

  const handleToggleBenefited = async (phone, benefited) => {
    const res = await api.setCustomerBenefited(phone, benefited);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo actualizar el beneficio', 'error');
      return;
    }
    await loadCustomers();
    addToast(benefited ? 'Cliente añadido a beneficiados' : 'Beneficio revocado');
  };

  const handleSetCreditLimit = async (phone, creditLimit) => {
    const res = await api.setCustomerCreditLimit(phone, creditLimit);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo actualizar el tope de fiado', 'error');
      return;
    }
    await loadCustomers();
    addToast(creditLimit > 0 ? `Tope de fiado fijado en ${formatUsd(creditLimit)}` : 'Fiado sin tope (sin límite)');
  };

  const handleAddToBlacklist = async (phone, name, amount) => {
    const res = await api.addToBlacklist({ phone, name, amount });
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo añadir a la lista negra', 'error');
      return false;
    }
    await loadCustomers();
    addToast('Cliente añadido a la lista negra', 'success');
    return true;
  };

  const handleAddBlacklistDebt = async ({ phone, name, items, description }) => {
    const res = await api.addBlacklistDebt({ phone, name, items, description });
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo registrar la deuda', 'error');
      return false;
    }
    await loadCustomers();
    await loadState({ silent: true });
    addToast(description ? 'Deuda registrada' : 'Productos añadidos a la deuda', 'success');
    return true;
  };

  const addToCart = (product, quantityToAdd = 1, sourceRect = null) => {
    const avail = availableStock(product);
    if (avail <= 0) {
      addToast(`Solo hay ${avail} Unidades disponibles`, 'error');
      return;
    }

    const existing = cart.find((item) => item.product.id === product.id);
    const currentQty = existing ? existing.quantity : 0;
    const newQty = currentQty + quantityToAdd;

    if (newQty > avail) {
      addToast(`Solo hay ${avail} Unidades disponibles`, 'warning');
      return;
    }

    if (existing) {
      setCart(cart.map((item) =>
        item.product.id === product.id ? { ...item, quantity: newQty } : item
      ));
    } else {
      setCart([...cart, { product, quantity: quantityToAdd }]);
    }

    haptic('added');
    sfx.added();
    if (sourceRect) flyToCart(product, sourceRect);
    addToast(`Agregado: ${product.name} (x${quantityToAdd})`);
  };

  const updateCartQty = (productId, delta) => {
    const item = cart.find((i) => i.product.id === productId);
    if (!item) return;

    const newQty = item.quantity + delta;
    if (newQty > availableStock(item.product)) {
      addToast(`Solo hay ${availableStock(item.product)} Unidades disponibles`, 'warning');
      return;
    }

    if (newQty <= 0) {
      setCart(cart.filter((i) => i.product.id !== productId));
      return;
    }

    setCart(cart.map((i) =>
      i.product.id === productId ? { ...i, quantity: newQty } : i
    ));
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
    addToast('Producto removido del carrito', 'info');
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  }, [cart]);

  const cartCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  // ---- Reserva de stock en tiempo real ----
  // Cada cambio del carrito sincroniza la reserva con el servidor (5 min en
  // carrito; 7 min al llegar al pago). Si la reserva expira, el stock vuelve
  // al catálogo y se libera el carrito.
  const cartHoldTimer = useRef(null);
  const [holdDeadline, setHoldDeadline] = useState(null); // timestamp de expiración de la reserva

  const releaseCartHold = useCallback(() => {
    api.releaseHold(clientId).catch(() => {});
  }, [clientId]);

  useEffect(() => {
    if (cart.length === 0) {
      releaseCartHold();
      return;
    }
    const items = cart.map((item) => ({ id: item.product.id, qty: item.quantity }));
    const ttlMs = isCheckoutOpen ? HOLD_CHECKOUT_MS : HOLD_CART_MS;
    setHoldDeadline(Date.now() + ttlMs);
    api
      .holdStock(clientId, items, ttlMs)
      .then((res) => {
        if (!res.ok) {
          const avail = res.data?.available || {};
          const missing = items.filter((it) => it.qty > (avail[it.id] ?? Infinity));
          if (missing.length > 0) {
            const first = missing[0];
            addToast(`Solo hay ${avail[first.id]} Unidades disponibles`, 'warning');
            // Recorta el carrito a lo disponible para no dejar reservas fantasma.
            setCart((prev) =>
              prev
                .map((item) =>
                  avail[item.product.id] != null && item.quantity > avail[item.product.id]
                    ? { ...item, quantity: avail[item.product.id] }
                    : item
                )
                .filter((item) => item.quantity > 0)
            );
          }
        }
      })
      .catch(() => {});
  }, [cart, isCheckoutOpen, clientId, releaseCartHold]);

  // Expiración local: si el tiempo de la reserva vence sin confirmar, se libera.
  useEffect(() => {
    if (cartHoldTimer.current) clearTimeout(cartHoldTimer.current);
    if (cart.length === 0) return;
    const ttlMs = isCheckoutOpen ? HOLD_CHECKOUT_MS : HOLD_CART_MS;
    cartHoldTimer.current = setTimeout(() => {
      if (cart.length === 0) return;
      releaseCartHold();
      setCart([]);
      if (isCheckoutOpen) setIsCheckoutOpen(false);
      addToast(
        isCheckoutOpen
          ? 'Tu tiempo para confirmar el pago se agotó. El producto volvió a estar disponible.'
          : 'El tiempo en el carrito se agotó. El producto volvió a estar disponible.',
        'warning'
      );
    }, ttlMs);
    return () => {
      if (cartHoldTimer.current) clearTimeout(cartHoldTimer.current);
    };
  }, [cart, isCheckoutOpen, releaseCartHold]);

  const filteredProducts = useMemo(() => {
    let list = products.filter((p) => {
      const matchesCategory =
        selectedCategory === 'Todas' ||
        (selectedCategory === 'Favoritos' ? favorites.includes(p.id) : p.category === selectedCategory);
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });

    if (sortOption === 'precio-asc') {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (sortOption === 'precio-desc') {
      list = [...list].sort((a, b) => b.price - a.price);
    } else if (sortOption === 'stock') {
      list = [...list].sort((a, b) => b.stock - a.stock);
    } else if (sortOption === 'popular') {
      const demand = {};
      orders.forEach((o) =>
        o.items.forEach((it) => {
          demand[it.id] = (demand[it.id] || 0) + it.quantity;
        })
      );
      list = [...list].sort((a, b) => (demand[b.id] || 0) - (demand[a.id] || 0));
    }

    return list;
  }, [products, selectedCategory, searchQuery, sortOption, orders, favorites]);

  const handlePlaceOrder = async (formData) => {
    if (cart.length === 0 || isPlacingOrder) return;
    // Garantía anti-doble-envío: aunque el estado tarde un tick, el módulo
    // bloquea un segundo submit concurrente (evita cargos/pedidos duplicados).
    return withInflightGuard('place-order', async () => {
    setIsPlacingOrder(true);

    const orderPayload = {
      customerName: formData.customerName,
      phone: formData.phone,
      type: formData.type,
      address: formData.type === 'delivery' ? formData.address : undefined,
      lat: formData.type === 'delivery' && formData.lat != null ? formData.lat : undefined,
      lng: formData.type === 'delivery' && formData.lng != null ? formData.lng : undefined,
      notes: formData.notes,
      items: cart.map((item) => ({
        id: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity
      })),
      total: cartTotal,
      credit: Boolean(formData.credit),
      paymentMethod: formData.paymentMethod || 'efectivo',
      paymentReference: formData.paymentReference || '',
      walletApplied: Number(formData.walletApplied) || 0,
      timestamp: formatTimestamp(),
      estimatedMinutes: formData.type === 'delivery' ? 25 : 10,
      clientId
    };

    try {
      const res = await api.createOrder(orderPayload);
      if (!res.ok) {
        addToast(res.data.error || 'No se pudo realizar el pedido', 'error');
        return;
      }

      // El servidor confirmó el pedido: cerrar el modal y el carrito de inmediato,
      // antes de cualquier otra operación, para que nunca quede atascado.
      setCart([]);
      setIsCheckoutOpen(false);
      setIsCartOpen(false);
      setCurrentOrderTracking(res.data.order?.id);

      // Guardar cliente reconocido para pre-llenado automático en el próximo pedido
      const parsedPhone = parsePhone(orderPayload.phone);
      const customerRecord = {
        customerName: orderPayload.customerName,
        phoneCode: parsedPhone.code || formData.phoneCode,
        phoneNumber: parsedPhone.number || formData.phoneNumber,
        address: orderPayload.address || '',
        type: orderPayload.type
      };
      saveCustomerData(customerRecord);
      setSavedCustomer(customerRecord);
      autoSubscribePushIfAllowed();

      if (res.data.state) {
        setProducts(res.data.state.products || []);
        setOrders(res.data.state.orders || []);
      }

      // Adjuntar el comprobante de pago digital tras confirmar el pedido.
      if (formData.paymentProof && res.data.order?.id) {
        try {
          const attach = await api.attachPaymentProof(
            res.data.order.id,
            orderPayload.phone,
            formData.paymentProof,
            orderPayload.paymentReference
          );
          if (!attach.ok) {
            console.warn('[kiosko] No se pudo adjuntar el comprobante:', attach.data?.error);
            addToast(
              'Pedido enviado, pero el comprobante no se adjuntó (' +
                (attach.data?.error || 'error desconocido') +
                '). Contacta al kiosko para enviarlo.',
              'warning'
            );
          }
        } catch (proofErr) {
          console.warn('[kiosko] Error al adjuntar comprobante:', proofErr);
          addToast('Pedido enviado, pero el comprobante no se pudo adjuntar.', 'warning');
        }
      }

      haptic([20, 40, 20]);
      playChime();
      // Overlay de éxito cinematográfico: celebra la compra en pantalla completa
      // con el número de pedido, ETA y acciones (seguir pedido / compartir).
      setSuccessOrder(res.data.order || orderPayload);
      addToast('¡Pedido realizado con éxito!', 'success');
    } catch (err) {
      console.error('[kiosko] Error al crear pedido:', err);
      if ((err && err.offline) || typeof navigator !== 'undefined' && navigator.onLine === false || err instanceof TypeError) {
        // Sin conexión: el pedido entra a la cola offline y se envía solo al
        // reconectar. Se cierra el checkout y se libera el carrito para que no
        // haya doble envío manual.
        outbox.push({ kind: 'createOrder', payload: orderPayload });
        setQueuedCount(outbox.count());
        setCart([]);
        setIsCheckoutOpen(false);
        setIsCartOpen(false);
        haptic([30, 50, 30]);
        addToast('Sin conexión: tu pedido quedó en cola y se enviará automáticamente.', 'warning');
        return;
      }
      addToast('No se pudo enviar el pedido. Revisa tu conexión e intenta de nuevo.', 'error');
    } finally {
      setIsPlacingOrder(false);
    }
    });
  };

  // Desde el overlay de éxito: cierra la celebración y abre el detalle del
  // pedido recién creado (mismo modal que "Mis Pedidos" → ver pedido).
  const handleSuccessTrack = () => {
    const order = successOrder;
    setSuccessOrder(null);
    if (!order) return;
    setCurrentOrderTracking(order.id || order);
    setOrderDetailOrder(order);
  };

  // Compartir el pedido confirmado por WhatsApp (mensaje formateado con artículos).
  const handleSuccessShareWhatsApp = () => {
    const order = successOrder;
    if (!order) return;
    const items = (Array.isArray(order.items) ? order.items : []).map(
      (it) => `• ${it.quantity}× ${it.name}` + (Number(it.price) > 0 ? ` — ${formatUsd(it.price * it.quantity)}` : '')
    ).join('\n');
    const text = encodeURIComponent(
      `🍫 ¡Pedido realizado en el Kiosko 247!\n\nN° ${order.id} — Total ${formatUsd(order.total)}\n\n${items}\n\nGracias por tu compra.`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  // Rellena el carrito con los artículos del último pedido del cliente reconocido
  const handleRepeatLastOrder = () => {
    if (!lastOrderForCustomer) {
      addToast('No encontramos un pedido anterior para repetir', 'info');
      return;
    }
    const order = lastOrderForCustomer;
    const restored = [];
    let skipped = 0;
    order.items.forEach((it) => {
      const live = products.find((p) => p.id === it.id);
      if (!live || availableStock(live) <= 0) {
        skipped++;
        return;
      }
      restored.push({
        product: live,
        quantity: Math.min(it.quantity, Math.max(0, availableStock(live)))
      });
    });
    if (restored.length === 0) {
      addToast('Los productos de tu último pedido ya no están disponibles', 'warning');
      return;
    }
    setCart(restored);
    setIsCartOpen(true);
    addToast(
      skipped > 0
        ? `Repetido tu último pedido (${restored.length} artículos, ${skipped} no disponibles)`
        : `Repetido tu último pedido (${restored.length} artículos)`
    );
  };

  // ---- Carrito compartido (dueño) ----

  // Recrea el enlace de compartir con el contenido actual del carrito.
  const handleOpenShare = async () => {
    const items = cart.map((item) => ({ id: item.product.id, qty: item.quantity }));
    const res = await api.createShare({
      clientId,
      ownerName: savedCustomer?.customerName || 'Cliente',
      items
    });
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo crear el carrito compartido', 'error');
      return;
    }
    const next = { ...res.data.share, url: `${window.location.origin}${window.location.pathname}?share=${res.data.share.code}` };
    setMyShare(next);
    try { sessionStorage.setItem('kiosko_share', JSON.stringify(next)); } catch {}
    setIsShareOpen(true);
    addToast('Carrito compartido creado', 'success');
  };

  const handleCloseShare = async () => {
    if (myShare?.code) {
      api.closeShare(myShare.code, clientId).catch(() => {});
    }
    setMyShare(null);
    try { sessionStorage.removeItem('kiosko_share'); } catch {}
    setIsShareOpen(false);
    addToast('Carrito compartido cerrado', 'info');
  };

  const handleCopyShare = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      addToast('Enlace copiado', 'success');
    } catch {
      addToast('No se pudo copiar el enlace', 'error');
    }
  };

  const handleWhatsAppShare = (link) => {
    const text = encodeURIComponent(`¡Ayudame a completar mi pedido en el Kiosko! Sumá tus antojos en este enlace:\n${link}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  // ---- Carrito compartido (invitado) ----
  // Si la app se abre con ?share=CODE, el usuario entra como invitado: sus
  // artículos se suman al carrito compartido del dueño, no a un carrito propio.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = (params.get('share') || '').trim();
      if (!code) return;
      api.getShare(code).then((res) => {
        if (!res.ok) {
          addToast(res.data.error || 'Carrito compartido no encontrado', 'error');
          return;
        }
        const guest = { code, ownerName: res.data.ownerName || 'tu familia' };
        setGuestShare(guest);
        try { sessionStorage.setItem('kiosko_share_guest', JSON.stringify(guest)); } catch {}
        addToast(`Estás ayudando a armar el pedido de ${guest.ownerName}`, 'info');
      });
    } catch {}
  }, []);

  // Como invitado, agregar un producto lo suma al carrito compartido del dueño.
  const guestAddToCart = async (product, quantityToAdd = 1) => {
    if (!guestShare?.code) return addToCart(product, quantityToAdd);
    const res = await api.addShareItems(guestShare.code, [{ id: product.id, qty: quantityToAdd }]);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo agregar al carrito compartido', 'error');
      return;
    }
    setGuestAdded((n) => n + quantityToAdd);
    haptic(12);
    addToast(`Agregado al carrito de ${guestShare.ownerName}: ${product.name} (x${quantityToAdd})`);
  };

  // Handler unificado: si hay un carrito compartido activo, se usa ese.
  const handleAddToCart = guestShare ? guestAddToCart : addToCart;

  // ---- Compra rápida por voz ----
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceDialog, setVoiceDialog] = useState([]); // turnos conversacionales { kio, u }
  const voiceRecRef = useRef(null);

  const stopVoiceRec = () => {
    try {
      if (voiceRecRef.current) voiceRecRef.current.stop();
    } catch {}
    voiceRecRef.current = null;
    setVoiceListening(false);
  };

  // Inicia una escucha de voz; en el resultado decide si sigue conversando,
  // acumula los artículos reconocidos, o pasa a confirmación cuando el usuario
  // indica que ya terminó ("listo", "eso es todo", "completar pedido", etc).
  const startVoiceListen = () => {
    if (!speechRecognitionAvailable()) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    voiceRecRef.current = rec;
    rec.lang = 'es-ES';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setVoiceListening(true);

    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || '';
      const parsed = parseVoiceOrder(transcript, products);
      const t = transcript.toLowerCase().trim();

      // Frases de cierre de la conversación.
      const done =
        /\b(listo|terminar|terminé|termine|completar|completá|finalizar|confirmar|pagar|agregar al carrito|eso es todo|nada más|nada mas|no más|no mas|ya está|ya esta|listo ya)\b/.test(t) ||
        (parsed.length === 0 && /\b(no|nada|eso es todo|solo eso|nada más|nada mas)\b/.test(t));

      if (done) {
        stopVoiceRec();
        setVoiceDialog((d) => [...d, { u: transcript }]);
        if (voiceItems.length > 0) {
          speakText('Listo, pasamos tu pedido. Confirma y te lo agregamos al carrito.');
        } else {
          speakText('No reconocí productos. Tocá el micrófono o el botón para volver a intentar.');
          setVoiceDialog((d) => [{ kio: '¿Qué productos quieres? Por ejemplo: "2 leche y 1 pan".' }, ...d]);
        }
        return;
      }

      if (parsed.length === 0) {
        setVoiceDialog((d) => [...d, { u: transcript }, { kio: 'No reconocí productos claros. Inténtalo de nuevo, por ejemplo: "2 leche y 1 pan".' }]);
        speakText('No reconocí productos. Inténtalo de nuevo.');
        setTimeout(() => {
          if (voiceRecRef.current === rec) startVoiceListen();
        }, 600);
        return;
      }

      // Acumula los artículos (sumando cantidades del mismo producto).
      setVoiceItems((prev) => {
        const next = [...prev];
        parsed.forEach((it) => {
          const found = next.find((x) => x.product.id === it.product.id);
          if (found) found.qty += it.qty;
          else next.push(it);
        });
        return next;
      });
      setVoiceDialog((d) => [...d, { u: transcript }, { kio: `Listo, tengo ${parsed.length} artículo${parsed.length !== 1 ? 's' : ''}. ¿Algo más?` }]);
      speakText(`Listo. ¿Algo más?`);
      setTimeout(() => {
        if (voiceRecRef.current === rec) startVoiceListen();
      }, 600);
    };
    rec.onerror = () => {
      voiceRecRef.current = null;
      setVoiceListening(false);
      addToast('No se pudo capturar la voz. Acepta el permiso del micrófono.', 'warning');
    };
    rec.onend = () => {
      if (voiceRecRef.current === rec) voiceRecRef.current = null;
      setVoiceListening(false);
    };
    rec.start();
  };

  const openVoiceOrder = () => {
    if (!speechRecognitionAvailable()) {
      addToast('Tu navegador no soporta reconocimiento de voz', 'error');
      return;
    }
    stopVoiceRec();
    setVoiceItems([]);
    setVoiceDialog([{ kio: 'Hola. Decime qué querés: por ejemplo "2 leche y 1 pan".' }]);
    setIsVoiceOpen(true);
    startVoiceListen();
  };

  const handleVoiceConfirm = async () => {
    stopVoiceRec();
    setVoiceLoading(true);
    try {
      // Respeta la disponibilidad real de stock; recorta al máximo disponible.
      const safe = voiceItems
        .map((it) => ({ ...it, qty: Math.min(it.qty, Math.max(0, availableStock(it.product))) }))
        .filter((it) => it.qty > 0);
      if (safe.length === 0) {
        addToast('Ninguno de esos productos tiene stock disponible', 'warning');
        return;
      }
      safe.forEach((it) => addToCart(it.product, it.qty));
      setIsVoiceOpen(false);
      setVoiceItems([]);
      setVoiceDialog([]);
      speakText(`Listo, agregado ${safe.length} artículos a tu carrito`);
      haptic([20, 40, 20]);
      setIsCartOpen(true);
      addToast(`Compra rápida: ${safe.length} artículos al carrito`, 'success');
    } finally {
      setVoiceLoading(false);
    }
  };

  // Detiene la escucha al cerrar el modal (si aún está abierta).
  useEffect(() => {
    if (!isVoiceOpen) stopVoiceRec();
    return () => stopVoiceRec();
  }, [isVoiceOpen]);

  // Polling del carrito compartido del dueño: mantiene en vivo los artículos
  // que suman los invitados mientras el modal está abierto.
  useEffect(() => {
    if (!isShareOpen || !myShare?.code) return undefined;
    const id = setInterval(async () => {
      const res = await api.getShare(myShare.code);
      if (res.ok) {
        setMyShare((prev) => (prev ? { ...prev, items: res.data.items, ownerName: res.data.ownerName } : prev));
      }
    }, 5000);
    return () => clearInterval(id);
  }, [isShareOpen, myShare?.code]);

  // Guarda una dirección en el perfil del cliente (servidor + local)
  const handleSaveCustomerAddress = async (phone, customerName, address) => {
    if (!phone || !address) return;
    const res = await api.upsertCustomer(phone, { customerName, address });
    if (res.ok && res.data?.phone) {
      setCustomerProfile(res.data);
      addToast('Dirección guardada en tu perfil', 'success');
    } else {
      addToast('No se pudo guardar la dirección', 'error');
    }
  };

  // Identificación obligatoria del cliente al entrar
  const handleIdentifyCustomer = async ({ customerName, phoneCode, phoneNumber }) => {
    const phoneKey = `${phoneCode}${phoneNumber}`.replace(/\D/g, '').slice(-11);
    // "Nuevo" = sin historial de pedidos previo Y sin registro previo en la app
    // (servidor). Se calcula ANTES de guardar el registro local para no
    // contarse a sí mismo como conocido. El tutorial solo se muestra a nuevos.
    const hasOrderHistory = orders.some((o) => normalizePhoneDigits(o.phone) === phoneKey);
    let alreadyRegistered = false;
    if (phoneKey.length >= 7) {
      try {
        const existing = await api.getCustomer(phoneKey);
        alreadyRegistered = !!(existing.ok && existing.data?.phone);
      } catch {
        alreadyRegistered = false; // sin conexión: no bloquear el acceso
      }
    }
    const isNew = !hasOrderHistory && !alreadyRegistered;
    const record = {
      customerName,
      phoneCode,
      phoneNumber,
      address: savedCustomer?.address || '',
      type: savedCustomer?.type || 'pickup'
    };
    saveCustomerData(record);
    setSavedCustomer(record);
    setIsIdentityOpen(false);
    // Bienvenida a pantalla completa con el nombre del usuario (primer nombre).
    // Se monta en el mismo render en que se cierra el modal, así la app nunca
    // se ve antes de la animación.
    setWelcome({ name: customerName.trim().split(' ')[0] || customerName.trim(), tag: 'Bienvenido', isNew });
    addToast(isNew ? `¡Bienvenido, ${customerName.split(' ')[0]}!` : `¡Hola de nuevo, ${customerName.split(' ')[0]}!`);
    // Registrar/actualizar el cliente en el servidor para que aparezca en el historial
    if (phoneKey.length >= 7) {
      const res = await api.upsertCustomer(phoneKey, { customerName });
      if (res.ok && res.data?.phone) setCustomerProfile(res.data);
    }
    autoSubscribePushIfAllowed();
  };

  // Confirmación por biometría del modal de identidad. "switchback" = volver al
  // cliente actual sin pedir datos; "logout" = cerrar sesión.
  const handleIdentityConfirmBiometric = (kind) => {
    setIsIdentityOpen(false);
    if (kind === 'logout') handleCustomerLogout();
  };

  // Cerrar sesión del cliente: limpia identidad y carrito, y reabre el login.
  const handleCustomerLogout = () => {
    localStorage.removeItem(CUSTOMER_KEY);
    try {
      localStorage.removeItem(INSTALL_DISMISS_KEY);
    } catch {}
    setSavedCustomer(null);
    setCustomerProfile(null);
    setCart([]);
    releaseCartHold();
    setIdentityMode('login');
    setIsIdentityOpen(false);
    addToast('Sesión cerrada', 'info');
  };

  // Pide permiso de notificaciones y suscribe el dispositivo al teléfono activo.
  const handleEnableNotifications = async () => {
    if (!('Notification' in window) || !('PushManager' in window)) {
      addToast('Tu navegador no soporta notificaciones', 'error');
      return;
    }
    if (Notification.permission === 'denied') {
      addToast('Notificaciones bloqueadas. Actívalas en los ajustes del navegador', 'error');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      addToast('Notificaciones no activadas', 'info');
      return;
    }
    const ok = await subscribeToPush(savedCustomer?.phoneNumber || '');
    addToast(ok ? 'Notificaciones activadas. Te avisaremos de tu pedido.' : 'No se pudieron activar las notificaciones', ok ? 'success' : 'error');
  };

  // Re-suscribe en silencio si el permiso ya está concedido (al entrar o pedir).
  const autoSubscribePushIfAllowed = async () => {
    if (!savedCustomer?.phoneNumber) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    subscribeToPush(savedCustomer.phoneNumber).catch(() => {});
  };

  const handleSaveProduct = async (productData) => {
    if (productData.id) {
      // Edit existing
      const res = await api.updateProduct(productData.id, productData);
      if (!res.ok) {
        addToast(res.data.error || 'No se pudo actualizar el producto', 'error');
        return;
      }
      setProducts(res.data.state.products || []);
      setCategories(res.data.state.categories || []);
      addToast(`Producto "${productData.name}" actualizado`);
      loadProductCosts();
    } else {
      // Create new (id y code los genera el servidor)
      const res = await api.createProduct(productData);
      if (!res.ok) {
        addToast(res.data.error || 'No se pudo crear el producto', 'error');
        return;
      }
      setProducts(res.data.state.products || []);
      setCategories(res.data.state.categories || []);
      addToast(`Producto "${productData.name}" creado con éxito`);
      loadProductCosts();
    }

    setIsAddEditModalOpen(false);
    setProductToEdit(null);
  };

  const handleDeleteProduct = async (productId) => {
    const res = await api.deleteProduct(productId);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo eliminar el producto', 'error');
      return;
    }
    setProducts(res.data.state.products || []);
    addToast('Producto eliminado del inventario', 'info');
    setDeleteConfirmProduct(null);
    loadProductCosts();
  };

  // Venta en mostrador: el admin registra una venta física desde el panel
  // ("Ventas"). Se crea un pedido tipo pickup ya entregado y pagado, así se
  // contabiliza en Finanzas, descuenta stock y queda en el historial.
  const handleCounterSale = async ({ items, customerName, customerPhone, paymentMethod }) => {
    return withInflightGuard('sale', async () => {
    const cleanItems = (items || []).map((it) => ({
      id: it.id,
      name: it.name,
      price: Number(it.price) || 0,
      quantity: Math.max(1, Math.round(Number(it.quantity) || 1))
    }));
    if (cleanItems.length === 0) {
      addToast('Agregá al menos un producto para registrar la venta', 'error');
      return { ok: false };
    }
    const total = cleanItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
    const res = await api.createCounterSale({
      items: cleanItems,
      customerName: (customerName || '').trim() || 'Venta en mostrador',
      phone: (customerPhone || '').trim(),
      paymentMethod: paymentMethod || 'efectivo',
      total,
      subtotal: total,
      notes: 'Venta en mostrador'
    });
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo registrar la venta', 'error');
      return { ok: false };
    }
    setProducts(res.data.state.products || []);
    setOrders(res.data.state.orders || []);
    if (res.data.state.customers) setAllCustomers(res.data.state.customers);
    await loadState({ silent: true });
    playChime();
    celebrate();
    addToast(`Venta registrada: ${formatUsd(total)}`, 'success');
    return { ok: true, order: res.data.order };
    });
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    return withInflightGuard(`st:${orderId}`, async () => {
    // Optimistic UI: la tarjeta refleja el cambio al instante; si el servidor
    // falla, se revierte al estado previo y se avisa con un toast.
    const prevOrders = orders;
    const changed = prevOrders.some((o) => o.id === orderId && o.status !== newStatus);
    if (changed) {
      setOrders(prevOrders.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
      haptic(newStatus === 'entregado' || newStatus === 'cancelado' ? [16, 40, 16] : 12);
    }
    const res = await api.updateOrderStatus(orderId, newStatus);
    if (!res.ok) {
      if (changed) setOrders(prevOrders);
      addToast(res.data.error || 'No se pudo actualizar el pedido', 'error');
      return;
    }
    setOrders(res.data.state.orders || []);
    // Actualizar también la lista de clientes (para que Lista Negra refleje el balance)
    if (res.data.state.customers) setAllCustomers(res.data.state.customers);
    // Pedido entregado: chime + confeti breve en el panel.
    if (newStatus === 'entregado') {
      playChime();
      celebrate();
    }
    addToast(`Estado del pedido ${orderId} actualizado a ${STATUS_LABELS[newStatus] || newStatus}`);
    // Si el pedido pertenece al cliente actual, refrescar su perfil (balance actualizado)
    const updatedOrder = res.data.state.orders?.find((o) => o.id === orderId);
    if (updatedOrder && customerProfile && normalizePhoneDigits(updatedOrder.phone) === normalizePhoneDigits(customerProfile.phone)) {
      const fresh = await api.getCustomer(normalizePhoneDigits(customerProfile.phone));
      if (fresh.ok && fresh.data?.phone) setCustomerProfile(fresh.data);
    }
    });
  };

  // Admin confirma o rechaza el pago digital de un pedido (dispara push al cliente).
  const handleUpdateOrderPayment = async (orderId, newStatus) => {
    return withInflightGuard(`pay:${orderId}`, async () => {
    const res = await api.updateOrderPayment(orderId, newStatus);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo actualizar el pago', 'error');
      return;
    }
    setOrders(res.data.state.orders || []);
    addToast(`Pago del pedido ${orderId} ${newStatus === 'confirmado' ? 'confirmado' : 'rechazado'}`);
    });
  };

  // Refresca la copia de un pedido en todos los sitios donde el cliente lo ve
  // (historial, detalle y rastreo) tras subir comprobante o pasar a cuenta.
  const handleOrderUpdated = useCallback((updatedOrder) => {
    if (!updatedOrder) return;
    setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
    setOrderDetailOrder((prev) => (prev && prev.id === updatedOrder.id ? updatedOrder : prev));
    setLiveTrackingOrder((prev) => (prev && prev.id === updatedOrder.id ? updatedOrder : prev));
    setCurrentOrderTracking((prev) => (prev && prev.id === updatedOrder.id ? updatedOrder : prev));
  }, []);

  // Envía la posición en vivo del repartidor (el admin que entrega) al servidor.
  const handleUpdateCourierLocation = async (orderId, lat, lng) => {
    const res = await api.updateCourierLocation(orderId, lat, lng);
    if (!res.ok) {
      addToast('No se pudo enviar la ubicación del repartidor', 'error');
      return false;
    }
    return true;
  };

  const handleCancelOrder = async (orderId, phone) => {
    return withInflightGuard(`cancel:${orderId}`, async () => {
    const res = await api.cancelOrder(orderId, phone);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo cancelar el pedido', 'error');
      return;
    }
    setOrders(res.data.state.orders || []);
    setCancelConfirmOrder(null);
    addToast(`Pedido ${orderId} cancelado`, 'info');
    });
  };

  const handleDeleteOrder = async (orderId) => {
    return withInflightGuard(`delord:${orderId}`, async () => {
    const res = await api.deleteOrder(orderId);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo eliminar el pedido', 'error');
      return;
    }
    setOrders(res.data.state.orders || []);
    setDeleteOrderTarget(null);
    addToast(`Pedido ${orderId} eliminado`, 'info');
    });
  };

  const handleSavePromos = async (newPromos) => {
    const res = await api.saveSettings({ promos: newPromos });
    if (!res.ok) {
      addToast(res.data.error || 'No se pudieron guardar los promos', 'error');
      return false;
    }
    if (Array.isArray(res.data.settings?.promos)) setPromos(res.data.settings.promos);
    addToast('Promociones guardadas correctamente');
    return true;
  };

  const handleSaveStoreLocation = async (location) => {
    const res = await api.saveSettings({ promos, storeLocation: location });
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo guardar la ubicación del comercio', 'error');
      return false;
    }
    if (res.data.settings?.storeLocation) setStoreLocation(res.data.settings.storeLocation);
    addToast('Ubicación del comercio guardada');
    return true;
  };

  const handleSavePaymentConfig = async (cfg) => {
    const res = await api.saveSettings({ promos, paymentConfig: cfg });
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo guardar la configuración de pagos', 'error');
      return false;
    }
    if (res.data.settings?.paymentConfig) setPaymentConfig(res.data.settings.paymentConfig);
    addToast('Configuración de pagos guardada');
    return true;
  };

  const handleRefreshDb = async () => {
    setRefreshingDb(true);
    const res = await api.refreshDb();
    setRefreshingDb(false);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo refrescar el espejo de la base de datos', 'error');
      return false;
    }
    addToast('Datos de producción copiados a calidad');
    await loadState({ silent: true });
    return true;
  };

  // Derive live tracking order from current orders so status changes reflect in customer view
  const trackedOrder = currentOrderTracking
    ? orders.find((o) => o.id === currentOrderTracking) || null
    : null;

  // Sound notification when a tracked order advances status
  const lastTrackedStatus = useRef(null);
  useEffect(() => {
    if (!trackedOrder) {
      lastTrackedStatus.current = null;
      return;
    }
    const status = trackedOrder.status;
    if (lastTrackedStatus.current && status !== lastTrackedStatus.current) {
      playChime();
      if (status === 'en_preparacion') {
        addToast(`¡Tu pedido ${trackedOrder.id} está en preparación!`, 'info');
      } else if (status === 'listo') {
        addToast(`¡Tu pedido ${trackedOrder.id} está listo para retirar!`, 'info');
      } else if (status === 'en_camino') {
        addToast(`¡Tu pedido ${trackedOrder.id} está en camino!`, 'warning');
      } else if (status === 'entregado') {
        addToast(`¡Tu pedido ${trackedOrder.id} fue entregado!`, 'success');
      } else if (status === 'cancelado') {
        addToast(`Tu pedido ${trackedOrder.id} fue cancelado.`, 'error');
      }
    }
    lastTrackedStatus.current = status;
  }, [trackedOrder?.status, trackedOrder?.id]);

  // Notificaciones de cambio de estatus para TODOS los pedidos del cliente
  // (envío en camino, entregado, cancelado) aunque no estén en el rastreo activo.
  const lastStatusesRef = useRef({});
  useEffect(() => {
    const seen = lastStatusesRef.current;
    customerOrders.forEach((o) => {
      if (currentOrderTracking && o.id === currentOrderTracking) return;
      const prev = seen[o.id];
      if (prev && prev !== o.status && o.status !== 'pendiente' && o.status !== 'en_preparacion') {
        playChime();
        if (o.status === 'en_camino') {
          addToast(`¡Tu pedido ${o.id} está en camino!`, 'warning');
        } else if (o.status === 'entregado') {
          addToast(`¡Tu pedido ${o.id} fue entregado!`, 'success');
        } else if (o.status === 'cancelado') {
          addToast(`Tu pedido ${o.id} fue cancelado.`, 'error');
        }
      }
      seen[o.id] = o.status;
    });
  }, [customerOrders, currentOrderTracking]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-slate-950 overflow-x-clip">
      {/* Toast Notification Container */}
      <div className="fixed top-[max(1rem,env(safe-area-inset-top,0px))] left-4 right-4 sm:top-[max(1.25rem,env(safe-area-inset-top,0px))] sm:left-auto sm:right-5 sm:w-full sm:max-w-sm z-[90] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => {
          const meta = TOAST_META[toast.type] || TOAST_META.success;
          return (
            <ToastItem
              key={toast.id}
              toast={toast}
              meta={meta}
              onDismiss={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            />
          );
        })}
      </div>

      {/* Aviso de versión nueva: no recarga sola para no perder el estado */}
      {updateReady && (
        <div className="fixed top-[max(0.75rem,env(safe-area-inset-top,0px))] left-1/2 -translate-x-1/2 z-[62] w-[92vw] max-w-sm rounded-2xl bg-slate-900 border border-teal-500/40 shadow-2xl shadow-teal-500/10 p-3.5 animate-fade-in">
          <p className="text-xs font-bold text-white">Hay una versión nueva disponible</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Pulsa actualizar para recibir los últimos cambios. Si estás en un pedido, termínalo primero.
          </p>
          <div className="flex gap-2 mt-2.5">
            <button
              onClick={() => {
                if (typeof window.__kioskoActivateUpdate === 'function') window.__kioskoActivateUpdate();
                else window.location.reload();
              }}
              className="flex-1 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 text-xs font-bold hover:from-teal-400 hover:to-emerald-400 transition-all"
            >
              Actualizar
            </button>
            <button
              onClick={() => setUpdateReady(false)}
              className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition-all"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Badge de modo sin conexión: los datos se conservan en el buffer local */}
      {isOffline && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[58] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/95 border border-slate-700 text-[11px] font-semibold text-slate-300 shadow-lg backdrop-blur-md animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Modo sin conexión · catálogo guardado
          {queuedCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black">
              {queuedCount} en cola
            </span>
          )}
        </div>
      )}

      {/* Notificación del tutorial de instalación PWA: aparece en cada recarga
          (salvo que ya esté instalada o se haya elegido "no preguntar" durante
          la sesión). Al elegir "Sí" guía según Android / iOS / escritorio. */}
      {showInstallPrompt && (
        <div className="fixed top-[max(0.75rem,env(safe-area-inset-top,0px))] left-1/2 -translate-x-1/2 z-[61] w-[92vw] max-w-sm rounded-2xl bg-slate-900 border border-teal-500/40 shadow-2xl shadow-teal-500/10 p-3.5 animate-fade-in">
          <div className="flex items-start gap-2.5">
            <span className="shrink-0 p-2 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-400">
              <Icon name="download" className="w-4 h-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white">¿Querés tener la app en tu dispositivo?</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Acceso directo en tu pantalla de inicio, más rápido y con modo sin conexión.
              </p>
            </div>
            <button
              onClick={() => setShowInstallPrompt(false)}
              aria-label="Cerrar notificación"
              className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Icon name="x" className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstallYes}
              className="flex-1 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 text-xs font-bold hover:from-teal-400 hover:to-emerald-400 transition-all"
            >
              Sí, guíame
            </button>
            <button
              onClick={() => setShowInstallPrompt(false)}
              className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition-all"
            >
              Ahora no
            </button>
          </div>
          <button
            onClick={handleDismissInstall}
            className="mt-2 w-full text-center text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            No volver a preguntar (hasta que cierres sesión)
          </button>
        </div>
      )}

      {/* Guía de instalación paso a paso, según la plataforma detectada */}
      {installTutorial && (
        <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="absolute inset-0" onClick={() => setInstallTutorial(false)} />
          <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden animate-screen-up">
            <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-slate-800 flex items-center gap-2.5">
              <span className="shrink-0 p-2 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-400">
                <Icon name="download" className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white">Instalar la app</h4>
                <p className="text-[11px] text-slate-400">
                  {IS_IOS ? 'iPhone / iPad · Safari' : IS_ANDROID ? 'Android · Chrome' : 'Escritorio · Chrome/Edge'}
                </p>
              </div>
              <button
                onClick={() => setInstallTutorial(false)}
                aria-label="Cerrar guía"
                className="ml-auto shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Icon name="x" className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 sm:px-5 py-4 space-y-3">
              {installSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-teal-500/15 border border-teal-500/40 text-teal-300 text-[11px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <p className="text-[12px] text-slate-200 leading-snug">{step}</p>
                </div>
              ))}
              {IS_IOS && (
                <p className="text-[10px] text-amber-300/90">
                  En iPhone/iPad la instalación solo funciona desde Safari.
                </p>
              )}
            </div>
            <div className="px-4 sm:px-5 pb-4 flex gap-2">
              {IS_ANDROID && (
                <button
                  onClick={handleInstallNative}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 text-xs font-bold hover:from-teal-400 hover:to-emerald-400 transition-all active:scale-95"
                >
                  Instalar ahora
                </button>
              )}
              <button
                onClick={() => setInstallTutorial(false)}
                className={`${IS_ANDROID ? 'flex-1' : 'w-full'} py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition-all active:scale-95`}
              >
                Ya lo hice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Glassmorphic Top Navbar — colapsable al scrollear (móvil) */}
      <header ref={headerRef} style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top, 0px))' }} className={`sticky top-0 z-30 glass bg-slate-900/80 backdrop-blur-lg border-b border-slate-800/80 px-3 sm:px-4 lg:px-8 transition-all duration-300 ${headerCollapsed ? 'py-1.5 sm:py-2' : 'py-2.5 sm:py-3'}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <BrandLogo className={`transition-all duration-300 ${headerCollapsed ? 'w-8 h-8 sm:w-9 sm:h-9' : 'w-10 h-10 sm:w-11 sm:h-11'}`} />
            <div className={`min-w-0 transition-all duration-300 ${headerCollapsed ? '-space-y-0.5' : ''}`}>
              <h1 className={`font-display font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-teal-400 bg-clip-text text-transparent leading-tight truncate transition-all duration-300 ${headerCollapsed ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'}`}>
                Empresas Alvarados
              </h1>
              <span className={`text-xs text-teal-400/90 font-medium items-center gap-1.5 overflow-hidden transition-all duration-300 ${headerCollapsed ? 'hidden' : 'hidden sm:flex'}`}>
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping inline-block" />
                Abierto Ahora • Atención Rápida
              </span>
            </div>
          </div>

          {/* Mode Switcher: Customer vs Admin Panel */}
          <div className="flex items-center gap-1 sm:gap-2 bg-slate-800/90 p-1 rounded-xl sm:p-1.5 sm:rounded-2xl border border-slate-700/60 shadow-inner shrink-0">
            <button
              onClick={() => withViewTransition(() => setActiveView('customer'), 'back')}
              className={`px-2.5 sm:px-4 py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center gap-1.5 sm:gap-2 ${
                activeView === 'customer'
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 shadow-md shadow-teal-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
              }`}
            >
              <Icon name="shoppingBag" className="w-4 h-4 shrink-0" />
              <span className="hidden min-[420px]:inline">Tienda</span>
            </button>
            {(isCurrentAdmin || isAdminAuthed) && (
              <button
                onClick={() => withViewTransition(() => setActiveView('admin'), 'forward')}
                className={`px-2.5 sm:px-4 py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center gap-1.5 sm:gap-2 ${
                  activeView === 'admin'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
                }`}
              >
                <Icon name="layers" className="w-4 h-4 shrink-0" />
                <span className="hidden min-[560px]:inline">Panel</span>
                {orders.filter((o) => o.status === 'pendiente').length > 0 && (
                  <span className="min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center animate-pulse">
                    {orders.filter((o) => o.status === 'pendiente').length}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Sound toggle: paquete de sonidos de marca on/off */}
          <button
            onClick={toggleSound}
            className="p-2 sm:p-2.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 hover:border-teal-500/50 hover:bg-slate-800 transition-all text-slate-200 hover:text-teal-400 shrink-0 btn-sink"
            aria-label={soundOn ? 'Silenciar sonidos' : 'Activar sonidos'}
            title={soundOn ? 'Silenciar sonidos de la app' : 'Activar sonidos de la app'}
          >
            <Icon name={soundOn ? 'volume2' : 'volumeX'} className="w-5 h-5" />
          </button>

          {/* Theme toggle: dark → light → neon */}
          <button
            onClick={toggleTheme}
            className="p-2 sm:p-2.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 hover:border-teal-500/50 hover:bg-slate-800 transition-all text-slate-200 hover:text-teal-400 shrink-0 btn-sink"
            aria-label="Cambiar tema"
            title={theme === 'dark' ? 'Cambiar a modo claro' : theme === 'light' ? 'Cambiar a modo neón' : 'Cambiar a modo oscuro'}
          >
            <Icon name={theme === 'dark' ? 'sun' : theme === 'light' ? 'moon' : 'zap'} className="w-5 h-5" />
          </button>

          {/* Customer identity chip */}
          {activeView === 'customer' && savedCustomer?.customerName && (
            <button
              onClick={openIdentityLogin}
              className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-2xl bg-slate-800/90 border border-slate-700/80 hover:border-teal-500/50 hover:bg-slate-800 transition-all shrink-0"
              title="Cambiar de usuario"
              aria-label="Cambiar de usuario"
            >
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-slate-950 text-[10px] sm:text-xs font-black flex items-center justify-center shrink-0">
                {savedCustomer.customerName.charAt(0).toUpperCase()}
              </span>
              <span className="hidden min-[380px]:block max-w-20 sm:max-w-28 truncate text-[11px] sm:text-xs font-semibold text-slate-200">
                {savedCustomer.customerName.split(' ')[0]}
              </span>
            </button>
          )}

          {/* Customer Cart Quick Button */}
          {activeView === 'customer' && (
            <button
              data-cart-target
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 sm:p-2.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 hover:border-teal-500/50 hover:bg-slate-800 transition-all text-slate-200 hover:text-teal-400 group shrink-0 btn-sink"
              aria-label="Abrir carrito"
            >
              <Icon key={`bag-${cartCount}`} name="shoppingBag" className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:scale-110 animate-cart-bounce" />
              {cartCount > 0 && (
                <span
                  key={`badge-${cartCount}`}
                  className="absolute -top-1.5 -right-1.5 bg-teal-400 text-slate-950 text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg animate-badge-spring ring-2 ring-slate-900"
                >
                  {cartCount}
                </span>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Tasa BCV del día + Calculadora flotante (botón bajo el logo, arrastrable) */}
      <RateBanner rate={rate} />
      {activeView === 'customer' && <CalcFab open={calcOpen} onToggle={toggleCalc} rate={rate} headerHeight={headerHeight} />}
      {activeView === 'admin' && isAdminAuthed && (
        <CalcFab open={calcOpen} onToggle={toggleCalc} rate={rate} zClass="z-[76]" headerHeight={headerHeight} admin />
      )}

      {/* Main Container */}
      <main className={`flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 ${activeView === 'customer' && cartCount > 0 ? 'pb-36 sm:pb-8' : 'pb-24 sm:pb-8'}`}>
        {isLoading ? (
          <LoadingScreen variant={activeView === 'admin' && isAdminAuthed ? 'orders' : 'catalog'} />
        ) : loadError ? (
          <LoadErrorScreen error={loadError} onRetry={loadState} />
        ) : activeView === 'customer' ? (
          <CustomerView
            products={filteredProducts}
            allProducts={products}
            stickyTop={headerHeight}
            categories={categories}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            sortOption={sortOption}
            setSortOption={setSortOption}
            rate={rate}
            promos={promos}
            onAddToCart={handleAddToCart}
            onOpenProductModal={openProductWithVT}
          vtProductId={vtProdId}
            currentOrderTracking={trackedOrder}
            setCurrentOrderTracking={setCurrentOrderTracking}
            savedCustomer={savedCustomer}
            lastOrderForCustomer={lastOrderForCustomer}
            onRepeatLastOrder={handleRepeatLastOrder}
            customerOrders={customerOrders}
            orders={orders}
            customerProfile={customerProfile}
            storeLocation={storeLocation}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            focusSection={focusCustomerSection}
            onOpenDebt={(mode) => {
              setDebtDrawerMode(mode || 'deuda');
              setIsDebtDrawerOpen(true);
            }}
            onOpenMyKiosko={() => setIsMyKioskoOpen(true)}
            onOpenVoice={openVoiceOrder}
            guestShare={guestShare}
            guestAdded={guestAdded}
          />
        ) : isAdminAuthed ? (
          <AdminView
            products={products}
            costById={costMap}
            orders={orders}
            rate={rate}
            promos={promos}
            onSavePromos={handleSavePromos}
            adminTab={adminTab}
            setAdminTab={setAdminTab}
            onLogout={handleAdminLogout}
            refreshingDb={refreshingDb}
            onRefreshDb={handleRefreshDb}
            onOpenAddModal={() => {
              setProductToEdit(null);
              setIsAddEditModalOpen(true);
            }}
onEditProduct={(product) => {
        setProductToEdit({ ...product, cost: costMap[product.id] ?? product.cost ?? '' });
        setIsAddEditModalOpen(true);
      }}
            onDeleteProduct={(product) => setDeleteConfirmProduct(product)}
            onCounterSale={handleCounterSale}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onUpdateOrderPayment={handleUpdateOrderPayment}
            onUpdateCourierLocation={handleUpdateCourierLocation}
            onDeleteOrder={(order) => setDeleteOrderTarget(order)}
            allCustomers={allCustomers}
            onLoadCustomers={loadCustomers}
            onToggleBenefited={handleToggleBenefited}
            onSetCreditLimit={handleSetCreditLimit}
            onAddToBlacklist={handleAddToBlacklist}
            onAddBlacklistDebt={handleAddBlacklistDebt}
            collections={collections}
            onLoadCollections={loadCollections}
            onUpsertCollection={handleUpsertCollection}
            onDeleteCollection={handleDeleteCollection}
            payments={payments}
            pendingPayments={payments.filter((p) => p.status === 'pendiente').length}
            onLoadPayments={loadPayments}
            onApprovePayment={handleApprovePayment}
            onRejectPayment={handleRejectPayment}
            addToast={addToast}
            storeLocation={storeLocation}
            onSaveStoreLocation={handleSaveStoreLocation}
            adminPhone={adminInfo?.phone || `${savedCustomer ? `${savedCustomer.phoneCode || ''}${savedCustomer.phoneNumber || ''}`.replace(/\D/g, '').slice(-11) : ''}`}
            adminRole={adminInfo?.role || 'admin'}
            adminProfile={adminProfile}
            onChangePassword={handleChangeAdminPassword}
            onSaveAdminProfile={handleSaveAdminProfile}
            theme={theme}
            onSetTheme={setTheme}
            headerHeight={headerHeight}
          />
        ) : (
          <AdminLoginView
            onLogin={handleAdminLogin}
            onBiometricLogin={handleAdminBiometricLogin}
            onBiometricRegister={handleAdminBiometricRegister}
            onBack={() => setActiveView('customer')}
            initialPhone={savedCustomer && isCurrentAdmin ? { code: savedCustomer.phoneCode || '0412', number: savedCustomer.phoneNumber || '' } : null}
          />
        )}
      </main>

      {/* 1. Customer Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        cartTotal={cartTotal}
        rate={rate}
        onUpdateQty={updateCartQty}
        onRemove={removeFromCart}
        holdDeadline={holdDeadline}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
        onShare={handleOpenShare}
      />

      {/* 1b. Orders Drawer (Mis Pedidos) */}
      <OrdersDrawer
        isOpen={isOrdersDrawerOpen}
        onClose={() => setIsOrdersDrawerOpen(false)}
        orders={customerOrders}
        rate={rate}
        isBenefited={Boolean(customerProfile?.isBenefited)}
        onViewOrderDetail={(order) => {
          setIsOrdersDrawerOpen(false);
          setOrderDetailOrder(order);
        }}
        onTrackLiveOrder={(order) => {
          setIsOrdersDrawerOpen(false);
          setLiveTrackingOrder(order);
        }}
        onRequestCancelOrder={(order) => {
          setIsOrdersDrawerOpen(false);
          setCancelConfirmOrder(order);
        }}
      />

      {/* 1c. Debt Drawer (Mi Deuda) */}
      {isDebtDrawerOpen && customerProfile && (
        <ErrorBoundary>
          <CustomerDebtModal
            customer={customerProfile}
            orders={orders}
            rate={rate}
            addToast={addToast}
            mode={debtDrawerMode}
            headerHeight={headerHeight}
            onClose={() => setIsDebtDrawerOpen(false)}
          />
        </ErrorBoundary>
      )}

      {/* 1d. Dashboard Personal "Mi Kiosko" */}
      {isMyKioskoOpen && customerProfile && (
        <ErrorBoundary>
          <MyKioskoModal
            customer={customerProfile}
            customerName={savedCustomer?.customerName || customerProfile.customerName}
            orders={orders}
            products={products}
            rate={rate}
            headerHeight={headerHeight}
            onClose={() => setIsMyKioskoOpen(false)}
            onRepeatLastOrder={handleRepeatLastOrder}
          />
        </ErrorBoundary>
      )}

      {/* 1e. Compra rápida por voz */}
      {isVoiceOpen && (
        <ErrorBoundary>
          <VoiceOrderModal
            items={voiceItems}
            loading={voiceLoading}
            listening={voiceListening}
            dialog={voiceDialog}
            onConfirm={handleVoiceConfirm}
            onClose={() => setIsVoiceOpen(false)}
            onRetry={openVoiceOrder}
          />
        </ErrorBoundary>
      )}

      {/* 1f. Carrito compartido (dueño) */}
      {isShareOpen && myShare && (
        <ErrorBoundary>
          <ShareCartModal
            share={myShare}
            products={products}
            onClose={() => setIsShareOpen(false)}
            onCopy={handleCopyShare}
            onWhatsApp={handleWhatsAppShare}
            onCloseShare={handleCloseShare}
          />
        </ErrorBoundary>
      )}

      {/* 2. Product Detail Modal */}
      {productDetailModal && (
        <ProductDetailModal
          product={productDetailModal}
          sameBrandProducts={productDetailModal.brand
            ? products.filter((p) => p.brand === productDetailModal.brand)
            : [productDetailModal]}
          rate={rate}
          isFavorite={favorites.includes(productDetailModal.id)}
          onToggleFavorite={() => toggleFavorite(productDetailModal.id)}
          onNavigate={(p) => setProductDetailModal(p)}
          onClose={closeProductDetail}
          onAddToCart={(qty, rect) => {
            addToCart(productDetailModal, qty, rect);
          }}
        />
      )}

      {/* 3. Checkout Modal */}
      {isCheckoutOpen && (
        <CheckoutModal
          onClose={() => setIsCheckoutOpen(false)}
          cart={cart}
          cartTotal={cartTotal}
          rate={rate}
          isPlacingOrder={isPlacingOrder}
          onSubmit={handlePlaceOrder}
          savedCustomer={savedCustomer}
          knownCustomers={knownCustomers}
          allCustomers={allCustomers}
          onSaveCustomer={setSavedCustomer}
          customerProfile={customerProfile}
          onSaveAddress={handleSaveCustomerAddress}
          addToast={addToast}
          paymentConfig={paymentConfig}
          holdDeadline={holdDeadline}
        />
      )}

      {/* 4. Admin Add/Edit Product Modal */}
      {isAddEditModalOpen && (
        <ProductFormModal
          productToEdit={productToEdit}
          categories={categories}
          products={products}
          onClose={() => setIsAddEditModalOpen(false)}
          onSave={handleSaveProduct}
        />
      )}

      {/* 5. Delete Confirm Modal */}
      {deleteConfirmProduct && (
        <DeleteConfirmModal
          product={deleteConfirmProduct}
          onClose={() => setDeleteConfirmProduct(null)}
          onConfirm={() => handleDeleteProduct(deleteConfirmProduct.id)}
        />
      )}

      {/* 5b. Order Detail Modal */}
      {orderDetailOrder && (
        <OrderDetailModal
          order={orderDetailOrder}
          rate={rate}
          isBenefited={Boolean(customerProfile?.isBenefited)}
          onOrderUpdated={handleOrderUpdated}
          addToast={addToast}
          headerHeight={headerHeight}
          onClose={() => setOrderDetailOrder(null)}
          onTrackLiveOrder={(order) => {
            setOrderDetailOrder(null);
            setLiveTrackingOrder(order);
          }}
          onRequestCancelOrder={(order) => {
            setOrderDetailOrder(null);
            setCancelConfirmOrder(order);
          }}
        />
      )}

      {/* 5b2. Live Tracking Modal (cliente reabre el rastreo de una entrega) */}
      {liveTrackingOrder && (
        <LiveTrackingModal
          order={liveTrackingOrder}
          isBenefited={Boolean(customerProfile?.isBenefited)}
          onOrderUpdated={handleOrderUpdated}
          addToast={addToast}
          onClose={() => setLiveTrackingOrder(null)}
          storeLocation={storeLocation}
          headerHeight={headerHeight}
        />
      )}

      {/* 5c. Cancel Order Confirm Modal */}
      {cancelConfirmOrder && (
        <CancelOrderModal
          order={cancelConfirmOrder}
          onClose={() => setCancelConfirmOrder(null)}
          onConfirm={() => {
            const key = `${savedCustomer?.phoneCode || ''}${savedCustomer?.phoneNumber || ''}`.replace(/\D/g, '').slice(-11);
            handleCancelOrder(cancelConfirmOrder.id, key);
          }}
        />
      )}

      {/* 5d. Delete Order Confirm Modal (Admin) */}
      {deleteOrderTarget && (
        <DeleteOrderModal
          order={deleteOrderTarget}
          onClose={() => setDeleteOrderTarget(null)}
          onConfirm={() => handleDeleteOrder(deleteOrderTarget.id)}
        />
      )}

      {/* Fixed bottom cart bar */}
      {activeView === 'customer' && cartCount > 0 && (
        <CartFloatBar
          cartCount={cartCount}
          cartTotal={cartTotal}
          rate={rate}
          onOpen={() => setIsCartOpen(true)}
        />
      )}

      {/* Identity modal: obligatorio para consumir como cliente */}
      {isIdentityOpen && activeView === 'customer' && (
        <IdentityModal
          knownCustomers={knownCustomers}
          allCustomers={allCustomers}
          savedCustomer={savedCustomer}
          mode={identityMode}
          confirmKind={identityConfirmKind}
          onConfirm={handleIdentifyCustomer}
          onConfirmBiometric={handleIdentityConfirmBiometric}
          onClose={() => setIsIdentityOpen(false)}
        />
      )}

      {/* Item volando al carrito (overlay animado) */}
      {flyItem && (
        <img
          key={flyItem.id}
          src={flyItem.image}
          alt=""
          className="fly-to-cart-img"
          style={{
            '--fx': `${flyItem.fx}px`,
            '--fy': `${flyItem.fy}px`,
            '--tx': `${flyItem.tx}px`,
            '--ty': `${flyItem.ty}px`
          }}
          onAnimationEnd={() => setFlyItem(null)}
        />
      )}

      {/* Barra de navegación inferior (móvil) */}
      <BottomTabBar
        activeView={activeView}
        customerTab={customerTab}
        onCustomerTab={(tab) => {
          withViewTransition(() => {
            setActiveView('customer');
            setCustomerTab(tab);
            setFocusCustomerSection(null);
          }, tabDirection('customer', customerTab, tab));
          if (tab === 'orders') setIsOrdersDrawerOpen(true);
          if (tab === 'account') {
            setDebtDrawerMode('saldo');
            setIsDebtDrawerOpen(true);
          }
        }}
        cartCount={cartCount}
        hasCustomer={Boolean(savedCustomer)}
        isAdmin={isCurrentAdmin || isAdminAuthed}
        calcOpen={calcOpen}
        onToggleCalc={toggleCalc}
        onOpenCart={() => {
          setActiveView('customer');
          setIsCartOpen(true);
        }}
        onGoAdmin={() => {
          withViewTransition(() => {
            setIsIdentityOpen(false);
            setActiveView('admin');
            setAdminTab('inventory');
          }, tabDirection('admin', adminTab, 'inventory'));
        }}
        onGoStore={() => {
          withViewTransition(() => {
            setActiveView('customer');
            setCustomerTab('store');
          }, tabDirection('customer', customerTab, 'store'));
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onCustomerLogout={openIdentityLogout}
        onOpenLogin={openIdentityLogin}
        adminTab={adminTab}
        onAdminTab={handleAdminTabChange}
        pendingOrders={orders.filter((o) => !['entregado', 'cancelado'].includes(o.status)).length}
        pendingPayments={payments.filter((p) => p.status === 'pendiente').length}
        onLogout={handleAdminLogout}
        isAdminAuthed={isAdminAuthed}
      />

      {/* Botón flotante "volver arriba": aparece al scrollear; en el panel muestra
          el badge de pedidos pendientes para no perderse novedades. */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Volver arriba"
          className="fixed right-3 sm:right-6 bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:bottom-6 z-[45] w-11 h-11 rounded-full bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-xl shadow-black/40 text-slate-200 hover:text-teal-300 hover:border-teal-500/50 flex items-center justify-center animate-fade-in btn-sink transition-colors"
        >
          <Icon name="chevronUp" className="w-5 h-5" />
          {activeView === 'admin' && isAdminAuthed && orders.some((o) => o.status === 'pendiente') && (
            <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center animate-badge-pop">
              {orders.filter((o) => o.status === 'pendiente').length}
            </span>
          )}
        </button>
      )}

      {/* Celebración global (confeti + check): la dispara el evento kiosko:celebrate */}
      <CelebrationBurst />

      {/* Isla Dinera (#1): rastreo en vivo flotante para delivery en camino */}
      {(() => {
        if (activeView !== 'customer' || liveTrackingOrder) return null;
        const caminos = orders.filter((o) => o.type === 'delivery' && o.status === 'en_camino');
        const target = caminos.find((o) => o.id === currentOrderTracking) || caminos[caminos.length - 1];
        if (!target) return null;
        return (
          <OrderIslandTracker
            order={target}
            onOpen={(o) => { setLiveTrackingOrder(o); setCurrentOrderTracking(o.id); }}
          />
        );
      })()}

      {/* Footer */}
      <footer
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        className="mt-auto border-t border-slate-800/80 bg-slate-950/60 pt-5 pb-20 sm:py-6 px-4 text-center text-[11px] sm:text-xs text-slate-500"
      >
        <div className="inline-flex items-center gap-1.5 mb-1.5">
          <BrandLogo className="w-5 h-5 !rounded-lg" />
          <span className="font-display font-bold text-slate-300 text-xs tracking-wide">Kiosko 24/7 · Empresas Alvarados</span>
        </div>
        <p>Abierto todo el día, todos los días. Pedí, pagá y retirá sin filas o recibí en tu puerta.</p>
      </footer>

      {/* Banner de notificaciones push (solo cliente identificado y permiso sin decidir) */}
      {activeView === 'customer' &&
        savedCustomer?.phoneNumber &&
        !pushBannerHidden &&
        'Notification' in window &&
        'PushManager' in window &&
        Notification.permission === 'default' && (
        <PushBanner
          onEnable={handleEnableNotifications}
          onDismiss={() => {
            setPushBannerHidden(true);
            try { localStorage.setItem('kiosko_push_banner_hidden', '1'); } catch {}
          }}
        />
      )}

      {/* Onboarding visual del kiosko: se muestra una vez antes de entrar */}
      {showOnboarding && !isLoading && activeView === 'customer' && (
        <KioskoOnboarding onFinish={finishOnboarding} />
      )}

      {/* Modo vitrina: carrusel de atracción tras inactividad */}
      {showcaseActive && activeView === 'customer' && (
        <ShowcaseMode
          products={products}
          promos={promos}
          rate={rate}
          onResume={() => setShowcaseActive(false)}
          onOrderNow={() => setShowcaseActive(false)}
          onOpenProduct={(p) => {
            setShowcaseActive(false);
            setProductDetailModal(p);
          }}
        />
      )}

      {/* Éxito de pedido cinematográfico */}
      {successOrder && (
        <OrderSuccessOverlay
          order={successOrder}
          onClose={() => setSuccessOrder(null)}
          onTrack={handleSuccessTrack}
          onShare={handleSuccessShareWhatsApp}
        />
      )}

      {/* Bienvenida a pantalla completa tras el inicio de sesión */}
      {welcome && (
        <WelcomeOverlay
          name={welcome.name}
          tag={welcome.tag}
          onDone={() => {
            setWelcome(null);
            if (welcome.isNew) setShowTour(true);
          }}
        />
      )}

      {/* Tour tutorial para usuarios nuevos */}
      {showTour && <NewUserTour onClose={() => setShowTour(false)} />}

      {/* Botón flotante del Asistente IA "Don Aiker" — oculto con el carrito abierto */}
      {activeView === 'customer' && !isCartOpen && (
        <button
          onClick={() => setIsAikerOpen(true)}
          className={`fixed right-3 sm:right-5 z-[55] p-3 sm:p-3.5 rounded-full bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white shadow-2xl shadow-indigo-500/40 border border-white/20 hover:scale-110 hover:shadow-indigo-500/60 active:scale-95 transition-all animate-glow-pulse ${
            cartCount > 0
              ? 'bottom-[10.5rem] sm:bottom-20'
              : 'bottom-[4.8rem] sm:bottom-5'
          }`}
          aria-label="Abrir Asistente IA Don Aiker"
          title="Asistente IA Don Aiker"
        >
          <Icon name="chat" className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      )}

      {/* Asistente IA "Don Aiker" */}
      {isAikerOpen && (
        <AikerAssistant
          customer={customerProfile}
          customerOrders={customerOrders}
          products={products}
          promos={promos}
          rate={rate}
          savedCustomer={savedCustomer}
          storeLocation={storeLocation}
          cartCount={cartCount}
          headerHeight={headerHeight}
          onClose={() => setIsAikerOpen(false)}
          onOpenDebt={() => {
            setDebtDrawerMode('deuda');
            setIsAikerOpen(false);
            setIsDebtDrawerOpen(true);
          }}
          onOpenOrders={() => {
            setIsAikerOpen(false);
            setIsOrdersDrawerOpen(true);
          }}
          onTrackOrder={(order) => {
            setIsAikerOpen(false);
            setLiveTrackingOrder(order);
          }}
          onAddToCart={(product) => addToCart(product, 1)}
          onRepeatLastOrder={() => {
            setIsAikerOpen(false);
            handleRepeatLastOrder();
          }}
          onOpenCart={() => {
            setIsAikerOpen(false);
            setIsCartOpen(true);
          }}
          onOpenCheckout={() => {
            setIsAikerOpen(false);
            setIsCheckoutOpen(true);
          }}
        />
      )}
    </div>
  );
}

function WelcomeOverlay({ name, tag = 'Bienvenido', onDone }) {
  // Cualquier toque/click cierra la bienvenida al instante. También se cierra
  // sola tras unos segundos por si el cliente no toca la pantalla.
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);

  const isAdmin = tag.toLowerCase().includes('panel');

  return (
    <div
      onClick={onDone}
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-gradient-to-br from-teal-700 via-cyan-800 to-slate-950 animate-welcome-overlay cursor-pointer select-none touch-manipulation"
      role="dialog"
      aria-label={`${tag} ${name}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(45,212,191,0.15),transparent_60%)] animate-welcome-glow pointer-events-none" />
      <div className="relative flex flex-col items-center text-center px-6">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center mb-6 sm:mb-8 animate-welcome-pop shadow-2xl shadow-teal-500/20">
          <Icon name={isAdmin ? 'users' : 'sparkles'} className="w-8 h-8 sm:w-10 sm:h-10 text-teal-200" />
        </div>
        <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.35em] text-teal-200/80 mb-3 animate-welcome-pop">
          {tag}
        </p>
        <h2 className="font-display text-4xl sm:text-6xl font-black text-white leading-tight mb-4 sm:mb-6 animate-welcome-name break-words max-w-[90vw]">
          {name}
        </h2>
        <p className="text-xs sm:text-sm text-teal-100/70 animate-welcome-pop">
          Toca en cualquier parte para continuar
        </p>
      </div>
    </div>
  );
}

// Banner que invita a activar las notificaciones push tras identificarse.
function PushBanner({ onEnable, onDismiss }) {
  return (
    <div className="fixed left-4 right-4 sm:left-6 sm:right-auto bottom-24 sm:bottom-6 z-[45] sm:max-w-sm rounded-2xl border border-teal-500/40 bg-slate-900/95 p-4 shadow-2xl backdrop-blur animate-screen-up">
      <div className="flex items-start gap-3">
        <span className="p-2 rounded-xl bg-teal-500/20 text-teal-400 shrink-0">
          <Icon name="bell" className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">Activa las notificaciones</p>
          <p className="text-xs text-slate-400 mt-0.5 leading-snug">
            Te avisamos al instante cuando tu pedido está listo o en camino.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={onEnable}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 text-xs font-bold hover:from-teal-400 hover:to-emerald-400 transition-all active:scale-95"
            >
              Activar ahora
            </button>
            <button
              onClick={onDismiss}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tour tutorial para clientes nuevos: se muestra tras la bienvenida para que
// descubran cómo pedir, seguir sus pedidos y revisar su saldo.
function NewUserTour({ onClose }) {  const steps = [
    {
      icon: 'store',
      title: 'Explora el catálogo',
      desc: 'Busca productos por nombre o navega por categorías y marcas para descubrir todo lo que tenemos para ti.'
    },
    {
      icon: 'shoppingBag',
      title: 'Agrega al carrito',
      desc: 'Toca cualquier producto para ver sus fotos y precio en $ y Bs. Presiona "Agregar al Carrito" cuando lo decidas.'
    },
    {
      icon: 'list',
      title: 'Sigue tus pedidos',
      desc: 'En "Mis Pedidos" puedes ver tu historial y rastrear en vivo la entrega a domicilio desde la barra inferior.'
    },
    {
      icon: 'creditCard',
      title: 'Pago a la entrega',
      desc: 'Elige retiro en tienda o delivery. Los beneficiados pueden pedir a crédito y revisar su saldo en "Mi Cuenta".'
    }
  ];
  const [stepIdx, setStepIdx] = useState(0);

  // Avanza automáticamente al siguiente paso; al terminar, cierra el tour.
  useEffect(() => {
    const t = setTimeout(() => {
      if (stepIdx < steps.length - 1) setStepIdx((i) => i + 1);
      else onClose();
    }, 7000);
    return () => clearTimeout(t);
  }, [stepIdx, steps.length, onClose]);

  const s = steps[stepIdx];

  return (
    <div className="fixed inset-0 z-[75] flex flex-col justify-end bg-slate-950/70 backdrop-blur-sm animate-fade-in" role="dialog" aria-label="Tour de bienvenida">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative m-4 sm:m-6 bg-slate-900 border border-teal-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl animate-screen-up space-y-4">
        <div className="flex items-start gap-3.5">
          <span className="p-2.5 rounded-2xl bg-teal-500/20 text-teal-400 shrink-0">
            <Icon name={s.icon} className="w-6 h-6" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-teal-400 mb-1">
              Conoce la app · {stepIdx + 1}/{steps.length}
            </p>
            <h3 className="text-base font-black text-white">{s.title}</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{s.desc}</p>
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs text-slate-500 hover:text-white transition-colors"
          >
            Omitir
          </button>
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === stepIdx ? 'w-6 bg-teal-400' : 'w-1.5 bg-slate-700'}`}
              />
            ))}
          </div>
          <button
            onClick={() => {
              if (stepIdx < steps.length - 1) setStepIdx((i) => i + 1);
              else onClose();
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 text-xs font-bold hover:from-teal-400 hover:to-emerald-400 transition-all active:scale-95"
          >
            {stepIdx < steps.length - 1 ? 'Siguiente' : '¡Listo!'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Onboarding visual: secuencia de bienvenida antes de entrar a la tienda.
// Tarjetas deslizables con identidad del negocio, qué vendemos, cómo pedir en
// 3 pasos y métodos de pago. Se muestra una vez (localStorage).
function KioskoOnboarding({ onFinish }) {
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

// Modo vitrina "kiosko siempre abierto": carrusel de atracción que se enciende
// tras inactividad. Rota promos y productos destacados; cualquier tap reanuda.
function ShowcaseMode({ products, promos, rate, onResume, onOrderNow, onOpenProduct }) {
  const [stepIdx, setStepIdx] = useState(0);

  // Carrusel de items: promos con imagen + productos con stock.
  const items = useMemo(() => {
    const list = [];
    const activePromos = Array.isArray(promos) ? promos.filter((p) => p.active && p.image) : [];
    activePromos.forEach((p) => list.push({ kind: 'promo', label: p.title, sub: p.subtitle, image: p.image }));
    const withImage = (Array.isArray(products) ? products : []).filter((p) => p.image && Math.max(0, (Number(p.stock) || 0) - (Number(p.reserved) || 0)) > 0);
    withImage.slice(0, 8).forEach((p) => list.push({ kind: 'product', product: p, label: p.name, sub: p.brand || p.category, image: p.image }));
    if (!list.length && Array.isArray(products) && products.length) {
      products.slice(0, 6).forEach((p) => list.push({ kind: 'product', product: p, label: p.name, sub: p.category, image: p.image }));
    }
    return list;
  }, [promos, products]);

  useEffect(() => {
    if (items.length <= 1) return undefined;
    const id = setInterval(() => setStepIdx((i) => (i + 1) % items.length), 4000);
    return () => clearInterval(id);
  }, [items.length]);

  // Silencio: cualquier tap reanuda la navegación normal.
  const resume = () => {
    haptic(8);
    onResume?.();
  };

  const item = items.length ? items[stepIdx % items.length] : null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950 overflow-hidden select-none"
      role="region"
      aria-label="Modo vitrina del kiosko"
      onClick={resume}
    >
      {/* Fondo de la tarjeta actual en rotación */}
      {item?.image && (
        <div
          key={stepIdx}
          className="absolute inset-0 bg-cover bg-center showcase-kenburns"
          style={{ backgroundImage: `url(${item.image.replace('w=500', 'w=1400')})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/25" />

      <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 text-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[10px] font-bold uppercase tracking-[0.25em] mb-6">
          <Icon name="store" className="w-3 h-3" /> Kiosko 24/7 · Abierto
        </span>

        <div key={`card-${stepIdx}`} className="showcase-fade">
          {item?.kind === 'promo' ? (
            <>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 mb-2 block">Oferta especial</span>
              <h2 className="font-display text-3xl sm:text-5xl font-black text-white leading-tight max-w-xl">{item.label}</h2>
              {item.sub && <p className="text-white/80 text-sm mt-3 max-w-md">{item.sub}</p>}
            </>
          ) : item?.product ? (
            <>
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300 mb-2 block">
                {item.product.category} {item.product.brand ? `· ${item.product.brand}` : ''}
              </span>
              <h2 className="font-display text-3xl sm:text-5xl font-black text-white leading-tight max-w-xl">{item.product.name}</h2>
              <p className="text-amber-300 font-black text-2xl sm:text-4xl mt-3">
                {formatUsd(item.product.price)}
                {rate?.rate > 0 && (
                  <span className="text-white/70 text-sm sm:text-base font-semibold block mt-1">
                    {formatBs(usdToBs(item.product.price, rate.rate))}
                  </span>
                )}
              </p>
            </>
          ) : (
            <span className="text-lg text-white/80">Descubre el kiosko digital de Empresas Alvarados</span>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (item?.product) onOpenProduct?.(item.product);
            else {
              haptic(12);
              onOrderNow?.();
            }
          }}
          className="mt-10 showcase-pulse-cta px-8 py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 text-base font-black shadow-2xl shadow-teal-500/30 active:scale-95 transition-all"
        >
          {item?.product ? 'Ver detalle y agregar' : 'Pedir ahora'}
        </button>

        <p className="mt-6 text-[11px] text-white/50">Toca en cualquier lugar para continuar navegando</p>
        {items.length > 1 && (
          <div className="mt-3 flex gap-1.5">
            {items.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === stepIdx % items.length ? 'w-5 bg-white' : 'w-1.5 bg-white/25'}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Éxito de pedido cinematográfico: celebración full-screen tras confirmar la
// compra. Confeti, número de pedido gigante, ETA y acciones para seguir o
// compartir por WhatsApp.
function OrderSuccessOverlay({ order, onClose, onTrack, onShare }) {
  const orderNum = order?.id ?? order?.orderId ?? order?.number ?? '';
  const isDelivery = order?.type === 'delivery';
  const eta = order?.estimatedMinutes || (isDelivery ? 25 : 10);
  const items = Array.isArray(order?.items) ? order.items : [];

  // Partículas de confeti con parámetros aleatorios estables por render.
  const confetti = useMemo(
    () =>
      Array.from({ length: 26 }).map((_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 9) * 0.18}s`,
        dur: `${2.2 + (i % 5) * 0.4}s`,
        rot: `${360 + (i % 3) * 240}deg`,
        x: `${(i % 2 === 0 ? 1 : -1) * (24 + (i % 5) * 18)}px`,
        color: ['#2dd4bf', '#34d399', '#fbbf24', '#f472b6', '#818cf8', '#38bdf8'][i % 6]
      })),
    []
  );

  return (
    <div className="fixed inset-0 z-[85] overflow-hidden bg-gradient-to-br from-teal-900 via-slate-950 to-emerald-950 animate-fade-in select-none" role="dialog" aria-label="Pedido realizado con éxito">
      {/* Confeti */}
      {confetti.map((c, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: c.left,
            background: c.color,
            '--confetti-delay': c.delay,
            '--confetti-dur': c.dur,
            '--confetti-rot': c.rot,
            '--confetti-x': c.x
          }}
        />
      ))}

      <div className="relative h-full flex flex-col items-center justify-center px-6 text-center">
        {/* Check dentro de anillo */}
        <div className="success-ring w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white/10 border-2 border-white/30 backdrop-blur-md flex items-center justify-center shadow-2xl shadow-teal-500/40 mb-8">
          <svg className="success-check w-12 h-12 sm:w-14 sm:h-14 text-teal-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>

        <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-teal-200/80 mb-3">Pedido confirmado</span>
        <h2 className="font-display text-3xl sm:text-5xl font-black text-white leading-tight">¡Gracias por tu compra!</h2>

        {/* THEO celebra la compra */}
        <Theo mood="celebrate" className="w-36 h-32 mt-6" />

        <div className="success-order-num mt-8 px-8 py-5 rounded-3xl bg-white/10 border border-white/20 backdrop-blur-md">
          <span className="block text-[11px] font-bold uppercase tracking-widest text-white/60 mb-1">Tu número de pedido</span>
          <span className="block font-display text-5xl sm:text-7xl font-black text-white tracking-tight">#{orderNum}</span>
        </div>

        <p className="mt-6 text-sm text-white/85 flex items-center gap-2">
          <Icon name="clock" className="w-4 h-4 text-teal-300" />
          Estimado: ~{eta} min {isDelivery ? 'para tu entrega' : 'para retirar en tienda'}
        </p>

        {items.length > 0 && (
          <div className="mt-4 w-full max-w-sm max-h-28 overflow-y-auto space-y-1 text-left scrollbar-none">
            {items.slice(0, 6).map((it, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-xs text-white/80">
                <span className="truncate">{it.quantity}× {it.name}</span>
                {Number(it.price) > 0 && <span className="text-white/60 shrink-0">{formatUsd(it.price * it.quantity)}</span>}
              </div>
            ))}
            {items.length > 6 && <p className="text-[11px] text-white/50 text-center pt-1">y {items.length - 6} más…</p>}
          </div>
        )}

        <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full max-w-sm">
          <button
            onClick={onTrack}
            className="flex-1 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 text-sm font-black shadow-xl shadow-teal-500/30 active:scale-95 transition-all showcase-pulse-cta"
          >
            <span className="flex items-center justify-center gap-2">
              <Icon name="navigation" className="w-4 h-4" /> {isDelivery ? 'Seguir mi pedido' : 'Ver mi pedido'}
            </span>
          </button>
          <button
            onClick={onShare}
            className="flex-1 px-5 py-3.5 rounded-2xl bg-green-500/20 border border-green-400/40 text-green-300 text-sm font-bold hover:bg-green-500/30 active:scale-95 transition-all"
          >
            <span className="flex items-center justify-center gap-2">
              <Icon name="whatsapp" className="w-4 h-4" /> Compartir
            </span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-6 text-xs text-white/50 hover:text-white transition-colors"
        >
          Seguir comprando
        </button>
      </div>
    </div>
  );
}

function LoadErrorScreen({ error, onRetry }) {
  // Reintento automático: al volver la conexión se recarga el estado solo.
  useEffect(() => {
    if (typeof onRetry !== 'function') return undefined;
    const onOnline = () => onRetry();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [onRetry]);

  return (
    <div className="py-20 flex flex-col items-center justify-center text-center space-y-5 max-w-md mx-auto animate-fade-in">
      <div className="relative">
        <span className="absolute inset-0 rounded-3xl bg-amber-500/20 blur-xl animate-pulse" aria-hidden="true" />
        <div className="relative rounded-3xl bg-slate-800 border border-amber-500/40 flex items-end justify-center px-4 pt-2">
          <Theo mood="sleep" className="w-28 h-24" />
          <span className="absolute -top-1 right-1 text-[11px] font-black text-slate-400 animate-pulse">z z z</span>
        </div>
      </div>
      <div className="space-y-1.5 px-4">
        <h2 className="text-lg font-black text-white">Sin conexión</h2>
        <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
        <p className="text-[11px] text-slate-500">
          Theo duerme hasta que vuelva tu internet — reintentamos automáticamente.
        </p>
      </div>
      <button
        onClick={onRetry}
        className="px-5 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-sm hover:from-teal-400 hover:to-emerald-400 shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
      >
        <Icon name="refresh" className="w-4 h-4" />
        Reintentar ahora
      </button>
    </div>
  );
}

function AdminLoginView({ onLogin, onBiometricLogin, onBiometricRegister, onBack, initialPhone = null }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  // "Recordar sesión": mantiene el login al cerrar/reabrir la pestaña.
  const [remember, setRemember] = useState(() => getRememberSession());

  // Login state
  const [loginPhone, setLoginPhone] = useState(() => ({
    code: initialPhone?.code || '0412',
    number: initialPhone?.number || ''
  }));

  // Biometric login state
  const [bioStatus, setBioStatus] = useState('idle'); // 'idle' | 'working' | 'register'
  const [bioError, setBioError] = useState('');
  const [bioOptions, setBioOptions] = useState(null);
  const [bioNeedsRegister, setBioNeedsRegister] = useState(false);
  const bioFetchKeyRef = useRef('');

  // NEW: Detectar si el dispositivo soporta WebAuthn (huella/Face ID)
  // Usamos los mismos checks que en la App principal para consistencia.
  const [webauthnSupported, setWebauthnSupported] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = browserSupportsWebAuthn();
      let platformOk = false;
      if (supported) {
        try { platformOk = await hasRealBiometrics(); } catch { platformOk = false; }
      }
      if (!cancelled) setWebauthnSupported(supported && platformOk);
    })();
    return () => { cancelled = true; };
  }, []);

  // Recovery state

  // Recovery state
  const [recoverMode, setRecoverMode] = useState(false);
  const [recoverStep, setRecoverStep] = useState('phone'); // 'phone' | 'biometric' | 'newpass'
  const [recoverPhone, setRecoverPhone] = useState({ code: '0412', number: '' });
  const [recoverOptions, setRecoverOptions] = useState(null);
  const [biometricResponse, setBiometricResponse] = useState(null);
  const [newPassword, setNewPassword] = useState({ a: '', b: '' });
  const [showNewPassword, setShowNewPassword] = useState({ a: false, b: false });
  const [recoverError, setRecoverError] = useState('');

  // Pre-carga los options de WebAuthn al completar el teléfono para que
  // startAuthentication se llame de forma síncrona en el tap (requisito de iOS
  // para mostrar el prompt de Face ID en lugar de solo la biometría).
  // Solo se hace UN fetch por teléfono: prefetches solapados pisan el challenge
  // en el server y rompen la verificación ("Unexpected authentication response challenge").
  const recoveryFetchKeyRef = useRef('');
  useEffect(() => {
    const valid = recoverMode && recoverStep === 'phone' && /^\d{7}$/.test(recoverPhone.number);
    if (!valid) return undefined;
    const phoneKey = `${recoverPhone.code}${recoverPhone.number}`.replace(/\D/g, '').slice(-11);
    if (recoveryFetchKeyRef.current === phoneKey) return undefined;
    let cancelled = false;
    api
      .webauthnLoginOptions({ phone: phoneKey })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          recoveryFetchKeyRef.current = phoneKey;
          setRecoverOptions(res.data.options);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [recoverMode, recoverStep, recoverPhone.code, recoverPhone.number]);

  // Pre-carga las opciones de biometría del login admin al completar el teléfono.
  // Solo se hace UN fetch por teléfono: prefetches solapados pisan el challenge
  // en el server y rompen la verificación.
  useEffect(() => {
    const valid = !recoverMode && /^\d{7}$/.test(loginPhone.number);
    if (!valid) return undefined;
    const phoneKey = `${loginPhone.code}${loginPhone.number}`.replace(/\D/g, '').slice(-11);
    if (bioFetchKeyRef.current === phoneKey) return undefined;
    let cancelled = false;
    api
      .webauthnLoginOptions({ phone: phoneKey })
      .then((res) => {
        if (cancelled) return;
        bioFetchKeyRef.current = phoneKey;
        if (res.ok) {
          setBioNeedsRegister(false);
          setBioOptions(res.data.options);
        } else if (res.status === 404) {
          // No hay biometría registrada en este dominio: el tap debe REGISTRAR
          // (primera vez en este ambiente) en vez de mostrar "no está lista".
          setBioNeedsRegister(true);
          setBioOptions(null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [recoverMode, loginPhone.code, loginPhone.number]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^\d{7}$/.test(loginPhone.number)) {
      setError('Ingresa tu teléfono de administrador.');
      return;
    }
    if (!password) {
      setError('Ingresa la contraseña de administrador.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const phoneKey = `${loginPhone.code}${loginPhone.number}`.replace(/\D/g, '').slice(-11);
      const ok = await onLogin(phoneKey, password);
      if (!ok) setError('Contraseña incorrecta. Verifica tu teléfono y contraseña.');
    } catch {
      setError('No se pudo conectar con el servidor. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Login admin con biometría (huella/Face ID). El teléfono es obligatorio y
  // la biometría reemplaza la contraseña. Si no hay biometría registrada para
  // ese teléfono en este dominio, se registra en el momento (primera vez).
  const handleBiometricLogin = async () => {
    if (!/^\d{7}$/.test(loginPhone.number)) {
      setError('Ingresa tu teléfono de administrador.');
      return;
    }
    const phoneKey = `${loginPhone.code}${loginPhone.number}`.replace(/\D/g, '').slice(-11);
    setError('');
    setBioError('');
    // Si el prefetch aún no cargó las options, las pedimos ahora en lugar de
    // fallar con "no está lista". Así el tap siempre funciona.
    if (bioFetchKeyRef.current !== phoneKey) {
      try {
        const res = await api.webauthnLoginOptions({ phone: phoneKey });
        if (res.ok) {
          bioFetchKeyRef.current = phoneKey;
          setBioNeedsRegister(false);
          setBioOptions(res.data.options);
        } else if (res.status === 404) {
          bioFetchKeyRef.current = phoneKey;
          setBioNeedsRegister(true);
          setBioOptions(null);
        } else {
          setBioError(`No se pudo iniciar la verificación con ${BIO_METHOD_LABEL}. Intenta de nuevo.`);
          return;
        }
      } catch {
        setBioError('No se pudo conectar con el servidor. Intenta de nuevo.');
        return;
      }
    }
    setBioStatus('working');
    try {
      // Primera vez en este dominio (staging/producción): registra la biometría.
      if (bioNeedsRegister || !bioOptions) {
        setBioStatus('register');
        const rres = await api.webauthnRegisterOptions({ phone: phoneKey, customerName: 'Administrador' });
        if (!rres.ok) throw new Error(rres.data.error || 'No se pudo iniciar el registro');
        const regResponse = await startRegistration({ optionsJSON: rres.data.options });
        const ok = await onBiometricRegister(phoneKey, regResponse);
        if (!ok) setBioError(`No se pudo guardar tu ${BIO_METHOD_LABEL}. Intenta de nuevo.`);
        setBioNeedsRegister(false);
        return;
      }
      const authResponse = await startAuthentication({ optionsJSON: bioOptions });
      const ok = await onBiometricLogin(phoneKey, authResponse);
      if (!ok) setBioError((IS_IOS ? 'Face ID no coincidió' : `La ${BIO_METHOD_LABEL} no coincidió`) + '. Verifica que tu número sea de administrador.');
    } catch (err) {
      // Si la credencial se registró bajo un rpID anterior (dominio distinto),
      // el navegador la rechaza con NotAllowedError. Re-registramos en el rpID
      // actual para que quede válida.
      const isRpidMismatch = err?.name === 'NotAllowedError';
      if (!isRpidMismatch) {
        setBioError(friendlyAuthError(err));
        setBioStatus('idle');
        return;
      }
      try {
        setBioStatus('register');
        const rres = await api.webauthnRegisterOptions({ phone: phoneKey, customerName: 'Administrador' });
        if (!rres.ok) throw new Error(rres.data.error || 'No se pudo iniciar el re-registro');
        const regResponse = await startRegistration({ optionsJSON: rres.data.options });
        const ok = await onBiometricRegister(phoneKey, regResponse);
        if (!ok) setBioError(`No se pudo guardar tu ${BIO_METHOD_LABEL}. Intenta de nuevo.`);
      } catch (regErr) {
        setBioError(friendlyAuthError(regErr));
      }
    } finally {
      setBioStatus('idle');
    }
  };

  const startRecovery = async () => {
    if (!/^\d{7}$/.test(recoverPhone.number)) {
      setRecoverError('Ingresa el número de teléfono de administrador.');
      return;
    }
    const phoneKey = `${recoverPhone.code}${recoverPhone.number}`.replace(/\D/g, '').slice(-11);
    setRecoverError('');
    // Sin biometría (dispositivo sin Face ID/huella): se recupera solo con el
    // teléfono admin, sin verificación biométrica (el server acepta response null).
    if (!webauthnSupported) {
      setBiometricResponse(null);
      setRecoverStep('newpass');
      return;
    }
    // Si el prefetch no terminó, pedimos las options ahora en vez de fallar.
    if (recoveryFetchKeyRef.current !== phoneKey || !recoverOptions) {
      try {
        const res = await api.webauthnLoginOptions({ phone: phoneKey });
        if (!res.ok) {
          // Sin biometría registrada para ese teléfono en este dominio (p.ej.
          // staging): se recupera igual con solo el teléfono admin.
          recoveryFetchKeyRef.current = phoneKey;
          setBiometricResponse(null);
          setRecoverStep('newpass');
          return;
        }
        recoveryFetchKeyRef.current = phoneKey;
        setRecoverOptions(res.data.options);
      } catch {
        setRecoverError('No se pudo conectar con el servidor. Intenta de nuevo.');
        return;
      }
    }
    setRecoverStep('biometric');
    try {
      const authResponse = await startAuthentication({ optionsJSON: recoverOptions });
      setBiometricResponse(authResponse);
      setRecoverStep('newpass');
      setRecoverError('');
    } catch {
      // Si la verificación biométrica falla o se cancela, permitimos continuar
      // igual: el server acepta response null y valida solo el teléfono admin.
      setBiometricResponse(null);
      setRecoverStep('newpass');
      setRecoverError('');
    }
  };

  const submitNewPassword = async () => {
    if (newPassword.a !== newPassword.b) {
      setRecoverError('Las contraseñas no coinciden.');
      return;
    }
    if (newPassword.a.length < 6) {
      setRecoverError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    const phoneKey = `${recoverPhone.code}${recoverPhone.number}`.replace(/\D/g, '').slice(-11);
    setRecoverError('');
    const res = await api.recoverPassword(phoneKey, biometricResponse, newPassword.a);
    if (!res.ok) {
      setRecoverError(res.data.error || 'No se pudo recuperar la contraseña.');
      return;
    }
    setRecoverMode(false);
    setRecoverStep('phone');
    setNewPassword({ a: '', b: '' });
    recoveryFetchKeyRef.current = '';
    setRecoverOptions(null);
    setBiometricResponse(null);
    setRecoverPhone({ code: '0412', number: '' });
    setError('Contraseña restablecida. Ahora puedes iniciar sesión.');
  };

  if (recoverMode) {
    return (
      <div className="py-8 sm:py-16 flex items-center justify-center">
        <div className="w-full max-w-md bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 sm:p-8 shadow-2xl backdrop-blur-md space-y-6">
          <div className="text-center space-y-2">
            <span className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <Icon name="key" className="w-7 h-7" />
            </span>
            <h2 className="text-xl font-black text-white">Recuperar Contraseña</h2>
            <p className="text-xs text-slate-400">Ingresa tu teléfono de administrador y crea una nueva contraseña.</p>
          </div>

          {recoverStep === 'phone' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Teléfono de administrador</label>
                <div className="flex gap-2">
                  <select
                    value={recoverPhone.code}
                    onChange={(e) => setRecoverPhone({ ...recoverPhone, code: e.target.value })}
                    className="w-24 shrink-0 px-3 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm font-bold focus:border-amber-500 focus:outline-none"
                  >
                    {PHONE_CODES.map((code) => (<option key={code} value={code}>{code}</option>))}
                  </select>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={recoverPhone.number}
                    onChange={(e) => setRecoverPhone({ ...recoverPhone, number: e.target.value.replace(/\D/g, '').slice(0, 7) })}
                    placeholder="1234567"
                    maxLength={7}
                    className="w-full px-4 py-3 glass-strong bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              {recoverError && <p className="text-xs text-rose-400 mt-2">{recoverError}</p>}
              <button
                onClick={startRecovery}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-bold text-sm hover:from-amber-400 hover:to-rose-400 shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                Continuar
              </button>
            </div>
          )}

          {recoverStep === 'biometric' && (
            <div className="text-center space-y-3">
              <p className="text-xs text-slate-400">Esperando {IS_IOS ? 'tu Face ID' : IS_ANDROID ? 'tu huella' : 'la verificación biométrica'}...</p>
            </div>
          )}

          {recoverStep === 'newpass' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nueva contraseña</label>
                <div className="relative">
                  <input
                    type={showNewPassword.a ? 'text' : 'password'}
                    value={newPassword.a}
                    onChange={(e) => setNewPassword({ ...newPassword, a: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-4 py-3 pr-11 glass-strong bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((s) => ({ ...s, a: !s.a }))}
                    aria-label={showNewPassword.a ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-100 transition-colors"
                  >
                    <Icon name={showNewPassword.a ? 'eyeOff' : 'eye'} className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Repetir contraseña</label>
                <div className="relative">
                  <input
                    type={showNewPassword.b ? 'text' : 'password'}
                    value={newPassword.b}
                    onChange={(e) => setNewPassword({ ...newPassword, b: e.target.value })}
                    placeholder="Repite la contraseña"
                    className="w-full px-4 py-3 pr-11 glass-strong bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((s) => ({ ...s, b: !s.b }))}
                    aria-label={showNewPassword.b ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-100 transition-colors"
                  >
                    <Icon name={showNewPassword.b ? 'eyeOff' : 'eye'} className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {recoverError && <p className="text-xs text-rose-400 mt-2">{recoverError}</p>}
              <button
                onClick={submitNewPassword}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-bold text-sm hover:from-amber-400 hover:to-rose-400 shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                Guardar nueva contraseña
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => { setRecoverMode(false); setRecoverStep('phone'); setRecoverError(''); setNewPassword({ a: '', b: '' }); recoveryFetchKeyRef.current = ''; setRecoverOptions(null); setBiometricResponse(null); setRecoverPhone({ code: '0412', number: '' }); }}
            className="w-full py-2 text-xs text-slate-400 hover:text-white transition-colors"
          >
            ← Volver al login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 sm:py-16 flex items-center justify-center">
      <div className="w-full max-w-md bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 sm:p-8 shadow-2xl backdrop-blur-md space-y-6">
        <div className="text-center space-y-2">
          <span className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-cyan-500/20">
            <Icon name="layers" className="w-7 h-7" />
          </span>
          <h2 className="text-xl font-black text-white">Acceso al Panel Admin</h2>
          <p className="text-xs text-slate-400">Inicia sesión con tu contraseña o {BIO_METHOD_LABEL} para gestionar inventario y pedidos.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Teléfono de administrador</label>
            <div className="flex gap-2">
              <select
                value={loginPhone.code}
                onChange={(e) => setLoginPhone({ ...loginPhone, code: e.target.value })}
                className="w-24 shrink-0 px-3 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm font-bold focus:border-cyan-500 focus:outline-none"
              >
                {PHONE_CODES.map((code) => (<option key={code} value={code}>{code}</option>))}
              </select>
              <input
                type="tel"
                inputMode="numeric"
                value={loginPhone.number}
                onChange={(e) => setLoginPhone({ ...loginPhone, number: e.target.value.replace(/\D/g, '').slice(0, 7) })}
                placeholder="1234567"
                maxLength={7}
                className="w-full px-4 py-3 glass-strong bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-cyan-500 focus:outline-none"
              />
            </div>
            {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
            {bioError && <p className="text-xs text-rose-400 mt-2">{bioError}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 pr-11 glass-strong bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-cyan-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-100 transition-colors"
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} className="w-5 h-5" />
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => {
                setRemember(e.target.checked);
                setRememberSession(e.target.checked);
              }}
              className="w-4 h-4 rounded accent-cyan-500"
            />
            <span className="text-xs text-slate-300 font-semibold">Recordar sesión en este dispositivo</span>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-bold text-sm hover:from-cyan-400 hover:to-blue-400 shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60"
          >
            <Icon name="check" className="w-4 h-4" />
            {isSubmitting ? 'Verificando...' : 'Iniciar sesión'}
          </button>

          {/* Biometría: debajo de Iniciar sesión, sin separador */}
          {webauthnSupported && (
            <button
              type="button"
              onClick={handleBiometricLogin}
              disabled={isSubmitting || bioStatus === 'working' || bioStatus === 'register'}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl bg-slate-800/70 border border-cyan-500/30 hover:border-cyan-400/60 hover:bg-slate-700/60 text-slate-200 transition-all disabled:opacity-60"
            >
              {bioStatus === 'working' || bioStatus === 'register' ? (
                <>
                  {IS_IOS ? <Icon name="apple" className="w-5 h-5" /> : <Icon name="fingerprint" className="w-5 h-5" />}
                  <span>{bioStatus === 'working' ? 'Esperando...' : 'Registrando...'}</span>
                </>
              ) : IS_IOS ? (
                <>
                  <Icon name="apple" className="w-5 h-5" />
                  <Icon name="faceId" className="w-5 h-5" />
                  <span className="font-semibold">Entrar con Face ID</span>
                </>
              ) : (
                <>
                  <Icon name="fingerprint" className="w-6 h-6" />
                  <span className="font-semibold">Entrar con huella</span>
                </>
              )}
            </button>
          )}
        </form>

        <div className="pt-2 border-t border-slate-800 space-y-2">
          <button
            type="button"
            onClick={() => setRecoverMode(true)}
            className="w-full py-2 text-xs text-amber-300 hover:text-amber-200 hover:bg-slate-800/60 rounded-xl transition-all flex items-center justify-center gap-1.5"
          >
            <Icon name="key" className="w-3.5 h-3.5" />
            ¿Olvidaste tu contraseña? Recuperar con {BIO_METHOD_LABEL}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="w-full py-2 text-xs text-slate-400 hover:text-white transition-colors"
          >
            ← Volver a la tienda
          </button>
        </div>
      </div>
    </div>
  );
}

// Captura errores de render para no dejar la pantalla en blanco sin aviso.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-red-500/40 rounded-3xl p-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center mb-3">
              <Icon name="alertTriangle" className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-base font-black text-white mb-1">Algo salió mal</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Ocurrió un problema inesperado al cargar esta sección. Toca Reintentar para intentarlo de nuevo.
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="w-full py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-sm font-bold hover:bg-red-500/30 transition-all"
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function CustomerView({
  products,
  allProducts,
  categories,
  selectedCategory,
  setSelectedCategory,
  searchQuery,
  setSearchQuery,
  sortOption,
  setSortOption,
  stickyTop,
  rate,
  promos,
  onAddToCart,
  onOpenProductModal,
  currentOrderTracking,
  setCurrentOrderTracking,
  savedCustomer,
  lastOrderForCustomer,
  onRepeatLastOrder,
  customerOrders,
  orders,
  customerProfile,
  storeLocation,
  favorites,
  onToggleFavorite,
   focusSection,
   onOpenDebt,
   onOpenMyKiosko,
   onOpenVoice,
   guestShare,
   guestAdded,
   vtProductId
 }) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [promoIdx, setPromoIdx] = useState(0);
  // Recorrido Horizontal: apagado por defecto; el usuario lo enciende con el switch.
  const [shelvesEnabled, setShelvesEnabled] = useState(false);
  // Carrusel de promos con autoplay (solo cuando hay más de una activa)
  const activePromos = promos.filter((p) => p.active);
  useEffect(() => {
    if (activePromos.length <= 1) return undefined;
    const id = setInterval(() => setPromoIdx((i) => (i + 1) % activePromos.length), 5000);
    return () => clearInterval(id);
  }, [activePromos.length]);
  const safePromoIdx = activePromos.length > 0 ? promoIdx % activePromos.length : 0;

  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.brand || '').toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [allProducts, searchQuery]);

  // Producto habitual del cliente que esté por agotarse: alerta proactiva para
  // reponerlo antes de que se acabe. Basado en su historial de pedidos.
  const runOutAlertProduct = useMemo(() => {
    if (!savedCustomer?.customerName || !customerOrders.length) return null;
    const freq = {};
    customerOrders.forEach((o) =>
      (o.items || []).forEach((it) => {
        freq[it.id] = (freq[it.id] || 0) + (Number(it.quantity) || 0);
      })
    );
    const candidates = Object.entries(freq)
      .map(([id, qty]) => {
        const p = (allProducts || []).find((x) => x.id === id);
        return p ? { product: p, qty } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.qty - a.qty);
    return (
      candidates.find(
        (c) => c.product.runOutDays != null && c.product.runOutDays > 0 && c.product.runOutDays <= 2
      )?.product || null
    );
   }, [customerOrders, allProducts, savedCustomer?.customerName]);

  // Tilt 3D (#13): variables CSS globales alimentadas por giroscopio
  // (Android directo; iOS pide permiso en el primer toque) o puntero en desktop.
  const tiltRootRef = useRef(null);
  useEffect(() => {
    const el = tiltRootRef.current;
    if (!el) return undefined;
    let raf = 0;
    let tx = 0, ty = 0;
    const apply = () => {
      raf = 0;
      el.style.setProperty('--tilt-x', tx.toFixed(3));
      el.style.setProperty('--tilt-y', ty.toFixed(3));
    };
    const setTilt = (nx, ny) => { tx = nx; ty = ny; if (!raf) raf = requestAnimationFrame(apply); };
    const onOrient = (e) => {
      const gamma = e.gamma ?? 0;
      const beta = e.beta ?? 0;
      setTilt(Math.max(-1, Math.min(1, gamma / 25)), Math.max(-1, Math.min(1, (beta - 40) / 30)));
    };
    const onMouse = (e) => {
      const r = el.getBoundingClientRect();
      setTilt(((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2);
    };
    let listeningOri = false;
    let once = null;
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS: requiere gesto del usuario; se intenta una sola vez.
      once = () => {
        DeviceOrientationEvent.requestPermission()
          .then((s) => {
            if (s === 'granted') { window.addEventListener('deviceorientation', onOrient); listeningOri = true; }
          })
          .catch(() => {});
      };
      window.addEventListener('touchend', once, { once: true });
    } else if (typeof DeviceOrientationEvent !== 'undefined') {
      window.addEventListener('deviceorientation', onOrient);
      listeningOri = true;
    }
    el.addEventListener('mousemove', onMouse);
    return () => {
      if (listeningOri) window.removeEventListener('deviceorientation', onOrient);
      if (once) window.removeEventListener('touchend', once);
      el.removeEventListener('mousemove', onMouse);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // ── Pull-to-refresh de marca (#14): Theo se estira; al soltar recarga ──
  const [ptrPull, setPtrPull] = useState(0);
  const ptrPullRef = useRef(0);
  const ptrState = useRef({ startY: null, firing: false });
  const setPull = (v) => { ptrPullRef.current = v; setPtrPull(v); };
  useEffect(() => {
    const onStart = (e) => {
      ptrState.current.startY = (window.scrollY || 0) <= 2 && e.touches?.length ? e.touches[0].clientY : null;
    };
    const onMove = (e) => {
      if (ptrState.current.startY == null || !e.touches?.length) return;
      const dy = e.touches[0].clientY - ptrState.current.startY;
      if (dy <= 0) { setPull(0); return; }
      setPull(Math.min(96, dy * 0.55));
      if (e.cancelable && dy > 8) e.preventDefault();
    };
    const onEnd = () => {
      const pull = ptrPullRef.current;
      ptrState.current.startY = null;
      if (pull >= 60 && !ptrState.current.firing) {
        ptrState.current.firing = true;
        haptic('success');
        sfx.ready();
        try { window.dispatchEvent(new CustomEvent('kiosko:ptr-refresh')); } catch {}
        setTimeout(() => { ptrState.current.firing = false; setPull(0); }, 900);
      } else {
        setPull(0);
      }
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, []);

  // Radar de Ofertas "Novedades": combina productos nuevos, por agotarse
  // y los más pedidos por este cliente, sin repetir, en orden de prioridad.
  const radarProducts = useMemo(() => {
    if (!Array.isArray(allProducts) || allProducts.length === 0) return [];
    const freq = {};
    (customerOrders || []).forEach((o) =>
      (o.items || []).forEach((it) => {
        freq[it.id] = (freq[it.id] || 0) + (Number(it.quantity) || 0);
      })
    );
    const seen = new Set();
    const list = [];
    const push = (p, tag) => {
      if (!p || seen.has(p.id)) return;
      seen.add(p.id);
      list.push({ product: p, tag });
    };
    (allProducts || [])
      .filter(isNewProduct)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .forEach((p) => push(p, 'Nuevo'));
    (allProducts || [])
      .filter((p) => p.runOutDays != null && p.runOutDays > 0 && p.runOutDays <= 3)
      .sort((a, b) => a.runOutDays - b.runOutDays)
      .forEach((p) => push(p, 'Se agota'));
    Object.entries(freq)
      .map(([id, qty]) => ({ p: (allProducts || []).find((x) => x.id === id), qty }))
      .filter((x) => x.p)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6)
      .forEach((x) => push(x.p, 'Frecuente'));
    return list.slice(0, 12);
  }, [allProducts, customerOrders]);

  // Vitrina "Los más pedidos": top de ventas globales derivado de los pedidos reales
  // (no requiere campo featured en la base). Si aún no hay pedidos, cae a stock alto.
  const topSellers = useMemo(() => {
    if (!Array.isArray(allProducts) || allProducts.length === 0) return [];
    const demand = {};
    (orders || []).forEach((o) =>
      (o.items || []).forEach((it) => {
        demand[it.id] = (demand[it.id] || 0) + (Number(it.quantity) || 0);
      })
    );
    const ranked = allProducts
      .map((p) => ({ p, qty: demand[p.id] || 0 }))
      .sort((a, b) => b.qty - a.qty || Number(b.p.stock || 0) - Number(a.p.stock || 0));
    return ranked.slice(0, 5).map((x) => x.p);
  }, [allProducts, orders]);

  // Estantes del recorrido virtual: agrupa los productos visibles por categoría,
  // en el orden de las categorías de la tienda (máx. 6 pisos, todos los
  // productos de cada góndola — el scroll/deslizamiento los recorre).
  const shelfGroups = useMemo(() => {
    if (!Array.isArray(products) || products.length === 0) return [];
    const byCat = {};
    products.forEach((p) => {
      const c = p.category || 'Otros';
      (byCat[c] = byCat[c] || []).push(p);
    });
    const order = [...new Set([...categories, ...Object.keys(byCat)])];
    return order
      .filter((c) => byCat[c] && byCat[c].length > 0)
      .map((c) => ({ category: c, items: byCat[c] }))
      .slice(0, 6);
  }, [products, categories]);

  // Efecto parallax del hero: la foto de fondo se desplaza más lento que el scroll.
  const heroRef = useRef(null);
  const [heroOffset, setHeroOffset] = useState(0);
  const reducedMotionHero =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    if (reducedMotionHero) return undefined;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = heroRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        setHeroOffset(Math.max(-60, Math.min(60, r.top * -0.22)));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [reducedMotionHero]);

  // La barra inferior (móvil) pide expandir y scrollear a Mi Cuenta (Mis Pedidos viven en el drawer)
  useEffect(() => {
    if (!focusSection) return;
    const timer = setTimeout(() => {
      if (focusSection === 'account') onOpenDebt?.('saldo');
      const el = document.getElementById('cuenta-seccion');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
    return () => clearTimeout(timer);
  }, [focusSection, onOpenDebt]);

  return (
    <div ref={tiltRootRef} className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Pull-to-refresh de marca (#14): indicador con Theo */}
      {ptrPull > 2 && (
        <div
          className="fixed top-[calc(env(safe-area-inset-top,0px)+0.75rem)] left-1/2 -translate-x-1/2 z-[60] pointer-events-none flex flex-col items-center"
          style={{ transform: `translate(-50%, ${Math.min(ptrPull, 96)}px)` }}
        >
          <Theo mood="pull" className="w-20 h-16" />
          <span className="text-[10px] font-black text-teal-300 mt-0.5">
            {ptrPull >= 60 ? '¡Suelta para actualizar!' : 'Tira para actualizar'}
          </span>
        </div>
      )}
      {/* Hero editorial: foto real del producto estrella con efecto parallax */}
      <RevealOnScroll>
      <div
        ref={heroRef}
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-700/60 shadow-2xl min-h-[300px] sm:min-h-[340px]"
      >
        {/* Foto de fondo (más alta que el contenedor para permitir el parallax) */}
        {topSellers[0]?.image ? (
          <div
            className="absolute inset-x-0 -top-16 -bottom-16 bg-cover bg-center will-change-transform"
            style={{
              backgroundImage: `url(${topSellers[0].image.replace('w=500', 'w=1600')})`,
              transform: reducedMotionHero ? undefined : `translate3d(0, ${heroOffset}px, 0)`
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-teal-900/60 via-slate-900 to-indigo-950/70" />
        )}
        {/* Overlay oscuro para legibilidad del texto */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-teal-950/60 via-transparent to-transparent" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 sm:gap-6 p-5 sm:p-10 pt-8 sm:pt-14 min-h-[300px] sm:min-h-[340px]">
          <div className="space-y-3 max-w-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/25 text-teal-200 border border-teal-400/40 text-[10px] sm:text-xs font-semibold uppercase tracking-wider backdrop-blur-md">
              <Icon name="zap" className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              Pedidos al momento
            </span>
            <h2 className="font-display text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              ¿Qué se te antoja hoy?
            </h2>
            <p className="hidden sm:block text-slate-200 text-sm leading-relaxed max-w-md">
              Explora nuestros antojos, bebidas frías y snacks. Paga y retira sin hacer filas o recibe en tu puerta.
            </p>
          </div>

          {/* Tasa BCV card */}
          <div className="w-full sm:w-auto shrink-0 p-3.5 sm:p-4 rounded-2xl bg-slate-950/70 border border-teal-500/30 backdrop-blur-md shadow-lg">
            <span className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Icon name="dollarSign" className="w-3.5 h-3.5 text-teal-400" />
              Tasa BCV
            </span>
            <span className="block text-lg sm:text-xl font-black text-white mt-0.5 sm:mt-1">
              1 US$ = <span className="text-teal-300">{rate?.rate ? rate.rate.toLocaleString('es-AR') : '—'} Bs</span>
            </span>
            {rate?.date && (
              <span className="text-[10px] text-slate-500 mt-0.5 sm:mt-1 block">
                {rate.source} · {new Date(rate.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
              </span>
            )}
          </div>
        </div>
      </div>
      </RevealOnScroll>

      {/* Promos Carousel */}
      {activePromos.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl">
          <div
            key={activePromos[safePromoIdx].id}
            className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-rose-500/10 border border-amber-500/30 animate-fade-in"
          >
            {activePromos[safePromoIdx].image && (
              <img
                src={activePromos[safePromoIdx].image}
                alt={activePromos[safePromoIdx].title}
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl object-cover border border-amber-500/30 shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <Icon name="sparkles" className="w-3 h-3" /> Promo {activePromos.length > 1 ? `${safePromoIdx + 1}/${activePromos.length}` : ''}
              </span>
              <h4 className="font-bold text-white text-sm truncate">{activePromos[safePromoIdx].title}</h4>
              {activePromos[safePromoIdx].subtitle && (
                <p className="text-xs text-slate-300 line-clamp-1 sm:line-clamp-2">{activePromos[safePromoIdx].subtitle}</p>
              )}
            </div>
          </div>

          {/* Dots del carrusel */}
          {activePromos.length > 1 && (
            <div className="absolute bottom-1.5 right-2 flex items-center gap-1">
              {activePromos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPromoIdx(i)}
                  aria-label={`Ver promo ${i + 1}`}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === safePromoIdx ? 'bg-amber-400 w-3' : 'bg-amber-400/30'}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Repetir último pedido del cliente reconocido */}
      {savedCustomer?.customerName && lastOrderForCustomer && (
        <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-teal-500/15 via-cyan-500/10 to-emerald-500/15 border border-teal-500/30 flex items-center gap-3 sm:gap-4">
          <span className="p-2 sm:p-2.5 rounded-xl bg-teal-500/20 text-teal-400 shrink-0">
            <Icon name="refresh" className="w-4 h-4 sm:w-5 sm:h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm sm:text-base font-bold text-white truncate">
              ¡Hola de nuevo, {savedCustomer.customerName.split(' ')[0]}!
            </p>
            <p className="text-[11px] sm:text-xs text-slate-400 truncate">
              Tu último pedido #{lastOrderForCustomer.id} ({lastOrderForCustomer.items.length} artículos) está listo para repetirse.
            </p>
          </div>
          <button
            onClick={onRepeatLastOrder}
            className="shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 text-xs font-bold hover:from-teal-400 hover:to-emerald-400 shadow-lg shadow-teal-500/20 transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Icon name="refresh" className="w-3.5 h-3.5" />
            <span className="hidden min-[360px]:inline">Repetir pedido</span>
          </button>
        </div>
      )}

      {/* Alerta proactiva "Se acaba pronto": producto habitual del cliente */}
      {runOutAlertProduct && (
        <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-rose-500/15 via-orange-500/10 to-amber-500/15 border border-rose-500/30 flex items-center gap-3 sm:gap-4">
          <ProductImg
            product={runOutAlertProduct}
            alt={runOutAlertProduct.name}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover border border-rose-500/30 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-rose-300">
              <Icon name="zap" className="w-3 h-3" /> Se acaba pronto
            </span>
            <p className="text-sm sm:text-base font-bold text-white truncate mt-0.5">
              Tu {runOutAlertProduct.name.toLowerCase()} se agota en ~{Math.ceil(runOutAlertProduct.runOutDays)} día{Math.ceil(runOutAlertProduct.runOutDays) === 1 ? '' : 's'}
            </p>
            <p className="text-[11px] sm:text-xs text-slate-400">
              Te quedan {Math.max(0, Number(runOutAlertProduct.stock) - Number(runOutAlertProduct.reserved || 0))} unidades. ¿Lo agregamos?
            </p>
          </div>
          <Btn
            onClick={(e) => onAddToCart(runOutAlertProduct, 1, e.currentTarget.getBoundingClientRect())}
            variant="primary"
            size="sm"
            icon="plus"
            className="shrink-0 !bg-gradient-to-r !from-rose-500 !to-orange-500 !shadow-lg !shadow-rose-500/20 hover:!from-rose-400 hover:!to-orange-400"
          >
            <span className="hidden min-[360px]:inline">Agregar</span>
          </Btn>
        </div>
      )}

      {/* Mi Cuenta: saldo pendiente del cliente reconocido */}
      {savedCustomer?.customerName && customerProfile && (
        <div id="cuenta-seccion" className="rounded-2xl sm:rounded-3xl bg-slate-800/60 border border-slate-700/60 overflow-hidden backdrop-blur-md">
          <div className="p-3 sm:p-4 flex items-center gap-3">
            <span className="p-2 sm:p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0">
              <Icon name="creditCard" className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            <div className="flex-1 min-w-0">
              <span className="block text-sm sm:text-base font-bold text-white">Mi Cuenta</span>
              {customerProfile.isBenefited ? (
                <span className="block text-[11px] sm:text-xs text-teal-400">
                  Beneficiado · puedes pedir a crédito
                </span>
              ) : (
                <span className="block text-[11px] sm:text-xs text-slate-400">
                  Pago a la entrega
                </span>
              )}
              {Number(customerProfile.balance) < 0 && (
                <span className="block text-[11px] sm:text-xs text-emerald-400 font-bold mt-0.5">
                  <Icon name="check" className="w-3 h-3 inline -mt-0.5" /> Saldo a favor · úsalo al pagar
                </span>
              )}
              {Number(customerProfile.balance) > 0 && (
                <span className="block text-[11px] sm:text-xs text-red-400 font-bold mt-0.5">
                  <Icon name="alertTriangle" className="w-3 h-3 inline -mt-0.5" /> Saldo deudor pendiente
                </span>
              )}
            </div>
            <button
              onClick={() => onOpenDebt?.(Number(customerProfile.balance) < 0 ? 'saldo' : 'deuda')}
              className="text-right shrink-0 flex flex-col items-end gap-1 hover:opacity-90 transition-opacity"
              aria-label="Ver detalle de mi saldo"
            >
              {Number(customerProfile.balance) < 0 ? (
                <>
                  <span className="block text-lg sm:text-xl font-black text-emerald-400">
                    {formatUsd(Math.abs(Number(customerProfile.balance)) || 0)}
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    Mi Cartera <Icon name="chevronRight" className="w-3 h-3" />
                  </span>
                </>
              ) : Number(customerProfile.balance) > 0 ? (
                <>
                  <span className="block text-lg sm:text-xl font-black text-red-400">
                    {formatUsd(Number(customerProfile.balance) || 0)}
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    Mi deuda <Icon name="chevronRight" className="w-3 h-3" />
                  </span>
                </>
              ) : (
                <>
                  <span className="block text-lg sm:text-xl font-black text-white">
                    {formatUsd(0)}
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    Ver saldo <Icon name="chevronRight" className="w-3 h-3" />
                  </span>
                </>
              )}
            </button>
          </div>
          <div className="px-3 sm:px-4 pb-3 sm:pb-4 grid gap-2 grid-cols-2">
            <Btn
              onClick={onOpenMyKiosko}
              variant="primary"
              size="sm"
              icon="zap"
              className="w-full py-2.5"
            >
              Mi historial
            </Btn>
            {Number(customerProfile.balance) > 0 && (
              <Btn
                onClick={() => onOpenDebt?.('deuda')}
                variant="secondary"
                size="sm"
                icon="creditCard"
                className="w-full py-2.5"
              >
                Mi deuda
              </Btn>
            )}
            <Btn
              onClick={() => onOpenDebt?.('saldo')}
              variant="secondary"
              size="sm"
              icon="wallet"
              className="w-full py-2.5"
            >
              Mi saldo
            </Btn>
          </div>
        </div>
      )}

      {/* Live Order Tracker Banner (If customer placed an order recently) */}
      {currentOrderTracking && (
        <div className="p-4 sm:p-6 rounded-3xl bg-slate-800/90 border border-teal-500/40 shadow-xl space-y-4 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <span className="p-2 sm:p-2.5 rounded-2xl bg-teal-500/20 text-teal-400 shrink-0">
                <Icon name="clock" className="w-5 h-5 sm:w-6 sm:h-6 animate-spin-slow" />
              </span>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 truncate">
                  Pedido <span className="text-teal-400">#{currentOrderTracking.id}</span>
                </h3>
                <p className="text-xs text-slate-400">Estimado: ~{currentOrderTracking.estimatedMinutes} mins</p>
              </div>
            </div>
            <button
              onClick={() => setCurrentOrderTracking(null)}
              className="text-xs text-slate-400 hover:text-white p-2 shrink-0"
            >
              Cerrar
            </button>
          </div>

          {/* Stepper Status Bar */}
          <div
            className={`grid gap-1.5 sm:gap-2 pt-1 sm:pt-2 ${
              currentOrderTracking.type === 'delivery' ? 'grid-cols-5' : 'grid-cols-4'
            }`}
          >
            {[
              { key: 'pendiente', label: '1. Recibido' },
              { key: 'en_preparacion', label: '2. Preparando' },
              { key: 'listo', label: '3. Listo' },
              ...(currentOrderTracking.type === 'delivery'
                ? [{ key: 'en_camino', label: '4. En camino' }]
                : []),
              { key: 'entregado', label: currentOrderTracking.type === 'delivery' ? '5. Entregado' : '4. Entregado' }
            ].map((step, idx) => {
              const currentIdx = STATUS_FLOW.indexOf(currentOrderTracking.status);
              const isPassed = idx <= currentIdx;
              const isCurrent = idx === currentIdx;

              return (
                <div key={step.key} className="flex flex-col items-center gap-1.5 sm:gap-2">
                  <div
                    className={`w-full h-1.5 sm:h-2 rounded-full transition-all duration-500 ${
                      isPassed
                        ? 'bg-teal-400 shadow-lg shadow-teal-500/50'
                        : 'bg-slate-700/60'
                    } ${isCurrent ? 'animate-pulse' : ''}`}
                  />
                  <span
                    className={`text-[9px] sm:text-xs font-semibold text-center leading-tight transition-all ${
                      isCurrent
                        ? 'text-teal-300 font-bold scale-110 order-timeline-dot--active'
                        : isPassed
                        ? 'text-slate-300'
                        : 'text-slate-500'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Aviso de pago rechazado: visible sin abrir el detalle */}
          {currentOrderTracking.paymentMethod &&
            currentOrderTracking.paymentMethod !== 'efectivo' &&
            currentOrderTracking.paymentStatus === 'rechazado' && (
              <div className="flex items-start gap-1.5 rounded-xl bg-rose-500/10 border border-rose-500/40 p-2.5 text-[11px] text-rose-200/90">
                <Icon name="alertTriangle" className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
                <span>Tu pago fue rechazado. Suministra otro comprobante
                  {customerProfile?.isBenefited ? ' o pásalo a tu cuenta' : ''} en Ver detalle.</span>
              </div>
            )}

          {/* Mapa de entrega a domicilio (destino + repartidor en vivo) */}
          {currentOrderTracking.type === 'delivery' && (
            <DeliveryMap order={currentOrderTracking} storeLocation={storeLocation} />
          )}
        </div>
      )}

      {/* Search Bar & Category Filter Bar (fija debajo del header) */}
      <div
        className="sticky z-20 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 py-2 sm:py-3 bg-slate-900/95 backdrop-blur-lg border-b border-slate-800/60 space-y-4"
        style={{ top: stickyTop }}
      >
        {/* Banner de invitado: el usuario está sumando al carrito compartido de un dueño */}
        {guestShare && (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-indigo-500/15 border border-indigo-500/40">
            <span className="p-1.5 rounded-xl bg-indigo-500/20 text-indigo-300 shrink-0">
              <Icon name="users" className="w-4 h-4" />
            </span>
            <div className="flex-1 min-w-0">
              <span className="block text-xs font-bold text-white truncate">
                Modo compartido: sumando al pedido de {guestShare.ownerName}
              </span>
              <span className="block text-[11px] text-indigo-200/80">
                {guestAdded > 0 ? `Has agregado ${guestAdded} artículos` : 'Agregá tus antojos y el dueño paga todo junto'}
              </span>
            </div>
          </div>
        )}

        <div className="relative">
          <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Buscar productos, marcas..."
            className="w-full pl-12 pr-24 py-3.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl text-slate-100 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-sm backdrop-blur-md"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-16 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <Icon name="x" className="w-4 h-4" />
            </button>
          )}
          <Btn
            onClick={onOpenVoice}
            variant="tonal"
            size="sm"
            icon="mic"
            className="!absolute right-3 top-1/2 -translate-y-1/2 !p-2.5 !rounded-xl"
            style={{ width: 'auto', height: 'auto' }}
            title="Compra rápida por voz"
            aria-label="Compra rápida por voz"
          ></Btn>

          {/* Autocomplete suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 z-20 glass-strong bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-modal-spring">
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSearchQuery(p.name);
                    setShowSuggestions(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/80 transition-all text-left"
                >
                  <ProductImg product={p} alt={p.name} className="w-9 h-9 rounded-lg object-cover bg-slate-800 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-slate-200 truncate">{p.name}</span>
                    <span className="text-[11px] text-teal-400 font-bold">{formatUsd(p.price)}</span>
                  </div>
                  <Icon name="arrowRight" className="w-4 h-4 text-slate-500" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2.5">
          {/* Category Pills: cada categoría tiene su color e icono de identidad */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {['Todas', ...(savedCustomer ? ['Favoritos'] : []), ...categories].map((cat) => {
              const isFav = cat === 'Favoritos';
              const id = isFav ? null : categoryIdentity(cat);
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-300 border-2 shrink-0 ${
                    active
                      ? isFav
                        ? 'bg-rose-400 text-slate-950 border-rose-300 shadow-lg shadow-rose-500/25 scale-105'
                        : `${id.solid} border-white/40 shadow-lg scale-105`
                      : `bg-slate-800/80 text-slate-200 border-slate-600/80 hover:bg-slate-700/70 hover:text-white`
                  }`}
                >
                  {isFav ? (
                    <Icon name="heart" className={`w-3.5 h-3.5 ${active ? 'fill-current' : ''}`} />
                  ) : (
                    <Icon name={id.icon} className={`w-3.5 h-3.5 ${active ? '' : id.accent}`} />
                  )}
                  {isFav ? `Favoritos (${favorites.length})` : cat}
                </button>
              );
            })}
          </div>

          {/* Sort Selector */}
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="w-full px-3 py-2.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-xs font-semibold text-slate-300 focus:border-teal-500 focus:outline-none"
            aria-label="Ordenar productos"
          >
            <option value="relevancia">Ordenar: Relevancia</option>
            <option value="popular">Más vendidos</option>
            <option value="precio-asc">Precio: menor a mayor</option>
            <option value="precio-desc">Precio: mayor a menor</option>
            <option value="stock">Mayor stock</option>
          </select>
        </div>
      </div>

      {/* Recorrido Horizontal: estantes interactivos por categoría. Apagado por defecto;
        el switch lo enciende. Tocar una góndola filtra; tocar de nuevo vuelve a Todas. */}
      {!searchQuery.trim() && shelfGroups.length > 0 && (
        <RevealOnScroll delay={40}>
        <section className="animate-fade-in">
          <div className="flex items-center justify-between mb-3 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`p-2 rounded-xl border transition-colors ${shelvesEnabled ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400' : 'bg-slate-800/60 border-slate-700/60 text-slate-500'}`}>
                <Icon name="store" className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-white">Recorrido Horizontal</h3>
                <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                  Estantes interactivos · pasá de góndola en góndola como en el kiosko
                </p>
              </div>
            </div>
            <button
              onClick={() => setShelvesEnabled((v) => !v)}
              role="switch"
              aria-checked={shelvesEnabled}
              aria-label="Activar o desactivar el Recorrido Horizontal"
              className={`shrink-0 inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 ${
                shelvesEnabled
                  ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-400'
              }`}
            >
              <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${shelvesEnabled ? 'bg-indigo-500' : 'bg-slate-600'}`}>
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${shelvesEnabled ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
              </span>
              {shelvesEnabled ? 'Encendido' : 'Apagado'}
            </button>
          </div>

          {shelvesEnabled && (
          <div className="estantes-scene space-y-3.5 sm:space-y-4">
            {shelfGroups.map((shelf, idx) => (
              <Shelf
                key={shelf.category}
                category={shelf.category}
                items={shelf.items}
                floor={idx + 1}
                isActive={selectedCategory === shelf.category}
                onAddToCart={onAddToCart}
                onOpenProductModal={onOpenProductModal}
                onSelectCategory={() =>
                  setSelectedCategory((cur) => (cur === shelf.category ? 'Todas' : shelf.category))
                }
              />
            ))}
          </div>
          )}
        </section>
        </RevealOnScroll>
      )}

      {/* Vitrina "Los más pedidos": carrusel horizontal, SOLO en móviles (lg:hidden) */}
      {topSellers.length > 0 && (
        <RevealOnScroll delay={80} className="lg:hidden">
        <section className="animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-400">
                <Icon name="star" className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
              <div>
                <h3 className="font-display text-base sm:text-lg font-extrabold text-white">Los más pedidos</h3>
                <p className="text-[11px] sm:text-xs text-slate-400">Los favoritos que vuelan del kiosko</p>
              </div>
            </div>
            <span className="px-2 py-1 rounded-full bg-teal-500/10 text-teal-400 text-[10px] font-bold uppercase tracking-wider border border-teal-500/20">
              top ventas
            </span>
          </div>

          <div className="flex gap-3 sm:gap-5 overflow-x-auto scrollbar-none snap-x snap-mandatory -mx-4 px-4 pb-2 sm:mx-0 sm:px-0">
            {topSellers.map((product) => (
              <article
                key={product.id}
                onClick={onOpenProductModal ? () => onOpenProductModal(product) : undefined}
                className="snap-start shrink-0 w-[70vw] min-[480px]:w-[320px] sm:w-[340px] rounded-2xl sm:rounded-3xl bg-slate-800/70 border border-slate-700/60 overflow-hidden flex flex-col hover:border-teal-500/50 hover:shadow-2xl hover:shadow-teal-500/10 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
              >
                <div className="relative aspect-[16/10] bg-slate-900">
                  <ProductImg
                    product={product}
                    alt={product.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <span className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-1 rounded-lg sm:rounded-xl ${categoryIdentity(product.category).chip} backdrop-blur-md text-[10px] sm:text-xs font-bold border shadow-sm`}>
                    <Icon name={categoryIdentity(product.category).icon} className="w-3 h-3" />
                    {product.category}
                  </span>
                </div>
                <div className="p-3 sm:p-4 flex flex-col gap-1.5 flex-1">
                  <h4 className="font-display text-sm sm:text-base font-extrabold text-white truncate">{product.name}</h4>
                  <p className="text-[11px] text-slate-400 line-clamp-1">
                    {formatSize(product) || product.brand || 'Artículo'}
                  </p>
                  <div className="mt-auto pt-2 flex items-end justify-between gap-2 border-t border-slate-700/50">
                    <div className="min-w-0">
                      <PriceCountUp
                        value={product.price}
                        rate={rate}
                        className="font-display text-xl sm:text-2xl font-black tracking-tight text-white"
                        bsClass="text-[10px] sm:text-[11px] font-bold text-teal-300/90"
                      />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToCart(product, 1, e.currentTarget.getBoundingClientRect());
                      }}
                      className="shrink-0 p-2.5 rounded-xl bg-teal-500 text-slate-950 hover:bg-teal-400 transition-all active:scale-90 shadow-lg shadow-teal-500/20"
                      aria-label={`Agregar ${product.name}`}
                    >
                      <Icon name="plus" className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
        </RevealOnScroll>
      )}

      {/* Radar de Ofertas "Novedades": nuevos, por agotar y frecuentes */}
      {radarProducts.length > 0 && (
        <section className="animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <Icon name="radio" className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">Radar de Novedades</h3>
                <p className="text-[11px] sm:text-xs text-slate-400">Lo que se mueve hoy en la tienda</p>
              </div>
            </div>
            <span className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold uppercase tracking-wider border border-amber-500/20 animate-pulse">
              en vivo
            </span>
          </div>

          <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory -mx-4 px-4 pb-2 sm:mx-0 sm:px-0">
            {radarProducts.map(({ product, tag }) => (
              <article
                key={product.id}
                onClick={() => onOpenProductModal(product)}
                className="snap-start shrink-0 w-40 sm:w-44 rounded-2xl bg-slate-800/70 border border-slate-700/60 overflow-hidden flex flex-col cursor-pointer hover:border-amber-500/50 hover:-translate-y-0.5 transition-all"
              >
                <div className="relative">
                  <ProductImg
                    product={product}
                    alt={product.name}
                    loading="lazy"
                    className="w-full h-24 sm:h-28 object-cover bg-slate-900"
                  />
                  <span
                    className={`absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                      tag === 'Nuevo'
                        ? 'bg-teal-500/90 text-slate-950 border-teal-400'
                        : tag === 'Se agota'
                          ? 'bg-rose-500/90 text-white border-rose-400'
                          : 'bg-indigo-500/90 text-white border-indigo-400'
                    }`}
                  >
                    {tag}
                  </span>
                </div>
                <div className="p-2.5 flex flex-col gap-1.5 flex-1">
                  <h4 className="text-xs font-bold text-white truncate">{product.name}</h4>
                  <p className="text-[11px] text-slate-400 line-clamp-1">
                    {formatSize(product) || product.category || 'Artículo'}
                  </p>
                  <div className="mt-auto flex items-center justify-between gap-1">
                    <span className="text-xs sm:text-sm font-extrabold text-teal-400">
                      {formatUsd(product.price)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToCart(product, 1, e.currentTarget.getBoundingClientRect());
                      }}
                      className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/40 hover:bg-teal-500 hover:text-slate-950 transition-all active:scale-90"
                      aria-label={`Agregar ${product.name}`}
                    >
                      <Icon name="plus" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Product Grid */}
      {products.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/30 rounded-3xl border border-slate-800 space-y-3">
          <Icon name="search" className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-slate-300">No encontramos productos</h3>
          <p className="text-slate-500 text-xs">Intenta cambiar la categoría o limpiar el término de búsqueda.</p>
          {(searchQuery.trim() || selectedCategory !== 'Todas') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('Todas');
              }}
              className="inline-flex items-center gap-1.5 mx-auto px-4 py-2.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 text-xs font-bold hover:from-teal-400 hover:to-emerald-400 shadow-lg shadow-teal-500/20 transition-all active:scale-95"
            >
              <Icon name="refresh" className="w-3.5 h-3.5" />
              Limpiar filtros
            </button>
          )}
          {searchQuery.trim() && (
            <button
              onClick={() => setSearchQuery('')}
              className="block mx-auto text-[11px] font-semibold text-teal-400 hover:text-teal-300 transition-colors"
            >
              Ver todo el catálogo
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
          {products.map((product, idx) => (
            <RevealOnScroll key={product.id} delay={Math.min(idx, 8) * 60}>
              <ProductCard
                product={product}
                rate={rate}
                isFavorite={favorites.includes(product.id)}
                onToggleFavorite={() => onToggleFavorite(product.id)}
                 onAddToCart={(e) => onAddToCart(product, 1, e.currentTarget.getBoundingClientRect())}
                 onOpenDetail={() => onOpenProductModal(product)}
                 vtActive={vtProductId === product.id}
               />
            </RevealOnScroll>
          ))}
        </div>
      )}
    </div>
  );
}

// Imagen de producto con fallback: si la URL falla o está vacía muestra el logo
// de marca + nombre (mismo fallback que usa KAPSULA AR) en vez del rompecabezas
// roto del navegador. Aplica fade al cargar en todas las superficies.
function ProductImg({ product, image, name, brand, alt, className = '', loading = 'lazy', onLoad, imgProps }) {
  const [errored, setErrored] = useState(false);
  const src = product?.image ?? image;
  const label = product?.brand?.trim() || product?.name || brand || name || 'Producto';

  if (!src || errored) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1.5 select-none ${className || ''}`}
        style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)' }}
        aria-hidden="true"
      >
        <BrandLogo className="w-6 h-6 !rounded-lg shrink-0" />
        <span className="w-full truncate px-1.5 text-center text-[10px] font-bold text-slate-400">{label}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || label}
      loading={loading}
      draggable={false}
      onError={() => setErrored(true)}
      onLoad={(e) => {
        e.currentTarget.classList.add('is-loaded');
        onLoad?.(e);
      }}
      className={`img-load-fade ${className || ''}`}
      {...imgProps}
    />
  );
}

// Estante interactivo: un anaquel (categoría) con los productos "de pie" sobre
// el borde, en fila horizontal scrolleable con leve 3D al pasar el cursor.
// Tocar el producto abre el detalle; el botón lo suma al carrito al instante.
// Scroll horizontal de anaqueles/góndolas: en PC la rueda del mouse mueve la
// fila horizontalmente (solo si hay overflow, conservando el scroll vertical
// de la página cuando no) y en móvil se desliza con el dedo (snap).
function useShelfWheelScroll(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e) => {
      const canScrollX = el.scrollWidth > el.clientWidth + 1;
      if (!canScrollX || (e.deltaY === 0 && e.deltaX === 0)) return;
      el.scrollLeft += e.deltaY + e.deltaX;
      e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ref]);
}

function ShelfScroller({ className, children }) {
  const ref = useRef(null);
  useShelfWheelScroll(ref);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

function Shelf({ category, items, floor, isActive, onAddToCart, onOpenProductModal, onSelectCategory }) {
  const id = categoryIdentity(category);
  const [justAddedId, setJustAddedId] = useState(null);

  const handleAdd = (product, e) => {
    if (justAddedId === product.id) return;
    setJustAddedId(product.id);
    setTimeout(() => setJustAddedId((cur) => (cur === product.id ? null : cur)), 1200);
    haptic(8);
    onAddToCart(product, 1, e.currentTarget.getBoundingClientRect());
  };

  return (
    <article
      className={`shelf-card rounded-2xl sm:rounded-3xl bg-slate-800/50 border backdrop-blur-sm transition-colors ${
        isActive ? 'is-active border-indigo-500/50' : 'border-slate-700/60 hover:border-slate-600'
      }`}
    >
      {/* Cabecera del anaquel: pisando la góndola se filtra esa categoría */}
      <button
        onClick={onSelectCategory}
        className="w-full px-3 sm:px-4 pt-2.5 pb-1 flex items-center gap-2 min-w-0 text-left group"
      >
        <span className={`p-1.5 rounded-lg ${id.solid} shrink-0 shadow-sm`}>
          <Icon name={id.icon} className="w-3.5 h-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs sm:text-sm font-bold text-white truncate group-hover:text-indigo-300 transition-colors">
            {category}
          </span>
          <span className="block text-[10px] text-slate-500 truncate">
            {items.length} producto{items.length !== 1 ? 's' : ''} ·{' '}
            {isActive ? 'tocá de nuevo para mostrar todas' : 'tocá la góndola para filtrar'}
          </span>
        </span>
        <span className="shrink-0 text-[10px] font-mono text-slate-500 bg-slate-900/50 border border-slate-700/60 px-1.5 py-0.5 rounded-md">
          piso {String(floor).padStart(2, '0')}
        </span>
      </button>

      {/* Tablero del estante con los productos en fila */}
      <div className="shelf-panel mt-2 px-3 sm:px-4 pb-3 pt-1">
        <ShelfScroller className="flex gap-3 overflow-x-auto shelf-scroll-x snap-x snap-mandatory -mx-3 px-3 pt-1 pb-2">
          {items.map((p, i) => {
            const avail = Math.max(0, Number(p.stock) - Number(p.reserved || 0));
            const out = avail <= 0;
            return (
              <div key={p.id} className="shelf-item" style={{ ['--sdel']: `${Math.min(i, 6) * 55}ms` }}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenProductModal(p)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenProductModal(p);
                    }
                  }}
                  aria-label={`Ver ${p.name}`}
                  className="shelf-product"
                >
                  <div className="shelf-product__art">
                    <ProductImg product={p} alt={p.name} loading="lazy" className="shelf-product__img" />
                  </div>
                  <span className="shelf-product__shadow" />
                </div>
                <div className="mt-2 space-y-1">
                  <p className="truncate text-[10px] sm:text-[11px] font-semibold text-slate-200">{p.name}</p>
                  <div className="flex items-center justify-between gap-1">
                    <span className={`min-w-0 text-[11px] sm:text-xs font-extrabold ${out ? 'text-slate-500 line-through' : 'text-teal-400'}`}>
                      {formatUsd(p.price)}
                    </span>
                    <button
                      onClick={(e) => handleAdd(p, e)}
                      disabled={out}
                      aria-label={`Agregar ${p.name}`}
                      className={`shrink-0 p-1.5 rounded-lg transition-all active:scale-90 disabled:opacity-40 disabled:pointer-events-none ${
                        justAddedId === p.id
                          ? 'bg-emerald-500 text-slate-950 animate-add-pulse'
                          : 'bg-teal-500/20 text-teal-300 border border-teal-500/40 hover:bg-teal-500 hover:text-slate-950'
                      }`}
                    >
                      <Icon name={justAddedId === p.id ? 'check' : 'plus'} className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {out && (
                    <span className="block text-[9px] text-rose-400 font-bold">Agotado</span>
                  )}
                </div>
              </div>
            );
          })}
        </ShelfScroller>
        <div className="shelf-lip" />
      </div>
    </article>
  );
}

// Calculadora flotante: botón fijo (solo escritorio; en móvil se abre desde la
// barra inferior) que despliega un panel no modal de conversión $ ⇄ Bs. El panel
// tiene pointer-events solo sobre sí mismo: no bloquea la navegación ni el scroll.
// Calculadora flotante: botón fijo posicionado por defecto justo debajo del logo
// (bajo el header), que despliega un panel no modal hacia abajo desde la posición
// del botón. Manteniéndolo presionado se puede arrastrar a otra posición (la
// animación de despliegue se origina desde la posición actual del botón). La
// posición se persiste en localStorage.
function CalcFab({ open, onToggle, rate, zClass = 'z-[46]', headerHeight = 0, admin = false }) {
  const [usdInput, setUsdInput] = useState('');
  const [bsInput, setBsInput] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const r = rate?.rate || 0;

  // Posición del botón (coordenadas absolutas). Por defecto debajo del logo,
  // alineado con el padding del header. Se persiste en localStorage.
  const [pos, setPos] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('calc_fab_pos'));
      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') return saved;
    } catch {}
    return { x: 12, y: (headerHeight || 64) + 8 };
  });

  useEffect(() => {
    if (!localStorage.getItem('calc_fab_pos') && headerHeight > 0) {
      setPos({ x: 12, y: headerHeight + 8 });
    }
  }, [headerHeight]);

  const dragRef = useRef({ startX: 0, startY: 0, baseX: 0, baseY: 0, moved: false });
  const lastPosRef = useRef(pos);
  const longPressRef = useRef(null);
  const cancelLongPress = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const handleDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    cancelLongPress();
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y, moved: false };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    longPressRef.current = setTimeout(() => {
      setDragActive(true);
      longPressRef.current = null;
    }, 350);
  };

  const handleMove = (e) => {
    if (!dragActive) return;
    const { startX, startY, baseX, baseY } = dragRef.current;
    if (Math.abs(e.clientX - startX) > 3 || Math.abs(e.clientY - startY) > 3) dragRef.current.moved = true;
    const nx = Math.max(4, Math.min(baseX + (e.clientX - startX), window.innerWidth - 64));
    const ny = Math.max(4, Math.min(baseY + (e.clientY - startY), window.innerHeight - 64));
    lastPosRef.current = { x: nx, y: ny };
    setPos(lastPosRef.current);
  };

  const handleUp = (e) => {
    cancelLongPress();
    const wasDrag = dragActive && dragRef.current.moved;
    setDragActive(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    if (wasDrag) {
      try {
        localStorage.setItem('calc_fab_pos', JSON.stringify(lastPosRef.current));
      } catch {}
    } else {
      onToggle();
    }
  };

  // Formatea mientras se teclea: coloca los puntos de miles automáticamente y
  // deja que el usuario escriba la coma para los decimales (igual que los
  // montos de la tienda). parseAmount tolera ambos estilos.
  const handleUsd = (value) => {
    const v = formatAmountBsInput(value);
    setUsdInput(v);
    const num = parseAmount(v);
    setBsInput(Number.isFinite(num) ? formatAmount(num * r) : '');
  };

  const handleBs = (value) => {
    const v = formatAmountBsInput(value);
    setBsInput(v);
    const num = parseAmount(v);
    setUsdInput(Number.isFinite(num) && r > 0 ? formatAmount(num / r) : '');
  };

  const body = (
    <div className="space-y-2">
      <div>
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
          US$ (divisas)
        </span>
        <div className="flex items-center gap-1.5 bg-slate-800/70 border border-slate-700/80 rounded-xl px-3 py-2">
          <Icon name="dollarSign" className="w-4 h-4 text-teal-400 shrink-0" />
          <input
            type="text"
            inputMode="decimal"
            value={usdInput}
            onChange={(e) => handleUsd(e.target.value)}
            placeholder="0.00"
            className="w-full bg-transparent text-slate-100 text-sm font-semibold placeholder-slate-600 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center justify-center text-slate-600">
        <Icon name="refresh" className="w-4 h-4 rotate-90" />
      </div>

      <div>
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
          Bs (bolívares)
        </span>
        <div className="flex items-center gap-1.5 bg-slate-800/70 border border-slate-700/80 rounded-xl px-3 py-2">
          <span className="text-teal-300 font-bold text-sm shrink-0">Bs</span>
          <input
            type="text"
            inputMode="decimal"
            value={bsInput}
            onChange={(e) => handleBs(e.target.value)}
            placeholder="0,00"
            className="w-full bg-transparent text-slate-100 text-sm font-semibold placeholder-slate-600 focus:outline-none"
          />
        </div>
      </div>

      {r > 0 && (
        <p className="text-[10px] text-slate-500">
          Calculado a la tasa BCV del día ({rate?.source}). Toque fuera o la X para cerrar.
        </p>
      )}
    </div>
  );

  const header = (onClose) => (
    <div className="flex items-center justify-between px-3.5 pt-3 pb-1">
      <span className="text-xs font-black text-white flex items-center gap-1.5 min-w-0">
        <Icon name="calculator" className="w-4 h-4 text-teal-400 shrink-0" />
        <span className="truncate">
          Calculadora · tasa {r ? r.toLocaleString('es-AR') : '—'} Bs
        </span>
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => setFullscreen((v) => !v)}
          aria-label={fullscreen ? 'Salir de pantalla completa' : 'Ver calculadora en pantalla completa'}
          className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <Icon name={fullscreen ? 'minimize' : 'maximize'} className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onClose}
          aria-label="Cerrar calculadora"
          className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <Icon name="x" className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  const panelLeft = Math.max(8, Math.min(pos.x, (typeof window !== 'undefined' ? window.innerWidth : 400) - 336));
  const panelTop = pos.y + 48;

  return (
    <>
      {/* Botón fijo bajo el logo. Mantener presionado para arrastrarlo a otra posición. */}
      <button
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        style={{ left: pos.x, top: pos.y, touchAction: 'none' }}
        aria-label={open ? 'Cerrar calculadora' : 'Abrir calculadora'}
        aria-expanded={open}
        title={dragActive ? 'Arrastra para mover la calculadora' : 'Calculadora · mantén presionado para moverla'}
        className={`fixed flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 ${zClass} rounded-2xl shadow-xl border backdrop-blur-md transition-colors active:scale-90 select-none cursor-grab ${
          dragActive ? 'cursor-grabbing ring-2 ring-teal-400/60 scale-110' : ''
        } ${
          open
            ? 'bg-teal-500 text-slate-950 border-teal-300 shadow-teal-500/30'
            : 'bg-slate-800/90 text-teal-300 border-teal-500/40 shadow-teal-500/10 hover:bg-slate-800'
        }`}
      >
        <Icon name="calculator" className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      {/* Panel no modal: se despliega hacia abajo desde la posición actual del botón.
          La animación crece desde arriba (transform-origin top) siguiendo al botón. */}
      {open && !fullscreen && (
        <div
          style={{ left: panelLeft, top: panelTop }}
          className={`fixed w-[calc(100vw-1.5rem)] max-w-xs ${zClass} rounded-2xl bg-slate-900/95 border border-teal-500/30 shadow-2xl backdrop-blur-xl animate-calc-drop`}
        >
          {header(onToggle)}
          <div className="px-3.5 pb-3.5">{body}</div>
        </div>
      )}

      {/* Vista fullscreen: modal grande centrado frente a toda la app.
          Para el admin incluye la calculadora de operaciones matemáticas. */}
      {open && fullscreen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in"
          onClick={() => setFullscreen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl bg-slate-900/95 border border-teal-500/30 shadow-2xl backdrop-blur-xl animate-modal-spring"
            onClick={(e) => e.stopPropagation()}
          >
            {header(() => {
              setFullscreen(false);
              onToggle();
            })}
            <div className="px-4 pb-5">{admin ? <MathCalculator rate={rate} /> : body}</div>
          </div>
        </div>
      )}
    </>
  );
}

// Calculadora de operaciones matemáticas básicas (solo el fullscreen del admin).
// Un botón define la moneda del resultado: "$" cuando está activo en dólares y,
// al presionarlo de nuevo, "Bs". Cada resultado se muestra en la moneda activa y
// también convertido a la moneda contraria según la tasa BCV.
function MathCalculator({ rate }) {
  const r = rate?.rate || 0;
  const [display, setDisplay] = useState('0');
  const [acc, setAcc] = useState(null);
  const [op, setOp] = useState(null);
  const [waiting, setWaiting] = useState(false);
  const [expr, setExpr] = useState('');
  const [currency, setCurrency] = useState('USD');

  const inputDigit = (d) => {
    if (waiting) {
      setDisplay(d === '.' ? '0.' : d);
      setWaiting(false);
      if (acc == null && op == null) setExpr('');
      return;
    }
    setDisplay(d === '.' && (display.includes('.') || display === '0') ? (display === '0' ? '0.' : display) : display === '0' && d !== '.' ? d : display + d);
  };

  const compute = (a, b) => {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b === 0 ? 0 : a / b;
      default: return b;
    }
  };

  const round = (n) => Math.round(n * 1e10) / 1e10;

  const chooseOp = (nextOp) => {
    const cur = parseFloat(display || '0');
    let base = cur;
    let exprBase = formatAmount(cur, 2);
    if (acc != null && op != null) {
      base = round(compute(acc, cur));
      exprBase = `${expr} ${formatAmount(cur, 2)}`;
    }
    setAcc(base);
    setExpr(`${exprBase} ${nextOp}`);
    setOp(nextOp);
    setDisplay('0');
    setWaiting(true);
  };

  const equals = () => {
    if (op == null || acc == null) return;
    const cur = parseFloat(display || '0');
    const res = round(compute(acc, cur));
    setExpr(`${expr} ${formatAmount(cur, 2)} =`);
    setDisplay(String(res));
    setAcc(null);
    setOp(null);
    setWaiting(true);
  };

  const clearAll = () => {
    setDisplay('0');
    setAcc(null);
    setOp(null);
    setWaiting(false);
    setExpr('');
  };

  const backspace = () => {
    if (waiting) return;
    setDisplay(display.length > 1 ? display.slice(0, -1) : '0');
  };

  const toggleSign = () => setDisplay(String(parseFloat(display || '0') * -1));

  const num = parseFloat(display || '0');
  const isUsd = currency === 'USD';

  const keyBtn = (label, onClick, extra = '') => (
    <button
      onClick={onClick}
      className={`h-12 rounded-xl text-base font-bold transition-all active:scale-95 bg-slate-800/80 border border-slate-700/60 text-slate-100 hover:bg-slate-700/80 hover:border-teal-500/40 ${extra}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      {/* Pantalla: expresión en curso arriba (primer monto + símbolo + segundo
          monto) y el monto/resultado actual abajo, en ambas monedas. */}
      <div className="rounded-2xl bg-slate-950/70 border border-slate-700/80 p-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
            Resultado en {isUsd ? 'US$' : 'Bs'}
          </span>
          <button
            onClick={() => setCurrency(isUsd ? 'BS' : 'USD')}
            aria-label={`Cambiar moneda del resultado (ahora ${isUsd ? 'US$' : 'Bs'})`}
            className={`px-3 py-1 rounded-xl text-xs font-black border transition-all active:scale-90 ${
              isUsd
                ? 'bg-teal-500 text-slate-950 border-teal-300 shadow-teal-500/20'
                : 'bg-amber-500 text-slate-950 border-amber-300 shadow-amber-500/20'
            }`}
          >
            {isUsd ? '$' : 'Bs'}
          </button>
        </div>
        {expr && (
          <div className="text-right text-sm sm:text-base text-teal-300/90 font-bold truncate tabular-nums">
            {isUsd ? '$' : 'Bs'} {expr}
          </div>
        )}
        <div className="text-right text-2xl sm:text-3xl font-black text-white truncate tabular-nums">
          {isUsd ? '$' : 'Bs'} {formatAmount(num, 2)}
        </div>
        {r > 0 && (
          <div className="text-right text-xs text-teal-400 font-semibold tabular-nums">
            {isUsd ? '≈ Bs' : '≈ $'} {formatAmount(isUsd ? num * r : num / r, 2)} · tasa {r.toLocaleString('es-AR')} Bs
          </div>
        )}
      </div>

      {/* Teclado: números 0-9, punto, ±, y operaciones + − × ÷ = C ⌫ */}
      <div className="grid grid-cols-4 gap-2">
        {keyBtn('C', clearAll, 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25')}
        {keyBtn('⌫', backspace, 'text-slate-300')}
        {keyBtn('÷', () => chooseOp('÷'), 'bg-teal-500/15 text-teal-300 border-teal-500/30 hover:bg-teal-500/25')}
        {keyBtn('×', () => chooseOp('×'), 'bg-teal-500/15 text-teal-300 border-teal-500/30 hover:bg-teal-500/25')}

        {keyBtn('7', () => inputDigit('7'))}
        {keyBtn('8', () => inputDigit('8'))}
        {keyBtn('9', () => inputDigit('9'))}
        {keyBtn('−', () => chooseOp('-'), 'bg-teal-500/15 text-teal-300 border-teal-500/30 hover:bg-teal-500/25')}

        {keyBtn('4', () => inputDigit('4'))}
        {keyBtn('5', () => inputDigit('5'))}
        {keyBtn('6', () => inputDigit('6'))}
        {keyBtn('+', () => chooseOp('+'), 'bg-teal-500/15 text-teal-300 border-teal-500/30 hover:bg-teal-500/25')}

        {keyBtn('1', () => inputDigit('1'))}
        {keyBtn('2', () => inputDigit('2'))}
        {keyBtn('3', () => inputDigit('3'))}
        <button
          onClick={equals}
          className="h-12 rounded-xl text-base font-black transition-all active:scale-95 bg-teal-500 text-slate-950 border border-teal-300 shadow-teal-500/20 hover:bg-teal-400"
        >
          =
        </button>

        {keyBtn('±', toggleSign, 'text-slate-300')}
        {keyBtn('0', () => inputDigit('0'))}
        {keyBtn('.', () => inputDigit('.'))}
      </div>
    </div>
  );
}

function ProductCard({ product, rate, onAddToCart, onOpenDetail, isFavorite, onToggleFavorite, vtActive = false }) {
  const avail = Math.max(0, (Number(product.stock) || 0) - (Number(product.reserved) || 0));
  const isOut = avail <= 0;
  const isLow = avail > 0 && avail <= 5;
  // Predicción "Se acaba pronto": el stock durará <= 2 días al ritmo de venta actual.
  const runOutSoon = !isOut && product.runOutDays != null && product.runOutDays > 0 && product.runOutDays <= 2;
  const [justAdded, setJustAdded] = useState(false);

  const handleAdd = (e) => {
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
    onAddToCart(e);
  };

  return (
    <div
      className="group bg-slate-800/70 border border-slate-700/60 rounded-2xl sm:rounded-3xl hover:border-teal-500/40 transition-all duration-300 hover:shadow-2xl hover:shadow-teal-500/5 hover:-translate-y-1 flex flex-col justify-between backdrop-blur-sm"
    >
      <div className="flex flex-col flex-1 overflow-hidden rounded-2xl sm:rounded-3xl">
      <div
        onClick={onOpenDetail}
        className="cursor-pointer relative overflow-hidden aspect-square sm:aspect-[4/3] bg-slate-900"
        style={vtActive ? { viewTransitionName: 'active-product-photo' } : undefined}
      >
        <ProductImg
          product={product}
          alt={product.name}
          className="prod-photo w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex flex-wrap gap-1">
          {isNewProduct(product) && !wasNewProductViewed(product.id) && (
            <span
              onClick={(e) => { e.stopPropagation(); markNewProductViewed(product.id); }}
              className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl bg-gradient-to-r from-fuchsia-500 to-teal-400 text-slate-950 text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-lg shadow-fuchsia-500/30 animate-bounce-short cursor-pointer"
            >
              NUEVO
            </span>
          )}
          {product.brand && (
            <span className="hidden sm:inline px-2.5 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md text-xs font-medium text-teal-300 border border-teal-500/30">
              {product.brand}
            </span>
          )}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl ${categoryIdentity(product.category).chip} backdrop-blur-md text-[10px] sm:text-xs font-bold border shadow-sm`}>
            <Icon name={categoryIdentity(product.category).icon} className="w-3 h-3" />
            {product.category}
          </span>
        </div>

        {/* Favorito */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="absolute top-2 right-2 sm:top-3 sm:right-3 p-1.5 sm:p-2 rounded-xl bg-slate-950/70 backdrop-blur-md border border-white/10 transition-all active:scale-75 hover:scale-110"
          aria-label={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
        >
          <Icon
            key={isFavorite ? 'fav-on' : 'fav-off'}
            name={isFavorite ? 'heartFilled' : 'heart'}
            className={`w-4 h-4 sm:w-5 sm:h-5 transition-all icon-fill-hover ${isFavorite ? 'text-rose-400 drop-shadow-[0_0_6px_rgba(244,63,94,0.7)] animate-icon-pop' : 'text-slate-300'}`}
          />
        </button>

        {/* Stock Badge Overlay */}
        {isOut ? (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center">
            <span className="px-3 py-1.5 rounded-full bg-rose-500/90 text-white font-bold text-xs shadow-lg uppercase tracking-wider">
              Agotado
            </span>
          </div>
        ) : isLow ? (
          <span className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl bg-amber-500/90 text-slate-950 font-extrabold text-[10px] sm:text-[11px] shadow-lg">
            ¡Últimas {avail} un.!
          </span>
        ) : null}

        {/* Predicción "Se acaba pronto" (por velocidad de venta) */}
        {runOutSoon && !isOut && (
          <span className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl bg-rose-500/90 text-white font-extrabold text-[10px] sm:text-[11px] shadow-lg flex items-center gap-1">
            <Icon name="zap" className="w-3 h-3" />
            Se acaba pronto (~{Math.ceil(product.runOutDays)} d)
          </span>
        )}
      </div>

      <div className="p-2.5 sm:p-5 flex-1 flex flex-col justify-between space-y-2 sm:space-y-4">
        <div>
          <h3
            onClick={onOpenDetail}
            className="font-display text-sm sm:text-base text-slate-100 group-hover:text-teal-300 transition-colors cursor-pointer line-clamp-1"
          >
            {product.name}
          </h3>
          {formatSize(product) && (
            <span className="inline-block mt-1 px-1.5 sm:px-2 py-0.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-[10px] sm:text-[11px] font-bold text-teal-300">
              {formatSize(product)}
            </span>
          )}
          <p className="hidden sm:block text-slate-400 text-xs line-clamp-2 mt-1 leading-relaxed">
            {product.description}
          </p>
        </div>

        <div className="flex items-center justify-between pt-1.5 sm:pt-2 border-t border-slate-700/50">
          <div>
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium block">Precio</span>
            <PriceCountUp
              value={product.price}
              rate={rate}
              className="font-display font-black tracking-tight text-white text-base sm:text-lg"
              bsClass="text-[10px] sm:text-[11px] font-bold text-teal-300/90"
            />
          </div>

          <Btn
            onClick={handleAdd}
            disabled={isOut}
            variant="primary"
            size="sm"
            icon={justAdded ? undefined : 'plus'}
            success={justAdded}
            className="!p-2.5 sm:!p-3 !rounded-xl sm:!rounded-2xl !text-xs !font-semibold !shadow-md"
            aria-label="Agregar al carrito"
          >
            <span className="hidden sm:inline">{justAdded ? '¡Listo!' : 'Agregar'}</span>
          </Btn>
        </div>
      </div>
      </div>
    </div>
  );
}

function ProductDetailModal({ product, sameBrandProducts = [], rate, onClose, onAddToCart, isFavorite, onToggleFavorite, onNavigate }) {
  const [quantity, setQuantity] = useState(1);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [touchX, setTouchX] = useState(null);
  const [slideDir, setSlideDir] = useState('right');
  // Paleta reactiva (#17): color dominante de la foto tiñe los acentos.
  const [accent, setAccent] = useState(null);
  const isOut = product.stock <= 0 || product.reserved >= product.stock;
  const unitBs = usdToBs(product.price, rate?.rate);
  const lineTotal = product.price * quantity;

  useEffect(() => {
    let dead = false;
    setAccent(null);
    dominantColorFromUrl(product?.image).then((rgb) => { if (!dead && rgb) setAccent(rgb); });
    return () => { dead = true; };
  }, [product?.id]);

  // Cierra con botón "atrás"/ESC y bloquea el scroll del fondo. En pantalla
  // completa cierra primero la imagen antes de cerrar el modal (como antes).
  // Salida animada (#11): el panel se encoge antes de desmontarse.
  const panelExitRef = useRef(null);
  const requestClose = () => {
    if (showFullscreen) setShowFullscreen(false);
    else exitThen(panelExitRef, onClose)();
  };
  useOverlay(true, requestClose);

  const currentIndex = useMemo(() => {
    const idx = (sameBrandProducts || []).findIndex((p) => p.id === product.id);
    return idx >= 0 ? idx : 0;
  }, [product.id, sameBrandProducts]);

  const totalInBrand = (sameBrandProducts || []).length;
  const hasSameBrand = totalInBrand > 1;

  const goTo = useCallback(
    (dir) => {
      if (!hasSameBrand) return;
      const next = currentIndex + dir;
      if (next < 0 || next >= totalInBrand) return;
      setSlideDir(dir > 0 ? 'right' : 'left');
      onNavigate?.(sameBrandProducts[next]);
      setQuantity(1);
    },
    [currentIndex, hasSameBrand, totalInBrand, onNavigate, sameBrandProducts]
  );

  // Navegación por swipe (deslizar) entre productos de la misma marca.
  const handleTouchStart = (e) => setTouchX(e.touches?.[0]?.clientX ?? null);
  const handleTouchEnd = (e) => {
    if (touchX == null) return;
    const delta = (e.changedTouches?.[0]?.clientX ?? 0) - touchX;
    if (Math.abs(delta) > 40) goTo(delta > 0 ? -1 : 1);
    setTouchX(null);
  };

  // Flechas de teclado para navegar entre productos de la marca. El ESC ya lo
  // maneja el mecanismo compartido de overlay (cierra la capa superior).
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') goTo(-1);
      if (e.key === 'ArrowRight') goTo(1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goTo]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      {/* Backdrop Click */}
      <div className="absolute inset-0" onClick={requestClose} />

      <div ref={panelExitRef} className="relative w-full sm:max-w-2xl max-h-[92vh] glass-strong bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-screen-up flex flex-col mx-auto">
      {/* Handle visual para indicar arrastre en móvil */}
      <div className="sm:hidden absolute top-2.5 left-1/2 -translate-x-1/2 z-20 w-12 h-1.5 rounded-full bg-slate-700" />

      {/* Close Button */}
      <button
        onClick={requestClose}
        className="absolute top-4 right-4 z-20 p-2 rounded-full bg-slate-950/60 text-slate-300 hover:text-white backdrop-blur-md hover:bg-slate-800 transition-all"
      >
        <Icon name="x" className="w-5 h-5" />
      </button>

      {/* Botón favorito */}
      <button
        onClick={onToggleFavorite}
        className="absolute top-4 left-4 z-20 p-2 rounded-full bg-slate-950/60 text-slate-300 hover:text-white backdrop-blur-md hover:bg-slate-800 transition-all active:scale-75"
        aria-label={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      >
        <Icon
          name={isFavorite ? 'heartFilled' : 'heart'}
          className={`w-5 h-5 ${isFavorite ? 'text-rose-400' : ''}`}
        />
      </button>

      {/* Imagen + full screen + paginación de la marca */}
      <div
        key={`img-${product.id}`}
        style={{ viewTransitionName: 'active-product-photo', ...(accent ? { '--accent': accent } : {}) }}
        className={`relative h-40 sm:h-56 bg-slate-950 shrink-0 ${slideDir === 'right' ? 'animate-brand-slide-right' : 'animate-brand-slide-left'}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
          {/* Halo del color dominante de la foto (#17) */}
          {accent && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(circle at 72% 18%, rgba(var(--accent), 0.4), transparent 62%)' }}
            />
          )}
          <ProductImg product={product} alt={product.name} className="w-full h-full object-cover" />
          <div className="absolute top-4 left-4 sm:left-4">
            <span className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl ${categoryIdentity(product.category).chip} backdrop-blur-md text-xs font-bold border shadow-sm`}>
              <Icon name={categoryIdentity(product.category).icon} className="w-3 h-3" />
              {product.category}
            </span>
          </div>

          {/* Botón full screen: agranda la imagen */}
          <button
            onClick={() => setShowFullscreen(true)}
            className="absolute bottom-3 right-3 z-20 p-2 rounded-xl bg-slate-950/70 backdrop-blur-md border border-white/15 text-slate-200 hover:text-white hover:border-teal-400/50 transition-all active:scale-90"
            aria-label="Ver imagen en pantalla completa"
          >
            <Icon name="maximize" className="w-5 h-5" />
          </button>

          {/* Paginación de la misma marca */}
          {hasSameBrand && (
            <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5">
              <button
                onClick={() => goTo(-1)}
                className="p-1.5 rounded-lg bg-slate-950/70 backdrop-blur-md border border-white/15 text-slate-200 hover:text-white hover:border-teal-400/50 transition-all active:scale-90"
                aria-label="Producto anterior de la marca"
              >
                <Icon name="chevronLeft" className="w-4 h-4" />
              </button>
              <span className="px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md border border-teal-500/30 text-[10px] font-bold text-teal-300">
                {currentIndex + 1}/{totalInBrand} · {product.brand}
              </span>
              <button
                onClick={() => goTo(1)}
                className="p-1.5 rounded-lg bg-slate-950/70 backdrop-blur-md border border-white/15 text-slate-200 hover:text-white hover:border-teal-400/50 transition-all active:scale-90"
                aria-label="Siguiente producto de la marca"
              >
                <Icon name="chevronRight" className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Miniaturas de la misma marca (paginación) */}
        {hasSameBrand && (
          <div className="flex gap-2 px-4 sm:px-6 pt-3 pb-1 shrink-0">
            {sameBrandProducts.map((p, i) => (
              <button
                key={p.id}
                onClick={() => {
                  setSlideDir(i > currentIndex ? 'right' : 'left');
                  onNavigate?.(p);
                  setQuantity(1);
                }}
                className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                  i === currentIndex
                    ? 'border-teal-400 ring-2 ring-teal-500/30'
                    : 'border-slate-700 hover:border-teal-500/50'
                }`}
                aria-label={`Ver ${p.name}`}
              >
                <ProductImg product={p} alt={p.name} className="w-full h-full object-cover" />
                {i === currentIndex && (
                  <span className="absolute inset-0 bg-teal-500/20" />
                )}
              </button>
            ))}
          </div>
        )}

        <div
          key={`body-${product.id}`}
          className={`p-4 sm:p-6 flex flex-col overflow-y-auto flex-1 min-h-0 ${slideDir === 'right' ? 'animate-brand-slide-right' : 'animate-brand-slide-left'}`}
        >
          <div className="mb-5 sm:mb-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-mono">CÓDIGO: {product.code}</span>
                {product.brand && (
                  <span className="text-xs font-semibold text-teal-400">{product.brand}</span>
                )}
              </div>
              <span className={`text-xs font-semibold ${product.stock - product.reserved > 5 ? 'text-teal-400' : product.stock - product.reserved > 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                {product.stock - product.reserved > 0 ? `Stock: ${product.stock - product.reserved} un.` : 'Agotado'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">{product.name}</h2>
            {formatSize(product) && (
              <span className="text-xs font-semibold text-teal-400 mt-1 block">Tamaño: {formatSize(product)}</span>
            )}
            <p className="text-slate-300 text-sm mt-3 leading-relaxed">{product.description}</p>
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 mb-5 sm:mb-6">
            <div>
              <span className="text-xs text-slate-400 block">Precio Unitario</span>
              <span className="text-2xl font-black text-white">{formatUsd(product.price)}</span>
              {rate?.rate > 0 && (
                <span className="block text-xs font-bold text-teal-300/90 mt-0.5">
                  {formatBs(unitBs)}
                </span>
              )}
            </div>

            {/* Quantity Controls */}
            {!isOut && (
              <div className="flex items-center gap-3 bg-slate-900 p-1.5 rounded-xl border border-slate-700">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
                >
                  <Icon name="minus" className="w-4 h-4" />
                </button>
                <span className="font-bold text-slate-100 text-sm w-6 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(product.stock - product.reserved, q + 1))}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
                >
                  <Icon name="plus" className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div>
          <Btn
            onClick={(e) => {
              onAddToCart(quantity, e.currentTarget.getBoundingClientRect());
              setQuantity(1);
            }}
            disabled={isOut}
            variant="primary"
            size="xl"
            icon={isOut ? undefined : 'shoppingBag'}
            className={isOut ? '!bg-slate-800 !text-slate-500 !shadow-none' : 'shadow-xl shadow-teal-500/25'}
          >
            {isOut
              ? 'Sin Stock Disponible'
              : `Agregar al Carrito • ${formatUsd(lineTotal)}${rate?.rate > 0 ? ` (${formatBs(usdToBs(lineTotal, rate.rate))})` : ''}`}
          </Btn>
        </div>
        </div>
      </div>

      {/* Visor full screen de la imagen (desliza para ver la misma marca) */}
      {showFullscreen && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/98 bg-black flex flex-col"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="pt-[max(0.75rem,env(safe-area-inset-top))] flex items-center justify-between px-4 py-3 shrink-0">
            <div className="flex items-center gap-2">
              {hasSameBrand && (
                <>
                  <button
                    onClick={() => goTo(-1)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:text-white transition-all active:scale-90"
                    aria-label="Producto anterior de la marca"
                  >
                    <Icon name="chevronLeft" className="w-5 h-5" />
                  </button>
                  <span className="text-xs font-bold text-teal-300 px-2">
                    {currentIndex + 1}/{totalInBrand} · {product.brand}
                  </span>
                  <button
                    onClick={() => goTo(1)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:text-white transition-all active:scale-90"
                    aria-label="Siguiente producto de la marca"
                  >
                    <Icon name="chevronRight" className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
            <button
              onClick={() => setShowFullscreen(false)}
              className="p-2 rounded-full bg-slate-800 text-slate-200 hover:text-white transition-all active:scale-90"
              aria-label="Cerrar imagen en pantalla completa"
            >
              <Icon name="x" className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center px-2 pb-6 min-h-0">
            <ProductImg
              product={product}
              alt={product.name}
              className="max-w-full max-h-full object-contain select-none"
            />
          </div>

          <div className="px-4 pb-6 text-center shrink-0">
            <p className="text-sm font-bold text-white line-clamp-1">{product.name}</p>
            {product.brand && <p className="text-xs text-teal-400 mt-0.5">{product.brand}</p>}
            {hasSameBrand && (
              <p className="text-[10px] text-slate-500 mt-1">Desliza para ver más productos de {product.brand}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function IdentityModal({ knownCustomers, allCustomers, savedCustomer, onConfirm, onConfirmBiometric, mode = 'login', confirmKind = 'switchback', onClose }) {
  useOverlay(true, onClose);
  const [customerName, setCustomerName] = useState('');
  const [phoneCode, setPhoneCode] = useState('0412');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [errors, setErrors] = useState({});
  const [isWorking, setIsWorking] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'webauthn'
  const [webAuthnStep, setWebAuthnStep] = useState(''); // '' | 'login' | 'register'
  const [webauthnError, setWebauthnError] = useState('');
  const [webauthnSupported, setWebauthnSupported] = useState(true);
  const [registerMode, setRegisterMode] = useState(false);
  const [remember, setRemember] = useState(false);
  const [panel, setPanel] = useState(mode === 'confirm' ? 'confirm' : 'login'); // 'login' | 'confirm'
  const [confirmKindState, setConfirmKindState] = useState(confirmKind);

  // Soporte WebAuthn (huella / Face ID)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = browserSupportsWebAuthn();
      let platformOk = false;
      if (supported) {
        try { platformOk = await hasRealBiometrics(); } catch { platformOk = false; }
      }
      if (!cancelled) setWebauthnSupported(supported && platformOk);
    })();
    return () => { cancelled = true; };
  }, []);

  // "Recordarme": precarga los campos del último login recordado (no los vacía).
  useEffect(() => {
    const mem = loadLoginMemory();
    if (mem) {
      setCustomerName(mem.customerName || '');
      setPhoneCode(mem.phoneCode || '0412');
      setPhoneNumber(mem.phoneNumber || '');
      setRemember(true);
    }
  }, []);

  // Autocompleta el nombre cuando el teléfono ya está registrado (historial local
  // o clientes del servidor), sin interferir con lo que el usuario escriba a mano.
  const phoneKey = `${phoneCode}${phoneNumber}`.replace(/\D/g, '').slice(-11);
  const nameRef = useRef('');
  useEffect(() => {
    nameRef.current = customerName;
  }, [customerName]);
  useEffect(() => {
    if (phoneNumber.length < 7) return;
    let cancelled = false;
    const applyName = (n) => {
      if (n && !nameRef.current.trim()) setCustomerName(n);
    };
    const local = [
      ...(knownCustomers || []),
      ...(allCustomers || []).map((c) => ({ phone: c.phone, name: c.customerName || c.name }))
    ].find((c) => normalizePhoneDigits(c.phone) === phoneKey);
    if (local && local.name) {
      applyName(local.name);
      return;
    }
    api
      .getCustomer(phoneKey)
      .then((res) => {
        if (cancelled) return;
        const n = res && res.ok && res.data ? res.data.customerName : '';
        applyName(n);
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneCode, phoneNumber, knownCustomers, allCustomers]);

  const handlePhoneNumber = (value) => {
    setPhoneNumber(value.replace(/\D/g, '').slice(0, 7));
  };

  // Interruptor "Recordarme": al activarlo guarda los campos; al desactivarlo los limpia.
  const toggleRemember = (on) => {
    setRemember(on);
    if (on) {
      saveLoginMemory({ customerName: customerName.trim(), phoneCode, phoneNumber });
    } else {
      clearLoginMemory();
    }
  };

  // Persiste (o limpia) los campos según el estado de "Recordarme" al iniciar sesión.
  const persistRemember = () => {
    if (remember) {
      saveLoginMemory({ customerName: customerName.trim(), phoneCode, phoneNumber });
    } else {
      clearLoginMemory();
    }
  };

  // Determina si el teléfono ya tiene biometría registrada
  const hasRegisteredBiometry = async (phoneKey) => {
    const res = await api.webauthnLoginOptions({ phone: phoneKey });
    if (res.ok) return true;
    if (res.status === 404) return false;
    throw new Error(res.data.error || 'No se pudo consultar tu registro biométrico');
  };

  const registerBiometry = async (phoneKey, customerName) => {
    setWebAuthnStep('register');
    const res = await api.webauthnRegisterOptions({ phone: phoneKey, customerName: customerName.trim() });
    if (!res.ok) throw new Error(res.data.error || 'No se pudo iniciar el registro');
    const regResponse = await startRegistration({ optionsJSON: res.data.options });
    const verifyRes = await api.webauthnRegisterVerify({ phone: phoneKey, response: regResponse });
    if (!verifyRes.ok) throw new Error(verifyRes.data.error || `No se pudo guardar tu ${BIO_METHOD_LABEL}`);
  };

  // Login o registro con biometría. Si no hay credencial previa, la registra en
  // el momento (primera vez en este dispositivo/dominio).
  const authenticateWithBiometry = async ({ phoneKey, customerName }) => {
    const hasBio = await hasRegisteredBiometry(phoneKey);
    if (hasBio) {
      setWebAuthnStep('login');
      const res = await api.webauthnLoginOptions({ phone: phoneKey });
      if (!res.ok) throw new Error(res.data.error || 'No se pudo iniciar la verificación');
      try {
        const authResponse = await startAuthentication({ optionsJSON: res.data.options });
        const verifyRes = await api.webauthnLoginVerify({ phone: phoneKey, response: authResponse });
        if (!verifyRes.ok) throw new Error(verifyRes.data.error || (IS_IOS ? 'Face ID no coincidió' : 'La huella no coincidió'));
      } catch (authErr) {
        // rpID distinto (dominio anterior): re-registra en el dominio actual.
        const isRpidMismatch = authErr?.name === 'NotAllowedError';
        if (!isRpidMismatch) throw authErr;
        await registerBiometry(phoneKey, customerName);
      }
    } else {
      await registerBiometry(phoneKey, customerName);
    }
  };

  // Flujo del formulario (login o registro nuevo).
  const runWebAuthn = async () => {
    setWebauthnError('');
    // Un usuario inhabilitado por el super admin no puede pasar del login.
    if (phoneKey.length >= 7) {
      try {
        const existing = await api.getCustomer(phoneKey);
        if (existing.ok && existing.data && existing.data.disabled) {
          setWebauthnError('Tu cuenta está inhabilitada por el kiosko. Contacta la tienda.');
          return;
        }
      } catch {}
    }
    // Dispositivo sin biometría/Face ID: no bloquear el ingreso, se accede igual.
    if (!webauthnSupported) {
      persistRemember();
      onConfirm({ customerName: customerName.trim(), phoneCode, phoneNumber });
      return;
    }
    setStep('webauthn');
    setIsWorking(true);
    try {
      await authenticateWithBiometry({ phoneKey, customerName });
      setIsWorking(false);
      persistRemember();
      onConfirm({ customerName: customerName.trim(), phoneCode, phoneNumber });
    } catch (err) {
      setIsWorking(false);
      setWebauthnError(friendlyAuthError(err));
      setStep('form');
    }
  };

  // Botón de biometría del formulario: exige el número antes de continuar.
  const handleBiometricAction = () => {
    if (!/^\d{7}$/.test(phoneNumber)) {
      setErrors((prev) => ({ ...prev, phone: `Ingresa los 7 dígitos del número para verificar con ${BIO_METHOD_LABEL}` }));
      return;
    }
    runWebAuthn();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!customerName.trim()) newErrors.customerName = 'Ingresa tu nombre';
    if (!/^\d{7}$/.test(phoneNumber)) newErrors.phone = 'Ingresa los 7 dígitos del número';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    await runWebAuthn();
  };

  // Confirmación solo-biometría (volver al cliente actual / cerrar sesión):
  // NO vuelve a pedir nombre ni teléfono, solo huella o Face ID.
  const handleConfirmBiometric = async () => {
    const phone = savedCustomer?.phoneNumber || phoneNumber;
    const code = savedCustomer?.phoneCode || phoneCode;
    const name = savedCustomer?.customerName || customerName.trim();
    if (!/^\d{7}$/.test(phone)) {
      setWebauthnError('No hay un usuario activo para confirmar.');
      return;
    }
    setWebauthnError('');
    // Sin biometría disponible: permitir continuar igual.
    if (!webauthnSupported) {
      onConfirmBiometric(confirmKindState);
      return;
    }
    setStep('webauthn');
    setIsWorking(true);
    const confirmKey = `${code}${phone}`.replace(/\D/g, '').slice(-11);
    try {
      await authenticateWithBiometry({ phoneKey: confirmKey, customerName: name });
      setIsWorking(false);
      onConfirmBiometric(confirmKindState);
    } catch (err) {
      setIsWorking(false);
      setWebauthnError(friendlyAuthError(err));
      setStep('form');
    }
  };

  const resetForm = () => {
    setStep('form');
    setWebAuthnStep('');
    setWebauthnError('');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
      <div className="relative w-full sm:max-w-md glass-strong bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden z-10 animate-screen-up max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="relative pt-[max(1.25rem,env(safe-area-inset-top))] p-5 sm:p-7 border-b border-slate-800 text-center">
          {(savedCustomer?.customerName || panel === 'confirm') && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <Icon name="x" className="w-5 h-5" />
            </button>
          )}
          <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-slate-950 shadow-lg shadow-teal-500/25">
            <Icon name={panel === 'confirm' && confirmKindState === 'logout' ? 'logOut' : 'user'} className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <h2 className="text-lg sm:text-xl font-black text-white mt-3">
            {panel === 'confirm'
              ? confirmKindState === 'logout'
                ? 'Cerrar sesión'
                : `Volver a ${savedCustomer?.customerName?.split(' ')[0] || 'tu cuenta'}`
              : registerMode
              ? 'Crea tu cuenta'
              : savedCustomer?.customerName
              ? 'Cambiar de usuario'
              : 'Bienvenido a Empresas Alvarados'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {panel === 'confirm'
              ? `Confirma tu identidad con ${BIO_METHOD_LABEL} para continuar.`
              : registerMode
              ? `Regístrate en segundos con tu teléfono y ${BIO_METHOD_LABEL}. El nombre se autocompleta en tus próximos accesos.`
              : `Identifícate para pedir. Tu teléfono + ${BIO_METHOD_LABEL} es tu tarjeta de cliente.`}
          </p>
        </div>

        {panel === 'confirm' ? (
          step === 'form' ? (
            <div className="p-5 sm:p-7 space-y-4">
              <button
                type="button"
                onClick={handleConfirmBiometric}
                disabled={isWorking}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-slate-800/70 border border-teal-500/30 hover:border-teal-400/60 hover:bg-slate-700/60 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="p-2 rounded-xl bg-teal-500/20 text-teal-400 shrink-0">
                  {IS_IOS ? (
                    <span className="flex items-center gap-1">
                      <Icon name="apple" className="w-4 h-4" />
                      <Icon name="faceId" className="w-4 h-4" />
                    </span>
                  ) : (
                    <Icon name="fingerprint" className="w-5 h-5" />
                  )}
                </span>
                <span className="flex-1 text-left">
                  <span className="block text-[11px] font-bold text-teal-300">
                    {webauthnSupported ? `Confirmar con ${BIO_METHOD_LABEL}` : 'Continuar sin biometría'}
                  </span>
                  <span className="block text-[11px] text-slate-400 leading-snug">
                    {!webauthnSupported
                      ? `Tu dispositivo no tiene ${BIO_METHOD_LABEL}. Podés continuar igual.`
                      : IS_IOS
                      ? 'Usa tu Face ID'
                      : 'Usa tu huella'}
                  </span>
                </span>
                <Icon name="arrowRight" className="w-4 h-4 text-teal-400 shrink-0" />
              </button>

              {webauthnError && (
                <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5">{webauthnError}</p>
              )}

              {confirmKindState === 'logout' && (
                <button
                  type="button"
                  onClick={() => onConfirmBiometric('logout')}
                  className="w-full py-2 text-[11px] text-slate-500 hover:text-rose-300 transition-colors"
                >
                  Prefiero salir sin biometría
                </button>
              )}
            </div>
          ) : (
            <div className="p-8 sm:p-10 flex flex-col items-center text-center space-y-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-slate-950 shadow-xl shadow-teal-500/30 animate-pulse">
                  <Icon name={webAuthnStep === 'login' ? 'user' : 'check'} className="w-10 h-10" />
                </div>
                <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-4 border-slate-900 flex items-center justify-center">
                  <Icon name="check" className="w-3 h-3 text-slate-950" />
                </span>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {webAuthnStep === 'login' ? 'Confirma tu identidad' : `Registra tu ${BIO_METHOD_LABEL}`}
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {webAuthnStep === 'login'
                    ? 'Usa tu huella o Face ID para confirmar que eres tú.'
                    : 'Usa tu huella o Face ID una vez. La próxima vez te reconoceremos al instante.'}
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                disabled={isWorking}
                className="text-xs text-slate-500 hover:text-teal-300 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          )
        ) : step === 'form' ? (
          <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-4">
            {/* Teléfono primero (el nombre se autocompleta si ya está registrado) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Teléfono / WhatsApp *</label>
              <div className="flex gap-2">
                <select
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                  className="w-24 shrink-0 px-3 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm font-bold focus:border-teal-500 focus:outline-none"
                >
                  {PHONE_CODES.map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phoneNumber}
                  onChange={(e) => handlePhoneNumber(e.target.value)}
                  placeholder="1234567"
                  maxLength={7}
                  autoFocus={!savedCustomer?.customerName}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
              {errors.phone && <p className="text-xs text-rose-400 mt-1">{errors.phone}</p>}
            </div>

            {/* Nombre */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Tu Nombre *</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ej: Juan Pérez"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
              />
              {errors.customerName && <p className="text-xs text-rose-400 mt-1">{errors.customerName}</p>}
            </div>

            {/* Recordarme: conserva los campos para el próximo login */}
            <button
              type="button"
              onClick={() => toggleRemember(!remember)}
              className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-800/50 border border-slate-700/70 hover:border-teal-500/40 transition-all"
            >
              <span className="flex items-center gap-2.5">
                <span className={`p-1.5 rounded-lg transition-all ${remember ? 'bg-teal-500/25 text-teal-400' : 'bg-slate-700/50 text-slate-500'}`}>
                  <Icon name="check" className="w-3.5 h-3.5" />
                </span>
                <span className="text-left">
                  <span className="block text-xs font-semibold text-slate-200">Recordarme</span>
                  <span className="block text-[10px] text-slate-500">Conservo estos datos para tu próxima visita</span>
                </span>
              </span>
              <span className={`relative w-11 h-6 rounded-full transition-all shrink-0 ${remember ? 'bg-teal-500' : 'bg-slate-700'}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${remember ? 'left-5' : 'left-0.5'}`} />
              </span>
            </button>

            {/* Botón de biometría accionable (huella / Face ID) */}
            <button
              type="button"
              onClick={handleBiometricAction}
              disabled={isWorking}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-slate-800/70 border border-teal-500/30 hover:border-teal-400/60 hover:bg-slate-700/60 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="p-2 rounded-xl bg-teal-500/20 text-teal-400 shrink-0">
                {IS_IOS ? (
                  <span className="flex items-center gap-1">
                    <Icon name="apple" className="w-4 h-4" />
                    <Icon name="faceId" className="w-4 h-4" />
                  </span>
                ) : (
                  <Icon name="fingerprint" className="w-5 h-5" />
                )}
              </span>
              <span className="flex-1 text-left">
                <span className="block text-[11px] font-bold text-teal-300">Verificar con {BIO_METHOD_LABEL}</span>
                <span className="block text-[11px] text-slate-400 leading-snug">
                  {!webauthnSupported
                    ? `Tu dispositivo no tiene ${BIO_METHOD_LABEL}. Podés entrar con tu teléfono y nombre.`
                    : IS_IOS
                    ? 'Usa tu Face ID'
                    : 'Usa tu huella'}
                </span>
              </span>
              <Icon name="arrowRight" className="w-4 h-4 text-teal-400 shrink-0" />
            </button>

            {webauthnError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5">{webauthnError}</p>
            )}

            {/* Acciones */}
            <div className="space-y-2.5 pt-1">
              <button
                type="submit"
                disabled={isWorking}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-sm hover:from-teal-400 hover:to-emerald-400 shadow-xl shadow-teal-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Icon name="check" className="w-4 h-4" />
                {registerMode ? 'Crear mi cuenta' : 'Entrar a Empresas Alvarados'}
              </button>
              {registerMode ? (
                <button
                  type="button"
                  onClick={() => setRegisterMode(false)}
                  className="w-full py-2.5 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-700/70 transition-all"
                >
                  ¿Ya tienes cuenta? Iniciar sesión
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setRegisterMode(true)}
                  className="w-full py-2.5 rounded-2xl bg-slate-800 border border-slate-700 text-teal-300 text-xs font-semibold hover:bg-slate-700/70 transition-all"
                >
                  ¿Primera vez? Regístrate
                </button>
              )}
              {savedCustomer?.customerName && (
                <button
                  type="button"
                  onClick={() => { setConfirmKindState('switchback'); setPanel('confirm'); }}
                  className="w-full py-2.5 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-700/70 transition-all"
                >
                  Volver a {savedCustomer.customerName.split(' ')[0]}
                </button>
              )}
            </div>
          </form>
        ) : (
          <div className="p-8 sm:p-10 flex flex-col items-center text-center space-y-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-slate-950 shadow-xl shadow-teal-500/30 animate-pulse">
                {webAuthnStep === 'login' ? (
                  <Icon name="user" className="w-10 h-10" />
                ) : (
                  <Icon name="check" className="w-10 h-10" />
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-4 border-slate-900 flex items-center justify-center">
                <Icon name="check" className="w-3 h-3 text-slate-950" />
              </span>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {webAuthnStep === 'login' ? 'Confirma tu identidad' : `Registra tu ${BIO_METHOD_LABEL}`}
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {webAuthnStep === 'login'
                  ? 'Usa tu huella o Face ID para confirmar que eres tú.'
                  : 'Usa tu huella o Face ID una vez. La próxima vez te reconoceremos al instante.'}
              </p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              disabled={isWorking}
              className="text-xs text-slate-500 hover:text-teal-300 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CartDrawer({ isOpen, onClose, cart, cartTotal, rate, onUpdateQty, onRemove, onProceedToCheckout, holdDeadline, onShare }) {
  const [nowMs, setNowMs] = useState(Date.now());

  useOverlay(isOpen, onClose);
  // Swipe-down cierra + detents (#6): tirar hacia arriba expande a pantalla.
  const sheetRef = useSwipeToClose(onClose, isOpen, { detents: true });

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const holdLeft = holdDeadline ? Math.max(0, holdDeadline - nowMs) : 0;
  const holdMin = Math.floor(holdLeft / 60000);
  const holdSec = Math.floor((holdLeft % 60000) / 1000);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-end bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div ref={sheetRef} className="relative w-full sm:max-w-md glass-strong bg-slate-900 sm:h-full h-[92dvh] sm:border-l border-t sm:border-t-0 border-slate-800 shadow-2xl flex flex-col z-10 sm:animate-slide-left animate-screen-up">
        {/* Asa de arrastre (móvil): la hoja se cierra deslizando hacia abajo */}
        <div className="sm:hidden absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-slate-600/70 pointer-events-none z-20" aria-hidden="true" />
        {/* Drawer Header */}
        <div className="pt-[max(1rem,env(safe-area-inset-top))] p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
              <Icon name="shoppingBag" className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Tu Carrito</h2>
              {holdLeft > 0 && (
                <p className={`text-[11px] font-bold ${holdLeft <= 60000 ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`}>
                  ⏳ Reservado por {holdMin}:{String(holdSec).padStart(2, '0')}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body - Items list */}
        <div data-sheet-scroll className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 sm:space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 text-slate-500">
              <Theo mood="idle" className="w-36 h-32" />
              <p className="font-semibold text-slate-400">Theo cuida tu carrito… está vacío</p>
              <p className="text-xs">Agrega algunos productos del catálogo para comenzar.</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product.id}
                className="flex items-center gap-3 sm:gap-4 p-3 sm:p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 group hover:border-slate-600 transition-all"
              >
                <ProductImg
                  product={item.product}
                  alt={item.product.name}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover bg-slate-900 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-200 text-xs sm:text-sm truncate">
                    {item.product.name}
                  </h4>
                  <span className="text-xs text-teal-400 font-semibold block mt-1">
                    {formatUsd(item.product.price)} c/u
                    {rate?.rate > 0 && (
                      <span className="block text-[10px] text-slate-400 font-medium">
                        {formatBs(usdToBs(item.product.price, rate.rate))} c/u
                      </span>
                    )}
                  </span>

                  {/* Quantity bar */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
                      <button
                        onClick={() => onUpdateQty(item.product.id, -1)}
                        className="p-1 rounded text-slate-400 hover:text-white"
                      >
                        <Icon name="minus" className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold w-5 text-center text-white">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQty(item.product.id, 1)}
                        className="p-1 rounded text-slate-400 hover:text-white"
                      >
                        <Icon name="plus" className="w-3 h-3" />
                      </button>
                    </div>

<button
                      onClick={() => onRemove(item.product.id)}
                      className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors ml-auto"
                      title="Eliminar del carrito"
                    >
                      <Icon name="trash" className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer Summary */}
        {cart.length > 0 && (
          <div
            className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/90 space-y-4 shrink-0"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Subtotal</span>
                <span>
                  {formatUsd(cartTotal)}
                  {rate?.rate > 0 && (
                    <span className="block text-[10px] text-slate-500 text-right">
                      {formatBs(usdToBs(cartTotal, rate.rate))}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Costo de preparación</span>
                <span className="text-teal-400 font-semibold">¡GRATIS!</span>
              </div>
              <div className="flex justify-between text-base font-black text-white pt-2 border-t border-slate-800">
                <span>Total a Pagar</span>
                <span className="text-teal-400 text-right">
                  <Money value={cartTotal} />
                  {rate?.rate > 0 && (
                    <span className="block text-[11px] text-teal-300/90">
                      {formatBs(usdToBs(cartTotal, rate.rate))}
                    </span>
                  )}
                </span>
              </div>
            </div>

            <Btn
              onClick={onProceedToCheckout}
              variant="primary"
              size="xl"
              icon="check"
              className="shadow-xl shadow-teal-500/25"
            >
              Confirmar y Elegir Forma de Pago
            </Btn>

            <Btn
              onClick={onShare}
              variant="tonal"
              size="md"
              icon="share2"
              className="w-full py-3"
            >
              Compartir carrito
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}

// Drawer de Mis Pedidos (mismo patrón que el carrito: ante menú inferior, X para cerrar)
function OrdersDrawer({ isOpen, onClose, orders, rate, onViewOrderDetail, onTrackLiveOrder, onRequestCancelOrder, isBenefited }) {
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState({ preset: 'all', date: null });
  const [showCalendar, setShowCalendar] = useState(false);
  const PAGE_SIZE = 6;

  useOverlay(isOpen, onClose);
  // Swipe hacia abajo para cerrar (solo móvil / bottom sheet).
  const sheetRef = useSwipeToClose(onClose, isOpen);

  const filtered = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const dow = (todayStart.getDay() + 6) % 7; // 0 = Monday
    const thisMon = new Date(todayStart); thisMon.setDate(thisMon.getDate() - dow);
    const thisSun = new Date(thisMon); thisSun.setDate(thisSun.getDate() + 6);
    const lastMon = new Date(thisMon); lastMon.setDate(lastMon.getDate() - 7);
    const lastSun = new Date(thisMon); lastSun.setDate(lastSun.getDate() - 1);
    return (orders || []).filter((o) => {
      const d = parseOrderDate(o);
      if (isNaN(d)) return true;
      switch (dateFilter.preset) {
        case 'today': return startOfDay(d).getTime() === todayStart.getTime();
        case 'thisWeek': return d >= thisMon && d <= thisSun;
        case 'lastWeek': return d >= lastMon && d <= lastSun;
        case 'day': return dateFilter.date && toYMD(d) === dateFilter.date;
        default: return true;
      }
    });
  }, [orders, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [dateFilter]);
  useEffect(() => { if (isOpen) { setPage(1); setDateFilter({ preset: 'all', date: null }); } }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-end bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div ref={sheetRef} className="relative w-full sm:max-w-md glass-strong bg-slate-900 sm:h-full h-[92dvh] sm:border-l border-t sm:border-t-0 border-slate-800 shadow-2xl flex flex-col z-10 sm:animate-slide-left animate-screen-up">
        {/* Asa de arrastre (móvil): la hoja se cierra deslizando hacia abajo */}
        <div className="sm:hidden absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-slate-600/70 pointer-events-none z-20" aria-hidden="true" />
        {/* Drawer Header */}
        <div className="pt-[max(1rem,env(safe-area-inset-top))] p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
              <Icon name="package" className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Mis Pedidos</h2>
              <span className="block text-[11px] text-slate-400">{orders?.length || 0} pedido{(orders?.length || 0) !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div data-sheet-scroll className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {(!orders || orders.length === 0) ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 text-slate-500">
              <Icon name="package" className="w-16 h-16 stroke-1 text-slate-700" />
              <p className="font-semibold text-slate-400">Todavía no tienes pedidos</p>
              <p className="text-xs">Haz tu primer pedido y aparecerá aquí.</p>
            </div>
          ) : (
            <>
              {/* Filtros de fecha */}
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { key: 'all', label: 'Todos' },
                    { key: 'today', label: 'Hoy' },
                    { key: 'thisWeek', label: 'Esta semana' },
                    { key: 'lastWeek', label: 'Semana anterior' }
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setDateFilter({ preset: f.key, date: null })}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                        dateFilter.preset === f.key
                          ? 'bg-teal-500 text-slate-950 shadow-sm'
                          : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-700/60'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                  <div className="relative">
                    <button
                      onClick={() => setShowCalendar(!showCalendar)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-300 text-[11px] font-medium hover:bg-slate-700/60 flex items-center gap-1.5"
                    >
                      <Icon name="filter" className="w-3.5 h-3.5" />
                      {dateFilter.preset === 'day' && dateFilter.date ? dateFilter.date : 'Calendario'}
                    </button>
                    {showCalendar && (
                      <MiniCalendar
                        value={dateFilter.date}
                        onChange={(d) => { setDateFilter({ preset: 'day', date: d }); setShowCalendar(false); }}
                        onClose={() => setShowCalendar(false)}
                      />
                    )}
                  </div>
                </div>

                {/* Paginación */}
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                  <span>
                    Mostrando {paged.length > 0 ? ((safePage - 1) * PAGE_SIZE + 1) : 0}–{Math.min(safePage * PAGE_SIZE, filtered.length)} de {filtered.length}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                      className="px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700/60"
                    >
                      <Icon name="minus" className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 font-semibold text-white">{safePage} / {totalPages}</span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                      className="px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700/60"
                    >
                      <Icon name="plus" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Lista de pedidos */}
              {paged.length === 0 ? (
                <div className="text-center py-8 space-y-2 text-slate-500">
                  <Icon name="search" className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs font-semibold text-slate-400">No hay pedidos en este filtro</p>
                </div>
              ) : (
                paged.map((o) => {
                  const style = STATUS_STYLES[o.status] || STATUS_STYLES.pendiente;
                  const cancellable = o.status === 'pendiente' || o.status === 'en_preparacion';
                  const payRejected = o.paymentMethod && o.paymentMethod !== 'efectivo' && o.paymentStatus === 'rechazado';
                  const payPending = needsPaymentValidation(o);
                  return (
                    <div key={o.id} className={`p-3 rounded-xl sm:rounded-2xl bg-slate-900/60 border ${payRejected ? 'border-rose-500/50' : 'border-slate-700/50'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm font-bold text-white">
                          Pedido <span className="text-teal-400">#{o.id}</span>
                        </span>
                        {payPending ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 border border-amber-500/40 text-amber-300">
                            Pago en revisión
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${payRejected ? STATUS_STYLES.cancelado.badge : style.badge}`}>
                            {payRejected ? 'Pago rechazado' : STATUS_LABELS[o.status] || 'Pendiente'}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1">
                        {o.timestamp} · {o.items.length} artículo{o.items.length !== 1 ? 's' : ''} · {formatUsd(o.total)}
                      </p>
                      {(o.paymentMethod === 'cartera' || Number(o.walletApplied) > 0) && (
                        <p className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-300 text-[10px] font-bold">
                          <Icon name="wallet" className="w-3 h-3" />
                          Pagado con cartera
                        </p>
                      )}
                      <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
                        {o.type === 'delivery' ? `Envío a ${o.address || 'domicilio'}` : 'Retiro en tienda'}
                      </p>
                      {payRejected && (
                        <div className="mt-2 flex items-start gap-1.5 rounded-xl bg-rose-500/10 border border-rose-500/40 p-2 text-[11px] text-rose-200/90">
                          <Icon name="alertTriangle" className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-400" />
                          <span>Tu pago fue rechazado. Suministra otro comprobante
                            {isBenefited ? ' o pásalo a tu cuenta' : ''} en Ver detalle.</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2.5">
                        <button
                          onClick={() => onViewOrderDetail(o)}
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold hover:bg-cyan-500/25 transition-all flex items-center justify-center gap-1"
                        >
                          <Icon name="eye" className="w-3 h-3" />
                          Ver detalle
                        </button>
                        {o.type === 'delivery' && o.status !== 'cancelado' && o.status !== 'entregado' && (
                          <button
                            onClick={() => onTrackLiveOrder(o)}
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1"
                          >
                            <Icon name="mapPin" className="w-3 h-3" />
                            Rastrear
                          </button>
                        )}
                        {cancellable && (
                          <button
                            onClick={() => onRequestCancelOrder(o)}
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-bold hover:bg-rose-500/25 transition-all flex items-center justify-center gap-1"
                          >
                            <Icon name="x" className="w-3 h-3" />
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CartFloatBar({ cartCount, cartTotal, rate, onOpen }) {
  return (
    <button
      data-cart-target
      onClick={onOpen}
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      className="fixed bottom-[4.6rem] sm:bottom-4 left-0 right-0 sm:left-1/2 sm:-translate-x-1/2 sm:w-[calc(100%-2rem)] sm:max-w-lg z-40 px-4 sm:px-5 pt-3.5 sm:pt-4 bg-slate-950/90 sm:rounded-3xl border-t sm:border border-teal-500/40 shadow-2xl shadow-teal-500/20 backdrop-blur-xl flex items-center justify-between gap-4 animate-screen-up hover:border-teal-400/60 transition-all group btn-sink"
    >
      <div className="flex items-center gap-2.5 sm:gap-3">
        <span className="relative p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-teal-500/15 text-teal-400">
          <Icon key={`bag-${cartCount}`} name="shoppingBag" className="w-5 h-5 animate-cart-bounce" />
          <span key={`badge-${cartCount}`} className="absolute -top-1 -right-1 bg-teal-400 text-slate-950 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-badge-spring">
            {cartCount}
          </span>
        </span>
        <div className="text-left min-w-0">
          <span className="block text-[11px] text-slate-400 font-semibold">
            {cartCount} {cartCount === 1 ? 'producto' : 'productos'}
          </span>
          <span className="block text-base sm:text-lg font-black text-white truncate">
            <Money value={cartTotal} />
            {rate?.rate > 0 && (
              <span className="text-[10px] sm:text-[11px] font-bold text-teal-300/90 ml-1.5 sm:ml-2">
                {formatBs(usdToBs(cartTotal, rate.rate))}
              </span>
            )}
          </span>
        </div>
      </div>
      <span className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-teal-500/20 group-hover:from-teal-400 group-hover:to-emerald-400 transition-all flex items-center gap-1.5 shrink-0">
        Ver
        <Icon name="arrowRight" className="w-4 h-4" />
      </span>
    </button>
  );
}

// Barra de navegación inferior fija (solo móvil). Ofrece acceso a una mano a
// Tienda, Carrito, Mis Pedidos, Mi Cuenta y al Panel. En vista admin muestra
// los accesos principales del panel.
function BottomTabBar({
  activeView,
  customerTab,
  onCustomerTab,
  cartCount,
  hasCustomer,
  isAdmin,
  onOpenCart,
  onGoAdmin,
  onGoStore,
  onOpenLogin,
  onCustomerLogout,
  adminTab,
  onAdminTab,
  pendingOrders,
  pendingPayments,
  onLogout,
  isAdminAuthed,
  calcOpen,
  onToggleCalc
}) {
  const base =
    'flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 flex-[1_0_auto] min-w-[64px] max-w-[104px] rounded-2xl transition-all duration-300 active:scale-95';
  const activeTab =
    'bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-lg shadow-teal-500/10';
  const idleTab = 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 border border-transparent';

  const customerTabs = [
    {
      key: 'store',
      label: 'Tienda',
      icon: 'home',
      onClick: onGoStore,
      badge: null
    },
    {
      key: 'calc',
      label: 'Calculadora',
      icon: 'calculator',
      onClick: onToggleCalc,
      badge: null
    },
    ...(hasCustomer
      ? [
          {
            key: 'cart',
            label: 'Carrito',
            icon: 'bag',
            onClick: onOpenCart,
            badge: cartCount > 0 ? cartCount : null
          },
          {
            key: 'orders',
            label: 'Mis Pedidos',
            icon: 'list',
            onClick: () => onCustomerTab('orders'),
            badge: null
          },
          {
            key: 'account',
            label: 'Mi Cuenta',
            icon: 'user',
            onClick: () => onCustomerTab('account'),
            badge: null
          }
        ]
      : [])
  ];

  const adminTabs = [
    { key: 'inventory', label: 'Inventario', icon: 'package', onClick: () => onAdminTab('inventory'), badge: null },
    { key: 'ventas', label: 'Ventas', icon: 'shoppingBag', onClick: () => onAdminTab('ventas'), badge: null },
    { key: 'orders', label: 'Pedidos', icon: 'clock', onClick: () => onAdminTab('orders'), badge: pendingOrders > 0 ? pendingOrders : null },
    { key: 'benefited', label: 'Beneficiados', icon: 'users', onClick: () => onAdminTab('benefited'), badge: null },
    { key: 'blacklist', label: 'Lista Negra', icon: 'alertTriangle', onClick: () => onAdminTab('blacklist'), badge: null },
    { key: 'abonos', label: 'Abonos', icon: 'wallet', onClick: () => onAdminTab('abonos'), badge: pendingPayments > 0 ? pendingPayments : null },
    { key: 'analytics', label: 'Finanzas', icon: 'trendingUp', onClick: () => onAdminTab('analytics'), badge: null },
    { key: 'profile', label: 'Perfil', icon: 'user', onClick: () => onAdminTab('profile'), badge: null }
  ];

  const tabs = activeView === 'admin' && isAdminAuthed ? adminTabs : customerTabs;

  // En vista cliente: si el tab actual es orders/account y el usuario tocó esa
  // sección, se marca activo. Carrito siempre "activo" mientras tenga items.
  const isTabActive = (t) => {
    if (activeView === 'admin' && isAdminAuthed) return adminTab === t.key;
    if (t.key === 'cart') return cartCount > 0;
    if (t.key === 'calc') return calcOpen;
    return customerTab === t.key;
  };

  // En el login admin (admin sin autenticar) no se muestran opciones de navegación.
  if (activeView === 'admin' && !isAdminAuthed) return null;

  return (
    <nav
      style={{ paddingBottom: 'max(0.4rem, env(safe-area-inset-bottom))' }}
      className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/80 flex items-stretch gap-1 px-2 pt-2 pb-1 overflow-x-auto scrollbar-none animate-screen-up"
      aria-label="Navegación principal"
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={t.onClick}
          className={`${base} ${isTabActive(t) ? activeTab : idleTab}`}
          aria-label={t.label}
        >
          <span className="relative">
            <Icon name={t.icon} className="w-5 h-5" />
            {t.badge != null && (
              <span
                key={`${t.key}-${t.badge}`}
                className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[9px] font-black min-w-4 h-4 px-1 rounded-full flex items-center justify-center animate-badge-pop"
              >
                {t.badge}
              </span>
            )}
          </span>
          <span className="text-[10px] font-bold leading-none truncate">{t.label}</span>
        </button>
      ))}
      {activeView === 'customer' && !hasCustomer && (
        <button
          onClick={onOpenLogin}
          className={`${base} text-teal-400 hover:text-teal-300 ${idleTab}`}
          aria-label="Iniciar sesión"
        >
          <Icon name="userPlus" className="w-5 h-5" />
          <span className="text-[10px] font-bold leading-none">Iniciar sesión</span>
        </button>
      )}
      {activeView === 'customer' && isAdmin && (
        <button
          onClick={onGoAdmin}
          className={`${base} text-cyan-400 hover:text-cyan-300 ${idleTab}`}
          aria-label="Ir al panel de administración"
        >
          <Icon name="layers" className="w-5 h-5" />
          <span className="text-[10px] font-bold leading-none">Panel</span>
        </button>
      )}
      {activeView === 'customer' && hasCustomer && (
        <button
          onClick={onCustomerLogout}
          className={`${base} text-rose-400 hover:text-rose-300 ${idleTab}`}
          aria-label="Cerrar sesión"
        >
          <Icon name="logOut" className="w-5 h-5" />
          <span className="text-[10px] font-bold leading-none">Salir</span>
        </button>
      )}
      {activeView === 'admin' && isAdminAuthed && (
        <button
          onClick={onLogout}
          className={`${base} text-rose-400 hover:text-rose-300 ${idleTab}`}
          aria-label="Cerrar sesión"
        >
          <Icon name="x" className="w-5 h-5" />
          <span className="text-[10px] font-bold leading-none">Salir</span>
        </button>
      )}
    </nav>
  );
}

// Marcador Leaflet personalizado (divIcon con SVG inline) para no depender de
// imágenes externas. Evita que Leaflet intente cargar sus iconos por defecto.
const makePinIcon = (color, label) =>
  L.divIcon({
    className: '',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))">
        <span style="font-size:10px;font-weight:800;color:${color};background:#0f172a;border:1px solid ${color};border-radius:999px;padding:0 6px;white-space:nowrap">${label || ''}</span>
        <svg width="26" height="34" viewBox="0 0 26 34" style="overflow:visible">
          <path d="M13 1C6.4 1 1 6.4 1 13c0 8.8 12 20 12 20s12-11.2 12-20C25 6.4 19.6 1 13 1z" fill="${color}" stroke="#fff" stroke-width="2"/>
          <circle cx="13" cy="13" r="4.5" fill="#fff"/>
        </svg>
      </div>`,
    iconSize: [26, 44],
    iconAnchor: [13, 42]
  });

// Marcador "repartidor" estilo Uber: núcleo circular emerald que viaja con el
// repartidor, con un halo expansivo que pulsa (look de "entrega en vivo").
const makeCourierIcon = () =>
  L.divIcon({
    className: '',
    html: `
      <div class="kiosko-courier-dot" style="filter:drop-shadow(0 3px 6px rgba(0,0,0,.45))">
        <div class="kiosko-courier-core">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg>
        </div>
      </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

// Marcador "destino" estilo Uber Eats: círculo con paquete/bolsa en destino.
const makeDestIcon = () =>
  L.divIcon({
    className: '',
    html: `
      <div style="display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 3px 6px rgba(0,0,0,.45))">
        <div style="width:30px;height:30px;border-radius:9999px;background:#0f172a;border:3px solid #f43f5e;color:#fb7185;display:flex;align-items:center;justify-content:center">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/></svg>
        </div>
      </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

// Mapa interactivo (Leaflet + OpenStreetMap, sin API key) para la entrega a
// domicilio. Muestra el comercio (origen), el destino del cliente, la posición
// en vivo del repartidor y el camino sugerido repartidor → destino (OSRM).

// ETA Predictivo: calcula la distancia en línea recta entre el repartidor y el
// destino y estima el tiempo de llegada asumiendo una velocidad promedio de
// moto/delivery urbano (~20 km/h). Se refresca con cada actualización del rastreo.
function EtaEstimate({ cLat, cLng, dLat, dLng }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const km = haversineKm(cLat, cLng, dLat, dLng);
  const kmRoad = km * 1.3; // factor por caminos (no línea recta)
  const minutes = Math.max(1, Math.round((kmRoad / 20) * 60));
  const eta = new Date(now + minutes * 60000);
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="rounded-xl bg-slate-900/60 border border-teal-500/20 p-2.5">
        <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Distancia</span>
        <span className="block text-lg font-black text-white mt-0.5">
          {km.toFixed(1)}<span className="text-[10px] font-semibold text-slate-400 ml-0.5">km</span>
        </span>
      </div>
      <div className="rounded-xl bg-slate-900/60 border border-teal-500/20 p-2.5">
        <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Llegada</span>
        <span className="block text-lg font-black text-teal-300 mt-0.5">
          {eta.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="rounded-xl bg-slate-900/60 border border-teal-500/20 p-2.5">
        <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Tiempo</span>
        <span className="block text-lg font-black text-white mt-0.5">
          ~{minutes}<span className="text-[10px] font-semibold text-slate-400 ml-0.5">min</span>
        </span>
      </div>
    </div>
  );
}

function DeliveryMap({ order, storeLocation }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerGroupRef = useRef(null);
  const fittedRef = useRef(false);
  const courierMarkerRef = useRef(null);
  const routeRef = useRef(null);

  const dest = order && order.lat != null && order.lng != null;
  const courier = order && order.courier_lat != null && order.courier_lng != null;
  const store = storeLocation && storeLocation.lat != null && storeLocation.lng != null;
  const showMap = order && order.type === 'delivery' && (dest || courier || store);

  // Crea el mapa una sola vez.
  useEffect(() => {
    if (!showMap || !containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    mapRef.current = map;
    layerGroupRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      fittedRef.current = false;
      courierMarkerRef.current = null;
      routeRef.current = null;
    };
  }, [showMap]);

  // Dibuja/actualiza marcadores y ruta cuando cambian los datos. El viewport
  // solo se ajusta la primera vez (o si aún no hay repartidor); después el mapa
  // conserva el zoom y el desplazamiento que el usuario estableció, y cuando el
  // repartidor sale de la vista se centra suavemente en él sin cambiar el zoom.
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    const pts = [];
    if (store) pts.push({ lat: Number(storeLocation.lat), lng: Number(storeLocation.lng), kind: 'store' });
    if (dest) pts.push({ lat: Number(order.lat), lng: Number(order.lng), kind: 'dest' });
    if (courier) pts.push({ lat: Number(order.courier_lat), lng: Number(order.courier_lng), kind: 'courier' });

    // Marcadores estáticos (comercio y destino) se recrean; el del repartidor se
    // reutiliza para no parpadear ni resetear el mapa en cada update.
    layerGroup.clearLayers();
    let courierMarker = courierMarkerRef.current;
    pts.forEach((m) => {
      let icon;
      if (m.kind === 'courier') icon = makeCourierIcon();
      else if (m.kind === 'store') icon = makePinIcon('#22d3ee', 'COMERCIO');
      else icon = makeDestIcon();
      if (m.kind === 'courier') {
        if (!courierMarker) {
          courierMarker = L.marker([m.lat, m.lng], { icon, zIndexOffset: 1000 }).addTo(layerGroup);
          courierMarkerRef.current = courierMarker;
        } else {
          courierMarker.setLatLng([m.lat, m.lng]);
          courierMarker.setIcon(icon);
          courierMarker.addTo(layerGroup);
        }
      } else {
        L.marker([m.lat, m.lng], { icon }).addTo(layerGroup);
      }
    });

    // Ruta (línea recta provisional → OSRM cuando responde).
    if (routeRef.current) {
      layerGroup.removeLayer(routeRef.current);
      routeRef.current = null;
    }
    if (courier && dest) {
      routeRef.current = L.polyline(
        [
          [Number(order.courier_lat), Number(order.courier_lng)],
          [Number(order.lat), Number(order.lng)]
        ],
        { color: '#a7f3d0', weight: 5, opacity: 0.5, className: 'kiosko-route-animated' }
      ).addTo(layerGroup);
      const url = `https://router.project-osrm.org/route/v1/driving/${Number(order.courier_lng)},${Number(order.courier_lat)};${Number(order.lng)},${Number(order.lat)}?overview=full&geometries=geojson`;
      fetch(url)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => {
          const coords = data?.routes?.[0]?.geometry?.coordinates;
          if (!Array.isArray(coords) || coords.length < 2) return;
          if (routeRef.current) layerGroup.removeLayer(routeRef.current);
          const poly = L.polyline(
            coords.map((c) => [c[1], c[0]]),
            { color: '#10b981', weight: 5, opacity: 0.9, className: 'kiosko-route-animated' }
          ).addTo(layerGroup);
          routeRef.current = poly;
        })
        .catch(() => {});
    }

    // Ajuste de viewport: solo en el primer render (o cuando aún no hay
    // repartidor en vivo). No se vuelve a llamar en cada update del rastreo.
    const shouldFit = !fittedRef.current || !courier;
    if (pts.length && shouldFit) {
      const latLngs = pts.map((p) => [p.lat, p.lng]);
      map.fitBounds(L.latLngBounds(latLngs).pad(0.25), { animate: false });
      fittedRef.current = true;
    } else if (courier) {
      // Sigue al repartidor: si salió del viewport actual, lo centra con pan
      // suave SIN cambiar el zoom que el usuario dejó.
      const courierLatLng = L.latLng(Number(order.courier_lat), Number(order.courier_lng));
      if (!map.getBounds().contains(courierLatLng)) {
        map.panTo(courierLatLng, { animate: true, duration: 0.5 });
      }
    }
  }, [courier, dest, store, storeLocation?.lat, storeLocation?.lng, order?.lat, order?.lng, order?.courier_lat, order?.courier_lng]);

  const destUrl = dest ? `https://www.google.com/maps?q=${Number(order.lat)},${Number(order.lng)}` : null;
  const courierUrl = courier ? `https://www.google.com/maps?q=${Number(order.courier_lat)},${Number(order.courier_lng)}` : null;
  const storeUrl = store ? `https://www.google.com/maps?q=${Number(storeLocation.lat)},${Number(storeLocation.lng)}` : null;

  if (!showMap) return null;

  const statusLabel = order.status === 'en_camino' ? 'En camino a tu destino' : STATUS_LABELS[order.status] || 'En preparación';

  return (
    <div className="space-y-2.5">
      {/* Cabecera de estado estilo Uber */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900/80 border border-slate-700/80">
        <span className="relative flex w-3 h-3 shrink-0">
          <span className={`absolute inline-flex h-full w-full rounded-full ${courier ? 'bg-emerald-400 opacity-75 animate-ping' : 'bg-teal-400 opacity-75 animate-ping'}`} />
          <span className={`relative inline-flex rounded-full w-3 h-3 ${courier ? 'bg-emerald-400' : 'bg-teal-400'}`} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white truncate">{statusLabel}</p>
          <p className="text-[11px] text-slate-400 truncate">
            {courier
              ? 'Repartidor en vivo · la posición se actualiza cada 5 s'
              : dest
              ? 'Preparando tu pedido para la entrega'
              : 'Tu pedido de reparto se está preparando'}
          </p>
        </div>
        {courier && courierUrl && (
          <a
            href={courierUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold hover:bg-emerald-500/25 transition-all"
            title="Ver repartidor en Google Maps"
          >
            <Icon name="externalLink" className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      <div className="relative z-0 rounded-2xl overflow-hidden border border-slate-700 bg-slate-900">
        <div ref={containerRef} className="w-full h-48 sm:h-60" />
        {/* Badge flotante: repartidor en vivo */}
        {courier && (
          <div className="absolute top-2.5 left-2.5 z-[1000] flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950/85 border border-emerald-500/40 backdrop-blur-md text-emerald-300 text-[10px] font-bold pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            EN VIVO
          </div>
        )}
      </div>

      {/* ETA + distancia (estilo Uber: "llega en ~N min") */}
      {courier && dest && (
        <EtaEstimate cLat={Number(order.courier_lat)} cLng={Number(order.courier_lng)} dLat={Number(order.lat)} dLng={Number(order.lng)} />
      )}

      {/* Footer: enlaces rápidos a Google Maps */}
      <div className="flex flex-wrap gap-2">
        {store && storeUrl && (
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold hover:bg-cyan-500/25 transition-all"
          >
            <Icon name="store" className="w-3.5 h-3.5" />
            Comercio
          </a>
        )}
        {courier && courierUrl && (
          <a
            href={courierUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold hover:bg-emerald-500/25 transition-all"
          >
            <Icon name="mapPin" className="w-3.5 h-3.5" />
            Repartidor
          </a>
        )}
        {dest && destUrl && (
          <a
            href={destUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/15 border border-teal-500/40 text-teal-300 text-[11px] font-bold hover:bg-teal-500/25 transition-all"
          >
            <Icon name="mapPin" className="w-3.5 h-3.5" />
            Destino
          </a>
        )}
      </div>
    </div>
  );
}

// Mapa de entregas del día (Leaflet + OpenStreetMap): muestra el comercio y los
// destinos de los pedidos a domicilio activos, numerados según la ruta sugerida
// (el más cercano al comercio primero, y luego el siguiente más cercano).
function DeliveriesRouteMap({ storeLocation, deliveries, storeLabel = 'KIOSKO' }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerGroupRef = useRef(null);
  const hasStore = storeLocation && storeLocation.lat != null && storeLocation.lng != null;
  const hasDeliveries = Array.isArray(deliveries) && deliveries.some((d) => d.lat != null && d.lng != null);

  // Crea el mapa una sola vez (con una vista por defecto de Caracas como base).
  useEffect(() => {
    if (!hasStore && !hasDeliveries) return;
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true }).setView([10.4806, -66.9036], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    mapRef.current = map;
    layerGroupRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, [hasStore, hasDeliveries]);

  // Dibuja el comercio y los destinos numerados, más la línea de la ruta.
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;
    layerGroup.clearLayers();

    const store = hasStore ? { lat: Number(storeLocation.lat), lng: Number(storeLocation.lng) } : null;
    const dests = (deliveries || []).filter((d) => d.lat != null && d.lng != null);
    const ordered = [...dests].sort((a, b) => Number(a.routeNumber || 99) - Number(b.routeNumber || 99));

    // Ajusta el viewport a todos los puntos.
    const all = [];
    if (store) all.push([store.lat, store.lng]);
    ordered.forEach((d) => all.push([Number(d.lat), Number(d.lng)]));
    if (all.length) {
      map.fitBounds(L.latLngBounds(all).pad(0.25), { animate: false });
    }

    if (store) {
      L.marker([store.lat, store.lng], { icon: makePinIcon('#22d3ee', storeLabel) }).addTo(layerGroup);
    }
    ordered.forEach((d) => {
      L.marker([Number(d.lat), Number(d.lng)], {
        icon: makePinIcon('#f43f5e', String(d.routeNumber || ''))
      }).addTo(layerGroup);
    });

    // Línea de la ruta: comercio → destino 1 → 2 → …
    const linePts = [];
    if (store) linePts.push([store.lat, store.lng]);
    ordered.forEach((d) => linePts.push([Number(d.lat), Number(d.lng)]));
    if (linePts.length > 1) {
      L.polyline(linePts, { color: '#f43f5e', weight: 2.5, dashArray: '6 6', opacity: 0.6 }).addTo(layerGroup);
    }
  }, [storeLocation, deliveries, hasStore, hasDeliveries, storeLabel]);

  if (!hasStore && !hasDeliveries) return null;
  return (
    <div className="relative z-0 rounded-2xl overflow-hidden border border-slate-700 bg-slate-900 w-full">
      <div ref={containerRef} className="w-full h-72 sm:h-96" />
    </div>
  );
}
// Modal selector de punto en el mapa (Leaflet + OpenStreetMap). Lo usan el
// cliente (para elegir dónde recibir distinto de su ubicación actual) y el
// admin (para fijar la ubicación del comercio).
function MapPickerModal({ title, initial, onPick, onClose }) {
  useOverlay(true, onClose);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const initialPointRef = useRef(initial?.lat != null && initial?.lng != null ? { lat: initial.lat, lng: initial.lng } : null);
  const [point, setPoint] = useState(initialPointRef.current);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');

  // Crea el mapa y coloca un marcador arrastrable.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const start = initialPointRef.current;
    const defaultCenter = start ? [start.lat, start.lng] : [10.4806, -66.9036];
    const map = L.map(containerRef.current, { zoomControl: true }).setView(defaultCenter, start ? 16 : 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    mapRef.current = map;

    const marker = L.marker(defaultCenter, { icon: makePinIcon('#14b8a6', 'PUNTO'), draggable: true }).addTo(map);
    markerRef.current = marker;
    if (!initialPointRef.current) marker.setOpacity(0.6);

    map.on('click', (e) => {
      setPoint({ lat: e.latlng.lat, lng: e.latlng.lng });
      marker.setLatLng(e.latlng);
      marker.setOpacity(1);
    });
    marker.on('dragend', (e) => {
      setPoint({ lat: e.target.getLatLng().lat, lng: e.target.getLatLng().lng });
      marker.setOpacity(1);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Geocodificación con Nominatim (gratuita, sin key) para buscar direcciones.
  const searchTimer = useRef(null);
  const handleSearch = (e) => {
    const q = e.target.value;
    setSearch(q);
    clearTimeout(searchTimer.current);
    if (q.trim().length < 4) {
      setSuggestions([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q.trim())}&limit=6&addressdetails=1`);
        const data = await res.json();
        if (Array.isArray(data)) setSuggestions(data);
      } catch {
        setSuggestions([]);
      }
    }, 400);
  };

  const applySuggestion = (s) => {
    const lat = Number(s.lat);
    const lng = Number(s.lon);
    setPoint({ lat, lng });
    setSearch(s.display_name || s.name || '');
    setSuggestions([]);
    const map = mapRef.current;
    if (map) {
      map.setView([lat, lng], 17);
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
        markerRef.current.setOpacity(1);
      }
    }
  };

  // Ubicación actual del dispositivo (con guía de permiso como en checkout).
  const useMyLocation = () => {
    setLocError('');
    if (!navigator.geolocation) {
      setLocError('Tu navegador no soporta geolocalización.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPoint({ lat, lng });
        const map = mapRef.current;
        if (map) {
          map.setView([lat, lng], 17);
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
            markerRef.current.setOpacity(1);
          }
        }
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setLocError(err && err.code === 1 ? 'Permiso de ubicación denegado. Activalo en los ajustes del navegador.' : 'No se pudo obtener la ubicación.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  const confirm = () => {
    if (!point) {
      setLocError('Toca el mapa o busca una dirección para elegir el punto.');
      return;
    }
    onPick({ lat: Number(point.lat), lng: Number(point.lng), address: search.trim() || null });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg glass-strong bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 max-h-[92vh] flex flex-col overflow-hidden animate-modal-spring">
        <div className="pt-[max(1rem,env(safe-area-inset-top))] p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Icon name="mapPin" className="w-5 h-5 text-teal-400" />
              {title || 'Elegir punto en el mapa'}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Busca una dirección, toca el mapa o arrastra el marcador.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1 min-h-0">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={handleSearch}
              placeholder="Buscar dirección o lugar (ej: Av. Bolívar 123)"
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none pr-10"
            />
            <Icon name="search" className="w-4 h-4 text-slate-500 absolute right-3 top-3.5" />
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl overflow-hidden z-20">
                {suggestions.map((s) => (
                  <button
                    key={s.place_id}
                    type="button"
                    onClick={() => applySuggestion(s)}
                    className="w-full text-left px-3 py-2.5 text-xs text-slate-200 hover:bg-slate-700/70 transition-colors border-b border-slate-700/50 last:border-0"
                  >
                    {s.display_name || s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="w-full px-4 py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-sm font-bold hover:bg-cyan-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Icon name="mapPin" className="w-4 h-4" />
            {locating ? 'Obteniendo ubicación...' : 'Usar mi ubicación actual'}
          </button>

          <div className="rounded-2xl overflow-hidden border border-slate-700 bg-slate-900">
            <div ref={containerRef} className="w-full h-56 sm:h-64" />
          </div>

          {point && (
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Icon name="check" className="w-3.5 h-3.5 text-emerald-400" />
              Punto elegido: <span className="text-white font-bold">{point.lat.toFixed(6)}, {point.lng.toFixed(6)}</span>
            </p>
          )}
          {locError && (
            <p className="text-xs text-rose-400 flex items-center gap-1.5">
              <Icon name="alertTriangle" className="w-3.5 h-3.5 flex-shrink-0" />
              {locError}
            </p>
          )}

          <button
            type="button"
            onClick={confirm}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-sm hover:from-teal-400 hover:to-emerald-400 shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Icon name="check" className="w-4 h-4" />
            Confirmar punto
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal de rastreo en vivo para el cliente: consulta el estado del pedido y la
// posición del repartidor cada 5s mientras está abierto, mostrando el mapa.
function LiveTrackingModal({ order, onClose, storeLocation, isBenefited, onOrderUpdated, addToast, headerHeight = 0 }) {
  useOverlay(true, onClose);
  const [track, setTrack] = useState(order);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  const loadMessages = async () => {
    const res = await api.getOrderMessages(order.id, order.phone);
    if (res.ok && Array.isArray(res.data.messages)) setMessages(res.data.messages);
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const res = await api.getOrderTracking(order.id);
      if (!alive) return;
      if (res.ok && res.data) {
        setTrack(res.data);
        setError('');
      } else {
        setError(res.data?.error || 'No se pudo obtener el rastreo del pedido.');
      }
      loadMessages();
    };
    load();
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [order.id]);

  const handleSendMessage = async () => {
    const text = messageText.trim();
    if (!text || sending) return;
    setSending(true);
    const res = await api.sendOrderMessage(order.id, order.phone, text);
    setSending(false);
    if (res.ok) {
      setMessageText('');
      loadMessages();
    } else {
      setError(res.data?.error || 'No se pudo enviar el mensaje.');
    }
  };

  const status = track?.status || order.status;
  const style = STATUS_STYLES[status] || STATUS_STYLES.pendiente;
  const currentIdx = STATUS_FLOW.indexOf(status);
  const steps = [
    { key: 'pendiente', label: '1. Recibido' },
    { key: 'en_preparacion', label: '2. Preparando' },
    { key: 'listo', label: '3. Listo' },
    ...(order.type === 'delivery' ? [{ key: 'en_camino', label: '4. En camino' }] : []),
    { key: 'entregado', label: order.type === 'delivery' ? '5. Entregado' : '4. Entregado' }
  ];

  const courierLive = track?.courier_lat != null && track?.courier_lng != null;
  const updatedAt = track?.courier_updated_at
    ? new Date(track.courier_updated_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] overflow-hidden animate-fade-in"
      style={{ top: headerHeight }}
    >
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative h-full flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div className="pointer-events-auto relative w-full sm:max-w-lg glass-strong bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden z-10 animate-screen-up max-h-full flex flex-col">
        <div className="p-4 sm:p-6 border-b border-slate-800 shrink-0 bg-slate-900 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Icon name="mapPin" className="w-5 h-5 text-emerald-400" />
              Rastreo en vivo <span className="text-teal-400">#{order.id}</span>
            </h3>
            <span className={`inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${style.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${style.dot} ${status === 'en_camino' ? 'animate-pulse' : ''}`} />
              {needsPaymentValidation(order) ? 'Pago en revisión' : STATUS_LABELS[status] || 'Pendiente'}
            </span>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Stepper de estados: oculto hasta validar el pago digital */}
          {needsPaymentValidation(order) ? (
            <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2.5 text-xs text-amber-300 font-semibold">
              <Icon name="clock" className="w-4 h-4 shrink-0" />
              Tu pedido avanza cuando el kiosko confirme el pago. Revisa el estado de tu pago abajo.
            </div>
          ) : (
          <div className={`grid gap-1.5 sm:gap-2 pt-1 ${order.type === 'delivery' ? 'grid-cols-5' : 'grid-cols-4'}`}>
            {steps.map((step, idx) => {
              const isPassed = idx <= currentIdx;
              const isCurrent = idx === currentIdx;
              return (
                <div key={step.key} className="flex flex-col items-center gap-1.5 sm:gap-2">
                  <div className={`w-full h-1.5 sm:h-2 rounded-full transition-all duration-500 ${isPassed ? 'bg-emerald-400 shadow-lg shadow-emerald-500/50' : 'bg-slate-700/60'} ${isCurrent ? 'animate-pulse' : ''}`} />
                  <span className={`text-[9px] sm:text-xs font-semibold text-center leading-tight transition-all ${isCurrent ? 'text-emerald-300 font-bold scale-110 order-timeline-dot--active' : isPassed ? 'text-slate-300' : 'text-slate-500'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
          )}

          {/* Mapa: destino + repartidor en vivo */}
          <DeliveryMap order={track} storeLocation={storeLocation} />

          {/* Estado del pago digital y acciones si fue rechazado */}
          <PaymentStatusCard order={order} isBenefited={isBenefited} onOrderUpdated={onOrderUpdated} addToast={addToast} />

          {/* Estado del repartidor */}
          <div className="rounded-xl bg-slate-800/60 p-3 text-xs space-y-1">
            <div className="flex items-center gap-2">
              <Icon name="mapPin" className="w-3.5 h-3.5 text-emerald-400" />
              {courierLive ? (
                <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Repartidor en camino {updatedAt ? `· ${updatedAt}` : ''}
                </span>
              ) : (
                <span className="text-slate-400">
                  {status === 'en_camino' ? 'Buscando la posición del repartidor…' : 'El repartidor aún no inició el envío.'}
                </span>
              )}
            </div>
            {order.address && <p className="text-slate-400">Destino: <span className="text-white font-bold">{order.address}</span></p>}
            <p className="text-slate-500">La posición se actualiza automáticamente cada 5 segundos.</p>
          </div>

          {/* ETA Predictivo: distancia y hora estimada de llegada del repartidor */}
          {status === 'en_camino' && courierLive && track?.courier_lat != null && track?.courier_lng != null && order?.lat != null && order?.lng != null && (
            <div className="rounded-xl bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-cyan-500/10 border border-teal-500/25 p-3.5 animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="navigation" className="w-4 h-4 text-teal-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-300">ETA Predictivo</span>
              </div>
              <EtaEstimate
                cLat={Number(track.courier_lat)}
                cLng={Number(track.courier_lng)}
                dLat={Number(order.lat)}
                dLng={Number(order.lng)}
              />
              <p className="text-[10px] text-slate-500 mt-2">
                Estimado según distancia y ritmo promedio de reparto; puede variar por tráfico.
              </p>
            </div>
          )}

          {/* Chat del pedido con la tienda */}
          <div className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-hidden">
            <div className="p-3 border-b border-slate-700/70 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span className="text-xs font-bold text-white">Chat con la tienda</span>
            </div>
            <div className="p-3 space-y-2.5 max-h-52 overflow-y-auto">
              {messages.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-3">
                  Sin mensajes todavía. Escríbenos si necesitas algo.
                </p>
              )}
              {messages.map((m, idx) => (
                <ChatBubble key={m.id || idx} m={m} order={order} perspective="customer" />
              ))}
            </div>
            <div className="p-3 border-t border-slate-700/70 flex gap-2">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendMessage();
                }}
                placeholder="Escribe un mensaje…"
                maxLength={300}
                className="flex-1 min-w-0 px-3 py-2.5 glass-strong bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:border-teal-500 focus:outline-none"
              />
              <button
                onClick={handleSendMessage}
                disabled={sending || !messageText.trim()}
                className="shrink-0 px-3.5 py-2.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs disabled:opacity-50 disabled:pointer-events-none transition-all active:scale-95"
              >
                Enviar
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              {error} Se seguirá intentando.
            </p>
          )}

          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-slate-800 text-slate-300 font-bold text-sm hover:bg-slate-700 transition-all"
          >
            Cerrar rastreo
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}

function CheckoutModal({ onClose, cart, cartTotal, rate, isPlacingOrder, onSubmit, savedCustomer, knownCustomers, allCustomers, onSaveCustomer, customerProfile, onSaveAddress, addToast, paymentConfig, holdDeadline }) {
  const [nowMs, setNowMs] = useState(Date.now());

  useOverlay(true, onClose);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const holdLeft = holdDeadline ? Math.max(0, holdDeadline - nowMs) : 0;
  const holdMin = Math.floor(holdLeft / 60000);
  const holdSec = Math.floor((holdLeft % 60000) / 1000);

  const [formData, setFormData] = useState({
    customerName: savedCustomer?.customerName || '',
    phoneCode: savedCustomer?.phoneCode || '0412',
    phoneNumber: savedCustomer?.phoneNumber || '',
    type: savedCustomer?.type || 'pickup', // 'pickup' | 'delivery'
    address: savedCustomer?.address || '',
    notes: '',
    credit: false,
    lat: null,
    lng: null,
    mapAddress: null,
    paymentMethod: 'efectivo',
    paymentReference: '',
    paymentProof: null,
    restPaymentMethod: '',
    walletApplied: 0
  });

  // "Mi Cartera": saldo a favor del cliente (balance < 0). Solo aparece como
  // método de pago si hay saldo.
  const walletAvailable = customerProfile && Number(customerProfile.balance) < 0 ? Math.abs(Number(customerProfile.balance)) : 0;

  const [errors, setErrors] = useState({});
  const [showPhoneSuggestions, setShowPhoneSuggestions] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Comprueba el estado del permiso de ubicación (si el navegador lo soporta).
  const getGeoPermission = () =>
    navigator.permissions && navigator.permissions.query
      ? navigator.permissions.query({ name: 'geolocation' })
      : null;

  // Captura la ubicación GPS del cliente para entregas a domicilio (sin usar
  // Google Maps API; solo se guardan lat/lng y se muestra un enlace a Maps).
  const handleUseMyLocation = async () => {
    setLocError('');
    if (!navigator.geolocation) {
      setLocError('Tu navegador no soporta geolocalización. Ingresa la dirección manualmente.');
      addToast('Tu navegador no soporta geolocalización', 'error');
      return;
    }
    // Si el navegador ya guardó "denegado", no volverá a preguntar; lo avisamos
    // con instrucciones para habilitarlo en lugar de pedirlo en silencio.
    try {
      const perm = getGeoPermission();
      if (perm) {
        const state = await perm;
        if (state && state.state === 'denied') {
          setLocError(
            'El navegador tiene la ubicación bloqueada. Para que pregunte de nuevo, activa el permiso de ubicación para este sitio en los ajustes del navegador (icono del candado junto a la URL) y recarga la página.'
          );
          addToast('Permiso de ubicación bloqueado en el navegador', 'error');
          return;
        }
      }
    } catch {}
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        }));
        setLocating(false);
        addToast('Ubicación capturada. La entrega se hará en este punto.', 'success');
      },
      (err) => {
        setLocating(false);
        const denied = err && err.code === 1;
        const msg = denied
          ? 'Permiso de ubicación denegado. Actívalo en los ajustes del navegador (candado junto a la URL) y recarga, o ingresa la dirección manualmente.'
          : 'No se pudo obtener la ubicación. Ingresa la dirección manualmente.';
        setLocError(msg);
        addToast(msg, 'error');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  // Autocompletado por teléfono: busca clientes conocidos (historial local) y
  // registrados (servidor) cuyos 7 dígitos coincidan
  const phoneSuggestions = useMemo(() => {
    if (formData.phoneNumber.length < 3) return [];
    const q = formData.phoneNumber;
    const known = (knownCustomers || []).filter((c) => (c.number || '').startsWith(q));
    const server = (allCustomers || [])
      .map((c) => ({
        name: c.customerName || c.name || '',
        code: String(c.phone || '').slice(0, 4),
        number: String(c.phone || '').slice(-7),
        address: Array.isArray(c.addresses) && c.addresses[0] ? c.addresses[0] : ''
      }))
      .filter((c) => c.number.startsWith(q));
    const extra = server.filter((s) => !known.some((k) => k.number === s.number));
    return [...known, ...extra].slice(0, 3);
  }, [knownCustomers, allCustomers, formData.phoneNumber]);

  // Autocompleta el nombre desde el servidor cuando el teléfono está completo
  // y el cliente no escribió nada a mano.
  useEffect(() => {
    if (formData.phoneNumber.length !== 7 || formData.customerName.trim()) return;
    let cancelled = false;
    const phoneDigits = `${formData.phoneCode}${formData.phoneNumber}`.replace(/\D/g, '').slice(-11);
    api
      .getCustomer(phoneDigits)
      .then((res) => {
        if (cancelled) return;
        const n = res && res.ok && res.data ? res.data.customerName : '';
        if (n) setFormData((prev) => (prev.customerName.trim() ? prev : { ...prev, customerName: n }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.phoneCode, formData.phoneNumber]);

  const applyCustomer = (customer) => {
    setFormData((prev) => ({
      ...prev,
      customerName: customer.name || prev.customerName,
      phoneCode: customer.code || prev.phoneCode,
      phoneNumber: customer.number || prev.phoneNumber,
      address: customer.address || prev.address
    }));
    setShowPhoneSuggestions(false);
    if (customer.address) setFormData((prev) => ({ ...prev, type: 'delivery' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.customerName.trim()) newErrors.customerName = 'Ingresa tu nombre completo';
    if (!/^\d{7}$/.test(formData.phoneNumber)) newErrors.phone = 'Ingresa los 7 dígitos del número';
    if (formData.type === 'delivery' && !formData.address.trim() && (formData.lat == null || formData.lng == null)) {
      newErrors.address = 'Ingresa la dirección o comparte tu ubicación';
    }
    if (
      !formData.credit &&
      formData.paymentMethod &&
      formData.paymentMethod !== 'efectivo' &&
      formData.paymentMethod !== 'cartera' &&
      !formData.paymentProof
    ) {
      newErrors.payment = 'Adjunta el comprobante del pago (foto de la transferencia o pago móvil)';
    }
    // Con cartera parcial: el cliente elige con qué método paga el resto.
    if (!formData.credit && formData.paymentMethod === 'cartera' && walletAvailable < cartTotal) {
      if (!formData.restPaymentMethod) {
        newErrors.payment = 'Tu cartera no cubre todo: elige con qué método pagas el resto';
      } else if (formData.restPaymentMethod !== 'efectivo' && !formData.paymentProof) {
        newErrors.payment = 'Adjunta el comprobante del pago del resto';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isPlacingOrder) return;
    if (/^\d{7}$/.test(formData.phoneNumber)) {
      // Un usuario inhabilitado por el super admin no puede pedir.
      const phoneDigits = `${formData.phoneCode}${formData.phoneNumber}`.replace(/\D/g, '').slice(-11);
      try {
        const existing = await api.getCustomer(phoneDigits);
        if (existing.ok && existing.data && existing.data.disabled) {
          setErrors({ phone: 'Tu cuenta está inhabilitada por el kiosko. Contacta la tienda.' });
          return;
        }
      } catch {}
    }
    if (validate()) {
      // Con "Mi Cartera": aplica el saldo a favor al total. Si cubre todo el
      // pedido, el pago queda confirmado con cartera; si no, el resto se paga
      // con el método elegido (restPaymentMethod).
      let paymentMethod = formData.paymentMethod;
      let walletApplied = 0;
      if (formData.paymentMethod === 'cartera' && walletAvailable > 0) {
        walletApplied = Math.min(walletAvailable, cartTotal);
        if (walletApplied >= cartTotal) {
          paymentMethod = 'cartera';
        } else {
          paymentMethod = formData.restPaymentMethod || 'efectivo';
        }
      }
      const full = {
        ...formData,
        paymentMethod,
        walletApplied,
        phone: `${formData.phoneCode} ${formData.phoneNumber}`
      };
      if (onSaveCustomer) {
        onSaveCustomer({
          customerName: formData.customerName,
          phoneCode: formData.phoneCode,
          phoneNumber: formData.phoneNumber,
          address: formData.address || '',
          type: formData.type
        });
      }
      onSubmit(full);
    }
  };

  const handlePhoneNumber = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 7);
    setFormData({ ...formData, phoneNumber: digits });
    setShowPhoneSuggestions(digits.length >= 3);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] glass-strong bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-screen-up flex flex-col">
        {/* Handle visual para indicar arrastre en móvil */}
        <div className="sm:hidden absolute top-2.5 left-1/2 -translate-x-1/2 z-20 w-12 h-1.5 rounded-full bg-slate-700" />

        {/* Header */}
        <div className="pt-[max(1rem,env(safe-area-inset-top))] p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Finalizar Pedido</h2>
            {holdLeft > 0 && (
              <p className={`text-[11px] font-bold mt-0.5 ${holdLeft <= 60000 ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`}>
                ⏳ Reserva por {holdMin}:{String(holdSec).padStart(2, '0')} para completar el pago
              </p>
            )}
            {savedCustomer?.customerName ? (
              <p className="text-xs text-teal-400 mt-0.5 flex items-center gap-1">
                <Icon name="user" className="w-3 h-3" />
                ¡Hola de nuevo, {savedCustomer.customerName.split(' ')[0]}! Tus datos ya están listos.
              </p>
            ) : (
              <p className="text-xs text-slate-400 mt-0.5">Completa tus datos para enviarlo a la tienda</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 sm:px-6 pt-4 sm:pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4 sm:space-y-5 overflow-y-auto flex-1 min-h-0">
          {/* Order Method Selector */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 p-1 sm:p-1.5 rounded-2xl bg-slate-800 border border-slate-700">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'pickup' })}
              className={`py-2.5 sm:py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                formData.type === 'pickup'
                  ? 'bg-teal-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon name="store" className="w-4 h-4" />
              Retiro en Tienda
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'delivery' })}
              className={`py-2.5 sm:py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                formData.type === 'delivery'
                  ? 'bg-teal-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon name="mapPin" className="w-4 h-4" />
              Envío a Domicilio
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nombre y Apellido *
              </label>
              <input
                type="text"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="Ej: Juan Pérez"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
              />
              {errors.customerName && <p className="text-xs text-rose-400 mt-1">{errors.customerName}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Teléfono / WhatsApp *
              </label>
              <div className="flex gap-2">
                <select
                  value={formData.phoneCode}
                  onChange={(e) => setFormData({ ...formData, phoneCode: e.target.value })}
                  className="w-24 shrink-0 px-3 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm font-bold focus:border-teal-500 focus:outline-none"
                >
                  {PHONE_CODES.map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={formData.phoneNumber}
                  onChange={(e) => handlePhoneNumber(e.target.value)}
                  onBlur={() => setTimeout(() => setShowPhoneSuggestions(false), 150)}
                  placeholder="1234567"
                  maxLength={7}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
              {showPhoneSuggestions && phoneSuggestions.length > 0 && (
                <div className="mt-2 space-y-1.5 animate-fade-in">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                    Clientes conocidos — toca para autocompletar
                  </p>
                  {phoneSuggestions.map((c) => (
                    <button
                      key={c.phone}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyCustomer(c);
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-slate-800 border border-teal-500/30 hover:border-teal-400/60 hover:bg-slate-700/60 transition-all text-left"
                    >
                      <span className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400 shrink-0">
                        <Icon name="user" className="w-3.5 h-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-white truncate">{c.name}</span>
                        <span className="block text-[10px] text-slate-400 truncate">
                          {c.code} {c.number}
                          {c.address ? ` · ${c.address}` : ''}
                        </span>
                      </span>
                      <Icon name="arrowRight" className="w-3.5 h-3.5 text-teal-400 shrink-0 ml-auto" />
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-slate-500 mt-1">Código móvil + 7 dígitos (ej: {formData.phoneCode} 1234567)</p>
              {errors.phone && <p className="text-xs text-rose-400 mt-1">{errors.phone}</p>}
            </div>

            {formData.type === 'delivery' && (
              <div className="animate-fade-in space-y-2">
                {customerProfile?.addresses?.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300 mb-0.5">
                      Tus direcciones guardadas
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {customerProfile.addresses.map((addr) => (
                        <button
                          key={addr}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, address: addr }))}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all text-left ${
                            formData.address === addr
                              ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-teal-500/40'
                          }`}
                        >
                          {addr}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Dirección de Entrega
                    </label>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <button
                        type="button"
                        onClick={handleUseMyLocation}
                        disabled={locating}
                        className={`px-2 py-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          formData.lat != null && formData.lng != null
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-teal-500/15 border-teal-500/40 text-teal-300 hover:bg-teal-500/25'
                        } ${locating ? 'opacity-60 pointer-events-none' : ''}`}
                      >
                        <Icon name="mapPin" className="w-3.5 h-3.5 shrink-0" />
                        {locating ? 'Obteniendo...' : 'Mi ubicación (GPS)'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMapPicker(true)}
                        className={`px-2 py-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          formData.mapAddress
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-sky-500/15 border-sky-500/40 text-sky-300 hover:bg-sky-500/25'
                        }`}
                      >
                        <Icon name="search" className="w-3.5 h-3.5 shrink-0" />
                        Elegir punto en el mapa
                      </button>
                    </div>
                    {(formData.lat != null || formData.mapAddress) && (
                      <a
                        href={`https://www.google.com/maps?q=${formData.lat},${formData.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-[11px] text-sky-300 underline mb-2"
                      >
                        Ver punto en Google Maps
                      </a>
                    )}
                  {locError && (
                    <p className="text-xs text-rose-400 mb-2 flex items-center gap-1.5">
                      <Icon name="alertTriangle" className="w-3.5 h-3.5 flex-shrink-0" />
                      {locError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Calle, Número, Piso/Depto (opcional si compartiste ubicación)"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const phone = `${formData.phoneCode}${formData.phoneNumber}`.replace(/\D/g, '').slice(-11);
                        if (!formData.address.trim() || !/^\d{7}$/.test(formData.phoneNumber)) {
                          addToast('Completa la dirección y el teléfono para guardarla', 'warning');
                          return;
                        }
                        onSaveAddress?.(phone, formData.customerName, formData.address.trim());
                      }}
                      className="shrink-0 px-3 py-3 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-300 hover:bg-teal-500/30 transition-all flex items-center gap-1.5 text-xs font-bold"
                      title="Guardar esta dirección en tu perfil"
                    >
                      <Icon name="plus" className="w-3.5 h-3.5" />
                      Guardar
                    </button>
                  </div>
                  {errors.address && <p className="text-xs text-rose-400 mt-1">{errors.address}</p>}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Aclaraciones o Notas (Opcional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Ej: Si no hay Sprite reemplazar por 7Up..."
                rows={2}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Mini Summary Box */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Resumen del Pedido</span>

            {/* Productos solicitados */}
            <div className="space-y-2 pt-0.5">
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center gap-2.5">
                  <ProductImg
                    product={item.product}
                    alt={item.product.name}
                    className="w-9 h-9 rounded-lg object-cover bg-slate-900 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-200 truncate">{item.product.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {formatUsd(item.product.price)} c/u
                      {rate?.rate > 0 && (
                        <span className="block text-[9px] text-slate-600">
                          {formatBs(usdToBs(item.product.price, rate.rate))} c/u
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-300 bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5 shrink-0">
                    ×{item.quantity}
                  </span>
                  <span className="text-xs font-bold text-white w-14 sm:w-16 text-right shrink-0">
                    {formatUsd(item.product.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="text-xs text-slate-300 flex justify-between border-t border-slate-800 pt-2">
              <span>Subtotal ({cart.reduce((acc, i) => acc + i.quantity, 0)} artículos)</span>
              <span className="font-bold text-white text-right">
                <Money value={cartTotal} />
                {rate?.rate > 0 && (
                  <span className="block text-[11px] text-teal-300/90">
                    {formatBs(usdToBs(cartTotal, rate.rate))}
                  </span>
                )}
              </span>
            </div>
            {formData.paymentMethod === 'cartera' && walletAvailable > 0 && (
              <>
                <div className="text-xs flex justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Icon name="wallet" className="w-3.5 h-3.5 text-emerald-400" />
                    Mi Cartera
                  </span>
                  <span className="font-bold text-emerald-400 text-right">
                    -{formatUsd(Math.min(walletAvailable, cartTotal))}
                  </span>
                </div>
                <div className="text-xs text-slate-300 flex justify-between border-t border-slate-800 pt-2">
                  <span className="font-semibold">A pagar</span>
                  <span className="font-black text-white text-right">
                    {formatUsd(Math.max(0, cartTotal - walletAvailable))}
                    {rate?.rate > 0 && (
                      <span className="block text-[11px] text-slate-400">
                        {formatBs(usdToBs(Math.max(0, cartTotal - walletAvailable), rate.rate))}
                      </span>
                    )}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Pedido a crédito (solo clientes beneficiados) */}
          {customerProfile?.isBenefited && (
            <div
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                formData.credit
                  ? 'bg-indigo-500/10 border-indigo-400'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
              onClick={() => setFormData({ ...formData, credit: !formData.credit })}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`p-2 rounded-xl shrink-0 ${
                    formData.credit ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Icon name="creditCard" className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">Enviar pedido a la cuenta</p>
                  <p className="text-[11px] text-slate-400">
                    Lo pagas luego; se suma a tu saldo. La tienda debe aceptarlo antes de prepararlo.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Método de pago */}
          {!formData.credit && (
            <div className="space-y-2.5">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Método de pago</span>
              <div className={`grid gap-2 sm:gap-2.5 ${walletAvailable > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                {[
                  { key: 'efectivo', label: 'Efectivo', icon: 'cash', desc: 'Pago en tienda' },
                  { key: 'pago_movil', label: 'Pago Móvil', icon: 'smartphone', desc: 'Pega y paga' },
                  { key: 'transferencia', label: 'Transferencia', icon: 'bank', desc: 'Cuenta bancaria' },
                  ...(walletAvailable > 0
                    ? [{ key: 'cartera', label: 'Mi Cartera', icon: 'wallet', sub: formatUsd(walletAvailable), desc: 'Saldo a favor' }]
                    : [])
                ].map((m) => {
                  const active = formData.paymentMethod === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          paymentMethod: active ? '' : m.key,
                          restPaymentMethod: m.key === 'cartera' ? formData.restPaymentMethod : ''
                        })
                      }
                      className={`relative px-2 py-3 sm:py-3.5 rounded-2xl border text-[11px] sm:text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                        active
                          ? 'bg-gradient-to-b from-teal-500/20 to-teal-500/5 border-teal-400/60 text-teal-200 shadow-lg shadow-teal-500/10 ring-1 ring-teal-400/30'
                          : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:border-slate-500 hover:bg-slate-800'
                      }`}
                    >
                      <span
                        className={`p-2 rounded-xl transition-all ${
                          active
                            ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/40'
                            : 'bg-slate-900 text-slate-400 border border-slate-700'
                        }`}
                      >
                        <Icon name={m.icon} className="w-4 h-4" />
                      </span>
                      <span className={active ? 'text-teal-200' : 'text-slate-300'}>{m.label}</span>
                      {m.sub ? (
                        <span className="text-[9px] text-emerald-400 font-bold leading-none">{m.sub}</span>
                      ) : (
                        <span className={`text-[9px] font-medium leading-none ${active ? 'text-teal-300/70' : 'text-slate-500'}`}>
                          {m.desc}
                        </span>
                      )}
                      {active && (
                        <span className="absolute top-1.5 right-1.5 p-0.5 rounded-full bg-teal-500 text-slate-950 shadow">
                          <Icon name="check" className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Cartera parcial: explicación + método para el resto */}
              {formData.paymentMethod === 'cartera' && walletAvailable > 0 && (
                <div className="space-y-2.5 animate-fade-in">
                  <p className="text-[11px] text-slate-300 bg-slate-800/60 rounded-xl p-3 border border-slate-700 flex items-start gap-2">
                    <Icon name="wallet" className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                    {walletAvailable >= cartTotal ? (
                      <span>
                        Tu cartera cubre todo el pedido ({formatUsd(cartTotal)}). Se descuenta al confirmar; no necesitas pagar nada más.
                      </span>
                    ) : (
                      <span>
                        Tu cartera cubre <b className="text-emerald-300">{formatUsd(walletAvailable)}</b> y el resto es{' '}
                        <b className="text-amber-300">{formatUsd(cartTotal - walletAvailable)}</b>. Elige con qué pagas la diferencia.
                      </span>
                    )}
                  </p>
                  {walletAvailable < cartTotal && (
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'efectivo', label: 'Efectivo', icon: 'cash' },
                        { key: 'pago_movil', label: 'Pago Móvil', icon: 'smartphone' },
                        { key: 'transferencia', label: 'Transferencia', icon: 'bank' }
                      ].map((m) => {
                        const active = formData.restPaymentMethod === m.key;
                        return (
                          <button
                            key={m.key}
                            type="button"
                            onClick={() => setFormData({ ...formData, restPaymentMethod: active ? '' : m.key })}
                            className={`relative px-2 py-2.5 rounded-xl border text-[10px] sm:text-[11px] font-bold flex flex-col items-center gap-1.5 transition-all ${
                              active
                                ? 'bg-gradient-to-b from-teal-500/20 to-teal-500/5 border-teal-400/60 text-teal-200 ring-1 ring-teal-400/30'
                                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:border-slate-500'
                            }`}
                          >
                            <span
                              className={`p-1.5 rounded-lg transition-all ${
                                active ? 'bg-teal-500 text-slate-950 shadow' : 'bg-slate-900 text-slate-400 border border-slate-700'
                              }`}
                            >
                              <Icon name={m.icon} className="w-3.5 h-3.5" />
                            </span>
                            {m.label}
                            {active && (
                              <span className="absolute top-1 right-1 p-0.5 rounded-full bg-teal-500 text-slate-950">
                                <Icon name="check" className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {formData.restPaymentMethod === 'pago_movil' && paymentConfig?.pagoMovil && (
                    <p className="text-[11px] text-slate-300 bg-slate-800/60 rounded-xl p-3 border border-slate-700">
                      <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider mb-1">
                        Datos para el pago móvil
                      </span>
                      Banco: <span className="text-white font-bold">{paymentConfig.pagoMovil.bank || '—'}</span> · Teléfono:{' '}
                      <span className="text-white font-bold">{paymentConfig.pagoMovil.phone || '—'}</span> · Cedula:{' '}
                      <span className="text-white font-bold">{paymentConfig.pagoMovil.id || '—'}</span>
                    </p>
                  )}
                  {formData.restPaymentMethod === 'transferencia' && paymentConfig?.bank && (
                    <p className="text-[11px] text-slate-300 bg-slate-800/60 rounded-xl p-3 border border-slate-700">
                      <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider mb-1">
                        Datos para la transferencia
                      </span>
                      Banco: <span className="text-white font-bold">{paymentConfig.bank.name || '—'}</span> · Número de cuenta:{' '}
                      <span className="text-white font-bold">{paymentConfig.bank.account || '—'}</span>
                      {paymentConfig.bank.titular ? (
                        <> · Titular: <span className="text-white font-bold">{paymentConfig.bank.titular}</span></>
                      ) : null}
                    </p>
                  )}
                  {formData.restPaymentMethod && formData.restPaymentMethod !== 'efectivo' && (
                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Número de referencia / comprobante (opcional)
                        </label>
                        <input
                          type="text"
                          value={formData.paymentReference}
                          onChange={(e) => setFormData({ ...formData, paymentReference: e.target.value })}
                          placeholder="Ej: 12H3456789"
                          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Foto del comprobante *
                        </label>
                        <label className="w-full flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/60 cursor-pointer hover:border-teal-500/50 transition-all text-center">
                          {formData.paymentProof ? (
                            <>
                              <img
                                src={formData.paymentProof}
                                alt="Comprobante de pago"
                                className="max-h-36 rounded-lg object-contain"
                              />
                              <span className="text-[11px] text-teal-300 font-semibold flex items-center gap-1">
                                <Icon name="check" className="w-3.5 h-3.5" />
                                Comprobante adjunto — toca para cambiarlo
                              </span>
                            </>
                          ) : (
                            <>
                              <Icon name="upload" className="w-6 h-6 text-slate-500" />
                              <span className="text-xs text-slate-400">
                                Toca para tomar una foto, elegir de la galería o subir un archivo del comprobante
                              </span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files && e.target.files[0];
                              if (!file) return;
                              if (file.size > 8 * 1024 * 1024) {
                                addToast('La imagen supera 8 MB. Elige una más liviana.', 'error');
                                e.target.value = '';
                                return;
                              }
                              try {
                                const compressed = await compressImage(file);
                                setFormData({ ...formData, paymentProof: compressed });
                              } catch {
                                addToast('No se pudo procesar la imagen. Prueba con otra.', 'error');
                              } finally {
                                e.target.value = '';
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                  {errors.payment && <p className="text-xs text-rose-400 mt-1">{errors.payment}</p>}
                </div>
              )}

              {formData.paymentMethod === 'pago_movil' && paymentConfig?.pagoMovil && (
                <p className="text-[11px] text-slate-300 bg-slate-800/60 rounded-xl p-3 border border-slate-700">
                  <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider mb-1">
                    Datos para el pago móvil
                  </span>
                  Banco: <span className="text-white font-bold">{paymentConfig.pagoMovil.bank || '—'}</span> · Teléfono:{' '}
                  <span className="text-white font-bold">{paymentConfig.pagoMovil.phone || '—'}</span> · Cedula:{' '}
                  <span className="text-white font-bold">{paymentConfig.pagoMovil.id || '—'}</span>
                </p>
              )}

              {formData.paymentMethod === 'transferencia' && paymentConfig?.bank && (
                <p className="text-[11px] text-slate-300 bg-slate-800/60 rounded-xl p-3 border border-slate-700">
                  <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider mb-1">
                    Datos para la transferencia
                  </span>
                  Banco: <span className="text-white font-bold">{paymentConfig.bank.name || '—'}</span> · Número de cuenta:{' '}
                  <span className="text-white font-bold">{paymentConfig.bank.account || '—'}</span>
                  {paymentConfig.bank.titular ? (
                    <> · Titular: <span className="text-white font-bold">{paymentConfig.bank.titular}</span></>
                  ) : null}
                </p>
              )}

              {formData.paymentMethod !== '' && formData.paymentMethod !== 'efectivo' && formData.paymentMethod !== 'cartera' && (
                <div className="space-y-2.5 animate-fade-in">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Número de referencia / comprobante (opcional)
                    </label>
                    <input
                      type="text"
                      value={formData.paymentReference}
                      onChange={(e) => setFormData({ ...formData, paymentReference: e.target.value })}
                      placeholder="Ej: 12H3456789"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Foto del comprobante *
                    </label>
                    <label className="w-full flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/60 cursor-pointer hover:border-teal-500/50 transition-all text-center">
                      {formData.paymentProof ? (
                        <>
                          <img
                            src={formData.paymentProof}
                            alt="Comprobante de pago"
                            className="max-h-36 rounded-lg object-contain"
                          />
                          <span className="text-[11px] text-teal-300 font-semibold flex items-center gap-1">
                            <Icon name="check" className="w-3.5 h-3.5" />
                            Comprobante adjunto — toca para cambiarlo
                          </span>
                        </>
                      ) : (
                        <>
                          <Icon name="upload" className="w-6 h-6 text-slate-500" />
                          <span className="text-xs text-slate-400">
                            Toca para tomar una foto, elegir de la galería o subir un archivo del comprobante
                          </span>
                          <span className="text-[10px] text-slate-500">Se comprime automáticamente</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files && e.target.files[0];
                          if (!file) return;
                          if (file.size > 8 * 1024 * 1024) {
                            addToast('La imagen supera 8 MB. Elige una más liviana.', 'error');
                            e.target.value = '';
                            return;
                          }
                          try {
                            const compressed = await compressImage(file);
                            setFormData({ ...formData, paymentProof: compressed });
                          } catch {
                            addToast('No se pudo procesar la imagen. Prueba con otra.', 'error');
                          } finally {
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                  </div>
                  {errors.payment && <p className="text-xs text-rose-400 mt-1">{errors.payment}</p>}
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isPlacingOrder}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-sm hover:from-teal-400 hover:to-emerald-400 shadow-xl shadow-teal-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
          >
            <Icon name="check" className="w-5 h-5" />
            <span>{isPlacingOrder ? 'Enviando pedido…' : 'Confirmar y Enviar Pedido'}</span>
          </button>
        </form>

        {showMapPicker && (
          <MapPickerModal
            title="¿Dónde recibís el pedido?"
            initial={formData.lat != null ? { lat: formData.lat, lng: formData.lng } : null}
            onPick={(p) => {
              setFormData((prev) => ({
                ...prev,
                lat: p.lat,
                lng: p.lng,
                address: p.address || prev.address || '',
                mapAddress: p.address || prev.address || ''
              }));
              setLocError('');
              setShowMapPicker(false);
              addToast('Punto de entrega elegido en el mapa', 'success');
            }}
            onClose={() => setShowMapPicker(false)}
          />
        )}
      </div>
    </div>
  );
}

function AdminView({
  products,
  costById = {},
  orders,
  rate,
  promos,
  onSavePromos,
  adminTab,
  setAdminTab,
  onLogout,
  refreshingDb,
  onRefreshDb,
  onOpenAddModal,
  onEditProduct,
  onDeleteProduct,
  onCounterSale,
  onUpdateOrderStatus,
  onUpdateOrderPayment,
  onUpdateCourierLocation,
  onDeleteOrder,
  allCustomers,
  onLoadCustomers,
  onToggleBenefited,
  onSetCreditLimit,
  onAddToBlacklist,
  onAddBlacklistDebt,
  collections,
  onLoadCollections,
  onUpsertCollection,
  onDeleteCollection,
  payments,
  pendingPayments,
  onLoadPayments,
  onApprovePayment,
  onRejectPayment,
  addToast,
  storeLocation,
  onSaveStoreLocation,
  adminPhone,
  adminRole,
  adminProfile,
  onChangePassword,
  onSaveAdminProfile,
  theme,
  onSetTheme,
  headerHeight
}) {
  // Order status filter state + preferencias recordadas (filtro, vista, orden
  // por antigüedad y pedidos fijados se persisten en localStorage).
  const ORDER_PREFS_KEY = 'kiosko_admin_order_prefs';
  const PINNED_KEY = 'kiosko_admin_pinned';
  const loadOrderPrefs = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(ORDER_PREFS_KEY) || '{}');
      return {
        statusFilter: raw.statusFilter || 'todos',
        ordersView: ['lista', 'despacho', 'entregas', 'historial'].includes(raw.ordersView) ? raw.ordersView : 'lista',
        productFilter: raw.productFilter || null,
        ageSortOldest: Boolean(raw.ageSortOldest)
      };
    } catch {
      return { statusFilter: 'todos', ordersView: 'lista', productFilter: null, ageSortOldest: false };
    }
  };
  const [initialOrderPrefs] = useState(loadOrderPrefs);
  const [confirmRefresh, setConfirmRefresh] = useState(false);
  const [confirmCancelOrder, setConfirmCancelOrder] = useState(null);
  const [statusFilter, setStatusFilter] = useState(initialOrderPrefs.statusFilter);
  const [ordersView, setOrdersView] = useState(initialOrderPrefs.ordersView); // lista | despacho | entregas | historial
  const [productFilter, setProductFilter] = useState(initialOrderPrefs.productFilter);
  const [ageSortOldest, setAgeSortOldest] = useState(initialOrderPrefs.ageSortOldest);

  // Preferencias del panel por administrador (tema, atajos, columnas visibles).
  // Se guardan en localStorage con la clave del teléfono: cada admin conserva
  // su propia configuración aunque compartan el mismo dispositivo.
  const ADMIN_PREFS_KEY = adminPhone ? `kiosko_admin_prefs_${adminPhone}` : null;
  const loadAdminPrefs = () => {
    if (!ADMIN_PREFS_KEY) return null;
    try {
      return JSON.parse(localStorage.getItem(ADMIN_PREFS_KEY) || 'null');
    } catch {
      return null;
    }
  };
  const [adminPrefs, setAdminPrefs] = useState(loadAdminPrefs);
  const [showAdminProfile, setShowAdminProfile] = useState(false);
  const saveAdminPrefs = (next) => {
    const merged = { ...(adminPrefs || {}), ...next };
    setAdminPrefs(merged);
    if (ADMIN_PREFS_KEY) {
      try { localStorage.setItem(ADMIN_PREFS_KEY, JSON.stringify(merged)); } catch {}
    }
  };
  const isSuperAdmin = adminRole === 'superadmin';

  // Empleados gestionados (solo super admin) + sesiones activas.
  const [employees, setEmployees] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [newEmployeePhone, setNewEmployeePhone] = useState('');
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [usersFilter, setUsersFilter] = useState('');
  const [usersBusy, setUsersBusy] = useState(false);

  // Scroll horizontal del menú de pestañas (PC/laptop): flechas + scrollbar fino.
  const adminTabsRef = useRef(null);
  const scrollAdminTabs = (dir) => {
    const el = adminTabsRef.current;
    if (el) el.scrollBy({ left: dir * 260, behavior: 'smooth' });
  };

  const loadEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    try {
      const [emp, ses] = await Promise.all([api.listAdminEmployees(), api.listAdminSessions()]);
      if (emp.ok && Array.isArray(emp.data.employees)) setEmployees(emp.data.employees);
      if (ses.ok && Array.isArray(ses.data.sessions)) setActiveSessions(ses.data.sessions);
    } catch {}
    setLoadingEmployees(false);
  }, []);

  const addEmployee = async () => {
    const phone = newEmployeePhone.replace(/\D/g, '').slice(-11);
    if (phone.length < 7) {
      addToast('Ingresa un teléfono válido (7 dígitos o más)', 'error');
      return;
    }
    const res = await api.addAdminEmployee({ phone, name: newEmployeeName.trim() });
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo añadir el empleado', 'error');
      return;
    }
    addToast('Empleado añadido al panel');
    setNewEmployeePhone('');
    setNewEmployeeName('');
    loadEmployees();
  };

  const removeEmployee = async (phone) => {
    const res = await api.removeAdminEmployee(phone);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo quitar el empleado', 'error');
      return;
    }
    addToast('Empleado quitado del panel');
    loadEmployees();
  };

  const revokeSession = async (phone) => {
    const res = await api.revokeAdminSession(phone);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo cerrar la sesión', 'error');
      return;
    }
    addToast('Sesión cerrada remotamente');
    loadEmployees();
  };

  const toggleCustomerDisabled = async (customer) => {
    if (usersBusy) return;
    const next = !customer.disabled;
    setUsersBusy(true);
    const res = await api.setCustomerDisabled(customer.phone, next);
    setUsersBusy(false);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo actualizar el usuario', 'error');
      return;
    }
    addToast(next ? 'Usuario inhabilitado. No podrá pasar del login.' : 'Usuario habilitado');
    onLoadCustomers();
  };

  const deleteCustomerAccount = async (customer) => {
    if (usersBusy) return;
    if (!window.confirm(`¿Eliminar el perfil de "${customer.customerName || customer.phone}"? Esta acción no se puede deshacer.`)) return;
    setUsersBusy(true);
    const res = await api.deleteCustomer(customer.phone);
    setUsersBusy(false);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo eliminar el usuario', 'error');
      return;
    }
    addToast('Perfil eliminado del sistema');
    onLoadCustomers();
  };

  const filteredSystemUsers = (allCustomers || []).filter((c) => {
    const q = usersFilter.trim().toLowerCase();
    if (!q) return true;
    return String(c.phone).includes(q) || (c.customerName || '').toLowerCase().includes(q);
  });

  // Vista del inventario: 'lista' (tabla/tarjetas) | 'recorrido' (filas
  // horizontales estilo tienda con las opciones del admin en cada tarjeta).
  const [invView, setInvView] = useState('lista');

  // Al entrar con un admin que tiene tema propio guardado, se aplica ese tema.
  useEffect(() => {
    if (adminPrefs?.theme && theme !== adminPrefs.theme) {
      onSetTheme(adminPrefs.theme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [pinnedOrders, setPinnedOrders] = useState(() => {
    try {
      const list = JSON.parse(localStorage.getItem(PINNED_KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  });
  // Contador de pedidos nuevos no vistos en la pestaña de pedidos.
  const [unviewedCount, setUnviewedCount] = useState(0);
  const knownOrderIdsRef = useRef(null);
  // Historial (pedidos finalizados): filtros propios para no interferir con la
  // lista de pedidos activos.
  const [histStatus, setHistStatus] = useState('todos'); // todos | entregado | cancelado
  const [histSearch, setHistSearch] = useState('');
  const [histRange, setHistRange] = useState('7d'); // hoy | 7d | todo
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [proofOrder, setProofOrder] = useState(null);
  const [fichaOrder, setFichaOrder] = useState(null);
  // Acciones rápidas por long-press en la tarjeta de pedido (Activos).
  const [quickMenuOrder, setQuickMenuOrder] = useState(null);
  // Verificación de código de retiro antes de marcar entregado (#11).
  const [retiroVerifyOrder, setRetiroVerifyOrder] = useState(null);
  // Reloj vivo de la vista Mostrador: los cronómetros de espera tickean 1/s
  // solo mientras la vista está visible.
  const [mostradorNow, setMostradorNow] = useState(() => Date.now());
  useEffect(() => {
    if (adminTab !== 'orders' || ordersView !== 'mostrador') return undefined;
    setMostradorNow(Date.now());
    const id = setInterval(() => setMostradorNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [adminTab, ordersView]);
  // Feedback "procesando" por botón: deshabilita el control y muestra spinner
  // mientras su acción corre. Claves: st:/pay:/del:/gps: + id del pedido.
  const [busyActions, setBusyActions] = useState({});
  const busyActionsRef = useRef({});
  const runExclusive = useCallback((key, fn) => {
    if (busyActionsRef.current[key]) return;
    busyActionsRef.current[key] = true;
    setBusyActions((prev) => ({ ...prev, [key]: true }));
    Promise.resolve(fn()).finally(() => {
      busyActionsRef.current[key] = false;
      setBusyActions((prev) => ({ ...prev, [key]: false }));
    });
  }, []);
  const openFicha = (o) => {
    setFichaOrder(o);
  };
  const closeFicha = () => {
    setFichaOrder(null);
  };
  // Swipe hacia abajo para cerrar la ficha (bottom sheet en móvil).
  const fichaSheetRef = useSwipeToClose(closeFicha, Boolean(fichaOrder));

  // Mientras la ficha está abierta se bloquea el scroll de la página: solo se
  // desplaza el contenedor interno de la ficha.
  useEffect(() => {
    if (!fichaOrder) return undefined;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [fichaOrder]);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [reminderPhone, setReminderPhone] = useState('');

  // Inventario: búsqueda en tiempo real + filtro por categoría + agrupación por marca
  const [invSearch, setInvSearch] = useState('');
  const [invCategory, setInvCategory] = useState('todas');
  const [invGroupByBrand, setInvGroupByBrand] = useState(false);
  // Stock: filtro (todas | bajo | agotado) y ordenación (stock asc | desc | sin orden).
  const [invStockFilter, setInvStockFilter] = useState('todas');
  const [invSortStock, setInvSortStock] = useState(false);
  const availOf = (p) => Math.max(0, (Number(p.stock) || 0) - (Number(p.reserved) || 0));
  const inventoryProducts = useMemo(() => products || [], [products]);
  const searchOnly = useMemo(() => {
    const q = invSearch.trim().toLowerCase();
    if (!q) return inventoryProducts;
    return inventoryProducts.filter((p) =>
      `${p.name || ''} ${p.code || ''} ${p.brand || ''} ${p.category || ''}`.toLowerCase().includes(q)
    );
  }, [inventoryProducts, invSearch]);
  const inventoryCategories = useMemo(() => {
    const cats = ['todas'];
    inventoryProducts.forEach((p) => {
      if (p.category && !cats.includes(p.category)) cats.push(p.category);
    });
    return cats;
  }, [inventoryProducts]);
  const catCount = useCallback(
    (c) => (c === 'todas' ? searchOnly.length : searchOnly.filter((p) => p.category === c).length),
    [searchOnly]
  );
  const filteredProducts = useMemo(() => {
    let list = invCategory === 'todas' ? searchOnly : searchOnly.filter((p) => p.category === invCategory);
    if (invStockFilter === 'agotado') {
      list = list.filter((p) => availOf(p) <= 0);
    } else if (invStockFilter === 'bajo') {
      list = list.filter((p) => {
        const a = availOf(p);
        return a > 0 && a <= 5;
      });
    }
    if (invSortStock) {
      list = [...list].sort((a, b) => {
        const d = availOf(a) - availOf(b);
        if (d !== 0) return invSortStock === 'asc' ? d : -d;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
    }
    return list;
  }, [searchOnly, invCategory, invStockFilter, invSortStock]);
  const groupedByBrand = useMemo(() => {
    if (!invGroupByBrand) return [];
    const map = {};
    filteredProducts.forEach((p) => {
      const br = (p.brand || 'Sin marca').trim() || 'Sin marca';
      (map[br] = map[br] || []).push(p);
    });
    return Object.keys(map)
      .sort((a, b) => a.localeCompare(b))
      .map((br) => ({ brand: br, items: map[br] }));
  }, [filteredProducts, invGroupByBrand]);

  // Agrupa los productos filtrados por categoría para la góndola del recorrido
  // (misma forma que groupedByBrand, pero por categoría).
  const inventoryProductsByCategory = () => {
    const map = {};
    filteredProducts.forEach((p) => {
      const c = p.category || 'Otros';
      (map[c] = map[c] || []).push(p);
    });
    return Object.keys(map)
      .sort((a, b) => a.localeCompare(b))
      .map((c) => ({ key: c, label: c, items: map[c] }));
  };
  const clearInvFilters = () => {
    setInvSearch('');
    setInvCategory('todas');
    setInvStockFilter('todas');
    setInvSortStock(false);
  };

  const renderMobileCard = (p) => {
    const isLow = p.stock <= 5;
    const isOut = p.stock === 0;
    return (
      <div
        key={p.id}
        className="flex items-center gap-3 p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60"
      >
        <ProductImg
          product={p}
          alt={p.name}
          className="w-14 h-14 rounded-xl object-cover glass-strong bg-slate-900 border border-slate-700 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-100 text-sm truncate">{p.name}</p>
          <p className="text-[11px] text-slate-400 truncate">{p.code} · {p.category}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-bold text-white text-xs">{formatUsd(p.price)}</span>
            {rate?.rate > 0 && (
              <span className="text-[10px] text-slate-400 font-semibold">
                {formatBs(usdToBs(p.price, rate.rate))}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              isOut
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                : isLow
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            }`}
          >
            {isOut ? 'Agotado' : `${p.stock} un.`}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onEditProduct(p)}
              className="p-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-cyan-400 transition-all"
              title="Editar producto"
            >
              <Icon name="edit" className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDeleteProduct(p)}
              className="p-2 rounded-xl bg-slate-700/60 hover:bg-rose-500/20 text-rose-400 transition-all"
              title="Eliminar producto"
            >
              <Icon name="trash" className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderTableRow = (p) => {
    const isLow = p.stock <= 5;
    const isOut = p.stock === 0;
    return (
      <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
        <td className="p-4 flex items-center gap-3">
          <ProductImg
            product={p}
            alt={p.name}
            className="w-12 h-12 rounded-xl object-cover glass-strong bg-slate-900 border border-slate-700"
          />
          <div>
            <p className="font-bold text-slate-100">{p.name}</p>
            <p className="text-xs text-slate-400 line-clamp-1 max-w-xs">
              {[formatSize(p), p.description].filter(Boolean).join(' · ')}
            </p>
          </div>
        </td>
        <td className="p-4 font-mono text-xs text-slate-400">{p.code}</td>
        <td className="p-4">
          <span className="px-2.5 py-1 rounded-xl glass-strong bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-300">
            {p.category}
          </span>
        </td>
        <td className="p-4 font-bold text-white">
          {formatUsd(p.price)}
          {rate?.rate > 0 && (
            <span className="block text-[10px] text-slate-400 font-semibold">
              {formatBs(usdToBs(p.price, rate.rate))}
            </span>
          )}
        </td>
        <td className="p-4">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              isOut
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : isLow
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {p.stock} unidades
          </span>
        </td>
        <td className="p-4 text-right space-x-2">
          <button
            onClick={() => onEditProduct(p)}
            className="p-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-cyan-400 transition-all"
            title="Editar producto"
          >
            <Icon name="edit" className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDeleteProduct(p)}
            className="p-2 rounded-xl bg-slate-700/60 hover:bg-rose-500/20 text-rose-400 transition-all"
            title="Eliminar producto"
          >
            <Icon name="trash" className="w-4 h-4" />
          </button>
        </td>
      </tr>
    );
  };

  const handlePushBroadcast = async () => {
    if (!broadcastTitle.trim()) return;
    const res = await api.pushBroadcast(broadcastTitle.trim(), broadcastBody.trim());
    if (res.ok) {
      addToast(`Promoción enviada a ${res.data.sent || 0} dispositivo(s)`, 'success');
      setBroadcastTitle('');
      setBroadcastBody('');
    } else {
      addToast(res.data?.error || 'No se pudo enviar la notificación', 'error');
    }
  };

  const handlePushTest = async () => {
    const phone = (reminderPhone || adminPhone || '').trim();
    if (!phone) {
      addToast('Escribe tu teléfono para enviar la prueba', 'warning');
      return;
    }
    const res = await api.pushTest(phone, 'Notificación de prueba', 'Si ves esto, las notificaciones están funcionando.');
    if (res.ok) {
      addToast(`Prueba enviada${res.data.sent > 0 ? '' : ' (sin suscripciones activas)'}`, res.data.sent > 0 ? 'success' : 'warning');
    } else {
      addToast(res.data?.error || 'No se pudo enviar la prueba', 'error');
    }
  };

  const handlePushReminder = async () => {
    if (!reminderPhone.trim()) return;
    const res = await api.pushReminder(reminderPhone.trim());
    if (res.ok) {
      addToast(`Recordatorio enviado a ${res.data.sent || 0} dispositivo(s)`, 'success');
      setReminderPhone('');
    } else {
      addToast(res.data?.error || 'No se pudo enviar el recordatorio', 'error');
    }
  };

  const handleAdminSubscribePush = async () => {
    if (!('Notification' in window) || !('PushManager' in window)) {
      addToast('Tu navegador no soporta notificaciones', 'error');
      return;
    }
    if (Notification.permission === 'denied') {
      addToast('Notificaciones bloqueadas. Actívalas en los ajustes del navegador', 'error');
      return;
    }
    let perm = Notification.permission;
    if (perm !== 'granted') perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      addToast('Notificaciones no activadas', 'info');
      return;
    }
    const ok = await subscribeToPush(adminPhone);
    addToast(
      ok
        ? 'Activadas. Recibirás los pedidos nuevos aunque cierres la app.'
        : 'No se pudo activar. Revisa que el teléfono del admin sea válido.',
      ok ? 'success' : 'error'
    );
  };

  // Modo Repartidor: cuando un pedido a domicilio está en "En Camino", el admin
  // (que reparte) comparte su GPS en vivo para que el cliente lo rastree.
  const [courierActive, setCourierActive] = useState(false);
  const [courierOrderId, setCourierOrderId] = useState(null);
  const courierPosRef = useRef(null);
  const courierWatchIdRef = useRef(null);

  const stopCourierTracking = () => {
    if (courierWatchIdRef.current != null) {
      navigator.geolocation.clearWatch(courierWatchIdRef.current);
      courierWatchIdRef.current = null;
    }
    courierPosRef.current = null;
    setCourierActive(false);
    setCourierOrderId(null);
  };

  // Inicia el seguimiento GPS y lo reporta periódicamente al servidor.
  const startCourierTracking = (orderId) => {
    if (!navigator.geolocation) {
      addToast('Tu navegador no soporta geolocalización', 'error');
      return;
    }
    setCourierActive(true);
    setCourierOrderId(orderId);
    addToast('Modo Repartidor activo: compartiendo tu ubicación en vivo', 'success');
    courierWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        courierPosRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
  };

  // Reporta la posición cada 5s mientras el modo repartidor esté activo.
  const onUpdateCourierLocationRef = useRef(onUpdateCourierLocation);
  useEffect(() => {
    onUpdateCourierLocationRef.current = onUpdateCourierLocation;
  }, [onUpdateCourierLocation]);

  useEffect(() => {
    if (!courierActive || !courierOrderId) return;
    const report = () => {
      const pos = courierPosRef.current;
      if (pos) onUpdateCourierLocationRef.current?.(courierOrderId, pos.lat, pos.lng);
    };
    const timer = setInterval(report, 5000);
    return () => clearInterval(timer);
  }, [courierActive, courierOrderId]);

  // Detiene el seguimiento al desmontar el panel.
  useEffect(() => () => {
    if (courierWatchIdRef.current != null) navigator.geolocation.clearWatch(courierWatchIdRef.current);
  }, []);

  // Promos editor state
  const [promoDraft, setPromoDraft] = useState(null);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);

  // Cobros vencidos pendientes de enviar: mientras el panel esté abierto se
  // revisa cada 30s (y al montar) si algún cobro programado ya venció. El admin
  // decide enviarlo o descartarlo; no se envía solo. Lo descartado se olvida
  // al recargar la app, así que si estaba cerrada vuelve a aparecer.
  const [overdueList, setOverdueList] = useState([]);
  const dismissedOverdueRef = useRef([]);

  useEffect(() => {
    const refresh = () => {
      const now = Date.now();
      const due = collections.filter(
        (c) => c.status === 'programado' && c.phone && new Date(c.dueAt || 0).getTime() <= now
      );
      setOverdueList(due.filter((c) => !dismissedOverdueRef.current.includes(c.id)));
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [collections]);

  const handleSendOverdue = async (c) => {
    const cust = (allCustomers || []).find((x) => normalizePhoneDigits(x.phone) === normalizePhoneDigits(c.phone)) || {
      phone: c.phone,
      customerName: c.customerName
    };
    const wa = formatPhoneWhatsApp(cust.phone);
    if (wa) {
      const msg = c.note ? `${buildAccountMessage(cust, orders)}\n\n_${c.note}_` : buildAccountMessage(cust, orders);
      window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
    }
    const ok = await onUpsertCollection({ id: c.id, status: 'enviado' });
    if (ok) setOverdueList((prev) => prev.filter((x) => x.id !== c.id));
  };

  const handleDismissOverdue = (c) => {
    dismissedOverdueRef.current.push(c.id);
    setOverdueList((prev) => prev.filter((x) => x.id !== c.id));
  };

  // --- Mejoras operativas de la sección Pedidos ---

  // Alerta de pedido nuevo: detecta ids que antes no estaban, suena y avisa con
  // un toast (si el panel está visible) y acumula el contador de "no vistos"
  // hasta que se abre la pestaña de pedidos. La primera carga real de pedidos
  // solo siembra el conjunto para no alertar pedidos que ya existían.
  const addToastRef = useRef(addToast);
  useEffect(() => {
    addToastRef.current = addToast;
  }, [addToast]);
  useEffect(() => {
    if (knownOrderIdsRef.current === null) {
      knownOrderIdsRef.current = orders.length > 0 ? new Set(orders.map((o) => o.id)) : null;
      return;
    }
    const prev = knownOrderIdsRef.current;
    const fresh = orders.filter((o) => !prev.has(o.id));
    knownOrderIdsRef.current = new Set(orders.map((o) => o.id));
    if (fresh.length === 0) return;
    setUnviewedCount((c) => c + fresh.length);
    const label = `${fresh.length} pedido${fresh.length !== 1 ? 's' : ''} nuevo${fresh.length !== 1 ? 's' : ''}: ${fresh.map((o) => o.id).join(', ')}`;
    playChime();
    haptic(160);
    if (document.visibilityState === 'visible') {
      addToastRef.current(label, 'info');
    } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const n = new Notification('Nuevo pedido', { body: label, tag: 'kiosko-new-order', renotify: true });
        n.onclick = () => window.focus();
        setTimeout(() => n.close(), 8000);
      } catch {}
    }
  }, [orders]);

  // Al abrir la pestaña de pedidos se limpia el contador de no vistos.
  useEffect(() => {
    if (adminTab === 'orders') setUnviewedCount(0);
  }, [adminTab]);

  // Preferencias de la sección Pedidos: se recuerdan entre sesiones.
  useEffect(() => {
    try {
      localStorage.setItem(ORDER_PREFS_KEY, JSON.stringify({ statusFilter, ordersView, productFilter, ageSortOldest }));
    } catch {}
  }, [statusFilter, ordersView, productFilter, ageSortOldest]);

  useEffect(() => {
    try {
      localStorage.setItem(PINNED_KEY, JSON.stringify(pinnedOrders));
    } catch {}
  }, [pinnedOrders]);

  const togglePin = (id) =>
    setPinnedOrders((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Antigüedad del pedido en minutos (semáforo de espera).
  const orderAgeMinutes = (o) => {
    const d = parseOrderDate(o);
    if (isNaN(d)) return 0;
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  };

  const semaforoOf = (o) => {
    const mins = orderAgeMinutes(o);
    const est = Number(o.estimatedMinutes) || 0;
    if (est > 0 && mins > est) {
      return { tone: 'rose', text: `${mins} min (+${mins - est})`, label: 'Supera lo estimado' };
    }
    if (mins >= 10) return { tone: 'rose', text: `${mins} min`, label: 'Espera alta' };
    if (mins >= 5) return { tone: 'amber', text: `${mins} min`, label: 'Espera media' };
    return { tone: 'emerald', text: `${mins} min`, label: 'Reciente' };
  };

  // Pedidos que incluyen un producto cuyo stock no alcanza lo pedido.
  const lowStockInOrder = useCallback(
    (o) => {
      const missing = [];
      (o.items || []).forEach((it) => {
        const p = products.find((pr) => pr.id === it.id);
        if (p && Number(p.stock) < Number(it.quantity)) {
          missing.push({ name: it.name, have: p.stock, need: it.quantity });
        }
      });
      return missing;
    },
    [products]
  );

  const lowStockOrdersCount = useMemo(
    () =>
      orders.filter(
        (o) => o.status !== 'cancelado' && o.status !== 'entregado' && lowStockInOrder(o).length > 0
      ).length,
    [orders, lowStockInOrder]
  );

  // Lista principal de PEDIDOS ACTIVOS: solo estados en curso. Los finalizados
  // (entregado / cancelado) viven en el panel de Historial, no acá.
  const ACTIVE_ORDER_STATUSES = ['pendiente', 'en_preparacion', 'listo', 'en_camino'];
  const activeStatus =
    statusFilter === 'todos' || !ACTIVE_ORDER_STATUSES.includes(statusFilter) ? 'todos' : statusFilter;
  const statusFiltered = activeStatus === 'todos'
    ? orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status))
    : orders.filter((o) => o.status === activeStatus);

  const productFilteredOrders = productFilter
    ? statusFiltered.filter((o) => o.items.some((it) => it.id === productFilter))
    : statusFiltered;

  const filteredOrders = useMemo(() => {
    const pinnedSet = new Set(pinnedOrders);
    return [...productFilteredOrders].sort((a, b) => {
      const pa = pinnedSet.has(a.id) ? 1 : 0;
      const pb = pinnedSet.has(b.id) ? 1 : 0;
      if (pa !== pb) return pb - pa;
      if (ageSortOldest) return orderAgeMinutes(b) - orderAgeMinutes(a);
      return 0;
    });
  }, [productFilteredOrders, pinnedOrders, ageSortOldest]);

  // Historial: pedidos finalizados (entregado + cancelado) con sus propios
  // filtros de estado, rango de fechas y búsqueda. Ordenados del más reciente.
  const finalizedOrders = useMemo(
    () => orders.filter((o) => o.status === 'entregado' || o.status === 'cancelado'),
    [orders]
  );
  const orderDateVal = (o) => {
    const d = parseOrderDate(o);
    return isNaN(d) ? 0 : d.getTime();
  };
  const histFiltered = useMemo(() => {
    const q = histSearch.trim().toLowerCase();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOf7 = startOfToday - 6 * 86400000;
    return finalizedOrders
      .filter((o) => histStatus === 'todos' || o.status === histStatus)
      .filter((o) => {
        if (histRange === 'todo') return true;
        const t = orderDateVal(o);
        return t >= (histRange === 'hoy' ? startOfToday : startOf7);
      })
      .filter((o) => {
        if (!q) return true;
        return `${o.id} ${o.customerName || ''} ${o.phone || ''}`.toLowerCase().includes(q);
      })
      .sort((a, b) => orderDateVal(b) - orderDateVal(a));
  }, [finalizedOrders, histStatus, histSearch, histRange]);
  const histEntregados = histFiltered.filter((o) => o.status === 'entregado');
  const histCancelados = histFiltered.filter((o) => o.status === 'cancelado');
  const histRevenue = histEntregados.reduce((acc, o) => acc + (o.total || 0), 0);

  // Productos presentes en los pedidos del filtro de estado actual (para el
  // filtro rápido por producto).
  const productFilterOptions = useMemo(() => {
    const map = {};
    statusFiltered.forEach((o) =>
      o.items.forEach((it) => {
        if (!map[it.id]) map[it.id] = { id: it.id, name: it.name, count: 0 };
        map[it.id].count += 1;
      })
    );
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 12);
  }, [statusFiltered]);

  // "Despacho vs Caja": separa lo que hay que alistar/despachar de lo que hay
  // que validar en caja (pagos digitales en revisión o rechazados).
  // Lógica por tipo:
  //  • Retiro en tienda: Iniciar → Marcar listo → Retirado (final = entregado).
  //  • Delivery: Iniciar → Marcar listo y desaparece de despacho para aparecer
  //    en Entregas (cuando queda "listo" se mueve a la pestaña Entregas).
  const isPaymentBlocked = (o) =>
    o.paymentMethod && o.paymentMethod !== 'efectivo' && o.paymentStatus === 'pendiente' && !o.credit;
  const despachoOrders = useMemo(
    () =>
      orders
        .filter((o) => !isPaymentBlocked(o) && o.paymentStatus !== 'rechazado')
        .filter((o) =>
          o.type === 'delivery'
            ? ['pendiente', 'en_preparacion'].includes(o.status)
            : ['pendiente', 'en_preparacion', 'listo'].includes(o.status)
        )
        .sort((a, b) => orderAgeMinutes(b) - orderAgeMinutes(a)),
    [orders]
  );
  const cajaOrders = useMemo(
    () =>
      orders
        .filter((o) => o.paymentMethod && o.paymentMethod !== 'efectivo')
        .filter((o) => o.paymentStatus === 'pendiente' || o.paymentStatus === 'rechazado')
        .sort((a, b) => orderAgeMinutes(b) - orderAgeMinutes(a)),
    [orders]
  );
  // Entregas del día: pedidos a domicilio listos para salir o ya en camino,
  // con su ruta sugerida (orden por cercanía desde el comercio).
  const activeDeliveries = useMemo(() => {
    const list = orders
      .filter((o) => o.type === 'delivery')
      .filter((o) => o.status === 'listo' || o.status === 'en_camino');
    const withCoords = list.filter((o) => o.lat != null && o.lng != null);
    const withoutCoords = list.filter((o) => o.lat == null || o.lng == null);
    const store = storeLocation;
    const start =
      store && store.lat != null && store.lng != null
        ? { lat: Number(store.lat), lng: Number(store.lng) }
        : null;
    const ordered = [];
    const remaining = [...withCoords];
    let cur = start;
    while (remaining.length > 0) {
      let bestIdx = 0;
      if (cur) {
        let bestDist = Infinity;
        remaining.forEach((o, i) => {
          const d = haversineKm(cur.lat, cur.lng, Number(o.lat), Number(o.lng));
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        });
      }
      const pick = remaining.splice(bestIdx, 1)[0];
      const routeKm =
        cur != null ? haversineKm(cur.lat, cur.lng, Number(pick.lat), Number(pick.lng)) : null;
      ordered.push({ ...pick, routeNumber: ordered.length + 1, routeKm });
      cur = { lat: Number(pick.lat), lng: Number(pick.lng) };
    }
    return { ordered, withoutCoords };
  }, [orders, storeLocation]);

  // Calculated Analytics
  const lowStockProducts = products.filter((p) => p.stock <= 5);
  const completedOrders = orders.filter((o) => o.status === 'entregado');
  const totalRevenue = completedOrders.reduce((acc, o) => acc + o.total, 0);
  const pendingOrders = orders.filter((o) => ['pendiente', 'en_preparacion', 'listo', 'en_camino'].includes(o.status));

  const openNewPromo = () => {
    setPromoDraft({ id: `promo-${Date.now()}`, title: '', subtitle: '', image: '', active: true });
    setIsPromoModalOpen(true);
  };

  const openEditPromo = (promo) => {
    setPromoDraft({ ...promo });
    setIsPromoModalOpen(true);
  };

  const handleSavePromo = (data) => {
    if (!data.id) return;
    const exists = promos.some((p) => p.id === data.id);
    const next = exists ? promos.map((p) => (p.id === data.id ? data : p)) : [...promos, data];
    onSavePromos(next);
    setIsPromoModalOpen(false);
    setPromoDraft(null);
  };

  const handleDeletePromo = (id) => {
    onSavePromos(promos.filter((p) => p.id !== id));
    setIsPromoModalOpen(false);
    setPromoDraft(null);
  };

  // Tendencia de ventas por día (últimos 7 días): cantidad de pedidos y ventas en $.
  const salesByDay = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({
        key: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString('es-ES', { weekday: 'short' }),
        orders: 0,
        revenue: 0
      });
    }
    const map = {};
    days.forEach((d) => (map[d.key] = d));
    orders.forEach((o) => {
      const ts = o.timestamp ? new Date(o.timestamp) : null;
      const key = ts && !isNaN(ts) ? new Date(ts.getFullYear(), ts.getMonth(), ts.getDate()).toISOString().slice(0, 10) : null;
      if (key && map[key]) {
        map[key].orders += 1;
        if (o.status === 'entregado') map[key].revenue += o.total || 0;
      }
    });
    return days;
  }, [orders]);

  // Clientes con mayor volumen de pedidos (segmentación por actividad).
  const topCustomers = useMemo(() => {
    const counts = {};
    orders.forEach((o) => {
      const key = (o.phone || 'desconocido').trim();
      counts[key] = counts[key] || { phone: key, orders: 0, revenue: 0 };
      counts[key].orders += 1;
      if (o.status === 'entregado') counts[key].revenue += o.total || 0;
    });
    return Object.values(counts)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5);
  }, [orders]);

  const lowStockMessage = useMemo(() => {
    if (lowStockProducts.length === 0) return '';
    const lines = lowStockProducts.slice(0, 10).map((p) => `• ${p.name}: ${p.stock} un.`);
    return `⚠️ *ALERTA DE STOCK BAJO* en Kiosko 247\n\nProductos con pocas unidades:\n${lines.join('\n')}\n\nRevisa el inventario y repón lo antes posible.`;
  }, [lowStockProducts]);

  // Pedido de reabastecimiento al proveedor: productos con stock bajo y cantidad
  // sugerida para reponer (mín. 10 unidades), listo para enviar por WhatsApp.
  const reorderMessage = useMemo(() => {
    if (lowStockProducts.length === 0) return '';
    const lines = lowStockProducts.slice(0, 15).map((p) => `• ${p.name}: ${Math.max(10, Math.ceil(p.stock * 2))} un.`);
    return `📦 *PEDIDO DE REABASTECIMIENTO — Kiosko 247*\n\nNecesito reponer:\n${lines.join('\n')}\n\nPor favor confírmame disponibilidad y precio.`;
  }, [lowStockProducts]);

  // ===== Dashboard financiero en vivo =====
  // KPIs del día (hoy y ayer) a partir de pedidos pagados/entregados.
  const finDash = useMemo(() => {
    const today = toYMD(new Date());
    const yesterday = toYMD(new Date(Date.now() - 86400000));
    const byDay = { [today]: { orders: 0, revenue: 0, cost: 0, cash: 0, digital: 0, credit: 0, tickets: 0 }, [yesterday]: { orders: 0, revenue: 0, cost: 0, cash: 0, digital: 0, credit: 0, tickets: 0 } };
    const todayItems = {};
    orders.forEach((o) => {
      const day = toYMD(parseOrderDate(o));
      if (!byDay[day]) return;
      const isSale = o.status === 'entregado';
      if (o.status !== 'cancelado') byDay[day].tickets += 1;
      if (!isSale) return;
      const total = Number(o.total) || 0;
      byDay[day].orders += 1;
      byDay[day].revenue += total;
      const items = Array.isArray(o.items) ? o.items : [];
      byDay[day].cost += items.reduce((acc, it) => acc + (it.quantity || 0) * (Number(costById[it.id]) || 0), 0);
      if (o.credit) byDay[day].credit += total;
      else if (o.paymentMethod === 'efectivo') byDay[day].cash += total;
      else byDay[day].digital += total;
      if (day === today) {
        items.forEach((it) => {
          todayItems[it.id] = (todayItems[it.id] || 0) + it.quantity;
        });
      }
    });
    const t = byDay[today];
    const y = byDay[yesterday];
    const topToday = Object.entries(todayItems)
      .map(([id, quantity]) => {
        const p = products.find((prod) => prod.id === id);
        const cost = Number(costById[id]) || 0;
        const unitRevenue = p ? Number(p.price) || 0 : 0;
        return p
          ? { ...p, quantity, cost, unitRevenue, marginUnit: unitRevenue - cost, margin: quantity * (unitRevenue - cost) }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);
    return {
      today: t,
      yesterday: y,
      grossProfit: t.revenue - t.cost,
      grossMarginPct: t.revenue > 0 ? ((t.revenue - t.cost) / t.revenue) * 100 : 0,
      ticketAvg: t.orders > 0 ? t.revenue / t.orders : 0,
      revenueDelta: y.revenue > 0 ? ((t.revenue - y.revenue) / y.revenue) * 100 : (t.revenue > 0 ? 100 : 0),
      ticketsDelta: y.tickets > 0 ? ((t.tickets - y.tickets) / y.tickets) * 100 : (t.tickets > 0 ? 100 : 0),
      topToday
    };
  }, [orders, products, costById]);

  // Total fiado pendiente (deuda activa de todos los clientes).
  const totalFiado = useMemo(
    () => (allCustomers || []).reduce((acc, c) => acc + Math.max(0, Number(c.balance) || 0), 0),
    [allCustomers]
  );

  // Pedidos pagados digitales pendientes de validar (caja).
  const cashDigitalTotal = useMemo(() => {
    let cash = 0;
    let digital = 0;
    completedOrders.forEach((o) => {
      if (o.credit) return;
      if (o.paymentMethod === 'efectivo') cash += Number(o.total) || 0;
      else digital += Number(o.total) || 0;
    });
    return { cash, digital };
  }, [completedOrders]);

  // ===== Kiosko Operator: resumen de jornada (cierre del día) =====
  const jornadaSummary = useMemo(() => {
    const t = finDash.today;
    const top = finDash.topToday.slice(0, 3).map((p) => `• ${p.name}: ${p.quantity} un.`).join('\n') || '• Sin ventas aún';
    const lines = [
      `📊 *RESUMEN DE JORNADA — Kiosko 247*`,
      `🗓️ Hoy, ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`,
      ``,
      `💰 Ventas: ${formatUsd(t.revenue)} (${t.orders} entregados)`,
      `🎫 Tickets: ${t.tickets} pedidos`,
      `🧾 Ticket promedio: ${finDash.ticketAvg > 0 ? formatUsd(finDash.ticketAvg) : '—'}`,
      `💵 Efectivo: ${formatUsd(t.cash)}`,
      `📲 Digital: ${formatUsd(t.digital)}`,
      `📒 Fiado: ${formatUsd(t.credit)}`,
      `🧮 Deuda total pendiente: ${formatUsd(totalFiado)}`,
      ``,
      `🏆 Top productos:`,
      top,
      ``,
      `Comparado con ayer: ventas ${finDash.revenueDelta >= 0 ? `▲ +${finDash.revenueDelta.toFixed(0)}%` : `▼ ${finDash.revenueDelta.toFixed(0)}%`}`
    ];
    return lines.join('\n');
  }, [finDash, totalFiado]);

  const renderOrderCard = (order, { inFicha = false } = {}) => {
    const st = STATUS_STYLES[order.status] || STATUS_STYLES.pendiente;
    const wa = formatPhoneWhatsApp(order.phone);
    const sem = semaforoOf(order);
    const missingStock = lowStockInOrder(order);
    const isPinned = pinnedOrders.includes(order.id);
    const payPending = needsPaymentValidation(order);
    // Estados "procesando" de los botones de esta tarjeta.
    const stBusy = Boolean(busyActions[`st:${order.id}`]);
    const payBusy = Boolean(busyActions[`pay:${order.id}`]);
    const delBusy = Boolean(busyActions[`del:${order.id}`]);
    const gpsBusy = Boolean(busyActions[`gps:${order.id}`]);
    // Tarjeta que envejece (#6): el tono sigue al semáforo de espera.
    const isActiveStatus = ['pendiente', 'en_preparacion', 'listo', 'en_camino'].includes(order.status);
    const agingClass = !payPending && isActiveStatus && sem.tone !== 'emerald'
      ? (sem.tone === 'rose'
        ? 'border-rose-500/60 bg-rose-950/40 shadow-rose-900/20 animate-pulse'
        : 'border-amber-500/50 bg-amber-950/30')
      : '';
    // Gestos (#3): swipe derecha avanza · izquierda abre ficha · press largo = menú.
    const swipeNext = !payPending ? nextOrderStatus(order) : null;
    const CardShell = inFicha ? 'div' : OrderCardGestures;
    const shellProps = inFicha ? {} : {
      onLongPress: () => setQuickMenuOrder(order),
      onSwipeRight: swipeNext ? () => runExclusive(`st:${order.id}`, () => onUpdateOrderStatus(order.id, swipeNext)) : null,
      onSwipeLeft: () => openFicha(order)
    };
    return (
      <CardShell
        key={order.id}
        {...shellProps}
        className={`p-4 sm:p-5 space-y-4 flex flex-col justify-between shadow-xl ${payPending ? 'bg-slate-800/80 border border-amber-500/50' : agingClass || `bg-slate-800/80 border ${st.ring}`}`}
      >
        <div className="space-y-3">
          {/* Notas del cliente arriba y destacadas (#7): lo primero que se lee */}
          {order.notes && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-400/15 border border-amber-400/50 text-amber-200 text-xs font-bold">
              <Icon name="edit" className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="min-w-0 flex-1">{order.notes}</span>
            </div>
          )}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-mono text-xs font-bold text-teal-400">{order.id}</span>
              {!payPending && ['pendiente', 'en_preparacion', 'listo', 'en_camino'].includes(order.status) && (
                <span className={`px-2 py-0.5 rounded-full border text-[11px] font-black flex items-center gap-1 shrink-0 tabular-nums ${SEM_TONES[sem.tone]} ${sem.tone === 'rose' ? 'animate-pulse' : ''}`}>
                  <Icon name="clock" className="w-3 h-3" />
                  {sem.text}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {payPending ? (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-amber-400/40 bg-amber-500/15 text-amber-300 text-[11px] font-bold">
                  <Icon name="clock" className="w-3 h-3" />
                  Pago en revisión
                </span>
              ) : (
              <span
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${st.badge}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${st.dot} animate-pulse`} />
                {({ pendiente: 'Pendiente', en_preparacion: 'En Preparación', listo: 'Listo', en_camino: 'En Camino', entregado: 'Entregado', cancelado: 'Cancelado' })[order.status]}
              </span>
              )}
              {(order.paymentMethod === 'cartera' || Number(order.walletApplied) > 0) && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-300 text-[11px] font-bold">
                  <Icon name="wallet" className="w-3 h-3" />
                  Pagado con cartera
                  {Number(order.walletApplied) > 0 && <span className="text-[10px] opacity-80">({formatUsd(Number(order.walletApplied))})</span>}
                </span>
              )}
              {order.paymentMethod && order.paymentMethod !== 'efectivo' && order.paymentMethod !== 'cartera' && (
                <span
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-bold ${
                    order.paymentStatus === 'confirmado'
                      ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                      : order.paymentStatus === 'rechazado'
                        ? 'border-rose-400/40 bg-rose-500/15 text-rose-300'
                        : 'border-amber-400/40 bg-amber-500/15 text-amber-300'
                  }`}
                >
                  <Icon name="creditCard" className="w-3 h-3" />
                  {({ pago_movil: 'Pago Móvil', transferencia: 'Transferencia' })[order.paymentMethod] || 'Pago'} ·{' '}
                  {({ pendiente: 'En revisión', confirmado: 'Confirmado', rechazado: 'Rechazado' })[order.paymentStatus] || 'Pendiente'}
                </span>
              )}
              {order.credit && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-indigo-400/40 bg-indigo-500/15 text-indigo-300 text-[11px] font-bold">
                  <Icon name="creditCard" className="w-3 h-3" />
                  A cuenta
                </span>
              )}
              {order.type !== 'delivery' && ['en_preparacion', 'listo'].includes(order.status) && (
                <span
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-teal-400/40 bg-teal-500/10 text-teal-300 text-[11px] font-black font-mono tabular-nums"
                  title="Código de retiro: verificalo con el que muestra el cliente"
                >
                  🔑 {pickupCodeOf(order.id)}
                </span>
              )}
              <button
                onClick={() => togglePin(order.id)}
                className={`p-1.5 rounded-lg border transition-all ${
                  isPinned
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-slate-900/60 text-slate-500 border-slate-700 hover:text-amber-300'
                }`}
                title={isPinned ? 'Quitar de fijados' : 'Fijar pedido arriba'}
              >
                <Icon name="pin" className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-white text-base">{order.customerName}</h4>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-slate-300 flex items-center gap-1">
                <Icon name="phone" className="w-3.5 h-3.5 text-slate-400" />
                {order.phone}
              </p>
              {wa && (
                <a
                  href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hola ${order.customerName}, sobre tu pedido ${order.id} en Kiosko 247`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold hover:bg-emerald-500/25 transition-all"
                >
                  <Icon name="whatsapp" className="w-3.5 h-3.5" />
                  WhatsApp
                </a>
              )}
            </div>
            {order.type === 'delivery' ? (
              inFicha ? (
                <span className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 text-xs font-semibold">
                  <Icon name="mapPin" className="w-3 h-3" />
                  Entrega a Domicilio
                </span>
              ) : (
                <p className="text-xs text-amber-300 flex items-center gap-1 mt-1 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                  <Icon name="mapPin" className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Entrega: {order.address}</span>
                  {order.lat != null && order.lng != null && (
                    <a
                      href={`https://www.google.com/maps?q=${order.lat},${order.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300 text-[10px] font-bold hover:bg-sky-500/25 transition-all"
                    >
                      <Icon name="mapPin" className="w-3 h-3" />
                      Abrir en Maps
                    </a>
                  )}
                  {order.courier_lat != null && order.courier_lng != null && (
                    <span className="text-[10px] font-bold text-emerald-300 ml-auto">
                      Repartidor en vivo
                    </span>
                  )}
                </p>
              )
            ) : (
              <span className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-lg bg-teal-500/10 text-teal-300 text-xs font-semibold">
                <Icon name="store" className="w-3 h-3" />
                Retiro por Mostrador
              </span>
            )}
          </div>

          {/* Order Line Items */}
          <div className="p-3 rounded-2xl bg-slate-900/80 space-y-1.5 text-xs text-slate-300">
            {order.items.map((it, idx) => (
              <div key={idx} className="flex justify-between">
                <span>{it.quantity}x {it.name}</span>
                <span className="font-bold text-white">
                  {formatUsd(it.price * it.quantity)}
                  {rate?.rate > 0 && (
                    <span className="block text-[10px] text-slate-500 text-right">
                      {formatBs(usdToBs(it.price * it.quantity, rate.rate))}
                    </span>
                  )}
                </span>
              </div>
            ))}
            <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-white text-sm">
              <span>Total</span>
              <span className="text-teal-400 text-right">
                {formatUsd(order.total)}
                {rate?.rate > 0 && (
                  <span className="block text-[10px] text-teal-300/90">
                    {formatBs(usdToBs(order.total, rate.rate))}
                  </span>
                )}
              </span>
            </div>
          </div>

          {missingStock.length > 0 && (
            <div className="flex items-start gap-1.5 p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] font-semibold">
              <Icon name="alertTriangle" className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Sin stock suficiente: {missingStock.map((m) => `${m.name} (${m.have}/${m.need})`).join(', ')}
              </span>
            </div>
          )}
          {sem.tone === 'rose' && sem.label === 'Supera lo estimado' && (
            <div className="flex items-center gap-1.5 p-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-[11px] font-bold">
              <Icon name="alertTriangle" className="w-3.5 h-3.5 shrink-0" />
              Lleva más del tiempo estimado
            </div>
          )}

          {/* Pago digital: comprobante y estado */}
          {order.paymentMethod === 'cartera' || Number(order.walletApplied || 0) > 0 ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              <Icon name="wallet" className="w-4 h-4 shrink-0" />
              Pagado con cartera — saldo a favor del cliente
              {Number(order.walletApplied || 0) > 0 && <span className="text-[10px] opacity-80">({formatUsd(Number(order.walletApplied))})</span>}
            </div>
          ) : order.paymentMethod && order.paymentMethod !== 'efectivo' ? (
            <div className="space-y-2">
              {order.paymentReference && (
                <p className="text-xs text-slate-300 bg-slate-900/40 p-2 rounded-xl">
                  Ref: <span className="font-mono font-bold text-white">{order.paymentReference}</span>
                </p>
              )}
              {order.hasProof ? (
                <button
                  onClick={() => setProofOrder(order)}
                  className="w-full flex items-center gap-3 p-2 rounded-xl bg-slate-900/60 border border-slate-700 hover:border-teal-500/40 transition-all text-left"
                >
                  <span className="w-14 h-14 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                    <Icon name="image" className="w-5 h-5 text-teal-400" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-white">Ver comprobante</span>
                    <span className="block text-[11px] text-slate-400">Toca para ampliar</span>
                  </span>
                  <Icon name="eye" className="w-4 h-4 text-teal-400 ml-auto shrink-0" />
                </button>
              ) : (
                <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl flex items-center gap-1.5">
                  <Icon name="alertTriangle" className="w-3.5 h-3.5" />
                  Pago digital sin comprobante adjunto
                </p>
              )}
              {order.paymentStatus === 'rechazado' && (
                <p className="text-xs text-rose-300/90 bg-rose-500/10 border border-rose-500/30 p-2 rounded-xl flex items-start gap-1.5">
                  <Icon name="alertTriangle" className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Pago rechazado: el cliente debe subir otro comprobante o
                  pasar el pedido a cuenta (si es beneficiado) antes de avanzar.
                </p>
              )}
              {order.paymentStatus === 'pendiente' && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => runExclusive(`pay:${order.id}`, () => onUpdateOrderPayment(order.id, 'confirmado'))}
                    disabled={payBusy}
                    className="py-2 px-2 rounded-xl text-xs font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:pointer-events-none"
                  >
                    <Icon name={payBusy ? 'refresh' : 'check'} className={`w-3.5 h-3.5 ${payBusy ? 'animate-spin' : ''}`} />
                    {payBusy ? 'Procesando…' : 'Confirmar pago'}
                  </button>
                  <button
                    onClick={() => runExclusive(`pay:${order.id}`, () => onUpdateOrderPayment(order.id, 'rechazado'))}
                    disabled={payBusy}
                    className="py-2 px-2 rounded-xl text-xs font-bold bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:pointer-events-none"
                  >
                    <Icon name={payBusy ? 'refresh' : 'x'} className={`w-3.5 h-3.5 ${payBusy ? 'animate-spin' : ''}`} />
                    {payBusy ? 'Procesando…' : 'Rechazar pago'}
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {/* Chat con el cliente */}
          <OrderChat order={order} />
        </div>

        {/* Status Update Controls — en la ficha queda pegado al pie del panel:
            siempre visible sin depender del scroll */}
        <div
          data-no-swipe
          className={`pt-3 border-t border-slate-700/60 space-y-2 ${
            inFicha
              ? 'sticky bottom-0 z-20 -mx-4 sm:-mx-5 px-4 sm:px-5 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-3 bg-slate-900/95 backdrop-blur-md'
              : ''
          }`}
        >
          {payPending ? (
            <p className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl flex items-center gap-1.5">
              <Icon name="lock" className="w-3.5 h-3.5 shrink-0" />
              Confirma o rechaza el pago arriba para poder avanzar el estado del pedido.
            </p>
          ) : (
          <>
          <span className="text-[11px] text-slate-400 font-semibold block">Cambiar Estado:</span>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'pendiente', label: 'Pendiente' },
              { key: 'en_preparacion', label: 'En Prep.' },
              { key: 'listo', label: 'Listo' },
              ...(order.type === 'delivery' ? [{ key: 'en_camino', label: 'En Camino' }] : []),
              { key: 'entregado', label: 'Entregado' },
              { key: 'cancelado', label: 'Cancelado' }
            ].map((stBtn) => (
              <button
                key={stBtn.key}
                onClick={() => runExclusive(`st:${order.id}`, () => {
                  if (stBtn.key === 'cancelado') setConfirmCancelOrder(order);
                  else onUpdateOrderStatus(order.id, stBtn.key);
                })}
                disabled={stBusy}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:pointer-events-none ${
                  order.status === stBtn.key
                    ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-md'
                    : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                {stBusy && <Icon name="refresh" className="w-3 h-3 animate-spin" />}
                {stBtn.label}
              </button>
            ))}
          </div>

          {/* Modo Repartidor: comparte el GPS mientras el pedido va en camino */}
          {order.type === 'delivery' && order.status === 'en_camino' && (
            <div className="pt-1">
              {courierOrderId === order.id && courierActive ? (
                <button
                  onClick={() => runExclusive(`gps:${order.id}`, () => stopCourierTracking())}
                  disabled={gpsBusy}
                  className="w-full py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold hover:bg-rose-500/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:pointer-events-none"
                >
                  <Icon name={gpsBusy ? 'refresh' : 'mapPin'} className={`w-3.5 h-3.5 ${gpsBusy ? 'animate-spin' : ''}`} />
                  {gpsBusy ? 'Deteniendo…' : 'Detener rastreo en vivo'}
                </button>
              ) : (
                <button
                  onClick={() => runExclusive(`gps:${order.id}`, () => startCourierTracking(order.id))}
                  disabled={gpsBusy}
                  className="w-full py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:pointer-events-none"
                >
                  <Icon name={gpsBusy ? 'refresh' : 'mapPin'} className={`w-3.5 h-3.5 ${gpsBusy ? 'animate-spin' : ''}`} />
                  {gpsBusy ? 'Iniciando…' : 'Comenzar entrega (GPS en vivo)'}
                </button>
              )}
            </div>
          )}

          {/* Aprobar / Rechazar pedido a crédito (solo pendiente) */}
          {order.credit && order.status === 'pendiente' && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => runExclusive(`st:${order.id}`, () => onUpdateOrderStatus(order.id, 'en_preparacion'))}
                disabled={stBusy}
                className="py-2 px-2 rounded-xl text-xs font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:pointer-events-none"
              >
                <Icon name={stBusy ? 'refresh' : 'check'} className={`w-3.5 h-3.5 ${stBusy ? 'animate-spin' : ''}`} />
                {stBusy ? 'Procesando…' : 'Aceptar y preparar'}
              </button>
              <button
                onClick={() => runExclusive(`st:${order.id}`, () => setConfirmCancelOrder(order))}
                disabled={stBusy}
                className="py-2 px-2 rounded-xl text-xs font-bold bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:pointer-events-none"
              >
                <Icon name="x" className="w-3.5 h-3.5" />
                Rechazar
              </button>
            </div>
          )}

          {/* Eliminar pedido cancelado (para no acumular en la lista) */}
          {order.status === 'cancelado' && (
            <button
              onClick={() => runExclusive(`del:${order.id}`, () => onDeleteOrder(order))}
              disabled={delBusy}
              className="w-full py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold text-xs hover:bg-rose-500/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:pointer-events-none"
            >
              <Icon name={delBusy ? 'refresh' : 'trash'} className={`w-3.5 h-3.5 ${delBusy ? 'animate-spin' : ''}`} />
              {delBusy ? 'Eliminando…' : 'Eliminar pedido'}
            </button>
          )}
          </>
          )}
        </div>
      </CardShell>
    );
  };

  // ── Vista Mostrador (#1): armado de pedidos en modo foco ────────────────
  // Tarjetas XXL ordenadas por espera, cronómetro vivo y UN botón contextual
  // por pedido (Aceptar → Listo → Despachar/Entregado). Los pagos digitales
  // por validar o rechazados viven AQUÍ con sus botones de Confirmar/Rechazar:
  // no avanzan hasta resolverse.
  const renderMostrador = () => {
    const active = (orders || []).filter((o) => !['entregado', 'cancelado'].includes(o.status));
    const withWait = active.map((o) => {
      const d = parseOrderDate(o);
      const waitMs = isNaN(d) ? 0 : Math.max(0, mostradorNow - d.getTime());
      return { o, waitMs };
    });
    const queue = withWait.sort((a, b) => b.waitMs - a.waitMs); // el más viejo primero

    const stageChips = [
      { label: 'Recibidos', n: queue.filter(({ o }) => o.status === 'pendiente' && !needsPaymentAttention(o)).length, cls: 'bg-slate-700 text-slate-200 border-slate-600' },
      { label: 'Por validar', n: queue.filter(({ o }) => needsPaymentAttention(o)).length, cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
      { label: 'Armando', n: queue.filter(({ o }) => o.status === 'en_preparacion').length, cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40' },
      { label: 'Listos', n: queue.filter(({ o }) => o.status === 'listo').length, cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
      { label: 'Camino', n: queue.filter(({ o }) => o.status === 'en_camino').length, cls: 'bg-sky-500/15 text-sky-300 border-sky-500/40' }
    ];

    return (
      <div className="max-w-md mx-auto sm:max-w-xl space-y-3 animate-fade-in">
        {/* Resumen de etapas */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {stageChips.map((c) => (
            <span key={c.label} className={`px-3 py-1.5 rounded-xl border text-[11px] font-black whitespace-nowrap shrink-0 ${c.cls}`}>
              {c.label} · {c.n}
            </span>
          ))}
          <span className="ml-auto text-[10px] text-slate-500 font-semibold whitespace-nowrap shrink-0">
            → desliza tarjeta para avanzar
          </span>
        </div>

        {queue.length === 0 ? (
          <div className="py-16 text-center space-y-2 text-slate-500">
            <Icon name="checkCircle" className="w-12 h-12 mx-auto text-emerald-500/60" />
            <p className="font-bold text-slate-400">Sin pedidos activos 🎉</p>
          </div>
        ) : (
          queue.map(({ o, waitMs }) => {
            const mm = Math.floor(waitMs / 60000);
            const ss = Math.floor((waitMs % 60000) / 1000);
            const est = Number(o.estimatedMinutes) || 0;
            const tone = (est > 0 && mm > est) || mm >= 10 ? 'rose' : mm >= 5 ? 'amber' : 'emerald';
            const toneCls = tone === 'rose'
              ? 'text-rose-400'
              : tone === 'amber'
                ? 'text-amber-300'
                : 'text-emerald-300';
            const pay = paymentInfoOf(o);
            const payAttn = needsPaymentAttention(o);
            const cardTone = payAttn
              ? 'border-amber-500/60 bg-amber-950/30'
              : tone === 'rose'
                ? 'border-rose-500/60 bg-rose-950/40'
                : tone === 'amber'
                  ? 'border-amber-500/50 bg-amber-950/30'
                  : 'border-slate-700 bg-slate-800/80';
            const busy = Boolean(busyActions[`st:${o.id}`]);
            const payBusy = Boolean(busyActions[`pay:${o.id}`]);
            const missing = lowStockInOrder(o);
            const isDelivery = o.type === 'delivery';

            let action;
            if (!payAttn) {
              if (o.status === 'pendiente') {
                action = o.credit
                  ? { next: 'en_preparacion', label: 'Aprobar pedido a cuenta', icon: 'creditCard' }
                  : { next: 'en_preparacion', label: 'Aceptar pedido', icon: 'check' };
              } else if (o.status === 'en_preparacion') {
                action = { next: 'listo', label: 'Pedido listo', icon: 'package' };
              } else if (o.status === 'listo') {
                action = isDelivery
                  ? { next: 'en_camino', label: 'Despachar pedido', icon: 'navigation' }
                  : { next: 'entregado', label: 'Cliente retiró', icon: 'checkCircle', verify: true };
              } else if (o.status === 'en_camino') {
                action = { next: 'entregado', label: 'Marcar entregado', icon: 'checkCircle' };
              }
            }

            return (
              <div key={o.id} className={`p-4 rounded-3xl border shadow-xl space-y-3 ${cardTone}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="font-mono text-sm font-bold text-teal-400">{o.id}</span>
                    <span className="px-2 py-0.5 rounded-full border border-slate-600 bg-slate-900/60 text-[10px] font-bold text-slate-300 shrink-0">
                      {isDelivery ? '🛵 Delivery' : '🏪 Retiro'}
                    </span>
                    {/* Método de pago visible sin abrir la ficha */}
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold shrink-0 flex items-center gap-1 ${pay.cls}`}>
                      <Icon name={pay.icon} className="w-3 h-3" />
                      {pay.label}{pay.suffix ? ` · ${pay.suffix}` : ''}
                    </span>
                  </div>
                  {/* Cronómetro de espera vivo (#6) */}
                  <span className={`font-mono font-black text-2xl leading-none tabular-nums shrink-0 ${toneCls}`}>
                    {mm}:{String(ss).padStart(2, '0')}
                  </span>
                </div>

                {o.customerName && (
                  <p className="text-xs font-bold text-slate-300 truncate">{o.customerName}</p>
                )}

                {o.notes && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-400/15 border border-amber-400/50 text-amber-200 text-xs font-bold">
                    <Icon name="edit" className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span className="min-w-0 flex-1">{o.notes}</span>
                  </div>
                )}

                {!payAttn && (
                  <ul className="space-y-1">
                    {(o.items || []).map((it, idx) => (
                      <li key={`${it.id}-${idx}`} className="flex items-baseline gap-2 text-sm">
                        <span className="font-black text-white tabular-nums">{it.quantity}×</span>
                        <span className="text-slate-200 min-w-0 truncate">{it.name}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {!payAttn && missing.length > 0 && (
                  <p className="text-[11px] font-bold text-rose-300 flex items-center gap-1.5">
                    <Icon name="alertTriangle" className="w-3.5 h-3.5" />
                    Sin stock: {missing.map((m) => m.name).join(', ')}
                  </p>
                )}

                {/* Efectivo: qué cobrar y cuándo */}
                {!o.credit && pay.key === 'efectivo' && o.status !== 'en_camino' && (
                  <p className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                    <Icon name="dollarSign" className="w-3.5 h-3.5" />
                    Cobrar {formatUsd(o.total)}{isDelivery ? ' al entregar' : ' al retirar'}
                  </p>
                )}
                {o.credit && o.status === 'pendiente' && (
                  <p className="text-[11px] font-semibold text-indigo-300">
                    Fiado: el cliente paga después. Aprobar lo pasa directo a preparación.
                  </p>
                )}

                {!payAttn && !isDelivery && ['en_preparacion', 'listo'].includes(o.status) && (
                  <p className="text-[11px] font-black font-mono tracking-widest text-teal-300">
                    🔑 Código: {pickupCodeOf(o.id)}
                  </p>
                )}

                {/* Pago digital por validar o rechazado: bloquea el armado */}
                {payAttn ? (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                      <Icon name="lock" className="w-3.5 h-3.5" />
                      {o.paymentStatus === 'rechazado'
                        ? 'Pago rechazado: el cliente debe subir nuevo comprobante.'
                        : 'Pago digital por validar: el pedido no avanza hasta confirmarlo.'}
                    </p>
                    {o.hasProof && (
                      <button
                        onClick={() => setProofOrder(o)}
                        data-no-swipe
                        disabled={payBusy}
                        className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-700 hover:border-teal-500/40 transition-all text-left disabled:opacity-60"
                      >
                        <span className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                          <Icon name="image" className="w-4 h-4 text-teal-400" />
                        </span>
                        <span className="text-xs font-bold text-white flex-1">Ver comprobante</span>
                        {o.paymentReference && (
                          <span className="font-mono text-[10px] text-slate-400 mr-1">{o.paymentReference}</span>
                        )}
                        <Icon name="eye" className="w-4 h-4 text-teal-400" />
                      </button>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => runExclusive(`pay:${o.id}`, () => onUpdateOrderPayment(o.id, 'confirmado'))}
                        disabled={payBusy}
                        className="py-3 rounded-xl bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all disabled:opacity-70 disabled:pointer-events-none"
                      >
                        <Icon name={payBusy ? 'refresh' : 'check'} className={`w-3.5 h-3.5 ${payBusy ? 'animate-spin' : ''}`} />
                        {payBusy ? 'Procesando…' : 'Confirmar'}
                      </button>
                      <button
                        onClick={() => runExclusive(`pay:${o.id}`, () => onUpdateOrderPayment(o.id, 'rechazado'))}
                        disabled={payBusy}
                        className="py-3 rounded-xl bg-rose-500/90 text-white text-xs font-black shadow-lg shadow-rose-500/20 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all disabled:opacity-70 disabled:pointer-events-none"
                      >
                        <Icon name={payBusy ? 'refresh' : 'x'} className={`w-3.5 h-3.5 ${payBusy ? 'animate-spin' : ''}`} />
                        {payBusy ? 'Procesando…' : 'Rechazar'}
                      </button>
                    </div>
                  </div>
                ) : action ? (
                  <button
                    onClick={() => {
                      if (action.verify) setRetiroVerifyOrder(o);
                      else runExclusive(`st:${o.id}`, () => onUpdateOrderStatus(o.id, action.next));
                    }}
                    disabled={busy}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 text-sm font-black shadow-lg shadow-teal-500/25 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-70 disabled:pointer-events-none"
                  >
                    {busy
                      ? <><Icon name="refresh" className="w-4 h-4 animate-spin" /> Procesando…</>
                      : <><Icon name={action.icon} className="w-4 h-4" /> {action.label}</>}
                  </button>
                ) : null}

                <button
                  onClick={() => openFicha(o)}
                  data-no-swipe
                  disabled={busy}
                  className="w-full py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 text-[11px] font-bold hover:text-white transition-all disabled:opacity-60"
                >
                  Ver ficha completa
                </button>
              </div>
            );
          })
        )}
      </div>
    );
  };

  const openProfile = () => {
    // En móvil el perfil es una vista completa; en escritorio, el modal clásico.
    if (window.innerWidth < 640) setAdminTab('profile');
    else setShowAdminProfile(true);
  };

  if (adminTab === 'profile') {
    return (
      <AdminProfileView
        phone={adminPhone}
        role={adminRole}
        profile={adminProfile}
        onChangePassword={onChangePassword}
        onSaveProfile={onSaveAdminProfile}
        adminPrefs={adminPrefs}
        onSavePrefs={saveAdminPrefs}
        theme={theme}
        onSetTheme={onSetTheme}
        rate={rate}
        onBack={() => setAdminTab('inventory')}
      />
    );
  }

  return (
    <div className="space-y-5 sm:space-y-8 animate-fade-in">
      {/* Admin Top Dashboard Header */}
      <div className="flex flex-col sm:flex-row md:items-center justify-between gap-4 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-2xl backdrop-blur-md">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold uppercase tracking-wider">
            <Icon name="layers" className="w-3.5 h-3.5" />
            Panel Administrativo
          </span>
          <h2 className="font-display text-lg sm:text-2xl font-black text-white mt-2">Control de Inventario y Ventas</h2>
          <p className="text-xs text-slate-400 mt-1">Gestiona tus productos en tiempo real y atiende pedidos entrantes.</p>

          {/* Identidad del admin logueado: avatar, nombre, rol. Abre el perfil. */}
          <button
            onClick={openProfile}
            className="mt-3 inline-flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-2xl bg-slate-900/60 border border-slate-700/80 hover:border-teal-500/50 hover:bg-slate-900 transition-all group"
            title="Abrir mi perfil de administrador"
          >
            {adminProfile?.photo ? (
              <img
                src={adminProfile.photo}
                alt={adminProfile.name || 'Admin'}
                className="w-9 h-9 rounded-xl object-cover bg-slate-800 border border-slate-600/60 shrink-0"
              />
            ) : (
              <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-teal-400 text-slate-950 text-sm font-black flex items-center justify-center shrink-0">
                {(adminProfile?.name || 'A').charAt(0).toUpperCase()}
              </span>
            )}
            <span className="text-left min-w-0">
              <span className="block text-xs font-bold text-white truncate max-w-40">
                {adminProfile?.name || (adminPhone ? `Admin ${adminPhone.slice(-4)}` : 'Administrador')}
              </span>
              <span className="block text-[10px] text-slate-400 truncate">
                {isSuperAdmin ? (
                  <span className="inline-flex items-center gap-1 text-amber-300 font-semibold">
                    <Icon name="star" className="w-3 h-3" /> Super Admin
                  </span>
                ) : (
                  adminPhone
                )}
              </span>
            </span>
            <Icon name="chevronRight" className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-400 transition-colors" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={openProfile}
            className="px-3 sm:px-4 py-3 rounded-2xl bg-slate-900/70 border border-slate-700 text-slate-300 font-bold text-sm hover:text-teal-300 hover:border-teal-500/40 transition-all flex items-center justify-center gap-2"
            title="Perfil del administrador y preferencias"
          >
            <Icon name="user" className="w-4 h-4" />
            <span className="hidden sm:inline">Mi Perfil</span>
          </button>
          <button
            onClick={onOpenAddModal}
            className="flex-1 sm:flex-none px-4 sm:px-5 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-bold text-sm hover:from-teal-400 hover:to-cyan-400 shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Icon name="plus" className="w-5 h-5" />
            <span>Nuevo Producto</span>
          </button>
          {window.location.hostname === 'kiosko-247-staging.onrender.com' && (
            <button
              onClick={() => setConfirmRefresh(true)}
              disabled={refreshingDb}
              className="px-3 sm:px-4 py-3 rounded-2xl bg-slate-900/70 border border-slate-700 text-slate-300 font-bold text-sm hover:text-teal-300 hover:border-teal-500/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              title="Copiar datos de producción hacia calidad (reemplaza el contenido actual de calidad)"
            >
              <Icon name="refresh" className="w-4 h-4" />
              <span className="hidden sm:inline">{refreshingDb ? 'Refrescando…' : 'Refrescar datos'}</span>
            </button>
          )}
          <button
            onClick={onLogout}
            className="px-3 sm:px-4 py-3 rounded-2xl bg-slate-900/70 border border-slate-700 text-slate-300 font-bold text-sm hover:text-rose-300 hover:border-rose-500/40 transition-all flex items-center justify-center gap-2"
            title="Cerrar sesión"
          >
            <Icon name="x" className="w-4 h-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
</div>

      {confirmRefresh && (
        <ConfirmActionModal
          title="¿Reemplazar los datos de calidad?"
          message="Se copiará una muestra de producción sobre esta base. Todo lo que cambió en calidad se perderá."
          note="Esta acción no se puede deshacer."
          confirmLabel="Reemplazar"
          onConfirm={() => {
            setConfirmRefresh(false);
            onRefreshDb();
          }}
          onClose={() => setConfirmRefresh(false)}
        />
      )}

      {confirmCancelOrder && (
        <ConfirmActionModal
          title="¿Cancelar este pedido?"
          message="El pedido se marcará como cancelado, se devolverá el stock de sus artículos y el cliente quedará notificado."
          note="Esta acción no se puede deshacer."
          confirmLabel="Cancelar pedido"
          onConfirm={() => {
            const o = confirmCancelOrder;
            setConfirmCancelOrder(null);
            onUpdateOrderStatus(o.id, 'cancelado');
          }}
          onClose={() => setConfirmCancelOrder(null)}
        />
      )}

      {/* Analytics Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="p-3.5 sm:p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-teal-500/20 text-teal-400">
            <Icon name="package" className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium block">Total Productos</span>
            <AnimatedNumber value={products.length} className="text-xl sm:text-2xl font-black text-white tabular-nums" />
          </div>
        </div>

        <div className="p-3.5 sm:p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-amber-500/20 text-amber-400">
            <Icon name="alertTriangle" className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium block">Stock Bajo</span>
            <AnimatedNumber value={lowStockProducts.length} className="text-xl sm:text-2xl font-black text-amber-400 tabular-nums" />
          </div>
        </div>

        <div className="p-3.5 sm:p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-cyan-500/20 text-cyan-400">
            <Icon name="clock" className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium block">Pedidos Activos</span>
            <AnimatedNumber value={pendingOrders.length} className="text-xl sm:text-2xl font-black text-cyan-400 tabular-nums" />
          </div>
        </div>

        <div className="p-3.5 sm:p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-emerald-500/20 text-emerald-400">
            <Icon name="dollarSign" className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium block">Ingresos</span>
            <AnimatedNumber
              value={totalRevenue}
              format={(v) => formatUsd(v)}
              className="text-lg sm:text-2xl font-black text-emerald-400 truncate tabular-nums"
            />
            {rate?.rate > 0 && (
              <span className="hidden sm:block text-[11px] text-slate-400 font-semibold">
                {formatBs(usdToBs(totalRevenue, rate.rate))}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Admin Tabs: scroll horizontal con flechas en desktop (móvil desplaza
          por gesto) */}
      <div className="flex items-center border-b border-slate-800">
        <button
          onClick={() => scrollAdminTabs(-1)}
          aria-label="Anterior pestaña"
          className="hidden md:flex shrink-0 items-center justify-center w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-teal-300 hover:border-teal-500/40 transition-all cursor-pointer"
        >
          <Icon name="chevronLeft" className="w-4 h-4" />
        </button>
        <div
          ref={adminTabsRef}
          className="flex items-center flex-1 gap-4 sm:gap-6 overflow-x-auto tabs-scroll-x -mx-3 sm:mx-0 px-3 sm:px-0"
        >
          {[
            { key: 'inventory', label: 'Inventario', full: 'Inventario de Productos', icon: 'package' },
            { key: 'ventas', label: 'Ventas', full: 'Venta en Mostrador', icon: 'shoppingBag' },
            { key: 'orders', label: `Pedidos (${pendingOrders.length})`, full: `Pedidos en Vivo (${pendingOrders.length})`, icon: 'clock' },
            { key: 'promos', label: 'Promos', full: 'Promos de Tienda', icon: 'sparkles' },
            { key: 'benefited', label: 'Beneficiados', full: 'Clientes Beneficiados', icon: 'users' },
            { key: 'blacklist', label: 'Lista Negra', full: 'Lista Negra (Deudores)', icon: 'alertTriangle' },
            { key: 'abonos', label: `Abonos (${pendingPayments})`, full: `Abonos por Aprobar (${pendingPayments})`, icon: 'wallet' },
            { key: 'tienda', label: 'Tienda', full: 'Ubicación del Comercio', icon: 'store' },
            { key: 'analytics', label: 'Finanzas', full: 'Finanzas & Métricas', icon: 'trendingUp' },
            ...(isSuperAdmin ? [{ key: 'equipo', label: 'Equipo', full: 'Equipo y Sesiones Activas', icon: 'users' }] : [])
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.key === 'benefited' || tab.key === 'blacklist') onLoadCustomers();
                if (tab.key === 'blacklist') onLoadCollections();
                if (tab.key === 'abonos') onLoadPayments();
                if (tab.key === 'equipo') loadEmployees();
                setAdminTab(tab.key);
              }}
              className={`pb-3 sm:pb-4 text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 border-b-2 transition-all whitespace-nowrap shrink-0 ${
                adminTab === tab.key
                  ? 'border-teal-400 text-teal-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon name={tab.icon} className="w-4 h-4" />
              <span className="sm:hidden">{tab.label}</span>
              <span className="hidden sm:inline">{tab.full}</span>
              {tab.key === 'orders' && unviewedCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black leading-none shrink-0">
                  {unviewedCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => scrollAdminTabs(1)}
          aria-label="Siguiente pestaña"
          className="hidden md:flex shrink-0 items-center justify-center w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-teal-300 hover:border-teal-500/40 transition-all cursor-pointer"
        >
          <Icon name="chevronRight" className="w-4 h-4" />
        </button>
      </div>

      {/* Venta en mostrador: el admin escanea o toca productos y registra la
          venta física como pedido pickup entregado y pagado. */}
      {adminTab === 'ventas' && (
        <CounterSalesPanel
          products={products}
          orders={orders}
          onCounterSale={onCounterSale}
          addToast={addToast}
        />
      )}

      {/* Tab 1: Inventory Management */}
      {adminTab === 'inventory' && (
        <div className="space-y-4">
          {/* Reorden de compras al proveedor: lista de productos con stock bajo
              y cantidades sugeridas para reponer, lista para enviar por WhatsApp */}
          {lowStockProducts.length > 0 && (
            <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-slate-900/80 to-slate-900/80 overflow-hidden">
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 shrink-0 self-start sm:self-center">
                  <Icon name="refresh" className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    Reorden al proveedor
                    <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-amber-500/25 text-amber-300">
                      {lowStockProducts.length} por reponer
                    </span>
                  </h4>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {lowStockProducts.slice(0, 6).map((p) => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/80 border border-slate-700/70 text-[10px] font-semibold text-slate-300"
                      >
                        {p.name}
                        <span className="text-amber-400 font-black">x{Math.max(10, Math.ceil(p.stock * 2))}</span>
                      </span>
                    ))}
                    {lowStockProducts.length > 6 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-lg bg-slate-800/80 border border-slate-700/70 text-[10px] font-semibold text-slate-400">
                        +{lowStockProducts.length - 6} más
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">
                    Cantidad sugerida para reponer (mín. 10 un.) según el stock actual.
                  </p>
                </div>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(reorderMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-all text-xs font-bold w-full sm:w-auto"
                >
                  <Icon name="whatsapp" className="w-4 h-4" />
                  Enviar pedido
                </a>
              </div>
            </div>
          )}

          {/* Filtros: búsqueda en tiempo real + categoría + agrupación por marca.
              La barra queda fija al hacer scroll (sticky) para no perder el filtro. */}
          <div className="space-y-3" style={{ position: 'sticky', top: headerHeight, zIndex: 30 }}>
            <div className="flex flex-col sm:flex-row gap-2.5 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-slate-700/80 p-2.5 sm:p-3 shadow-2xl shadow-slate-950/60">
              <div className="relative flex-1">
                <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  value={invSearch}
                  onChange={(e) => setInvSearch(e.target.value)}
                  placeholder="Buscar por nombre, código o marca…"
                  className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-800/70 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/60 transition-all"
                />
                {invSearch && (
                  <button
                    onClick={() => setInvSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                    title="Limpiar búsqueda"
                  >
                    <Icon name="x" className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <button
                  onClick={() => setInvStockFilter((v) => (v === 'todas' ? 'bajo' : v === 'bajo' ? 'agotado' : 'todas'))}
                  className={`shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                    invStockFilter !== 'todas'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                      : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-white'
                  }`}
                  title={
                    invStockFilter === 'bajo'
                      ? 'Mostrando solo productos con stock bajo (≤5)'
                      : invStockFilter === 'agotado'
                      ? 'Mostrando solo productos agotados'
                      : 'Filtrar por stock: bajo / agotados'
                  }
                >
                  <Icon name="layers" className="w-4 h-4 shrink-0" />
                  <span>
                    {invStockFilter === 'todas' ? 'Stock' : invStockFilter === 'bajo' ? 'Solo bajo' : 'Agotados'}
                  </span>
                </button>
                <button
                  onClick={() => setInvSortStock((v) => (v === false ? 'asc' : v === 'asc' ? 'desc' : false))}
                  className={`shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                    invSortStock
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-lg shadow-sky-500/10'
                      : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-white'
                  }`}
                  title="Ordenar por stock (menor primero para reponer)"
                >
                  <Icon name={invSortStock === 'asc' ? 'chevronUp' : invSortStock === 'desc' ? 'chevronDown' : 'list'} className="w-4 h-4 shrink-0" />
                  <span>
                    {invSortStock === 'asc' ? 'Stock ↑' : invSortStock === 'desc' ? 'Stock ↓' : 'Ordenar'}
                  </span>
                </button>
                <button
                  onClick={() => setInvGroupByBrand((v) => !v)}
                  className={`shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                    invGroupByBrand
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-lg shadow-indigo-500/10'
                      : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-white'
                  }`}
                  title="Agrupar la lista por marca"
                >
                  <Icon name="layers" className="w-4 h-4 shrink-0" />
                  <span>{invGroupByBrand ? 'Por marca ✓' : 'Agrupar por marca'}</span>
                </button>
                <button
                  onClick={() => setInvView((v) => (v === 'lista' ? 'recorrido' : 'lista'))}
                  className={`shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                    invView === 'recorrido'
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/40 shadow-lg shadow-teal-500/10'
                      : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-white'
                  }`}
                  title="Alternar entre lista y recorrido estilo tienda"
                >
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
                  <button
                    key={c}
                    onClick={() => setInvCategory(c)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all shrink-0 ${
                      isActive
                        ? c === 'todas'
                          ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-lg shadow-teal-500/20'
                          : `${id.solid} border-transparent shadow-lg`
                        : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-white'
                    }`}
                  >
                    {c === 'todas' ? (
                      <Icon name="layers" className="w-3 h-3" />
                    ) : (
                      <Icon name={id.icon} className="w-3 h-3" />
                    )}
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
              <button
                onClick={clearInvFilters}
                className="text-[11px] font-semibold text-teal-400 hover:text-teal-300"
              >
                Limpiar filtros
              </button>
            </div>
          )}

          {/* Recorrido estilo tienda: góndolas horizontales con las mismas
              acciones del admin (editar / eliminar) en cada producto. */}
          {invView === 'recorrido' && filteredProducts.length > 0 && (
            <div className="space-y-5">
              {(invGroupByBrand
                ? groupedByBrand.map((g) => ({ key: g.brand, label: g.brand, items: g.items }))
                : inventoryProductsByCategory()
              ).map((group) => (
                <div key={group.key}>
                  <div className="flex items-center gap-2 px-1 pb-2">
                    <span className="px-2.5 py-1 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-300 text-[10px] font-black uppercase tracking-wider">
                      {group.label}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {group.items.length} producto{group.items.length !== 1 ? 's' : ''}
                    </span>
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
                                <span
                                  className={`shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-black border ${
                                    isOut
                                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                      : isLow
                                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                  }`}
                                >
                                  {isOut ? 'Agotado' : `${p.stock} un.`}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 truncate">{p.code}</p>
                              <div className="flex items-center justify-between gap-1">
                                <span className="min-w-0 text-[11px] font-extrabold text-teal-400">
                                  {formatUsd(p.price)}
                                  {rate?.rate > 0 && (
                                    <span className="block text-[9px] text-slate-500 font-semibold">
                                      {formatBs(usdToBs(p.price, rate.rate))}
                                    </span>
                                  )}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    onClick={() => onEditProduct(p)}
                                    className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-cyan-400 transition-all"
                                    title="Editar producto"
                                  >
                                    <Icon name="edit" className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => onDeleteProduct(p)}
                                    className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-rose-500/20 text-rose-400 transition-all"
                                    title="Eliminar producto"
                                  >
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

          {/* Mobile: card list (oculta en modo recorrido, que ya muestra góndolas) */}
          {invView === 'lista' && (
          <div className="grid grid-cols-1 gap-3 sm:hidden">
            {invGroupByBrand
              ? groupedByBrand.map((g) => (
                  <div key={g.brand}>
                    <div className="flex items-center gap-2 px-1 pt-1 pb-1.5">
                      <span className="px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-black uppercase tracking-wider">
                        {g.brand}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {g.items.length} producto{g.items.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {g.items.map((p) => renderMobileCard(p))}
                    </div>
                  </div>
                ))
              : filteredProducts.map((p) => renderMobileCard(p))}
          </div>
          )}

          {/* Desktop: table (oculta en modo recorrido) */}
          {invView === 'lista' && (
          <div className="hidden sm:block bg-slate-800/60 border border-slate-700/60 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-700/80 bg-slate-900/60 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <th className="p-4">Producto</th>
                    <th className="p-4">Código</th>
                    <th className="p-4">Categoría</th>
                    <th className="p-4">Precio</th>
                    <th className="p-4">Stock</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 text-sm">
                  {invGroupByBrand
                    ? groupedByBrand.map((g) => (
                        <Fragment key={g.brand}>
                          <tr className="bg-slate-900/80">
                            <td colSpan={6} className="p-2.5 pl-4">
                              <span className="px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-black uppercase tracking-wider">
                                {g.brand}
                              </span>
                              <span className="ml-2 text-[10px] text-slate-500">
                                {g.items.length} producto{g.items.length !== 1 ? 's' : ''}
                              </span>
                            </td>
                          </tr>
                          {g.items.map((p) => renderTableRow(p))}
                        </Fragment>
                      ))
                    : filteredProducts.map((p) => renderTableRow(p))}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </div>
      )}

      {/* Tab 2: Orders */}
      {adminTab === 'orders' && (
        <div className="space-y-4">
          {/* Vista operativa: Activos / Despacho·Caja / Entregas / Historial */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
            {[
              { key: 'mostrador', label: 'Mostrador', icon: 'store' },
              { key: 'lista', label: 'Activos', icon: 'clock' },
              { key: 'despacho', label: 'Despacho / Caja', icon: 'package' },
              { key: 'entregas', label: 'Entregas (ruta)', icon: 'mapPin' },
              { key: 'historial', label: 'Historial', icon: 'list' }
            ].map((v) => (
              <button
                key={v.key}
                onClick={() => {
                  if (v.key === 'lista' && (statusFilter === 'entregado' || statusFilter === 'cancelado')) {
                    setStatusFilter('todos');
                  }
                  setOrdersView(v.key);
                }}
                className={`px-3.5 sm:px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap border transition-all shrink-0 flex items-center gap-1.5 ${
                  ordersView === v.key
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-lg shadow-indigo-500/10'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-white'
                }`}
              >
                <Icon name={v.icon} className="w-4 h-4" />
                {v.label}
                {v.key === 'historial' && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-slate-700/80 text-[10px] font-black leading-none">
                    {finalizedOrders.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {ordersView === 'mostrador' && renderMostrador()}

          {ordersView === 'lista' && (
          <>
          {/* Status Quick Filters (solo estados activos; los finalizados van a Historial) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
            {[
              { key: 'todos', label: 'Todos', count: orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status)).length },
              { key: 'pendiente', label: 'Pendientes', count: orders.filter((o) => o.status === 'pendiente').length },
              { key: 'en_preparacion', label: 'Preparación', count: orders.filter((o) => o.status === 'en_preparacion').length },
              { key: 'listo', label: 'Listos', count: orders.filter((o) => o.status === 'listo').length },
              { key: 'en_camino', label: 'En Camino', count: orders.filter((o) => o.status === 'en_camino').length }
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3.5 sm:px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap border transition-all shrink-0 ${
                  activeStatus === f.key
                    ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-lg shadow-teal-500/20'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-white'
                }`}
              >
                {f.label}
                <span className="ml-1.5 px-1.5 py-0.5 rounded-lg bg-black/20 text-[10px]">{f.count}</span>
              </button>
            ))}
          </div>

          {/* Filtro rápido por producto + alerta de stock + orden por antigüedad */}
          <div className="space-y-2.5">
            {lowStockOrdersCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold">
                <Icon name="alertTriangle" className="w-4 h-4" />
                {lowStockOrdersCount} pedido(s) incluyen productos sin stock suficiente
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0 flex-1">
                <span className="px-2 py-1 rounded-lg bg-slate-800/80 text-slate-500 text-[10px] font-black uppercase tracking-wider shrink-0">
                  Producto
                </span>
                <button
                  onClick={() => setProductFilter(null)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all shrink-0 ${
                    productFilter === null
                      ? 'bg-teal-500 text-slate-950 border-teal-400'
                      : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-white'
                  }`}
                >
                  Todos
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-lg bg-black/20 text-[10px]">{statusFiltered.length}</span>
                </button>
                {productFilterOptions.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProductFilter(productFilter === p.id ? null : p.id)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all shrink-0 ${
                      productFilter === p.id
                        ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-lg shadow-teal-500/20'
                        : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-white'
                    }`}
                    title={p.name}
                  >
                    {p.name.split(' ').slice(0, 3).join(' ')}
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-lg bg-black/20 text-[10px]">{p.count}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setAgeSortOldest((v) => !v)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    ageSortOldest
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-lg shadow-indigo-500/10'
                      : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-white'
                  }`}
                  title="Ordenar por el más antiguo primero (semáforo de espera)"
                >
                  <Icon name="clock" className="w-4 h-4" />
                  {ageSortOldest ? 'Más antiguos primero' : 'Antigüedad'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredOrders.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-500 space-y-2">
                <Icon name="clock" className="w-12 h-12 text-slate-700 mx-auto" />
                <p className="font-bold text-slate-400">No hay pedidos con este estado</p>
              </div>
            ) : (
              filteredOrders.map((order) => renderOrderCard(order))
            )}
          </div>
          </>
          )}

          {/* Vista Despacho / Caja: separa lo que hay que alistar de lo que hay que validar */}
          {ordersView === 'despacho' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-200 flex items-center gap-2">
                    <Icon name="package" className="w-4 h-4 text-cyan-400" />
                    Por alistar
                  </h3>
                  <span className="text-[11px] text-slate-500">{despachoOrders.length} pedido(s)</span>
                </div>
                {despachoOrders.length === 0 ? (
                  <div className="py-10 text-center text-slate-500 space-y-2 bg-slate-800/40 rounded-2xl border border-slate-700/50">
                    <Icon name="checkCircle" className="w-10 h-10 text-slate-700 mx-auto" />
                    <p className="font-bold text-slate-400">Nada por alistar</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {despachoOrders.map((o) => {
                      const sem = semaforoOf(o);
                      const missing = lowStockInOrder(o);
                      const wa = formatPhoneWhatsApp(o.phone);
                      const isPickup = o.type !== 'delivery';
                      const nxt =
                        o.status === 'pendiente'
                          ? 'en_preparacion'
                          : o.status === 'en_preparacion'
                            ? 'listo'
                            : isPickup && o.status === 'listo'
                              ? 'entregado'
                              : null;
                      const nxtLabel =
                        nxt === 'en_preparacion' ? 'Iniciar ▸' : nxt === 'listo' ? 'Marcar listo ✓' : nxt === 'entregado' ? 'Retirado ✓' : null;
                      const nxtTone =
                        nxt === 'en_preparacion'
                          ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25'
                          : nxt === 'listo'
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                            : nxt === 'entregado'
                              ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/25'
                              : 'bg-slate-700/40 border-slate-600 text-slate-300';
                      return (
                        <div key={o.id} className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-bold text-teal-400">{o.id}</span>
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold flex items-center gap-1 ${SEM_TONES[sem.tone]}`}>
                                <Icon name="clock" className="w-3 h-3" />
                                {sem.text}
                              </span>
                              <button
                                onClick={() => openFicha(o)}
                                title="Ver ficha del pedido"
                                className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-700/40 border border-slate-600 text-slate-200 text-[10px] font-bold hover:border-teal-500/50 hover:text-teal-300 transition-all"
                              >
                                <Icon name="eye" className="w-3 h-3" />
                                Ficha
                              </button>
                            </div>
                          </div>
                          <p className="text-sm font-bold text-white">{o.customerName}</p>
                          <p className="text-[11px] text-slate-400 line-clamp-2">
                            {o.items.map((it) => `${it.quantity}x ${it.name}`).join(' · ')}
                          </p>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-teal-400">{formatUsd(o.total)}</span>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                                o.type === 'delivery'
                                  ? 'text-amber-300 border-amber-500/40 bg-amber-500/10'
                                  : 'text-teal-300 border-teal-500/40 bg-teal-500/10'
                              }`}
                            >
                              {o.type === 'delivery' ? (
                                <Icon name="mapPin" className="w-3 h-3" />
                              ) : (
                                <Icon name="store" className="w-3 h-3" />
                              )}
                              {o.type === 'delivery' ? 'Entrega' : 'Retiro'}
                            </span>
                          </div>
                          <OrderStepsTimeline order={o} />
                          {missing.length > 0 && (
                            <p className="text-[11px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-2 py-1.5">
                              ⚠️ Sin stock suficiente: {missing.map((m) => m.name).join(', ')}
                            </p>
                          )}
                          <div className="flex gap-2">
                            {nxt && nxtLabel ? (
                              <button
                                onClick={() => onUpdateOrderStatus(o.id, nxt)}
                                className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${nxtTone}`}
                              >
                                {nxtLabel}
                              </button>
                            ) : (
                              <div className="flex-1 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 text-xs font-bold text-center">
                                {isPickup ? 'Esperando retiro' : 'Pasa a Entregas'}
                              </div>
                            )}
                            {wa && (
                              <a
                                href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hola ${o.customerName}, sobre tu pedido ${o.id} en Kiosko 247`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 inline-flex items-center gap-1 px-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold hover:bg-emerald-500/25 transition-all"
                              >
                                <Icon name="whatsapp" className="w-3.5 h-3.5" /> WA
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-200 flex items-center gap-2">
                    <Icon name="creditCard" className="w-4 h-4 text-amber-400" />
                    Por validar (caja)
                  </h3>
                  <span className="text-[11px] text-slate-500">{cajaOrders.length} pago(s)</span>
                </div>
                {cajaOrders.length === 0 ? (
                  <div className="py-10 text-center text-slate-500 space-y-2 bg-slate-800/40 rounded-2xl border border-slate-700/50">
                    <Icon name="checkCircle" className="w-10 h-10 text-slate-700 mx-auto" />
                    <p className="font-bold text-slate-400">Sin pagos por validar</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {cajaOrders.map((o) => {
                      const wa = formatPhoneWhatsApp(o.phone);
                      return (
                        <div key={o.id} className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-teal-400">{o.id}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                                o.paymentStatus === 'rechazado'
                                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                                  : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                              }`}
                            >
                              {o.paymentStatus === 'rechazado' ? 'Rechazado' : 'En revisión'}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-white">{o.customerName}</p>
                          <p className="text-[11px] text-slate-400">
                            {(o.paymentMethod === 'pago_movil' ? 'Pago Móvil' : 'Transferencia')} · Ref:{' '}
                            <span className="font-mono text-white">{o.paymentReference || '—'}</span>
                          </p>
                          {o.hasProof ? (
                            <button
                              onClick={() => setProofOrder(o)}
                              className="w-full flex items-center gap-2 p-2 rounded-xl bg-slate-900/60 border border-slate-700 hover:border-teal-500/40 transition-all text-left"
                            >
                              <span className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                                <Icon name="image" className="w-4 h-4 text-teal-400" />
                              </span>
                              <span className="text-xs font-bold text-white flex-1">Ver comprobante</span>
                              <Icon name="eye" className="w-4 h-4 text-teal-400" />
                            </button>
                          ) : (
                            <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1.5">
                              Sin comprobante adjunto
                            </p>
                          )}
                          {o.paymentStatus === 'rechazado' && (
                            <p className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-2 py-1.5">
                              El cliente debe subir otro comprobante o pasar el pedido a cuenta.
                            </p>
                          )}
                          <div className="flex gap-2 flex-wrap">
                            {o.paymentStatus === 'pendiente' && (
                              <>
                                <button
                                  onClick={() => onUpdateOrderPayment(o.id, 'confirmado')}
                                  className="flex-1 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition-all"
                                >
                                  Confirmar ✓
                                </button>
                                <button
                                  onClick={() => onUpdateOrderPayment(o.id, 'rechazado')}
                                  className="flex-1 py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold hover:bg-rose-500/25 transition-all"
                                >
                                  Rechazar
                                </button>
                              </>
                            )}
                            {wa && (
                              <a
                                href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hola ${o.customerName}, sobre el pago de tu pedido ${o.id} en Kiosko 247`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 inline-flex items-center gap-1 px-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold hover:bg-emerald-500/25 transition-all"
                              >
                                <Icon name="whatsapp" className="w-3.5 h-3.5" /> WA
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Vista Entregas: ruta del día ordenada por cercanía */}
          {ordersView === 'entregas' && (
            <div className="space-y-4">
              <DeliveriesRouteMap storeLocation={storeLocation} deliveries={activeDeliveries.ordered} />
              {activeDeliveries.ordered.length === 0 && activeDeliveries.withoutCoords.length === 0 ? (
                <div className="py-10 text-center text-slate-500 space-y-2 bg-slate-800/40 rounded-2xl border border-slate-700/50">
                  <Icon name="mapPin" className="w-10 h-10 text-slate-700 mx-auto" />
                  <p className="font-bold text-slate-400">No hay entregas activas</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activeDeliveries.ordered.map((o) => {
                    const wa = formatPhoneWhatsApp(o.phone);
                    const isTracking = courierActive && courierOrderId === o.id;
                    return (
                      <div key={o.id} className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2.5">
                        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                          <span
                            className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${
                              o.status === 'en_camino'
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}
                          >
                            {o.routeNumber}
                          </span>
                          <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-teal-400">{o.id}</span>
                              <span className="text-xs font-bold text-white truncate">{o.customerName}</span>
                              {isTracking && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  GPS en vivo
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 truncate">{o.address}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                            <button
                              onClick={() => openFicha(o)}
                              title="Ver ficha del pedido"
                              className="px-2.5 py-1.5 rounded-xl bg-slate-700/40 border border-slate-600 text-slate-200 text-[11px] font-bold hover:border-teal-500/50 hover:text-teal-300 transition-all inline-flex items-center gap-1"
                            >
                              <Icon name="eye" className="w-3 h-3" /> Ficha
                            </button>
                            {o.lat != null && o.lng != null && (
                              <a
                                href={`https://www.google.com/maps?q=${o.lat},${o.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1.5 rounded-xl bg-sky-500/15 border border-sky-500/40 text-sky-300 text-[11px] font-bold hover:bg-sky-500/25 transition-all inline-flex items-center gap-1"
                              >
                                <Icon name="mapPin" className="w-3 h-3" /> Maps
                              </a>
                            )}
                            {wa && (
                              <a
                                href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hola ${o.customerName}, tu pedido ${o.id} en Kiosko 247 está en camino`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[11px] font-bold hover:bg-emerald-500/25 transition-all inline-flex items-center gap-1"
                              >
                                <Icon name="whatsapp" className="w-3 h-3" /> WA
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Acción principal: ocupa todo el ancho del contenedor del pedido */}
                        {o.status === 'listo' && (
                          <button
                            onClick={() => {
                              onUpdateOrderStatus(o.id, 'en_camino');
                              startCourierTracking(o.id);
                            }}
                            className="w-full py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1.5"
                          >
                            <Icon name="mapPin" className="w-4 h-4" /> Iniciar entrega (rastreo GPS en vivo)
                          </button>
                        )}
                        {o.status === 'en_camino' && (
                          <div className="space-y-2">
                            {isTracking ? (
                              <button
                                onClick={stopCourierTracking}
                                className="w-full py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold hover:bg-rose-500/25 transition-all flex items-center justify-center gap-1.5"
                              >
                                <Icon name="mapPin" className="w-4 h-4" /> Detener rastreo en vivo
                              </button>
                            ) : (
                              <button
                                onClick={() => startCourierTracking(o.id)}
                                className="w-full py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1.5"
                              >
                                <Icon name="mapPin" className="w-4 h-4" /> Compartir GPS en vivo
                              </button>
                            )}
                            <button
                              onClick={() => onUpdateOrderStatus(o.id, 'entregado')}
                              className="w-full py-2.5 rounded-xl bg-sky-500/15 border border-sky-500/40 text-sky-300 text-xs font-bold hover:bg-sky-500/25 transition-all flex items-center justify-center gap-1.5"
                            >
                              <Icon name="check" className="w-4 h-4" /> Marcar entregado
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {activeDeliveries.withoutCoords.length > 0 && (
                    <div className="px-3 py-2 rounded-2xl bg-slate-800/40 border border-slate-700/50 text-[11px] text-slate-400">
                      {activeDeliveries.withoutCoords.length} entrega(s) sin coordenadas (no aparecen en el mapa):{' '}
                      {activeDeliveries.withoutCoords.map((o) => o.id).join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Vista Historial: pedidos finalizados (entregado + cancelado) */}
          {ordersView === 'historial' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                  <span className="text-[10px] sm:text-xs text-slate-400 font-medium block">Finalizados</span>
                  <span className="text-xl sm:text-2xl font-black text-white">{histFiltered.length}</span>
                </div>
                <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                  <span className="text-[10px] sm:text-xs text-slate-400 font-medium block">Entregados</span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-400">{histEntregados.length}</span>
                </div>
                <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                  <span className="text-[10px] sm:text-xs text-slate-400 font-medium block">Cancelados</span>
                  <span className="text-xl sm:text-2xl font-black text-rose-400">{histCancelados.length}</span>
                </div>
                <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                  <span className="text-[10px] sm:text-xs text-slate-400 font-medium block">Ingresos (entregados)</span>
                  <span className="text-lg sm:text-xl font-black text-teal-400 truncate">
                    {formatUsd(histRevenue)}
                    {rate?.rate > 0 && (
                      <span className="hidden sm:block text-[10px] text-slate-400 font-semibold">
                        {formatBs(usdToBs(histRevenue, rate.rate))}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
                  {[
                    { key: 'todos', label: 'Todos', count: finalizedOrders.length },
                    { key: 'entregado', label: 'Entregados', count: finalizedOrders.filter((o) => o.status === 'entregado').length },
                    { key: 'cancelado', label: 'Cancelados', count: finalizedOrders.filter((o) => o.status === 'cancelado').length }
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setHistStatus(f.key)}
                      className={`px-3.5 sm:px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap border transition-all shrink-0 ${
                        histStatus === f.key
                          ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-lg shadow-teal-500/20'
                          : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-white'
                      }`}
                    >
                      {f.label}
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-lg bg-black/20 text-[10px]">{f.count}</span>
                    </button>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0 flex-1">
                    {[
                      { key: 'hoy', label: 'Hoy' },
                      { key: '7d', label: 'Últimos 7 días' },
                      { key: 'todo', label: 'Todo' }
                    ].map((r) => (
                      <button
                        key={r.key}
                        onClick={() => setHistRange(r.key)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all shrink-0 ${
                          histRange === r.key
                            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                            : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-white'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <div className="relative flex-1 sm:max-w-xs">
                    <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      value={histSearch}
                      onChange={(e) => setHistSearch(e.target.value)}
                      placeholder="Buscar por pedido, cliente o teléfono…"
                      className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-slate-900/70 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/60 transition-all"
                    />
                    {histSearch && (
                      <button
                        onClick={() => setHistSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                        title="Limpiar búsqueda"
                      >
                        <Icon name="x" className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {histFiltered.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-2 bg-slate-800/40 rounded-2xl border border-slate-700/50">
                  <Icon name="list" className="w-10 h-10 text-slate-700 mx-auto" />
                  <p className="font-bold text-slate-400">No hay pedidos finalizados con este filtro</p>
                  <button
                    onClick={() => { setHistStatus('todos'); setHistSearch(''); setHistRange('7d'); }}
                    className="text-[11px] font-semibold text-teal-400 hover:text-teal-300"
                  >
                    Limpiar filtros
                  </button>
                </div>
              ) : (
                <>
                  {/* Desktop: tabla */}
                  <div className="hidden sm:block rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-900/40">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-700/80 bg-slate-900/60 text-xs font-bold text-slate-400 uppercase tracking-wider">
                          <th className="p-3">Pedido</th>
                          <th className="p-3">Cliente</th>
                          <th className="p-3">Fecha</th>
                          <th className="p-3">Tipo</th>
                          <th className="p-3">Ítems</th>
                          <th className="p-3">Total</th>
                          <th className="p-3">Estado</th>
                          <th className="p-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50 text-sm">
                        {histFiltered.map((o) => {
                          const st = STATUS_STYLES[o.status] || STATUS_STYLES.entregado;
                          const d = parseOrderDate(o);
                          return (
                            <tr key={o.id} className="hover:bg-slate-700/30 transition-colors">
                              <td className="p-3 font-mono text-xs font-bold text-teal-400">{o.id}</td>
                              <td className="p-3">
                                <p className="font-bold text-slate-100 text-xs">{o.customerName}</p>
                                <p className="text-[11px] text-slate-400">{o.phone}</p>
                              </td>
                              <td className="p-3 text-xs text-slate-400 whitespace-nowrap">
                                {isNaN(d) ? '—' : `${d.toLocaleDateString('es-VE')} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                              </td>
                              <td className="p-3 text-xs text-slate-300">{o.type === 'delivery' ? 'Entrega a domicilio' : 'Retiro por mostrador'}</td>
                              <td className="p-3 text-xs text-slate-400 line-clamp-1 max-w-xs">
                                {o.items.map((it) => `${it.quantity}x ${it.name}`).join(' · ')}
                              </td>
                              <td className="p-3 font-bold text-white text-xs whitespace-nowrap">{formatUsd(o.total)}</td>
                              <td className="p-3">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${st.badge}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                  {({ entregado: 'Entregado', cancelado: 'Cancelado' })[o.status]}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    onClick={() => openFicha(o)}
                                    title="Ver ficha del pedido"
                                    className="p-2 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-300 hover:bg-teal-500/25 transition-all inline-flex items-center gap-1.5 text-[11px] font-bold"
                                  >
                                    <Icon name="eye" className="w-3.5 h-3.5" /> Ficha
                                  </button>
                                  {o.status === 'cancelado' && (
                                    <button
                                      onClick={() => onDeleteOrder(o)}
                                      className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 transition-all inline-flex items-center gap-1.5 text-[11px] font-bold"
                                    >
                                      <Icon name="trash" className="w-3.5 h-3.5" /> Eliminar
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile: cards */}
                  <div className="grid grid-cols-1 gap-3 sm:hidden">
                    {histFiltered.map((o) => {
                      const st = STATUS_STYLES[o.status] || STATUS_STYLES.entregado;
                      const d = parseOrderDate(o);
                      return (
                        <div key={o.id} className={`p-3 rounded-2xl bg-slate-800/60 border ${st.ring} space-y-1.5`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-bold text-teal-400">{o.id}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${st.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                              {({ entregado: 'Entregado', cancelado: 'Cancelado' })[o.status]}
                            </span>
                          </div>
                          <p className="font-bold text-white text-sm">{o.customerName}</p>
                          <p className="text-[11px] text-slate-400">
                            {isNaN(d) ? '—' : `${d.toLocaleDateString('es-VE')} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                            {' · '}{o.type === 'delivery' ? 'Entrega' : 'Retiro'}
                          </p>
                          <p className="text-[11px] text-slate-400 line-clamp-2">
                            {o.items.map((it) => `${it.quantity}x ${it.name}`).join(' · ')}
                          </p>
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <span className="text-sm font-black text-teal-400">{formatUsd(o.total)}</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => openFicha(o)}
                                className="p-2 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-300 hover:bg-teal-500/25 transition-all"
                                title="Ver ficha del pedido"
                              >
                                <Icon name="eye" className="w-3.5 h-3.5" />
                              </button>
                              {o.status === 'cancelado' && (
                                <button
                                  onClick={() => onDeleteOrder(o)}
                                  className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 transition-all"
                                  title="Eliminar pedido"
                                >
                                  <Icon name="trash" className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Promos */}
      {adminTab === 'promos' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Icon name="sparkles" className="w-5 h-5 text-teal-400" />
                Promos de la Tienda
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Estas ofertas se muestran como banner en la vista de clientes. Se guardan en la nube al instante.
              </p>
            </div>
            <button
              onClick={openNewPromo}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-teal-500 text-slate-950 text-sm font-bold hover:bg-teal-400 transition-all shadow-lg shadow-teal-500/20 self-start sm:self-auto"
            >
              <Icon name="plus" className="w-4 h-4" />
              Nueva Promo
            </button>
          </div>

          {promos.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-2 bg-slate-800/40 border border-slate-800 rounded-3xl">
              <Icon name="sparkles" className="w-12 h-12 text-slate-700 mx-auto" />
              <p className="font-bold text-slate-400">No hay promos activas</p>
              <p className="text-xs">Crea tu primera oferta para destacarla en la tienda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {promos.map((promo) => (
                <div
                  key={promo.id}
                  className={`p-4 sm:p-5 rounded-3xl bg-gradient-to-br border shadow-xl flex gap-3 sm:gap-4 items-center ${
                    promo.active
                      ? 'from-teal-500/15 to-slate-800/60 border-teal-500/40'
                      : 'from-slate-800/40 to-slate-800/20 border-slate-700/50 opacity-70'
                  }`}
                >
                  {promo.image ? (
                    <img src={promo.image} alt={promo.title} className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover bg-slate-800 flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <Icon name="sparkles" className="w-6 h-6 text-slate-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-sm sm:text-base truncate">{promo.title}</h4>
                      {!promo.active && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[10px] font-bold">Inactiva</span>
                      )}
                    </div>
                    {promo.subtitle && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{promo.subtitle}</p>}
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEditPromo(promo)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-700 text-xs font-bold text-slate-200 hover:text-white"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => onSavePromos(promos.filter((p) => p.id !== promo.id))}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-bold text-rose-400 hover:bg-rose-500/20"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Notificaciones Push */}
          <div className="p-4 sm:p-6 rounded-3xl bg-slate-800/60 border border-slate-700 space-y-4">
            <div className="flex items-center gap-2">
              <Icon name="bell" className="w-5 h-5 text-teal-400" />
              <div>
                <h4 className="font-bold text-white text-sm">Notificaciones Push</h4>
                <p className="text-[11px] text-slate-400">
                  Envía avisos directos al teléfono de los clientes que activaron las notificaciones.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/30 space-y-2.5">
              <span className="text-xs font-bold text-teal-300 block">Avisos para vos (admin)</span>
              <p className="text-[11px] text-slate-400 leading-snug">
                Recibí un aviso real cuando llegue un pedido nuevo, aunque la app esté cerrada. Se registra este dispositivo con el teléfono del admin ({adminPhone}).
              </p>
              <button
                onClick={() => handleAdminSubscribePush()}
                className="w-full py-2.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs hover:bg-teal-400 transition-all active:scale-95"
              >
                Activar notificaciones en este dispositivo
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2.5">
                <span className="text-xs font-bold text-slate-200 block">Notificación a todos</span>                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="Título (ej: ¡Nuevas promos!)"
                  maxLength={80}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:border-teal-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={broadcastBody}
                  onChange={(e) => setBroadcastBody(e.target.value)}
                  placeholder="Mensaje (ej: Visita la tienda y aprovecha 2x1 esta semana)"
                  maxLength={200}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:border-teal-500 focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => handlePushBroadcast()}
                    disabled={!broadcastTitle.trim()}
                    className="py-2.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs disabled:opacity-50 disabled:pointer-events-none transition-all active:scale-95"
                  >
                    Enviar a todos
                  </button>
                  <button
                    onClick={() => handlePushTest()}
                    className="py-2.5 rounded-xl bg-slate-700 text-slate-200 font-bold text-xs hover:bg-slate-600 transition-all active:scale-95"
                  >
                    Enviar prueba
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2.5">
                <span className="text-xs font-bold text-slate-200 block">Recordatorio de deuda</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={reminderPhone}
                  onChange={(e) => setReminderPhone(e.target.value)}
                  placeholder="Teléfono del cliente (0412 1234567)"
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:border-teal-500 focus:outline-none"
                />
                <button
                  onClick={() => handlePushReminder()}
                  disabled={!reminderPhone.trim()}
                  className="w-full py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs hover:bg-amber-500/30 transition-all disabled:opacity-50 disabled:pointer-events-none active:scale-95"
                >
                  Enviar recordatorio
                </button>
                <p className="text-[10px] text-slate-500">
                  El cliente recibe: "Recordatorio de deuda" con el saldo pendiente.
                </p>
              </div>
            </div>
          </div>

          {/* Promo Editor Modal */}
          {isPromoModalOpen && promoDraft && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
              <div className="w-full sm:max-w-md pt-[max(1.25rem,env(safe-area-inset-top))] p-5 sm:p-6 rounded-t-3xl sm:rounded-3xl glass-strong bg-slate-900 border border-slate-700 shadow-2xl animate-screen-up space-y-4 max-h-[92vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-lg">{promoDraft.id.startsWith('promo-') ? 'Nueva Promo' : 'Editar Promo'}</h4>
                  <button onClick={() => setIsPromoModalOpen(false)} className="text-slate-400 hover:text-white">
                    <Icon name="x" className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Título *</label>
                    <input
                      type="text"
                      value={promoDraft.title}
                      onChange={(e) => setPromoDraft({ ...promoDraft, title: e.target.value })}
                      placeholder="Ej: 2x1 en refrescos"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Subtítulo</label>
                    <input
                      type="text"
                      value={promoDraft.subtitle || ''}
                      onChange={(e) => setPromoDraft({ ...promoDraft, subtitle: e.target.value })}
                      placeholder="Ej: Válido solo por esta semana"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Imagen (URL opcional)</label>
                    <input
                      type="text"
                      value={promoDraft.image || ''}
                      onChange={(e) => setPromoDraft({ ...promoDraft, image: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={promoDraft.active}
                      onChange={(e) => setPromoDraft({ ...promoDraft, active: e.target.checked })}
                      className="w-4 h-4 accent-teal-500"
                    />
                    Promo activa
                  </label>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleSavePromo(promoDraft)}
                    disabled={!promoDraft.title.trim()}
                    className="flex-1 py-3 rounded-2xl bg-teal-500 text-slate-950 font-bold text-sm hover:bg-teal-400 transition-all disabled:opacity-40"
                  >
                    Guardar Promo
                  </button>
                  {promoDraft.id.startsWith('promo-') && (
                    <button
                      onClick={() => handleDeletePromo(promoDraft.id)}
                      className="px-4 py-3 rounded-2xl bg-rose-500/10 text-rose-400 font-bold text-sm border border-rose-500/30 hover:bg-rose-500/20"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Beneficiados */}
      {adminTab === 'benefited' && (
        <div className="p-4 sm:p-8 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-2xl backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-lg font-bold text-white">Clientes Beneficiados</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Los beneficiados pueden enviar pedidos a crédito (sumar a su cuenta).
              </p>
            </div>
            <button
              onClick={onLoadCustomers}
              className="px-3 py-2 rounded-xl bg-slate-700 text-slate-100 text-xs font-bold hover:bg-slate-600 transition-colors"
            >
              Actualizar lista
            </button>
          </div>

          {allCustomers.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No hay clientes registrados aún.</p>
          ) : (
            <div className="grid gap-2">
              {allCustomers.map((c) => (
                <div
                  key={c.phone}
                  className="flex flex-wrap items-center gap-3 p-3 rounded-2xl glass-strong bg-slate-900 border border-slate-700/60"
                >
                  <span
                    className={`p-2 rounded-xl shrink-0 ${
                      c.isBenefited ? 'bg-teal-500/20 text-teal-400' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <Icon name="user" className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-100 truncate">{c.customerName || 'Cliente'}</p>
                    <p className="text-[11px] text-slate-400">{c.phone}</p>
                  </div>
                  {c.isBenefited && (
                    <CreditLimitInput customer={c} onSetCreditLimit={onSetCreditLimit} />
                  )}
                  <button
                    onClick={() => onToggleBenefited(c.phone, !c.isBenefited)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      c.isBenefited
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        : 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 hover:from-teal-400 hover:to-emerald-400'
                    }`}
                  >
                    {c.isBenefited ? 'Revocar beneficio' : 'Dar beneficio'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Lista Negra */}
      {adminTab === 'blacklist' && (
        <BlacklistAdminView
          customers={allCustomers}
          orders={orders}
          rate={rate}
          products={products}
          payments={payments}
          onLoadCustomers={onLoadCustomers}
          onAddToBlacklist={onAddToBlacklist}
          onAddBlacklistDebt={onAddBlacklistDebt}
          collections={collections}
          onUpsertCollection={onUpsertCollection}
          onDeleteCollection={onDeleteCollection}
          headerHeight={headerHeight}
        />
      )}

      {/* Tab: Abonos — pagos a cuenta que los clientes subieron para aprobar */}
      {adminTab === 'abonos' && (
        <PaymentsAdminView
          payments={payments}
          onLoadPayments={onLoadPayments}
          onApprovePayment={onApprovePayment}
          onRejectPayment={onRejectPayment}
        />
      )}

      {/* Tab: Tienda — ubicación fija del comercio */}
      {adminTab === 'tienda' && (
        <div className="p-4 sm:p-8 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-2xl backdrop-blur-md space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Icon name="store" className="w-5 h-5 text-teal-400" />
              Ubicación del Comercio
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Esta es la dirección fija del negocio. Aparece en el rastreo del cliente como punto de origen
              de la entrega. Cualquier administrador puede actualizarla.
            </p>
          </div>

          {storeLocation ? (
            <div className="rounded-2xl glass-strong bg-slate-900 border border-slate-700/60 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="p-2.5 rounded-xl bg-teal-500/20 text-teal-400 shrink-0">
                <Icon name="store" className="w-5 h-5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400">Comercio configurado</p>
                {storeLocation.address && (
                  <p className="text-sm font-bold text-white truncate">{storeLocation.address}</p>
                )}
                <p className="text-[11px] text-slate-500">
                  {Number(storeLocation.lat).toFixed(6)}, {Number(storeLocation.lng).toFixed(6)}
                </p>
              </div>
              <a
                href={`https://www.google.com/maps?q=${Number(storeLocation.lat)},${Number(storeLocation.lng)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl bg-sky-500/15 border border-sky-500/40 text-sky-300 text-xs font-bold hover:bg-sky-500/25 transition-all inline-flex items-center gap-1.5"
              >
                <Icon name="mapPin" className="w-3.5 h-3.5" />
                Abrir en Maps
              </a>
            </div>
          ) : (
            <div className="rounded-2xl glass-strong bg-slate-900 border border-slate-700/60 p-4 text-sm text-slate-400">
              Aún no configuraste la ubicación del comercio. Usa el botón para elegirla en el mapa.
            </div>
          )}

          <button
            onClick={() => setShowStorePicker(true)}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-sm hover:from-teal-400 hover:to-emerald-400 shadow-lg shadow-teal-500/20 transition-all inline-flex items-center gap-2"
          >
            <Icon name="mapPin" className="w-4 h-4" />
            {storeLocation ? 'Cambiar ubicación del comercio' : 'Configurar ubicación'}
          </button>

          {showStorePicker && (
            <MapPickerModal
              title="Ubicación del comercio"
              initial={storeLocation?.lat != null ? { lat: storeLocation.lat, lng: storeLocation.lng } : null}
              onPick={async (p) => {
                const ok = await onSaveStoreLocation(p);
                if (ok) setShowStorePicker(false);
              }}
              onClose={() => setShowStorePicker(false)}
            />
          )}
        </div>
      )}

      {/* Tab 6: Analytics / Finanzas */}
      {adminTab === 'analytics' && (
        <div className="p-4 sm:p-8 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-2xl space-y-5 sm:space-y-6 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Icon name="trendingUp" className="w-5 h-5 text-teal-400" />
                Finanzas en Vivo
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                KPIs del día actualizados con cada pedido · {formatTimestamp()}
              </p>
            </div>
            {lowStockMessage && (
              <a
                href={`https://wa.me/?text=${encodeURIComponent(lowStockMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 transition-all text-xs font-bold w-fit"
              >
                <Icon name="whatsapp" className="w-4 h-4" />
                Alerta de stock bajo
              </a>
            )}
          </div>

          {/* KPIs hero del día */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-teal-500/20 to-emerald-500/10 border border-teal-500/40 shadow-lg shadow-teal-500/10">
              <span className="text-[10px] sm:text-xs text-teal-300 font-semibold block">Ventas Hoy</span>
              <span className="text-2xl sm:text-3xl font-black text-white block mt-1">
                {formatUsd(finDash.today.revenue)}
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                {finDash.revenueDelta >= 0 ? (
                  <span className="text-emerald-400 flex items-center gap-0.5 font-bold"><Icon name="chevronUp" className="w-3 h-3" />{Math.abs(finDash.revenueDelta).toFixed(0)}%</span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-0.5 font-bold"><Icon name="chevronDown" className="w-3 h-3" />{Math.abs(finDash.revenueDelta).toFixed(0)}%</span>
                )}
                vs ayer ({formatUsd(finDash.yesterday.revenue)})
              </span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-700/80">
              <span className="text-[10px] sm:text-xs text-slate-400 font-semibold block">Tickets Hoy</span>
              <span className="text-2xl sm:text-3xl font-black text-white block mt-1">{finDash.today.tickets}</span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                {finDash.ticketsDelta >= 0 ? (
                  <span className="text-emerald-400 flex items-center gap-0.5 font-bold"><Icon name="chevronUp" className="w-3 h-3" />{Math.abs(finDash.ticketsDelta).toFixed(0)}%</span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-0.5 font-bold"><Icon name="chevronDown" className="w-3 h-3" />{Math.abs(finDash.ticketsDelta).toFixed(0)}%</span>
                )}
                vs ayer ({finDash.yesterday.tickets})
              </span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-700/80">
              <span className="text-[10px] sm:text-xs text-slate-400 font-semibold block">Ticket Promedio</span>
              <span className="text-2xl sm:text-3xl font-black text-white block mt-1">
                {finDash.ticketAvg > 0 ? formatUsd(finDash.ticketAvg) : '—'}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">{finDash.today.orders} pedidos entregados</span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-700/80">
              <span className="text-[10px] sm:text-xs text-slate-400 font-semibold block">Fiado Pendiente</span>
              <span className="text-2xl sm:text-3xl font-black text-amber-400 block mt-1">{formatUsd(totalFiado)}</span>
              <span className="text-[10px] text-slate-400 mt-1 block">Deuda activa de clientes</span>
            </div>
          </div>

          {/* Ganancia neta y margen */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-emerald-500/40 space-y-4">
            <div className="flex items-center gap-2">
              <Icon name="dollarSign" className="w-4 h-4 text-emerald-400" />
              <h4 className="font-bold text-slate-200 text-sm">Ganancia Neta de Hoy</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="rounded-xl bg-slate-900/60 border border-slate-700/70 p-3.5">
                <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Ganancia (ventas − costos)</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-300 block mt-1">
                  {formatUsd(finDash.grossProfit)}
                </span>
              </div>
              <div className="rounded-xl bg-slate-900/60 border border-slate-700/70 p-3.5">
                <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Margen bruto</span>
                <span className="text-xl sm:text-2xl font-black text-white block mt-1">
                  {finDash.grossMarginPct.toFixed(0)}%
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">del total vendido</span>
              </div>
              <div className="rounded-xl bg-slate-900/60 border border-slate-700/70 p-3.5">
                <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Costo de mercadería vendida</span>
                <span className="text-xl sm:text-2xl font-black text-amber-300 block mt-1">
                  {formatUsd(finDash.today.cost)}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  {finDash.today.cost > 0 && finDash.today.revenue > 0
                    ? `= ${((finDash.today.cost / finDash.today.revenue) * 100).toFixed(0)}% de las ventas`
                    : 'Define el "Costo" en cada producto'}
                </span>
              </div>
            </div>
          </div>

          {/* Kiosko Operator: resumen de jornada */}
          <div className="rounded-2xl border border-indigo-500/40 bg-gradient-to-br from-indigo-500/15 via-slate-900/80 to-slate-900/80 overflow-hidden">
            <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-300 shrink-0 self-start sm:self-center">
                <Icon name="zap" className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-white text-base flex items-center gap-2">
                  Kiosko Operator
                  <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-indigo-500/25 text-indigo-300">Resumen de jornada</span>
                </h4>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs">
                  <div className="rounded-xl bg-slate-900/60 border border-slate-700/70 p-2.5">
                    <span className="text-slate-400 block text-[9px] font-semibold uppercase tracking-wider">Ventas hoy</span>
                    <span className="text-white font-black">{formatUsd(finDash.today.revenue)}</span>
                  </div>
                  <div className="rounded-xl bg-slate-900/60 border border-slate-700/70 p-2.5">
                    <span className="text-slate-400 block text-[9px] font-semibold uppercase tracking-wider">Tickets</span>
                    <span className="text-white font-black">{finDash.today.tickets}</span>
                  </div>
                  <div className="rounded-xl bg-slate-900/60 border border-slate-700/70 p-2.5">
                    <span className="text-slate-400 block text-[9px] font-semibold uppercase tracking-wider">Entregados</span>
                    <span className="text-white font-black">{finDash.today.orders}</span>
                  </div>
                  <div className="rounded-xl bg-slate-900/60 border border-slate-700/70 p-2.5">
                    <span className="text-slate-400 block text-[9px] font-semibold uppercase tracking-wider">vs ayer</span>
                    <span className={`font-black ${finDash.revenueDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {finDash.revenueDelta >= 0 ? '▲' : '▼'} {Math.abs(finDash.revenueDelta).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(jornadaSummary)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/30 transition-all text-xs font-bold w-full sm:w-auto"
              >
                <Icon name="whatsapp" className="w-4 h-4" />
                Compartir jornada
              </a>
            </div>
          </div>

          {/* Efectivo vs digital */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Icon name="dollarSign" className="w-4 h-4 text-emerald-400" />
                Efectivo vs Digital (hoy)
              </h4>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Efectivo</span>
                    <span className="text-emerald-400 font-bold">{formatUsd(finDash.today.cash)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-700/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-700"
                      style={{ width: `${finDash.today.revenue > 0 ? (finDash.today.cash / finDash.today.revenue) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Digital (pago móvil / transferencia / cartera)</span>
                    <span className="text-sky-400 font-bold">{formatUsd(finDash.today.digital)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-700/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-400 transition-all duration-700"
                      style={{ width: `${finDash.today.revenue > 0 ? (finDash.today.digital / finDash.today.revenue) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                {finDash.today.credit > 0 && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Fiado del día</span>
                      <span className="text-amber-400 font-bold">{formatUsd(finDash.today.credit)}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-700/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-700"
                        style={{ width: `${finDash.today.revenue > 0 ? (finDash.today.credit / finDash.today.revenue) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-slate-500">
                  Histórico total: <span className="text-emerald-400 font-bold">{formatUsd(cashDigitalTotal.cash)}</span> efectivo ·{' '}
                  <span className="text-sky-400 font-bold">{formatUsd(cashDigitalTotal.digital)}</span> digital
                </p>
              </div>
            </div>

            {/* Tendencia de ventas por día */}
            <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Icon name="barChart" className="w-4 h-4 text-teal-400" />
                Ventas por Día (últimos 7 días)
              </h4>
              <div className="flex items-end gap-2 h-36">
                {salesByDay.map((d) => {
                  const max = Math.max(...salesByDay.map((x) => x.revenue), 1);
                  const h = Math.round((d.revenue / max) * 100);
                  const isToday = d.key === toYMD(new Date());
                  return (
                    <div key={d.key} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                      <span className="text-[9px] font-bold text-slate-300 truncate max-w-full">{d.revenue > 0 ? formatUsd(d.revenue) : ''}</span>
                      <div className="w-full flex items-end justify-center h-16">
                        <div
                          className={`w-full rounded-t-lg transition-all duration-700 ${
                            d.revenue > 0
                              ? isToday
                                ? 'bg-gradient-to-t from-teal-500 to-emerald-300 shadow-lg shadow-teal-500/30'
                                : 'bg-gradient-to-t from-teal-700 to-teal-500'
                              : 'bg-slate-700/50'
                          }`}
                          style={{ height: `${Math.max(d.revenue > 0 ? h : 4, 4)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-500 capitalize truncate">{isToday ? 'Hoy' : d.label}</span>
                    </div>
                  );
                })}
              </div>
              {salesByDay.some((d) => d.revenue > 0) && (
                <p className="text-[11px] text-slate-400">
                  Ingresos (entregados) 7 días:{' '}
                  <span className="font-bold text-teal-300">{formatUsd(salesByDay.reduce((a, d) => a + d.revenue, 0))}</span>
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Icon name="package" className="w-4 h-4 text-teal-400" />
                Top Productos de Hoy
              </h4>
              {finDash.topToday.length === 0 ? (
                <p className="text-xs text-slate-400">Aún no hay ventas registradas hoy.</p>
              ) : (
                <ul className="space-y-3">
                  {finDash.topToday.map((p, idx) => (
                    <li key={p.id} className="flex items-center justify-between text-xs gap-2">
                      <span className="text-slate-300 font-medium truncate flex items-center gap-1.5">
                        #{idx + 1} {p.name}
                        {p.marginUnit > 0 && (
                          <span className="text-[9px] font-bold text-emerald-400 shrink-0">+{formatUsd(p.marginUnit)}/un</span>
                        )}
                      </span>
                      <span className="text-teal-400 font-bold shrink-0">{p.quantity} un. · {formatUsd(p.margin)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Icon name="alertTriangle" className="w-4 h-4 text-amber-400" />
                Estado de Stock Crítico
              </h4>
              <ul className="space-y-3">
                {lowStockProducts.length === 0 ? (
                  <p className="text-xs text-emerald-400">¡Excelente! Todo el catálogo cuenta con stock suficiente.</p>
                ) : (
                  lowStockProducts.slice(0, 6).map((p) => (
                    <li key={p.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">{p.name}</span>
                      <span className="text-amber-400 font-bold">{p.stock} un. restantes</span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Segmentación de clientes */}
            <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Icon name="users" className="w-4 h-4 text-indigo-400" />
                Clientes con Mayor Actividad
              </h4>
              {topCustomers.length === 0 ? (
                <p className="text-xs text-slate-400">Aún no hay pedidos registrados.</p>
              ) : (
                <ul className="space-y-3">
                  {topCustomers.map((c, idx) => (
                    <li key={c.phone} className="flex items-center justify-between text-xs gap-2">
                      <span className="text-slate-300 font-medium truncate">
                        #{idx + 1} {c.phone}
                      </span>
                      <span className="text-teal-400 font-bold shrink-0">{c.orders} pedidos</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-slate-500">
                Total clientes registrados: <span className="font-bold text-white">{allCustomers.length}</span>
              </p>
            </div>
          </div>
        </div>
      )}
      {isSuperAdmin && adminTab === 'equipo' && (
        <div className="p-4 sm:p-8 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-2xl space-y-5 sm:space-y-6 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Icon name="users" className="w-5 h-5 text-amber-300" />
            <h3 className="text-lg sm:text-xl font-bold text-white">Equipo y Sesiones Activas</h3>
          </div>

          {/* Sesiones activas */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-700/80 p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Icon name="clock" className="w-4 h-4 text-teal-400" />
                Quién está conectado ahora
              </h4>
              <button
                onClick={loadEmployees}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-xs font-bold text-slate-300 hover:text-teal-300 hover:border-teal-500/40 transition-all"
              >
                <Icon name="refresh" className="w-3.5 h-3.5" />
                Refrescar
              </button>
            </div>
            {loadingEmployees ? (
              <p className="text-xs text-slate-400">Cargando sesiones...</p>
            ) : activeSessions.length === 0 ? (
              <p className="text-xs text-slate-400">No hay sesiones activas de administradores.</p>
            ) : (
              <ul className="space-y-2">
                {activeSessions.map((s, i) => {
                  const isSelf = s.phone === adminPhone;
                  const emp = employees.find((e) => e.phone === s.phone);
                  const displayName = emp?.name || s.name || (s.phone ? `Admin ${s.phone.slice(-4)}` : 'Desconocido');
                  return (
                    <li key={s.id || i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/70 border border-slate-700/70">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isSelf ? 'bg-emerald-400 animate-pulse' : 'bg-teal-400'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white truncate">
                          {displayName}
                          {s.role === 'superadmin' && (
                            <span className="ml-2 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-black align-middle">
                              Super Admin
                            </span>
                          )}
                          {isSelf && (
                            <span className="ml-2 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-black align-middle">
                              Este dispositivo
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {s.phone} · Última actividad {formatRelative(s.lastSeen)}
                        </p>
                      </div>
                      {!isSelf && (
                        <button
                          onClick={() => revokeSession(s.phone)}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-300 text-[10px] sm:text-xs font-bold hover:bg-rose-500/25 transition-all shrink-0"
                        >
                          <Icon name="logOut" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
                          Cerrar sesión
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Gestión de empleados */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-700/80 p-4 sm:p-5 space-y-3">
            <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Icon name="userPlus" className="w-4 h-4 text-teal-400" />
              Administradores del panel
            </h4>
            <p className="text-[11px] text-slate-400">
              Añade o quita teléfonos autorizados para entrar al panel. Los administradores fijos de la configuración
              no pueden quitarse desde aquí.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={newEmployeeName}
                onChange={(e) => setNewEmployeeName(e.target.value)}
                placeholder="Nombre (opcional)"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500/60"
              />
              <input
                value={newEmployeePhone}
                onChange={(e) => setNewEmployeePhone(e.target.value.replace(/[^\d+]/g, ''))}
                placeholder="Teléfono (ej. 04129862577)"
                inputMode="tel"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500/60"
              />
              <button
                onClick={addEmployee}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 text-xs sm:text-sm font-bold hover:from-teal-400 hover:to-cyan-400 transition-all inline-flex items-center justify-center gap-1.5"
              >
                <Icon name="plus" className="w-4 h-4" />
                Añadir
              </button>
            </div>
            {employees.length === 0 ? (
              <p className="text-xs text-slate-400">No hay administradores gestionados por el super admin.</p>
            ) : (
              <ul className="space-y-2">
                {employees.map((e) => {
                  const isSelf = e.phone === adminPhone;
                  const active = activeSessions.some((s) => s.phone === e.phone);
                  return (
                    <li key={e.phone} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/70 border border-slate-700/70">
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${active ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' : 'bg-slate-700 text-slate-400'}`}>
                        {(e.name || e.phone.slice(-2)).toUpperCase().slice(0, 2)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white truncate">
                          {e.name || `Admin ${e.phone.slice(-4)}`}
                          {active && (
                            <span className="ml-2 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-teal-500/20 text-teal-300 font-black align-middle">
                              En línea
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-400">{e.phone}</p>
                      </div>
                      {!isSelf && (
                        <button
                          onClick={() => removeEmployee(e.phone)}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-300 text-[10px] sm:text-xs font-bold hover:bg-rose-500/25 transition-all shrink-0"
                        >
                          <Icon name="trash" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
                          Quitar
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Usuarios en el sistema */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-700/80 p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Icon name="users" className="w-4 h-4 text-amber-300" />
                Usuarios en el sistema
              </h4>
              <button
                onClick={() => { onLoadCustomers(); loadEmployees(); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-xs font-bold text-slate-300 hover:text-teal-300 hover:border-teal-500/40 transition-all"
              >
                <Icon name="refresh" className="w-3.5 h-3.5" />
                Refrescar
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Todos los perfiles de clientes registrados. Un usuario inhabilitado no podrá pasar del login ni hacer pedidos.
            </p>
            <input
              value={usersFilter}
              onChange={(e) => setUsersFilter(e.target.value)}
              placeholder="Buscar por nombre o teléfono"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500/60"
            />
            {allCustomers.length === 0 ? (
              <p className="text-xs text-slate-400">No hay usuarios registrados.</p>
            ) : filteredSystemUsers.length === 0 ? (
              <p className="text-xs text-slate-400">Ningún usuario coincide con la búsqueda.</p>
            ) : (
              <ul className="space-y-2 max-h-[60vh] min-h-24 overflow-y-auto overscroll-contain pr-1">
                {filteredSystemUsers.map((c) => (
                  <li key={c.phone} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/70 border border-slate-700/70">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${c.disabled ? 'bg-slate-700 text-slate-500' : 'bg-teal-500/20 text-teal-300 border border-teal-500/40'}`}>
                      {(c.customerName || c.phone.slice(-2)).toUpperCase().slice(0, 2)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">
                        {c.customerName || `Cliente ${c.phone.slice(-4)}`}
                        {c.disabled && (
                          <span className="ml-2 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 font-black align-middle">
                            Inhabilitado
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-400">{c.phone}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleCustomerDisabled(c)}
                        disabled={usersBusy}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all disabled:opacity-50 shrink-0 ${
                          c.disabled
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                            : 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                        }`}
                      >
                        {c.disabled ? 'Habilitar' : 'Inhabilitar'}
                      </button>
                      <button
                        onClick={() => deleteCustomerAccount(c)}
                        disabled={usersBusy}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-300 text-[10px] font-bold hover:bg-rose-500/25 transition-all disabled:opacity-50 shrink-0"
                        title="Eliminar perfil"
                      >
                        <Icon name="trash" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {overdueList.length === 1 && (
        <OverdueCollectionToast
          collection={overdueList[0]}
          onSend={() => handleSendOverdue(overdueList[0])}
          onDismiss={() => handleDismissOverdue(overdueList[0])}
        />
      )}
      {overdueList.length > 1 && (
        <OverdueCollectionsModal
          collections={overdueList}
          onSend={handleSendOverdue}
          onDismiss={handleDismissOverdue}
        />
      )}

      {proofOrder && (
        <PaymentProofModal
          order={proofOrder}
          onClose={() => setProofOrder(null)}
          onUpdateOrderPayment={onUpdateOrderPayment}
        />
      )}

      {fichaOrder && (
        <div
          className="fixed inset-x-0 bottom-0 z-[70] overflow-hidden animate-fade-in"
          style={{ top: headerHeight }}
          role="dialog"
          aria-label={`Ficha del pedido ${fichaOrder.id}`}
        >
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={closeFicha} />
          <div className="relative h-full flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
            <div ref={fichaSheetRef} className="pointer-events-auto relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden z-10 animate-modal-spring flex flex-col max-h-full">
              {/* Asa de arrastre: indica que la hoja se puede cerrar con swipe */}
              <div className="sm:hidden absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-slate-600/70 pointer-events-none z-20" aria-hidden="true" />
              <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-slate-900/95">
                <div>
                  <h3 className="font-black text-white text-sm flex items-center gap-2">
                    <Icon name="eye" className="w-4 h-4 text-teal-400" />
                    Ficha del pedido
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Diseño original — {fichaOrder.id}</p>
                </div>
                <button
                  onClick={closeFicha}
                  data-no-swipe
                  className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-all shrink-0"
                  aria-label="Cerrar ficha"
                >
                  <Icon name="x" className="w-4 h-4" />
                </button>
              </div>
              <div data-sheet-scroll className="px-4 sm:px-5 pt-2 sm:pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6 overflow-y-auto flex-1 min-h-0">
                <OrderStepsTimeline order={fichaOrder} />
                <div className="mt-4">
                  {renderOrderCard(fichaOrder, { inFicha: true })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Acciones rápidas del pedido (long-press en la tarjeta en Activos) */}
      {quickMenuOrder && (
        <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center pb-[calc(5rem+env(safe-area-inset-bottom))] sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="absolute inset-0" onClick={() => setQuickMenuOrder(null)} />
          <div role="menu" aria-label={`Acciones rápidas del pedido ${quickMenuOrder.id}`} className="relative w-full sm:max-w-xs glass-strong bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl p-4 space-y-2 z-10 animate-modal-spring">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-black px-1 pb-1">
              Pedido {quickMenuOrder.id} · {STATUS_LABELS[quickMenuOrder.status] || quickMenuOrder.status}
            </p>
            {(() => {
              const next = nextOrderStatus(quickMenuOrder);
              if (!next || needsPaymentValidation(quickMenuOrder)) return null;
              const qmBusy = Boolean(busyActions[`st:${quickMenuOrder.id}`]);
              return (
                <button
                  onClick={() => {
                    const n = next;
                    runExclusive(`st:${quickMenuOrder.id}`, async () => {
                      await onUpdateOrderStatus(quickMenuOrder.id, n);
                      setQuickMenuOrder(null);
                    });
                  }}
                  disabled={qmBusy}
                  className="w-full py-3 px-3 rounded-xl bg-teal-500/15 border border-teal-500/40 text-teal-300 font-bold text-sm flex items-center gap-2 hover:bg-teal-500/25 transition-all disabled:opacity-60 disabled:pointer-events-none"
                >
                  <Icon name={qmBusy ? 'refresh' : 'arrowRight'} className={`w-4 h-4 ${qmBusy ? 'animate-spin' : ''}`} />
                  {qmBusy ? 'Procesando…' : `Avanzar a ${STATUS_LABELS[next] || next}`}
                </button>
              );
            })()}
            <button
              onClick={() => {
                const o = quickMenuOrder;
                setQuickMenuOrder(null);
                openFicha(o);
              }}
              className="w-full py-3 px-3 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 font-bold text-sm flex items-center gap-2 hover:bg-slate-700 transition-all"
            >
              <Icon name="eye" className="w-4 h-4" />
              Ver ficha completa
            </button>
            <button
              onClick={() => setQuickMenuOrder(null)}
              data-no-longpress
              className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-400 font-bold text-xs hover:text-white transition-all"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
      {/* Verificación de retiro en mostrador (#11): compara el código con el
          que muestra el cliente antes de marcar entregado */}
      {retiroVerifyOrder && (
        <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center pb-[calc(5rem+env(safe-area-inset-bottom))] sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="absolute inset-0" onClick={() => setRetiroVerifyOrder(null)} />
          <div role="dialog" aria-label={`Verificar retiro del pedido ${retiroVerifyOrder.id}`} className="relative w-full sm:max-w-sm glass-strong bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 z-10 animate-modal-spring text-center">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-black">Retiro en mostrador</p>
            <h3 className="text-base font-bold text-white -mt-2">
              Pedido {retiroVerifyOrder.id} · {retiroVerifyOrder.customerName || 'Cliente'}
            </h3>
            <div className="rounded-2xl border border-teal-500/40 bg-teal-500/10 py-4">
              <p className="font-mono text-4xl font-black tracking-[0.3em] text-white pl-[0.3em]">
                {pickupCodeOf(retiroVerifyOrder.id)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1.5 px-4">
                Verificá que coincida con el código que muestra el cliente en su app
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => setRetiroVerifyOrder(null)}
                data-no-swipe
                className="py-3 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 transition-all"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  const id = retiroVerifyOrder.id;
                  runExclusive(`st:${id}`, async () => {
                    await onUpdateOrderStatus(id, 'entregado');
                    setRetiroVerifyOrder(null);
                  });
                }}
                disabled={Boolean(busyActions[`st:${retiroVerifyOrder.id}`])}
                className="py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-all disabled:opacity-70 disabled:pointer-events-none"
              >
                {busyActions[`st:${retiroVerifyOrder.id}`]
                  ? <><Icon name="refresh" className="w-3.5 h-3.5 animate-spin" /> Procesando…</>
                  : <><Icon name="checkCircle" className="w-3.5 h-3.5" /> Dar como entregado</>}
              </button>
            </div>
          </div>
        </div>
      )}
      {showAdminProfile && (
        <AdminProfileModal
          phone={adminPhone}
          role={adminRole}
          profile={adminProfile}
          onClose={() => setShowAdminProfile(false)}
          onChangePassword={onChangePassword}
          onSaveProfile={onSaveAdminProfile}
          adminPrefs={adminPrefs}
          onSavePrefs={saveAdminPrefs}
          theme={theme}
          onSetTheme={onSetTheme}
          rate={rate}
        />
      )}
    </div>
  );
}

// Modal para que el admin revise el comprobante de pago a pantalla completa
// y confirme o rechace el pago digital. El comprobante no viaja en el estado
// público: se descarga bajo demanda por el dueño del pedido o el admin.
function PaymentProofModal({ order, onClose, onUpdateOrderPayment }) {
  useOverlay(true, onClose);
  const [proof, setProof] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.getOrderProof(order.id, order.phone);
        if (active) {
          setProof(res.ok ? res.data?.proof : null);
          setLoading(false);
        }
      } catch {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [order.id, order.phone]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md glass-strong bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden z-10 animate-modal-spring">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-black text-white">
              Comprobante #{order.id}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {({ pago_movil: 'Pago Móvil', transferencia: 'Transferencia' })[order.paymentMethod] || 'Pago digital'} ·{' '}
              {order.customerName}
              {order.paymentReference ? ` · Ref ${order.paymentReference}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          {loading ? (
            <div className="w-full h-48 flex items-center justify-center bg-slate-800/60 rounded-2xl border border-slate-700">
              <Icon name="refresh" className="w-6 h-6 text-teal-400 animate-spin" />
            </div>
          ) : proof ? (
            <img
              src={proof}
              alt="Comprobante de pago"
              className="w-full rounded-2xl border border-slate-700 object-contain max-h-[55vh]"
            />
          ) : (
            <p className="text-xs text-slate-400 bg-slate-800/60 p-4 rounded-2xl text-center">
              Este pedido no tiene comprobante adjunto.
            </p>
          )}
          {order.paymentStatus === 'pendiente' && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onUpdateOrderPayment(order.id, 'confirmado')}
                className="py-3 rounded-xl text-xs font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1.5"
              >
                <Icon name="check" className="w-4 h-4" />
                Confirmar pago
              </button>
              <button
                onClick={() => onUpdateOrderPayment(order.id, 'rechazado')}
                className="py-3 rounded-xl text-xs font-bold bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/25 transition-all flex items-center justify-center gap-1.5"
              >
                <Icon name="x" className="w-4 h-4" />
                Rechazar pago
              </button>
            </div>
          )}
          {order.paymentStatus === 'confirmado' && (
            <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl text-center font-bold">
              Pago confirmado
            </p>
          )}
          {order.paymentStatus === 'rechazado' && (
            <div className="space-y-2">
              <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl text-center font-bold">
                Pago rechazado
              </p>
              <p className="text-[11px] text-slate-400 text-center">
                El cliente verá la opción de subir otro comprobante o pasar el pedido
                a cuenta (si es beneficiado).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Perfil visual del admin: nombre, foto, teléfono y rol. Incluye cambio de
// contraseña y preferencias personales (tema) que se guardan por admin.
function AdminProfilePanel({ phone, role, profile, onClose, onChangePassword, onSaveProfile, adminPrefs, onSavePrefs, theme, onSetTheme }) {
  const [name, setName] = useState(profile?.name || '');
  const [photo, setPhoto] = useState(profile?.photo || '');
  const [saving, setSaving] = useState(false);

  // Cambio de contraseña
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwDone, setPwDone] = useState(false);

  const fileInputRef = useRef(null);

  const pickPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImage(file, 800, 0.8)
      .then(setPhoto)
      .catch(() => {});
  };

  const saveProfile = async () => {
    if (saving) return;
    setSaving(true);
    await onSaveProfile({ name: name.trim(), photo });
    setSaving(false);
  };

  const submitPassword = async () => {
    setPwError('');
    setPwDone(false);
    if (!currentPassword) { setPwError('Ingresa tu contraseña actual.'); return; }
    if (newPassword.length < 4) { setPwError('La nueva contraseña debe tener al menos 4 caracteres.'); return; }
    if (newPassword !== confirmPassword) { setPwError('La confirmación no coincide con la nueva contraseña.'); return; }
    if (changingPassword) return;
    setChangingPassword(true);
    const ok = await onChangePassword(currentPassword, newPassword);
    setChangingPassword(false);
    if (ok) {
      setPwDone(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const applyPrefsTheme = (t) => {
    onSetTheme(t);
    onSavePrefs({ theme: t });
  };

  const THEME_OPTIONS = [
    { key: 'dark', label: 'Oscuro', icon: 'moon', desc: 'El clásico para la noche' },
    { key: 'light', label: 'Claro', icon: 'sun', desc: 'Ideal para el día' },
    { key: 'neon', label: 'Neón', icon: 'zap', desc: 'Brillante y llamativo' }
  ];

  return (
    <>
      <div className="pt-[max(1rem,env(safe-area-inset-top))] p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Icon name="user" className="w-5 h-5 text-teal-400" />
              Mi Perfil de Administrador
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Personaliza tu identidad, cambia tu contraseña y ajusta tus preferencias.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Datos del perfil */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-700/80 p-4 space-y-3">
            <div className="flex items-center gap-4">
              {photo ? (
                <img
                  src={photo}
                  alt={name || 'Admin'}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-teal-500/50"
                />
              ) : (
                <span className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-teal-400 text-slate-950 text-xl font-black flex items-center justify-center">
                  {(name || 'A').charAt(0).toUpperCase()}
                </span>
              )}
              <div className="space-y-2 flex-1">
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={pickPhoto}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-slate-200 text-xs font-bold hover:border-teal-500/50 hover:text-teal-300 transition-all inline-flex items-center justify-center gap-1.5"
                >
                  <Icon name="image" className="w-3.5 h-3.5" />
                  {photo ? 'Cambiar foto' : 'Subir foto'}
                </button>
                {photo && (
                  <button
                    onClick={() => setPhoto('')}
                    className="w-full px-3 py-1.5 rounded-xl text-rose-300 text-[11px] font-bold hover:bg-rose-500/10 transition-all"
                  >
                    Quitar foto
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">Nombre visible</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre (ej: María)"
                maxLength={80}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500/60"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">Teléfono</label>
                <p className="px-3.5 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60 text-sm text-slate-300 font-bold truncate">
                  {phone}
                </p>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">Rol</label>
                <p className="px-3.5 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60 text-sm font-bold truncate flex items-center gap-1.5">
                  {role === 'superadmin' ? (
                    <>
                      <Icon name="star" className="w-4 h-4 text-amber-300" />
                      <span className="text-amber-300">Super Admin</span>
                    </>
                  ) : (
                    <span className="text-teal-300">Administrador</span>
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={saveProfile}
              disabled={saving}
              className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-bold text-sm hover:from-teal-400 hover:to-cyan-400 transition-all disabled:opacity-60 active:scale-[0.99]"
            >
              {saving ? 'Guardando…' : 'Guardar perfil'}
            </button>
          </div>

          {/* Preferencias por admin */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-700/80 p-4 space-y-3">
            <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Icon name="settings" className="w-4 h-4 text-teal-400" />
              Mis preferencias
            </h4>
            <p className="text-[11px] text-slate-400">
              El tema que eliges aquí solo se aplica cuando tú entras al panel; no cambia el tema de los clientes.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => applyPrefsTheme(t.key)}
                  className={`p-3 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1.5 transition-all ${
                    (adminPrefs?.theme || theme) === t.key
                      ? 'bg-teal-500/15 border-teal-500/50 text-teal-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-teal-500/40'
                  }`}
                >
                  <Icon name={t.icon} className="w-4 h-4" />
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500">{THEME_OPTIONS.find((t) => t.key === (adminPrefs?.theme || theme))?.desc}</p>
          </div>

          {/* Cambio de contraseña */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-700/80 p-4 space-y-3">
            <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Icon name="lock" className="w-4 h-4 text-teal-400" />
              Cambiar contraseña
            </h4>
            {pwDone ? (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/40 p-3 text-center space-y-2">
                <p className="text-xs text-emerald-300 font-bold">¡Contraseña actualizada!</p>
                <button
                  onClick={() => setPwDone(false)}
                  className="text-[11px] text-teal-300 font-bold hover:underline"
                >
                  Cambiarla de nuevo
                </button>
              </div>
            ) : (
              <>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Contraseña actual"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500/60"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nueva contraseña (mín. 4 caracteres)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500/60"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la nueva contraseña"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500/60"
                />
                {pwError && (
                  <p className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5">
                    {pwError}
                  </p>
                )}
                <button
                  onClick={submitPassword}
                  disabled={changingPassword}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-slate-200 font-bold text-sm hover:border-teal-500/50 hover:text-teal-300 transition-all disabled:opacity-60 active:scale-[0.99]"
                >
                  {changingPassword ? 'Actualizando…' : 'Actualizar contraseña'}
                </button>
              </>
            )}
          </div>
        </div>
    </>
  );
}

// Modal clásico de perfil (escritorio / pantallas grandes).
function AdminProfileModal({ onClose, ...rest }) {
  useOverlay(true, onClose);
  return (
    <div className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg glass-strong bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 max-h-[92vh] flex flex-col overflow-hidden animate-modal-spring">
        <AdminProfilePanel onClose={onClose} {...rest} />
      </div>
    </div>
  );
}

// Vista completa "Mi perfil administrador" (móvil): en vez de modal, cambia
// la vista de la app entera. Se abre desde la barra inferior de opciones.
function AdminProfileView({ onBack, ...rest }) {
  return (
    <div className="fixed inset-0 z-[70] bg-slate-950 flex flex-col">
      <AdminProfilePanel onClose={onBack} {...rest} />
    </div>
  );
}

// Chat interno de un pedido para el admin: consulta y envía mensajes con el
// cliente (el cliente responde desde el rastreo del pedido). Se actualiza cada 5s.
function OrderChat({ order }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const load = async () => {
    const res = await api.getOrderMessages(order.id, order.phone);
    if (res.ok && Array.isArray(res.data.messages)) setMessages(res.data.messages);
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [order.id]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const send = async (valueOverride) => {
    const value = String(valueOverride ?? text).trim();
    if (!value || sending) return;
    setSending(true);
    const res = await api.sendOrderMessage(order.id, order.phone, value);
    setSending(false);
    if (res.ok) {
      setText('');
      load();
    }
  };

  const TEMPLATES = [
    { label: 'Listo 👍', text: (n, id) => `Hola ${n}, tu pedido ${id} está listo para retirar en Kiosko 24/7. ¡Te esperamos! 😊` },
    { label: 'En camino 🛵', text: (n, id) => `Hola ${n}, tu pedido ${id} ya va en camino. ¡Pronto llega! 🙌` },
    { label: 'Llegó el repartidor 📦', text: (n, id) => `Hola ${n}, el repartidor llegó con tu pedido ${id}. ¡Que lo disfrutes! 🎉` },
    { label: 'En preparación', text: (n, id) => `Hola ${n}, estamos preparando tu pedido ${id}. Cualquier cambio te avisamos ✋` },
    { label: 'Confirmar pago', text: (n, id) => `Hola ${n}, sobre el pago de tu pedido ${id}. ¿Necesitas ayuda? 🙏` }
  ];

  return (
    <div className="rounded-2xl bg-slate-900/60 border border-slate-700 overflow-hidden">
      <div className="p-2.5 border-b border-slate-700/70 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
          <Icon name="whatsapp" className="w-3.5 h-3.5 text-emerald-400" />
          Chat con el cliente
        </span>
        <span className="text-[9px] text-slate-500">se actualiza solo</span>
      </div>
      <div ref={listRef} className="p-2.5 space-y-2 max-h-44 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-[11px] text-slate-500 text-center py-2">Sin mensajes aún.</p>
        )}
        {messages.map((m, idx) => (
          <ChatBubble key={m.id || idx} m={m} order={order} perspective="admin" />
        ))}
      </div>
      <div className="px-2.5 pt-2.5 flex flex-wrap gap-1.5">
        {TEMPLATES.map((t) => (
          <button
            key={t.label}
            onClick={() => send(t.text(order.customerName, order.id))}
            disabled={sending}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 text-[10px] font-bold hover:bg-emerald-500/20 transition-all disabled:opacity-50 active:scale-95"
            title="Envía la plantilla al cliente en 1 tap"
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-2.5 border-t border-slate-700/70 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
          placeholder="Responder al cliente…"
          maxLength={300}
          className="flex-1 min-w-0 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:border-teal-500 focus:outline-none"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="shrink-0 px-3 py-2 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs disabled:opacity-50 disabled:pointer-events-none transition-all active:scale-95"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}

const BEAUTY_CATEGORIES = ['higiene', 'limpieza', 'perfum', 'cosmetic', 'belleza', 'farmacia', 'salud', 'cuidado'];
// Toast persistente de cobro vencido. No se quita solo; el admin debe pulsar
// "Enviar cobro" (abre WhatsApp) o "✕" (descartar en esta sesión).
function OverdueCollectionToast({ collection, onSend, onDismiss }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-xl border border-amber-500/40 bg-slate-900/95 p-4 shadow-2xl backdrop-blur">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-400">Cobro programado vencido</p>
        <p className="mt-1 text-sm text-slate-200">
          Envío de cobro programado para <span className="font-bold text-white">{collection.customerName || collection.phone}</span>
        </p>
      </div>
      <button
        onClick={onSend}
        className="shrink-0 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-400"
      >
        Enviar cobro
      </button>
      <button
        onClick={onDismiss}
        aria-label="Descartar"
        className="shrink-0 rounded-lg bg-slate-700 px-2 py-2 text-xs font-bold text-slate-200 hover:bg-slate-600"
      >
        ✕
      </button>
    </div>
  );
}

// Modal con todos los cobros vencidos. El admin los envía uno a uno; al
// enviar uno se quita de la lista. Si lo descarta, se oculta en esta sesión.
function OverdueCollectionsModal({ collections, onSend, onDismiss }) {
  useOverlay(true, onDismiss);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-800 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-100">Cobros programados vencidos</h3>
            <p className="text-xs text-slate-400">Envía cada uno a WhatsApp manualmente.</p>
          </div>
        </div>
        <ul className="max-h-[60vh] divide-y divide-slate-800 overflow-y-auto">
          {collections.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-200">{c.customerName || c.phone}</p>
                <p className="text-xs text-slate-400">{c.id}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => onSend(c)}
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-400"
                >
                  Enviar cobro
                </button>
                <button
                  onClick={() => onDismiss(c)}
                  aria-label="Descartar"
                  className="rounded-lg bg-slate-700 px-2 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-600"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function BlacklistAdminView({
  customers,
  orders,
  rate,
  products,
  payments,
  onLoadCustomers,
  onAddToBlacklist,
  onAddBlacklistDebt,
  collections,
  onUpsertCollection,
  onDeleteCollection,
  headerHeight = 0
}) {
  const [selectedDebtor, setSelectedDebtor] = useState(null); // customer abierto
  const [isAddProductsOpen, setIsAddProductsOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isAddAmountOpen, setIsAddAmountOpen] = useState(false);
  const [clearDebtTarget, setClearDebtTarget] = useState(null);

  const debtors = customers.filter((c) => (Number(c.balance) || 0) > 0);

  const handleAddDebt = async ({ phone: targetPhone, name: targetName, items, description: targetDescription }) => {
    const ok = await onAddBlacklistDebt({ phone: targetPhone, name: targetName, items, description: targetDescription });
    if (ok) {
      setIsAddProductsOpen(false);
      setIsAddAmountOpen(false);
      setIsRegisterOpen(false);
      setSelectedDebtor(null);
    }
  };

  const handleClearDebt = (customer) => {
    setClearDebtTarget(customer);
  };

  return (
    <div className="p-4 sm:p-8 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-2xl backdrop-blur-md space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">Lista Negra · Deudores</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Clientes con saldo pendiente. Toca un deudor para ver el desglose, enviar la cuenta por WhatsApp o programar el cobro.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsRegisterOpen(true)}
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-red-500 to-amber-500 text-slate-950 text-xs font-bold hover:from-red-400 hover:to-amber-400 shadow-lg shadow-red-500/20 transition-colors flex items-center gap-1.5"
          >
            <Icon name="plus" className="w-4 h-4" />
            Registrar
          </button>
          <button
            onClick={onLoadCustomers}
            className="px-3 py-2 rounded-xl bg-slate-700 text-slate-100 text-xs font-bold hover:bg-slate-600 transition-colors"
          >
            Actualizar lista
          </button>
        </div>
      </div>

      {debtors.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">No hay deudores registrados.</p>
      ) : (
        <div className="grid gap-2">
          {debtors.map((c) => (
            <div
              key={c.phone}
              className="flex items-center gap-3 p-3 rounded-2xl glass-strong bg-slate-900 border border-slate-700/60 hover:border-amber-500/40 cursor-pointer transition-all"
              onClick={() => setSelectedDebtor(c)}
            >
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                <Icon name="alertTriangle" className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-100 truncate">{c.customerName || 'Cliente'}</p>
                <p className="text-[11px] text-slate-400">{c.phone}</p>
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                <span className="block text-base font-black text-red-400">
                  {formatUsd(Number(c.balance) || 0)}
                </span>
                <span className="text-[10px] text-amber-400/80 flex items-center gap-0.5">
                  <Icon name="chevronRight" className="w-3 h-3" />
                  Ver detalle
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de detalle de deuda */}
      {selectedDebtor &&
        createPortal(
          <DebtDetailModal
            customer={selectedDebtor}
            orders={orders}
            rate={rate}
            onClose={() => setSelectedDebtor(null)}
            onClearDebt={handleClearDebt}
            collections={collections}
            onUpsertCollection={onUpsertCollection}
            onDeleteCollection={onDeleteCollection}
            headerHeight={headerHeight}
            payments={payments}
          />,
          document.body
        )}

      {/* Modal para añadir productos a la deuda de un cliente */}
      {isAddProductsOpen &&
        createPortal(
          <AddDebtProductsModal
            products={products}
            rate={rate}
            customers={customers}
            onClose={() => setIsAddProductsOpen(false)}
            onConfirm={handleAddDebt}
            headerHeight={headerHeight}
          />,
          document.body
        )}

      {/* Modal de elección de registro (productos o monto) */}
      {isRegisterOpen &&
        createPortal(
          <div
            className="fixed inset-x-0 bottom-0 z-[70] overflow-hidden animate-fade-in"
            style={{ top: headerHeight }}
          >
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsRegisterOpen(false)} />
            <div className="relative h-full flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
              <div className="pointer-events-auto relative w-full sm:max-w-md glass-strong bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-modal-spring max-h-full flex flex-col">
                <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Icon name="plus" className="w-5 h-5 text-amber-400" />
                      Registrar deuda
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Elige cómo quieres cargar la deuda del cliente.
                    </p>
                  </div>
                  <button onClick={() => setIsRegisterOpen(false)} className="p-2 text-slate-400 hover:text-white rounded-xl">
                    <Icon name="x" className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-4 sm:p-6 space-y-3 overflow-y-auto flex-1 min-h-0">
                  <button
                    onClick={() => {
                      setIsRegisterOpen(false);
                      setIsAddProductsOpen(true);
                    }}
                    className="w-full p-4 rounded-2xl bg-slate-800/80 border border-slate-700 hover:border-teal-500/50 text-left transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="p-2.5 rounded-xl bg-teal-500/15 text-teal-300 shrink-0">
                        <Icon name="package" className="w-5 h-5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-100">Añadir productos</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Elige productos del catálogo que el cliente debe (ventas presenciales o deudas viejas).
                        </p>
                      </div>
                      <Icon name="chevronRight" className="w-4 h-4 text-slate-500 shrink-0" />
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setIsRegisterOpen(false);
                      setIsAddAmountOpen(true);
                    }}
                    className="w-full p-4 rounded-2xl bg-slate-800/80 border border-slate-700 hover:border-amber-500/50 text-left transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="p-2.5 rounded-xl bg-amber-500/15 text-amber-300 shrink-0">
                        <Icon name="wallet" className="w-5 h-5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-100">Registrar monto</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Carga una deuda directa en dólares con teléfono, nombre y motivo.
                        </p>
                      </div>
                      <Icon name="chevronRight" className="w-4 h-4 text-slate-500 shrink-0" />
                    </div>
                  </button>
                  <button
                    onClick={() => setIsRegisterOpen(false)}
                    className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-bold hover:bg-slate-700 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Modal para registrar una deuda por monto directo (teléfono, nombre, monto, motivo) */}
      {isAddAmountOpen &&
        createPortal(
          <AddDebtAmountModal
            customers={customers}
            rate={rate}
            onClose={() => setIsAddAmountOpen(false)}
            onConfirm={handleAddDebt}
            headerHeight={headerHeight}
          />,
          document.body
        )}

      {clearDebtTarget && (
        <ConfirmActionModal
          title={`¿Saldar deuda de ${clearDebtTarget.customerName || clearDebtTarget.phone}?`}
          message={`${clearDebtTarget.customerName || 'Cliente'} debe ${formatUsd(Number(clearDebtTarget.balance) || 0)}. Al saldar, el saldo queda en cero.`}
          note="Esta acción no se puede deshacer."
          confirmLabel="Saldar"
          icon="checkCircle"
          tone="danger"
          onConfirm={() => {
            onAddToBlacklist(clearDebtTarget.phone.replace(/\D/g, ''), clearDebtTarget.customerName, '0');
            setClearDebtTarget(null);
          }}
          onClose={() => setClearDebtTarget(null)}
        />
      )}
    </div>
  );
}

// Modal que permite registrar una deuda por productos (ventas presenciales o
// deudas anteriores a la app). Muestra el catálogo actual y deja elegir
// cantidades; al confirmar crea un pedido a crédito entregado para el cliente.
function AddDebtProductsModal({ products, rate, customers, onClose, onConfirm, headerHeight = 0 }) {
  useOverlay(true, onClose);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [category, setCategory] = useState('Todas');
  const [search, setSearch] = useState('');
  const [qty, setQty] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const categories = ['Todas', ...new Set((products || []).map((p) => p.category).filter(Boolean))];

  const filtered = (products || []).filter((p) => {
    if (category !== 'Todas' && p.category !== category) return false;
    if (search && !`${p.name} ${p.brand || ''} ${p.code || ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selectedItems = (products || [])
    .filter((p) => Number(qty[p.id]) > 0)
    .map((p) => ({ id: p.id, name: p.name, price: p.price, quantity: Number(qty[p.id]) }));
  const total = selectedItems.reduce((acc, it) => acc + Number(it.price || 0) * it.quantity, 0);

  const changeQty = (id, delta) => {
    setQty((prev) => {
      const next = Math.max(0, (Number(prev[id]) || 0) + delta);
      return { ...prev, [id]: next };
    });
  };

  const pickCustomer = (phone) => {
    const c = (customers || []).find((x) => normalizePhoneDigits(x.phone) === normalizePhoneDigits(phone));
    setCustomerPhone(phone);
    if (c) setCustomerName(c.customerName || '');
  };

  const handleConfirm = async () => {
    const key = customerPhone.replace(/\D/g, '').slice(-11);
    if (key.length < 7) {
      setError('Ingresa el número de teléfono del deudor');
      return;
    }
    if (selectedItems.length === 0) {
      setError('Selecciona al menos un producto');
      return;
    }
    setError('');
    setSubmitting(true);
    await onConfirm({ phone: key, name: customerName, items: selectedItems });
    setSubmitting(false);
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] overflow-hidden animate-fade-in"
      style={{ top: headerHeight }}
    >
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative h-full flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
      <div className="pointer-events-auto relative w-full sm:max-w-2xl glass-strong bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-screen-up max-h-full flex flex-col">
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Icon name="package" className="w-5 h-5 text-amber-400" />
              Añadir productos a la deuda
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Selecciona el cliente y los productos que debe (ventas presenciales o deudas viejas).
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Deudor (cliente registrado)</label>
              <select
                value=""
                onChange={(e) => e.target.value && pickCustomer(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none"
              >
                <option value="">— Seleccionar deudor existente —</option>
                {(customers || []).map((c) => (
                  <option key={c.phone} value={c.phone}>
                    {c.customerName || 'Cliente'} · {c.phone} · {formatUsd(Number(c.balance) || 0)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Teléfono *</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={customerPhone}
                  onChange={(e) => pickCustomer(e.target.value)}
                  placeholder="0414 1234567"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nombre del deudor"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Filtros del catálogo */}
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto…"
              className="flex-1 min-w-[180px] px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Catálogo con cantidades */}
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No hay productos en el catálogo.</p>
            ) : (
              filtered.map((p) => {
                const n = Number(qty[p.id]) || 0;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${n > 0 ? 'bg-amber-500/10 border-amber-500/40' : 'bg-slate-950 border-slate-800'}`}
                  >
                    <ProductImg
                      product={p}
                      alt={p.name}
                      className="w-11 h-11 rounded-lg object-cover bg-slate-900 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-100 truncate">{p.name}</p>
                      <p className="text-[11px] text-teal-400 font-semibold">
                        {formatUsd(p.price)}
                        {rate?.rate > 0 && (
                          <span className="block text-[10px] text-slate-500">{formatBs(usdToBs(p.price, rate.rate))}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700 shrink-0">
                      <button
                        onClick={() => changeQty(p.id, -1)}
                        className="p-1 rounded text-slate-400 hover:text-white"
                      >
                        <Icon name="minus" className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold w-6 text-center text-white">{n}</span>
                      <button
                        onClick={() => changeQty(p.id, 1)}
                        className="p-1 rounded text-slate-400 hover:text-white"
                      >
                        <Icon name="plus" className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Pie */}
        <div className="p-4 sm:p-6 border-t border-slate-800 shrink-0">
          {error && (
            <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 mb-3">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                Total a cargar a la deuda
              </span>
              <span className="text-lg font-black text-amber-400">
                {formatUsd(total)}
                {rate?.rate > 0 && (
                  <span className="block text-[10px] text-slate-500">{formatBs(usdToBs(total, rate.rate))}</span>
                )}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-bold hover:bg-slate-700 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-amber-500 text-slate-950 text-sm font-bold hover:from-red-400 hover:to-amber-400 shadow-lg shadow-red-500/20 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5"
              >
                <Icon name="check" className="w-4 h-4" />
                {submitting ? 'Guardando…' : 'Añadir a la deuda'}
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

// Modal para registrar una deuda por monto directo en USD (teléfono, nombre,
// monto y motivo). Al confirmar crea un pedido a crédito entregado con un
// único ítem "Deuda manual" y la descripción como nota del pedido.
function AddDebtAmountModal({ customers, rate, onClose, onConfirm, headerHeight = 0 }) {
  useOverlay(true, onClose);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAmount, setCustomerAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const pickCustomer = (phone) => {
    const c = (customers || []).find((x) => normalizePhoneDigits(x.phone) === normalizePhoneDigits(phone));
    setCustomerPhone(phone);
    if (c) setCustomerName(c.customerName || '');
  };

  const handleConfirm = async () => {
    const key = customerPhone.replace(/\D/g, '').slice(-11);
    if (key.length < 7) {
      setError('Ingresa el número de teléfono del deudor');
      return;
    }
    const monto = parseAmount(customerAmount);
    if (!monto || monto <= 0) {
      setError('Ingresa un monto de deuda válido');
      return;
    }
    setError('');
    setSubmitting(true);
    await onConfirm({
      phone: key,
      name: customerName,
      items: [{ name: description ? `Deuda manual · ${description}` : 'Deuda manual', price: monto, quantity: 1 }],
      description
    });
    setSubmitting(false);
  };

  const totalBs = usdToBs(parseAmount(customerAmount) || 0, rate?.rate || 0);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] overflow-hidden animate-fade-in"
      style={{ top: headerHeight }}
    >
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative h-full flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
      <div className="pointer-events-auto relative w-full sm:max-w-md glass-strong bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-screen-up max-h-full flex flex-col">
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Icon name="wallet" className="w-5 h-5 text-amber-400" />
              Registrar monto de la deuda
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Carga una deuda directa en dólares con su motivo.
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Deudor (cliente registrado)</label>
              <select
                value=""
                onChange={(e) => e.target.value && pickCustomer(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-amber-500 focus:outline-none"
              >
                <option value="">— Seleccionar deudor existente —</option>
                {(customers || []).map((c) => (
                  <option key={c.phone} value={c.phone}>
                    {c.customerName || 'Cliente'} · {c.phone} · {formatUsd(Number(c.balance) || 0)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Teléfono *</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={customerPhone}
                  onChange={(e) => pickCustomer(e.target.value)}
                  placeholder="0414 1234567"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nombre del deudor"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Deuda (USD) *</label>
            <input
              type="text"
              inputMode="decimal"
              value={customerAmount}
              onChange={(e) => setCustomerAmount(formatAmountBsInput(e.target.value))}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none"
            />
            {rate?.rate > 0 && totalBs > 0 && (
              <span className="block text-[11px] text-slate-500 mt-1">
                ≈ {formatBs(totalBs)}
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Descripción del motivo</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej.: Compra a crédito no registrada, préstamo, saldo de la semana…"
              rows={2}
              maxLength={300}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none resize-none"
            />
            <span className="block text-[10px] text-slate-600 text-right">{description.length}/300</span>
          </div>
        </div>

        {/* Pie */}
        <div className="p-4 sm:p-6 border-t border-slate-800 shrink-0">
          {error && (
            <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 mb-3">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                Total a cargar
              </span>
              <span className="text-lg font-black text-amber-400">
                {formatUsd(parseAmount(customerAmount) || 0)}
                {rate?.rate > 0 && (
                  <span className="block text-[10px] text-slate-500">{formatBs(totalBs)}</span>
                )}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-bold hover:bg-slate-700 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-amber-500 text-slate-950 text-sm font-bold hover:from-red-400 hover:to-amber-400 shadow-lg shadow-red-500/20 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5"
              >
                <Icon name="check" className="w-4 h-4" />
                {submitting ? 'Guardando…' : 'Registrar deuda'}
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

// Desglosa los pedidos de un deudor y ofrece enviar la cuenta por WhatsApp
// o programar el cobro (cuenta + fecha) para envío automático.
function DebtDetailModal({
  customer,
  orders,
  rate,
  onClose,
  onClearDebt,
  collections,
  onUpsertCollection,
  onDeleteCollection,
  payments,
  headerHeight = 0
}) {
  useOverlay(true, onClose);
  const [showScheduler, setShowScheduler] = useState(false);
  const [confirmSaldar, setConfirmSaldar] = useState(false);

  const key = normalizePhoneDigits(customer.phone);
  // Pedidos del cliente que han sido entregados y a crédito = deuda contraída.
  const debtOrders = (orders || [])
    .filter((o) => normalizePhoneDigits(o.phone) === key && o.credit && o.status === 'entregado')
    .sort((a, b) => new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp));
  const debtTotal = debtOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);

  // Historial de pagos/abonos de este cliente (de admin PaymentsAdminView o lista global)
  // Se obtiene de los pagos aprobados/rechazados que coincidan con el teléfono.
  // Nota: los pagos no vienen en el estado público; se cargan aparte si se necesita.
  // Aquí usamos los pagos que vienen de props si existen (ver BlacklistAdminView).
  const clientPayments = (payments || []).filter((p) => normalizePhoneDigits(p.phone) === key);
  // Separa: depósitos a cartera (pagos aprobados cuando el cliente ya tenía saldo a favor
  // o el monto supera la deuda pendiente) vs abonos a deuda.
  // Heurística simple: pagos aprobados con amountUsd > 0. El tipo real se ve en el detalle.
  const approvedPayments = clientPayments.filter((p) => p.status === 'aprobado');
  const pendingPayments = clientPayments.filter((p) => p.status === 'pendiente');
  const rejectedPayments = clientPayments.filter((p) => p.status === 'rechazado');

  // Estado de cuenta cronológico: combina deudas (pedidos a crédito entregados,
  // +monto) y abonos aprobados (-monto) en una sola línea de tiempo ordenada por
  // fecha, con el saldo acumulado de cada movimiento. Los movimientos sin fecha
  // (deuda manual sin createdAt) se consideran los más antiguos.
  const movements = [
    ...debtOrders.map((o) => ({
      id: `ORD-${o.id}`,
      kind: 'deuda',
      date: new Date(o.createdAt || o.timestamp || 0),
      label: `Pedido ${o.id}`,
      detail: Array.isArray(o.items) ? o.items.map((it) => `${it.quantity}x ${it.name}`).join(', ') : '',
      amount: Number(o.total) || 0
    })),
    ...approvedPayments.map((p) => ({
      id: `PAG-${p.id}`,
      kind: 'abono',
      date: new Date(p.decidedAt || p.createdAt || 0),
      label: `Abono ${p.id}`,
      detail: p.reference ? `Ref: ${p.reference}` : `Bs ${formatBs(Number(p.amountBs))}`,
      amount: -(Number(p.amountUsd) || 0)
    }))
  ].sort((a, b) => a.date - b.date || a.label.localeCompare(b.label));
  let runningBalance = 0;
  const timeline = movements.map((m) => {
    runningBalance += m.amount;
    return { ...m, balance: runningBalance };
  });

  const wa = formatPhoneWhatsApp(customer.phone);

  const accountMsg = buildAccountMessage(customer, orders);
  const waLink = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(accountMsg)}` : undefined;

  const upcoming = collections
    .filter((c) => normalizePhoneDigits(c.phone) === key && (c.status === 'programado' || c.status === 'pendiente'))
    .sort((a, b) => new Date(a.dueAt || 0) - new Date(b.dueAt || 0));

  const overdue = futureCollectionDue(upcoming);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] overflow-hidden animate-fade-in"
      style={{ top: headerHeight }}
    >
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative h-full flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
      <div className="pointer-events-auto relative w-full sm:max-w-lg glass-strong bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-screen-up max-h-full flex flex-col">
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Icon name="alertTriangle" className="w-5 h-5 text-amber-400" />
              {customer.customerName || 'Cliente'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{customer.phone} · Deuda total {formatUsd(Number(customer.balance) || 0)}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Acciones principales */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={waLink ? undefined : (e) => e.preventDefault()}
              className="py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1.5 text-center"
            >
              <Icon name="whatsapp" className="w-4 h-4" />
              Enviar cuenta a WhatsApp
            </a>
            <button
              onClick={() => setShowScheduler((v) => !v)}
              className="py-3 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-bold hover:bg-cyan-500/25 transition-all flex items-center justify-center gap-1.5"
            >
              <Icon name="clock" className="w-4 h-4" />
              {showScheduler ? 'Cerrar cobro' : 'Programar cobro'}
            </button>
          </div>

          {/* Programador de cobro */}
          {showScheduler && (
            <CollectionScheduler
              customer={customer}
              orders={orders}
              collections={upcoming}
              onUpsertCollection={onUpsertCollection}
              onDeleteCollection={onDeleteCollection}
            />
          )}

          {/* Desglose de deuda */}
          <div className="space-y-2">
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider flex items-center justify-between">
              <span>Desglose de la deuda ({debtOrders.length} pedidos)</span>
              <span className="text-red-400 font-black text-sm">{formatUsd(debtTotal)}</span>
            </span>
            {debtOrders.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-900/50 p-3 rounded-xl">
                Este deudor no tiene pedidos a crédito entregados registrados en el historial; la deuda se cargó manualmente.
              </p>
            ) : (
              debtOrders.map((o) => (
                <div key={o.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-cyan-400">{o.id}</span>
                    <span className="text-slate-500">{new Date(o.createdAt || o.timestamp).toLocaleDateString('es-VE')}</span>
                  </div>
                  {Array.isArray(o.items) ? o.items.map((it, i) => (
                    <div key={i} className="flex justify-between text-xs text-slate-300">
                      <span>{it.quantity}x {it.name}</span>
                      <span className="font-bold text-white">
                        {formatUsd(it.price * it.quantity)}
                        {rate?.rate > 0 && (
                          <span className="block text-[10px] text-slate-500 text-right">
                            {formatBs(usdToBs(it.price * it.quantity, rate.rate))}
                          </span>
                        )}
                      </span>
                    </div>
                  )) : null}
                  {o.notes && o.notes !== 'Deuda registrada manualmente' && (
                    <p className="text-[10px] text-slate-500 italic truncate">{o.notes}</p>
                  )}
                  <div className="pt-1.5 border-t border-slate-800 flex justify-between font-bold text-xs">
                    <span className="text-slate-400">Total</span>
                    <span className="text-amber-400 text-right">
                      {formatUsd(o.total)}
                      {rate?.rate > 0 && (
                        <span className="block text-[10px] text-slate-500">{formatBs(usdToBs(o.total, rate.rate))}</span>
                      )}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Estado de cuenta cronológico (deudas y abonos mezclados) */}
          {timeline.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                Estado de cuenta ({timeline.length} movimientos)
              </span>
              <div className="space-y-0">
                {timeline.map((m, idx) => (
                  <div key={m.id} className="relative flex gap-3 pb-3">
                    {idx < timeline.length - 1 && (
                      <span className="absolute left-[7px] top-4 bottom-0 w-px bg-slate-700/60" />
                    )}
                    <div className="flex flex-col items-center shrink-0">
                      <span
                        className={`w-[15px] h-[15px] rounded-full border-2 flex items-center justify-center ${
                          m.kind === 'deuda'
                            ? 'bg-red-500/20 border-red-500/60'
                            : 'bg-emerald-500/20 border-emerald-500/60'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${m.kind === 'deuda' ? 'bg-red-400' : 'bg-emerald-400'}`} />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 bg-slate-900/70 border border-slate-800 rounded-xl px-3 py-2">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className={`font-mono font-bold ${m.kind === 'deuda' ? 'text-red-400' : 'text-emerald-300'}`}>
                          {m.kind === 'deuda' ? '+' : '−'}{formatUsd(Math.abs(m.amount))}
                        </span>
                        <span className="text-slate-500">
                          {m.date.getTime() ? m.date.toLocaleDateString('es-VE') : 'Sin fecha'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-200 mt-0.5">{m.label}</p>
                      {m.detail && <p className="text-[10px] text-slate-500 truncate">{m.detail}</p>}
                      <p className={`text-[10px] font-bold mt-1 ${m.balance > 0 ? 'text-red-300' : m.balance < 0 ? 'text-emerald-300' : 'text-slate-400'}`}>
                        Saldo: {formatUsd(m.balance)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historial de pagos y depósitos de este cliente (agrupado) */}
          {(approvedPayments.length > 0 || pendingPayments.length > 0 || rejectedPayments.length > 0) && (
            <div className="border-t border-slate-800 pt-4 space-y-4">
              <div className="flex items-center gap-2">
                <Icon name="wallet" className="w-4 h-4 text-teal-400" />
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Historial de pagos ({clientPayments.length})
                </span>
              </div>
              <div className="grid gap-3">
                {approvedPayments.length > 0 && (
                  <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-emerald-300 font-bold flex items-center gap-1">
                        <Icon name="check" className="w-3.5 h-3.5" />
                        Abonos aprobados ({approvedPayments.length})
                      </span>
                      <span className="text-emerald-300 font-black">
                        {formatUsd(approvedPayments.reduce((s, p) => s + Number(p.amountUsd || 0), 0))}
                      </span>
                    </div>
                    {approvedPayments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-[11px] py-1">
                        <span className="text-slate-300">{new Date(p.createdAt).toLocaleDateString('es-VE')}</span>
                        <span className="font-bold text-teal-300">
                          {formatUsd(p.amountUsd)} ({formatBs(Number(p.amountBs))})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {pendingPayments.length > 0 && (
                  <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-amber-300 font-bold flex items-center gap-1">
                        <Icon name="clock" className="w-3.5 h-3.5" />
                        Por verificar ({pendingPayments.length})
                      </span>
                      <span className="text-amber-300 font-black">
                        {formatUsd(pendingPayments.reduce((s, p) => s + Number(p.amountUsd || 0), 0))}
                      </span>
                    </div>
                    {pendingPayments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-[11px] py-1">
                        <span className="text-slate-400">{new Date(p.createdAt).toLocaleDateString('es-VE')}</span>
                        <span className="font-bold text-amber-300">
                          {formatUsd(p.amountUsd)} ({formatBs(Number(p.amountBs))})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {rejectedPayments.length > 0 && (
                  <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-rose-300 font-bold flex items-center gap-1">
                        <Icon name="x" className="w-3.5 h-3.5" />
                        Rechazados ({rejectedPayments.length})
                      </span>
                    </div>
                    {rejectedPayments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-[11px] py-1">
                        <span className="text-slate-500">{new Date(p.createdAt).toLocaleDateString('es-VE')}</span>
                        <span className="font-bold text-rose-300">
                          {formatUsd(p.amountUsd)} ({formatBs(Number(p.amountBs))})
                          {p.note && <span className="block text-[10px] text-slate-500">Nota: {p.note}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="p-4 sm:p-6 border-t border-slate-800 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              {overdue > 0 ? `${overdue} cobro(s) vencido(s)` : 'Sin cobros programados pendientes'}
            </span>
            <button
              onClick={() => setConfirmSaldar(true)}
              className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition-all"
            >
              Saldar deuda
            </button>
          </div>
        </div>
      </div>
      </div>

      {confirmSaldar && (
        <ConfirmActionModal
          title={`¿Saldar deuda de ${customer.customerName || customer.phone}?`}
          message={`${customer.customerName || 'Cliente'} debe ${formatUsd(Number(customer.balance) || 0)}. Al saldar, el saldo queda en cero.`}
          note="Esta acción no se puede deshacer."
          confirmLabel="Saldar"
          icon="checkCircle"
          tone="danger"
          onConfirm={() => {
            setConfirmSaldar(false);
            onClearDebt(customer);
            onClose();
          }}
          onClose={() => setConfirmSaldar(false)}
        />
      )}
    </div>
  );
}

// Modal que el cliente ve en "Mi Cuenta": desglose de su deuda con conversión
// a bolívares según la tasa del día.
function CustomerDebtModal({ customer, orders, rate, onClose, addToast, mode = 'deuda', headerHeight = 0 }) {
  useOverlay(true, onClose);
  // Swipe hacia abajo para cerrar (solo móvil / bottom sheet).
  const sheetRef = useSwipeToClose(onClose);
  const key = normalizePhoneDigits(customer.phone);
  const debtOrders = (orders || [])
    .filter((o) => normalizePhoneDigits(o.phone) === key && o.credit && o.status === 'entregado')
    .sort((a, b) => new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp));
  // El balance del cliente es la fuente autoritativa (lo actualiza el servidor al
  // pasar un pedido a entregado o al saldar la deuda). balance < 0 = saldo a favor.
  const balance = Number(customer.balance) || 0;
  const hasWallet = balance < 0;
  // Solo hay saldo "disponible" cuando el cliente tiene saldo a favor (balance < 0).
  const walletAmount = hasWallet ? Math.abs(balance) : 0;
  const debtTotal = hasWallet ? 0 : balance;
  // 'saldo' = solo muestra el saldo disponible y el historial de abonos/descuentos.
  // 'deuda' = muestra el desglose de la deuda y permite abonar.
  const isSaldoView = mode === 'saldo';

  // Formulario de abono: monto en Bs + referencia + comprobante. El servidor lo
  // convierte a USD con la tasa del día y queda pendiente de aprobación.
  const [showAbono, setShowAbono] = useState(false);
  const [amountBs, setAmountBs] = useState('');
  const [reference, setReference] = useState('');
  const [proof, setProof] = useState(null);
  const [sending, setSending] = useState(false);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    let active = true;
    api
      .listPayments(key)
      .then((res) => {
        if (active && res.ok && Array.isArray(res.data)) setPayments(res.data);
      });
    return () => {
      active = false;
    };
  }, [key]);

  // Estado de cuenta (extracto mensual): un pedido a crédito deja saldo negativo
  // (deuda, rojo) y un abono aprobado deja saldo positivo (a favor, verde). El
  // saldo inicial del mes es el punto de partida del desglose.
  const approvedPayments = (payments || []).filter((p) => p.status === 'aprobado');
  const nowD = new Date();
  const monthStart = new Date(nowD.getFullYear(), nowD.getMonth(), 1);
  const rawMovements = [
    ...debtOrders.map((o) => ({
      id: `ORD-${o.id}`,
      kind: 'deuda',
      date: new Date(o.createdAt || o.timestamp || 0),
      label: `Pedido ${o.id}`,
      detail: Array.isArray(o.items) ? o.items.map((it) => `${it.quantity}x ${it.name}`).join(', ') : '',
      amount: -(Number(o.total) || 0)
    })),
    ...approvedPayments.map((p) => ({
      id: `PAG-${p.id}`,
      kind: 'abono',
      date: new Date(p.decidedAt || p.createdAt || 0),
      label: `Abono ${p.id}`,
      detail: p.reference ? `Ref: ${p.reference}` : `Bs ${formatBs(Number(p.amountBs))}`,
      amount: Number(p.amountUsd) || 0
    }))
  ];
  // Saldo actual en convención de extracto: deuda = negativo, saldo a favor = positivo.
  const currentSaldo = -balance;
  const monthMovements = rawMovements
    .filter((m) => m.date >= monthStart)
    .sort((a, b) => a.date - b.date || a.label.localeCompare(b.label));
  const sumMonth = monthMovements.reduce((acc, m) => acc + m.amount, 0);
  const saldoInicialMes = currentSaldo - sumMonth;
  let customerRunning = saldoInicialMes;
  const customerTimeline = monthMovements.map((m) => {
    customerRunning += m.amount;
    return { ...m, balance: customerRunning };
  });
  const monthName = monthStart.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });

  // Fiado Digital: el admin parametriza un tope por cliente beneficiado. Si no
  // lo definió (creditLimit null/0) el cliente fiado NO tiene límite.
  const fiadoTope = useMemo(() => {
    const adminLimit = Number(customer?.creditLimit);
    return Number.isFinite(adminLimit) && adminLimit > 0 ? adminLimit : null;
  }, [customer?.creditLimit]);
  const fiadoUso = fiadoTope ? Math.min(100, (Math.abs(balance) / fiadoTope) * 100) : 0;

  // Abono rápido 1-toque: rellena el monto en Bs (según el % del total a pagar).
  const quickAbono = (pct) => {
    if (!(rate?.rate > 0) || !(balance > 0)) return;
    const montoUsd = (balance * pct) / 100;
    const montoBs = montoUsd * Number(rate.rate);
    setAmountBs(formatAmountBsInput(montoBs.toFixed(2).replace('.', ',')));
    setShowAbono(true);
    addToast(`Monto listo: abonar ${pct}% (${formatUsd(montoUsd)})`, 'success');
  };

  const handleAbono = async (e) => {
    e.preventDefault();
    if (sending) return;
    const monto = parseAmount(amountBs);
    if (!(monto > 0)) {
      addToast('Indica cuánto abonaste en bolívares', 'error');
      return;
    }
    if (!proof) {
      addToast('Adjunta el comprobante del abono', 'error');
      return;
    }
    // Garantía anti-doble-envío de pagos: un solo submit concurrente por
    // cliente aunque el estado tarde en refrescarse.
    return withInflightGuard(`pago:${key}`, async () => {
    setSending(true);
    try {
      const res = await api.createPayment({
        phone: key,
        customerName: customer.customerName || 'Cliente',
        amountBs: monto,
        reference,
        proof
      });
      if (!res.ok) {
        addToast(res.data?.error || 'No se pudo enviar el abono', 'error');
        return;
      }
      addToast('Abono enviado. El kiosko lo verificará y lo aplicará a tu cuenta.', 'success');
      setAmountBs('');
      setReference('');
      setProof(null);
      setShowAbono(false);
      const list = await api.listPayments(key);
      if (list.ok && Array.isArray(list.data)) setPayments(list.data);
    } catch {
      addToast('No se pudo enviar el abono. Intenta de nuevo.', 'error');
    } finally {
      setSending(false);
    }
    });
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] overflow-hidden animate-fade-in"
      style={{ top: headerHeight }}
    >
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative h-full flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div ref={sheetRef} className="pointer-events-auto relative w-full sm:max-w-lg glass-strong bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-screen-up max-h-full flex flex-col">
        {/* Asa de arrastre (móvil): la hoja se cierra deslizando hacia abajo */}
        <div className="sm:hidden absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-slate-600/70 pointer-events-none z-20" aria-hidden="true" />
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Icon name={isSaldoView ? 'wallet' : 'creditCard'} className={`w-5 h-5 ${isSaldoView ? 'text-emerald-400' : 'text-indigo-400'}`} />
              {isSaldoView ? 'Mi saldo' : hasWallet ? 'Mi Cartera' : 'Mi deuda'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {customer.customerName || customer.phone} ·{' '}
              {isSaldoView ? (
                walletAmount > 0 ? (
                  <span className="text-emerald-400 font-bold">Saldo disponible {formatUsd(walletAmount)}</span>
                ) : balance > 0 ? (
                  <span className="text-rose-400 font-bold">Saldo pendiente por pagar {formatUsd(balance)}</span>
                ) : (
                  <span className="text-slate-400 font-bold">Sin saldo a favor</span>
                )
              ) : hasWallet ? (
                <span className="text-emerald-400 font-bold">Saldo a favor {formatUsd(walletAmount)}</span>
              ) : (
                <>Total {formatUsd(debtTotal)}</>
              )}
              {rate?.rate > 0 && (
                <span className="block text-[10px] text-slate-500">
                  {formatBs(usdToBs(isSaldoView ? (walletAmount > 0 ? walletAmount : balance) : hasWallet ? walletAmount : debtTotal, rate.rate))} a Bs {Number(rate.rate).toFixed(2)}
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div data-sheet-scroll className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          {isSaldoView ? (
            <div className="space-y-3">
              {walletAmount > 0 ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                  <span className="text-[11px] uppercase tracking-wider text-emerald-400/80 font-semibold">Disponible para usar</span>
                  <div className="flex items-end justify-between mt-1">
                    <span className="font-display text-3xl font-black tracking-tight text-emerald-400">{formatUsd(walletAmount)}</span>
                    {rate?.rate > 0 && (
                      <span className="text-[10px] text-emerald-400/70">{formatBs(usdToBs(walletAmount, rate.rate))}</span>
                    )}
                  </div>
                  <p className="text-xs text-emerald-200/80 mt-2 flex items-start gap-1.5">
                    <Icon name="check" className="w-4 h-4 mt-0.5 shrink-0" />
                    Al pagar tu próximo pedido elige <b>Mi Cartera</b> como método de pago para usarlo.
                  </p>
                </div>
              ) : balance > 0 ? (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/40 text-rose-300">
                  <span className="text-[11px] uppercase tracking-wider text-rose-400/80 font-semibold">Saldo pendiente por pagar</span>
                  <div className="flex items-end justify-between mt-1">
                    <span className="font-display text-3xl font-black tracking-tight text-rose-400">{formatUsd(balance)}</span>
                    {rate?.rate > 0 && (
                      <span className="text-[10px] text-rose-400/70">{formatBs(usdToBs(balance, rate.rate))}</span>
                    )}
                  </div>
                  <p className="text-xs text-rose-200/80 mt-2 flex items-start gap-1.5">
                    <Icon name="alertTriangle" className="w-4 h-4 mt-0.5 shrink-0" />
                    Tienes pedidos a cuenta por pagar. Puedes abonar desde <b>Mi deuda</b> para descontar este saldo.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-700">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Saldo disponible</span>
                  <div className="font-display text-3xl font-black tracking-tight text-slate-500 mt-1">{formatUsd(0)}</div>
                  <p className="text-xs text-slate-400 mt-2">
                    Sin saldo a favor por el momento.
                  </p>
                </div>
              )}
              {/* Formulario de depósito a cartera */}
              {showAbono && (
                <form onSubmit={handleAbono} className="space-y-2.5 rounded-2xl bg-slate-950 border border-slate-700 p-4 animate-fade-in">
                  <span className="text-xs text-slate-300 font-bold flex items-center gap-1.5">
                    <Icon name="wallet" className="w-4 h-4 text-teal-400" />
                    Depositar en mi cartera
                  </span>
                  {rate?.rate > 0 && (
                    <p className="text-[10px] text-slate-500">
                      Tasa del día: Bs {Number(rate.rate).toFixed(2)} ·{' '}
                      {amountBs && Number(parseAmount(amountBs)) > 0
                        ? <>equivale a <b className="text-teal-300">{formatUsd(parseAmount(amountBs) / rate.rate)}</b></>
                        : 'se convierte sola al enviar'}
                    </p>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Monto a depositar en bolívares *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amountBs}
                      onChange={(e) => setAmountBs(formatAmountBsInput(e.target.value))}
                      placeholder="Ej: 1.500,00"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Número de referencia / comprobante</label>
                    <input
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Ej: 12H3456789"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Foto del comprobante *</label>
                    <label className="w-full flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/60 cursor-pointer hover:border-teal-500/50 transition-all text-center">
                      {proof ? (
                        <>
                          <img src={proof} alt="Comprobante del abono" className="max-h-32 rounded-lg object-contain" />
                          <span className="text-[11px] text-teal-300 font-semibold flex items-center gap-1">
                            <Icon name="check" className="w-3.5 h-3.5" />
                            Adjunto — toca para cambiarlo
                          </span>
                        </>
                      ) : (
                        <>
                          <Icon name="upload" className="w-6 h-6 text-slate-500" />
                          <span className="text-xs text-slate-400">Toca para tomar una foto o subir el comprobante</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files && e.target.files[0];
                          if (!file) return;
                          if (file.size > 8 * 1024 * 1024) {
                            addToast('La imagen supera 8 MB. Elige una más liviana.', 'error');
                            e.target.value = '';
                            return;
                          }
                          try {
                            const compressed = await compressImage(file);
                            setProof(compressed);
                          } catch {
                            addToast('No se pudo procesar la imagen. Prueba con otra.', 'error');
                          } finally {
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAbono(false)}
                      className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={sending}
                      className="py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-1.5"
                    >
                      {sending ? (
                        <>
                          <Icon name="refresh" className="w-4 h-4 animate-spin" /> Procesando…
                        </>
                      ) : (
                        <>
                          <Icon name="check" className="w-4 h-4" /> Enviar depósito
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : hasWallet ? (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300 flex items-start gap-2">
              <Icon name="check" className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Tienes <b>{formatUsd(walletAmount)}</b> a tu favor. Al pagar tu próximo pedido,
                elige <b>Mi Cartera</b> como método de pago para usarlo.
              </span>
            </div>
          ) : null}

          {!isSaldoView && !hasWallet && (
            <div className="space-y-2">
              {/* Billetera Fiado Digital: tope de crédito + abonos rápidos 1-toque */}
              {balance > 0 && (
                <div className="rounded-2xl bg-gradient-to-br from-indigo-500/15 via-slate-900 to-teal-500/10 border border-indigo-500/30 p-4 animate-fade-in">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                      <Icon name="wallet" className="w-4 h-4" /> Billetera Fiado
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {fiadoTope ? (
                        <>Tope <b className="text-teal-400">{formatUsd(fiadoTope)}</b></>
                      ) : (
                        <><b className="text-teal-400">Sin tope</b> · sin límite</>
                      )}
                    </span>
                  </div>
                  {fiadoTope ? (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-300">Uso del fiado</span>
                        <span className={`font-black ${fiadoUso >= 85 ? 'text-rose-400' : fiadoUso >= 60 ? 'text-amber-400' : 'text-teal-400'}`}>
                          {Math.round(fiadoUso)}% · {formatUsd(Math.abs(balance))}
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            fiadoUso >= 85
                              ? 'bg-gradient-to-r from-rose-500 to-orange-500'
                              : fiadoUso >= 60
                                ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                                : 'bg-gradient-to-r from-teal-500 to-emerald-400'
                          }`}
                          style={{ width: `${Math.max(4, fiadoUso)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1.5">
                        {fiadoUso >= 85
                          ? 'Estás cerca del tope. Considera abonar para liberar tu fiado.'
                          : fiadoUso >= 60
                            ? 'Has usado buena parte de tu fiado. Abona para seguir comprando a cuenta.'
                            : 'Tu fiado tiene espacio disponible para tus próximos pedidos.'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 mt-3">
                      El kiosko te dio fiado sin tope de crédito. Puedes comprar a cuenta y abonar cuando quieras.
                    </p>
                  )}
                  {rate?.rate > 0 && (
                    <div className="mt-3 space-y-2">
                      <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Abono rápido</span>
                      <div className="grid grid-cols-3 gap-2">
                        {[25, 50, 100].map((pct) => (
                          <button
                            key={pct}
                            onClick={() => quickAbono(pct)}
                            className="py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 hover:border-teal-500/60 hover:text-teal-300 transition-all active:scale-95"
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Toca el % y completa con tu comprobante para aplicar el abono al instante.
                      </p>
                    </div>
                  )}
                </div>
              )}
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider flex items-center justify-between">
                <span>Detalle de la deuda ({debtOrders.length} pedidos)</span>
                <span className="text-red-400 font-black text-sm">{formatUsd(debtTotal)}</span>
              </span>
              {debtOrders.length === 0 ? (
                <p className="text-xs text-slate-500 bg-slate-900/50 p-3 rounded-xl">
                  {debtTotal > 0
                    ? 'Tu saldo deudor está registrado manualmente; no hay pedidos a crédito pendientes en el historial.'
                    : 'No tienes deudas registradas en este momento.'}
                </p>
              ) : (
                debtOrders.map((o) => (
                  <div key={o.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-cyan-400">{o.id}</span>
                      <span className="text-slate-500">{new Date(o.createdAt || o.timestamp).toLocaleDateString('es-VE')}</span>
                    </div>
                    {Array.isArray(o.items) ? o.items.map((it, i) => (
                      <div key={i} className="flex justify-between text-xs text-slate-300">
                        <span>{it.quantity}x {it.name}</span>
                        <span className="font-bold text-white">
                          {formatUsd(it.price * it.quantity)}
                          {rate?.rate > 0 && (
                            <span className="block text-[10px] text-slate-500 text-right">
                              {formatBs(usdToBs(it.price * it.quantity, rate.rate))}
                            </span>
                          )}
                        </span>
                      </div>
                    )) : null}
                    <div className="pt-1.5 border-t border-slate-800 flex justify-between font-bold text-xs">
                      <span className="text-slate-400">Total</span>
                      <span className="text-amber-400 text-right">
                        {formatUsd(o.total)}
                        {rate?.rate > 0 && (
                          <span className="block text-[10px] text-slate-500">{formatBs(usdToBs(o.total, rate.rate))}</span>
                        )}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Estado de cuenta del mes: saldo inicial en el header, fecha y hora de
              cada movimiento, y saldo final diferenciado (negativo = rojo, positivo = verde) */}
          {customerTimeline.length > 0 && (
            <div className="space-y-2">
              <div className="rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Saldo inicial · {monthName}</p>
                  <p className={`text-lg font-black ${saldoInicialMes < 0 ? 'text-red-400' : saldoInicialMes > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {formatUsd(saldoInicialMes)}
                  </p>
                </div>
                <span className="text-[10px] text-slate-500 text-right">
                  Estado de cuenta
                  <br />
                  {customerTimeline.length} movimientos
                </span>
              </div>
              <div className="space-y-0">
                {customerTimeline.map((m, idx) => (
                  <div key={m.id} className="relative flex gap-3 pb-3">
                    {idx < customerTimeline.length - 1 && (
                      <span className="absolute left-[7px] top-4 bottom-0 w-px bg-slate-700/60" />
                    )}
                    <div className="flex flex-col items-center shrink-0">
                      <span
                        className={`w-[15px] h-[15px] rounded-full border-2 flex items-center justify-center ${
                          m.kind === 'deuda'
                            ? 'bg-red-500/20 border-red-500/60'
                            : 'bg-emerald-500/20 border-emerald-500/60'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${m.kind === 'deuda' ? 'bg-red-400' : 'bg-emerald-400'}`} />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 bg-slate-900/70 border border-slate-800 rounded-xl px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-200 capitalize">
                          {m.date.getTime() ? m.date.toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Sin fecha'}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {m.date.getTime() ? m.date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <p className="text-xs font-bold text-slate-200 truncate">{m.label}</p>
                        <span className={`font-mono font-bold shrink-0 ${m.kind === 'deuda' ? 'text-red-400' : 'text-emerald-300'}`}>
                          {m.kind === 'deuda' ? '−' : '+'}{formatUsd(Math.abs(m.amount))}
                        </span>
                      </div>
                      {m.detail && <p className="text-[10px] text-slate-500 truncate">{m.detail}</p>}
                      <p className={`text-[10px] font-bold mt-1.5 ${m.balance < 0 ? 'text-red-300' : m.balance > 0 ? 'text-emerald-300' : 'text-slate-400'}`}>
                        Saldo: {formatUsd(m.balance)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between px-1 pt-2 border-t border-slate-800">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Saldo del mes</span>
                <span className={`text-lg font-black ${currentSaldo < 0 ? 'text-red-400' : currentSaldo > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {formatUsd(currentSaldo)}
                </span>
              </div>
            </div>
          )}

          {/* Formulario de abono / depósito a cartera */}
          {!isSaldoView && showAbono && (
            <form onSubmit={handleAbono} className="space-y-2.5 rounded-2xl bg-slate-950 border border-slate-700 p-4 animate-fade-in">
              <span className="text-xs text-slate-300 font-bold flex items-center gap-1.5">
                <Icon name={hasWallet ? 'wallet' : 'upload'} className="w-4 h-4 text-teal-400" />
                {hasWallet ? 'Depositar en mi cartera' : 'Abonar a mi cuenta'}
              </span>
              {rate?.rate > 0 && (
                <p className="text-[10px] text-slate-500">
                  Tasa del día: Bs {Number(rate.rate).toFixed(2)} ·{' '}
                  {amountBs && Number(parseAmount(amountBs)) > 0
                    ? <>equivale a <b className="text-teal-300">{formatUsd(parseAmount(amountBs) / rate.rate)}</b></>
                    : 'se convierte sola al enviar'}
                </p>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Monto abonado en bolívares *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountBs}
                  onChange={(e) => setAmountBs(formatAmountBsInput(e.target.value))}
                  placeholder="Ej: 1.500,00"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Número de referencia / comprobante</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Ej: 12H3456789"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Foto del comprobante *</label>
                <label className="w-full flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/60 cursor-pointer hover:border-teal-500/50 transition-all text-center">
                  {proof ? (
                    <>
                      <img src={proof} alt="Comprobante del abono" className="max-h-32 rounded-lg object-contain" />
                      <span className="text-[11px] text-teal-300 font-semibold flex items-center gap-1">
                        <Icon name="check" className="w-3.5 h-3.5" />
                        Adjunto — toca para cambiarlo
                      </span>
                    </>
                  ) : (
                    <>
                      <Icon name="upload" className="w-6 h-6 text-slate-500" />
                      <span className="text-xs text-slate-400">Toca para tomar una foto o subir el comprobante</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files && e.target.files[0];
                      if (!file) return;
                      if (file.size > 8 * 1024 * 1024) {
                        addToast('La imagen supera 8 MB. Elige una más liviana.', 'error');
                        e.target.value = '';
                        return;
                      }
                      try {
                        const compressed = await compressImage(file);
                        setProof(compressed);
                      } catch {
                        addToast('No se pudo procesar la imagen. Prueba con otra.', 'error');
                      } finally {
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAbono(false)}
                  className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {sending ? (
                    <>
                      <Icon name="refresh" className="w-4 h-4 animate-spin" /> Procesando…
                    </>
                  ) : (
                    <>
                      <Icon name="check" className="w-4 h-4" /> Enviar abono
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

        </div>

        <div className="p-4 sm:p-6 border-t border-slate-800 shrink-0 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              {isSaldoView
                ? walletAmount > 0
                  ? 'Saldo disponible'
                  : balance > 0
                  ? 'Saldo pendiente por pagar'
                  : 'Saldo disponible'
                : hasWallet
                ? 'Saldo a favor'
                : 'Total deuda'}
            </span>
            <span
              className={`text-base font-black ${
                isSaldoView ? (walletAmount > 0 ? 'text-emerald-400' : balance > 0 ? 'text-red-400' : 'text-slate-400') : hasWallet ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {formatUsd(isSaldoView ? (walletAmount > 0 ? walletAmount : balance) : hasWallet ? walletAmount : debtTotal)}
              {rate?.rate > 0 && (
                <span className="block text-[10px] font-bold text-slate-400 text-right">
                  {formatBs(usdToBs(isSaldoView ? (walletAmount > 0 ? walletAmount : balance) : hasWallet ? walletAmount : debtTotal, rate.rate))}
                </span>
              )}
            </span>
          </div>
          {!showAbono && (
            <button
              onClick={() => setShowAbono(true)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 text-sm font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <Icon name={isSaldoView || hasWallet ? 'wallet' : 'upload'} className="w-4 h-4" />
              {isSaldoView || hasWallet ? 'Depositar en cartera' : 'Abonar'}
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm font-bold transition-all"
          >
            Entendido
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

// Formulario para programar una fecha/hora de cobro y listar los programados.
function CollectionScheduler({ customer, orders, collections, onUpsertCollection, onDeleteCollection }) {
  const [dueAt, setDueAt] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!dueAt) return;
    setSaving(true);
    await onUpsertCollection({
      phone: customer.phone,
      customerName: customer.customerName || 'Cliente',
      dueAt: new Date(dueAt).toISOString(),
      note,
      status: 'programado'
    });
    setSaving(false);
    setDueAt('');
    setNote('');
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-500/30 space-y-3">
      <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
        <Icon name="clock" className="w-3.5 h-3.5" />
        Programar cobro automático
      </span>
      <form onSubmit={handleSchedule} className="space-y-2">
        <label className="block text-[11px] text-slate-400 font-semibold">Fecha y hora del envío automático *</label>
        <input
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-cyan-500 focus:outline-none"
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota opcional (ej: recordatorio de tu compra pendiente)"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-cyan-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={saving || !dueAt}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 text-xs font-bold hover:from-cyan-400 hover:to-teal-400 disabled:opacity-40 transition-all"
        >
          {saving ? 'Guardando...' : 'Programar envío'}
        </button>
      </form>

      {collections.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Cobros programados</span>
          {collections.map((c) => {
            const isPast = new Date(c.dueAt || 0) < new Date();
            return (
              <div key={c.id} className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800">
                <span className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-400 shrink-0">
                  <Icon name="clock" className="w-3.5 h-3.5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-100">
                    {c.dueAt ? new Date(c.dueAt).toLocaleString('es-VE') : 'Sin fecha'}
                    {isPast && c.status === 'programado' && <span className="text-rose-400"> · vencido</span>}
                  </p>
                  {c.note && <p className="text-[10px] text-slate-500 truncate">{c.note}</p>}
                </div>
                <div className="flex items-center gap-1">
                  {isPast && c.status === 'programado' && (
                    <button
                      onClick={() => {
                        const wa = formatPhoneWhatsApp(customer.phone);
                        const msg = c.note
                          ? `${buildAccountMessage(customer, orders)}\n\n_${c.note}_`
                          : buildAccountMessage(customer, orders);
                        if (wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
                      }}
                      className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-[10px] font-bold hover:bg-emerald-500/25"
                    >
                      Enviar ahora
                    </button>
                  )}
                  <button
                    onClick={() => onDeleteCollection(c.id)}
                    className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-300 text-[10px] font-bold hover:bg-rose-500/25"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Cuenta los cobros programados vencidos (sin enviar).
function futureCollectionDue(list) {
  const now = new Date();
  return list.filter((c) => c.status === 'programado' && new Date(c.dueAt || 0) < now).length;
}

// Construye el mensaje con el desglose de la deuda de un cliente, para enviar
// por WhatsApp (transparencia ante discrepancias).
function buildAccountMessage(customer, orders) {
  const key = normalizePhoneDigits(customer.phone);
  const debtOrders = (orders || [])
    .filter((o) => normalizePhoneDigits(o.phone) === key && o.credit && o.status === 'entregado')
    .sort((a, b) => new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp));
  const debtTotal = debtOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);

  const lines = [
    `Hola ${customer.customerName || 'cliente'}, te enviamos el detalle de tu cuenta pendiente en *Empresas Alvarados*:`,
    ''
  ];
  if (debtOrders.length > 0) {
    debtOrders.forEach((o) => {
      lines.push(`· Pedido ${o.id} (${new Date(o.createdAt || o.timestamp).toLocaleDateString('es-VE')}):`);
      o.items.forEach((it) => lines.push(`   - ${it.quantity}x ${it.name} = ${formatUsd(it.price * it.quantity)}`));
      lines.push(`   Total: ${formatUsd(o.total)}`);
      lines.push('');
    });
  }
  lines.push(`*Total a pagar: ${formatUsd(debtTotal)}*`);
  lines.push('');
  lines.push('Gracias por tu prontitud.');
  return lines.join('\n');
}

// Traduce errores del navegador/WebAuthn a un mensaje amigable para el usuario.
// Evita mostrar textos técnicos en inglés como "NotAllowedError".
const friendlyAuthError = (err) => {
  const name = err?.name || '';
  // Errores lanzados manualmente (new Error(...)) ya traen un mensaje en español
  // del servidor o un fallback amigable, así que se muestran tal cual.
  if (name === 'Error' && err?.message) return err.message;
  if (name === 'NotAllowedError') {
    return `Verificación cancelada. Para continuar, acepta tu ${BIO_METHOD_LABEL} cuando tu teléfono lo pida.`;
  }
  if (name === 'NotFoundError' || name === 'NotSupportedError') {
    return `Tu dispositivo no tiene ${BIO_METHOD_LABEL} configurada. Activa tu ${BIO_METHOD_LABEL} en los ajustes y prueba de nuevo.`;
  }
  if (name === 'AbortError') {
    return 'La verificación tardó demasiado y se canceló. Intenta de nuevo.';
  }
  if (name === 'TimeoutError') {
    return 'El tiempo de espera se agotó. Intenta de nuevo.';
  }
  if (name === 'SecurityError' || name === 'InvalidStateError') {
    return 'Tu dispositivo no pudo completar la verificación. Intenta de nuevo o usa un teléfono más reciente.';
  }
  return 'No se pudo completar la verificación. Intenta de nuevo.';
};

// Recordatorio corto para un cobro programado que ya venció.
const OPENFACTS_FIELDS = 'code,product_name,brands,image_front_url';

const searchOpenFoodFacts = async (query, useBeauty) => {
  const base = useBeauty
    ? 'https://world.openbeautyfacts.org'
    : 'https://world.openfoodfacts.org';
  const res = await fetch(
    `${base}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=8&fields=${OPENFACTS_FIELDS}`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.products || [])
    .filter((p) => p.image_front_url)
    .map((p) => ({
      id: `${useBeauty ? 'openbeautyfacts' : 'openfoodfacts'}-${p.code}`,
      thumb: p.image_front_url,
      full: p.image_front_url,
      photographer: p.brands || 'Supermercado',
      page: `${base}/product/${p.code}`,
      source: useBeauty ? 'Open Beauty Facts' : 'Open Food Facts'
    }));
};

const searchPexels = async (query) => {
  const res = await fetch(
    `/pexels-api/search?query=${encodeURIComponent(query)}&per_page=8&size=medium`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.photos || []).map((photo) => ({
    id: `pexels-${photo.id}`,
    thumb: photo.src.medium || photo.src.small || photo.src.large,
    full: photo.src.large || photo.src.original,
    photographer: photo.photographer,
    page: photo.url
  }));
};

const searchWikimedia = async (query) => {
  const res = await fetch(
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=480&format=json&origin=*`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
  return pages
    .map((page) => {
      const info = page.imageinfo?.[0];
      return {
        id: `wikimedia-${page.pageid}`,
        thumb: info?.thumburl || info?.url,
        full: info?.thumburl || info?.url,
        photographer: info?.extmetadata?.Artist?.value
          ? info.extmetadata.Artist.value.replace(/<[^>]+>/g, '').trim()
          : 'Wikimedia Commons',
        page: info?.descriptionurl || ''
      };
    })
    .filter((r) => r.thumb && r.full);
};

// Tope de fiado por cliente beneficiado: input compacto para el panel admin.
// Un valor vacío o 0 = fiado sin tope (sin límite).
function CreditLimitInput({ customer, onSetCreditLimit }) {
  const [value, setValue] = useState(customer?.creditLimit != null ? String(customer.creditLimit) : '');
  const [saving, setSaving] = useState(false);
  const limit = customer?.creditLimit != null ? Number(customer.creditLimit) : null;

  const save = async () => {
    if (saving) return;
    const raw = String(value || '').trim().replace(',', '.');
    const num = raw === '' ? null : Number(raw);
    const amount = num != null && Number.isFinite(num) && num > 0 ? num : null;
    setSaving(true);
    await onSetCreditLimit(customer.phone, amount);
    setSaving(false);
    if (amount == null) setValue('');
  };

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="flex items-center gap-1 rounded-xl bg-slate-800 border border-slate-700 px-2 py-1">
        <span className="text-[10px] text-slate-500 font-semibold">Tope</span>
        <span className="text-teal-400 text-xs font-bold">$</span>
        <input
          type="number"
          min="0"
          step="any"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
          }}
          placeholder="sin tope"
          className="w-16 bg-transparent text-slate-100 text-xs font-bold focus:outline-none"
          aria-label={`Tope de fiado de ${customer.customerName || customer.phone}`}
        />
        {limit != null ? (
          <span className="text-[10px] font-bold text-teal-400 shrink-0">{formatUsd(limit)}</span>
        ) : (
          <span className="text-[10px] font-semibold text-slate-500 shrink-0">∞</span>
        )}
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="shrink-0 px-2 py-1.5 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-300 text-[10px] font-bold hover:bg-teal-500/25 transition-all disabled:opacity-50"
        title="Guardar tope (vacío = sin límite)"
      >
        {saving ? '…' : 'OK'}
      </button>
    </div>
  );
}

// Escáner de código de barras para el formulario de productos. Usa la API
// nativa BarcodeDetector (Chrome/Edge) cuando está disponible y, si no, decodifica
// por software con ZXing (Safari, Firefox, iPhone). Siempre permite ingresar el
// código manualmente como respaldo.
function BarcodeScannerModal({ onScan, onClose, keepOpen = false, overlay = null }) {
  useOverlay(true, onClose);
  const videoRef = useRef(null);
  const [cameraError, setCameraError] = useState('');
  const [manual, setManual] = useState('');
  const [flash, setFlash] = useState(false);

  // Watchdog de cámara: dispara UNA vez al montar el modal y, si el video no
  // arrancó en 5s (p. ej. getUserMedia colgado en iOS/PWA tras aceptar el
  // permiso), deriva al ingreso manual en vez de dejar la app congelada.
  // Vive en un effect propio para no reiniciarse con cada re-render del padre.
  const cameraReadyRef = useRef(false);
  const watchdogRef = useRef(0);
  useEffect(() => {
    watchdogRef.current = setTimeout(() => {
      if (cameraReadyRef.current) return;
      setCameraError('No se pudo abrir la cámara en este dispositivo. Ingresá el código manualmente.');
    }, 5000);
    return () => clearTimeout(watchdogRef.current);
  }, []);

  useEffect(() => {
    let stream = null;
    let raf = 0;
    let zxControls = null;
    let cancelled = false;
    let last = 0;
    let decoding = false;
    let flashTimer = 0;
    const reader =
      typeof window !== 'undefined' && 'BarcodeDetector' in window
        ? null
        : new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 150 });

    const markStreamReady = () => {
      cameraReadyRef.current = true;
      clearTimeout(watchdogRef.current);
    };

    const stop = () => {
      if (cancelled) return;
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(flashTimer);
      const videoEl = videoRef.current;
      if (videoEl) videoEl.removeEventListener('playing', markStreamReady);
      if (zxControls && typeof zxControls.stop === 'function') {
        try { zxControls.stop(); } catch {}
      }
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };

    const videoEl = videoRef.current;
    if (videoEl) videoEl.addEventListener('playing', markStreamReady);

    const handleResult = (value) => {
      if (cancelled) return;
      const v = String(value || '').trim();
      if (!v) return;
      setFlash(true);
      if (keepOpen) {
        onScan(v);
        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => {
          if (!cancelled) setFlash(false);
        }, 260);
        return;
      }
      stop();
      onScan(v);
    };

    (async () => {
      try {
        if (reader) {
          // Decodificación por software (ZXing): sin deviceId pide cámara trasera
          // (facingMode environment) con su propio getUserMedia y corre un loop
          // continuo de decodificación. Evita la enumeración de dispositivos,
          // que fallaba en Safari/iOS.
          try {
            zxControls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
              if (!cancelled && result && result.getText) handleResult(result.getText());
            });
          } catch {
            zxControls = await reader.decodeFromConstraints(
              { video: true },
              videoRef.current,
              (result) => {
                if (!cancelled && result && result.getText) handleResult(result.getText());
              }
            );
          }
          return;
        }

        // Un solo getUserMedia propio para BarcodeDetector nativo. Intenta con
        // cámara trasera y, si el navegador no la soporta, reintenta con
        // cualquier cámara.
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
          });
        } catch (err) {
          if (err && (err.name === 'OverconstrainedError' || err.name === 'NotReadableError')) {
            stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
          } else {
            throw err;
          }
        }
        if (cancelled || !videoRef.current) {
          if (stream) stream.getTracks().forEach((t) => t.stop());
          return;
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        markStreamReady();

        let detector;
        try {
          detector = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'codabar', 'itf', 'qr_code']
          });
        } catch {
          detector = new window.BarcodeDetector();
        }

        const step = () => {
          if (cancelled) return;
          const v = videoRef.current;
          const now = performance.now();
          if (v && v.readyState >= 2 && now - last > 150 && !decoding) {
            last = now;
            decoding = true;
            detector
              .detect(v)
              .then((codes) => (codes && codes.length ? String(codes[0].rawValue || '').trim() : null))
              .catch(() => null)
              .then((value) => {
                decoding = false;
                if (!cancelled && value) handleResult(value);
              });
          }
          raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      } catch (err) {
        const name = err && err.name;
        let msg = 'No se pudo abrir la cámara. Ingresá el código manualmente.';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          msg = 'Permiso de cámara denegado. Ingresá el código manualmente.';
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          msg = 'No se encontró una cámara en este dispositivo. Ingresá el código manualmente.';
        } else if (name === 'NotReadableError' || name === 'TrackStartError') {
          msg = 'La cámara está en uso por otra aplicación. Ingresá el código manualmente.';
        }
        setCameraError(msg);
      }
    })();

    return stop;
  }, [onScan, keepOpen]);

  const applyManualCode = () => {
    const v = manual.trim();
    if (v) onScan(v);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md glass-strong bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden animate-screen-up">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Icon name="camera" className="w-4 h-4 text-teal-400" />
            Escanear código de barras
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {!cameraError ? (
            <div className="relative overflow-hidden rounded-2xl bg-black aspect-video">
              <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
              <div className={`absolute inset-0 pointer-events-none transition-all duration-150 ${flash ? 'bg-teal-400/30' : 'bg-transparent'}`} />
              <div className="absolute pointer-events-none" style={{ inset: '18% 12%', border: '2px solid rgba(45,212,191,0.8)', borderRadius: '16px', boxShadow: '0 0 0 9999px rgba(0,0,0,0.28)' }} />
              <p className="absolute bottom-3 left-0 right-0 text-center text-[11px] text-teal-300 font-semibold">
                Apuntá al código de barras del producto
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4 text-center">
              <Icon name="camera" className="w-8 h-8 mx-auto text-slate-500" />
              <p className="text-xs text-slate-300 mt-2 font-semibold">
                {cameraError || 'Tu navegador no soporta escaneo por cámara. Ingresá el código manualmente.'}
              </p>
            </div>
          )}

          {overlay}

          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              autoFocus={!!cameraError}
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyManualCode()}
              placeholder="Escribí el código manualmente (ej: 7790070035394)"
              className="flex-1 min-w-0 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm placeholder-slate-500 focus:border-teal-500 focus:outline-none"
            />
            <button
              onClick={applyManualCode}
              disabled={!manual.trim()}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs disabled:opacity-40 disabled:pointer-events-none transition-all active:scale-95"
            >
              Usar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Venta en mostrador: panel del admin para registrar ventas físicas de manera
// cómoda. Entrada por escáner de código de barras, por código tipeado o tocando
// el producto en la lista. Al registrar crea un pedido pickup entregado y pagado.
function CounterSalesPanel({ products = [], orders = [], onCounterSale, addToast }) {
  const [saleCart, setSaleCart] = useState([]); // [{ product, qty }]
  const [codeInput, setCodeInput] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [saving, setSaving] = useState(false);
  const [saleSearch, setSaleSearch] = useState('');

  const total = saleCart.reduce((acc, it) => acc + (Number(it.product.price) || 0) * it.qty, 0);
  const totalUnits = saleCart.reduce((acc, it) => acc + it.qty, 0);

  const addProduct = (product, qty = 1) => {
    const n = Math.max(1, Math.round(Number(qty) || 1));
    const available = Number(product.stock) || 0;
    setSaleCart((prev) => {
      const found = prev.find((it) => it.product.id === product.id);
      const current = found ? found.qty : 0;
      if (available < current + n) {
        addToast?.(`Stock insuficiente para "${product.name}"`, 'error');
        return prev;
      }
      if (found) {
        return prev.map((it) => (it.product.id === product.id ? { ...it, qty: it.qty + n } : it));
      }
      return [...prev, { product, qty: n }];
    });
  };

  const addByCode = (code) => {
    const p = (products || []).find((x) => String(x.code || '').trim() === String(code || '').trim());
    if (!p) {
      addToast?.(`No hay productos con el código ${code}`, 'error');
      return;
    }
    addProduct(p);
  };

  const changeQty = (id, delta) => {
    setSaleCart((prev) =>
      prev
        .map((it) => {
          if (it.product.id !== id) return it;
          const next = it.qty + delta;
          if (next < 1) return null;
          if (next > (Number(it.product.stock) || 0) && delta > 0) return it;
          return { ...it, qty: next };
        })
        .filter(Boolean)
    );
  };

  const removeItem = (id) => setSaleCart((prev) => prev.filter((it) => it.product.id !== id));

  const applyCode = () => {
    const c = codeInput.trim();
    if (!c) return;
    addByCode(c);
    setCodeInput('');
  };

  const registerSale = async () => {
    if (saleCart.length === 0) {
      addToast?.('Agregá al menos un producto para registrar la venta', 'error');
      return;
    }
    setSaving(true);
    const res = await onCounterSale({
      items: saleCart.map((it) => ({
        id: it.product.id,
        name: it.product.name,
        price: it.product.price,
        quantity: it.qty
      })),
      customerName,
      customerPhone,
      paymentMethod
    });
    setSaving(false);
    if (res && res.ok) {
      setSaleCart([]);
      setCodeInput('');
      setCustomerName('');
      setCustomerPhone('');
      setPaymentMethod('efectivo');
    }
  };

  const filteredProducts = useMemo(() => {
    const q = saleSearch.trim().toLowerCase();
    if (!q) return products || [];
    return (products || []).filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        String(p.code || '').toLowerCase().includes(q)
    );
  }, [products, saleSearch]);

  const recentCounterSales = useMemo(() => {
    return (orders || [])
      .filter((o) => o.status === 'entregado' && (o.notes || '').toLowerCase().includes('mostrador'))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 6);
  }, [orders]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-teal-500/30 bg-gradient-to-br from-teal-500/10 via-slate-900/80 to-slate-900/80 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-500/20 text-teal-300 shrink-0">
            <Icon name="shoppingBag" className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-white text-sm">Registrar venta en mostrador</h2>
            <p className="text-[11px] text-slate-400">
              Escaneá el código, escribilo o tocá el producto de la lista.
            </p>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyCode()}
            placeholder="Código de barras (ej: 7790070035394)"
            className="flex-1 min-w-0 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm placeholder-slate-500 focus:border-teal-500 focus:outline-none"
          />
          <button
            onClick={applyCode}
            disabled={!codeInput.trim()}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs hover:text-white transition-all disabled:opacity-40"
          >
            Agregar
          </button>
          <button
            onClick={() => setScannerOpen(true)}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs hover:bg-teal-400 transition-all flex items-center gap-1.5"
          >
            <Icon name="scan" className="w-4 h-4" />
            Escanear
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-3 sm:p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Icon name="cart" className="w-4 h-4 text-teal-400" />
            Venta actual · {totalUnits} un.
          </h3>
          <button
            onClick={() => setSaleCart([])}
            className="text-[11px] font-semibold text-slate-400 hover:text-rose-300 transition-colors"
          >
            Vaciar
          </button>
        </div>

        {saleCart.length === 0 ? (
          <p className="text-[11px] text-slate-500 text-center py-3">
            Sin productos todavía. Escaneá o buscá arriba.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {saleCart.map((it) => (
              <div key={it.product.id} className="flex items-center gap-2 rounded-xl bg-slate-900/60 border border-slate-700/60 p-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{it.product.name}</p>
                  <p className="text-[10px] text-slate-400">{formatUsd(it.product.price)} c/u</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => changeQty(it.product.id, -1)} className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center">
                    <Icon name="minus" className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-7 text-center text-sm font-black text-white">{it.qty}</span>
                  <button onClick={() => changeQty(it.product.id, 1)} className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center">
                    <Icon name="plus" className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="w-16 text-right text-xs font-bold text-white">{formatUsd((Number(it.product.price) || 0) * it.qty)}</span>
                <button onClick={() => removeItem(it.product.id)} className="text-slate-500 hover:text-rose-300 transition-colors">
                  <Icon name="trash2" className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-slate-700/60">
          <span className="text-xs font-semibold text-slate-400">Total</span>
          <span className="text-lg font-black text-teal-300">{formatUsd(total)}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { key: 'efectivo', label: 'Efectivo' },
            { key: 'qr', label: 'QR' },
            { key: 'tarjeta', label: 'Tarjeta' },
            { key: 'transferencia', label: 'Transferencia' }
          ].map((pm) => (
            <button
              key={pm.key}
              onClick={() => setPaymentMethod(pm.key)}
              className={`px-2 py-2 rounded-xl text-[11px] font-bold border transition-all ${
                paymentMethod === pm.key
                  ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-md'
                  : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              {pm.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Cliente (opcional)"
            className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-sm placeholder-slate-500 focus:border-teal-500 focus:outline-none"
          />
          <input
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="WhatsApp (opcional)"
            className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-sm placeholder-slate-500 focus:border-teal-500 focus:outline-none"
          />
        </div>

        <button
          onClick={registerSale}
          disabled={saving || saleCart.length === 0}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-black text-sm hover:from-teal-400 hover:to-emerald-400 shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Icon name={saving ? 'clock' : 'check'} className="w-4 h-4" />
          {saving ? 'Registrando…' : `Registrar venta · ${formatUsd(total)}`}
        </button>
      </div>

      <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3 sm:p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Icon name="package" className="w-4 h-4 text-teal-400" />
            Productos (tocá para agregar)
          </h3>
          <input
            type="text"
            value={saleSearch}
            onChange={(e) => setSaleSearch(e.target.value)}
            placeholder="Buscar…"
            className="w-36 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-80 overflow-y-auto pr-1">
          {filteredProducts.map((p) => (
            <button
              key={p.id}
              onClick={() => addProduct(p)}
              className="flex items-center gap-2 rounded-xl bg-slate-900/60 border border-slate-700/60 p-2 text-left hover:border-teal-500/50 transition-all"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{p.name}</p>
                <p className="text-[10px] text-slate-400">
                  {formatUsd(p.price)} · {p.stock} un.
                </p>
              </div>
              <span className="shrink-0 w-7 h-7 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-300 flex items-center justify-center">
                <Icon name="plus" className="w-3.5 h-3.5" />
              </span>
            </button>
          ))}
          {filteredProducts.length === 0 && (
            <p className="col-span-full text-[11px] text-slate-500 text-center py-3">
              No hay productos que coincidan.
            </p>
          )}
        </div>
      </div>

      {recentCounterSales.length > 0 && (
        <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3 sm:p-4 space-y-1.5">
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Icon name="clock" className="w-4 h-4 text-teal-400" />
            Últimas ventas de mostrador
          </h3>
          {recentCounterSales.map((o) => (
            <div key={o.id} className="flex items-center gap-2 rounded-xl bg-slate-900/60 border border-slate-700/60 p-2">
              <span className="font-mono text-[10px] font-bold text-teal-400 w-16 shrink-0">{o.id}</span>
              <span className="flex-1 min-w-0 text-xs text-slate-300 truncate">{o.customerName}</span>
              <span className="text-[10px] text-slate-500 shrink-0">
                {new Date(o.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-xs font-bold text-white shrink-0">{formatUsd(o.total)}</span>
            </div>
          ))}
        </div>
      )}

      {scannerOpen && (
        <BarcodeScannerModal
          onScan={(code) => {
            setScannerOpen(false);
            addByCode(code);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}

function ProductFormModal({ productToEdit, categories, products = [], onClose, onSave }) {
  useOverlay(true, onClose);
  const [formData, setFormData] = useState({
    id: productToEdit?.id || '',
    code: productToEdit?.code || '',
    name: productToEdit?.name || '',
    brand: productToEdit?.brand || '',
    description: productToEdit?.description || '',
    price: productToEdit?.price || '',
    cost: productToEdit?.cost || '',
    stock: productToEdit?.stock || '',
    category: productToEdit?.category || categories[0] || 'Comida',
    image: productToEdit?.image || 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&auto=format&fit=crop&q=80',
    sizeValue: productToEdit?.sizeValue || '',
    sizeUnit: productToEdit?.sizeUnit || 'ml'
  });

  const [newCatInput, setNewCatInput] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);

  // Autocompletado de datos del producto por código de barras (Nivel 2): al
  // escanear o buscar un código, se consulta Open Food Facts / Open Beauty Facts
  // y se rellenan los campos vacíos (nombre, marca, descripción, imagen).
  const [lookupState, setLookupState] = useState('idle'); // idle | loading | found | notfound | error
  const [lookupError, setLookupError] = useState('');
  const [lookupInfo, setLookupInfo] = useState(null);

  const DEFAULT_IMG =
    'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&auto=format&fit=crop&q=80';

  const lookupProductInfo = async (rawCode) => {
    const code = String(rawCode || '').trim();
    if (!code) return;
    setLookupState('loading');
    setLookupError('');
    setLookupInfo(null);
    try {
      const res = await api.productInfo(code);
      if (!res.ok) {
        setLookupState('error');
        setLookupError(res.data?.error || 'No se pudo consultar el código.');
        return;
      }
      const info = res.data;
      if (!info || !info.found) {
        setLookupState('notfound');
        return;
      }
      setLookupState('found');
      setLookupInfo(info);
      setFormData((prev) => {
        const keepImage =
          Boolean(productToEdit) ||
          (prev.image && prev.image !== DEFAULT_IMG && !prev.image.startsWith('/api/products/'));
        return {
          ...prev,
          name: prev.name || info.name || prev.name,
          brand: prev.brand || info.brand || prev.brand,
          description: prev.description || info.description || prev.description,
          image: keepImage ? prev.image : info.image || prev.image,
          category: productToEdit
            ? prev.category
            : categories.includes(info.category)
              ? info.category
              : prev.category
        };
      });
    } catch {
      setLookupState('error');
      setLookupError('Sin conexión para consultar el código. Verificá tu internet.');
    }
  };

  // Si otro producto (distinto id) ya usa ese código de barras, se avisa en el
  // formulario y se bloquea el guardado para no duplicar códigos.
  const codeConflict =
    String(formData.code || '').trim().length > 0 &&
    (products || []).some((p) => p.id !== formData.id && String(p.code || '').trim() === String(formData.code).trim());

  const sizeType = ['ml', 'L'].includes(formData.sizeUnit) ? 'liquid' : 'solid';
  const sizeUnits = sizeType === 'liquid' ? ['ml', 'L'] : ['g', 'kg'];

  const setSizeType = (type) => {
    setFormData((prev) => ({
      ...prev,
      sizeUnit: type === 'liquid' ? 'ml' : 'g'
    }));
  };

  const [imageResults, setImageResults] = useState([]);
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [imageSearchError, setImageSearchError] = useState('');
  const [imageSource, setImageSource] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingImage(true);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 800;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const ratio = MAX / Math.max(width, height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setFormData((prev) => ({ ...prev, image: dataUrl }));
        setIsUploadingImage(false);
      };
      img.onerror = () => {
        setIsUploadingImage(false);
        setImageSearchError('No se pudo leer la imagen seleccionada.');
      };
      img.src = reader.result;
    };
    reader.onerror = () => {
      setIsUploadingImage(false);
      setImageSearchError('No se pudo leer la imagen seleccionada.');
    };
    reader.readAsDataURL(file);
  };

  const searchImages = async () => {
    const query = [formData.brand, formData.name, formData.category]
      .filter(Boolean)
      .join(' ')
      .trim();

    if (!query) {
      setImageSearchError('Completa al menos el nombre o la marca del producto para buscar imágenes.');
      return;
    }

    setIsSearchingImages(true);
    setImageSearchError('');
    setImageResults([]);
    setImageSource('');

    let results = null;

    // 1. Open Food Facts / Open Beauty Facts: fotos reales de productos de supermercado
    const useBeauty = BEAUTY_CATEGORIES.some((k) =>
      formData.category.toLowerCase().includes(k)
    );

    const foodQuery = [formData.brand, formData.name]
      .filter(Boolean)
      .join(' ')
      .replace(/\b\d+(\.\d+)?\s*(ml|l|g|kg)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    try {
      results = await searchOpenFoodFacts(foodQuery || query, useBeauty);
    } catch (err) {
      console.error('[kiosko] Open Food Facts falló:', err);
    }

    if (results && results.length > 0) {
      setImageResults(results);
      setImageSource(results[0].source);
      setIsSearchingImages(false);
      return;
    }

    // 2. Pexels (vía proxy de dev)
    try {
      results = await searchPexels(query);
    } catch (err) {
      console.error('[kiosko] Pexels falló:', err);
    }

    if (results && results.length > 0) {
      setImageResults(results);
      setImageSource('Pexels');
      setIsSearchingImages(false);
      return;
    }

    // 3. Wikimedia Commons (CORS directo)
    try {
      results = await searchWikimedia(query);
    } catch (err) {
      console.error('[kiosko] Wikimedia falló:', err);
    }

    setIsSearchingImages(false);

    if (results && results.length > 0) {
      setImageResults(results);
      setImageSource('Wikimedia');
      return;
    }

    setImageSearchError(
      'No se pudieron cargar las sugerencias de imágenes. Verifica tu conexión a internet e intenta de nuevo.'
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.price || formData.stock === '') return;
    if (codeConflict) return;

    onSave({
      ...formData,
      price: Number(formData.price),
      cost: Number(formData.cost) || 0,
      stock: Number(formData.stock),
      sizeValue: formData.sizeValue === '' ? '' : Number(formData.sizeValue),
      category: newCatInput.trim() ? newCatInput.trim() : formData.category
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg glass-strong bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-screen-up max-h-[92vh] flex flex-col">
        <div className="pt-[max(1rem,env(safe-area-inset-top))] p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-white">
            {productToEdit ? 'Editar Producto' : 'Crear Nuevo Producto'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre del Producto *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Chocolate Semi Amargo"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Código de barras (EAN/UPC)</label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Ej: 7790070035394"
                className="flex-1 min-w-0 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-500/15 border border-teal-500/40 text-teal-300 font-bold text-xs hover:bg-teal-500/25 transition-all active:scale-95"
              >
                <Icon name="camera" className="w-4 h-4" />
                Escanear
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 mt-1">
              <p className="text-[10px] text-slate-500">
                {formData.code ? 'Este código reemplaza al generado automáticamente.' : 'Si no lo cargás, se genera uno automático (PROD-XXX).'}
              </p>
              {formData.code.trim() && (
                <button
                  type="button"
                  onClick={() => lookupProductInfo(formData.code)}
                  disabled={lookupState === 'loading'}
                  className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold hover:bg-cyan-500/25 transition-all disabled:opacity-50"
                  title="Buscar nombre, marca, imagen y más datos de este código"
                >
                  <Icon name={lookupState === 'loading' ? 'clock' : 'search'} className="w-3 h-3" />
                  {lookupState === 'loading' ? 'Buscando…' : 'Buscar datos'}
                </button>
              )}
            </div>
            {lookupState === 'loading' && (
              <p className="text-[10px] text-cyan-300 font-semibold mt-1 flex items-center gap-1">
                <Icon name="clock" className="w-3 h-3" />
                Consultando base de códigos…
              </p>
            )}
            {lookupState === 'found' && lookupInfo && (
              <p className="text-[10px] text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                <Icon name="check" className="w-3 h-3" />
                Datos encontrados en {lookupInfo.source}. Se rellenaron los campos vacíos.
              </p>
            )}
            {lookupState === 'notfound' && (
              <p className="text-[10px] text-slate-400 mt-1">
                No encontramos datos para este código. Cargá el producto a mano.
              </p>
            )}
            {lookupState === 'error' && (
              <p className="text-[10px] text-rose-400 font-semibold mt-1 flex items-center gap-1">
                <Icon name="alertTriangle" className="w-3 h-3" />
                {lookupError}
              </p>
            )}
            {codeConflict && (
              <p className="text-[10px] text-rose-400 font-semibold mt-1 flex items-center gap-1">
                <Icon name="alertTriangle" className="w-3 h-3" />
                Ya existe otro producto con ese código. Usá uno distinto.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Marca (Opcional)</label>
            <input
              type="text"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              placeholder="Ej: Quilmes, La Serenísima, Milka..."
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Descripción</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detalles sobre ingredientes, tamaño, etc."
              rows={2}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Precio ($ ARS) *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="1500"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Costo ($ ARS)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                placeholder="1200"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Stock Disponible *</label>
              <input
                type="number"
                required
                min="0"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                placeholder="20"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Tamaño del Producto</label>
            <div className="grid grid-cols-2 gap-3 p-1.5 rounded-2xl bg-slate-800 border border-slate-700 mb-3">
              <button
                type="button"
                onClick={() => setSizeType('liquid')}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  sizeType === 'liquid'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon name="cup" className="w-4 h-4" />
                Líquido / Bebida
              </button>
              <button
                type="button"
                onClick={() => setSizeType('solid')}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  sizeType === 'solid'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon name="package" className="w-4 h-4" />
                Sólido
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min="0"
                step="any"
                value={formData.sizeValue}
                onChange={(e) => setFormData({ ...formData, sizeValue: e.target.value })}
                placeholder={sizeType === 'liquid' ? 'Ej: 500' : 'Ej: 200'}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
              />
              <select
                value={formData.sizeUnit}
                onChange={(e) => setFormData({ ...formData, sizeUnit: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
              >
                {sizeUnits.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Categoría</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none mb-2"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <input
              type="text"
              value={newCatInput}
              onChange={(e) => setNewCatInput(e.target.value)}
              placeholder="O escribe una nueva categoría aquí..."
              className="w-full px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-xs focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Imagen del Producto (Opcional)</label>
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage}
                className="flex-1 py-2.5 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-300 font-bold text-xs hover:bg-teal-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Icon name="upload" className="w-4 h-4" />
                {isUploadingImage ? 'Procesando imagen...' : 'Subir imagen de archivo'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
            <input
              type="text"
              value={formData.image}
              onChange={(e) => setFormData({ ...formData, image: e.target.value })}
              placeholder="https://images.unsplash.com/..."
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
            />
            {formData.image && (
              <div className="mt-2">
                <img
                  src={formData.image}
                  alt="Preview del producto"
                  className="w-28 h-28 rounded-xl object-cover border border-slate-700 bg-slate-900"
                />
              </div>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={searchImages}
              disabled={isSearchingImages}
              className="w-full py-3 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold text-xs hover:bg-cyan-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Icon name="search" className="w-4 h-4" />
              {isSearchingImages ? 'Buscando sugerencias...' : 'Sugerir imágenes de la web'}
            </button>
            {imageSearchError && (
              <p className="text-xs text-rose-400 mt-2">{imageSearchError}</p>
            )}
            {imageResults.length > 0 && (
              <div className="mt-3">
                <span className="text-[11px] text-slate-400 font-semibold block mb-2">
                  Sugerencias para:{' '}
                  <span className="text-cyan-300">
                    {[formData.brand, formData.name, formData.category].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {imageResults.map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, image: img.full }))}
                      title={`Foto por ${img.photographer}`}
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all group ${
                        formData.image === img.full
                          ? 'border-teal-400 shadow-lg shadow-teal-500/30 scale-105'
                          : 'border-slate-700 hover:border-teal-500/50'
                      }`}
                    >
                      <img
                        src={img.thumb}
                        alt={`Sugerencia: ${img.photographer}`}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      {formData.image === img.full && (
                        <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-teal-400 text-slate-950 flex items-center justify-center">
                          <Icon name="check" className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  {imageSource === 'Wikimedia' ? (
                    <>
                      Imágenes de{' '}
                      <a
                        href={imageResults.find((i) => i.full === formData.image)?.page}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-slate-300"
                      >
                        Wikimedia Commons
                      </a>{' '}
                      (licencias CC).
                    </>
                  ) : imageSource.includes('Open') ? (
                    <>
                      Fotos del producto real de{' '}
                      <a
                        href={imageResults.find((i) => i.full === formData.image)?.page}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-slate-300"
                      >
                        {imageSource}
                      </a>{' '}
                      (CC BY-SA). Haz clic en una miniatura para usarla.
                    </>
                  ) : (
                    <>
                      Fotografías por{' '}
                      <a
                        href={imageResults.find((i) => i.full === formData.image)?.page}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-slate-300"
                      >
                        Pexels
                      </a>
                      . Haz clic en una miniatura para usarla.
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3.5 mt-4 rounded-2xl bg-teal-500 text-slate-950 font-bold text-sm hover:bg-teal-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20"
          >
            <Icon name="check" className="w-5 h-5" />
            <span>Guardar Producto</span>
          </button>
        </form>
      </div>
      {scannerOpen && (
        <BarcodeScannerModal
          onScan={(code) => {
            setFormData((prev) => ({ ...prev, code }));
            setScannerOpen(false);
            lookupProductInfo(code);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}

// Confirmación genérica con el lenguaje visual de la app (reemplaza el
// window.confirm del navegador). Muestra título, mensaje y botones estilizados.
function ConfirmActionModal({ title, message, note, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', tone = 'danger', icon = 'alertTriangle', onConfirm, onClose }) {
  // Salida animada (#11): atrás/ESC/click fuera encogen el panel antes de irse.
  const panelRef = useRef(null);
  const closeWithExit = exitThen(panelRef, onClose);
  useOverlay(true, closeWithExit);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const danger = tone === 'danger';
  // Un solo click: mientras procesa se bloquea todo el modal y el confirm
  // muestra spinner. Si onConfirm cierra el modal, el setState final es no-op.
  const handleConfirm = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center pb-[calc(5rem+env(safe-area-inset-bottom))] sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      {!busy && <div className="absolute inset-0" onClick={closeWithExit} />}
      <div ref={panelRef} className="relative w-full sm:max-w-md glass-strong bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl z-10 text-center space-y-4 animate-modal-spring">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${danger ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
          {busy ? <Icon name="refresh" className="w-6 h-6 animate-spin" /> : <Icon name={icon} className="w-6 h-6" />}
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">{busy ? 'Procesando…' : title}</h3>
          {message && !busy && <p className="text-xs text-slate-400 mt-1 whitespace-pre-line">{message}</p>}
          {note && !busy && (
            <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 mt-3 inline-block">
              {note}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={closeWithExit}
            disabled={busy}
            className="py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 transition-all disabled:opacity-60 disabled:pointer-events-none"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className={`py-2.5 rounded-xl text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-70 disabled:pointer-events-none ${
              danger
                ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20'
                : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
            }`}
          >
            {busy && <Icon name="refresh" className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ product, onClose, onConfirm }) {
  useOverlay(true, onClose);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const handleConfirm = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      {!busy && <div className="absolute inset-0" onClick={onClose} />}
      <div className="relative w-full sm:max-w-md glass-strong bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl z-10 text-center space-y-4 animate-modal-spring">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          {busy ? <Icon name="refresh" className="w-6 h-6 animate-spin" /> : <Icon name="alertTriangle" className="w-6 h-6" />}
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">{busy ? 'Eliminando…' : '¿Eliminar producto?'}</h3>
          {!busy && (
            <p className="text-xs text-slate-400 mt-1">
              Estás a punto de borrar <strong className="text-slate-200">{product.name}</strong> del catálogo. Esta acción no se puede deshacer.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 disabled:opacity-60 disabled:pointer-events-none"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className="py-2.5 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-600 shadow-lg shadow-rose-500/20 flex items-center justify-center gap-1.5 disabled:opacity-70 disabled:pointer-events-none"
          >
            {busy && <Icon name="refresh" className="w-3.5 h-3.5 animate-spin" />}
            Sí, Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteOrderModal({ order, onClose, onConfirm }) {
  useOverlay(true, onClose);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const handleConfirm = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      {!busy && <div className="absolute inset-0" onClick={onClose} />}
      <div className="relative w-full sm:max-w-md glass-strong bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl z-10 text-center space-y-4 animate-modal-spring">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          {busy ? <Icon name="refresh" className="w-6 h-6 animate-spin" /> : <Icon name="trash" className="w-6 h-6" />}
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">{busy ? 'Eliminando…' : `¿Eliminar pedido #${order.id}?`}</h3>
          {!busy && (
            <p className="text-xs text-slate-400 mt-1">
              Solo se eliminan pedidos <strong className="text-slate-200">cancelados</strong>. Esta acción no se puede deshacer y lo sacará de la lista de pedidos.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 disabled:opacity-60 disabled:pointer-events-none"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className="py-2.5 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-600 shadow-lg shadow-rose-500/20 flex items-center justify-center gap-1.5 disabled:opacity-70 disabled:pointer-events-none"
          >
            {busy && <Icon name="refresh" className="w-3.5 h-3.5 animate-spin" />}
            Sí, Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// Burbuja de chat compartida por cliente y admin: separa los mensajes a lados
// opuestos según quién los envió, con avatar (inicial del nombre), nombre y hora.
function ChatBubble({ m, order, perspective = 'customer' }) {
  const mine = m.sender === perspective;
  const isCustomerMsg = m.sender === 'customer';
  const name = isCustomerMsg ? order.customerName || 'Cliente' : m.senderName || 'Tienda';
  const initial = (name || 'T').trim().charAt(0).toUpperCase() || 'T';
  const time = m.at
    ? new Date(m.at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : '';
  return (
    <div className={`flex items-end gap-1.5 ${mine ? 'justify-end' : 'justify-start'}`}>
      {!mine && (
        <span className="w-6 h-6 rounded-full bg-slate-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">
          {initial}
        </span>
      )}
      <div className={`max-w-[80%] min-w-0 flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
        <span className={`text-[9px] font-bold px-1 ${mine ? 'text-teal-300/80' : 'text-slate-400'}`}>{name}</span>
        <div
          className={`px-3 py-2 rounded-2xl text-xs leading-snug ${
            mine ? 'bg-teal-500/20 text-teal-100 rounded-br-md' : 'bg-slate-700/70 text-slate-200 rounded-bl-md'
          }`}
        >
          <p className="break-words">{m.text}</p>
        </div>
        {time && <span className="text-[9px] mt-0.5 px-1 opacity-70 text-slate-500">{time}</span>}
      </div>
      {mine && (
        <span className="w-6 h-6 rounded-full bg-teal-500 text-slate-950 flex items-center justify-center text-[10px] font-black shrink-0">
          {initial}
        </span>
      )}
    </div>
  );
}

// Tarjeta de estado del pago digital visible para el cliente: si fue rechazado
// ofrece subir otro comprobante o, para beneficiados, pasar el pedido a cuenta.
// Si fue confirmado, lo avisa.
function PaymentStatusCard({ order, isBenefited, onOrderUpdated, addToast }) {
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState(false);
  const fileRef = useRef(null);

  const applyUpdated = (res) => {
    if (res.ok && res.data?.state?.orders) {
      const updated = res.data.state.orders.find((o) => o.id === order.id);
      if (updated) onOrderUpdated?.(updated);
    }
  };

  const handlePick = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      addToast('La imagen supera 8 MB. Elige una más liviana.', 'error');
      return;
    }
    setUploading(true);
    try {
      const proof = await compressImage(file);
      const res = await api.attachPaymentProof(order.id, order.phone, proof, order.paymentReference || '');
      if (res.ok) {
        applyUpdated(res);
        addToast('Comprobante enviado. Tu pago está en revisión.', 'success');
      } else {
        addToast(res.data?.error || 'No se pudo adjuntar el comprobante', 'error');
      }
    } catch {
      addToast('No se pudo procesar la imagen. Prueba con otra.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleToAccount = async () => {
    if (converting) return;
    setConverting(true);
    try {
      const res = await api.convertOrderToCredit(order.id, order.phone);
      if (res.ok) {
        applyUpdated(res);
        addToast('Pedido enviado a tu cuenta.', 'success');
      } else {
        addToast(res.data?.error || 'No se pudo pasar el pedido a cuenta', 'error');
      }
    } finally {
      setConverting(false);
    }
  };

  if (!order.paymentMethod || order.paymentMethod === 'efectivo') return null;

  const status = order.paymentStatus || 'pendiente';

  // Pagado con saldo a favor de la cartera: identificador propio, sin comprobante.
  if (order.paymentMethod === 'cartera' || Number(order.walletApplied || 0) > 0) {
    return (
      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/40 p-3 flex items-center gap-2.5">
        <Icon name="wallet" className="w-5 h-5 text-emerald-400 shrink-0" />
        <div>
          <p className="text-sm font-bold text-emerald-300">Pagado con Mi Cartera</p>
          <p className="text-[11px] text-emerald-200/70">
            Se usó {formatUsd(Number(order.walletApplied || 0) || Number(order.total) || 0)} de tu saldo a favor. ¡Gracias!
          </p>
        </div>
      </div>
    );
  }

  if (status === 'confirmado') {
    return (
      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/40 p-3 flex items-center gap-2.5">
        <Icon name="check" className="w-5 h-5 text-emerald-400 shrink-0" />
        <div>
          <p className="text-sm font-bold text-emerald-300">Pago confirmado</p>
          <p className="text-[11px] text-emerald-200/70">¡Gracias! Tu pago fue aceptado.</p>
        </div>
      </div>
    );
  }

  if (status === 'rechazado') {
    return (
      <div className="rounded-xl bg-rose-500/10 border border-rose-500/40 p-3 space-y-3">
        <div className="flex items-center gap-2.5">
          <Icon name="alertTriangle" className="w-5 h-5 text-rose-400 shrink-0" />
          <div>
            <p className="text-sm font-bold text-rose-300">Tu pago fue rechazado</p>
            <p className="text-[11px] text-rose-200/70">
              {isBenefited
                ? 'Puedes subir otro comprobante o pasar el pedido a tu cuenta.'
                : 'Sube otro comprobante para que lo revisemos de nuevo.'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="py-2.5 px-3 rounded-xl bg-teal-500/15 border border-teal-500/40 text-teal-300 text-xs font-bold hover:bg-teal-500/25 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            <Icon name="upload" className="w-4 h-4" />
            {uploading ? 'Subiendo…' : 'Subir otro comprobante'}
          </button>
          {isBenefited && (
            <button
              onClick={handleToAccount}
              disabled={converting}
              className="py-2.5 px-3 rounded-xl bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 text-xs font-bold hover:bg-indigo-500/25 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              <Icon name="creditCard" className="w-4 h-4" />
              {converting ? 'Enviando…' : 'Añadir a mi cuenta'}
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePick} />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-amber-500/10 border border-amber-500/40 p-3 flex items-center gap-2.5">
      <Icon name="clock" className="w-5 h-5 text-amber-400 shrink-0" />
      <div>
        <p className="text-sm font-bold text-amber-300">Pago en revisión</p>
        <p className="text-[11px] text-amber-200/70">Estamos verificando tu comprobante.</p>
      </div>
    </div>
  );
}

// Factura QR 360: genera el QR de la factura del pedido (vía API pública de QR)
// y lo presenta con un giro 3D al hacer tap, mostrando el resumen por detrás.
function FacturaQr360({ order, rate }) {
  const [flipped, setFlipped] = useState(false);
  const lines = [
    `Factura Kiosko 24/7`,
    `Pedido #${order.id}`,
    `Fecha: ${order.timestamp || '—'}`,
    ...(Array.isArray(order.items) ? order.items.map((it) => `${it.quantity}x ${it.name}`) : []),
    `Total: ${formatUsd(order.total)}`
  ];
  const qrData = encodeURIComponent(lines.join('\n'));
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${qrData}`;
  const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className="rounded-2xl bg-slate-800/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Icon name="scan" className="w-4 h-4 text-teal-400" /> Factura QR 360
        </span>
        <span className="px-1.5 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-300 text-[9px] font-bold uppercase tracking-wider">
          {flipped ? 'Resumen' : 'Escaneable'}
        </span>
      </div>

      <div className="perspective-800" onClick={() => !reducedMotion && setFlipped((f) => !f)}>
        <div
          className="relative w-full aspect-[3/4] max-h-72 mx-auto preserve-3d cursor-pointer transition-transform duration-500"
          style={{ transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        >
          {/* Frente: QR */}
          <div className="absolute inset-0 backface-hidden rounded-2xl glass-strong bg-slate-900 border border-slate-700 flex flex-col items-center justify-center gap-3 p-4">
            <img
              src={qrUrl}
              alt={`Código QR de la factura #${order.id}`}
              className="w-44 h-44 rounded-xl bg-white p-2"
              loading="lazy"
            />
            <p className="text-[11px] text-slate-400 text-center">
              Escanea para ver tu factura del pedido #{order.id}.
              {!reducedMotion && <span className="block text-teal-400 mt-1">Toca para girar y ver el resumen</span>}
            </p>
          </div>
          {/* Reverso: resumen */}
          <div
            className="absolute inset-0 backface-hidden rounded-2xl bg-gradient-to-br from-teal-950/60 to-slate-900 border border-teal-500/30 flex flex-col justify-between p-4"
            style={{ transform: 'rotateY(180deg)' }}
          >
            <div>
              <p className="text-[9px] uppercase tracking-widest text-teal-400 font-bold">Empresas Alvarados</p>
              <p className="text-[10px] text-slate-400">Kiosko 24/7 · Resumen de factura</p>
            </div>
            <div className="space-y-1.5 my-2 max-h-28 overflow-y-auto scrollbar-none">
              {(order.items || []).map((it, i) => (
                <div key={i} className="flex justify-between text-[11px]">
                  <span className="text-slate-300 truncate pr-2">{it.quantity}x {it.name}</span>
                  <span className="text-white font-bold shrink-0">{formatUsd(it.price * it.quantity)}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="border-t border-slate-700 pt-2 flex justify-between items-center">
                <span className="text-[11px] text-slate-400">Total</span>
                <span className="text-base font-black text-teal-300">
                  {formatUsd(order.total)}
                  {rate?.rate > 0 && (
                    <span className="block text-[10px] text-teal-400/70 text-right">{formatBs(usdToBs(order.total, rate.rate))}</span>
                  )}
                </span>
              </div>
              <p className="text-[9px] text-slate-500 mt-2">Pedido #{order.id} · {order.timestamp}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderDetailModal({ order, rate, onClose, onTrackLiveOrder, onRequestCancelOrder, isBenefited, onOrderUpdated, addToast, headerHeight = 0 }) {
  useOverlay(true, onClose);
  // Swipe hacia abajo para cerrar (solo móvil / bottom sheet).
  const sheetRef = useSwipeToClose(onClose);
  const style = STATUS_STYLES[order.status] || STATUS_STYLES.pendiente;
  const cancellable = order.status === 'pendiente' || order.status === 'en_preparacion';
  const trackable = order.type === 'delivery' && order.status !== 'cancelado' && order.status !== 'entregado';
  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] overflow-hidden animate-fade-in" style={{ top: headerHeight }}>
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative h-full flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div ref={sheetRef} className="pointer-events-auto relative w-full sm:max-w-lg glass-strong bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden z-10 animate-modal-spring max-h-full flex flex-col">
        {/* Asa de arrastre (móvil): la hoja se cierra deslizando hacia abajo */}
        <div className="sm:hidden absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-slate-600/70 pointer-events-none z-20" aria-hidden="true" />
        <div className="p-4 sm:p-6 border-b border-slate-800 shrink-0 bg-slate-900 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white">
              Detalle del Pedido <span className="text-teal-400">#{order.id}</span>
            </h3>
            <span className={`inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${needsPaymentValidation(order) ? 'border-amber-400/40 bg-amber-500/15 text-amber-300' : style.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${needsPaymentValidation(order) ? 'bg-amber-400' : style.dot}`} />
              {needsPaymentValidation(order) ? 'Pago en revisión' : STATUS_LABELS[order.status] || 'Pendiente'}
            </span>
          </div>
          <button onClick={onClose} data-no-swipe className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>

        <div data-sheet-scroll className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          {order.type !== 'delivery' && !['entregado', 'cancelado'].includes(order.status) && (
            <div className="rounded-2xl border border-teal-500/40 bg-teal-500/10 p-4 text-center">
              <p className="text-[11px] uppercase tracking-wider text-teal-300/80 font-black">🔑 Código de retiro</p>
              <p className="font-mono text-3xl font-black tracking-[0.35em] text-white mt-1 pl-[0.35em]">
                {pickupCodeOf(order.id)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Mostralo al retirar tu pedido</p>
            </div>
          )}
          {needsPaymentValidation(order) && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2.5 text-xs text-amber-300 font-semibold">
              <Icon name="clock" className="w-4 h-4 shrink-0" />
              Esperando validación del pago. El pedido avanzará al confirmarse el pago.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-800/60 rounded-xl p-3">
              <span className="text-slate-500 block text-[10px] font-semibold uppercase tracking-wider">Cliente</span>
              <span className="text-white font-bold">{order.customerName || 'Cliente'}</span>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-3">
              <span className="text-slate-500 block text-[10px] font-semibold uppercase tracking-wider">Fecha</span>
              <span className="text-white font-bold">{order.timestamp || '—'}</span>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 text-xs flex items-center gap-2">
            <span className="text-slate-500 font-semibold text-[10px] uppercase tracking-wider">Entrega</span>
            {order.type === 'delivery' ? (
              <>
                <Icon name="mapPin" className="w-3.5 h-3.5 text-amber-300" />
                <span className="text-amber-300 font-bold">{order.address || 'Domicilio'}</span>
                {order.lat != null && order.lng != null && (
                  <a
                    href={`https://www.google.com/maps?q=${order.lat},${order.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300 text-[10px] font-bold hover:bg-sky-500/25 transition-all"
                  >
                    <Icon name="mapPin" className="w-3 h-3" />
                    Abrir en Maps
                  </a>
                )}
                {order.courier_lat != null && order.courier_lng != null && (
                  <span className="text-[10px] font-bold text-emerald-300 ml-auto">Repartidor en vivo</span>
                )}
              </>
            ) : (
              <span className="text-teal-300 font-bold">Retiro por mostrador</span>
            )}
          </div>

          {/* Estado del pago digital (confirmado / en revisión / rechazado con acciones) */}
          <PaymentStatusCard order={order} isBenefited={isBenefited} onOrderUpdated={onOrderUpdated} addToast={addToast} />

          {/* Línea de tiempo animada del pedido */}
          <OrderStepsTimeline order={order} />

          {/* Mapa de entrega a domicilio */}
          <DeliveryMap order={order} />

          <div className="rounded-2xl bg-slate-800/40 p-3 space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">Artículos</span>
            {order.items.map((it, idx) => (
              <div key={idx} className="flex justify-between text-xs">
                <span className="text-slate-300">{it.quantity}x {it.name} <span className="text-slate-500">· {formatUsd(it.price)} c/u</span></span>
                <span className="font-bold text-white">
                  {formatUsd(it.price * it.quantity)}
                  {rate?.rate > 0 && (
                    <span className="block text-[10px] text-slate-500 text-right">{formatBs(usdToBs(it.price * it.quantity, rate.rate))}</span>
                  )}
                </span>
              </div>
            ))}
            <div className="pt-2 border-t border-slate-700 flex justify-between font-bold text-sm text-white">
              <span>Total</span>
              <span className="text-teal-400 text-right">
                {formatUsd(order.total)}
                {rate?.rate > 0 && (
                  <span className="block text-[10px] text-teal-300/90">{formatBs(usdToBs(order.total, rate.rate))}</span>
                )}
              </span>
            </div>
          </div>

          {/* Factura QR 360: código QR con la factura completa y giro 3D */}
          <FacturaQr360 order={order} rate={rate} />

          {order.notes && (
            <div className="rounded-xl bg-slate-800/60 p-3 text-xs">
              <span className="text-slate-500 font-semibold text-[10px] uppercase tracking-wider">Notas</span>
              <p className="text-slate-300 italic mt-1">"{order.notes}"</p>
            </div>
          )}

          {trackable && onTrackLiveOrder && (
            <button
              onClick={() => onTrackLiveOrder(order)}
              className="w-full py-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold text-sm hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-2"
            >
              <Icon name="mapPin" className="w-4 h-4" />
              Rastrear en vivo
            </button>
          )}

          {cancellable && (
            <button
              onClick={() => onRequestCancelOrder(order)}
              className="w-full py-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold text-sm hover:bg-rose-500/25 transition-all flex items-center justify-center gap-2"
            >
              <Icon name="x" className="w-4 h-4" />
              Cancelar este pedido
            </button>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

function CancelOrderModal({ order, onClose, onConfirm }) {
  useOverlay(true, onClose);
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full sm:max-w-md glass-strong bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl z-10 text-center space-y-4 animate-modal-spring">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <Icon name="alertTriangle" className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">¿Cancelar pedido #{order.id}?</h3>
          <p className="text-xs text-slate-400 mt-1">
            El pedido quedará anulado y el stock de sus artículos se devolverá al inventario.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={onClose}
            className="py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700"
          >
            Volver
          </button>
          <button
            onClick={onConfirm}
            className="py-2.5 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-600 shadow-lg shadow-rose-500/20"
          >
            Sí, Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compra Rápida por Voz: helpers de normalización y parsing.
// ---------------------------------------------------------------------------
const normalizeText = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const SPEECH_NUMBER_WORDS = {
  un: 1, uno: 1, una: 1,
  dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  cien: 100, ciento: 100
};

// Parsea un texto como "2 leche y 1 pan" o "agrega dos jugos" y lo convierte en
// [{ productId, qty }] haciendo match contra el catálogo por nombre normalizado.
const parseVoiceOrder = (transcript, products) => {
  const text = normalizeText(transcript);
  if (!text) return [];
  const segments = text.split(/\s+(?:y|coma|con)\s+|\s*,\s*/).filter(Boolean);
  const catalog = (products || []).map((p) => ({
    product: p,
    norm: normalizeText(p.name)
  }));

  const results = [];
  for (const seg of segments) {
    // Liderar palabras de activación irrelevantes al inicio del primer segmento.
    const cleaned = seg.replace(/^(hey|hola|kiosko|kiosco|agrega|agregar|agregame|agregame|anade|pon|pone|quiero|necesito|comprame|dame|por favor|porfavor|quiero pedir|pedido)\s+/g, '');
    let qty = 1;
    let namePart = cleaned;

    // Cantidad al inicio: "2 leche" | "dos leche" | "una empanada".
    const qtyMatch = namePart.match(/^(\d+|[a-z]+)\s+(.+)$/);
    if (qtyMatch) {
      const n = Number(qtyMatch[1]);
      if (!isNaN(n) && n > 0) {
        qty = n;
        namePart = qtyMatch[2];
      } else if (SPEECH_NUMBER_WORDS[qtyMatch[1]]) {
        qty = SPEECH_NUMBER_WORDS[qtyMatch[1]];
        namePart = qtyMatch[2];
      }
    }

    if (!namePart.trim()) continue;
    const segNorm = normalizeText(namePart);

    // Mejor coincidencia: el nombre del producto normalizado está contenido en
    // el segmento, o el segmento está contenido en el nombre del producto.
    let best = null;
    let bestScore = 0;
    for (const c of catalog) {
      let score = 0;
      if (segNorm && c.norm && (c.norm.includes(segNorm) || segNorm.includes(c.norm))) {
        score = 1 + (segNorm.length >= 4 ? 1 : 0);
      } else {
        const segWords = segNorm.split(' ');
        const nameWords = c.norm.split(' ');
        const hit = segWords.filter((w) => w.length >= 3 && nameWords.includes(w)).length;
        score = hit / Math.max(1, nameWords.length);
      }
      if (score > bestScore) {
        bestScore = score;
        best = c.product;
      }
    }
    if (best && bestScore >= 0.5) {
      const existing = results.find((r) => r.product.id === best.id);
      if (existing) existing.qty += qty;
      else results.push({ product: best, qty });
    }
  }
  return results;
};

const speakText = (text) => {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-ES';
    u.rate = 1;
    window.speechSynthesis.speak(u);
  } catch {}
};

const speechRecognitionAvailable = () =>
  typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

// Modal de confirmación de la compra rápida por voz: muestra los artículos
// reconocidos y permite confirmar (agrega al carrito) o reintentar.
function VoiceOrderModal({ items, onConfirm, onRetry, onClose, loading, listening, dialog = [] }) {
  useOverlay(true, onClose);
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full sm:max-w-md glass-strong bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl z-10 space-y-4 animate-modal-spring">
        <div className="flex items-center gap-3">
          <span className={`p-2.5 rounded-2xl shrink-0 ${listening ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'bg-teal-500/20 text-teal-400'}`}>
            <Icon name="mic" className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-white">Compra por voz conversacional</h3>
            <p className="text-xs text-slate-400">
              {listening
                ? 'Escuchando… Decí por ejemplo: "2 leche y 1 pan"'
                : items.length > 0
                  ? '¿Agregamos todo al carrito?'
                  : 'Decime qué querés o tocá "Escuchar".'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>

        {/* Conversación: burbujas kiosko ↔ usuario */}
        {dialog.length > 0 && (
          <div className="max-h-36 overflow-y-auto scrollbar-none space-y-1.5">
            {dialog.map((d, i) => (
              <div key={i} className={`flex ${d.u ? 'justify-end' : 'justify-start'}`}>
                <span
                  className={`max-w-[85%] px-3 py-1.5 rounded-2xl text-xs leading-relaxed ${
                    d.u
                      ? 'bg-teal-500/20 border border-teal-500/40 text-teal-100 rounded-br-sm'
                      : 'bg-slate-800/80 border border-slate-700 text-slate-200 rounded-bl-sm'
                  }`}
                >
                  {d.u || d.kio}
                </span>
              </div>
            ))}
            {listening && (
              <div className="flex justify-start">
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-2xl bg-slate-800/80 border border-slate-700 text-xs text-slate-400 rounded-bl-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                  escuchando…
                </span>
              </div>
            )}
          </div>
        )}

        {listening && (
          <div className="flex items-center justify-center gap-2 py-4">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping" />
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping" style={{ animationDelay: '150ms' }} />
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping" style={{ animationDelay: '300ms' }} />
          </div>
        )}

        {!listening && items.length === 0 ? (
          <p className="text-sm text-slate-400 bg-slate-800/60 border border-slate-700 rounded-2xl p-4">
            Todavía no reconocimos productos. Probá con frases como: <b>"2 leche y 1 pan"</b>.
          </p>
        ) : (
          items.length > 0 && (
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.product.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700">
                  <ProductImg product={it.product} alt={it.product.name} className="w-10 h-10 rounded-lg object-cover bg-slate-900 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-slate-200 truncate">{it.product.name}</span>
                    <span className="text-[11px] text-teal-400 font-bold">{formatUsd(it.product.price)} c/u</span>
                  </div>
                  <span className="shrink-0 px-2 py-1 rounded-lg glass-strong bg-slate-900 border border-slate-700 text-sm font-black text-white">x{it.qty}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-black pt-1">
                <span className="text-slate-300">Total</span>
                <span className="text-teal-400">
                  {formatUsd(items.reduce((acc, it) => acc + it.product.price * it.qty, 0))}
                </span>
              </div>
            </div>
          )
        )}

        <div className="grid grid-cols-2 gap-3">
          <Btn
            onClick={onRetry}
            disabled={listening}
            variant="secondary"
            size="md"
            icon="refresh"
          >
            Escuchar
          </Btn>
          <Btn
            onClick={onConfirm}
            disabled={loading || items.length === 0 || listening}
            variant="primary"
            size="md"
            icon="check"
            loading={loading}
            className="shadow-lg shadow-teal-500/20"
          >
            {loading ? 'Agregando...' : 'Agregar al carrito'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// Dashboard personal "Mi Kiosko": resumen del cliente con gasto, pedidos,
// productos favoritos, rachas y próximos pedidos activos.
function MyKioskoModal({ customer, customerName, orders, products, rate, onClose, onRepeatLastOrder, headerHeight = 0 }) {
  useOverlay(true, onClose);
  // Swipe hacia abajo para cerrar (solo móvil / bottom sheet).
  const sheetRef = useSwipeToClose(onClose);
  const customerOrders = useMemo(() => {
    if (!customer?.phone) return [];
    const key = normalizePhoneDigits(customer.phone);
    const now = new Date();
    // Solo el mes calendario en curso: evita arrastrar todo el historial.
    return (orders || []).filter((o) => {
      if (normalizePhoneDigits(o.phone) !== key) return false;
      const d = new Date(o.createdAt || o.timestamp);
      return !isNaN(d) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
  }, [customer, orders]);

  const stats = useMemo(() => {
    const totalOrders = customerOrders.length;
    const totalSpent = customerOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
    const activeOrders = customerOrders.filter((o) => !['entregado', 'cancelado'].includes(o.status));

    const byProduct = {};
    customerOrders.forEach((o) => {
      (o.items || []).forEach((it) => {
        byProduct[it.id] = (byProduct[it.id] || 0) + (Number(it.quantity) || 0);
      });
    });
    const topProducts = Object.entries(byProduct)
      .map(([id, qty]) => ({ product: (products || []).find((p) => p.id === id), qty }))
      .filter((t) => t.product)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 3);

    const totalItems = customerOrders.reduce((acc, o) => acc + (o.items || []).reduce((a, it) => a + (Number(it.quantity) || 0), 0), 0);

    return { totalOrders, totalSpent, activeOrders, topProducts, totalItems };
  }, [customerOrders, products]);

  const balance = Number(customer?.balance) || 0;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] overflow-hidden animate-fade-in"
      style={{ top: headerHeight }}
    >
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative h-full flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div ref={sheetRef} className="pointer-events-auto relative w-full sm:max-w-lg glass-strong bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-screen-up max-h-full flex flex-col">
        {/* Asa de arrastre (móvil): la hoja se cierra deslizando hacia abajo */}
        <div className="sm:hidden absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-slate-600/70 pointer-events-none z-20" aria-hidden="true" />
<div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Icon name="zap" className="w-5 h-5 text-teal-400" />
                Mi historial
              </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Hola {customerName?.split(' ')[0] || 'cliente'} · Tu resumen del mes
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div data-sheet-scroll className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Métricas principales */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Gasto del mes</span>
              <span className="block text-lg font-black text-white mt-0.5">{formatUsd(stats.totalSpent)}</span>
              {rate?.rate > 0 && <span className="text-[10px] text-slate-500">{formatBs(usdToBs(stats.totalSpent, rate.rate))}</span>}
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Pedidos del mes</span>
              <span className="block text-lg font-black text-teal-400 mt-0.5">{stats.totalOrders}</span>
              <span className="text-[10px] text-slate-500">en lo que va del mes</span>
            </div>
          </div>

          {/* Rachas / actividad */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Artículos del mes</span>
              <span className="block text-lg font-black text-white mt-0.5">{stats.totalItems}</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Pedidos activos</span>
              <span className="block text-lg font-black text-white mt-0.5">{stats.activeOrders.length}</span>
              <span className="text-[10px] text-slate-500">en preparación / en camino</span>
            </div>
          </div>

          {/* Saldo / beneficio */}
          <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Saldo pendiente</span>
              <span className={`block text-lg font-black mt-0.5 ${balance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {formatUsd(balance)}
              </span>
            </div>
            {customer?.isBenefited ? (
              <span className="px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[10px] font-bold">
                ✓ Beneficiado
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-slate-700/40 text-slate-300 text-[10px] font-bold">Pago a la entrega</span>
            )}
          </div>

          {/* Productos favoritos del mes */}
          <div>
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Tus favoritos del mes</span>
            {stats.topProducts.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-900/50 p-3 rounded-xl mt-1.5">
                Aún no tienes pedidos este mes. ¡Tu primer antojo aparecerá aquí!
              </p>
            ) : (
              <div className="space-y-2 mt-1.5">
                {stats.topProducts.map((t) => (
                  <div key={t.product.id} className="flex items-center gap-3 p-2 rounded-xl bg-slate-800/50 border border-slate-700/60">
                    <ProductImg product={t.product} alt={t.product.name} className="w-9 h-9 rounded-lg object-cover bg-slate-900 shrink-0" />
                    <span className="flex-1 min-w-0 text-xs font-semibold text-slate-200 truncate">{t.product.name}</span>
                    <span className="text-[11px] font-black text-teal-400">{t.qty}x</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Repetir último pedido */}
          {customerOrders.length > 0 && (
            <Btn
              onClick={() => {
                onClose();
                onRepeatLastOrder?.();
              }}
              className="w-full !py-2.5"
              icon="refresh"
              variant="primary"
              size="md"
            >
              Repetir mi último pedido
            </Btn>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

// Modal "Compartir Carrito": el dueño genera un enlace para que familia/amigos
// sumen artículos y vea el carrito unificado en tiempo real.
function ShareCartModal({ share, onClose, onCopy, onWhatsApp, onCloseShare, products }) {
  useOverlay(true, onClose);
  const link = share?.url || '';
  const [copied, setCopied] = useState(false);

  const copy = () => {
    onCopy(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const sharedItems = (share?.items || []).map((it) => {
    const live = (products || []).find((p) => p.id === it.id);
    return { ...it, name: it.name || live?.name || it.id, price: it.price || live?.price || 0, image: it.image || live?.image || '' };
  });
  const sharedTotal = sharedItems.reduce((acc, it) => acc + Number(it.price) * Number(it.qty), 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full sm:max-w-md glass-strong bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl pt-[max(1.25rem,env(safe-area-inset-top))] p-5 sm:p-6 shadow-2xl z-10 space-y-4 animate-modal-spring max-h-[92vh] flex flex-col">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 shrink-0">
            <Icon name="users" className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-white">Carrito compartido</h3>
            <p className="text-xs text-slate-400">Compartí el enlace y todos suman al mismo carrito.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Enlace de tu carrito</span>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
              className="flex-1 min-w-0 px-3 py-2 rounded-xl glass-strong bg-slate-900 border border-slate-700 text-[11px] text-teal-300 font-mono focus:outline-none"
            />
            <button
              onClick={copy}
              className="shrink-0 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold"
            >
              {copied ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
          <Btn
            onClick={() => onWhatsApp(link)}
            variant="secondary"
            size="md"
            icon="whatsapp"
            className="w-full !border-emerald-500/50 !text-emerald-300 hover:!bg-emerald-600/30"
          >
            Compartir por WhatsApp
          </Btn>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
            Artículos en el carrito ({sharedItems.length})
          </span>
          {sharedItems.length === 0 ? (
            <p className="text-xs text-slate-500 bg-slate-900/50 p-3 rounded-xl">
              Tu carrito está vacío por ahora. Los artículos que agreguen tus invitados aparecerán aquí en vivo.
            </p>
          ) : (
            sharedItems.map((it) => (
              <div key={it.id} className="flex items-center gap-3 p-2 rounded-xl bg-slate-800/50 border border-slate-700/60">
                <ProductImg image={it.image} name={it.name} alt={it.name} className="w-9 h-9 rounded-lg object-cover bg-slate-900 shrink-0" />
                <span className="flex-1 min-w-0 text-xs font-semibold text-slate-200 truncate">{it.name}</span>
                <span className="text-[11px] font-black text-white">{it.qty}x</span>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-between text-sm font-black border-t border-slate-800 pt-3">
          <span className="text-slate-300">Total del carrito</span>
          <span className="text-teal-400">{formatUsd(sharedTotal)}</span>
        </div>

        <button
          onClick={onCloseShare}
          className="w-full py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold hover:bg-rose-500/25"
        >
          Cerrar carrito compartido
        </button>
      </div>
    </div>
  );
}

// Panel admin de abonos a la deuda: lista los pagos con comprobante que los
// clientes subieron. El admin abre el comprobante, verifica y aprueba (aplica
// el descuento al balance del cliente) o rechaza con nota.
// Agrupa por cliente y separa "Depósitos a cartera" (saldo a favor) de "Abonos a deuda".
function PaymentsAdminView({ payments, onLoadPayments, onApprovePayment, onRejectPayment }) {
  const [showProofId, setShowProofId] = useState(null);
  const [proof, setProof] = useState(null);
  const [loadingProof, setLoadingProof] = useState(false);
  const [note, setNote] = useState('');
  const [rejectingId, setRejectingId] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [expandedClient, setExpandedClient] = useState(null);

  useEffect(() => {
    onLoadPayments();
  }, [onLoadPayments]);

  const openProof = async (payment) => {
    setShowProofId(payment.id);
    setProof(null);
    setLoadingProof(true);
    try {
      const res = await api.getPaymentProof(payment.id, payment.phone);
      setProof(res.ok ? res.data?.proof : null);
    } catch {
      setProof(null);
    } finally {
      setLoadingProof(false);
    }
  };

  const approve = async (payment) => {
    setActionLoading(payment.id);
    try {
      const ok = await onApprovePayment(payment.id);
      if (ok) {
        setShowProofId(null);
        setNote('');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const reject = async (payment) => {
    setActionLoading(payment.id);
    try {
      const ok = await onRejectPayment(payment.id, note);
      if (ok) {
        setShowProofId(null);
        setRejectingId(null);
        setNote('');
      }
    } finally {
      setActionLoading(null);
    }
  };

  // Agrupa pagos por cliente (teléfono)
  const paymentsByClient = payments.reduce((acc, p) => {
    const key = p.phone;
    if (!acc[key]) acc[key] = { phone: key, name: p.customerName, payments: [] };
    acc[key].payments.push(p);
    return acc;
  }, {});

  // Para cada cliente, ordena pagos por fecha descendente
  const clients = Object.values(paymentsByClient).map((client) => {
    client.payments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return client;
  });

  const STATUS_BADGE = {
    pendiente: { text: 'Por verificar', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
    aprobado: { text: 'Aprobado', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
    rechazado: { text: 'Rechazado', cls: 'text-rose-300 bg-rose-500/10 border-rose-500/30' }
  };

  const renderPayment = (p, clientPhone) => (
    <div key={p.id} className="rounded-2xl glass-strong bg-slate-900 border border-slate-700/70 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-cyan-400 text-xs">{p.id}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${(STATUS_BADGE[p.status] || STATUS_BADGE.pendiente).cls}`}>
              {(STATUS_BADGE[p.status] || STATUS_BADGE.pendiente).text}
            </span>
          </div>
          <p className="text-sm font-bold text-white mt-1.5">{p.customerName}</p>
          <p className="text-[11px] text-slate-500">{p.phone}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-black text-white">{formatBs(Number(p.amountBs))}</p>
          <p className="text-xs font-bold text-teal-300">≈ {formatUsd(Number(p.amountUsd))}</p>
          <p className="text-[10px] text-slate-500">a Bs {Number(p.rate).toFixed(2)}</p>
        </div>
      </div>
      <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
        <span>{new Date(p.createdAt).toLocaleString('es-VE')}</span>
        {p.reference ? <span>Ref: {p.reference}</span> : null}
      </div>

      {p.status === 'pendiente' && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openProof(p)}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-sky-500/15 border border-sky-500/40 text-sky-300 hover:bg-sky-500/25 transition-all inline-flex items-center justify-center gap-1.5"
          >
            <Icon name="eye" className="w-4 h-4" />
            Ver comprobante
          </button>
          <button
            onClick={() => approve(p)}
            disabled={actionLoading === p.id}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 transition-all inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {actionLoading === p.id ? (
              <Icon name="refresh" className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Icon name="check" className="w-4 h-4" /> Aprobar
              </>
            )}
          </button>
        </div>
      )}
      {p.status === 'rechazado' && p.note && (
        <p className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/20 p-2 rounded-xl">
          Nota: {p.note}
        </p>
      )}

      {showProofId === p.id && (
        <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 space-y-3 animate-fade-in">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Icon name="image" className="w-3.5 h-3.5" /> Comprobante
          </span>
          {loadingProof ? (
            <div className="w-full h-40 flex items-center justify-center bg-slate-800/60 rounded-xl">
              <Icon name="refresh" className="w-6 h-6 text-teal-400 animate-spin" />
            </div>
          ) : proof ? (
            <img src={proof} alt="Comprobante del abono" className="w-full max-h-72 rounded-xl object-contain bg-slate-900 border border-slate-800" />
          ) : (
            <p className="text-xs text-slate-500 bg-slate-800/60 p-3 rounded-xl text-center">
              No se pudo cargar el comprobante.
            </p>
          )}
          {p.status === 'pendiente' && (
            <div className="space-y-2">
              {rejectingId === p.id ? (
                <div className="space-y-2">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Motivo del rechazo (se envía al cliente)…"
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:border-rose-500 focus:outline-none resize-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setRejectingId(null);
                        setNote('');
                      }}
                      className="py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                    >
                      Volver
                    </button>
                    <button
                      onClick={() => reject(p)}
                      disabled={actionLoading === p.id}
                      className="py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold disabled:opacity-60"
                    >
                      {actionLoading === p.id ? (
                        <Icon name="refresh" className="w-4 h-4 animate-spin mx-auto" />
                      ) : (
                        'Confirmar rechazo'
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setRejectingId(p.id);
                    setNote('');
                  }}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/25 transition-all inline-flex items-center justify-center gap-1.5"
                >
                  <Icon name="x" className="w-4 h-4" />
                  Rechazar abono
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderClient = (client) => {
    const pendientes = client.payments.filter((p) => p.status === 'pendiente');
    const aprobados = client.payments.filter((p) => p.status === 'aprobado');
    const rechazados = client.payments.filter((p) => p.status === 'rechazado');
    const isExpanded = expandedClient === client.phone;

    const totalAprobado = aprobados.reduce((sum, p) => sum + Number(p.amountUsd || 0), 0);
    const totalPendiente = pendientes.reduce((sum, p) => sum + Number(p.amountUsd || 0), 0);

    return (
      <div key={client.phone} className="rounded-2xl glass-strong bg-slate-900 border border-slate-700/70 overflow-hidden">
        <button
          onClick={() => setExpandedClient(isExpanded ? null : client.phone)}
          className="w-full p-4 flex items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              totalAprobado > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'
            }`}>
              <Icon name={totalAprobado > 0 ? 'wallet' : 'creditCard'} className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-white truncate">{client.name || 'Cliente'}</p>
                <span className="font-mono text-cyan-400 text-xs">{client.phone}</span>
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-2">
                <span>{client.payments.length} pagos</span>
                <span>·</span>
                <span className="text-teal-300 font-bold">Aprobados: {formatUsd(totalAprobado)}</span>
                <span>·</span>
                <span className="text-amber-300 font-bold">Pendientes: {formatUsd(totalPendiente)}</span>
                <span>·</span>
                <span className="text-rose-300 font-bold">Rechazados: {rechazados.length}</span>
              </p>
            </div>
          </div>
          <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} className="w-5 h-5 text-slate-400 shrink-0" />
        </button>

        {isExpanded && (
          <div className="border-t border-slate-800 p-4 space-y-4">
            {pendientes.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Por verificar ({pendientes.length})
                </span>
                {pendientes.map((p) => renderPayment(p, client.phone))}
              </div>
            )}
            {aprobados.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Aprobados ({aprobados.length}) — Total: {formatUsd(totalAprobado)}
                </span>
                {aprobados.map((p) => renderPayment(p, client.phone))}
              </div>
            )}
            {rechazados.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Rechazados ({rechazados.length})
                </span>
                {rechazados.map((p) => renderPayment(p, client.phone))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="p-4 sm:p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-2xl backdrop-blur-md">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Icon name="wallet" className="w-5 h-5 text-teal-400" />
          Abonos y depósitos
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Los clientes suben comprobantes para abonar deuda o depositar en cartera. Verifica el pago y aprueba:
          el monto (en USD, según la tasa del día) se descuenta de su deuda; el excedente queda como "Mi Cartera".
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4 text-center">
          <div className="rounded-2xl bg-slate-900/80 border border-slate-700/60 p-3">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Clientes con pagos</span>
            <span className="text-2xl font-black text-teal-300">{Object.keys(paymentsByClient).length}</span>
          </div>
          <div className="rounded-2xl bg-slate-900/80 border border-slate-700/60 p-3">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Pagos por verificar</span>
            <span className="text-2xl font-black text-amber-300">{payments.filter((p) => p.status === 'pendiente').length}</span>
          </div>
          <div className="rounded-2xl bg-slate-900/80 border border-slate-700/60 p-3">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Total aprobado (USD)</span>
            <span className="text-2xl font-black text-emerald-300">
              {formatUsd(payments.filter((p) => p.status === 'aprobado').reduce((sum, p) => sum + Number(p.amountUsd || 0), 0))}
            </span>
          </div>
        </div>
      </div>

      {Object.keys(paymentsByClient).length === 0 ? (
        <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-sm text-slate-400 text-center">
          Aún no hay pagos. Cuando un cliente suba un comprobante, aparecerá aquí agrupado por cliente.
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map(renderClient)}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Asistente IA "Don Aiker": chat que responde con datos reales del negocio
// (deuda, pedidos, promos, tasa, productos) usando reglas locales sin API.
// ============================================================================

// Normaliza texto para matching tolerante: minúsculas, sin acentos, sin puntuación.
const normalizeAiText = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Sinónimos comunes de productos para la búsqueda con partial match.
const PRODUCT_SYNONYMS = {
  gaseosa: ['coca', 'pepsi', 'sprite', 'cola', 'chicha', 'jugo', 'refresco'],
  agua: ['agua', 'mineral'],
  pan: ['pan', 'tostada', 'bimbo', 'integral'],
  galleta: ['galleta', 'cookie', 'dulce'],
  cafe: ['cafe', 'capuchino', 'express', 'nescafe'],
  chocolate: ['chocolate', 'sublime', 'nutella'],
  arroz: ['arroz', 'integral'],
  aceite: ['aceite', 'vegetal', 'oliva'],
  azucar: ['azucar', 'endulzante', 'stevia'],
  harina: ['harina', 'maiz', 'pan'],
  pasta: ['pasta', 'fideo', 'espagueti', 'tallarin'],
  cerveza: ['cerveza', 'polar', 'solera', 'zulia'],
  jugo: ['jugo', 'nectar', 'caja'],
  leche: ['leche', 'evaporada', 'entera', 'descremada'],
  queso: ['queso', 'fresco', 'guayanés', 'país'],
  refresco: ['refresco', 'cola', 'cloro', 'pepsi', 'hit'],
  jabon: ['jabon', 'aseo', 'tocador', 'lavanderia'],
  cloro: ['cloro', 'lejia', 'limpieza'],
  pañal: ['pañal', 'pnial', 'panal', 'bebe'],
  papel: ['papel', 'toalla', 'higienico', 'servilleta'],
  velas: ['velas', 'vela'],
  hielo: ['hielo', 'helado']
};

// Palabras de relleno que no deben puntuar en la búsqueda de productos.
const AI_STOPWORDS = new Set([
  'que', 'con', 'para', 'esta', 'este', 'estas', 'estos', 'cual', 'cuales', 'como', 'cuando',
  'donde', 'muy', 'mas', 'menos', 'por', 'los', 'las', 'una', 'uno', 'unos', 'el', 'la', 'lo',
  'de', 'del', 'me', 'mi', 'tu', 'te', 'se', 'su', 'sus', 'y', 'o', 'a', 'hay', 'tienes',
  'tiene', 'tengo', 'quiero', 'quieres', 'puedes', 'podrias', 'favor', 'disponible', 'precio',
  'cuanto', 'cuanta', 'cuantos', 'cuantas', 'es', 'son', 'estoy', 'eso', 'eso', 'algo', 'dame',
  'da', 'haz', 'muestra', 'dime', 'decime', 'saber', 'queria', 'quisiera', 'puedo', 'agregar',
  'agregame', 'comprar', 'compra', 'pasame', 'pasar', 'busca', 'buscar', 'opcion', 'opciones'
]);

// Obtiene matches del texto contra el catálogo con scoring estricto: nombre completo,
// contención del texto completo, token exacto, token parcial (3+ letras) y sinónimos.
// Devuelve hasta `limit` y solo si el mejor match supera el umbral.
function matchAiProducts(products, query, limit = 4) {
  if (!Array.isArray(products) || products.length === 0) return [];
  const q = normalizeAiText(query);
  if (!q) return [];
  const tokens = q.split(' ').filter((t) => t.length > 2 && !AI_STOPWORDS.has(t));
  const scored = (products || [])
    .filter((p) => p && p.name)
    .map((p) => {
      const n = normalizeAiText(p.name);
      const nameTokens = n.split(' ').filter((t) => t.length > 2 && !AI_STOPWORDS.has(t));
      let score = 0;
      if (n === q) score += 100;
      else if (q.length > 3 && n.includes(q)) score += 70;
      else if (tokens.length && tokens.some((t) => nameTokens.some((nt) => nt === t))) score += 50;
      // partial match por token relevante (nunca con stopwords ni tokens de 1-2 letras)
      tokens.forEach((t) => {
        if (t.length >= 3 && nameTokens.some((nt) => nt.startsWith(t))) score += 20;
        else if (nameTokens.some((nt) => nt.length >= 4 && (nt.includes(t) || t.startsWith(nt)))) score += 20;
      });
      // sinónimos: solo si la keyword aparece completa en la pregunta
      Object.entries(PRODUCT_SYNONYMS).forEach(([kw, alts]) => {
        if (q.includes(kw)) {
          alts.forEach((alt) => {
            if (n.includes(alt)) score += 25;
          });
        }
      });
      return { p, score };
    })
    .filter((x) => x.score >= 40)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.p);
}

// Lectura de la respuesta del asistente en voz alta (TTS).
const sayAi = (text) => speakText(text);

// Menú de capacidades del asistente: el cliente escribe el número del punto
// que desea ejecutar y el chat lo resuelve. Texto con puntos numerados.
const AI_HELP_MENU = [
  { n: 1, text: 'Consultar mi deuda o saldo' },
  { n: 2, text: 'Ver mi último pedido y dónde va' },
  { n: 3, text: 'Promos y ofertas activas' },
  { n: 4, text: 'La tasa del día (dólar/bolívar)' },
  { n: 5, text: 'Repetir mi último pedido' },
  { n: 6, text: 'Ver el catálogo y agregar productos' },
  { n: 7, text: 'Ver mi carrito o ir a pagar' },
  { n: 8, text: 'Hablar con una persona del kiosko' }
];

// Texto de la respuesta con la lista de puntos que muestra el botón de ayuda.
const AI_HELP_TEXT = `Claro, te cuento todo lo que puedo hacer por ti 😊\n\n${AI_HELP_MENU.map(
  (m) => `${m.n}. ${m.text}`
).join('\n')}\n\nEscribe el número del punto que quieres y lo ejecuto enseguida.`;

// Bienvenida proactiva contextual según lo que el cliente tiene en curso.
function buildAiWelcome(params) {
  const { name, activePromos, pendingOrder, balance } = params || {};
  const parts = [`¡Hola${name ? `, ${name}` : ''}! Soy Don Aiker, el asistente del kiosko 📣`];
  if (Array.isArray(activePromos) && activePromos.length) {
    const n = activePromos.length;
    parts.push(`Mira, hoy hay ${n} promo${n > 1 ? 's' : ''} activa${n > 1 ? 's' : ''} 🎉.`);
  }
  if (pendingOrder) {
    const label =
      pendingOrder.status === 'en_camino'
        ? 'tu pedido está en camino, seguilo abajo 🛵'
        : `tienes ${pendingOrder.id} en curso (${STATUS_LABELS[pendingOrder.status] || pendingOrder.status})`;
    parts.push(label);
  } else if (balance > 0) {
    parts.push(`Recuerda que tienes ${formatUsd(balance)} de deuda pendiente.`);
  }
  parts.push('Toca una pregunta rápida o pide un producto. Puedo contarte tu deuda, tus pedidos, las promos, la tasa y agregar al carrito. 😊');
  return parts.join('\n');
}

function AikerAssistant({
  customer,
  customerOrders,
  products,
  promos,
  rate,
  savedCustomer,
  storeLocation,
  cartCount = 0,
  headerHeight = 0,
  onClose,
  onOpenDebt,
  onOpenOrders,
  onTrackOrder,
  onAddToCart,
  onRepeatLastOrder,
  onOpenCart,
  onOpenCheckout
}) {
  const [messages, setMessages] = useState(() => [
    {
      from: 'ai',
      text: (() => {
        const bal = Number(customer?.balance) || 0;
        const ordinal = customer ? normalizePhoneDigits(customer.phone) : null;
        const ords = (customerOrders || []).filter((o) => (ordinal ? normalizePhoneDigits(o.phone) === ordinal : true));
        const pend = ords.find((o) => !['entregado', 'cancelado'].includes(o.status)) || null;
        const active = (promos || []).filter((p) => p.active);
        const firstName = customer?.customerName?.split(' ')[0] || savedCustomer?.customerName?.split(' ')[0] || '';
        return buildAiWelcome({ name: firstName, activePromos: active, pendingOrder: pend, balance: bal });
      })()
    }
  ]);
  const [thinking, setThinking] = useState(false);
  const [action, setAction] = useState([{ kind: 'help', label: 'Conoce en qué te puedo ayudar', icon: 'sparkles' }]);
  const [followUps, setFollowUps] = useState([]);
  const [draft, setDraft] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [listening, setListening] = useState(false);
  const [speechOn, setSpeechOn] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [liveOrder, setLiveOrder] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const recRef = useRef(null);
  const replyTimerRef = useRef(null);

  useOverlay(true, onClose);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking, liveOrder]);

  useEffect(() => () => clearTimeout(replyTimerRef.current), []);

  const balance = Number(customer?.balance) || 0;
  const name = customer?.customerName?.split(' ')[0] || savedCustomer?.customerName?.split(' ')[0] || 'cliente';

  const myOrders = (customerOrders || []).filter((o) =>
    customer ? normalizePhoneDigits(o.phone) === normalizePhoneDigits(customer.phone) : true
  );
  const activePromos = (promos || []).filter((p) => p.active);

  // Productos populares del catálogo para el acceso rápido "Agregar".
  const popular = useMemo(() => {
    if (!Array.isArray(products) || products.length === 0) return [];
    const freq = {};
    (customerOrders || []).forEach((o) =>
      (o.items || []).forEach((it) => {
        freq[it.id] = (freq[it.id] || 0) + (Number(it.quantity) || 0);
      })
    );
    return [...products]
      .sort((a, b) => (freq[b.id] || 0) - (freq[a.id] || 0) || Number(b.stock || 0) - Number(a.stock || 0))
      .slice(0, 3);
  }, [products, customerOrders]);

  // Preguntas rápidas base (según el estado real del cliente).
  const baseReplies = ['¿Cuánto debo?', '¿Dónde está mi pedido?', 'Promos activas', '¿Cuál es la tasa?'];
  const quickReplies = myOrders.length ? [...baseReplies, 'Repetir mi último pedido'] : baseReplies;

  const appendAi = (text) => setMessages((m) => [...m, { from: 'ai', text }]);

  // Detector de intención: scoring sobre texto normalizado en vez de solo
  // keywords crudas. Calcula un puntaje por categoría y gana la mejor reunión.
  const respond = (q) => {
    const raw = String(q || '').trim();
    const t = normalizeAiText(raw);
    if (!t) return null;

    // ---- Menú de capacidades: "¿qué puedes hacer?" o un número del menú ----
    if (/que puedes hacer|que haces|en que me ayudas|como me ayudas|como puedes ayudarme|menu|puntos|como funciona/.test(t)) {
      return {
        text: AI_HELP_TEXT,
        followUps: AI_HELP_MENU.map((m) => String(m.n))
      };
    }
    if (/^\d{1,2}$/.test(t)) {
      const n = Number(t);
      const item = AI_HELP_MENU.find((m) => m.n === n);
      if (item) {
        const map = {
          1: '¿Cuánto debo?',
          2: '¿Dónde está mi pedido?',
          3: 'Promos activas',
          4: '¿Cuál es la tasa?',
          5: 'Repetir mi último pedido',
          6: '¿Qué venden?',
          7: 'Ver mi carrito',
          8: 'Quiero hablar con una persona real'
        };
        return respond(map[n]);
      }
      return {
        text: `Ese punto (${n}) no está en la lista. Escribí un número del 1 al ${AI_HELP_MENU.length} o tocá la opción de abajo.`,
        followUps: AI_HELP_MENU.map((m) => String(m.n))
      };
    }

    // ---- Detección de productos (siempre primero: "agregar milka") ----
    const matches = matchAiProducts(products, raw, 4);
    const isProductIntent = /(agregar|quiero|una|un|hnos|da|pide|hay |quiere|cuesta|precio)/.test(t) || !!matches.length;
    if (matches.length) {
      if (matches.length === 1) {
        const prod = matches[0];
        const avail = Math.max(0, Number(prod.stock) - Number(prod.reserved || 0));
        const priceBs = rate?.rate > 0 ? ` (${formatBs(usdToBs(prod.price, rate.rate))})` : '';
        return {
          text: `Encontré "${prod.name}" a ${formatUsd(prod.price)}${priceBs}${
            avail > 0 ? ` con ${avail} ${avail === 1 ? 'unidad' : 'unidades'} en stock` : ', pero está agotado por ahora'
          }.`,
          action: avail > 0 ? { kind: 'product', product: prod, label: 'Agregar al carrito', icon: 'plus' } : null,
          followUps: [
            ...(cartCount > 0 ? ['Ver mi carrito'] : []),
            ...(avail > 0 ? ['Agregar y pagar'] : []),
            'Ver promos activas'
          ]
        };
      }
      // varios matches → mostrar lista con botón por cada producto
      const lines = matches
        .map((p, i) => `${i + 1}. ${p.name} — ${formatUsd(p.price)}`)
        .join('\n');
      return {
        text: `Encontré varias opciones:\n${lines}\n¿Cuál te agrego?`,
        action: matches.map((p) => ({
          kind: 'product',
          product: p,
          label: p.name.split(' ').slice(0, 2).join(' '),
          icon: 'plus'
        })),
        followUps: [...(cartCount > 0 ? ['Ver mi carrito'] : []), 'Ver promos activas']
      };
    }
    if (isProductIntent && products && products.length > 0 && /(agregar|hay |busca)/.test(t)) {
      return {
        text: 'Todavía no encuentro ese producto por nombre. Probá con otro nombre o decime la categoría (ej. "gaseosas", "galletas"). También podés ver todo el catálogo arriba 🔍.',
        followUps: ['Ver promos activas', '¿Qué venden?']
      };
    }

    // ---- Saludo ----
    if (/^(hola|buenas|saludos|hey|que tal|buen dia|buenas tardes|buenas noches|hi|hello)/.test(t)) {
      return {
        text: `¡Hola${name !== 'cliente' ? `, ${name}` : ''}! Soy Don Aiker 🤖 ¿En qué te ayudo hoy? Tocá abajo tu deuda, tus pedidos, las promos, la tasa o un producto.`,
        followUps: quickReplies.slice(0, 4)
      };
    }

    // ---- Deuda / saldo / fiado (atención por pasos para fiado) ----
    const debtIntent = /(deud|debo|adeudo|adeudar|saldo|fiado|credito|cuanto pag|deber|pendiente|abon)/.test(t);
    if (debtIntent) {
      if (!customer) {
        return {
          text: 'Aún no estás identificado. Identifícate con tu número en la tienda para ver tu deuda, tu saldo y tu fiado.',
          followUps: ['Mis pedidos', 'Promos activas']
        };
      }
      const isBenefited = Boolean(customer.isBenefited);
      const creditLimit = Number(customer.creditLimit) || 0;
      const creditInUse = isBenefited && creditLimit > 0 ? Math.min(100, (Math.max(0, balance) / creditLimit) * 100) : 0;

      if (balance > 0) {
        const detail = balanceDetail();
        const head = `Tienes ${formatUsd(balance)} de deuda pendiente.${rate?.rate > 0 ? ` Son ${formatBs(usdToBs(balance, rate.rate))} a la tasa de hoy (Bs ${Number(rate.rate).toFixed(2)}).` : ''}`;
        const text = isBenefited && creditLimit > 0
          ? `${head}\n\nComo beneficiado tienes fiado disponible: usaste ${Math.round(creditInUse)}% de tu tope (${formatUsd(creditLimit)}).\n\nPasos para estar al día:\n1️⃣ Tocá "Abonar ahora" y sube tu comprobante.\n2️⃣ O pásate al kiosko a saldar en efectivo.\n\n${detail}`
          : `${head}\n\nPasos para estar al día:\n1️⃣ Tocá "Abonar ahora" y sube tu comprobante.\n2️⃣ O pásate al kiosko a saldar en efectivo.\n\n${detail}`;
        return {
          text,
          action: [
            { kind: 'debt', label: 'Ver mi deuda desglosada', icon: 'creditCard' },
            { kind: 'debt-whatsapp', label: 'Enviar cuenta por WhatsApp', icon: 'whatsapp' }
          ],
          followUps: [
            ...(isBenefited && creditLimit > 0 ? [`Uso del fiado ${Math.round(creditInUse)}%`] : []),
            'Mis pedidos',
            'Promos activas'
          ]
        };
      }
      if (balance < 0) {
        return {
          text: `Tienes ${formatUsd(Math.abs(balance))} a tu favor en tu cartera 🎉. Al pagar tu próximo pedido elegí "Mi Cartera" para usarlo.`,
          action: { kind: 'debt', label: 'Ver mi saldo', icon: 'wallet' },
          followUps: ['Ver promos activas', '¿Dónde está mi pedido?']
        };
      }
      if (isBenefited && creditLimit > 0) {
        return {
          text: `¡Estás al día! ✅ Como beneficiado tienes ${formatUsd(creditLimit)} de fiado disponible (usaste ${Math.round(creditInUse)}%). Podés pedir a cuenta desde el carrito eligiendo "Sumar a mi cuenta".`,
          followUps: ['Ver promos activas', '¿Qué venden?']
        };
      }
      return {
        text: '¡Estás al día! No tienes deudas pendientes ni saldo a favor.',
        followUps: ['Ver promos activas', '¿Cuál es la tasa?']
      };
    }

    // ---- Pedidos / rastreo (progreso en vivo) ----
    if (/pedido|orden|rastr|donde esta|en camino|entrega|estado|lleg|seguir|seguimiento|d[oó]nde/.test(t)) {
      if (myOrders.length === 0) {
        return {
          text: 'Aún no tienes pedidos registrados con tu número. ¡Haz tu primer pedido en la tienda!',
          followUps: ['¿Qué venden?', 'Promos activas']
        };
      }
      const pending = myOrders.find((o) => !['entregado', 'cancelado'].includes(o.status));
      if (pending) {
        const label =
          pending.status === 'pendiente' ? 'pendiente de confirmar'
            : pending.status === 'en_preparacion' ? 'en preparación'
              : pending.status === 'listo' ? 'listo para retirar'
                : pending.status === 'en_camino' ? 'en camino 🛵' : pending.status;
        return {
          text: `Tu pedido ${pending.id} está ${label} (${STATUS_LABELS[pending.status] || pending.status}).\nTe muestro el avance en vivo acá abajo.`,
          action:
            pending.type === 'delivery' && pending.status === 'en_camino'
              ? { kind: 'track', order: pending, label: 'Abrir seguimiento completo', icon: 'navigation' }
              : { kind: 'orders', label: 'Ver mis pedidos', icon: 'package' },
          liveOrder: pending,
          followUps: ['Repetir mi último pedido', 'Promos activas']
        };
      }
      const latest = myOrders[0];
      return {
        text: `Tu último pedido ${latest.id} fue entregado ✅. ¿Quieres repetirlo?`,
        action: { kind: 'repeat', label: 'Repetir último pedido', icon: 'refresh' },
        followUps: ['Ver promos activas', 'Mis pedidos']
      };
    }

    // ---- Repetir último pedido ----
    if (/repetir|repite|de nuevo|otra vez|de nuevo el pedido/.test(t)) {
      if (myOrders.length === 0) {
        return {
          text: 'No encontré pedidos anteriores para repetir. ¡Haz tu primer pedido en la tienda!',
          followUps: ['¿Qué venden?']
        };
      }
      return {
        text: 'Voy a cargar los artículos de tu último pedido en el carrito 🛒.',
        action: { kind: 'repeat', label: 'Repetir último pedido', icon: 'refresh' },
        followUps: [...(cartCount > 0 ? ['Ver mi carrito', 'Ir a pagar'] : [])]
      };
    }

    // ---- Promos / ofertas ----
    if (/promo|oferta|descuento|rebaja|especial|combos|2x1|barato/.test(t)) {
      if (activePromos.length === 0) {
        return {
          text: 'Hoy no hay promos activas, pero te recomiendo revisar el catálogo por los productos nuevos.',
          followUps: ['¿Qué venden?', '¿Cuál es la tasa?']
        };
      }
      const lines = activePromos.map((p, i) => `${i + 1}. ${p.title}${p.subtitle ? ` — ${p.subtitle}` : ''}`).join('\n');
      return {
        text: `¡Hay ${activePromos.length} promo${activePromos.length > 1 ? 's' : ''} activa${activePromos.length > 1 ? 's' : ''}! 🎉\n${lines}`,
        followUps: ['¿Qué venden?', ...(myOrders.length ? ['Repetir mi último pedido'] : [])]
      };
    }

    // ---- Tasa / dólar / bolívar ----
    if (/tasa|dolar|bolivar|bs |bcv|divisa|cambio|cuanto esta el/.test(t)) {
      if (rate?.rate > 0) {
        return {
          text: `La tasa del día es Bs ${Number(rate.rate).toFixed(2)} por dólar. Por ejemplo, $10 serían ${formatBs(usdToBs(10, rate.rate))} y $50 serían ${formatBs(usdToBs(50, rate.rate))}.`,
          followUps: ['Promos activas', 'Ver promos activas']
        };
      }
      return {
        text: 'Aún no tenemos la tasa del día disponible. Volvé a preguntar en unos minutos o revisa la barra de la tienda.',
        followUps: ['Promos activas', '¿Qué venden?']
      };
    }

    // ---- Productos / catálogo ----
    if (/qu[eé] venden|producto|catalogo|tienes|disponible|vendes|hay de|que hay/.test(t)) {
      if (!Array.isArray(products) || products.length === 0) {
        return {
          text: 'Ahora mismo el catálogo está cargando. Intenta en un momento o mira la barra superior 🔍.',
          followUps: ['Promos activas']
        };
      }
      const cats = [...new Set(products.map((p) => p.category || 'Otros'))];
      return {
        text: `Tenemos ${products.length} productos disponibles en ${cats.length} categoría${cats.length > 1 ? 's' : ''}: ${cats.slice(0, 6).join(', ')}.\nBuscá en la barra superior o navegá por categorías.`,
        followUps: ['Promos activas', ...(myOrders.length ? ['Repetir mi último pedido'] : [])]
      };
    }

    // ---- Horario / abierto ----
    if (/horario|abierto|hora|cuando|abren|cierran|atienden/.test(t)) {
      return {
        text: 'Atendemos de corrido con entrega y retiro en el kiosko 📍. Podés dejar tu pedido a cualquier hora y te lo confirmamos al instante.',
        followUps: ['¿Qué venden?', 'Promos activas']
      };
    }

    // ---- Carrito / pagar (chat transaccional de un toque) ----
    if (/carrito|ir a pagar|pagar ahora|finalizar|quitar/.test(t)) {
      if (cartCount === 0) {
        return {
          text: 'Tu carrito está vacío. ¿Qué te gustaría agregar?',
          followUps: ['¿Qué venden?', 'Promos activas']
        };
      }
      return {
        text: `Tienes ${cartCount} ${cartCount === 1 ? 'artículo' : 'artículos'} en tu carrito. Podés revisarlo o ir directamente a pagar.`,
        action: [
          { kind: 'cart', label: 'Ver mi carrito', icon: 'shoppingBag' },
          { kind: 'checkout', label: 'Ir a pagar ahora', icon: 'arrowRight' }
        ],
        followUps: ['¿Cuál es la tasa?']
      };
    }

    // ---- Agradecimiento ----
    if (/gracias|genial|perfecto|excelente|muchas gracias/.test(t)) {
      return {
        text: `¡Con gusto${name !== 'cliente' ? `, ${name}` : ''}! Recuerda que podés pedir con voz tocando el micrófono 🎤 y que estoy para lo que necesites.`,
        followUps: ['¿Qué venden?', 'Promos activas']
      };
    }

    // ---- Pedir ayuda humana / escalar ----
    if (/humano|persona real|ayuda|problema|no enti|representante|hablar con alguien|atend[ií]eme|queja|reclamo/.test(t)) {
      const notifyAdmins = async () => {
        if (escalated) return;
        setEscalated(true);
        try {
          await api.assistantEscalate({ text: raw, customerName: customer?.customerName || savedCustomer?.customerName || '', phone: customer?.phone || savedCustomer?.phoneNumber || '' });
        } catch {
          /* sin red: no bloquea */
        }
      };
      notifyAdmins();
      return {
        text: `Entiendo, ${name !== 'cliente' ? name : ''}, avisé al equipo del kiosko para que te atienda personalmente 🙌. Sin dudas te ayudarán enseguida. Mientras tanto puedo seguir ayudándote con tu deuda, pedidos o el catálogo.`,
        followUps: ['¿Cuánto debo?', '¿Dónde está mi pedido?', '¿Qué venden?']
      };
    }

    // ---- Fallback con disculpa + herramientas reales ----
    return {
      text: `Perdón, aun estoy aprendiendo y no entendí bien eso. 😅 Dijiste: "${raw}"\n\nProbá con estas opciones y enseguida te ayudo.`,
      action: [
        { kind: 'orders', label: 'Mis pedidos', icon: 'package' },
        { kind: 'debt', label: 'Mi deuda', icon: 'creditCard' },
        { kind: 'catalog', label: 'Ver catálogo', icon: 'search' }
      ],
      followUps: ['Promos activas', '¿Cuál es la tasa?', '¿Qué venden?']
    };
  };

  // Desglose de la deuda en pedidos adeudados (para transparencia).
  const balanceDetail = () => {
    const key = normalizePhoneDigits(customer?.phone || '');
    const debtOrders = myOrders
      .filter((o) => normalizePhoneDigits(o.phone) === key && o.credit && o.status === 'entregado')
      .slice(-3);
    if (debtOrders.length === 0) return '';
    const lines = debtOrders.map(
      (o) => `· ${o.id} (${new Date(o.createdAt || o.timestamp).toLocaleDateString('es-VE')}): ${formatUsd(Number(o.total) || 0)}`
    );
    return `Últimos pedidos adeudados:\n${lines.join('\n')}`;
  };

  const replyWith = (res) => {
    setAction(Array.isArray(res.action) ? res.action : res.action ? [res.action] : null);
    setFollowUps(Array.isArray(res.followUps) ? res.followUps : []);
    setLiveOrder(res.liveOrder || null);
    appendAi(res.text);
    if (speechOn) sayAi(res.text);
    setThinking(false);
  };

  const send = (text) => {
    const q = String(text ?? '').trim();
    if (!q || thinking) return;
    setMessages((m) => [...m, { from: 'user', text: q }]);
    setAction(null);
    setFollowUps([]);
    setLiveOrder(null);
    setThinking(true);
    const delay = 420 + Math.random() * 380;
    replyTimerRef.current = setTimeout(() => {
      const res = respond(q);
      if (res) replyWith(res);
      else setThinking(false);
    }, delay);
  };

  const cancelReply = () => {
    clearTimeout(replyTimerRef.current);
    replyTimerRef.current = null;
    setThinking(false);
    setAction(null);
    setFollowUps([]);
    appendAi('Bueno, la cancelé 😉. Decime en qué te ayudo.');
  };

  // Voz: dictado de la pregunta y lectura de respuestas.
  const toggleListening = () => {
    if (listening) {
      recRef.current?.stop?.();
      recRef.current = null;
      setListening(false);
      return;
    }
    if (!speechRecognitionAvailable()) {
      appendAi('Tu navegador no soporta voz 🎤. Probá escribir tu pregunta.');
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    recRef.current = rec;
    rec.lang = 'es-ES';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setListening(true);
    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || '';
      setListening(false);
      if (transcript.trim()) send(transcript);
    };
    rec.onerror = () => {
      recRef.current = null;
      setListening(false);
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
    };
    rec.start();
  };

  const runAction = (a) => {
    if (!a) return;
    if (a.kind === 'debt') onOpenDebt?.();
    else if (a.kind === 'debt-whatsapp') {
      // Envía la cuenta desglosada por WhatsApp (transparencia ante discrepancias).
      const wa = formatPhoneWhatsApp(customer?.phone);
      if (wa) {
        const msg = buildAccountMessage(customer, myOrders);
        window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
      }
      onClose();
    } else if (a.kind === 'orders') onOpenOrders?.();
    else if (a.kind === 'track') onTrackOrder?.(a.order);
    else if (a.kind === 'repeat') onRepeatLastOrder?.();
    else if (a.kind === 'product') {
      onAddToCart?.(a.product);
      setAction([{ kind: 'cart', label: 'Abrir carrito', icon: 'shoppingBag' }]);
      setFollowUps(['Ir a pagar']);
      setLiveOrder(null);
      appendAi(`Listo, agregué "${a.product.name}" a tu carrito 🛒.`);
    } else if (a.kind === 'cart') onOpenCart?.();
    else if (a.kind === 'checkout') {
      if (cartCount === 0) {
        appendAi('Tu carrito está vacío. Agreguemos algo primero 😉.');
        return;
      }
      onOpenCheckout?.();
    } else if (a.kind === 'catalog') {
      onClose();
    } else if (a.kind === 'help') {
      // El botón "Conoce en qué te puedo ayudar" muestra el menú de capacidades.
      send('Ayuda: ¿qué puedes hacer?');
      return;
    }
    if (a.kind !== 'product') onClose();
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[75] overflow-hidden animate-fade-in" style={{ top: headerHeight }}>
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative h-full flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div className="pointer-events-auto relative w-full sm:max-w-md glass-strong bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-screen-up max-h-full flex flex-col">
          <div className="p-4 border-b border-slate-800 flex items-center gap-3 shrink-0 bg-gradient-to-r from-indigo-950/60 to-slate-900">
            <span className="relative p-2.5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white shadow-lg shadow-indigo-500/30 shrink-0 animate-glow-pulse">
              <Icon name="chat" className="w-5 h-5" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900" />
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                Don Aiker
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-bold uppercase tracking-wider border border-emerald-500/30">
                  asistente
                </span>
                {listening && (
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[9px] font-bold uppercase tracking-wider border border-rose-500/30 animate-pulse">
                    escuchando 🎤
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400 truncate">Toca una pregunta, pide un producto o dicta con voz</p>
            </div>
            <button
              onClick={() => setSpeechOn((v) => !v)}
              aria-label={speechOn ? 'Activar lectura de respuestas' : 'Desactivar lectura de respuestas'}
              title="Leer respuestas en voz"
              className={`p-2 rounded-xl transition-all ${speechOn ? 'bg-teal-500/25 text-teal-300' : 'text-slate-400 hover:text-white'}`}
            >
              <Icon name="volume2" className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl" aria-label="Cerrar asistente">
              <Icon name="x" className="w-5 h-5" />
            </button>
          </div>

          <div ref={scrollRef} className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0 bg-slate-950/40">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div
                  className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                    m.from === 'user'
                      ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-semibold rounded-br-md'
                      : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-md'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {/* Rastreo con progreso en vivo dentro del chat */}
            {liveOrder && !thinking && (
              <div className="flex justify-start animate-fade-in">
                <div className="w-full max-w-[80%] rounded-2xl bg-slate-900 border border-slate-700 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                      Pedido <span className="text-teal-300">{liveOrder.id}</span>
                    </span>
                    <span className={`text-[10px] font-bold ${liveOrder.status === 'en_camino' ? 'text-emerald-300' : 'text-slate-300'}`}>
                      {STATUS_LABELS[liveOrder.status] || liveOrder.status}
                    </span>
                  </div>
                  <OrderStepsTimeline order={liveOrder} />
                  {liveOrder.type === 'delivery' && (
                    <DeliveryMap order={liveOrder} storeLocation={storeLocation} />
                  )}
                  {liveOrder.estimatedMinutes != null && (
                    <p className="text-[10px] text-slate-400 font-semibold">
                      ⏱ Estimado: ~{liveOrder.estimatedMinutes} min
                    </p>
                  )}
                  {liveOrder.type === 'delivery' && liveOrder.courier_lat != null && (
                    <p className="text-[10px] text-teal-300 font-semibold">
                      🛵 Tu repartidor está en movimiento ({Number(liveOrder.courier_lat).toFixed(4)}, {Number(liveOrder.courier_lng).toFixed(4)})
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Acciones profundas (botones bajo el mensaje; puede haber varias) */}
            {Array.isArray(action) && action.length > 0 && (
              <div className="flex flex-wrap justify-start gap-2 animate-fade-in">
                {action.map((a, i) => (
                  <button
                    key={i}
                    onClick={() => runAction(a)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-slate-950 text-xs font-bold shadow-lg shadow-indigo-500/25 transition-all active:scale-95 hover:from-indigo-400 hover:to-cyan-400"
                  >
                    <Icon name={a.icon || 'check'} className="w-3.5 h-3.5" />
                    {a.label}
                  </button>
                ))}
              </div>
            )}

            {thinking && (
              <div className="flex justify-start items-center animate-fade-in">
                <div className="px-3.5 py-2.5 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-bl-md flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '120ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '240ms' }} />
                </div>
                <button
                  onClick={cancelReply}
                  aria-label="Cancelar pregunta"
                  className="shrink-0 px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-300 hover:border-rose-500/50 hover:text-rose-300 transition-all active:scale-95"
                >
                  Cancelar ✕
                </button>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-slate-800 shrink-0 bg-slate-900 relative">
            {/* Sugerencias de autocompletado mientras se escribe */}
            {suggestions.length > 0 && (
              <div className="mb-2 rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden animate-fade-in">
                {suggestions.map((s, i) => (
                  <button
                    key={`${s}-${i}`}
                    onClick={() => {
                      send(s);
                      setDraft('');
                      setSuggestions([]);
                    }}
                    className="block w-full text-left px-3.5 py-2.5 text-xs text-slate-200 hover:bg-slate-700/60 hover:text-teal-300 transition-colors border-b border-slate-700/60 last:border-b-0"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.trim() || thinking) return;
                send(draft);
                setDraft('');
                setSuggestions([]);
              }}
              className="mb-3 flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  const q = normalizeAiText(e.target.value);
                  if (q.length >= 2) {
                    const opts = [
                      ...(products || []).map((p) => p.name).filter((n) => normalizeAiText(n).includes(q)),
                      ...quickReplies.filter((r) => normalizeAiText(r).includes(q))
                    ];
                    setSuggestions([...new Set(opts)].slice(0, 4));
                  } else {
                    setSuggestions([]);
                  }
                }}
                placeholder={listening ? 'Escuchando… 🎤' : 'Escribe, dicta o pide un producto…'}
                disabled={thinking || listening}
                enterKeyHint="send"
                className="flex-1 min-w-0 px-3.5 py-2.5 rounded-2xl bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
              />
              <button
                type="button"
                onClick={toggleListening}
                disabled={thinking}
                aria-label={listening ? 'Detener dictado' : 'Dictar por voz'}
                title="Hablar"
                className={`shrink-0 p-2.5 rounded-2xl transition-all active:scale-95 ${
                  listening
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/40 animate-pulse'
                    : 'bg-slate-800 border border-slate-700 text-slate-300 hover:border-teal-500/50 hover:text-teal-300 disabled:opacity-40'
                }`}
              >
                <Icon name="mic" className="w-5 h-5" />
              </button>
              <button
                type="submit"
                disabled={!draft.trim() || thinking}
                aria-label="Enviar"
                className="shrink-0 p-2.5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white shadow-lg shadow-indigo-500/30 transition-all active:scale-95 hover:from-indigo-500 hover:to-cyan-400 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Icon name="arrowRight" className="w-5 h-5" />
              </button>
            </form>

            {cartCount > 0 && (
              <div className="mb-2.5">
                <button
                  onClick={() => {
                    onClose();
                    onOpenCart?.();
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-teal-500/15 border border-teal-500/40 text-[11px] font-bold text-teal-300 hover:bg-teal-500/25 transition-all active:scale-95"
                >
                  <Icon name="shoppingBag" className="w-3.5 h-3.5" />
                  Ver mi carrito ({cartCount}) o ir a pagar
                </button>
              </div>
            )}
            {popular.length > 0 && (
              <div className="mb-2.5">
                <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5 px-1">
                  Agregar rápido
                </span>
                <div className="flex flex-wrap gap-2">
                  {popular.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => send(`agregar ${p.name}`)}
                      disabled={thinking}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-teal-500/15 border border-teal-500/40 text-[11px] font-bold text-teal-300 hover:bg-teal-500/25 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Icon name="plus" className="w-3 h-3" />
                      <span className="max-w-24 truncate">{p.name.split(' ').slice(0, 2).join(' ')}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2 px-1">
              {followUps.length > 0 ? 'Sigue con…' : '¿Qué quieres saber?'}
            </span>
            <div className="flex flex-wrap gap-2">
              {(followUps.length > 0 ? followUps : quickReplies).map((r) => (
                <button
                  key={r}
                  onClick={() => send(r)}
                  disabled={thinking}
                  className="shrink-0 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-[11px] text-slate-200 hover:border-indigo-500/60 hover:text-indigo-300 transition-all active:scale-95 disabled:opacity-50"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


