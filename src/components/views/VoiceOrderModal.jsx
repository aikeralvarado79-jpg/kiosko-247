import { Fragment } from 'react';
import { useOverlay } from '../../hooks/overlay.js';
import { formatUsd } from '../../utils/format.js';
import ProductImg from '../ui/ProductImg.jsx';
import Btn from '../ui/Btn.jsx';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    mic: <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-6 0z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></>,
    x: <><path d="M18 6 6 18M6 6l12 12" /></>,
    refresh: <><path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><line x1="3.51" y1="9" x2="3.51" y2="9.01" /><line x1="20.49" y1="9" x2="20.49" y2="9.01" /></>,
    check: <><path d="M20 6 9 17l-5-5" /></>,
    loader: <><path d="M21 12a9 9 0 1 1-6.219-8.56" /></>,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="1" />}
    </svg>
  );
};

export default function VoiceOrderModal({ items, onConfirm, onRetry, onClose, loading, listening, dialog = [] }) {
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