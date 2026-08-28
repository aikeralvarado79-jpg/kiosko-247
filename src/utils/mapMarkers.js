import L from 'leaflet';

export const makePinIcon = (color, label) =>
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

export const makeCourierIcon = () =>
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

export const makeDestIcon = () =>
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
