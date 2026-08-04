import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS, INITIAL_ORDERS } from '../src/data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data.json');

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
    return this.state;
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

  async saveSettings(settings) {
    this.state.settings = settings;
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
      createdAt: existing?.createdAt || now,
      lastOrderAt: now
    };
    this.state.customers = [
      record,
      ...this.state.customers.filter((c) => c.phone !== key)
    ];
    this.persist();
    return record;
  }
};

// ---------------------------------------------------------------------------
// Backend Postgres (Supabase / producción). Se usa cuando existe DATABASE_URL.
// ---------------------------------------------------------------------------
const { Pool } = pg;
const pgPool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  : null;

const pgStore = {
  pool: pgPool,

  async ensureSchema() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS products (
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
        image TEXT
      );
      CREATE TABLE IF NOT EXISTS categories (
        name TEXT PRIMARY KEY
      );
      CREATE TABLE IF NOT EXISTS orders (
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
        "estimatedMinutes" INTEGER
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value JSONB
      );
      CREATE TABLE IF NOT EXISTS customers (
        phone TEXT PRIMARY KEY,
        "customerName" TEXT,
        addresses JSONB DEFAULT '[]',
        "createdAt" TEXT,
        "lastOrderAt" TEXT
      );
      CREATE TABLE IF NOT EXISTS webauthn_credentials (
        phone TEXT PRIMARY KEY,
        credential_id TEXT,
        public_key BYTEA,
        counter INTEGER,
        "createdAt" TEXT
      );
    `);
  },

  async seedIfEmpty() {
    const { rows } = await this.pool.query('SELECT COUNT(*)::int AS n FROM products');
    if (rows[0].n > 0) return;
    for (const p of defaultState().products) {
      await this.pool.query(
        `INSERT INTO products (id, code, name, brand, description, price, category, stock, "sizeValue", "sizeUnit", image)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`,
        [p.id, p.code, p.name, p.brand, p.description, p.price, p.category, p.stock, String(p.sizeValue ?? ''), p.sizeUnit || '', p.image || '']
      );
    }
    for (const c of defaultState().categories) {
      await this.pool.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT DO NOTHING', [c]);
    }
    for (const o of defaultState().orders) {
      await this.pool.query(
        `INSERT INTO orders (id, "customerName", phone, type, address, notes, items, total, status, timestamp, "estimatedMinutes")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`,
        [o.id, o.customerName, o.phone, o.type, o.address || '', o.notes || '', JSON.stringify(o.items || []), o.total, o.status, o.timestamp, o.estimatedMinutes]
      );
    }
  },

  async getState() {
    const [productsRes, categoriesRes, ordersRes, settingsRes] = await Promise.all([
      this.pool.query('SELECT * FROM products'),
      this.pool.query('SELECT * FROM categories ORDER BY name'),
      this.pool.query('SELECT * FROM orders'),
      this.pool.query('SELECT key, value FROM settings')
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
      image: r.image
    }));
    const categories = categoriesRes.rows.map((r) => r.name);
    const orders = ordersRes.rows.map((r) => ({ ...r, items: r.items || [], total: Number(r.total) }));
    const settings = {
      promos: []
    };
    for (const row of settingsRes.rows) {
      try {
        if (row.key === 'promos' && Array.isArray(row.value)) settings.promos = row.value;
      } catch {}
    }
    return { products, categories, orders, settings };
  },

  async saveProducts(products) {
    await this.pool.query('DELETE FROM products');
    for (const p of products) {
      await this.pool.query(
        `INSERT INTO products (id, code, name, brand, description, price, category, stock, "sizeValue", "sizeUnit", image)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [p.id, p.code, p.name, p.brand, p.description, p.price, p.category, p.stock, String(p.sizeValue ?? ''), p.sizeUnit || '', p.image || '']
      );
    }
  },

  async saveCategories(categories) {
    await this.pool.query('DELETE FROM categories');
    for (const c of categories) {
      await this.pool.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT DO NOTHING', [c]);
    }
  },

  async saveOrders(orders) {
    await this.pool.query('DELETE FROM orders');
    for (const o of orders) {
      await this.pool.query(
        `INSERT INTO orders (id, "customerName", phone, type, address, notes, items, total, status, timestamp, "estimatedMinutes")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [o.id, o.customerName, o.phone, o.type, o.address || '', o.notes || '', JSON.stringify(o.items || []), o.total, o.status, o.timestamp, o.estimatedMinutes]
      );
    }
  },

  async saveSettings(settings) {
    await this.pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      ['promos', JSON.stringify(settings.promos || [])]
    );
  },

  async getCustomerByPhone(phone) {
    const key = normalizePhone(phone);
    if (!key || key.length < 7) return null;
    const { rows } = await this.pool.query('SELECT * FROM customers WHERE phone = $1', [key]);
    if (!rows[0]) return null;
    return { ...rows[0], addresses: rows[0].addresses || [] };
  },

  async getWebAuthnByPhone(phone) {
    const key = normalizePhone(phone);
    if (!key || key.length < 7) return null;
    const { rows } = await this.pool.query('SELECT * FROM webauthn_credentials WHERE phone = $1', [key]);
    if (!rows[0]) return null;
    return {
      phone: rows[0].phone,
      credentialId: rows[0].credential_id,
      publicKey: rows[0].public_key,
      counter: rows[0].counter,
      createdAt: rows[0].createdAt
    };
  },

  async saveWebAuthn(phone, credential) {
    const key = normalizePhone(phone);
    await this.pool.query(
      `INSERT INTO webauthn_credentials (phone, credential_id, public_key, counter, "createdAt")
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (phone) DO UPDATE SET
         credential_id = EXCLUDED.credential_id,
         public_key = EXCLUDED.public_key,
         counter = EXCLUDED.counter`,
      [key, credential.credentialId, credential.publicKey, credential.counter, new Date().toISOString()]
    );
  },

  async upsertCustomer({ phone, customerName, address }) {
    const key = normalizePhone(phone);
    if (!key || key.length < 7) return null;
    const existing = await this.getCustomerByPhone(key);
    const addresses = existing?.addresses || [];
    if (address && !addresses.includes(address)) addresses.push(address);
    const now = new Date().toISOString();
    await this.pool.query(
      `INSERT INTO customers (phone, "customerName", addresses, "createdAt", "lastOrderAt")
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (phone) DO UPDATE SET
         "customerName" = EXCLUDED."customerName",
         addresses = EXCLUDED.addresses,
         "lastOrderAt" = EXCLUDED."lastOrderAt"`,
      [key, customerName || existing?.customerName || 'Cliente', JSON.stringify(addresses), existing?.createdAt || now, now]
    );
    return { phone: key, customerName: customerName || existing?.customerName || 'Cliente', addresses, createdAt: existing?.createdAt || now, lastOrderAt: now };
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
      await client.query('LOCK TABLE orders IN EXCLUSIVE MODE');

      const stockRes = await client.query(
        'SELECT id, stock FROM products WHERE id = ANY($1::text[]) FOR UPDATE',
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
        const dup = await client.query('SELECT 1 FROM orders WHERE id = $1', [id]);
        if (dup.rowCount > 0) id = null;
      } while (!id);

      for (const it of orderData.items) {
        await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [it.quantity, it.id]);
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
        estimatedMinutes: Number(orderData.estimatedMinutes) || 10
      };

      await client.query(
        `INSERT INTO orders (id, "customerName", phone, type, address, notes, items, total, status, timestamp, "estimatedMinutes")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [order.id, order.customerName, order.phone, order.type, order.address || '', order.notes || '', JSON.stringify(order.items || []), order.total, order.status, order.timestamp, order.estimatedMinutes]
      );

      // Registrar/actualizar el cliente reconocido en la misma transacción
      const key = normalizePhone(order.phone);
      if (key && key.length >= 7) {
        const existing = await client.query('SELECT * FROM customers WHERE phone = $1', [key]);
        const addresses = existing.rows[0]?.addresses || [];
        const address = order.type === 'delivery' && order.address ? order.address : undefined;
        if (address && !addresses.includes(address)) addresses.push(address);
        const now = new Date().toISOString();
        await client.query(
          `INSERT INTO customers (phone, "customerName", addresses, "createdAt", "lastOrderAt")
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

export const getState = () => store.getState();

export const saveSettings = (settings) => store.saveSettings(settings);

export const getCustomerByPhone = (phone) => store.getCustomerByPhone(phone);

export const upsertCustomer = (customer) => store.upsertCustomer(customer);

export const getWebAuthnByPhone = (phone) => store.getWebAuthnByPhone(phone);

export const saveWebAuthn = (phone, credential) => store.saveWebAuthn(phone, credential);

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
    estimatedMinutes: Number(orderData.estimatedMinutes) || 10
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
  const state = await store.getState();
  const product = {
    ...data,
    id: generateProductId(),
    code: data.code || `PROD-${Math.floor(100 + Math.random() * 900)}`
  };
  const products = [product, ...state.products];
  const categories = maybeAddCategory(state.categories, product.category);

  await store.saveProducts(products);
  await store.saveCategories(categories);

  const newState = await store.getState();
  return { state: newState };
};

export const updateProduct = async (id, data) => {
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
  const state = await store.getState();
  await store.saveProducts(state.products.filter((p) => p.id !== id));
  const newState = await store.getState();
  return { state: newState };
};

export const addCategory = async (name) => {
  const state = await store.getState();
  await store.saveCategories(maybeAddCategory(state.categories, name));
  const newState = await store.getState();
  return { state: newState };
};

export const updateOrderStatus = async (id, status) => {
  const state = await store.getState();
  const existing = state.orders.find((o) => o.id === id);
  if (!existing) return { error: 'Pedido no encontrado' };

  const orders = state.orders.map((o) => (o.id === id ? { ...o, status } : o));
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
