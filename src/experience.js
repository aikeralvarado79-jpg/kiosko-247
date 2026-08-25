// ---------------------------------------------------------------------------
//  Paquete de experiencia: sonido de marca, sustituto háptico para iOS,
//  geometría (haversine) y extracción de color dominante de imágenes.
//  Todo cliente, sin dependencias externas.
// ---------------------------------------------------------------------------

const MUTE_KEY = 'kiosko_sound_off';
let ctx = null;

const audio = () => {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
};

export const isSoundOn = () => {
  try { return localStorage.getItem(MUTE_KEY) !== '1'; } catch { return true; }
};
export const setSoundOn = (on) => {
  try { localStorage.setItem(MUTE_KEY, on ? '0' : '1'); } catch {}
};

const tone = (freq, start, dur, type = 'sine', gain = 0.07) => {
  const c = audio();
  if (!c || !isSoundOn()) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  osc.connect(g).connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + dur + 0.05);
};

// Paquete de sonidos de marca: cada momento clave tiene su firma.
export const sfx = {
  // Tic cortito para feedback táctil (también es el "háptico" de iPhone).
  tick() { tone(1700, 0, 0.02, 'triangle', 0.045); },
  doubleTick() { tone(1700, 0, 0.02, 'triangle', 0.045); tone(2100, 0.06, 0.02, 'triangle', 0.045); },
  added() { tone(880, 0, 0.06); tone(1320, 0.06, 0.09); },
  success() { tone(880, 0, 0.22, 'sine', 0.1); tone(1320, 0.16, 0.3, 'sine', 0.08); },
  ready() { tone(1046, 0, 0.1); tone(1568, 0.1, 0.16); },
  delivered() { tone(659, 0, 0.12, 'sine', 0.1); tone(880, 0.12, 0.12, 'sine', 0.1); tone(1318, 0.24, 0.28, 'sine', 0.1); },
  error() { tone(170, 0, 0.14, 'sawtooth', 0.055); }
};

// Sustituto háptico para iOS (sin navigator.vibrate): ráfagas de ticks
// siguiendo el patrón de vibración equivalente.
export const hapticTicks = (pattern) => {
  const seq = Array.isArray(pattern) ? pattern : [pattern];
  let t = 0;
  seq.forEach((ms, i) => {
    if (i % 2 === 0 && ms > 0) {
      const bursts = Math.min(4, Math.max(1, Math.round(ms / 14)));
      for (let b = 0; b < bursts; b++) setTimeout(() => sfx.tick(), (t + b * 18) * 1);
    }
    t += ms;
  });
};

// Distancia haversine en metros entre dos puntos {lat,lng}.
export const distanceMeters = (a, b) => {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
};

// Color dominante de una imagen (promedio con descarte de extremos). Devuelve
// "r,g,b" para usar en rgb(var(--x)) o null si falla (CORS, sin imagen).
export const dominantColorFromUrl = (url) => new Promise((resolve) => {
  if (!url) return resolve(null);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const cv = document.createElement('canvas');
      cv.width = 24; cv.height = 24;
      const cx = cv.getContext('2d');
      cx.drawImage(img, 0, 0, 24, 24);
      const { data } = cx.getImageData(0, 0, 24, 24);
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < data.length; i += 4) {
        const [pr, pg, pb] = [data[i], data[i + 1], data[i + 2]];
        const max = Math.max(pr, pg, pb);
        const min = Math.min(pr, pg, pb);
        if (max > 235 && min > 215) continue; // blanco
        if (max < 25) continue;               // negro puro
        r += pr; g += pg; b += pb; n++;
      }
      if (!n) return resolve(null);
      resolve(`${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)}`);
    } catch {
      resolve(null);
    }
  };
  img.onerror = () => resolve(null);
  img.src = url;
});
