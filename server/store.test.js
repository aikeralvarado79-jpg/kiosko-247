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
});
