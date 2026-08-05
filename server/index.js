import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import * as store from './store.js';
import * as webauthn from './webauthn.js';
import { getBcvRate } from './rate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '2mb' }));

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

// Auth
app.post('/api/auth/login', async (req, res) => {
  const { phone, password } = req.body || {};
  const key = String(phone || '').replace(/\D/g, '').slice(-11);
  if (key && !ADMIN_PHONES.includes(key)) {
    return res.status(401).json({ error: 'Ese número no tiene acceso al panel' });
  }
  const ok = await verifyAdminPassword(key || phone, password);
  if (!ok) return res.status(401).json({ error: 'Contraseña incorrecta' });
  const token = signToken({ role: 'admin', phone: key || '', iat: Date.now() });
  res.json({ token });
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
    fail(res, err, 'No se pudo recuperar la contraseña. Intentá de nuevo.');
  }
});

// Public
app.get('/api/state', async (req, res) => {
  try {
    const [state, rate] = await Promise.all([store.getState(), getBcvRate()]);
    res.json({ ...state, rate });
  } catch (err) {
    fail(res, err, 'No se pudo cargar la tienda. Intentá de nuevo en unos segundos.');
  }
});

app.get('/api/rate', async (req, res) => {
  try {
    res.json(await getBcvRate());
  } catch (err) {
    fail(res, err, 'No se pudo obtener la tasa de cambio del día.');
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const result = await store.createOrder(req.body || {});
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    fail(res, err, 'No se pudo realizar el pedido. Intentá de nuevo.');
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
    fail(res, err, 'No se pudo guardar el deudor. Intentá de nuevo.');
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
      return res.status(400).json({ error: 'Seleccioná al menos un producto' });
    }
    const order = await store.addDebtToCustomer({ phone: key, customerName: name, items });
    if (!order) return res.status(400).json({ error: 'No se pudo registrar la deuda' });
    if (name) await store.upsertCustomer({ phone: key, customerName: name });
    res.json({ order, customer: await store.getCustomerByPhone(key), state: await store.getState() });
  } catch (err) {
    fail(res, err, 'No se pudo registrar la deuda. Intentá de nuevo.');
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

// WebAuthn: biometría del celular para identificar al cliente
app.post('/api/webauthn/register-options', webauthn.registrationOptions);
app.post('/api/webauthn/register-verify', webauthn.registrationVerify);
app.post('/api/webauthn/login-options', webauthn.authenticationOptions);
app.post('/api/webauthn/login-verify', webauthn.authenticationVerify);

// Admin
app.post('/api/products', requireAdmin, async (req, res) => {
  try {
    res.json(await store.createProduct(req.body || {}));
  } catch (err) {
    fail(res, err, 'No se pudo crear el producto. Intentá de nuevo.');
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
  } catch (err) {
    fail(res, err, 'No se pudo actualizar el pedido.');
  }
});

// Cancelar pedido (público, pero solo el dueño del teléfono puede cancelar su pedido)
app.post('/api/orders/:id/cancel', async (req, res) => {
  try {
    const result = await store.cancelOrder(req.params.id, (req.body || {}).phone);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    fail(res, err, 'No se pudo cancelar el pedido. Intentá de nuevo.');
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
    res.json(await store.getState());
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

store.initStore().then(() => {
  scheduleAutoRefresh();
  app.listen(PORT, () => {
    console.log(`[kiosko] Servidor corriendo en http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('[kiosko] Error inicializando el store:', err);
  process.exit(1);
});
