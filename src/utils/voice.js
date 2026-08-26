export const normalizeText = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const SPEECH_NUMBER_WORDS = {
  un: 1, uno: 1, una: 1,
  dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  cien: 100, ciento: 100
};

export const parseVoiceOrder = (transcript, products) => {
  const text = normalizeText(transcript);
  if (!text) return [];
  const segments = text.split(/\s+(?:y|coma|con)\s+|\s*,\s*/).filter(Boolean);
  const catalog = (products || []).map((p) => ({
    product: p,
    norm: normalizeText(p.name)
  }));

  const results = [];
  for (const seg of segments) {
    const cleaned = seg.replace(/^(hey|hola|kiosko|kiosco|agrega|agregar|agregame|anade|pon|pone|quiero|necesito|comprame|dame|por favor|porfavor|quiero pedir|pedido)\s+/g, '');
    let qty = 1;
    let namePart = cleaned;

    const qtyMatch = namePart.match(/^(\d+|[a-z]+)\s+(.+)$/);
    if (qtyMatch) {
      const n = Number(qtyMatch[1]);
      if (!isNaN(n) && n > 0) {
        qty = n;
        namePart = qtyMatch[2];
      } else if (SPEECH_NUMBER_WORDS[qtyMatch[1]]) {
        qty = SPEECH_NUMBER_WORDS[qtyMatch[1]];
        namePart = qtyMatch[2];
      }
    }

    if (!namePart.trim()) continue;
    const segNorm = normalizeText(namePart);

    let best = null;
    let bestScore = 0;
    for (const c of catalog) {
      let score = 0;
      if (segNorm && c.norm && (c.norm.includes(segNorm) || segNorm.includes(c.norm))) {
        score = 1 + (segNorm.length >= 4 ? 1 : 0);
      } else {
        const segWords = segNorm.split(' ');
        const nameWords = c.norm.split(' ');
        const hit = segWords.filter((w) => w.length >= 3 && nameWords.includes(w)).length;
        score = hit / Math.max(1, nameWords.length);
      }
      if (score > bestScore) { bestScore = score; best = c.product; }
    }
    if (best && bestScore >= 0.5) {
      const existing = results.find((r) => r.product.id === best.id);
      if (existing) existing.qty += qty;
      else results.push({ product: best, qty });
    }
  }
  return results;
};

export const speakText = (text) => {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-ES';
    u.rate = 1;
    window.speechSynthesis.speak(u);
  } catch {}
};

export const speechRecognitionAvailable = () =>
  typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
