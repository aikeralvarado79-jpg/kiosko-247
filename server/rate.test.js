import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('getBcvRate', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Re-importamos el módulo por test para resetear el cache en memoria.
  const freshGetBcvRate = async () => (await import('./rate.js')).getBcvRate;

  it('obtiene la tasa oficial de DolarAPI', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ fuente: 'oficial', promedio: 748.5, fechaActualizacion: '2026-08-04' }]
    });
    const getBcvRate = await freshGetBcvRate();
    const rate = await getBcvRate();
    expect(rate.source).toContain('BCV');
    expect(rate.rate).toBe(748.5);
  });

  it('cae a ER-API si DolarAPI falla', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('red caída'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rates: { VES: 740.25 }, time_last_update_utc: '2026-08-04' })
      });
    const getBcvRate = await freshGetBcvRate();
    const rate = await getBcvRate();
    expect(rate.source).toContain('ER-API');
    expect(rate.rate).toBe(740.25);
  });

  it('usa el valor de respaldo si todas las fuentes fallan', async () => {
    fetchMock.mockRejectedValue(new Error('todo caído'));
    const getBcvRate = await freshGetBcvRate();
    const rate = await getBcvRate();
    expect(rate.source).toBe('Respaldo');
    expect(rate.rate).toBeGreaterThan(0);
  });

  it('usa la cache dentro del TTL (no vuelve a llamar a la API)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ fuente: 'oficial', promedio: 750, fechaActualizacion: '2026-08-04' }]
    });
    const getBcvRate = await freshGetBcvRate();
    const first = await getBcvRate();
    const second = await getBcvRate();
    expect(second.rate).toBe(first.rate);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
