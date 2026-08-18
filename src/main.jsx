import { Component, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Marca que el módulo JS se ejecutó: index.html usa esto para mostrar un botón
// de recuperación si la app no logra montarse (caché rota del service worker).
window.__APP_MOUNTED__ = true;

// Reporte de errores no capturados: se acumulan en localStorage (últimos 20) y
// se envían al server en lotes y con límite de frecuencia, para no inundar la
// API ni el ancho de banda. No se envía información personal sensible.
(function () {
  const KEY = 'kiosko:errors:v1';
  const MAX_LOCAL = 20;
  const pushLocal = (entry) => {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || '[]');
      list.push(entry);
      if (list.length > MAX_LOCAL) list.splice(0, list.length - MAX_LOCAL);
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {}
  };
  let lastSentAt = 0;
  const send = () => {
    const now = Date.now();
    if (now - lastSentAt < 30000) return; // como mucho 1 lote cada 30 s
    lastSentAt = now;
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!list.length) return;
      localStorage.removeItem(KEY);
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: list[list.length - 1] })
      }).catch(() => {});
    } catch {}
  };
  const capture = (message, stack) => {
    const entry = { message: String(message || '').slice(0, 500), stack: String(stack || '').slice(0, 2000), url: window.location.href };
    pushLocal(entry);
    send();
  };
  window.addEventListener('error', (e) => capture(e.message || 'error', e.error && (e.error.stack || e.error.message)));
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    capture(r instanceof Error ? r.message : String(r || 'promise rejection'), r instanceof Error ? r.stack : '');
  });
})();

// Error boundary: si algo falla al renderizar, muestra una pantalla de
// recuperación en vez de dejar la app en blanco.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClear = () => {
    if ('caches' in window) {
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {});
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', padding: '24px', textAlign: 'center' }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: 16, margin: '0 0 8px' }}>Algo salió mal al cargar la app.</p>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 16px' }}>
              Puede ser una versión vieja guardada en la caché del navegador.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={this.handleReload} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: '#14b8a6', color: '#0f172a', fontWeight: 700, cursor: 'pointer' }}>
                Recargar
              </button>
              <button onClick={this.handleClear} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #475569', background: 'transparent', color: '#e2e8f0', fontWeight: 600, cursor: 'pointer' }}>
                Limpiar caché y recargar
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

// PWA: registra el service worker solo en producción para habilitar la
// instalación en el móvil y el funcionamiento offline básico. Además, cada vez
// que se despliega una versión nueva (sw.js cambia en cada build, ver
// vite.config.js), los dispositivos con una versión vieja reciben el aviso con
// el botón "Actualizar" (App.jsx). El aviso no recarga solo para no perder el
// estado a mitad de un pedido.
if ('serviceWorker' in navigator) {
  // SW nuevo que ya quedó descargado y en espera; se activa solo cuando el
  // usuario pulsa "Actualizar" en el aviso (mensaje SKIP_WAITING al sw.js).
  let pendingSW = null;

  const announceUpdate = () => {
    window.dispatchEvent(new CustomEvent('kiosko:sw-update'));
  };

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        // Detecta la versión nueva apenas el SW nuevo termina de instalarse.
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            // Ignora la primera instalación (cuando no había un SW previo):
            // solo interesa cuando se actualiza una versión existente.
            if (sw.state === 'installed' && (navigator.serviceWorker.controller || reg.active)) {
              pendingSW = sw;
              announceUpdate();
            }
          });
        });

        // Chequeos periódicos y al volver a la pestaña: detectan un deploy
        // nuevo aunque el usuario no navegue (app abierta o en segundo plano).
        const checkForUpdate = () => reg.update().catch(() => {});
        checkForUpdate();
        setInterval(checkForUpdate, 30 * 60 * 1000);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForUpdate();
        });
      })
      .catch(() => {});
  });

  // Botón "Actualizar" del aviso: activa la versión nueva y recarga la app.
  window.__kioskoActivateUpdate = () => {
    try {
      if (pendingSW) pendingSW.postMessage({ type: 'SKIP_WAITING' });
    } catch {
      // ignora fallos puntuales de postMessage
    }
    window.location.reload();
  };

  // Respaldo: si un SW nuevo toma control por otra vía, también se avisa para
  // que el usuario recargue y tome la última versión.
  let hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      // Primera instalación del SW en este navegador: no es una actualización.
      hadController = true;
      return;
    }
    announceUpdate();
  });
}

// Instalación PWA: se suprime el banner nativo del navegador y se expone el
// evento para que el tutorial integrado (App.jsx) decida cuándo mostrarlo y
// pueda lanzar el diálogo de instalación de Chrome/Android bajo demanda.
let __kioskoDeferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  __kioskoDeferredPrompt = e;
});
window.addEventListener('appinstalled', () => {
  __kioskoDeferredPrompt = null;
  window.dispatchEvent(new CustomEvent('kiosko:app-installed'));
});
window.__kioskoGetDeferredPrompt = () => __kioskoDeferredPrompt;
window.__kioskoClearDeferredPrompt = () => {
  __kioskoDeferredPrompt = null;
};
