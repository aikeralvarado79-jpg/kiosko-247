import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import compression from 'compression';
import { fileURLToPath } from 'url';
import * as store from './store.js';
import * as webauthn from './webauthn.js';
import * as push from './push.js';
import { getBcvRate } from './rate.js';
import { isStorageConfigured, uploadProof } from './storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '8mb' }));
app.use(compression());

let config = {};
try {
  config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')) || {};
} catch (err) {
  console.warn('[kiosko] No se pudo leer config.json, usando variables de entorno:', err.message);
}

// Contraseña base (config/env). Cada administrador puede tener su propia
// contraseña (store.adminCredentials[phone]); la base funciona como master.
let adminPassword = process.env.ADMIN_PASSWORD || config.adminPassword;

// Key de Pexels para sugerencias de imagen (env o config).
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || config.pexelsApiKey;

// Teléfonos de administradores (normalizados a 11 dígitos). Se combinan env
// (ADMIN_PHONES, separados por coma) y config para no romper si falta uno.
const ADMIN_PHONES = String(process.env.ADMIN_PHONES || '')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean)
  .concat(config.adminPhones || [])
  .map((p) => String(p).replace(/\D/g, '').slice(-11));

const signToken = (payload) => {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', adminPassword).update(data).digest('base64url');
  return `${data}.${sig}`;
};

const verifyToken = (token) => {
  const [data, sig] = String(token).split('.');
  if (!data || !sig) return false;
  const expected = crypto.createHmac('sha256', adminPassword).update(data).digest('base64url');
  if (sig.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
};

// Devuelve el payload del token (verifyToken solo valida y devuelve booleano).
const decodeToken = (token) => {
  try {
    const [data] = String(token).split('.');
    if (!data) return null;
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

const requireAdmin = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
};

// Envía un error amigable al usuario sin filtrar el detalle técnico
// (err.message suele estar en inglés o contener detalles internos). El detalle
// se registra en consola para diagnóstico.
const fail = (res, err, message) => {
  console.error(`[kiosko] ${message}:`, err);
  res.status(500).json({ error: message });
};

// Verifica contraseña de un admin. Si el teléfono tiene credencial propia,
// valida contra ella; sino (o como fallback) usa la base (env > config).
async function verifyAdminPassword(phone, input) {
  const key = String(phone || '').replace(/\D/g, '').slice(-11);
  if (key && ADMIN_PHONES.includes(key)) {
    const cred = await store.getAdminCredential(key);
    if (cred && cred.salt && cred.hash) {
      const hash = crypto.createHash('sha256').update(cred.salt + input).digest('hex');
      if (hash === cred.hash) return true;
    }
  }
  if (input === adminPassword) return true;
  // Último recurso: override compartido legacy guardado en el store.
  const legacy = await store.getAdminPassword();
  if (legacy && legacy.salt && legacy.hash) {
    const hash = crypto.createHash('sha256').update(legacy.salt + input).digest('hex');
    return hash === legacy.hash;
  }
  return false;
}

// Notificaciones push por cambio de estado: avisan al cliente al instante.
// No rompen el flujo si el cliente no está suscrito.
const NOTIFY_STATUS = {
  en_preparacion: 'Tu pedido está en preparación',
  en_camino: 'Tu repartidor está en camino',
  listo: 'Tu pedido está listo para retirar',
  entregado: 'Tu pedido fue entregado'
};

async function notifyOrderStatus(order) {
  if (!order || !order.phone) return;
  const label = NOTIFY_STATUS[order.status];
  if (!label) return;
  try {
    await push.sendToPhone([order.phone], {
      title: `Pedido ${order.id}`,
      body: label,
      url: '/'
    });
  } catch (err) {
    console.warn('[kiosko] No se pudo notificar el estado del pedido:', err.message);
  }
}

async function notifyAdminsNewOrder(order) {
  if (!order || ADMIN_PHONES.length === 0) return;
  try {
    const totalItems = (order.items || []).reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
    await push.sendToPhone(ADMIN_PHONES, {
      title: 'Nuevo pedido',
      body: `${order.id} · ${order.customerName} · ${totalItems} artículos · $${Number(order.total).toFixed(2)}`,
      url: '/'
    });
  } catch (err) {
    console.warn('[kiosko] No se pudo notificar a los admins:', err.message);
  }
}

// Auth
app.post('/api/auth/login', async (req, res) => {
  try {
    const { phone, password } = req.body || {};
    const key = String(phone || '').replace(/\D/g, '').slice(-11);
    if (key && !ADMIN_PHONES.includes(key)) {
      return res.status(401).json({ error: 'Ese número no tiene acceso al panel' });
    }
    const ok = await verifyAdminPassword(key || phone, password);
    if (!ok) return res.status(401).json({ error: 'Contraseña incorrecta' });
    const token = signToken({ role: 'admin', phone: key || '', iat: Date.now() });
    res.json({ token });
  } catch (err) {
    fail(res, err, 'No se pudo iniciar sesión. Intenta de nuevo.');
  }
});

// Recuperación de contraseña admin: verifica biometría del teléfono admin y guarda nueva contraseña
app.post('/api/auth/recover', async (req, res) => {
  try {
    const { phone, response, newPassword } = req.body || {};
    const key = String(phone || '').replace(/\D/g, '').slice(-11);
    if (!ADMIN_PHONES.includes(key)) {
      return res.status(403).json({ error: 'Este número no es administrador' });
    }
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const v = await webauthn.verifyAuth(key, response, req);
    if (!v.ok) {
      return res.status(v.status || 400).json({ error: v.error || 'Biometría no verificada' });
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHash('sha256').update(salt + newPassword).digest('hex');
    await store.setAdminCredential(key, { salt, hash });
    res.json({ ok: true });
  } catch (err) {
    fail(res, err, 'No se pudo recuperar la contraseña. Intenta de nuevo.');
  }
});

// Login admin por biometría: verifica huella/Face ID del teléfono admin y emite token.
// El teléfono es obligatorio para saber qué admin está ingresando (evita la contraseña).
app.post('/api/auth/admin/biometric-login', async (req, res) => {
  try {
    const { phone, response } = req.body || {};
    const key = String(phone || '').replace(/\D/g, '').slice(-11);
    if (!ADMIN_PHONES.includes(key)) {
      return res.status(403).json({ error: 'Este número no tiene acceso al panel' });
    }
    const v = await webauthn.verifyAuth(key, response, req);
    if (!v.ok) return res.status(v.status || 400).json({ error: v.error || 'Biometría no verificada' });
    const token = signToken({ role: 'admin', phone: key, iat: Date.now() });
    res.json({ token });
  } catch (err) {
    fail(res, err, 'No se pudo verificar la biometría. Intenta de nuevo.');
  }
});

// Registro de biometría admin (primera vez): guarda huella/Face ID y emite token.
app.post('/api/auth/admin/biometric-register', async (req, res) => {
  try {
    const { phone, response } = req.body || {};
    const key = String(phone || '').replace(/\D/g, '').slice(-11);
    if (!ADMIN_PHONES.includes(key)) {
      return res.status(403).json({ error: 'Este número no tiene acceso al panel' });
    }
    const v = await webauthn.verifyRegistration(phone, response, req);
    if (!v.ok) return res.status(v.status || 400).json({ error: v.error || 'No se pudo guardar la biometría' });
    const token = signToken({ role: 'admin', phone: key, iat: Date.now() });
    res.json({ token });
  } catch (err) {
    fail(res, err, 'No se pudo guardar la biometría. Intenta de nuevo.');
  }
});

// Public
app.get('/api/state', async (req, res) => {
  try {
    const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : undefined;
    const [state, rate] = await Promise.all([store.getPublicState(clientId), getBcvRate()]);
    const payload = { ...state, rate };
    const body = JSON.stringify(payload);
    const etag = `"${crypto.createHash('sha1').update(body).digest('hex')}"`;
    // Revalidación condicional: si el cliente ya tiene este estado, no
    // reenviamos el cuerpo. Ahorra ~90% del tráfico del polling.
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    res.set('ETag', etag);
    res.set('Cache-Control', 'no-cache');
    res.json(payload);
  } catch (err) {
    fail(res, err, 'No se pudo cargar la tienda. Intenta de nuevo en unos segundos.');
  }
});

app.get('/api/rate', async (req, res) => {
  try {
    res.json(await getBcvRate());
  } catch (err) {
    fail(res, err, 'No se pudo obtener la tasa de cambio del día.');
  }
});

// Sirve la imagen de un producto bajo demanda (el estado público solo expone
// la URL). Convierte el base64 guardado en la BD a bytes y deja que el
// navegador la cachee para no re-descargarla en cada carga.
app.get('/api/products/:id/image', async (req, res) => {
  try {
    const product = await store.getProductById(req.params.id);
    const image = product && product.image;
    if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }
    const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return res.status(404).json({ error: 'Imagen inválida' });
    const buf = Buffer.from(match[2], 'base64');
    const etag = `"${crypto.createHash('sha1').update(buf).digest('hex')}"`;
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    res.set('ETag', etag);
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Content-Type', match[1]);
    res.send(buf);
  } catch (err) {
    fail(res, err, 'No se pudo cargar la imagen del producto.');
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const result = await store.createOrder(req.body || {});
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
    notifyAdminsNewOrder(result.order).catch(() => {});
  } catch (err) {
    fail(res, err, 'No se pudo realizar el pedido. Intenta de nuevo.');
  }
});

// Reserva de stock en tiempo real: sincroniza el carrito del cliente (clientId)
// con el servidor. El stock reservado por otros clientes se descuenta del stock
// visible; las reservas expiran (5 min carrito / 7 min checkout).
app.post('/api/holds', async (req, res) => {
  try {
    const { clientId, items, ttlMs } = req.body || {};
    const result = await store.holdStock(clientId, items, ttlMs);
    if (result.error) return res.status(409).json({ error: result.error, available: result.available });
    res.json(result);
  } catch (err) {
    fail(res, err, 'No se pudo reservar el stock. Intenta de nuevo.');
  }
});

app.delete('/api/holds', async (req, res) => {
  try {
    const { clientId } = req.body || {};
    res.json(await store.releaseStock(clientId));
  } catch (err) {
    fail(res, err, 'No se pudo liberar el stock. Intenta de nuevo.');
  }
});

// ---- Carritos compartidos ("Compartir Carrito") ----

// Crea el carrito compartido del dueño (base = su carrito actual).
app.post('/api/share', async (req, res) => {
  try {
    const { clientId, ownerName, items } = req.body || {};
    const result = await store.createShare({ clientId, ownerName, items });
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    fail(res, err, 'No se pudo crear el carrito compartido. Intenta de nuevo.');
  }
});

// Consulta pública de un carrito compartido por su código.
app.get('/api/share/:code', async (req, res) => {
  try {
    const share = await store.getShare(req.params.code);
    if (!share) return res.status(404).json({ error: 'Carrito compartido no encontrado o expirado' });
    res.json(share);
  } catch (err) {
    fail(res, err, 'No se pudo cargar el carrito compartido.');
  }
});

// El invitado suma artículos al carrito compartido.
app.post('/api/share/:code/items', async (req, res) => {
  try {
    const { items } = req.body || {};
    const result = await store.addToShare({ code: req.params.code, items });
    if (result.error) return res.status(404).json({ error: result.error });
    res.json(result);
  } catch (err) {
    fail(res, err, 'No se pudo agregar al carrito compartido.');
  }
});

// Cierra el carrito compartido (solo el dueño).
app.delete('/api/share/:code', async (req, res) => {
  try {
    const result = await store.deleteShare({ code: req.params.code, clientId: (req.body || {}).clientId });
    if (result.error) return res.status(403).json({ error: result.error });
    res.json(result);
  } catch (err) {
    fail(res, err, 'No se pudo cerrar el carrito compartido.');
  }
});

// Lista negra: clientes con deuda (balance > 0). Definido antes de las rutas
// /api/customers/:phone para que "blacklist" no se interprete como teléfono.
app.get('/api/customers/blacklist', requireAdmin, async (req, res) => {
  try {
    const customers = await store.listCustomers();
    res.json(customers.filter((c) => (Number(c.balance) || 0) > 0));
  } catch (err) {
    fail(res, err, 'No se pudo cargar la lista de deudores.');
  }
});

// Añade un deudor a la lista negra (setea el balance inicial manualmente).
app.post('/api/customers/blacklist', requireAdmin, async (req, res) => {
  try {
    const { phone, name, amount } = req.body || {};
    const key = String(phone || '').replace(/\D/g, '').slice(-11);
    if (!key || key.length < 7) return res.status(400).json({ error: 'Número de teléfono inválido' });
    let customer = await store.getCustomerByPhone(key);
    if (!customer) {
      customer = await store.upsertCustomer({ phone: key, customerName: name });
    }
    await store.setCustomerBalance(key, Number(amount) || 0);
    if (name) await store.upsertCustomer({ phone: key, customerName: name });
    res.json(await store.getCustomerByPhone(key));
  } catch (err) {
    fail(res, err, 'No se pudo guardar el deudor. Intenta de nuevo.');
  }
});

// Registra una deuda manual por productos (ventas presenciales o deudas viejas):
// crea un pedido a crédito entregado y lo suma al balance del deudor.
app.post('/api/customers/blacklist/debt', requireAdmin, async (req, res) => {
  try {
    const { phone, name, items } = req.body || {};
    const key = String(phone || '').replace(/\D/g, '').slice(-11);
    if (!key || key.length < 7) return res.status(400).json({ error: 'Número de teléfono inválido' });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Selecciona al menos un producto' });
    }
    const order = await store.addDebtToCustomer({ phone: key, customerName: name, items });
    if (!order) return res.status(400).json({ error: 'No se pudo registrar la deuda' });
    if (name) await store.upsertCustomer({ phone: key, customerName: name });
    res.json({ order, customer: await store.getCustomerByPhone(key), state: await store.getPublicState() });
  } catch (err) {
    fail(res, err, 'No se pudo registrar la deuda. Intenta de nuevo.');
  }
});

// Clientes (público por número de teléfono, para pre-llenado y direcciones)
app.get('/api/customers/:phone', async (req, res) => {
  try {
    const customer = await store.getCustomerByPhone(req.params.phone);
    res.json(customer || {});
  } catch (err) {
    fail(res, err, 'No se pudo cargar los datos del cliente.');
  }
});

app.put('/api/customers/:phone', async (req, res) => {
  try {
    const customer = await store.upsertCustomer({ ...(req.body || {}), phone: req.params.phone });
    if (!customer) return res.status(400).json({ error: 'Número de teléfono inválido' });
    res.json(customer);
  } catch (err) {
    fail(res, err, 'No se pudo guardar los datos del cliente.');
  }
});

// ---- Abonos a la deuda / "Mi Cartera" ----

// Lista abonos: admin ve todos (con comprobante bajo demanda); el cliente ve
// solo los suyos pasando ?phone= (mismo criterio que /api/customers/:phone).
app.get('/api/payments', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const isAdmin = authHeader.startsWith('Bearer ') && verifyToken(authHeader.slice(7));
    const phone = String(req.query.phone || '').replace(/\D/g, '').slice(-11);
    if (!isAdmin && !phone) return res.status(403).json({ error: 'No autorizado' });
    const all = await store.listPayments();
    const list = phone ? all.filter((p) => String(p.phone || '').replace(/\D/g, '').slice(-11) === phone) : all;
    res.json(
      list.map((p) => {
        const { proof, ...rest } = p;
        return { ...rest, hasProof: Boolean(proof) };
      })
    );
  } catch (err) {
    fail(res, err, 'No se pudo cargar los abonos.');
  }
});

// El cliente registra un abono: sube comprobante + monto en Bs. El servidor lo
// convierte a USD con la tasa del día y queda pendiente de aprobación admin.
app.post('/api/payments', async (req, res) => {
  try {
    const { phone, customerName, amountBs, reference, proof } = req.body || {};
    const key = String(phone || '').replace(/\D/g, '').slice(-11);
    if (!key || key.length < 7) return res.status(400).json({ error: 'Número de teléfono inválido' });
    const amount = Number(amountBs);
    if (!(amount > 0)) return res.status(400).json({ error: 'Indica cuánto abonaste en bolívares' });
    if (!proof || typeof proof !== 'string' || !proof.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Adjunta el comprobante del abono (foto o archivo)' });
    }
    if (proof.length > 3000000) {
      return res.status(400).json({ error: 'La imagen es demasiado grande' });
    }
    const { rate } = await getBcvRate();
    if (!(rate > 0)) return res.status(502).json({ error: 'No se pudo obtener la tasa del día. Intenta más tarde.' });
    let storedProof = proof;
    if (isStorageConfigured()) {
      const url = await uploadProof(`abono-${Date.now()}`, proof);
      if (url) storedProof = url;
    }
    const payment = await store.createPayment({
      phone: key,
      customerName: String(customerName || '').slice(0, 80) || 'Cliente',
      amountBs: amount,
      rate,
      amountUsd: amount / rate,
      reference: String(reference || '').slice(0, 120),
      proof: storedProof
    });
    if (!payment) return res.status(400).json({ error: 'No se pudo registrar el abono' });
    res.json({ payment });
    if (ADMIN_PHONES.length > 0) {
      push
        .sendToPhone(ADMIN_PHONES, {
          title: 'Nuevo abono por aprobar',
          body: `${payment.id} · ${payment.customerName} · Bs ${payment.amountBs.toFixed(2)} (≈ $${payment.amountUsd.toFixed(2)})`,
          url: '/'
        })
        .catch(() => {});
    }
  } catch (err) {
    fail(res, err, 'No se pudo registrar el abono.');
  }
});

// Sirve el comprobante de un abono bajo demanda (admin o el dueño del teléfono).
app.get('/api/payments/:id/proof', async (req, res) => {
  try {
    const payment = await store.getPaymentById(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Abono no encontrado' });
    const authHeader = req.headers.authorization || '';
    const isAdmin = authHeader.startsWith('Bearer ') && verifyToken(authHeader.slice(7));
    const phoneOk =
      String(payment.phone || '').replace(/\D/g, '').slice(-11) ===
      String(req.query.phone || '').replace(/\D/g, '').slice(-11);
    if (!isAdmin && !phoneOk) return res.status(403).json({ error: 'No autorizado para este abono' });
    if (!payment.proof) return res.status(404).json({ error: 'Este abono no tiene comprobante' });
    res.json({ proof: payment.proof });
  } catch (err) {
    fail(res, err, 'No se pudo cargar el comprobante del abono.');
  }
});

// Aprobar un abono (solo admin): descuenta el monto en USD de la deuda del
// cliente; el excedente queda como saldo a favor ("Mi Cartera").
app.post('/api/payments/:id/approve', requireAdmin, async (req, res) => {
  try {
    const result = await store.approvePayment(req.params.id);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ payment: result, state: await store.getPublicState() });
    if (result.phone) {
      push
        .sendToPhone([result.phone], {
          title: 'Abono aprobado',
          body: `Tu abono ${result.id} de $${(Number(result.amountUsd) || 0).toFixed(2)} fue aprobado y aplicado a tu cuenta.`,
          url: '/'
        })
        .catch(() => {});
    }
  } catch (err) {
    fail(res, err, 'No se pudo aprobar el abono.');
  }
});

// Rechazar un abono (solo admin).
app.post('/api/payments/:id/reject', requireAdmin, async (req, res) => {
  try {
    const result = await store.rejectPayment(req.params.id, (req.body || {}).note);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ payment: result, state: await store.getPublicState() });
    if (result.phone) {
      push
        .sendToPhone([result.phone], {
          title: 'Abono rechazado',
          body: `Tu abono ${result.id} no pudo ser verificado. Revisa el comprobante e intenta de nuevo.`,
          url: '/'
        })
        .catch(() => {});
    }
  } catch (err) {
    fail(res, err, 'No se pudo rechazar el abono.');
  }
});

// WebAuthn: biometría del celular para identificar al cliente
app.post('/api/webauthn/register-options', webauthn.registrationOptions);
app.post('/api/webauthn/register-verify', webauthn.registrationVerify);
app.post('/api/webauthn/login-options', webauthn.authenticationOptions);
app.post('/api/webauthn/login-verify', webauthn.authenticationVerify);

// ---- Notificaciones push (Web Push / PWA) ----

// Clave VAPID pública para que el navegador cree la suscripción.
app.get('/api/push/vapid-key', async (req, res) => {
  try {
    const publicKey = await push.getVapidPublicKey();
    if (!publicKey) return res.status(500).json({ error: 'Push no configurado' });
    res.json({ publicKey });
  } catch (err) {
    fail(res, err, 'No se pudo obtener la clave de notificaciones.');
  }
});

// Registra la suscripción push de un dispositivo (identificada por teléfono).
app.post('/api/push/subscribe', async (req, res) => {
  try {
    const { phone, subscription } = req.body || {};
    if (!subscription || !subscription.endpoint) return res.status(400).json({ error: 'Suscripción inválida' });
    await push.subscribe(phone, subscription);
    res.json({ ok: true });
  } catch (err) {
    fail(res, err, 'No se pudo guardar la suscripción.');
  }
});

app.post('/api/push/unsubscribe', async (req, res) => {
  try {
    await push.unsubscribe((req.body || {}).endpoint);
    res.json({ ok: true });
  } catch (err) {
    fail(res, err, 'No se pudo quitar la suscripción.');
  }
});

// Enviar una notificación de prueba a un teléfono (solo admin).
app.post('/api/push/test', requireAdmin, async (req, res) => {
  try {
    const { phone, title, body } = req.body || {};
    if (!phone) return res.status(400).json({ error: 'Indica el teléfono' });
    const sent = await push.sendToPhone([phone], {
      title: title || 'Notificación de prueba',
      body: body || 'Si ves esto, las notificaciones están funcionando.',
      url: '/'
    });
    res.json({ ok: true, sent });
  } catch (err) {
    fail(res, err, 'No se pudo enviar la notificación.');
  }
});

// Broadcast: promoción u aviso para todos los suscritos (solo admin).
app.post('/api/push/broadcast', requireAdmin, async (req, res) => {
  try {
    const { title, body } = req.body || {};
    if (!title || !body) return res.status(400).json({ error: 'Faltan título o mensaje' });
    const sent = await push.sendToAll({ title, body, url: '/' }, ADMIN_PHONES);
    res.json({ ok: true, sent });
  } catch (err) {
    fail(res, err, 'No se pudo enviar la promoción.');
  }
});

// Recordatorio de deuda a un cliente (solo admin). Usa el balance actual.
app.post('/api/push/reminder', requireAdmin, async (req, res) => {
  try {
    const { phone, amount } = req.body || {};
    if (!phone) return res.status(400).json({ error: 'Indica el teléfono' });
    const debt = Number(amount) || 0;
    const sent = await push.sendToPhone([phone], {
      title: 'Recordatorio de deuda',
      body: debt > 0 ? `Tienes un saldo pendiente de $${debt.toFixed(2)}. ¡Pásate a saldar o escríbenos!` : 'Recuerda saldar tu cuenta. ¡Estamos para ayudarte!',
      url: '/'
    });
    res.json({ ok: true, sent });
  } catch (err) {
    fail(res, err, 'No se pudo enviar el recordatorio.');
  }
});

// Admin
app.post('/api/products', requireAdmin, async (req, res) => {
  try {
    res.json(await store.createProduct(req.body || {}));
  } catch (err) {
    fail(res, err, 'No se pudo crear el producto. Intenta de nuevo.');
  }
});

app.put('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const result = await store.updateProduct(req.params.id, req.body || {});
    if (result.error) return res.status(404).json({ error: result.error });
    res.json(result);
  } catch (err) {
    fail(res, err, 'No se pudo actualizar el producto.');
  }
});

app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    res.json(await store.deleteProduct(req.params.id));
  } catch (err) {
    fail(res, err, 'No se pudo eliminar el producto.');
  }
});

app.post('/api/categories', requireAdmin, async (req, res) => {
  try {
    res.json(await store.addCategory((req.body || {}).name));
  } catch (err) {
    fail(res, err, 'No se pudo agregar la categoría.');
  }
});

app.patch('/api/orders/:id', requireAdmin, async (req, res) => {
  try {
    const result = await store.updateOrderStatus(req.params.id, (req.body || {}).status);
    if (result.error) return res.status(404).json({ error: result.error });
    res.json(result);
    const updated = await store.getOrderById(req.params.id);
    notifyOrderStatus(updated).catch(() => {});
  } catch (err) {
    fail(res, err, 'No se pudo actualizar el pedido.');
  }
});

// ---- Pagos digitales (pago móvil / transferencia) ----

// Confirmar o rechazar el pago de un pedido (solo admin).
app.post('/api/orders/:id/payment', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!['confirmado', 'rechazado'].includes(status)) {
      return res.status(400).json({ error: 'Estado de pago inválido' });
    }
    const result = await store.updateOrderPayment(req.params.id, { paymentStatus: status });
    if (result.error) return res.status(404).json({ error: result.error });
    res.json(result);
    const updated = await store.getOrderById(req.params.id);
    if (updated && updated.phone) {
      let body =
        status === 'confirmado'
          ? `Tu pago del pedido ${updated.id} fue confirmado. ¡Gracias!`
          : `Tu pago del pedido ${updated.id} fue rechazado. Suministra otro comprobante para continuar.`;
      if (status === 'rechazado') {
        try {
          const customer = await store.getCustomerByPhone(updated.phone);
          if (customer?.isBenefited) {
            body = `Tu pago del pedido ${updated.id} fue rechazado. Suministra otro comprobante o pásalo a tu cuenta.`;
          }
        } catch {}
      }
      push.sendToPhone([updated.phone], {
        title: `Pago ${status === 'confirmado' ? 'confirmado' : 'rechazado'}`,
        body,
        url: '/'
      }).catch(() => {});
    }
  } catch (err) {
    fail(res, err, 'No se pudo actualizar el pago.');
  }
});

// Adjuntar el comprobante de pago a un pedido (el cliente sube la imagen).
app.post('/api/orders/:id/payment-proof', async (req, res) => {
  try {
    const { phone, proof, reference } = req.body || {};
    const order = await store.getOrderById(req.params.id);
    const orderPhoneOk =
      String(order?.phone || '').replace(/\D/g, '').slice(-11) === String(phone || '').replace(/\D/g, '').slice(-11);
    console.log(
      `[kiosko] payment-proof id=${req.params.id} found=${!!order} phoneOk=${orderPhoneOk} ` +
        `proof=${proof ? `${proof.slice(0, 30)}... len=${proof.length}` : 'null'}`
    );
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (String(order.phone || '').replace(/\D/g, '').slice(-11) !== String(phone || '').replace(/\D/g, '').slice(-11)) {
      return res.status(403).json({ error: 'No autorizado para este pedido' });
    }
    if (order.paymentStatus === 'confirmado') {
      return res.status(400).json({ error: 'Este pago ya fue confirmado' });
    }
    if (!proof || typeof proof !== 'string' || !proof.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Comprobante inválido' });
    }
    if (proof.length > 3000000) {
      return res.status(400).json({ error: 'La imagen es demasiado grande' });
    }
    // Nivel B: si hay Supabase configurado, subimos el comprobante al bucket y
    // guardamos la URL (liviana) en vez del base64. Si no está configurado o el
    // upload falla, se guarda el base64 en la BD (comportamiento actual).
    let storedProof = proof;
    if (isStorageConfigured()) {
      const url = await uploadProof(req.params.id, proof);
      if (url) {
        storedProof = url;
        console.log(`[kiosko] payment-proof id=${req.params.id} subido a Supabase Storage`);
      }
    }
    const result = await store.updateOrderPayment(req.params.id, {
      paymentProof: storedProof,
      paymentReference: String(reference || '').slice(0, 120),
      paymentStatus: 'pendiente'
    });
    console.log(`[kiosko] payment-proof resultado: ${result.error ? 'error=' + result.error : 'ok'}`);
    if (result.error) return res.status(404).json({ error: result.error });
    res.json(result);
  } catch (err) {
    fail(res, err, 'No se pudo guardar el comprobante.');
  }
});

// Sirve el comprobante de pago de un pedido bajo demanda. No se envía en el
// estado público (/api/state) porque es pesado y sensible; aquí solo accede el
// admin (Bearer token) o el dueño del pedido (mismo teléfono).
app.get('/api/orders/:id/proof', async (req, res) => {
  try {
    const order = await store.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    const authHeader = req.headers.authorization || '';
    const isAdmin = authHeader.startsWith('Bearer ') && verifyToken(authHeader.slice(7));
    const phoneOk =
      String(order.phone || '').replace(/\D/g, '').slice(-11) === String(req.query.phone || '').replace(/\D/g, '').slice(-11);
    if (!isAdmin && !phoneOk) return res.status(403).json({ error: 'No autorizado para este pedido' });
    if (!order.paymentProof) return res.status(404).json({ error: 'Este pedido no tiene comprobante' });
    res.json({ proof: order.paymentProof });
  } catch (err) {
    fail(res, err, 'No se pudo cargar el comprobante.');
  }
});

// ---- Chat del pedido ----

// Pasa un pedido con pago rechazado/pendiente a la cuenta del cliente (crédito).
// Solo el dueño del pedido y si el cliente es beneficiado.
app.post('/api/orders/:id/payment/credit', async (req, res) => {
  try {
    const { phone } = req.body || {};
    const order = await store.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (String(order.phone || '').replace(/\D/g, '').slice(-11) !== String(phone || '').replace(/\D/g, '').slice(-11)) {
      return res.status(403).json({ error: 'No autorizado para este pedido' });
    }
    const customer = await store.getCustomerByPhone(order.phone);
    if (!customer || !customer.isBenefited) {
      return res.status(403).json({ error: 'Solo los clientes beneficiados pueden pedir a cuenta' });
    }
    const result = await store.convertToCredit(req.params.id);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
    const updated = await store.getOrderById(req.params.id);
    if (updated && updated.phone) {
      push.sendToPhone([updated.phone], {
        title: `Pedido ${updated.id} a cuenta`,
        body: 'Tu pedido pasó a tu cuenta. Se sumará a tu saldo al entregarse.',
        url: '/'
      }).catch(() => {});
    }
    if (ADMIN_PHONES.length) {
      push.sendToPhone(ADMIN_PHONES, {
        title: `Pedido ${updated?.id || req.params.id} a cuenta`,
        body: `${order.customerName || 'Cliente'} convirtió su pago a cuenta (beneficiado).`,
        url: '/'
      }).catch(() => {});
    }
  } catch (err) {
    fail(res, err, 'No se pudo pasar el pedido a cuenta.');
  }
});

const authorizeOrderChat = async (req, orderId) => {
  const order = await store.getOrderById(orderId);
  if (!order) return { error: 'Pedido no encontrado', status: 404 };
  const authHeader = req.headers.authorization || '';
  const isAdmin = authHeader.startsWith('Bearer ') && verifyToken(authHeader.slice(7));
  if (isAdmin) return { order };
  const phone = req.body?.phone || req.query?.phone || '';
  if (String(order.phone || '').replace(/\D/g, '').slice(-11) === String(phone).replace(/\D/g, '').slice(-11)) {
    return { order };
  }
  return { error: 'No autorizado para este pedido', status: 403 };
};

// Enviar mensaje de chat (admin o el dueño del pedido).
app.post('/api/orders/:id/messages', async (req, res) => {
  try {
    const auth = await authorizeOrderChat(req, req.params.id);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const text = String(req.body?.text || '').trim().slice(0, 500);
    if (!text) return res.status(400).json({ error: 'Escribe un mensaje' });
    const isAdminSender = auth.order.phone && (req.headers.authorization || '').startsWith('Bearer ');
    const sender = isAdminSender ? 'admin' : 'customer';
    let senderName = sender === 'customer' ? auth.order.customerName || 'Cliente' : 'Tienda';
    if (isAdminSender) {
      try {
        const adminPhone = (decodeToken((req.headers.authorization || '').slice(7)) || {}).phone;
        const adminCustomer = adminPhone ? await store.getCustomerByPhone(adminPhone) : null;
        if (adminCustomer?.customerName) senderName = adminCustomer.customerName;
      } catch {}
    }
    const message = { id: `m-${Date.now()}-${Math.floor(Math.random() * 1000)}`, sender, senderName, text, at: new Date().toISOString() };
    const result = await store.addOrderMessage(req.params.id, message);
    if (result.error) return res.status(404).json({ error: result.error });
    res.json({ ok: true, message });
    // Notifica al otro lado del chat.
    if (sender === 'admin') {
      push.sendToPhone([auth.order.phone], {
        title: `Nuevo mensaje · Pedido ${auth.order.id}`,
        body: text,
        url: '/'
      }).catch(() => {});
    } else if (ADMIN_PHONES.length) {
      push.sendToPhone(ADMIN_PHONES, {
        title: `Mensaje del cliente · ${auth.order.id}`,
        body: text,
        url: '/'
      }).catch(() => {});
    }
  } catch (err) {
    fail(res, err, 'No se pudo enviar el mensaje.');
  }
});

// Leer mensajes del chat (admin o el dueño del pedido).
app.get('/api/orders/:id/messages', async (req, res) => {
  try {
    const auth = await authorizeOrderChat(req, req.params.id);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    res.json({ messages: await store.getOrderMessages(req.params.id) });
  } catch (err) {
    fail(res, err, 'No se pudieron cargar los mensajes.');
  }
});

// Cancelar pedido (público, pero solo el dueño del teléfono puede cancelar su pedido)
app.post('/api/orders/:id/cancel', async (req, res) => {
  try {
    const result = await store.cancelOrder(req.params.id, (req.body || {}).phone);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    fail(res, err, 'No se pudo cancelar el pedido. Intenta de nuevo.');
  }
});

// Reporta la posición en vivo del repartidor para un pedido a domicilio.
// El admin (que es quien reparte) envía su GPS periódicamente mientras entrega.
app.post('/api/orders/:id/courier-location', requireAdmin, async (req, res) => {
  try {
    const { lat, lng } = req.body || {};
    if (lat == null || lng == null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
      return res.status(400).json({ error: 'Coordenadas inválidas' });
    }
    const order = await store.updateCourierLocation(req.params.id, Number(lat), Number(lng));
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json({ ok: true, order });
  } catch (err) {
    fail(res, err, 'No se pudo actualizar la ubicación del repartidor.');
  }
});

// Rastreo público de un pedido: estado + destino + posición del repartidor.
// Lo usa el cliente para ver en tiempo real cómo avanza su entrega a domicilio.
app.get('/api/orders/:id/tracking', async (req, res) => {
  try {
    const tracking = await store.getOrderTracking(req.params.id);
    if (!tracking) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(tracking);
  } catch (err) {
    fail(res, err, 'No se pudo obtener el rastreo del pedido.');
  }
});

// Eliminar pedido (solo admin, solo pedidos cancelados)
app.delete('/api/orders/:id', requireAdmin, async (req, res) => {
  try {
    const result = await store.deleteOrder(req.params.id);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    fail(res, err, 'No se pudo eliminar el pedido.');
  }
});

app.put('/api/settings', requireAdmin, async (req, res) => {
  try {
    await store.saveSettings(req.body || {});
    res.json(await store.getPublicState());
  } catch (err) {
    fail(res, err, 'No se pudieron guardar los ajustes.');
  }
});

// Refresca el espejo de base de datos (copiar datos de producción hacia calidad).
// Solo admin. Se usa desde el panel de administración en el entorno de staging.
app.post('/api/db/refresh', requireAdmin, async (req, res) => {
  if (!store.isMirrorEnabled()) {
    return res.status(400).json({ error: 'Refresco no disponible sin DATABASE_URL' });
  }
  try {
    const result = await store.refreshMirror();
    if (!result.ok) return res.status(500).json({ error: result.error });
    res.json({ ok: true, source: result.source, target: result.target, tables: result.tables });
  } catch (err) {
    fail(res, err, 'No se pudo refrescar la base de datos.');
  }
});

// Lista todos los clientes registrados (para "Beneficiados").
app.get('/api/customers', requireAdmin, async (req, res) => {
  try {
    res.json(await store.listCustomers());
  } catch (err) {
    fail(res, err, 'No se pudo cargar la lista de clientes.');
  }
});

// Concede o revoca el beneficio de pedir a crédito a un cliente.
app.put('/api/customers/:phone/benefited', requireAdmin, async (req, res) => {
  try {
    const customer = await store.setCustomerBenefited(req.params.phone, Boolean(req.body?.benefited));
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(customer);
  } catch (err) {
    fail(res, err, 'No se pudo actualizar el beneficio.');
  }
});

// Cobros programados (cuentas por cobrar programadas a enviar por WhatsApp).
app.get('/api/collections', requireAdmin, async (req, res) => {
  try {
    res.json(await store.listCollections());
  } catch (err) {
    fail(res, err, 'No se pudo cargar los cobros programados.');
  }
});

// Crea o actualiza un cobro programado.
app.post('/api/collections', requireAdmin, async (req, res) => {
  try {
    const result = await store.upsertCollection(req.body || {});
    res.json(result);
  } catch (err) {
    fail(res, err, 'No se pudo guardar el cobro programado.');
  }
});

app.delete('/api/collections/:id', requireAdmin, async (req, res) => {
  try {
    const result = await store.removeCollection(req.params.id);
    res.json(result);
  } catch (err) {
    fail(res, err, 'No se pudo eliminar el cobro programado.');
  }
});

// Pexels proxy (used in production; in dev Vite proxies /pexels-api)
app.use('/pexels-api', async (req, res) => {
  try {
    const target = 'https://api.pexels.com/v1' + req.url;
    const upstream = await fetch(target, {
      headers: { Authorization: PEXELS_API_KEY }
    });
    const body = await upstream.text();
    res
      .status(upstream.status)
      .set('Content-Type', upstream.headers.get('content-type') || 'application/json')
      .send(body);
  } catch {
    res.status(502).json({ error: 'No se pudo contactar a Pexels' });
  }
});

// Static build (production)
const dist = path.join(__dirname, '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
}

app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/pexels-api')) {
    return next();
  }
  res.sendFile(path.join(dist, 'index.html'), (err) => {
    if (err) next();
  });
});

const PORT = process.env.PORT || 3500;

// Refresco automático del espejo (producción -> calidad). Se activa solo si se
// define KIOSKO_REFRESH_INTERVAL_MS (ms) y hay DATABASE_URL. En el plan free de
// Render el servicio duerme tras ~15 min sin tráfico, por lo que el intervalo
// real depende de que el proceso web esté activo.
function scheduleAutoRefresh() {
  const interval = Number(process.env.KIOSKO_REFRESH_INTERVAL_MS || 0);
  if (!(interval > 0)) return;
  if (!store.isMirrorEnabled()) return;

  const tick = async () => {
    try {
      const result = await store.refreshMirror();
      console.log(
        `[kiosko] Refresco automático de espejo: ${result.ok ? 'ok' : 'fallo'} ` +
          (result.ok ? JSON.stringify(result.tables) : result.error)
      );
    } catch (err) {
      console.error('[kiosko] Error en el refresco automático del espejo:', err.message);
    }
  };

  setInterval(tick, interval);
  setTimeout(tick, 5000); // primer refresco poco después de arrancar
  console.log(`[kiosko] Refresco automático del espejo cada ${interval} ms`);
}

store.initStore().then(async () => {
  scheduleAutoRefresh();
  await push.ensureVapid().catch((err) => console.warn('[kiosko] VAPID no listo:', err.message));
  app.listen(PORT, () => {
    console.log(`[kiosko] Servidor corriendo en http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('[kiosko] Error inicializando el store:', err);
  process.exit(1);
});
