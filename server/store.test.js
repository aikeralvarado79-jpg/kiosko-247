import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tempFiles = [];

const freshStore = async () => {
  vi.resetModules();
  delete process.env.DATABASE_URL;
  const tmp = path.join(os.tmpdir(), `kiosko-store-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  tempFiles.push(tmp);
  process.env.KIOSKO_DATA_FILE = tmp;
  return import('./store.js');
};

afterAll(() => {
  for (const f of tempFiles) {
    try {
      fs.rmSync(f, { force: true });
    } catch {}
  }
  delete process.env.KIOSKO_DATA_FILE;
});

describe('fileStore', () => {
  beforeEach(() => {
    process.env.KIOSKO_DATA_FILE = undefined;
  });

  it('inicializa con el estado por defecto (productos y categorías)', async () => {
    const store = await freshStore();
    const state = await store.getState();
    expect(state.products.length).toBeGreaterThan(0);
    expect(state.categories.length).toBeGreaterThan(0);
    expect(state.products[0]).toHaveProperty('stock');
  });

  it('no expone el adminPassword en getState', async () => {
    const store = await freshStore();
    await store.saveSettings({ adminPassword: { salt: 'abc', hash: 'def' }, promos: [] });
    const state = await store.getState();
    expect(state.settings.adminPassword).toBeUndefined();
  });

  it('guarda y lee credenciales de admin por teléfono sin exponerlas', async () => {
    const store = await freshStore();
    await store.setAdminCredential('04129862577', { salt: 'sal', hash: 'hash' });
    const cred = await store.getAdminCredential('04129862577');
    expect(cred.salt).toBe('sal');
    expect(cred.hash).toBe('hash');
    expect(await store.getAdminCredential('04121112222')).toBeNull();
    const state = await store.getState();
    expect(state.settings.adminCredentials).toBeUndefined();
  });

  it('crea un pedido y descuenta stock atómicamente', async () => {
    const store = await freshStore();
    const state = await store.getState();
    const product = state.products.find((p) => p.id === 'p1');
    const stockAntes = product.stock;

    const result = await store.createOrder({
      customerName: 'Test',
      phone: '+54 9 11 1234-5678',
      items: [{ id: 'p1', name: product.name, price: product.price, quantity: 2 }],
      total: product.price * 2
    });

    expect(result.order).toBeDefined();
    expect(result.order.id).toMatch(/^ORD-/);
    expect(result.order.status).toBe('pendiente');
    const nuevo = result.state.products.find((p) => p.id === 'p1');
    expect(nuevo.stock).toBe(stockAntes - 2);
  });

  it('rechaza crear pedido sin stock suficiente', async () => {
    const store = await freshStore();
    const state = await store.getState();
    const product = state.products.find((p) => p.id === 'p1');

    const result = await store.createOrder({
      items: [{ id: 'p1', name: product.name, price: product.price, quantity: product.stock + 10 }]
    });
    expect(result.error).toContain('Stock insuficiente');
    const despues = await store.getState();
    expect(despues.products.find((p) => p.id === 'p1').stock).toBe(product.stock);
  });

  it('rechaza pedido sin items', async () => {
    const store = await freshStore();
    const result = await store.createOrder({ items: [] });
    expect(result.error).toContain('no tiene productos');
  });

  it('cancela un pedido del mismo teléfono y devuelve el stock', async () => {
    const store = await freshStore();
    const state = await store.getState();
    const product = state.products.find((p) => p.id === 'p1');
    const created = await store.createOrder({
      customerName: 'Cliente X',
      phone: '41112345678',
      items: [{ id: 'p1', name: product.name, price: product.price, quantity: 3 }],
      total: product.price * 3
    });

    const cancelado = await store.cancelOrder(created.order.id, '41112345678');
    expect(cancelado.state.orders.find((o) => o.id === created.order.id).status).toBe('cancelado');
    expect(cancelado.state.products.find((p) => p.id === 'p1').stock).toBe(product.stock);
  });

  it('no permite cancelar un pedido de otro teléfono', async () => {
    const store = await freshStore();
    const state = await store.getState();
    const product = state.products.find((p) => p.id === 'p1');
    const created = await store.createOrder({
      customerName: 'Dueño',
      phone: '41111111111',
      items: [{ id: 'p1', name: product.name, price: product.price, quantity: 1 }]
    });
    const result = await store.cancelOrder(created.order.id, '41199999999');
    expect(result.error).toContain('No autorizado');
    const despues = await store.getState();
    expect(despues.orders.find((o) => o.id === created.order.id).status).toBe('pendiente');
  });

  it('no permite cancelar pedidos listos o entregados', async () => {
    const store = await freshStore();
    const state = await store.getState();
    const product = state.products.find((p) => p.id === 'p1');
    const created = await store.createOrder({
      customerName: 'Cliente Y',
      phone: '41122223333',
      items: [{ id: 'p1', name: product.name, price: product.price, quantity: 1 }]
    });
    await store.updateOrderStatus(created.order.id, 'entregado');
    const result = await store.cancelOrder(created.order.id, '41122223333');
    expect(result.error).toContain('ya no puede cancelarse');
  });

  it('solo permite eliminar pedidos cancelados', async () => {
    const store = await freshStore();
    const state = await store.getState();
    const product = state.products.find((p) => p.id === 'p1');
    const created = await store.createOrder({
      customerName: 'Cliente Z',
      phone: '41133334444',
      items: [{ id: 'p1', name: product.name, price: product.price, quantity: 1 }]
    });

    const pendiente = await store.deleteOrder(created.order.id);
    expect(pendiente.error).toContain('Solo se pueden eliminar pedidos cancelados');

    await store.cancelOrder(created.order.id, '41133334444');
    const eliminado = await store.deleteOrder(created.order.id);
    expect(eliminado.state.orders.find((o) => o.id === created.order.id)).toBeUndefined();
  });

  it('persiste cambios entre lecturas (mismo archivo)', async () => {
    const store = await freshStore();
    await store.saveSettings({ promos: [{ name: 'Promo Test', discount: 10 }] });
    const state = await store.getState();
    expect(state.settings.promos[0].name).toBe('Promo Test');
  });

  it('normaliza y guarda clientes por teléfono', async () => {
    const store = await freshStore();
    const c = await store.upsertCustomer({ phone: '+54 9 11 5555-0000', customerName: 'Ana' });
    expect(c.phone).toHaveLength(11);
    const leido = await store.getCustomerByPhone(c.phone);
    expect(leido.customerName).toBe('Ana');
  });

  it('lista clientes con balance e isBenefited normalizados', async () => {
    const store = await freshStore();
    await store.upsertCustomer({ phone: '41155550000', customerName: 'Luis' });
    await store.setCustomerBalance('41155550000', 25.5);
    await store.setCustomerBenefited('41155550000', true);

    const customers = await store.listCustomers();
    const luis = customers.find((c) => c.phone === '41155550000');
    expect(luis).toBeDefined();
    expect(luis.balance).toBe(25.5);
    expect(luis.isBenefited).toBe(true);
  });

  it('agrega un pedido a crédito a la cuenta al marcarlo entregado', async () => {
    const store = await freshStore();
    await store.upsertCustomer({ phone: '41166667777', customerName: 'Deudor' });
    const state = await store.getState();
    const product = state.products.find((p) => p.id === 'p1');

    const created = await store.createOrder({
      customerName: 'Deudor',
      phone: '41166667777',
      credit: true,
      items: [{ id: 'p1', name: product.name, price: product.price, quantity: 2 }],
      total: product.price * 2
    });
    expect(created.order.credit).toBe(true);

    await store.updateOrderStatus(created.order.id, 'entregado');
    const customer = await store.getCustomerByPhone('41166667777');
    expect(Number(customer.balance)).toBeCloseTo(product.price * 2, 2);
  });

  it('no suma a la cuenta un pedido a crédito si se cancela', async () => {
    const store = await freshStore();
    await store.upsertCustomer({ phone: '41177778888', customerName: 'Cliente B' });
    const state = await store.getState();
    const product = state.products.find((p) => p.id === 'p1');

    const created = await store.createOrder({
      customerName: 'Cliente B',
      phone: '41177778888',
      credit: true,
      items: [{ id: 'p1', name: product.name, price: product.price, quantity: 1 }],
      total: product.price
    });
    await store.cancelOrder(created.order.id, '41177778888');
    const customer = await store.getCustomerByPhone('41177778888');
    expect(Number(customer.balance)).toBe(0);
  });

  it('addDebtToCustomer registra una deuda por productos sin descontar stock', async () => {
    const store = await freshStore();
    const state = await store.getState();
    const product = state.products.find((p) => p.id === 'p1');
    const stockBefore = product.stock;

    const order = await store.addDebtToCustomer({
      phone: '41188889999',
      customerName: 'Deudor Presencial',
      items: [{ id: 'p1', name: product.name, price: product.price, quantity: 3 }]
    });

    expect(order.credit).toBe(true);
    expect(order.status).toBe('entregado');
    expect(Number(order.total)).toBeCloseTo(product.price * 3, 2);

    const customer = await store.getCustomerByPhone('41188889999');
    expect(Number(customer.balance)).toBeCloseTo(product.price * 3, 2);

    const after = await store.getState();
    expect(after.products.find((p) => p.id === 'p1').stock).toBe(stockBefore);
  });

  it('pedido de pago normal (sin crédito) no toca el balance', async () => {
    const store = await freshStore();
    await store.upsertCustomer({ phone: '41188889999', customerName: 'Pagador' });
    const state = await store.getState();
    const product = state.products.find((p) => p.id === 'p1');

    const created = await store.createOrder({
      customerName: 'Pagador',
      phone: '41188889999',
      items: [{ id: 'p1', name: product.name, price: product.price, quantity: 1 }],
      total: product.price
    });
    await store.updateOrderStatus(created.order.id, 'entregado');
    const customer = await store.getCustomerByPhone('41188889999');
    expect(Number(customer.balance)).toBe(0);
  });

  it('programa y elimina cobros', async () => {
    const store = await freshStore();
    const before = await store.listCollections();
    expect(Array.isArray(before)).toBe(true);

    const created = await store.upsertCollection({
      phone: '41133332222',
      customerName: 'Deudor',
      dueAt: new Date().toISOString(),
      status: 'programado'
    });
    expect(created.item.id).toMatch(/^COB-/);
    expect(created.list.some((c) => c.id === created.item.id)).toBe(true);

    const same = await store.upsertCollection({ id: created.item.id, status: 'enviado' });
    expect(same.list.find((c) => c.id === created.item.id).status).toBe('enviado');

    const removed = await store.removeCollection(created.item.id);
    expect(removed.list.some((c) => c.id === created.item.id)).toBe(false);
  });

  it('guarda lat/lng del destino y actualiza la posición del repartidor', async () => {
    const store = await freshStore();
    const state = await store.getState();
    const product = state.products.find((p) => p.id === 'p1');

    const created = await store.createOrder({
      customerName: 'Cliente GPS',
      phone: '41155556666',
      type: 'delivery',
      address: 'Calle 1',
      lat: 10.4806,
      lng: -66.9036,
      items: [{ id: 'p1', name: product.name, price: product.price, quantity: 1 }],
      total: product.price
    });

    expect(Number(created.order.lat)).toBeCloseTo(10.4806, 4);
    expect(Number(created.order.lng)).toBeCloseTo(-66.9036, 4);

    const updated = await store.updateCourierLocation(created.order.id, 10.481, -66.904);
    expect(Number(updated.courier_lat)).toBeCloseTo(10.481, 3);
    expect(Number(updated.courier_lng)).toBeCloseTo(-66.904, 3);
    expect(updated.courier_updated_at).toBeTruthy();

    const tracking = await store.getOrderTracking(created.order.id);
    expect(tracking.id).toBe(created.order.id);
    expect(Number(tracking.lat)).toBeCloseTo(10.4806, 4);
    expect(Number(tracking.courier_lat)).toBeCloseTo(10.481, 3);
    expect(tracking.courier_updated_at).toBeTruthy();

    const missing = await store.getOrderTracking('ORD-9999');
    expect(missing).toBeNull();
  });

  it('persiste la ubicación del comercio y la expone en el rastreo', async () => {
    const store = await freshStore();
    await store.saveSettings({ storeLocation: { lat: 10.4806, lng: -66.9036, address: 'Av. Principal 123' } });
    const state = await store.getState();
    expect(state.settings.storeLocation).toEqual({ lat: 10.4806, lng: -66.9036, address: 'Av. Principal 123' });

    const created = await store.createOrder({
      customerName: 'Cliente Tienda',
      phone: '41155557777',
      type: 'delivery',
      address: 'Calle 2',
      lat: 10.481,
      lng: -66.904,
      items: [{ id: 'p1', name: 'Prod', price: 10, quantity: 1 }],
      total: 10
    });
    const tracking = await store.getOrderTracking(created.order.id);
    expect(tracking.storeLocation.address).toBe('Av. Principal 123');
    expect(Number(tracking.storeLocation.lat)).toBeCloseTo(10.4806, 4);
  });
});
