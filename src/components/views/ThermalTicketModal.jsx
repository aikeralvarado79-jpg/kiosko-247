import { useState, useEffect, useRef } from 'react';
import { useOverlay } from '../../hooks/overlay.js';
import { formatUsd, formatBs, usdToBs } from '../../utils/format.js';
import { sfx } from '../../experience.js';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></>,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="1" />}
    </svg>
  );
};

export default function ThermalTicketModal({ order, rate, onClose }) {
  useOverlay(true, onClose);
  useEffect(() => { sfx.tick(); const t1 = setTimeout(sfx.tick, 200); const t2 = setTimeout(sfx.tick, 450); return () => { clearTimeout(t1); clearTimeout(t2); }; }, []);

  const created = order?.createdAt || order?.timestamp;
  const dateStr = created ? new Date(created).toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const items = order?.items || [];
  const total = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
  const totalBs = rate?.rate > 0 ? formatBs(usdToBs(total, rate.rate)) : null;
  const barcode = [...String(order?.id ?? '0')].map((ch) => 2 + (ch.charCodeAt(0) % 4));

  const shareImg = async () => {
    try {
      const c = document.createElement('canvas');
      c.width = 640; c.height = items.length * 24 + 280;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#111'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center';
      ctx.fillText('KIOSKO 24/7', c.width / 2, 36);
      ctx.font = '13px monospace'; ctx.fillText('Empresas Alvarados', c.width / 2, 56);
      ctx.font = '13px monospace'; ctx.textAlign = 'left'; ctx.fillText(dateStr, 24, 86);
      ctx.fillText(`Pedido #${order?.id}`, 24, 112);
      ctx.fillText(`Cliente: ${order?.customerName || '—'}`, 24, 134);
      ctx.strokeStyle = '#ccc'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(24, 148); ctx.lineTo(c.width - 24, 148); ctx.stroke(); ctx.setLineDash([]);
      let y = 172;
      items.forEach((it) => {
        ctx.fillStyle = '#111'; ctx.font = '14px monospace';
        ctx.fillText(`${it.quantity || 1}× ${it.name}`, 24, y);
        ctx.textAlign = 'right'; ctx.fillText(formatUsd((Number(it.price) || 0) * (Number(it.quantity) || 1)), c.width - 24, y);
        ctx.textAlign = 'left'; y += 24;
      });
      ctx.strokeStyle = '#ccc'; ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(c.width - 24, y); ctx.stroke(); y += 20;
      ctx.font = 'bold 18px monospace'; ctx.fillText(`Total: ${formatUsd(total)}`, 24, y);
      if (totalBs) { ctx.font = '13px monospace'; ctx.fillText(totalBs, 24, y + 20); y += 20; }
      y += 24;
      if (order?.pickup_code) {
        ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center';
        ctx.fillText(`Código: ${order.pickup_code}`, c.width / 2, y); y += 32;
      }
      ctx.textAlign = 'left';
      let bx = 24;
      barcode.forEach((w) => { ctx.fillStyle = '#111'; ctx.fillRect(bx, y, w, 40); bx += w + 2; });
      const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
      if (!blob) return;
      const file = new File([blob], `pedido-${order?.id}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Pedido ${order?.id}`, text: 'Mi pedido en Kiosko 24/7 🛒' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
    } catch { /* noop */ }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-start sm:items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in" role="dialog" aria-label="Ticket de compra">
      <div className="max-w-sm w-full space-y-3 relative">
        <div className="relative overflow-hidden">
          <div className="ticket-jag-top" />
          <div className="thermal-ticket ticket-print rounded-lg px-5 py-6 shadow-2xl space-y-3">
            <div className="text-center space-y-0.5">
              <p className="text-sm font-black tracking-widest text-gray-900">KIOSKO 24/7</p>
              <p className="text-[10px] text-gray-500">Empresas Alvarados</p>
            </div>
            <p className="text-[11px] text-gray-500 text-center">{dateStr}</p>
            <hr className="border-dashed border-gray-300" />
            <div className="text-[11px] leading-relaxed flex justify-between"><span>Pedido #{order?.id}</span></div>
            <div className="text-[11px] leading-relaxed flex justify-between"><span>Cliente</span><span className="font-bold">{order?.customerName || '—'}</span></div>
            {order?.type && <div className="text-[11px] leading-relaxed flex justify-between"><span>Tipo</span><span className="uppercase font-bold">{order.type}</span></div>}
            <hr className="border-dashed border-gray-300" />
            <div className="space-y-1.5">
              {items.map((it, i) => (
                <div key={i} className="text-[11px] leading-relaxed flex justify-between gap-2">
                  <span className="truncate">{it.quantity || 1}× {it.name}</span>
                  <span className="font-bold shrink-0">{formatUsd((Number(it.price) || 0) * (Number(it.quantity) || 1))}</span>
                </div>
              ))}
            </div>
            <hr className="border-dashed border-gray-300" />
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] font-bold">Total</span>
              <div className="text-right">
                <span className="text-sm font-black">{formatUsd(total)}</span>
                {totalBs && <span className="block text-[10px] text-gray-500">{totalBs}</span>}
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>Método</span><span className="font-bold">{order?.paymentMethod || 'Efectivo'}</span>
            </div>
            {order?.pickup_code && (
              <div className="text-center pt-1">
                <p className="text-[10px] text-gray-400 mb-1">Código de retiro</p>
                <p className="text-lg font-black tracking-[0.35em] text-gray-900">{order.pickup_code}</p>
              </div>
            )}
            <div className="flex gap-0.5 h-8 items-stretch pt-1">
              {barcode.map((w, i) => <div key={i} className="bg-gray-900" style={{ width: w }} />)}
            </div>
            <p className="text-center text-[9px] text-gray-400 italic">¡Gracias por tu compra!</p>
          </div>
          <div className="ticket-jag-bottom" />
        </div>
        <div className="flex gap-2">
          <button onClick={shareImg} className="flex-1 py-2.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 hover:bg-teal-400 transition-all">
            <Icon name="download" className="w-4 h-4" /> Compartir imagen
          </button>
          <button onClick={onClose} className="py-2.5 px-4 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs hover:bg-slate-700 transition-all">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}