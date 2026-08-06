import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Probar refreshMirror() sin tocar una base real: mockeamos pg.Pool con un client fake.
// vi.mock se hoistea; por eso las variables compartidas se crean con vi.hoisted.

const fakeTables = ['products', 'categories', 'orders', 'settings', 'customers'];

const h = vi.hoisted(() => ({
  currentClient: null,
  getOrCreateClient() {
    if (!this.currentClient) {
      this.currentClient = {
        query: vi.fn(async (sql) => {
          sql = String(sql);
          if (sql.includes('to_regclass')) {
            return { rows: [{ r: `public.${sql.match(/public\.(\w+)/)?.[1] || ''}` }] };
          }
          if (sql.includes('DROP TABLE')) return { rowCount: 0 };
          if (sql.includes('CREATE TABLE')) return { rowCount: 0 };
          if (sql.includes('INSERT INTO')) return { rowCount: 3 };
          return { rowCount: 0 };
        }),
        release: vi.fn()
      };
    }
    return this.currentClient;
  },
  reset() {
    this.currentClient = null;
  }
}));

vi.mock('pg', () => {
  const makePool = () => ({
    connect: vi.fn(async () => h.getOrCreateClient())
  });
  return { Pool: vi.fn(() => makePool()), default: { Pool: vi.fn(() => makePool()) } };
});

describe('refreshMirror', () => {
  beforeEach(() => {
    vi.resetModules();
    h.reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('devuelve error si no hay DATABASE_URL (fileStore)', async () => {
    delete process.env.DATABASE_URL;
    const store = await import('./store.js');
    const res = await store.refreshMirror();
    expect(res.ok).toBe(false);
    expect(res.error).toContain('DATABASE_URL');
  });

  it('rechaza cuando el schema fuente y destino coinciden', async () => {
    process.env.DATABASE_URL = 'postgres://fake';
    process.env.MIRROR_SOURCE_SCHEMA = 'x';
    process.env.MIRROR_TARGET_SCHEMA = 'x';
    const store = await import('./store.js');
    const res = await store.refreshMirror();
    expect(res.ok).toBe(false);
    expect(res.error).toContain('distintos');
  });

  it('copia cada tabla del schema fuente al destino y devuelve los conteos', async () => {
    process.env.DATABASE_URL = 'postgres://fake';
    delete process.env.MIRROR_SOURCE_SCHEMA;
    delete process.env.MIRROR_TARGET_SCHEMA;
    const store = await import('./store.js');
    const res = await store.refreshMirror();
    expect(res.ok).toBe(true);
    expect(res.source).toBe('public');
    expect(res.target).toBe('staging');
    expect(Object.keys(res.tables).sort()).toEqual([...fakeTables].sort());
    expect(res.tables.products).toBe(3);

    const client = h.getOrCreateClient();
    const sqls = client.query.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => s.includes('CREATE SCHEMA IF NOT EXISTS staging'))).toBe(true);
    expect(sqls.filter((s) => s.includes('INSERT INTO')).length).toBe(fakeTables.length);
  });

  it('re-agrega columnas propias de staging tras copiar desde produccion', async () => {
    process.env.DATABASE_URL = 'postgres://fake';
    delete process.env.MIRROR_SOURCE_SCHEMA;
    delete process.env.MIRROR_TARGET_SCHEMA;
    const store = await import('./store.js');
    const res = await store.refreshMirror();
    expect(res.ok).toBe(true);

    const client = h.getOrCreateClient();
    const sqls = client.query.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => s.includes('ALTER TABLE staging.customers ADD COLUMN IF NOT EXISTS balance'))).toBe(true);
    expect(sqls.some((s) => s.includes('ALTER TABLE staging.customers ADD COLUMN IF NOT EXISTS "isBenefited"'))).toBe(true);
    expect(sqls.some((s) => s.includes('ALTER TABLE staging.orders ADD COLUMN IF NOT EXISTS credit'))).toBe(true);
  });
});