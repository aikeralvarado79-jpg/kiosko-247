// Tasa BCV del día (USD → Bs). Obtiene la tasa oficial del Banco Central de Venezuela.
// Fuente primaria: DolarAPI (https://ve.dolarapi.com) — dato "oficial" que es la tasa BCV.
// Respaldos: ER-API (open.er-api.com). Cache en memoria para no golpear la API en cada request.

const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

let cached = null; // { rate, date, source, fetchedAt }

const DEFAULT_RATE = 748; // Última tasa conocida (fallback si todas las fuentes fallan)

async function fetchJson(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fromDolarApi() {
  const data = await fetchJson('https://ve.dolarapi.com/v1/dolares');
  const official = (Array.isArray(data) ? data : []).find((d) => d.fuente === 'oficial');
  if (!official || !official.promedio) throw new Error('Sin tasa oficial en DolarAPI');
  return {
    rate: Number(official.promedio),
    date: official.fechaActualizacion || new Date().toISOString(),
    source: 'BCV (DolarAPI)'
  };
}

async function fromErApi() {
  const data = await fetchJson('https://open.er-api.com/v6/latest/USD');
  const rate = Number(data?.rates?.VES);
  if (!rate) throw new Error('Sin tasa VES en ER-API');
  return {
    rate,
    date: data.time_last_update_utc || new Date().toISOString(),
    source: 'BCV (ER-API)'
  };
}

export async function getBcvRate() {
  const now = Date.now();
  if (cached && now - cached.fetchedAt < CACHE_TTL) {
    return { rate: cached.rate, date: cached.date, source: cached.source };
  }

  for (const source of [fromDolarApi, fromErApi]) {
    try {
      const result = await source();
      cached = { ...result, fetchedAt: now };
      return { rate: result.rate, date: result.date, source: result.source };
    } catch (err) {
      console.warn('[kiosko] Fuente de tasa falló:', err.message);
    }
  }

  if (cached) {
    return { rate: cached.rate, date: cached.date, source: `${cached.source} (cache)` };
  }
  return { rate: DEFAULT_RATE, date: new Date().toISOString(), source: 'Respaldo' };
}
