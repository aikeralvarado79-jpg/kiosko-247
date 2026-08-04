import { describe, it, expect } from 'vitest';
import { formatSize, STATUS_FLOW, STATUS_LABELS, INITIAL_PRODUCTS, INITIAL_CATEGORIES } from './data.js';

describe('formatSize', () => {
  it('devuelve string vacío si no hay tamaño', () => {
    expect(formatSize({ sizeValue: undefined })).toBe('');
    expect(formatSize(null)).toBe('');
    expect(formatSize({ sizeValue: '' })).toBe('');
  });

  it('formatea enteros sin decimales con unidad', () => {
    expect(formatSize({ sizeValue: 250, sizeUnit: 'g' })).toBe('250g');
    expect(formatSize({ sizeValue: 500, sizeUnit: 'ml' })).toBe('500ml');
  });

  it('formatea decimales con separador es-AR', () => {
    expect(formatSize({ sizeValue: 1.5, sizeUnit: 'kg' })).toBe('1,5kg');
  });
});

describe('datos iniciales', () => {
  it('todo producto tiene id, nombre, precio y categoría válida', () => {
    for (const p of INITIAL_PRODUCTS) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(typeof p.price).toBe('number');
      expect(p.stock).toBeGreaterThanOrEqual(0);
      expect(INITIAL_CATEGORIES).toContain(p.category);
    }
  });

  it('ids de productos únicos', () => {
    const ids = new Set(INITIAL_PRODUCTS.map((p) => p.id));
    expect(ids.size).toBe(INITIAL_PRODUCTS.length);
  });
});

describe('estados de pedidos', () => {
  it('el flujo de estados es válido y tiene labels', () => {
    for (const s of STATUS_FLOW) {
      expect(STATUS_LABELS[s]).toBeTruthy();
    }
    expect(STATUS_LABELS.cancelado).toBe('Cancelado');
  });
});
