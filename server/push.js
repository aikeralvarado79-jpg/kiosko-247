import webpush from 'web-push';
import * as store from './store.js';

// ---------------------------------------------------------------------------
// Notificaciones Push (Web Push / PWA)
// ---------------------------------------------------------------------------

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@kiosko247.com';

let vapidReady = false;

// Claves VAPID persistentes: se generan una sola vez y se guardan en el store
// (settings). Con Postgres sobreviven a los redeploys de Render; en dev/archivo
// se persisten en data.json.
export async function ensureVapid() {
  if (vapidReady) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (publicKey && privateKey) {
    webpush.setVapidDetails(VAPID_SUBJECT, publicKey, privateKey);
    vapidReady = true;
    return;
  }

  let stored = null;
  try {
    stored = await store.getSetting('vapid');
  } catch {
    stored = null;
  }
  if (stored && stored.publicKey && stored.privateKey) {
    webpush.setVapidDetails(VAPID_SUBJECT, stored.publicKey, stored.privateKey);
    vapidReady = true;
    return;
  }

  // Sin claves previas: se generan y se persisten. Si la persistencia falla,
  // NO marcamos "ready" para reintentar en la próxima llamada.
  const keys = webpush.generateVAPIDKeys();
  await store.setSetting('vapid', keys);
  webpush.setVapidDetails(VAPID_SUBJECT, keys.publicKey, keys.privateKey);
  vapidReady = true;
}

export async function getVapidPublicKey() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (publicKey) return publicKey;
  let stored = null;
  try {
    stored = await store.getSetting('vapid');
  } catch {
    stored = null;
  }
  if (stored && stored.publicKey) return stored.publicKey;
  // Sin clave persistida (p.ej. tras un refresco del espejo que la borró):
  // se regenera y se guarda para mantenerla estable entre dispositivos.
  await ensureVapid();
  try {
    stored = await store.getSetting('vapid');
  } catch {
    stored = null;
  }
  return stored?.publicKey || null;
}

const listSubs = async () => {
  const subs = await store.getSetting('pushSubs');
  return Array.isArray(subs) ? subs : [];
};

const saveSubs = async (subs) => {
  await store.setSetting('pushSubs', subs);
};

export async function subscribe(phone, subscription) {
  if (!subscription || !subscription.endpoint) return false;
  const key = String(phone || '').replace(/\D/g, '').slice(-11);
  const subs = await listSubs();
  const next = subs.filter((s) => s.endpoint !== subscription.endpoint);
  next.push({ phone: key, endpoint: subscription.endpoint, keys: subscription.keys, at: new Date().toISOString() });
  await saveSubs(next);
  return true;
}

export async function unsubscribe(endpoint) {
  const subs = await listSubs();
  await saveSubs(subs.filter((s) => s.endpoint !== endpoint));
  return true;
}

async function sendRaw(subscription, payload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 86400 });
    return { ok: true };
  } catch (err) {
    // 404/410 = suscripción muerta: se limpia.
    if (err.statusCode === 404 || err.statusCode === 410) {
      return { ok: false, dead: true };
    }
    return { ok: false, dead: false };
  }
}

async function sendMany(subs, payload) {
  const live = [];
  for (const sub of subs) {
    const res = await sendRaw(
      { endpoint: sub.endpoint, keys: sub.keys },
      payload
    );
    if (!res.dead) live.push(sub);
  }
  await saveSubs(live);
  return live.length;
}

// Envía una notificación a un teléfono (o varios). Si el teléfono no está
// suscrito, simplemente no hace nada (no rompe el flujo).
export async function sendToPhone(phones, payload) {
  await ensureVapid();
  const targets = Array.isArray(phones) ? phones : [phones];
  const keys = targets.map((p) => String(p || '').replace(/\D/g, '').slice(-11)).filter(Boolean);
  const subs = await listSubs();
  const matching = subs.filter((s) => keys.includes(s.phone));
  return sendMany(matching, payload);
}

export async function sendToAll(payload, exceptPhones = []) {
  await ensureVapid();
  const except = exceptPhones.map((p) => String(p).replace(/\D/g, '').slice(-11));
  const subs = await listSubs();
  const matching = subs.filter((s) => !except.includes(s.phone));
  return sendMany(matching, payload);
}

export async function subscribedCount() {
  return (await listSubs()).length;
}
