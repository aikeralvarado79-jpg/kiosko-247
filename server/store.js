import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS, INITIAL_ORDERS } from '../src/data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data.json');

const defaultState = () => ({
  products: JSON.parse(JSON.stringify(INITIAL_PRODUCTS)),
  categories: [...INITIAL_CATEGORIES],
  orders: JSON.parse(JSON.stringify(INITIAL_ORDERS))
});

let state = defaultState();

function load() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    state = { ...defaultState(), ...parsed };
  } catch {
    state = defaultState();
  }
  return state;
}

function persist() {
  try {
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tmp, DATA_FILE);
  } catch (err) {
    console.warn('[kiosko] No se pudo persistir data.json (disco efímero). Cambios solo en memoria.', err.message);
  }
}

load();

const generateProductId = () => `p-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

function maybeAddCategory(cat) {
  if (cat && !state.categories.includes(cat)) {
    state.categories.push(cat);
  }
}

export const getState = () => state;

export const createOrder = (orderData) => {
  if (!orderData || !Array.isArray(orderData.items) || orderData.items.length === 0) {
    return { error: 'El pedido no tiene productos' };
  }

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

  state.products = state.products.map((p) => {
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

  state.orders = [order, ...state.orders];
  persist();
  return { state, order };
};

export const createProduct = (data) => {
  const product = {
    ...data,
    id: generateProductId(),
    code: data.code || `PROD-${Math.floor(100 + Math.random() * 900)}`
  };
  state.products = [product, ...state.products];
  maybeAddCategory(product.category);
  persist();
  return { state };
};

export const updateProduct = (id, data) => {
  const existing = state.products.find((p) => p.id === id);
  if (!existing) return { error: 'Producto no encontrado' };
  state.products = state.products.map((p) => (p.id === id ? { ...p, ...data, id } : p));
  maybeAddCategory(data.category);
  persist();
  return { state };
};

export const deleteProduct = (id) => {
  state.products = state.products.filter((p) => p.id !== id);
  persist();
  return { state };
};

export const addCategory = (name) => {
  maybeAddCategory(name);
  persist();
  return { state };
};

export const updateOrderStatus = (id, status) => {
  const existing = state.orders.find((o) => o.id === id);
  if (!existing) return { error: 'Pedido no encontrado' };
  state.orders = state.orders.map((o) => (o.id === id ? { ...o, status } : o));
  persist();
  return { state };
};
