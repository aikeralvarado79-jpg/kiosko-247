export const formatTimestamp = (date = new Date()) =>
  date.toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export const formatRelative = (ts) => {
  if (!ts) return 'ahora';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 1000));
  if (seconds < 60) return 'hace segundos';
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)} h`;
  return `hace ${Math.floor(seconds / 86400)} d`;
};

export const formatSize = (product) => {
  if (!product || product.sizeValue === undefined || product.sizeValue === null || product.sizeValue === '') return '';
  const num = Number(product.sizeValue);
  const formatted = Number.isInteger(num) ? String(num) : num.toLocaleString('es-AR');
  return `${formatted}${product.sizeUnit || ''}`;
};

export const formatUsd = (n) => `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatAmount = (n, decimals = 2) =>
  Number.isFinite(n) ? n.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '';

export const parseAmount = (value) => {
  const s = String(value || '').replace(/[^\d.,]/g, '').trim();
  if (!s) return NaN;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  if (hasComma && !hasDot) return parseFloat(s.replace(',', '.'));
  if (!hasComma && hasDot) {
    const parts = s.split('.');
    const last = parts[parts.length - 1];
    if (parts.length > 1 && last.length === 3) return parseFloat(s.replace(/\./g, ''));
    return parseFloat(s);
  }
  return parseFloat(s);
};

export const formatBs = (n) => `Bs ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatAmountBsInput = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return '';
  const cleaned = s.replace(/[^\d.,]/g, '');
  const commaIdx = cleaned.indexOf(',');
  const intPart = (commaIdx === -1 ? cleaned : cleaned.slice(0, commaIdx)).replace(/\D/g, '');
  const decPart = commaIdx === -1 ? '' : cleaned.slice(commaIdx + 1).replace(/\D/g, '').slice(0, 2);
  const formattedInt = intPart ? Number(intPart).toLocaleString('es-VE') : '';
  if (commaIdx === -1) return formattedInt;
  return decPart ? `${formattedInt},${decPart}` : `${formattedInt},`;
};

export const usdToBs = (usd, rate) => Number(usd || 0) * (rate || 0);
