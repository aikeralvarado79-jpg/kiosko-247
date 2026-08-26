import { useState } from 'react';
import { toYMD } from '../../utils/order.js';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    minus: <path d="M5 12h14" />,
    plus: <path d="M12 5v14M5 12h14" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

export default function MiniCalendar({ value, onChange, onClose }) {
  const [month, setMonth] = useState(new Date());
  const today = new Date();
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
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
        {['Lu','Ma','Mi','Ju','Vi','Sa','Do'].map(d => <div key={d} className="text-center text-slate-500 font-semibold">{d}</div>)}
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
