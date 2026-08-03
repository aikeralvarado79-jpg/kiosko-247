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
  orders: JSON.parse(JSON.stringify(INITIAL_ORDERS))
});

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
    const [productsRes, categoriesRes, ordersRes] = await Promise.all([
      this.pool.query('SELECT * FROM products'),
      this.pool.query('SELECT * FROM categories ORDER BY name'),
      this.pool.query('SELECT * FROM orders')
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
    return { products, categories, orders };
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
