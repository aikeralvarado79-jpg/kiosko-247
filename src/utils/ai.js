import { speakText } from './voice';
import { STATUS_LABELS } from './order';
import { formatUsd } from './format';

export const normalizeAiText = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const PRODUCT_SYNONYMS = {
  gaseosa: ['coca', 'pepsi', 'sprite', 'cola', 'chicha', 'jugo', 'refresco'],
  agua: ['agua', 'mineral'],
  pan: ['pan', 'tostada', 'bimbo', 'integral'],
  galleta: ['galleta', 'cookie', 'dulce'],
  cafe: ['cafe', 'capuchino', 'express', 'nescafe'],
  chocolate: ['chocolate', 'sublime', 'nutella'],
  arroz: ['arroz', 'integral'],
  aceite: ['aceite', 'vegetal', 'oliva'],
  azucar: ['azucar', 'endulzante', 'stevia'],
  harina: ['harina', 'maiz', 'pan'],
  pasta: ['pasta', 'fideo', 'espagueti', 'tallarin'],
  cerveza: ['cerveza', 'polar', 'solera', 'zulia'],
  jugo: ['jugo', 'nectar', 'caja'],
  leche: ['leche', 'evaporada', 'entera', 'descremada'],
  queso: ['queso', 'fresco', 'guayanés', 'país'],
  refresco: ['refresco', 'cola', 'cloro', 'pepsi', 'hit'],
  jabon: ['jabon', 'aseo', 'tocador', 'lavanderia'],
  cloro: ['cloro', 'lejia', 'limpieza'],
  pañal: ['pañal', 'pnial', 'panal', 'bebe'],
  papel: ['papel', 'toalla', 'higienico', 'servilleta'],
  velas: ['velas', 'vela'],
  hielo: ['hielo', 'helado']
};

const AI_STOPWORDS = new Set([
  'que', 'con', 'para', 'esta', 'este', 'estas', 'estos', 'cual', 'cuales', 'como', 'cuando',
  'donde', 'muy', 'mas', 'menos', 'por', 'los', 'las', 'una', 'uno', 'unos', 'el', 'la', 'lo',
  'de', 'del', 'me', 'mi', 'tu', 'te', 'se', 'su', 'sus', 'y', 'o', 'a', 'hay', 'tienes',
  'tiene', 'tengo', 'quiero', 'quieres', 'puedes', 'podrias', 'favor', 'disponible', 'precio',
  'cuanto', 'cuanta', 'cuantos', 'cuantas', 'es', 'son', 'estoy', 'eso', 'algo', 'dame',
  'da', 'haz', 'muestra', 'dime', 'decime', 'saber', 'queria', 'quisiera', 'puedo', 'agregar',
  'agregame', 'comprar', 'compra', 'pasame', 'pasar', 'busca', 'buscar', 'opcion', 'opciones'
]);

export function matchAiProducts(products, query, limit = 4) {
  if (!Array.isArray(products) || products.length === 0) return [];
  const q = normalizeAiText(query);
  if (!q) return [];
  const tokens = q.split(' ').filter((t) => t.length > 2 && !AI_STOPWORDS.has(t));
  const scored = (products || [])
    .filter((p) => p && p.name)
    .map((p) => {
      const n = normalizeAiText(p.name);
      const nameTokens = n.split(' ').filter((t) => t.length > 2 && !AI_STOPWORDS.has(t));
      let score = 0;
      if (n === q) score += 100;
      else if (q.length > 3 && n.includes(q)) score += 70;
      else if (tokens.length && tokens.some((t) => nameTokens.some((nt) => nt === t))) score += 50;
      tokens.forEach((t) => {
        if (t.length >= 3 && nameTokens.some((nt) => nt.startsWith(t))) score += 20;
        else if (nameTokens.some((nt) => nt.length >= 4 && (nt.includes(t) || t.startsWith(nt)))) score += 20;
      });
      Object.entries(PRODUCT_SYNONYMS).forEach(([kw, alts]) => {
        if (q.includes(kw)) alts.forEach((alt) => { if (n.includes(alt)) score += 25; });
      });
      return { p, score };
    })
    .filter((x) => x.score >= 40)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.p);
}

export const sayAi = (text) => speakText(text);

export const AI_HELP_MENU = [
  { n: 1, text: 'Consultar mi deuda o saldo' },
  { n: 2, text: 'Ver mi último pedido y dónde va' },
  { n: 3, text: 'Promos y ofertas activas' },
  { n: 4, text: 'La tasa del día (dólar/bolívar)' },
  { n: 5, text: 'Repetir mi último pedido' },
  { n: 6, text: 'Ver el catálogo y agregar productos' },
  { n: 7, text: 'Ver mi carrito o ir a pagar' },
  { n: 8, text: 'Hablar con una persona del kiosko' }
];

export const AI_HELP_TEXT = `Claro, te cuento todo lo que puedo hacer por ti 😊\n\n${AI_HELP_MENU.map(
  (m) => `${m.n}. ${m.text}`
).join('\n')}\n\nEscribe el número del punto que quieres y lo ejecuto enseguida.`;

export function buildAiWelcome(params) {
  const { name, activePromos, pendingOrder, balance } = params || {};
  const parts = [`¡Hola${name ? `, ${name}` : ''}! Soy Don Aiker, el asistente del kiosko 📣`];
  if (Array.isArray(activePromos) && activePromos.length) {
    const n = activePromos.length;
    parts.push(`Mira, hoy hay ${n} promo${n > 1 ? 's' : ''} activa${n > 1 ? 's' : ''} 🎉.`);
  }
  if (pendingOrder) {
    const label =
      pendingOrder.status === 'en_camino'
        ? 'tu pedido está en camino, seguilo abajo 🛵'
        : `tienes ${pendingOrder.id} en curso (${STATUS_LABELS[pendingOrder.status] || pendingOrder.status})`;
    parts.push(label);
  } else if (balance > 0) {
    parts.push(`Recuerda que tienes ${formatUsd(balance)} de deuda pendiente.`);
  }
  parts.push('Toca una pregunta rápida o pide un producto. Puedo contarte tu deuda, tus pedidos, las promos, la tasa y agregar al carrito. 😊');
  return parts.join('\n');
}
