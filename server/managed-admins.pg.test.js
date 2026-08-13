import { describe, it, expect, vi, beforeEach } from 'vitest';

const settingsMap = new Map();

class FakePool {
  async query(sql, params = []) {
    if (sql.includes('SELECT value FROM settings WHERE key = $1') || sql.includes('SELECT key, value FROM settings')) {
      const key = params[0];
      if (!settingsMap.has(key)) return { rows: [] };
      return { rows: [{ value: settingsMap.get(key) }] };
    }
    if (sql.includes('UPDATE settings SET value')) {
      settingsMap.set(params[0], JSON.parse(params[1]));
      return { rowCount: 0 };
    }
    if (sql.includes('INSERT INTO settings')) {
      settingsMap.set(params[0], JSON.parse(params[1]));
      return { rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }
}

vi.mock('pg', () => ({ default: { Pool: FakePool } }));

describe('pgStore: admins gestionados y sesiones (regresion PR #144)', () => {
  let store;

  beforeEach(async () => {
    settingsMap.clear();
    process.env.DATABASE_URL = 'postgres://fake';
    process.env.KIOSKO_DB_SCHEMA = 'public';
    vi.resetModules();
    store = await import('./store.js');
  });

  it('listManagedAdmins devuelve [] si no hay data y guarda/lee empleados', async () => {
    expect(await store.listManagedAdmins()).toEqual([]);
    await store.setManagedAdmins(['04120000000', '04130000000']);
    expect(await store.listManagedAdmins()).toEqual(['04120000000', '04130000000']);
  });

  it('guarda, lista, actualiza y elimina sesiones admin', async () => {
    await store.saveAdminSession('hash1', { phone: '04120000000', role: 'superadmin', lastSeen: 100 });
    await store.saveAdminSession('hash2', { phone: '04130000000', role: 'admin', lastSeen: 200 });

    expect(await store.listAdminSessions()).toHaveLength(2);
    const session = await store.getAdminSession('hash1');
    expect(session.role).toBe('superadmin');

    const touched = await store.touchAdminSession('hash1');
    expect(touched.lastSeen).toBeGreaterThan(100);

    await store.removeAdminSession('hash2');
    expect(await store.getAdminSession('hash2')).toBeNull();
    expect(await store.listAdminSessions()).toHaveLength(1);
  });
});