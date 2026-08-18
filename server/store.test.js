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
    expect(result.error).toContain('Unidades disponibles');
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

  it('updateOrderStatus a cancelado devuelve el stock de los items', async () => {
    const store = await freshStore();
    const state = await store.getState();
    const product = state.products.find((p) => p.id === 'p1');
    const created = await store.createOrder({
      customerName: 'Cliente W',
      phone: '41155556666',
      items: [{ id: 'p1', name: product.name, price: product.price, quantity: 3 }],
      total: product.price * 3
    });

    const cancelado = await store.updateOrderStatus(created.order.id, 'cancelado');
    expect(cancelado.state.orders.find((o) => o.id === created.order.id).status).toBe('cancelado');
    expect(cancelado.state.products.find((p) => p.id === 'p1').stock).toBe(product.stock);
  });

  it('updateOrderStatus a cancelado no devuelve stock si ya estaba entregado', async () => {
    const store = await freshStore();
    const state = await store.getState();
    const product = state.products.find((p) => p.id === 'p1');
    const created = await store.createOrder({
      customerName: 'Cliente V',
      phone: '41177778888',
      items: [{ id: 'p1', name: product.name, price: product.price, quantity: 3 }],
      total: product.price * 3
    });
    await store.updateOrderStatus(created.order.id, 'entregado');
    const entregadoStock = (await store.getState()).products.find((p) => p.id === 'p1').stock;
    const cancelado = await store.updateOrderStatus(created.order.id, 'cancelado');
    expect(cancelado.state.products.find((p) => p.id === 'p1').stock).toBe(entregadoStock);
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

  it('inhabilita/habilita y elimina usuarios; el upsert conserva disabled', async () => {
    const store = await freshStore();
    await store.upsertCustomer({ phone: '41155550001', customerName: 'Maria' });

    const disabled = await store.setCustomerDisabled('41155550001', true);
    expect(disabled.disabled).toBe(true);
    expect((await store.getCustomerByPhone('41155550001')).disabled).toBe(true);
    expect((await store.listCustomers()).find((c) => c.phone === '41155550001').disabled).toBe(true);

    // Un nuevo login/upsert del cliente NO re-habilita la cuenta.
    await store.upsertCustomer({ phone: '41155550001', customerName: 'Maria G.' });
    expect((await store.getCustomerByPhone('41155550001')).disabled).toBe(true);

    await store.setCustomerDisabled('41155550001', false);
    expect((await store.getCustomerByPhone('41155550001')).disabled).toBe(false);

    expect(await store.deleteCustomer('41155550001')).toBe(true);
    expect(await store.getCustomerByPhone('41155550001')).toBeNull();
    expect(await store.deleteCustomer('41155550001')).toBe(false);
  });

  it('revoca y des-revoca teléfonos de admin (cierre remoto de sesión)', async () => {
    const store = await freshStore();
    expect(await store.listRevokedAdminPhones()).toEqual([]);
    await store.revokeAdminPhone('04129862577');
    expect(await store.listRevokedAdminPhones()).toEqual(['04129862577']);
    await store.revokeAdminPhone('04129862577'); // idempotente
    expect(await store.listRevokedAdminPhones()).toHaveLength(1);
    await store.unrevokeAdminPhone('04129862577');
    expect(await store.listRevokedAdminPhones()).toEqual([]);
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

  it('reserva stock para un cliente y otro cliente ve menos disponible', async () => {
    const store = await freshStore();
    const state = await store.getState();
    const product = state.products.find((p) => p.id === 'p1');
    const stock = product.stock;

    const held = await store.holdStock('cliente-a', [{ id: 'p1', qty: 5 }]);
    expect(held.ok).toBe(true);
    // El propio cliente ve el stock completo (su reserva no cuenta contra sí mismo).
    expect((await store.getState('cliente-a')).products.find((p) => p.id === 'p1').reserved).toBe(0);
    // Otro cliente ve 5 reservados.
    expect((await store.getState('cliente-b')).products.find((p) => p.id === 'p1').reserved).toBe(5);

    // El cliente B no puede reservar más de lo que queda.
    const denied = await store.holdStock('cliente-b', [{ id: 'p1', qty: stock }]);
    expect(denied.ok).toBeFalsy();
    expect(denied.available['p1']).toBe(stock - 5);

    // El cliente B sí puede tomar lo que queda.
    const ok = await store.holdStock('cliente-b', [{ id: 'p1', qty: stock - 5 }]);
    expect(ok.ok).toBe(true);
  });

  it('libera la reserva al crear el pedido y la liberación devuelve el stock', async () => {
    const store = await freshStore();
    const state = await store.getState();
    const product = state.products.find((p) => p.id === 'p1');

    await store.holdStock('cliente-a', [{ id: 'p1', qty: 5 }]);
    await store.createOrder({
      clientId: 'cliente-a',
      customerName: 'A',
      phone: '41111111111',
      items: [{ id: 'p1', name: product.name, price: product.price, quantity: 5 }],
      total: product.price * 5
    });
    // Tras el pedido, la reserva del cliente A desaparece.
    expect((await store.getState('cliente-b')).products.find((p) => p.id === 'p1').reserved).toBe(0);

    const released = await store.releaseStock('cliente-b');
    expect(released.ok).toBe(true);
  });

  it('las reservas expiran tras su TTL y el stock vuelve a estar disponible', async () => {
    const store = await freshStore();

    await store.holdStock('cliente-a', [{ id: 'p1', qty: 3 }], 500); // TTL 500 ms
    expect((await store.getState('cliente-b')).products.find((p) => p.id === 'p1').reserved).toBe(3);

    await new Promise((r) => setTimeout(r, 1100));

    // getState purga las reservas vencidas.
    expect((await store.getState('cliente-b')).products.find((p) => p.id === 'p1').reserved).toBe(0);
  });

  it('crea un carrito compartido y el invitado puede sumar artículos', async () => {
    const store = await freshStore();
    const state = await store.getState();
    const p1 = state.products.find((p) => p.id === 'p1');
    const p2 = state.products.find((p) => p.id === 'p2');

    const created = await store.createShare({
      clientId: 'dueno-1',
      ownerName: 'Lucía',
      items: [{ id: 'p1', qty: 2 }]
    });
    expect(created.ok).toBe(true);
    const code = created.share.code;
    expect(code).toBeTruthy();

    // El invitado suma su artículo.
    const added = await store.addToShare({ code, items: [{ id: 'p2', qty: 1 }] });
    expect(added.ok).toBe(true);
    expect(added.share.items.length).toBe(2);
    expect(added.share.items.find((i) => i.id === 'p2').qty).toBe(1);

    // El dueño re-crea su carrito: se reemplaza el anterior (un solo activo por dueño).
    await store.createShare({ clientId: 'dueno-1', ownerName: 'Lucía', items: [{ id: 'p1', qty: 1 }] });
    const afterRecreate = await store.getShare(code);
    expect(afterRecreate).toBeNull();
  });

  it('el invitado no puede superar el stock disponible en un carrito compartido', async () => {
    const store = await freshStore();
    const state = await store.getState();
    const p1 = state.products.find((p) => p.id === 'p1');
    const stock = p1.stock;

    const created = await store.createShare({ clientId: 'dueno-2', items: [] });
    const added = await store.addToShare({ code: created.share.code, items: [{ id: 'p1', qty: stock + 50 }] });
    expect(added.ok).toBe(true);
    expect(added.share.items.find((i) => i.id === 'p1').qty).toBe(stock);
  });

  it('solo el dueño puede cerrar el carrito compartido', async () => {
    const store = await freshStore();
    const created = await store.createShare({ clientId: 'dueno-3', ownerName: 'A', items: [] });

    const denied = await store.deleteShare({ code: created.share.code, clientId: 'otro' });
    expect(denied.error).toBeTruthy();

    const ok = await store.deleteShare({ code: created.share.code, clientId: 'dueno-3' });
    expect(ok.ok).toBe(true);
    expect(await store.getShare(created.share.code)).toBeNull();
  });

  it('expone la predicción de stock (soldPerDay / runOutDays) en getState', async () => {
    const store = await freshStore();
    // Crear pedidos recientes de p1 para generar velocidad de venta.
    const state0 = await store.getState();
    const p1 = state0.products.find((p) => p.id === 'p1');
    for (let i = 0; i < 4; i++) {
      await store.createOrder({
        customerName: 'Pred',
        phone: '41111111111',
        items: [{ id: 'p1', name: p1.name, price: p1.price, quantity: 2 }],
        total: p1.price * 2
      });
    }
    const state = await store.getState();
    const product = state.products.find((p) => p.id === 'p1');
    expect(product).toHaveProperty('soldPerDay');
    expect(product).toHaveProperty('runOutDays');
    // 4 pedidos x 7 uds en 14 días => 2/día; con stock inicial debe agotarse en días finitos.
    expect(product.soldPerDay).toBeGreaterThan(0);
    expect(product.runOutDays).toBeGreaterThan(0);
  });

  it('crea un abono pendiente y no lo expone en getState', async () => {
    const store = await freshStore();
    const created = await store.createPayment({
      phone: '4125551234',
      customerName: 'Cliente A',
      amountBs: 1200,
      rate: 60,
      amountUsd: 20,
      reference: 'REF-1',
      proof: 'data:image/png;base64,xxxx'
    });
    expect(created.id).toMatch(/^PAG-/);
    expect(created.status).toBe('pendiente');
    expect(created.amountBs).toBe(1200);
    expect(created.amountUsd).toBe(20);

    const payment = await store.getPaymentById(created.id);
    expect(payment.phone).toBe('4125551234');
    expect(payment.proof).toBe('data:image/png;base64,xxxx');

    const list = await store.listPayments();
    expect(list.length).toBe(1);

    const state = await store.getPublicState();
    expect(state.payments).toBeUndefined();
  });

  it('aprueba un abono y descuenta del balance (excedente queda como cartera)', async () => {
    const store = await freshStore();
    await store.upsertCustomer({ phone: '4125551234', customerName: 'Cliente A' });
    await store.setCustomerBalance('4125551234', 100);
    const created = await store.createPayment({
      phone: '4125551234',
      amountBs: 7200,
      rate: 60,
      amountUsd: 120,
      proof: 'data:image/png;base64,xxxx'
    });
    const approved = await store.approvePayment(created.id);
    expect(approved.status).toBe('aprobado');
    expect(approved.decidedAt).toBeTruthy();
    const customer = await store.getCustomerByPhone('4125551234');
    // 100 de deuda - 120 abonados => -20 de saldo a favor (Mi Cartera)
    expect(customer.balance).toBe(-20);

    const dup = await store.approvePayment(created.id);
    expect(dup.error).toBeTruthy();
  });

  it('rechaza un abono sin tocar el balance', async () => {
    const store = await freshStore();
    await store.upsertCustomer({ phone: '4125551234', customerName: 'Cliente A' });
    await store.setCustomerBalance('4125551234', 100);
    const created = await store.createPayment({
      phone: '4125551234',
      amountBs: 600,
      rate: 60,
      amountUsd: 10
    });
    const rejected = await store.rejectPayment(created.id, 'Comprobante ilegible');
    expect(rejected.status).toBe('rechazado');
    expect(rejected.note).toBe('Comprobante ilegible');
    const customer = await store.getCustomerByPhone('4125551234');
    expect(customer.balance).toBe(100);
  });

  it('rechaza aprobar un abono inexistente', async () => {
    const store = await freshStore();
    expect((await store.approvePayment('PAG-9999')).error).toBeTruthy();
    expect((await store.rejectPayment('PAG-9999')).error).toBeTruthy();
  });

  it('crea pedido pagado con Mi Cartera (cubre todo) sin comprobante', async () => {
    const store = await freshStore();
    // Cliente con saldo a favor enorme (balance negativo) que cubre el pedido completo
    await store.upsertCustomer({ phone: '4125551234', customerName: 'Cliente A' });
    await store.setCustomerBalance('4125551234', -99999);
    const state = await store.getState();
    const p1 = state.products.find((p) => p.id === 'p1');
    const total = p1.price * 2;

    const result = await store.createOrder({
      customerName: 'Cliente A',
      phone: '4125551234',
      items: [{ id: 'p1', name: p1.name, price: p1.price, quantity: 2 }],
      total,
      walletApplied: total,
      paymentProof: 'data:image/png;base64,xxxx',
      paymentReference: 'REF-X'
    });
    expect(result.order.paymentMethod).toBe('cartera');
    expect(result.order.paymentStatus).toBe('confirmado');
    expect(result.order.paymentProof).toBeNull();
    expect(result.order.paymentReference).toBe('');
    expect(result.order.walletApplied).toBe(total);
    const customer = await store.getCustomerByPhone('4125551234');
    expect(customer.balance).toBe(-99999 + total);
  });

  it('crea pedido con cartera parcial y método de pago restante', async () => {
    const store = await freshStore();
    await store.upsertCustomer({ phone: '4125551234', customerName: 'Cliente A' });
    await store.setCustomerBalance('4125551234', -30);
    const state = await store.getState();
    const p1 = state.products.find((p) => p.id === 'p1');
    const total = p1.price * 5; // > 30

    const result = await store.createOrder({
      customerName: 'Cliente A',
      phone: '4125551234',
      items: [{ id: 'p1', name: p1.name, price: p1.price, quantity: 5 }],
      total,
      walletApplied: 30,
      paymentMethod: 'pago_movil',
      paymentStatus: 'pendiente',
      paymentReference: 'REF-Y'
    });
    expect(result.order.paymentMethod).toBe('pago_movil');
    expect(result.order.walletApplied).toBe(30);
    const customer = await store.getCustomerByPhone('4125551234');
    expect(customer.balance).toBe(0);
  });

  it('rechaza pedido cuando la cartera no alcanza el monto indicado', async () => {
    const store = await freshStore();
    await store.upsertCustomer({ phone: '4125551234', customerName: 'Cliente A' });
    await store.setCustomerBalance('4125551234', -10);
    const state = await store.getState();
    const p1 = state.products.find((p) => p.id === 'p1');

    const result = await store.createOrder({
      customerName: 'Cliente A',
      phone: '4125551234',
      items: [{ id: 'p1', name: p1.name, price: p1.price, quantity: 1 }],
      total: p1.price,
      walletApplied: 50
    });
    expect(result.error).toBe('Tu cartera solo cubre $10.00. Ajusta el monto o usa otro método.');
  });
});
