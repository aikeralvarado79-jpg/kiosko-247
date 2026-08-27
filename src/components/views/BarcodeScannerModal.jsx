import { useState, useEffect, useRef } from 'react';
import { useOverlay } from '../../hooks/overlay.js';
import { BrowserMultiFormatReader } from '@zxing/browser';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    camera: <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

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

export default BarcodeScannerModal;
