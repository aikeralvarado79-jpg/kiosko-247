import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Verifica que las mutaciones con Postgres usen operaciones puntuales
// (UPDATE/DELETE por id) y nunca reescriban toda la tabla con DELETE sin WHERE,
// que bajo concurrencia borraba pedidos y productos en producción.

const h = vi.hoisted(() => ({
  calls: [],
  client: null,
  orderRow: { id: 'ORD-1', status: 'pendiente', phone: '04140000001', items: [], total: 5, credit: false },
  makeClient() {
    this.client = {
      query: vi.fn(async (sql) => {
        const s = String(sql);
        h.calls.push(s);
        if (s.includes('SELECT 1 FROM orders WHERE id')) return { rows: [{ '?column?': 1 }] };
        if (s.includes('SELECT status FROM orders WHERE id')) return { rows: [{ status: 'cancelado' }] };
        if (s.includes('SELECT id FROM orders WHERE id')) return { rows: [{ id: 'ORD-1' }] };
        if (s.includes('SELECT * FROM orders WHERE id')) return { rows: [h.orderRow] };
        if (s.includes('SELECT status FROM orders')) return { rows: [{ status: 'cancelado' }] };
        return { rows: [] };
      }),
      release: vi.fn()
    };
    return this.client;
  },
  reset() {
    this.calls = [];
    this.client = null;
    this.orderRow = { id: 'ORD-1', status: 'pendiente', phone: '04140000001', items: [], total: 5, credit: false };
  }
}));

vi.mock('pg', () => {
  const makePool = () => ({
    connect: vi.fn(async () => h.makeClient()),
    query: vi.fn(async (sql) => {
      const s = String(sql);
      h.calls.push(s);
      if (s.includes('SELECT key, value FROM settings')) return { rows: [] };
      if (s.includes('SELECT * FROM products')) return { rows: [] };
      if (s.includes('SELECT * FROM categories')) return { rows: [] };
      if (s.includes('SELECT * FROM orders')) return { rows: [] };
      if (s.includes('SELECT * FROM customers')) return { rows: [] };
      if (s.includes('INSERT INTO categories')) return { rowCount: 1 };
      if (s.includes('INSERT INTO products')) return { rowCount: 1 };
      if (s.includes('UPDATE products SET code')) return { rowCount: 1 };
      if (s.includes('DELETE FROM products WHERE id')) return { rowCount: 1 };
      if (s.includes('DELETE FROM orders WHERE id')) return { rowCount: 1 };
      return { rowCount: 1, rows: [] };
    })
  });
  return { Pool: vi.fn(() => makePool()), default: { Pool: vi.fn(() => makePool()) } };
});

describe('mutaciones atómicas en Postgres', () => {
  beforeEach(() => {
    vi.resetModules();
    h.reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function loadPgStore() {
    process.env.DATABASE_URL = 'postgres://fake';
    delete process.env.MIRROR_SOURCE_SCHEMA;
    delete process.env.MIRROR_TARGET_SCHEMA;
    return import('./store.js');
  }

  it('updateOrderStatus usa UPDATE por id y nunca DELETE sin WHERE', async () => {
    const store = await loadPgStore();
    await store.updateOrderStatus('ORD-1', 'listo');
    const sqls = h.calls;
    expect(sqls.some((s) => s.includes('UPDATE orders SET status') && s.includes('WHERE id'))).toBe(true);
    expect(sqls.some((s) => /DELETE FROM orders\b(?!\s*WHERE)/.test(s))).toBe(false);
    expect(sqls.some((s) => s.includes('DELETE FROM orders WHERE id'))).toBe(false);
  });

  it('updateOrderPayment usa placeholders correctos (el primer campo no colisiona con el id)', async () => {
    const store = await loadPgStore();
    const result = await store.updateOrderPayment('ORD-1', {
      paymentStatus: 'confirmado',
      paymentReference: 'REF-1',
      paymentProof: 'data:image/png;base64,AAAA'
    });
    expect(result.error).toBeUndefined();
    const update = h.calls.find((s) => s.includes('UPDATE orders SET') && s.includes('"paymentProof"'));
    expect(update).toContain('"paymentStatus" = $2');
    expect(update).toContain('"paymentProof" = $3');
    expect(update).toContain('"paymentReference" = $4');
    expect(update).toContain('WHERE id = $1');
  });

  it('convertToCredit marca crédito y limpia los campos de pago por id', async () => {
    const store = await loadPgStore();
    const result = await store.convertToCredit('ORD-1');
    expect(result.error).toBeUndefined();
    const update = h.calls.find((s) => s.includes('UPDATE orders SET credit'));
    expect(update).toContain('credit = true');
    expect(update).toContain('"paymentMethod"');
    expect(update).toContain('"paymentStatus"');
    expect(update).toContain('WHERE id = $1');
    expect(h.calls.some((s) => /DELETE FROM orders\b(?!\s*WHERE)/.test(s))).toBe(false);
  });

  it('convertToCredit rechaza si el pedido ya está a cuenta y no actualiza', async () => {
    h.orderRow = { id: 'ORD-1', status: 'pendiente', phone: '04140000001', credit: true };
    const store = await loadPgStore();
    const result = await store.convertToCredit('ORD-1');
    expect(result.error).toBe('El pedido ya está a cuenta');
    expect(h.calls.some((s) => s.includes('UPDATE orders SET credit'))).toBe(false);
  });

  it('convertToCredit rechaza si el pago ya fue confirmado y no actualiza', async () => {
    h.orderRow = { id: 'ORD-1', status: 'pendiente', phone: '04140000001', credit: false, paymentStatus: 'confirmado' };
    const store = await loadPgStore();
    const result = await store.convertToCredit('ORD-1');
    expect(result.error).toBe('El pago ya fue confirmado');
    expect(h.calls.some((s) => s.includes('UPDATE orders SET credit'))).toBe(false);
  });

  it('cancelOrder restaura stock por id y no borra la tabla', async () => {
    const store = await loadPgStore();
    await store.cancelOrder('ORD-1', '04140000001');
    const sqls = h.calls;
    expect(sqls.some((s) => s.includes('UPDATE orders SET status') && s.includes('WHERE id'))).toBe(true);
    expect(sqls.some((s) => /DELETE FROM orders\b(?!\s*WHERE)/.test(s))).toBe(false);
  });

  it('deleteProduct usa DELETE por id', async () => {
    const store = await loadPgStore();
    await store.deleteProduct('p-1');
    const sqls = h.calls;
    expect(sqls.some((s) => s.includes('DELETE FROM products WHERE id'))).toBe(true);
    expect(sqls.some((s) => /DELETE FROM products\b(?!\s*WHERE)/.test(s))).toBe(false);
  });

  it('createProduct usa INSERT puntual, no DELETE + re-insert', async () => {
    const store = await loadPgStore();
    await store.createProduct({ name: 'Nuevo', price: 10, category: 'Comida', stock: 5 });
    const sqls = h.calls;
    expect(sqls.some((s) => s.includes('INSERT INTO products'))).toBe(true);
    expect(sqls.some((s) => /DELETE FROM products\b/.test(s))).toBe(false);
  });

  it('refreshMirror rechaza si el destino es public (producción)', async () => {
    process.env.DATABASE_URL = 'postgres://fake';
    process.env.MIRROR_SOURCE_SCHEMA = 'staging';
    process.env.MIRROR_TARGET_SCHEMA = 'public';
    const store = await import('./store.js');
    const res = await store.refreshMirror();
    expect(res.ok).toBe(false);
    expect(res.error).toContain('no puede ser');
  });
});
