import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import * as store from './store.js';
import { getBcvRate } from './rate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '2mb' }));

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || config.adminPassword;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || config.pexelsApiKey;

const signToken = (payload) => {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', ADMIN_PASSWORD).update(data).digest('base64url');
  return `${data}.${sig}`;
};

const verifyToken = (token) => {
  const [data, sig] = String(token).split('.');
  if (!data || !sig) return false;
  const expected = crypto.createHmac('sha256', ADMIN_PASSWORD).update(data).digest('base64url');
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

// Auth
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    const token = signToken({ role: 'admin', iat: Date.now() });
    return res.json({ token });
  }
  return res.status(401).json({ error: 'Contraseña incorrecta' });
});

// Public
app.get('/api/state', async (req, res) => {
  try {
    const [state, rate] = await Promise.all([store.getState(), getBcvRate()]);
    res.json({ ...state, rate });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo leer el estado: ' + err.message });
  }
});

app.get('/api/rate', async (req, res) => {
  try {
    res.json(await getBcvRate());
  } catch (err) {
    res.status(500).json({ error: 'No se pudo obtener la tasa: ' + err.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const result = await store.createOrder(req.body || {});
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo crear el pedido: ' + err.message });
  }
});

// Clientes (público por número de teléfono, para pre-llenado y direcciones)
app.get('/api/customers/:phone', async (req, res) => {
  try {
    const customer = await store.getCustomerByPhone(req.params.phone);
    res.json(customer || {});
  } catch (err) {
    res.status(500).json({ error: 'No se pudo leer el cliente: ' + err.message });
  }
});

app.put('/api/customers/:phone', async (req, res) => {
  try {
    const customer = await store.upsertCustomer({ ...(req.body || {}), phone: req.params.phone });
    if (!customer) return res.status(400).json({ error: 'Número de teléfono inválido' });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo actualizar el cliente: ' + err.message });
  }
});

// Admin
app.post('/api/products', requireAdmin, async (req, res) => {
  try {
    res.json(await store.createProduct(req.body || {}));
  } catch (err) {
    res.status(500).json({ error: 'No se pudo crear el producto: ' + err.message });
  }
});

app.put('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const result = await store.updateProduct(req.params.id, req.body || {});
    if (result.error) return res.status(404).json({ error: result.error });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo actualizar el producto: ' + err.message });
  }
});

app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    res.json(await store.deleteProduct(req.params.id));
  } catch (err) {
    res.status(500).json({ error: 'No se pudo eliminar el producto: ' + err.message });
  }
});

app.post('/api/categories', requireAdmin, async (req, res) => {
  try {
    res.json(await store.addCategory((req.body || {}).name));
  } catch (err) {
    res.status(500).json({ error: 'No se pudo agregar la categoría: ' + err.message });
  }
});

app.patch('/api/orders/:id', requireAdmin, async (req, res) => {
  try {
    const result = await store.updateOrderStatus(req.params.id, (req.body || {}).status);
    if (result.error) return res.status(404).json({ error: result.error });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo actualizar el pedido: ' + err.message });
  }
});

app.put('/api/settings', requireAdmin, async (req, res) => {
  try {
    await store.saveSettings(req.body || {});
    res.json(await store.getState());
  } catch (err) {
    res.status(500).json({ error: 'No se pudieron guardar los ajustes: ' + err.message });
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
store.initStore().then(() => {
  app.listen(PORT, () => {
    console.log(`[kiosko] Servidor corriendo en http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('[kiosko] Error inicializando el store:', err);
  process.exit(1);
});
