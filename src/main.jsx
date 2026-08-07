import { Component, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

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
// instalación en el móvil y el funcionamiento offline básico.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
