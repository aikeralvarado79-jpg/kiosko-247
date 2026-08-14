import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Paridad file vs Postgres (#18): las mismas operaciones (push subs, holds,
// shares) deben dar el mismo resultado con data.json y con Postgres. El pool se
// emula con una mini-base en memoria que soporta únicamente las consultas que
// emite store.js, registrándolas para verificar que las escrituras sí llegan a
// las tablas nuevas (push_subscriptions, stock_holds, shares).
// Nota: cada `it` importa el módulo una sola vez (un solo backend) porque
// vi.resetModules() haría que un segundo import del mismo archivo devuelva la
// instancia cacheada (el backend anterior).

const h = vi.hoisted(() => ({
  db: {
    products: [],
    categories: [],
    orders: [],
    settings: new Map(),
    customers: [],
    holds: new Map(), // client|product -> row
    shares: new Map(), // code -> row
    push: new Map() // endpoint -> row
  },
  queries: [],
  run: async function run(sql, params) {
    const s = String(sql).trim();
    h.queries.push(s);
    const p = Array.isArray(params) ? params : [];

    const ins = s.match(/INSERT INTO\s+([A-Za-z_]+)/);
    if (ins) {
      const table = ins[1];
      if (table === 'stock_holds') {
        h.db.holds.set(`${p[0]}|${p[1]}`, { client_id: p[0], product_id: p[1], qty: p[2], expires_at: p[3] });
        return { rowCount: 1, rows: [] };
      }
      if (table === 'shares') {
        h.db.shares.set(p[0], { code: p[0], owner_client_id: p[1], owner_name: p[2], items: typeof p[3] === 'string' ? JSON.parse(p[3]) : p[3], expires_at: p[4], updated_at: p[5] });
        return { rowCount: 1, rows: [{ code: p[0] }] };
      }
      if (table === 'push_subscriptions') {
        h.db.push.set(p[0], { endpoint: p[0], phone: p[1], keys: typeof p[2] === 'string' ? JSON.parse(p[2]) : p[2] });
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 1, rows: [] };
    }

    if (s.startsWith('SELECT')) {
      const fromMatch = s.match(/FROM\s+([A-Za-z_]+)/);
      const table = fromMatch ? fromMatch[1] : '';
      if (table === 'stock_holds') {
        return { rows: Array.from(h.db.holds.values()).map((r) => ({ client_id: r.client_id, product_id: r.product_id, qty: r.qty, expires_at: String(r.expires_at) })) };
      }
      if (table === 'shares') {
        return { rows: Array.from(h.db.shares.values()).map((r) => ({ ...r, items: r.items || [] })) };
      }
      if (table === 'push_subscriptions') {
        const all = Array.from(h.db.push.values());
        if (s.includes('WHERE phone')) {
          return { rows: all.filter((r) => r.phone === p[0]).map((r) => ({ endpoint: r.endpoint, keys: r.keys })) };
        }
        return { rows: all.map((r) => ({ phone: r.phone, endpoint: r.endpoint, keys: r.keys })) };
      }
      if (s.includes('COUNT(*)')) return { rows: [{ n: h.db.products.length }] };
      if (table === 'settings') return { rows: Array.from(h.db.settings.entries()).map(([key, value]) => ({ key, value })) };
      if (table === 'categories') return { rows: h.db.categories.map((c) => ({ name: c })) };
      if (table === 'customers') return { rows: h.db.customers };
      if (table === 'products') {
        if (s.includes('WHERE id')) return { rows: h.db.products.filter((r) => r.id === p[0]) };
        return { rows: h.db.products };
      }
      if (table === 'orders') return { rows: h.db.orders };
      if (table === 'schema_migrations') return { rows: [] };
      return { rows: [] };
    }

    const del = s.match(/DELETE FROM\s+([A-Za-z_]+)/);
    if (del) {
      const table = del[1];
      if (table === 'stock_holds') {
        for (const [k, r] of h.db.holds) if (r.client_id === p[0]) h.db.holds.delete(k);
        return { rowCount: 0, rows: [] };
      }
      if (table === 'shares') {
        h.db.shares.delete(p[0]);
        return { rowCount: 0, rows: [] };
      }
      if (table === 'push_subscriptions') {
        h.db.push.delete(p[0]);
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    }

    return { rowCount: 0, rows: [] };
  },
  reset() {
    h.db.products = [];
    h.db.categories = [];
    h.db.orders = [];
    h.db.settings = new Map();
    h.db.customers = [];
    h.db.holds = new Map();
    h.db.shares = new Map();
    h.db.push = new Map();
    h.queries = [];
  }
}));

vi.mock('pg', () => {
  const makePool = () => ({
    connect: vi.fn(async () => ({
      query: vi.fn(async (sql, params) => h.run(sql, params)),
      release: vi.fn()
    })),
    query: vi.fn(async (sql, params) => h.run(sql, params))
  });
  return { Pool: vi.fn(() => makePool()), default: { Pool: vi.fn(() => makePool()) } };
});

const PRODUCT = {
  id: 'p1',
  code: 'P1',
  name: 'Refresco',
  brand: '',
  description: '',
  price: '2.5',
  category: 'Bebidas',
  stock: 10,
  sizeValue: '',
  sizeUnit: '',
  image: ''
};

describe('paridad fileStore vs pgStore', () => {
  beforeEach(() => {
    vi.resetModules();
    h.reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function loadFileStore() {
    delete process.env.DATABASE_URL;
    delete process.env.MIRROR_SOURCE_SCHEMA;
    delete process.env.MIRROR_TARGET_SCHEMA;
    return import('./store.js');
  }

  async function loadPgStore() {
    process.env.DATABASE_URL = 'postgres://fake';
    delete process.env.MIRROR_SOURCE_SCHEMA;
    delete process.env.MIRROR_TARGET_SCHEMA;
    h.db.products = [PRODUCT];
    return import('./store.js');
  }

  const SUB = { endpoint: 'https://push.example/abc', keys: { p256dh: 'x', auth: 'y' } };

  describe('push subscriptions', () => {
    it('fileStore: alta/consulta/baja', async () => {
      const store = await loadFileStore();
      await store.savePushSubscription('0412', SUB);
      expect(await store.getPushSubscriptions('0412')).toHaveLength(1);
      expect(await store.getPushSubscriptions('0999')).toHaveLength(0);
      const all = await store.getAllPushSubscriptions();
      expect(all).toHaveLength(1);
      expect(all[0].phone).toBe('0412');
      expect(all[0].endpoint).toBe(SUB.endpoint);
      expect(all[0].keys).toEqual(SUB.keys);
      await store.removePushSubscription(SUB.endpoint);
      expect(await store.getAllPushSubscriptions()).toHaveLength(0);
    });

    it('pgStore: mismo comportamiento y escribe en su propia tabla (no en settings)', async () => {
      const store = await loadPgStore();
      await store.savePushSubscription('0412', SUB);
      expect(await store.getPushSubscriptions('0412')).toHaveLength(1);
      expect(await store.getPushSubscriptions('0999')).toHaveLength(0);
      const all = await store.getAllPushSubscriptions();
      expect(all).toHaveLength(1);
      expect(all[0].phone).toBe('0412');
      expect(all[0].keys).toEqual(SUB.keys);
      await store.removePushSubscription(SUB.endpoint);
      expect(await store.getAllPushSubscriptions()).toHaveLength(0);

      const inserts = h.queries.filter((sql) => sql.includes('INSERT INTO push_subscriptions'));
      expect(inserts.length).toBeGreaterThan(0);
      expect(h.queries.some((sql) => sql.includes('settings') && sql.includes('push'))).toBe(false);
    });
  });

  describe('holds', () => {
    it('fileStore: reserva y validación por disponibilidad', async () => {
      const store = await loadFileStore();
      const state = await store.getState();
      const stock = state.products.find((p) => p.id === 'p1').stock;
      const res = await store.holdStock('cliente-a', [{ id: 'p1', qty: 5 }]);
      expect(res.error).toBeUndefined();
      expect(res.available.p1).toBe(stock);
      const denied = await store.holdStock('cliente-b', [{ id: 'p1', qty: stock }]);
      expect(denied.error).toContain('Solo hay');
      await store.releaseStock('cliente-a');
      const ok = await store.holdStock('cliente-b', [{ id: 'p1', qty: stock }]);
      expect(ok.error).toBeUndefined();
    });

    it('pgStore: mismo comportamiento y escribe/borra en stock_holds', async () => {
      const store = await loadPgStore();
      const res = await store.holdStock('cliente-a', [{ id: 'p1', qty: 5 }]);
      expect(res.error).toBeUndefined();
      expect(res.available.p1).toBe(10);
      const denied = await store.holdStock('cliente-b', [{ id: 'p1', qty: 6 }]);
      expect(denied.error).toContain('Solo hay');

      expect(h.db.holds.size).toBe(1);
      const row = Array.from(h.db.holds.values())[0];
      expect(row.client_id).toBe('cliente-a');
      expect(row.qty).toBe(5);

      await store.releaseStock('cliente-a');
      expect(h.db.holds.size).toBe(0);
      const ok = await store.holdStock('cliente-b', [{ id: 'p1', qty: 6 }]);
      expect(ok.error).toBeUndefined();
    });
  });

  describe('shares', () => {
    it('fileStore: crear/leer/sumar/cerrar', async () => {
      const store = await loadFileStore();
      const created = await store.createShare({ clientId: 'dueno', ownerName: 'Ana', items: [{ id: 'p1', qty: 3 }] });
      expect(created.ok).toBe(true);
      expect(created.share.items[0]).toMatchObject({ id: 'p1', qty: 3 });
      const got = await store.getShare(created.share.code);
      expect(got.ownerName).toBe('Ana');

      await store.addToShare({ code: created.share.code, items: [{ id: 'p1', qty: 2 }] });
      const after = await store.getShare(created.share.code);
      expect(after.items[0].qty).toBe(5);

      const forbidden = await store.deleteShare({ code: created.share.code, clientId: 'otro' });
      expect(forbidden.error).toContain('Solo el dueño');
      const closed = await store.deleteShare({ code: created.share.code, clientId: 'dueno' });
      expect(closed.ok).toBe(true);
    });

    it('pgStore: mismo comportamiento y persiste en shares', async () => {
      const store = await loadPgStore();
      const created = await store.createShare({ clientId: 'dueno', ownerName: 'Ana', items: [{ id: 'p1', qty: 3 }] });
      expect(created.ok).toBe(true);
      expect(created.share.items[0]).toMatchObject({ id: 'p1', qty: 3 });
      const got = await store.getShare(created.share.code);
      expect(got.ownerName).toBe('Ana');

      expect(h.db.shares.size).toBe(1);
      const row = Array.from(h.db.shares.values())[0];
      expect(row.code).toBe(created.share.code);
      expect(row.items).toEqual([{ id: 'p1', qty: 3 }]);

      await store.addToShare({ code: created.share.code, items: [{ id: 'p1', qty: 2 }] });
      expect(h.db.shares.get(created.share.code).items).toEqual([{ id: 'p1', qty: 5 }]);

      const forbidden = await store.deleteShare({ code: created.share.code, clientId: 'otro' });
      expect(forbidden.error).toContain('Solo el dueño');
      const closed = await store.deleteShare({ code: created.share.code, clientId: 'dueno' });
      expect(closed.ok).toBe(true);
      expect(h.db.shares.size).toBe(0);
    });

    it('addToShare no supera el stock disponible en pgStore', async () => {
      const store = await loadPgStore();
      const created = await store.createShare({ clientId: 'b', items: [{ id: 'p1', qty: 9 }] });
      await store.addToShare({ code: created.share.code, items: [{ id: 'p1', qty: 5 }] });
      expect(h.db.shares.get(created.share.code).items).toEqual([{ id: 'p1', qty: 10 }]);
    });
  });
});