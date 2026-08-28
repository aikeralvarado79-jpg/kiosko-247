import { useState, useEffect } from 'react';
import { api } from '../../api.js';
import { useOverlay } from '../../hooks/overlay.js';
import { STATUS_STYLES, STATUS_FLOW, STATUS_LABELS, needsPaymentValidation } from '../../utils/order.js';
import { ChatBubble } from '../../App.jsx';
import DeliveryMap from './DeliveryMap.jsx';
import PaymentStatusCard from './PaymentStatusCard.jsx';
import EtaEstimate from './EtaEstimate.jsx';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    mapPin: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
    x: <><path d="M18 6 6 18M6 6l12 12" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    navigation: <><polygon points="3 11 22 2 13 21 11 13 3 11" /></>,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="1" />}
    </svg>
  );
};

export default function LiveTrackingModal({ order, onClose, storeLocation, isBenefited, onOrderUpdated, addToast, headerHeight = 0 }) {
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
      if (res.ok && res.data) { setTrack(res.data); setError(''); }
      else { setError(res.data?.error || 'No se pudo obtener el rastreo del pedido.'); }
      loadMessages();
    };
    load();
    const timer = setInterval(load, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, [order.id]);

  const handleSendMessage = async () => {
    const text = messageText.trim();
    if (!text || sending) return;
    setSending(true);
    const res = await api.sendOrderMessage(order.id, order.phone, text);
    setSending(false);
    if (res.ok) { setMessageText(''); loadMessages(); }
    else { setError(res.data?.error || 'No se pudo enviar el mensaje.'); }
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
  const updatedAt = track?.courier_updated_at ? new Date(track.courier_updated_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] overflow-hidden animate-fade-in" style={{ top: headerHeight }}>
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
                {needsPaymentValidation(order) ? 'Pago en revision' : STATUS_LABELS[status] || 'Pendiente'}
              </span>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors">
              <Icon name="x" className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
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

            <DeliveryMap order={track} storeLocation={storeLocation} />
            <PaymentStatusCard order={order} isBenefited={isBenefited} onOrderUpdated={onOrderUpdated} addToast={addToast} />

            <div className="rounded-xl bg-slate-800/60 p-3 text-xs space-y-1">
              <div className="flex items-center gap-2">
                <Icon name="mapPin" className="w-3.5 h-3.5 text-emerald-400" />
                {courierLive ? (
                  <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Repartidor en camino {updatedAt ? `· ${updatedAt}` : ''}
                  </span>
                ) : (
                  <span className="text-slate-400">{status === 'en_camino' ? 'Buscando la posicion del repartidor...' : 'El repartidor aun no inicio el envio.'}</span>
                )}
              </div>
              {order.address && <p className="text-slate-400">Destino: <span className="text-white font-bold">{order.address}</span></p>}
              <p className="text-slate-500">La posicion se actualiza automaticamente cada 5 segundos.</p>
            </div>

            {status === 'en_camino' && courierLive && track?.courier_lat != null && track?.courier_lng != null && order?.lat != null && order?.lng != null && (
              <div className="rounded-xl bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-cyan-500/10 border border-teal-500/25 p-3.5 animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="navigation" className="w-4 h-4 text-teal-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-teal-300">ETA Predictivo</span>
                </div>
                <EtaEstimate cLat={Number(track.courier_lat)} cLng={Number(track.courier_lng)} dLat={Number(order.lat)} dLng={Number(order.lng)} />
                <p className="text-[10px] text-slate-500 mt-2">Estimado segun distancia y ritmo promedio de reparto; puede variar por transito.</p>
              </div>
            )}

            <div className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-hidden">
              <div className="p-3 border-b border-slate-700/70 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                <span className="text-xs font-bold text-white">Chat con la tienda</span>
              </div>
              <div className="p-3 space-y-2.5 max-h-52 overflow-y-auto">
                {messages.length === 0 && <p className="text-xs text-slate-500 text-center py-3">Sin mensajes todavia. Escribenos si necesitas algo.</p>}
                {messages.map((m, idx) => <ChatBubble key={m.id || idx} m={m} order={order} perspective="customer" />)}
              </div>
              <div className="p-3 border-t border-slate-700/70 flex gap-2">
                <input type="text" value={messageText} onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
                  placeholder="Escribe un mensaje..." maxLength={300}
                  className="flex-1 min-w-0 px-3 py-2.5 glass-strong bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:border-teal-500 focus:outline-none" />
                <button onClick={handleSendMessage} disabled={sending || !messageText.trim()}
                  className="shrink-0 px-3.5 py-2.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs disabled:opacity-50 disabled:pointer-events-none transition-all active:scale-95">
                  Enviar
                </button>
              </div>
            </div>

            {error && <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">{error} Se seguira intentando.</p>}
            <button onClick={onClose} className="w-full py-3 rounded-2xl bg-slate-800 text-slate-300 font-bold text-sm hover:bg-slate-700 transition-all">Cerrar rastreo</button>
          </div>
        </div>
      </div>
    </div>
  );
}
