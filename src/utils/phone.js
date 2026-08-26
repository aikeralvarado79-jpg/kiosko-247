export const PHONE_CODES = ['0412', '0414', '0416', '0422', '0424', '0426'];

export const normalizePhoneDigits = (phone) => String(phone || '').replace(/\D/g, '').slice(-11);

export const parsePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  const num = digits.length >= 11 ? digits.slice(-11) : digits;
  if (num.length < 7) return { code: '', number: '' };
  return { code: num.slice(0, 4), number: num.slice(-7) };
};

export const formatPhoneWhatsApp = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('58')) return digits;
  if (digits.startsWith('0')) return '58' + digits.slice(1);
  return '58' + digits;
};
