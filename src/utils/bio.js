export const IS_IOS =
  /iPad|iPhone|iPod/.test(typeof navigator !== 'undefined' ? navigator.userAgent : '') ||
  (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const IS_ANDROID =
  typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');

export const BIO_METHOD_LABEL = IS_IOS ? 'Face ID' : IS_ANDROID ? 'huella' : 'biometría';

export const friendlyAuthError = (err) => {
  const name = err?.name || '';
  if (name === 'Error' && err?.message) return err.message;
  if (name === 'NotAllowedError') {
    return `Verificacion cancelada. Para continuar, acepta tu ${BIO_METHOD_LABEL} cuando tu telefono lo pida.`;
  }
  if (name === 'NotFoundError' || name === 'NotSupportedError') {
    return `Tu dispositivo no tiene ${BIO_METHOD_LABEL} configurada. Activa tu ${BIO_METHOD_LABEL} en los ajustes y prueba de nuevo.`;
  }
  if (name === 'AbortError') {
    return 'La verificacion tardo demasiado y se cancelo. Intenta de nuevo.';
  }
  if (name === 'TimeoutError') {
    return 'El tiempo de espera se agoto. Intenta de nuevo.';
  }
  if (name === 'SecurityError' || name === 'InvalidStateError') {
    return 'Tu dispositivo no pudo completar la verificacion. Intenta de nuevo o usa un telefono mas reciente.';
  }
  return 'No se pudo completar la verificacion. Intenta de nuevo.';
};
