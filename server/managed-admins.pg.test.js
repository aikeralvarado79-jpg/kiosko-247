import { describe, it, expect, vi, beforeEach } from 'vitest';

const settingsMap = new Map();
const customersMap = new Map();

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
    if (sql.includes('UPDATE customers SET disabled')) {
      const key = params[0];
      const updated = { ...(customersMap.get(key) || { phone: key, customerName: 'Maria' }), disabled: params[1] };
      customersMap.set(key, updated);
      return { rows: [updated] };
    }
    if (sql.includes('DELETE FROM customers')) {
      return { rowCount: customersMap.delete(params[0]) ? 1 : 0 };
    }
    return { rows: [], rowCount: 0 };
  }
}

vi.mock('pg', () => ({ default: { Pool: FakePool } }));

describe('pgStore: admins gestionados y sesiones (regresion PR #144)', () => {
  let store;

  beforeEach(async () => {
    settingsMap.clear();
    customersMap.clear();
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

  it('revoca y des-revoca teléfonos de admin vía settings (cierre remoto)', async () => {
    expect(await store.listRevokedAdminPhones()).toEqual([]);
    await store.revokeAdminPhone('04120000000');
    expect(await store.listRevokedAdminPhones()).toEqual(['04120000000']);
    await store.revokeAdminPhone('04120000000'); // idempotente
    expect(await store.listRevokedAdminPhones()).toHaveLength(1);
    await store.unrevokeAdminPhone('04120000000');
    expect(await store.listRevokedAdminPhones()).toEqual([]);
  });

  it('guarda y lee el perfil del admin (regresion PR #200: admin/profile 500 en Postgres)', async () => {
    expect(await store.getAdminProfile('04242963490')).toBeNull();
    await store.setAdminProfile('04242963490', { name: 'Kiosko', photo: 'data:image/png;base64,xxx' });
    const profile = await store.getAdminProfile('04242963490');
    expect(profile).not.toBeNull();
    expect(profile.name).toBe('Kiosko');
    expect(profile.photo).toBe('data:image/png;base64,xxx');
    // Sobrescribe parcialmente sin perder campos previos.
    await store.setAdminProfile('04242963490', { name: 'Kiosko 247' });
    expect((await store.getAdminProfile('04242963490')).name).toBe('Kiosko 247');
    expect((await store.getAdminProfile('04242963490')).photo).toBe('data:image/png;base64,xxx');
  });

  it('inhabilita y elimina usuarios (lista de usuarios en el sistema)', async () => {
    const disabled = await store.setCustomerDisabled('04125557777', true);
    expect(disabled).not.toBeNull();
    expect(disabled.disabled).toBe(true);

    const reEnabled = await store.setCustomerDisabled('04125557777', false);
    expect(reEnabled.disabled).toBe(false);

    expect(await store.deleteCustomer('04125557777')).toBe(true);
    expect(await store.deleteCustomer('04125557777')).toBe(false);
  });
});