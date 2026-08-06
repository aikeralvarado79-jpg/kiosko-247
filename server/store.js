import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS, INITIAL_ORDERS } from '../src/data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = process.env.KIOSKO_DATA_FILE || path.join(__dirname, 'data.json');

const defaultState = () => ({
  products: JSON.parse(JSON.stringify(INITIAL_PRODUCTS)),
  categories: [...INITIAL_CATEGORIES],
  orders: JSON.parse(JSON.stringify(INITIAL_ORDERS)),
  customers: [],
  webauthn: [],
  settings: { promos: [] }
});

const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '').slice(-11);

const generateProductId = () => `p-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

// ---------------------------------------------------------------------------
// Backend de archivo (local / dev). Se usa cuando no hay DATABASE_URL.
// ---------------------------------------------------------------------------
const fileStore = {
  state: defaultState(),

  load() {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      this.state = { ...defaultState(), ...parsed };
    } catch {
      this.state = defaultState();
    }
  },

  persist() {
    try {
      const tmp = DATA_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf8');
      fs.renameSync(tmp, DATA_FILE);
    } catch (err) {
      console.warn('[kiosko] No se pudo persistir data.json. Cambios solo en memoria.', err.message);
    }
  },

  async getState() {
    this.persist();
    const state = { ...this.state, settings: { ...this.state.settings } };
    delete state.settings.adminPassword;
    delete state.settings.adminCredentials;
    return state;
  },

  async saveProducts(products) {
    this.state.products = products;
    this.persist();
  },

  async saveCategories(categories) {
    this.state.categories = categories;
    this.persist();
  },

  async saveOrders(orders) {
    this.state.orders = orders;
    this.persist();
  },

  async updateCourierLocation(id, lat, lng) {
    const now = new Date().toISOString();
    this.state.orders = this.state.orders.map((o) =>
      o.id === id ? { ...o, courier_lat: Number(lat), courier_lng: Number(lng), courier_updated_at: now } : o
    );
    this.persist();
    return this.state.orders.find((o) => o.id === id) || null;
  },

  async saveSettings(settings) {
    // Merge para no pisar adminPassword/adminCredentials al guardar otros ajustes.
    this.state.settings = { ...this.state.settings, ...settings };
    this.persist();
  },

  async getAdminPassword() {
    return this.state.settings?.adminPassword || null;
  },

  async setAdminPassword(entry) {
    this.state.settings = { ...this.state.settings, adminPassword: entry };
    this.persist();
  },

  async getAdminCredential(phone) {
    const key = normalizePhone(phone);
    return this.state.settings?.adminCredentials?.[key] || null;
  },

  async setAdminCredential(phone, entry) {
    const key = normalizePhone(phone);
    this.state.settings = {
      ...this.state.settings,
      adminCredentials: { ...(this.state.settings.adminCredentials || {}), [key]: entry }
    };
    this.persist();
  },

  async listCollections() {
    return this.state.settings?.collections || [];
  },

  async saveCollections(collections) {
    this.state.settings = { ...this.state.settings, collections: Array.isArray(collections) ? collections : [] };
    this.persist();
  },

  async getSetting(key) {
    return this.state.settings ? this.state.settings[key] : null;
  },

  async setSetting(key, value) {
    this.state.settings = { ...this.state.settings, [key]: value };
    this.persist();
  },

  async getCustomerByPhone(phone) {
    const key = normalizePhone(phone);
    return this.state.customers.find((c) => c.phone === key) || null;
  },

  async getWebAuthnByPhone(phone) {
    const key = normalizePhone(phone);
    const cred = this.state.webauthn.find((c) => c.phone === key) || null;
    if (!cred) return null;
    return { ...cred, publicKey: Buffer.isBuffer(cred.publicKey) ? cred.publicKey : Buffer.from(cred.publicKey || []) };
  },

  async saveWebAuthn(phone, credential) {
    const key = normalizePhone(phone);
    this.state.webauthn = [
      { phone: key, ...credential, publicKey: Array.from(credential.publicKey) },
      ...this.state.webauthn.filter((c) => c.phone !== key)
    ];
    this.persist();
  },

  async deleteWebAuthn(phone) {
    const key = normalizePhone(phone);
    this.state.webauthn = this.state.webauthn.filter((c) => c.phone !== key);
    this.persist();
  },

  async upsertCustomer({ phone, customerName, address }) {
    const key = normalizePhone(phone);
    if (!key || key.length < 7) return null;
    const existing = this.state.customers.find((c) => c.phone === key);
    const addresses = existing?.addresses || [];
    if (address && !addresses.includes(address)) addresses.push(address);
    const now = new Date().toISOString();
    const record = {
      phone: key,
      customerName: customerName || existing?.customerName || 'Cliente',
      addresses,
      balance: Number(existing?.balance) || 0,
      isBenefited: Boolean(existing?.isBenefited),
      createdAt: existing?.createdAt || now,
      lastOrderAt: now
    };
    this.state.customers = [
      record,
      ...this.state.customers.filter((c) => c.phone !== key)
    ];
    this.persist();
    return record;
  },

  async listCustomers() {
    return this.state.customers
      .map((c) => ({ ...c, balance: Number(c.balance) || 0, isBenefited: Boolean(c.isBenefited) }))
      .sort((a, b) => normalizePhone(a.phone).localeCompare(normalizePhone(b.phone)));
  },

  async setCustomerBenefited(phone, benefited) {
    const key = normalizePhone(phone);
    if (!key) return null;
    const existing = this.state.customers.find((c) => c.phone === key);
    if (!existing) return null;
    const updated = { ...existing, isBenefited: Boolean(benefited) };
    this.state.customers = [
      updated,
      ...this.state.customers.filter((c) => c.phone !== key)
    ];
    this.persist();
    return updated;
  },

  async setCustomerBalance(phone, amount) {
    const key = normalizePhone(phone);
    if (!key) return null;
    const existing = this.state.customers.find((c) => c.phone === key);
    if (!existing) return null;
    const updated = { ...existing, balance: Number(amount) || 0 };
    this.state.customers = [
      updated,
      ...this.state.customers.filter((c) => c.phone !== key)
    ];
    this.persist();
    return updated;
  },

  async addOrderToAccount(order) {
    if (!order || !order.phone) return null;
    const key = normalizePhone(order.phone);
    const existing = this.state.customers.find((c) => c.phone === key);
    if (!existing) {
      await this.upsertCustomer({ phone: order.phone, customerName: order.customerName });
    }
    return this.setCustomerBalance(key, Number(existing ? existing.balance : 0) + Number(order.total) || 0);
  },

  // Registra una deuda manual por productos (ventas presenciales o deudas
  // anteriores a la app). Crea un pedido a crédito entregado y lo suma al
  // balance del cliente. No descuenta stock: no es una venta real por la app.
  async addDebtToCustomer({ phone, customerName, items }) {
    const key = normalizePhone(phone);
    if (!key) return null;
    const normalized = (items || []).map((it) => ({
      id: it.id,
      name: it.name,
      price: Number(it.price) || 0,
      quantity: Number(it.quantity) || 1
    }));
    const total = normalized.reduce((acc, it) => acc + it.price * it.quantity, 0);
    let id;
    do {
      id = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    } while (this.state.orders.some((o) => o.id === id));
    const order = {
      id,
      customerName: customerName || 'Cliente',
      phone: key,
      type: 'pickup',
      address: undefined,
      notes: 'Deuda registrada manualmente',
      items: normalized,
      total,
      status: 'entregado',
      timestamp: new Date().toISOString(),
      estimatedMinutes: 10,
      createdAt: new Date().toISOString(),
      credit: true
    };
    this.state.orders = [order, ...this.state.orders];
    await this.addOrderToAccount(order);
    this.persist();
    return order;
  }
};

// ---------------------------------------------------------------------------
// Backend Postgres (Supabase / producción). Se usa cuando existe DATABASE_URL.
// ---------------------------------------------------------------------------
const { Pool } = pg;

// Schema donde vive el estado. Por defecto "public" (producción); staging usa un
// schema aislado vía KIOSKO_DB_SCHEMA para no compartir datos con producción.
const DB_SCHEMA = process.env.KIOSKO_DB_SCHEMA || 'public';
const q = (table) => (DB_SCHEMA === 'public' ? table : `${DB_SCHEMA}.${table}`);

const pgPool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  : null;

// Tablas que se copian en el espejo. Fuente = producción (public), destino = schema
// aislado de calidad (staging). Reemplazo total por tabla (no hace merge).
// NOTA: webauthn_credentials NO se copia: WebAuthn ata la llave del dispositivo al
// rpID (= dominio completo). Una biometría registrada en kiosko-247.onrender.com es
// inválida en kiosko-247-staging.onrender.com y el navegador la rechaza con
// NotAllowedError. Además, cada refresh pisaría la biometría que los admins registren
// en staging. Cada ambiente mantiene sus propias credenciales biométricas.
const MIRROR_SOURCE_SCHEMA = process.env.MIRROR_SOURCE_SCHEMA || 'public';
const MIRROR_TARGET_SCHEMA = process.env.MIRROR_TARGET_SCHEMA || 'staging';
const MIRROR_TABLES = ['products', 'categories', 'orders', 'settings', 'customers'];

// Refresca el espejo: copia el estado completo desde un schema fuente (producción)
// hasta un schema destino (calidad), reemplazando su contenido por completo.
// Ya que el pooler de Supabase descarta SET search_path, se califican los nombres
// de schema explícitamente. Devuelve un resumen de filas copiadas por tabla.
export async function refreshMirror() {
  if (!pgPool) return { ok: false, error: 'Refresco disponible solo cuando hay DATABASE_URL' };
  if (MIRROR_SOURCE_SCHEMA === MIRROR_TARGET_SCHEMA) {
    return { ok: false, error: 'El schema fuente y destino deben ser distintos' };
  }
  // Seguridad: nunca permitir reemplazar el schema de producción (public). El
  // destino legítimo es el schema aislado de calidad (por ejemplo "staging"), que
  // es donde la app de staging lee sus datos, así que NO se compara contra DB_SCHEMA.
  if (MIRROR_TARGET_SCHEMA === 'public') {
    return { ok: false, error: 'El schema destino del espejo no puede ser public (producción)' };
  }
  const client = await pgPool.connect();
  const tables = {};
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${MIRROR_TARGET_SCHEMA}`);

    // Conservar ajustes propios del entorno de calidad (VAPID y suscripciones
    // push) antes de que el espejo borre la tabla settings: el esquema de
    // producción no los conoce y sin ellos las notificaciones se romperían.
    let localVapid = null;
    let localPushSubs = null;
    try {
      const v = await client.query(`SELECT value FROM ${MIRROR_TARGET_SCHEMA}.settings WHERE key = $1`, ['vapid']);
      if (v.rows[0]) localVapid = v.rows[0].value;
    } catch {}
    try {
      const s = await client.query(`SELECT value FROM ${MIRROR_TARGET_SCHEMA}.settings WHERE key = $1`, ['pushSubs']);
      if (s.rows[0]) localPushSubs = s.rows[0].value;
    } catch {}

    for (const t of MIRROR_TABLES) {
      const exists = await client.query('SELECT to_regclass($1) AS r', [`${MIRROR_SOURCE_SCHEMA}.${t}`]);
      if (!exists.rows[0].r) {
        tables[t] = -1;
        continue;
      }
      await client.query(`DROP TABLE IF EXISTS ${MIRROR_TARGET_SCHEMA}.${t}`);
      await client.query(`CREATE TABLE ${MIRROR_TARGET_SCHEMA}.${t} (LIKE ${MIRROR_SOURCE_SCHEMA}.${t} INCLUDING ALL)`);
      const ins = await client.query(`INSERT INTO ${MIRROR_TARGET_SCHEMA}.${t} SELECT * FROM ${MIRROR_SOURCE_SCHEMA}.${t}`);
      // El espejo copia el esquema de producción; re-agrega las columnas propias
      // de staging (deuda / beneficiados / crédito) por si el schema origen aún
      // no las tiene (CREATE TABLE ... LIKE no las trae).
      if (t === 'customers') {
        await client.query(`ALTER TABLE ${MIRROR_TARGET_SCHEMA}.customers ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0`);
        await client.query(`ALTER TABLE ${MIRROR_TARGET_SCHEMA}.customers ADD COLUMN IF NOT EXISTS "isBenefited" BOOLEAN DEFAULT false`);
      }
      if (t === 'orders') {
        await client.query(`ALTER TABLE ${MIRROR_TARGET_SCHEMA}.orders ADD COLUMN IF NOT EXISTS credit BOOLEAN DEFAULT false`);
        await client.query(`ALTER TABLE ${MIRROR_TARGET_SCHEMA}.orders ADD COLUMN IF NOT EXISTS lat NUMERIC`);
        await client.query(`ALTER TABLE ${MIRROR_TARGET_SCHEMA}.orders ADD COLUMN IF NOT EXISTS lng NUMERIC`);
        await client.query(`ALTER TABLE ${MIRROR_TARGET_SCHEMA}.orders ADD COLUMN IF NOT EXISTS "courier_lat" NUMERIC`);
        await client.query(`ALTER TABLE ${MIRROR_TARGET_SCHEMA}.orders ADD COLUMN IF NOT EXISTS "courier_lng" NUMERIC`);
        await client.query(`ALTER TABLE ${MIRROR_TARGET_SCHEMA}.orders ADD COLUMN IF NOT EXISTS "courier_updated_at" TEXT`);
        await client.query(`ALTER TABLE ${MIRROR_TARGET_SCHEMA}.orders ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT`);
        await client.query(`ALTER TABLE ${MIRROR_TARGET_SCHEMA}.orders ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT`);
        await client.query(`ALTER TABLE ${MIRROR_TARGET_SCHEMA}.orders ADD COLUMN IF NOT EXISTS "paymentProof" TEXT`);
        await client.query(`ALTER TABLE ${MIRROR_TARGET_SCHEMA}.orders ADD COLUMN IF NOT EXISTS "paymentReference" TEXT`);
        await client.query(`ALTER TABLE ${MIRROR_TARGET_SCHEMA}.orders ADD COLUMN IF NOT EXISTS messages JSONB DEFAULT '[]'`);
      }
      tables[t] = ins.rowCount;
    }

    // Restaurar VAPID y suscripciones push de calidad tras recrear settings.
    const restoreLocal = async (key, value) => {
      const up = await client.query(
        `UPDATE ${MIRROR_TARGET_SCHEMA}.settings SET value = $2::jsonb WHERE key = $1`,
        [key, value]
      );
      if (up.rowCount === 0) {
        await client.query(
          `INSERT INTO ${MIRROR_TARGET_SCHEMA}.settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT DO NOTHING`,
          [key, value]
        );
      }
    };
    if (localVapid != null) await restoreLocal('vapid', localVapid);
    if (localPushSubs != null) await restoreLocal('pushSubs', localPushSubs);

    await client.query('COMMIT');
    return { ok: true, source: MIRROR_SOURCE_SCHEMA, target: MIRROR_TARGET_SCHEMA, tables };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[kiosko] Error refrescando el espejo:', err);
    return { ok: false, error: 'No se pudo actualizar la base de datos de calidad. Intenta de nuevo.' };
  } finally {
    client.release();
  }
}

const pgStore = {
  pool: pgPool,

  async ensureSchema() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${q('products')} (
        id TEXT PRIMARY KEY,
        code TEXT,
        name TEXT,
        brand TEXT,
        description TEXT,
        price NUMERIC,
        category TEXT,
        stock INTEGER,
        "sizeValue" TEXT,
        "sizeUnit" TEXT,
        image TEXT,
        "createdAt" TEXT
      );
      ALTER TABLE ${q('products')} ADD COLUMN IF NOT EXISTS "createdAt" TEXT;
      CREATE TABLE IF NOT EXISTS ${q('categories')} (
        name TEXT PRIMARY KEY
      );
      CREATE TABLE IF NOT EXISTS ${q('orders')} (
        id TEXT PRIMARY KEY,
        "customerName" TEXT,
        phone TEXT,
        type TEXT,
        address TEXT,
        notes TEXT,
        items JSONB,
        total NUMERIC,
        status TEXT,
        timestamp TEXT,
        "estimatedMinutes" INTEGER,
        "createdAt" TEXT,
        credit BOOLEAN DEFAULT false,
        lat NUMERIC,
        lng NUMERIC,
        "courier_lat" NUMERIC,
        "courier_lng" NUMERIC,
        "courier_updated_at" TEXT
      );
      CREATE TABLE IF NOT EXISTS ${q('settings')} (
        key TEXT PRIMARY KEY,
        value JSONB
      );
      CREATE TABLE IF NOT EXISTS ${q('customers')} (
        phone TEXT PRIMARY KEY,
        "customerName" TEXT,
        addresses JSONB DEFAULT '[]',
        "createdAt" TEXT,
        "lastOrderAt" TEXT,
        balance NUMERIC DEFAULT 0,
        "isBenefited" BOOLEAN DEFAULT false
      );
      CREATE TABLE IF NOT EXISTS ${q('webauthn_credentials')} (
        phone TEXT PRIMARY KEY,
        credential_id TEXT,
        public_key BYTEA,
        counter INTEGER,
        rpID TEXT,
        "createdAt" TEXT
      );
      CREATE TABLE IF NOT EXISTS ${q('admin_credentials')} (
        phone TEXT PRIMARY KEY,
        salt TEXT,
        hash TEXT,
        "createdAt" TEXT
      );
    `);
    await this.pool.query(`ALTER TABLE ${q('orders')} ADD COLUMN IF NOT EXISTS "createdAt" TEXT`);
    await this.pool.query(`ALTER TABLE ${q('customers')} ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0`);
    await this.pool.query(`ALTER TABLE ${q('customers')} ADD COLUMN IF NOT EXISTS "isBenefited" BOOLEAN DEFAULT false`);
    await this.pool.query(`ALTER TABLE ${q('orders')} ADD COLUMN IF NOT EXISTS credit BOOLEAN DEFAULT false`);
    await this.pool.query(`ALTER TABLE ${q('webauthn_credentials')} ADD COLUMN IF NOT EXISTS rpID TEXT`);
    await this.pool.query(`ALTER TABLE ${q('orders')} ADD COLUMN IF NOT EXISTS lat NUMERIC`);
    await this.pool.query(`ALTER TABLE ${q('orders')} ADD COLUMN IF NOT EXISTS lng NUMERIC`);
    await this.pool.query(`ALTER TABLE ${q('orders')} ADD COLUMN IF NOT EXISTS "courier_lat" NUMERIC`);
    await this.pool.query(`ALTER TABLE ${q('orders')} ADD COLUMN IF NOT EXISTS "courier_lng" NUMERIC`);
    await this.pool.query(`ALTER TABLE ${q('orders')} ADD COLUMN IF NOT EXISTS "courier_updated_at" TEXT`);
    await this.pool.query(`ALTER TABLE ${q('orders')} ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT`);
    await this.pool.query(`ALTER TABLE ${q('orders')} ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT`);
    await this.pool.query(`ALTER TABLE ${q('orders')} ADD COLUMN IF NOT EXISTS "paymentProof" TEXT`);
    await this.pool.query(`ALTER TABLE ${q('orders')} ADD COLUMN IF NOT EXISTS "paymentReference" TEXT`);
    await this.pool.query(`ALTER TABLE ${q('orders')} ADD COLUMN IF NOT EXISTS messages JSONB DEFAULT '[]'`);
  },

  async seedIfEmpty() {
    const { rows } = await this.pool.query(`SELECT COUNT(*)::int AS n FROM ${q('products')}`);
    if (rows[0].n > 0) return;
    for (const p of defaultState().products) {
      await this.pool.query(
        `INSERT INTO ${q('products')} (id, code, name, brand, description, price, category, stock, "sizeValue", "sizeUnit", image)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`,
        [p.id, p.code, p.name, p.brand, p.description, p.price, p.category, p.stock, String(p.sizeValue ?? ''), p.sizeUnit || '', p.image || '']
      );
    }
    for (const c of defaultState().categories) {
      await this.pool.query(`INSERT INTO ${q('categories')} (name) VALUES ($1) ON CONFLICT DO NOTHING`, [c]);
    }
    for (const o of defaultState().orders) {
      await this.pool.query(
        `INSERT INTO ${q('orders')} (id, "customerName", phone, type, address, notes, items, total, status, timestamp, "estimatedMinutes")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`,
        [o.id, o.customerName, o.phone, o.type, o.address || '', o.notes || '', JSON.stringify(o.items || []), o.total, o.status, o.timestamp, o.estimatedMinutes]
      );
    }
  },

  async getState() {
    const [productsRes, categoriesRes, ordersRes, settingsRes] = await Promise.all([
      this.pool.query(`SELECT * FROM ${q('products')}`),
      this.pool.query(`SELECT * FROM ${q('categories')} ORDER BY name`),
      this.pool.query(`SELECT * FROM ${q('orders')}`),
      this.pool.query(`SELECT key, value FROM ${q('settings')}`)
    ]);
    const products = productsRes.rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      brand: r.brand,
      description: r.description,
      price: Number(r.price),
      category: r.category,
      stock: r.stock,
      sizeValue: r.sizeValue === '' || r.sizeValue === null ? '' : Number(r.sizeValue),
      sizeUnit: r.sizeUnit,
      image: r.image,
      createdAt: r.createdAt || null
    }));
    const categories = categoriesRes.rows.map((r) => r.name);
    const orders = ordersRes.rows.map((r) => ({ ...r, items: r.items || [], total: Number(r.total) }));
    const settings = {
      promos: []
    };
    for (const row of settingsRes.rows) {
      try {
        if (row.key === 'promos' && Array.isArray(row.value)) settings.promos = row.value;
        if (row.key === 'storeLocation' && row.value && typeof row.value === 'object') settings.storeLocation = row.value;
        if (row.key === 'paymentConfig' && row.value && typeof row.value === 'object') settings.paymentConfig = row.value;
      } catch {}
    }
    return { products, categories, orders, settings };
  },

  async saveProducts(products) {
    await this.pool.query(`DELETE FROM ${q('products')}`);
    for (const p of products) {
      await this.pool.query(
        `INSERT INTO ${q('products')} (id, code, name, brand, description, price, category, stock, "sizeValue", "sizeUnit", image, "createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [p.id, p.code, p.name, p.brand, p.description, p.price, p.category, p.stock, String(p.sizeValue ?? ''), p.sizeUnit || '', p.image || '', p.createdAt || null]
      );
    }
  },

  async saveCategories(categories) {
    await this.pool.query(`DELETE FROM ${q('categories')}`);
    for (const c of categories) {
      await this.pool.query(`INSERT INTO ${q('categories')} (name) VALUES ($1) ON CONFLICT DO NOTHING`, [c]);
    }
  },

  async saveOrders(orders) {
    await this.pool.query(`DELETE FROM ${q('orders')}`);
    for (const o of orders) {
      await this.pool.query(
        `INSERT INTO ${q('orders')} (id, "customerName", phone, type, address, notes, items, total, status, timestamp, "estimatedMinutes", "createdAt", credit, lat, lng, "courier_lat", "courier_lng", "courier_updated_at", "paymentMethod", "paymentStatus", "paymentProof", "paymentReference", messages)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
        [o.id, o.customerName, o.phone, o.type, o.address || '', o.notes || '', JSON.stringify(o.items || []), o.total, o.status, o.timestamp, o.estimatedMinutes, o.createdAt || new Date().toISOString(), Boolean(o.credit), o.lat != null ? Number(o.lat) : null, o.lng != null ? Number(o.lng) : null, o.courier_lat != null ? Number(o.courier_lat) : null, o.courier_lng != null ? Number(o.courier_lng) : null, o.courier_updated_at || null, o.paymentMethod || null, o.paymentStatus || null, o.paymentProof || null, o.paymentReference || null, JSON.stringify(o.messages || [])]
      );
    }
  },

  async saveSettings(settings) {
    await this.setSetting('promos', settings.promos || []);
    if (settings.storeLocation && typeof settings.storeLocation === 'object') {
      await this.setSetting('storeLocation', settings.storeLocation);
    }
    if (settings.paymentConfig && typeof settings.paymentConfig === 'object') {
      await this.setSetting('paymentConfig', settings.paymentConfig);
    }
  },

  async getAdminPassword() {
    const { rows } = await this.pool.query(
      `SELECT value FROM ${q('settings')} WHERE key = $1`,
      ['adminPassword']
    );
    if (!rows[0] || rows[0].value == null) return null;
    return typeof rows[0].value === 'string' ? rows[0].value : rows[0].value;
  },

  async setAdminPassword(entry) {
    await this.setSetting('adminPassword', entry);
  },

  async getAdminCredential(phone) {
    const key = normalizePhone(phone);
    if (!key || key.length < 7) return null;
    const { rows } = await this.pool.query(`SELECT salt, hash FROM ${q('admin_credentials')} WHERE phone = $1`, [key]);
    if (!rows[0]) return null;
    return { salt: rows[0].salt, hash: rows[0].hash };
  },

  async setAdminCredential(phone, entry) {
    const key = normalizePhone(phone);
    await this.pool.query(
      `INSERT INTO ${q('admin_credentials')} (phone, salt, hash, "createdAt")
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (phone) DO UPDATE SET salt = EXCLUDED.salt, hash = EXCLUDED.hash`,
      [key, entry.salt, entry.hash, new Date().toISOString()]
    );
  },

  async listCollections() {
    const { rows } = await this.pool.query(`SELECT value FROM ${q('settings')} WHERE key = $1`, ['collections']);
    if (!rows[0]) return [];
    try {
      const v = rows[0].value;
      const arr = typeof v === 'string' ? JSON.parse(v) : v;
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  },

  async saveCollections(collections) {
    await this.setSetting('collections', Array.isArray(collections) ? collections : []);
  },

  async getSetting(key) {
    const { rows } = await this.pool.query(`SELECT value FROM ${q('settings')} WHERE key = $1`, [key]);
    if (!rows[0] || rows[0].value == null) return null;
    const v = rows[0].value;
    if (typeof v === 'string') {
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    }
    return v;
  },

  async setSetting(key, value) {
    const json = JSON.stringify(value);
    const res = await this.pool.query(
      `UPDATE ${q('settings')} SET value = $2::jsonb WHERE key = $1`,
      [key, json]
    );
    if (res.rowCount === 0) {
      await this.pool.query(
        `INSERT INTO ${q('settings')} (key, value) VALUES ($1, $2::jsonb) ON CONFLICT DO NOTHING`,
        [key, json]
      );
    }
  },

  async getCustomerByPhone(phone) {
    const key = normalizePhone(phone);
    if (!key || key.length < 7) return null;
    const { rows } = await this.pool.query(`SELECT * FROM ${q('customers')} WHERE phone = $1`, [key]);
    if (!rows[0]) return null;
    return { ...rows[0], addresses: rows[0].addresses || [] };
  },

  async listCustomers() {
    const { rows } = await this.pool.query(`SELECT * FROM ${q('customers')} ORDER BY phone`);
    return rows.map((r) => ({ ...r, balance: Number(r.balance) || 0, isBenefited: Boolean(r.isBenefited) }));
  },

  async setCustomerBenefited(phone, benefited) {
    const key = normalizePhone(phone);
    if (!key) return null;
    const { rows } = await this.pool.query(
      `UPDATE ${q('customers')} SET "isBenefited" = $2 WHERE phone = $1 RETURNING *`,
      [key, Boolean(benefited)]
    );
    if (!rows[0]) return null;
    return { ...rows[0], balance: Number(rows[0].balance) || 0 };
  },

  async setCustomerBalance(phone, amount) {
    const key = normalizePhone(phone);
    if (!key) return null;
    const { rows } = await this.pool.query(
      `UPDATE ${q('customers')} SET balance = $2 WHERE phone = $1 RETURNING *`,
      [key, Number(amount) || 0]
    );
    if (!rows[0]) return null;
    return { ...rows[0], balance: Number(rows[0].balance) || 0 };
  },

  async addOrderToAccount(order) {
    if (!order || !order.phone) return null;
    const key = normalizePhone(order.phone);
    const { rows } = await this.pool.query(
      `UPDATE ${q('customers')} SET balance = COALESCE(balance, 0) + $2, "customerName" = COALESCE(NULLIF($3, ''), "customerName")
       WHERE phone = $1 RETURNING *`,
      [key, Number(order.total) || 0, order.customerName || '']
    );
    if (rows[0]) return { ...rows[0], balance: Number(rows[0].balance) || 0 };
    const created = await this.upsertCustomer({ phone: order.phone, customerName: order.customerName });
    if (!created) return null;
    return this.setCustomerBalance(key, Number(order.total) || 0);
  },

  // Registra una deuda manual por productos (ventas presenciales o deudas
  // anteriores a la app). Crea un pedido a crédito entregado y lo suma al
  // balance del cliente. No descuenta stock: no es una venta real por la app.
  async addDebtToCustomer({ phone, customerName, items }) {
    const key = normalizePhone(phone);
    if (!key) return null;
    const normalized = (items || []).map((it) => ({
      id: it.id,
      name: it.name,
      price: Number(it.price) || 0,
      quantity: Number(it.quantity) || 1
    }));
    const total = normalized.reduce((acc, it) => acc + it.price * it.quantity, 0);
    let id;
    do {
      id = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
      const dup = await this.pool.query(`SELECT 1 FROM ${q('orders')} WHERE id = $1`, [id]);
      if (dup.rowCount > 0) id = null;
    } while (!id);
    const order = {
      id,
      customerName: customerName || 'Cliente',
      phone: key,
      type: 'pickup',
      address: undefined,
      notes: 'Deuda registrada manualmente',
      items: normalized,
      total,
      status: 'entregado',
      timestamp: new Date().toISOString(),
      estimatedMinutes: 10,
      createdAt: new Date().toISOString(),
      credit: true
    };
    await this.pool.query(
      `INSERT INTO ${q('orders')} (id, "customerName", phone, type, address, notes, items, total, status, timestamp, "estimatedMinutes", "createdAt", credit)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [order.id, order.customerName, order.phone, order.type, order.address || '', order.notes || '', JSON.stringify(order.items || []), order.total, order.status, order.timestamp, order.estimatedMinutes, order.createdAt, order.credit]
    );
    await this.addOrderToAccount(order);
    return order;
  },

  async getWebAuthnByPhone(phone) {
    const key = normalizePhone(phone);
    if (!key || key.length < 7) return null;
    const { rows } = await this.pool.query(`SELECT * FROM ${q('webauthn_credentials')} WHERE phone = $1`, [key]);
    if (!rows[0]) return null;
    return {
      phone: rows[0].phone,
      credentialId: rows[0].credential_id,
      publicKey: rows[0].public_key,
      counter: rows[0].counter,
      rpID: rows[0].rpID || null,
      createdAt: rows[0].createdAt
    };
  },

  async saveWebAuthn(phone, credential) {
    const key = normalizePhone(phone);
    await this.pool.query(
      `INSERT INTO ${q('webauthn_credentials')} (phone, credential_id, public_key, counter, rpID, "createdAt")
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (phone) DO UPDATE SET
         credential_id = EXCLUDED.credential_id,
         public_key = EXCLUDED.public_key,
         counter = EXCLUDED.counter,
         rpID = EXCLUDED.rpID`,
      [key, credential.credentialId, credential.publicKey, credential.counter, credential.rpID || null, new Date().toISOString()]
    );
  },

  async deleteWebAuthn(phone) {
    const key = normalizePhone(phone);
    await this.pool.query(`DELETE FROM ${q('webauthn_credentials')} WHERE phone = $1`, [key]);
  },

  async upsertCustomer({ phone, customerName, address }) {
    const key = normalizePhone(phone);
    if (!key || key.length < 7) return null;
    const existing = await this.getCustomerByPhone(key);
    const addresses = existing?.addresses || [];
    if (address && !addresses.includes(address)) addresses.push(address);
    const now = new Date().toISOString();
    await this.pool.query(
      `INSERT INTO ${q('customers')} (phone, "customerName", addresses, "createdAt", "lastOrderAt")
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (phone) DO UPDATE SET
         "customerName" = EXCLUDED."customerName",
         addresses = EXCLUDED.addresses,
         "lastOrderAt" = EXCLUDED."lastOrderAt"`,
      [key, customerName || existing?.customerName || 'Cliente', JSON.stringify(addresses), existing?.createdAt || now, now]
    );
    return {
      phone: key,
      customerName: customerName || existing?.customerName || 'Cliente',
      addresses,
      createdAt: existing?.createdAt || now,
      lastOrderAt: now,
      balance: Number(existing?.balance) || 0,
      isBenefited: Boolean(existing?.isBenefited)
    };
  },

  async upsertCustomerFromOrder(order) {
    if (!order || !order.phone) return null;
    return this.upsertCustomer({
      phone: order.phone,
      customerName: order.customerName,
      address: order.type === 'delivery' ? order.address : undefined
    });
  },

  async createOrderAtomic(orderData) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`LOCK TABLE ${q('orders')} IN EXCLUSIVE MODE`);

      const stockRes = await client.query(
        `SELECT id, stock FROM ${q('products')} WHERE id = ANY($1::text[]) FOR UPDATE`,
        [orderData.items.map((it) => it.id)]
      );
      const stockMap = new Map(stockRes.rows.map((r) => [r.id, r.stock]));
      for (const it of orderData.items) {
        const available = stockMap.get(it.id);
        if (available === undefined || available < it.quantity) {
          await client.query('ROLLBACK');
          return { error: `Stock insuficiente para "${it.name}"` };
        }
      }

      let id;
      do {
        id = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
        const dup = await client.query(`SELECT 1 FROM ${q('orders')} WHERE id = $1`, [id]);
        if (dup.rowCount > 0) id = null;
      } while (!id);

      for (const it of orderData.items) {
        await client.query(`UPDATE ${q('products')} SET stock = stock - $1 WHERE id = $2`, [it.quantity, it.id]);
      }

      const order = {
        id,
        customerName: orderData.customerName || 'Cliente',
        phone: orderData.phone || '',
        type: orderData.type || 'pickup',
        address: orderData.type === 'delivery' ? orderData.address : undefined,
        notes: orderData.notes || '',
        items: orderData.items,
        total: Number(orderData.total) || 0,
        status: 'pendiente',
        timestamp: orderData.timestamp || '',
        estimatedMinutes: Number(orderData.estimatedMinutes) || 10,
        createdAt: orderData.createdAt || new Date().toISOString(),
        credit: Boolean(orderData.credit),
        lat: orderData.type === 'delivery' && orderData.lat != null ? Number(orderData.lat) : null,
        lng: orderData.type === 'delivery' && orderData.lng != null ? Number(orderData.lng) : null,
        paymentMethod: orderData.paymentMethod || 'efectivo',
        paymentStatus: orderData.paymentStatus || (orderData.paymentMethod === 'efectivo' ? 'confirmado' : 'pendiente'),
        paymentProof: orderData.paymentProof || null,
        paymentReference: orderData.paymentReference || null,
        messages: []
      };

      await client.query(
        `INSERT INTO ${q('orders')} (id, "customerName", phone, type, address, notes, items, total, status, timestamp, "estimatedMinutes", "createdAt", credit, lat, lng, "paymentMethod", "paymentStatus", "paymentProof", "paymentReference", messages)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [order.id, order.customerName, order.phone, order.type, order.address || '', order.notes || '', JSON.stringify(order.items || []), order.total, order.status, order.timestamp, order.estimatedMinutes, order.createdAt, order.credit, order.lat, order.lng, order.paymentMethod, order.paymentStatus, order.paymentProof, order.paymentReference, JSON.stringify(order.messages || [])]
      );

      // Registrar/actualizar el cliente reconocido en la misma transacción
      const key = normalizePhone(order.phone);
      if (key && key.length >= 7) {
        const existing = await client.query(`SELECT * FROM ${q('customers')} WHERE phone = $1`, [key]);
        const addresses = existing.rows[0]?.addresses || [];
        const address = order.type === 'delivery' && order.address ? order.address : undefined;
        if (address && !addresses.includes(address)) addresses.push(address);
        const now = new Date().toISOString();
        await client.query(
          `INSERT INTO ${q('customers')} (phone, "customerName", addresses, "createdAt", "lastOrderAt")
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (phone) DO UPDATE SET
             "customerName" = EXCLUDED."customerName",
             addresses = EXCLUDED.addresses,
             "lastOrderAt" = EXCLUDED."lastOrderAt"`,
          [key, order.customerName || existing.rows[0]?.customerName || 'Cliente', JSON.stringify(addresses), existing.rows[0]?.createdAt || now, now]
        );
      }

      await client.query('COMMIT');
      return { state: await this.getState(), order };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },

  async updateCourierLocation(id, lat, lng) {
    const { rows } = await this.pool.query(
      `UPDATE ${q('orders')} SET "courier_lat" = $2, "courier_lng" = $3, "courier_updated_at" = $4
       WHERE id = $1 RETURNING *`,
      [id, Number(lat), Number(lng), new Date().toISOString()]
    );
    return rows[0] || null;
  },

  async withTx(fn) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },

  // Actualiza el estado de un pedido de forma atómica (UPDATE por id, sin
  // reescribir toda la tabla). Evita que requests concurrentes borren pedidos.
  async atomicUpdateOrderStatus(id, status) {
    const result = await this.withTx(async (client) => {
      await client.query(`LOCK TABLE ${q('orders')} IN EXCLUSIVE MODE`);
      const { rows } = await client.query(`SELECT * FROM ${q('orders')} WHERE id = $1 FOR UPDATE`, [id]);
      const existing = rows[0];
      if (!existing) return { error: 'Pedido no encontrado' };
      await client.query(`UPDATE ${q('orders')} SET status = $2 WHERE id = $1`, [id, status]);
      if (existing.credit && status === 'entregado') {
        await client.query(
          `UPDATE ${q('customers')} SET balance = COALESCE(balance, 0) + $2, "customerName" = COALESCE(NULLIF($3, ''), "customerName")
           WHERE phone = $1`,
          [existing.phone, Number(existing.total) || 0, existing.customerName || '']
        );
      }
      return { ok: true };
    });
    if (result.error) return result;
    return { state: await this.getState() };
  },

  // Actualiza los campos de pago de un pedido (confirmar/rechazar, comprobante).
  async atomicUpdateOrderPayment(id, data) {
    const result = await this.withTx(async (client) => {
      await client.query(`LOCK TABLE ${q('orders')} IN EXCLUSIVE MODE`);
      const { rows } = await client.query(`SELECT id FROM ${q('orders')} WHERE id = $1 FOR UPDATE`, [id]);
      if (!rows[0]) return { error: 'Pedido no encontrado' };
      const fields = ['paymentStatus', 'paymentProof', 'paymentReference'];
      const clauses = [];
      const params = [id];
      fields.forEach((f) => {
        if (data[f] !== undefined) {
          clauses.push(`"${f}" = $${params.length}`);
          params.push(data[f]);
        }
      });
      if (clauses.length === 0) return { error: 'Sin cambios de pago' };
      await client.query(`UPDATE ${q('orders')} SET ${clauses.join(', ')} WHERE id = $1`, params);
      return { ok: true };
    });
    if (result.error) return result;
    return { state: await this.getState() };
  },

  // Agrega un mensaje de chat al pedido (JSONB, sin tabla extra).
  async atomicAddOrderMessage(id, message) {
    const result = await this.withTx(async (client) => {
      await client.query(`LOCK TABLE ${q('orders')} IN EXCLUSIVE MODE`);
      const { rows } = await client.query(`SELECT messages FROM ${q('orders')} WHERE id = $1 FOR UPDATE`, [id]);
      if (!rows[0]) return { error: 'Pedido no encontrado' };
      const msgs = Array.isArray(rows[0].messages) ? rows[0].messages : [];
      msgs.push(message);
      await client.query(`UPDATE ${q('orders')} SET messages = $2 WHERE id = $1`, [id, JSON.stringify(msgs)]);
      return { ok: true };
    });
    if (result.error) return result;
    return { state: await this.getState() };
  },

  // Cancela un pedido devolviendo stock, todo en una transacción con lock.
  async atomicCancelOrder(id, phone) {
    const result = await this.withTx(async (client) => {
      await client.query(`LOCK TABLE ${q('orders')} IN EXCLUSIVE MODE`);
      const { rows } = await client.query(`SELECT * FROM ${q('orders')} WHERE id = $1 FOR UPDATE`, [id]);
      const existing = rows[0];
      if (!existing) return { error: 'Pedido no encontrado' };
      if (normalizePhone(existing.phone) !== normalizePhone(phone)) {
        return { error: 'No autorizado para cancelar este pedido' };
      }
      if (existing.status === 'cancelado') return { error: 'El pedido ya fue cancelado' };
      if (existing.status === 'listo' || existing.status === 'entregado') {
        return { error: 'Este pedido ya no puede cancelarse' };
      }
      await client.query(`UPDATE ${q('orders')} SET status = 'cancelado' WHERE id = $1`, [id]);
      for (const it of existing.items || []) {
        await client.query(
          `UPDATE ${q('products')} SET stock = stock + $1 WHERE id = $2`,
          [Number(it.quantity) || 0, it.id]
        );
      }
      return { ok: true };
    });
    if (result.error) return result;
    return { state: await this.getState() };
  },

  // Elimina un pedido solo si está cancelado (DELETE por id).
  async atomicDeleteOrder(id) {
    const result = await this.withTx(async (client) => {
      await client.query(`LOCK TABLE ${q('orders')} IN EXCLUSIVE MODE`);
      const { rows } = await client.query(`SELECT status FROM ${q('orders')} WHERE id = $1 FOR UPDATE`, [id]);
      if (!rows[0]) return { error: 'Pedido no encontrado' };
      if (rows[0].status !== 'cancelado') return { error: 'Solo se pueden eliminar pedidos cancelados' };
      await client.query(`DELETE FROM ${q('orders')} WHERE id = $1`, [id]);
      return { ok: true };
    });
    if (result.error) return result;
    return { state: await this.getState() };
  },

  // Crea un producto con INSERT puntual (no borra ni reescribe la tabla).
  async atomicCreateProduct(data) {
    const product = {
      ...data,
      id: generateProductId(),
      code: data.code || `PROD-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: data.createdAt || new Date().toISOString()
    };
    await this.pool.query(
      `INSERT INTO ${q('products')} (id, code, name, brand, description, price, category, stock, "sizeValue", "sizeUnit", image, "createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [product.id, product.code, product.name, product.brand, product.description, product.price, product.category, product.stock, String(product.sizeValue ?? ''), product.sizeUnit || '', product.image || '', product.createdAt]
    );
    if (product.category) {
      await this.pool.query(`INSERT INTO ${q('categories')} (name) VALUES ($1) ON CONFLICT DO NOTHING`, [product.category]);
    }
    return { state: await this.getState() };
  },

  // Actualiza un producto con UPDATE puntual (sin tocar otras filas).
  async atomicUpdateProduct(id, data) {
    const { rows } = await this.pool.query(`SELECT * FROM ${q('products')} WHERE id = $1 FOR UPDATE`, [id]);
    if (!rows[0]) return { error: 'Producto no encontrado' };
    const p = { ...rows[0], ...data, id };
    await this.pool.query(
      `UPDATE ${q('products')} SET code=$2, name=$3, brand=$4, description=$5, price=$6, category=$7, stock=$8, "sizeValue"=$9, "sizeUnit"=$10, image=$11, "createdAt"=$12 WHERE id=$1`,
      [id, p.code, p.name, p.brand, p.description, p.price, p.category, p.stock, String(p.sizeValue ?? ''), p.sizeUnit || '', p.image || '', p.createdAt || rows[0].createdAt || null]
    );
    if (p.category) {
      await this.pool.query(`INSERT INTO ${q('categories')} (name) VALUES ($1) ON CONFLICT DO NOTHING`, [p.category]);
    }
    return { state: await this.getState() };
  },

  // Elimina un producto con DELETE puntual.
  async atomicDeleteProduct(id) {
    await this.pool.query(`DELETE FROM ${q('products')} WHERE id = $1`, [id]);
    return { state: await this.getState() };
  },

  // Agrega una categoría con INSERT idempotente.
  async atomicAddCategory(name) {
    await this.pool.query(`INSERT INTO ${q('categories')} (name) VALUES ($1) ON CONFLICT DO NOTHING`, [name]);
    return { state: await this.getState() };
  }
};

// ---------------------------------------------------------------------------
// Selección del backend
// ---------------------------------------------------------------------------
const store = pgPool ? pgStore : fileStore;
if (fileStore) fileStore.load();

export async function initStore() {
  if (pgPool) {
    await pgStore.ensureSchema();
    await pgStore.seedIfEmpty();
  }
}

export const isMirrorEnabled = () => Boolean(pgPool);

export const getState = () => store.getState();

export const saveSettings = (settings) => store.saveSettings(settings);

export const getSetting = (key) => store.getSetting(key);

export const setSetting = (key, value) => store.setSetting(key, value);

export const getCustomerByPhone = (phone) => store.getCustomerByPhone(phone);

export const upsertCustomer = (customer) => store.upsertCustomer(customer);

export const listCustomers = () => store.listCustomers();

export const setCustomerBenefited = (phone, benefited) => store.setCustomerBenefited(phone, benefited);

export const setCustomerBalance = (phone, amount) => store.setCustomerBalance(phone, amount);

export const addOrderToAccount = (order) => store.addOrderToAccount(order);

export const addDebtToCustomer = (data) => store.addDebtToCustomer(data);

export const updateCourierLocation = (id, lat, lng) => store.updateCourierLocation(id, lat, lng);

// Devuelve los datos públicos de rastreo de un pedido (destino + posición del
// repartidor), sin exponer datos sensibles de otros pedidos.
export const getOrderTracking = async (id) => {
  const state = await store.getState();
  const order = state.orders.find((o) => o.id === id);
  if (!order) return null;
  return {
    id: order.id,
    status: order.status,
    type: order.type,
    address: order.address || '',
    lat: order.lat != null ? Number(order.lat) : null,
    lng: order.lng != null ? Number(order.lng) : null,
    courier_lat: order.courier_lat != null ? Number(order.courier_lat) : null,
    courier_lng: order.courier_lng != null ? Number(order.courier_lng) : null,
    courier_updated_at: order.courier_updated_at || null,
    estimatedMinutes: Number(order.estimatedMinutes) || 10,
    timestamp: order.timestamp || '',
    storeLocation: (state.settings && state.settings.storeLocation) || null
  };
};

export const getWebAuthnByPhone = (phone) => store.getWebAuthnByPhone(phone);

export const saveWebAuthn = (phone, credential) => store.saveWebAuthn(phone, credential);

export const deleteWebAuthn = (phone) => store.deleteWebAuthn(phone);

export const getAdminCredential = (phone) => store.getAdminCredential(phone);

export const setAdminCredential = (phone, entry) => store.setAdminCredential(phone, entry);

export const getAdminPassword = () => store.getAdminPassword();

export const listCollections = () => store.listCollections();

export const saveCollections = (collections) => store.saveCollections(collections);

// Programa (o actualiza) un cobro. Devuelve la lista actualizada.
export const upsertCollection = async (collection) => {
  const list = await store.listCollections();
  const item = {
    id: collection.id || `COB-${Math.floor(1000 + Math.random() * 9000)}`,
    phone: collection.phone || '',
    customerName: collection.customerName || '',
    dueAt: collection.dueAt || null,
    note: collection.note || '',
    status: collection.status || 'programado', // programado | enviado | cancelado
    createdAt: collection.createdAt || new Date().toISOString()
  };
  const idx = list.findIndex((c) => c.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.push(item);
  await store.saveCollections(list);
  return { list, item };
};

export const removeCollection = async (id) => {
  const list = (await store.listCollections()).filter((c) => c.id !== id);
  await store.saveCollections(list);
  return { list };
};

export const createOrder = async (orderData) => {
  if (!orderData || !Array.isArray(orderData.items) || orderData.items.length === 0) {
    return { error: 'El pedido no tiene productos' };
  }

  if (pgPool) {
    return pgStore.createOrderAtomic(orderData);
  }

  const state = await store.getState();

  for (const it of orderData.items) {
    const p = state.products.find((x) => x.id === it.id);
    if (!p || p.stock < it.quantity) {
      return { error: `Stock insuficiente para "${it.name}"` };
    }
  }

  let id;
  do {
    id = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
  } while (state.orders.some((o) => o.id === id));

  const products = state.products.map((p) => {
    const inOrder = orderData.items.find((it) => it.id === p.id);
    return inOrder ? { ...p, stock: p.stock - inOrder.quantity } : p;
  });

  const order = {
    id,
    customerName: orderData.customerName || 'Cliente',
    phone: orderData.phone || '',
    type: orderData.type || 'pickup',
    address: orderData.type === 'delivery' ? orderData.address : undefined,
    notes: orderData.notes || '',
    items: orderData.items,
    total: Number(orderData.total) || 0,
    status: 'pendiente',
    timestamp: orderData.timestamp || '',
    estimatedMinutes: Number(orderData.estimatedMinutes) || 10,
    createdAt: orderData.createdAt || new Date().toISOString(),
    credit: Boolean(orderData.credit),
    lat: orderData.type === 'delivery' && orderData.lat != null ? Number(orderData.lat) : null,
    lng: orderData.type === 'delivery' && orderData.lng != null ? Number(orderData.lng) : null,
    paymentMethod: orderData.paymentMethod || 'efectivo',
    paymentStatus: orderData.paymentStatus || (orderData.paymentMethod === 'efectivo' ? 'confirmado' : 'pendiente'),
    paymentProof: orderData.paymentProof || null,
    paymentReference: orderData.paymentReference || null,
    messages: []
  };

  const orders = [order, ...state.orders];

  await store.saveProducts(products);
  await store.saveOrders(orders);

  const key = normalizePhone(order.phone);
  if (key && key.length >= 7) {
    await store.upsertCustomer({
      phone: order.phone,
      customerName: order.customerName,
      address: order.type === 'delivery' ? order.address : undefined
    });
  }

  const newState = await store.getState();
  return { state: newState, order };
};

export const createProduct = async (data) => {
  if (pgPool) return pgStore.atomicCreateProduct(data);
  const state = await store.getState();
  const product = {
    ...data,
    id: generateProductId(),
    code: data.code || `PROD-${Math.floor(100 + Math.random() * 900)}`,
    createdAt: data.createdAt || new Date().toISOString()
  };
  const products = [product, ...state.products];
  const categories = maybeAddCategory(state.categories, product.category);

  await store.saveProducts(products);
  await store.saveCategories(categories);

  const newState = await store.getState();
  return { state: newState };
};

export const updateProduct = async (id, data) => {
  if (pgPool) return pgStore.atomicUpdateProduct(id, data);
  const state = await store.getState();
  const existing = state.products.find((p) => p.id === id);
  if (!existing) return { error: 'Producto no encontrado' };

  const products = state.products.map((p) => (p.id === id ? { ...p, ...data, id } : p));
  const categories = maybeAddCategory(state.categories, data.category);

  await store.saveProducts(products);
  await store.saveCategories(categories);

  const newState = await store.getState();
  return { state: newState };
};

export const deleteProduct = async (id) => {
  if (pgPool) return pgStore.atomicDeleteProduct(id);
  const state = await store.getState();
  await store.saveProducts(state.products.filter((p) => p.id !== id));
  const newState = await store.getState();
  return { state: newState };
};

export const addCategory = async (name) => {
  if (pgPool) return pgStore.atomicAddCategory(name);
  const state = await store.getState();
  await store.saveCategories(maybeAddCategory(state.categories, name));
  const newState = await store.getState();
  return { state: newState };
};

export const updateOrderStatus = async (id, status) => {
  if (pgPool) return pgStore.atomicUpdateOrderStatus(id, status);
  const state = await store.getState();
  const existing = state.orders.find((o) => o.id === id);
  if (!existing) return { error: 'Pedido no encontrado' };

  const orders = state.orders.map((o) => (o.id === id ? { ...o, status } : o));
  await store.saveOrders(orders);

  // Los pedidos a crédito se suman a la cuenta del cliente cuando se entregan.
  if (existing.credit && status === 'entregado') {
    await store.addOrderToAccount(existing);
  }

  const newState = await store.getState();
  return { state: newState };
};

export const getOrderById = async (id) => {
  const state = await store.getState();
  return state.orders.find((o) => o.id === id) || null;
};

export const updateOrderPayment = async (id, data) => {
  if (pgPool) return pgStore.atomicUpdateOrderPayment(id, data);
  const state = await store.getState();
  const existing = state.orders.find((o) => o.id === id);
  if (!existing) return { error: 'Pedido no encontrado' };
  const orders = state.orders.map((o) => (o.id === id ? { ...o, ...data } : o));
  await store.saveOrders(orders);
  const newState = await store.getState();
  return { state: newState };
};

export const getOrderMessages = async (id) => {
  const state = await store.getState();
  const order = state.orders.find((o) => o.id === id);
  if (!order) return null;
  return Array.isArray(order.messages) ? order.messages : [];
};

export const addOrderMessage = async (id, message) => {
  if (pgPool) return pgStore.atomicAddOrderMessage(id, message);
  const state = await store.getState();
  const existing = state.orders.find((o) => o.id === id);
  if (!existing) return { error: 'Pedido no encontrado' };
  const orders = state.orders.map((o) => (o.id === id ? { ...o, messages: [...(o.messages || []), message] } : o));
  await store.saveOrders(orders);
  const newState = await store.getState();
  return { state: newState };
};

// Cancela un pedido devolviendo el stock de sus artículos. Solo permite cancelar
// pedidos pendientes o en preparación que pertenezcan al teléfono que los cancela.
export const cancelOrder = async (id, phone) => {
  if (pgPool) return pgStore.atomicCancelOrder(id, phone);
  const state = await store.getState();
  const existing = state.orders.find((o) => o.id === id);
  if (!existing) return { error: 'Pedido no encontrado' };
  if (normalizePhone(existing.phone) !== normalizePhone(phone)) {
    return { error: 'No autorizado para cancelar este pedido' };
  }
  if (existing.status === 'cancelado') return { error: 'El pedido ya fue cancelado' };
  if (existing.status === 'listo' || existing.status === 'entregado') {
    return { error: 'Este pedido ya no puede cancelarse' };
  }

  const products = state.products.map((p) => {
    const it = existing.items.find((x) => x.id === p.id);
    return it ? { ...p, stock: p.stock + it.quantity } : p;
  });
  const orders = state.orders.map((o) => (o.id === id ? { ...o, status: 'cancelado' } : o));

  await store.saveProducts(products);
  await store.saveOrders(orders);

  const newState = await store.getState();
  return { state: newState };
};

// Elimina un pedido (solo si está cancelado). Para limpiar la lista del admin.
export const deleteOrder = async (id) => {
  if (pgPool) return pgStore.atomicDeleteOrder(id);
  const state = await store.getState();
  const existing = state.orders.find((o) => o.id === id);
  if (!existing) return { error: 'Pedido no encontrado' };
  if (existing.status !== 'cancelado') {
    return { error: 'Solo se pueden eliminar pedidos cancelados' };
  }
  const orders = state.orders.filter((o) => o.id !== id);
  await store.saveOrders(orders);
  const newState = await store.getState();
  return { state: newState };
};

function maybeAddCategory(categories, cat) {
  if (cat && !categories.includes(cat)) {
    return [...categories, cat];
  }
  return categories;
}
