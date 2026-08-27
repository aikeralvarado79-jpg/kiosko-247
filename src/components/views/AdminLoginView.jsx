import { useState, useEffect, useRef } from 'react';
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { api, getRememberSession, setRememberSession } from '../../api.js';
import { hasRealBiometrics } from '../../utils/pwa.js';
import { IS_IOS, IS_ANDROID, BIO_METHOD_LABEL, friendlyAuthError } from '../../utils/bio.js';
import { PHONE_CODES } from '../../utils/phone.js';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    key: <path d="M12 2a9.92 9.92 0 0 0-7 2.82L2.82 7.01a1 1 0 0 0 0 1.42l2.59 2.59a1 1 0 0 0 1.42 0L12 5.34l6.17 6.17a1 1 0 0 0 1.42 0l2.59-2.59a1 1 0 0 0 0-1.42L13 4.83c-.35-.35-.5-.83-.5-1.31A5.5 5.5 0 0 0 12 2z" />,
    layers: <path d="m12 2 10 5-10 5L2 7zm0 10 10 5-10 5-10-5zm0 10 10 5-10 5-10-5z" />,
    eye: <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
    eyeOff: <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12A3 3 0 1 1 9.88 9.88M1 1l22 22" /></>,
    check: <path d="M20 6 9 17l-5-5" />,
    fingerprint: <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4M14 13.12c0 2.38 0 6.38-1 8.88M17.29 21.02c.12-.6.43-2.3.5-3.02M2 12a10 10 0 0 1 18-6M2 16h.01M21.8 16c.2-2 .131-5.354 0-6M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2M8.65 22c.21-.66.45-1.32.57-2M9 6.8a6 6 0 0 1 9 5.2v2" />,
    apple: <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.58,7.86 7.09,6.91 8.65,6.88C9.94,6.86 11.17,7.68 12.06,7.68C12.96,7.68 14.42,6.74 15.95,6.88C16.57,6.91 18.23,7.09 19.3,8.68C19.2,8.74 16.79,10.05 16.83,12.9C16.88,16.24 19.88,17.37 19.92,17.39C19.88,17.47 19.25,19.11 18.71,19.5ZM13.3,5.41C13.98,4.57 14.46,3.4 14.32,2.21C13.28,2.26 12.05,2.88 11.34,3.72C10.7,4.48 10.13,5.65 10.28,6.83C11.44,6.94 12.62,6.26 13.3,5.41Z" fill="currentColor" stroke="none" />,
    faceId: (
      <>
        <path d="M3 7V5a2 2 0 0 1 2-2h2" />
        <path d="M17 3h2a2 2 0 0 1 2 2v2" />
        <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
        <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <path d="M9 9h.01" />
        <path d="M15 9h.01" />
      </>
    ),
  };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

export default function AdminLoginView({ onLogin, onBiometricLogin, onBiometricRegister, onBack, initialPhone = null }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  // "Recordar sesión": mantiene el login al cerrar/reabrir la pestaña.
  const [remember, setRemember] = useState(() => getRememberSession());

  // Login state
  const [loginPhone, setLoginPhone] = useState(() => ({
    code: initialPhone?.code || '0412',
    number: initialPhone?.number || ''
  }));

  // Biometric login state
  const [bioStatus, setBioStatus] = useState('idle'); // 'idle' | 'working' | 'register'
  const [bioError, setBioError] = useState('');
  const [bioOptions, setBioOptions] = useState(null);
  const [bioNeedsRegister, setBioNeedsRegister] = useState(false);
  const bioFetchKeyRef = useRef('');

  // NEW: Detectar si el dispositivo soporta WebAuthn (huella/Face ID)
  // Usamos los mismos checks que en la App principal para consistencia.
  const [webauthnSupported, setWebauthnSupported] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = browserSupportsWebAuthn();
      let platformOk = false;
      if (supported) {
        try { platformOk = await hasRealBiometrics(); } catch { platformOk = false; }
      }
      if (!cancelled) setWebauthnSupported(supported && platformOk);
    })();
    return () => { cancelled = true; };
  }, []);

  // Recovery state

  // Recovery state
  const [recoverMode, setRecoverMode] = useState(false);
  const [recoverStep, setRecoverStep] = useState('phone'); // 'phone' | 'biometric' | 'newpass'
  const [recoverPhone, setRecoverPhone] = useState({ code: '0412', number: '' });
  const [recoverOptions, setRecoverOptions] = useState(null);
  const [biometricResponse, setBiometricResponse] = useState(null);
  const [newPassword, setNewPassword] = useState({ a: '', b: '' });
  const [showNewPassword, setShowNewPassword] = useState({ a: false, b: false });
  const [recoverError, setRecoverError] = useState('');

  // Pre-carga los options de WebAuthn al completar el teléfono para que
  // startAuthentication se llame de forma síncrona en el tap (requisito de iOS
  // para mostrar el prompt de Face ID en lugar de solo la biometría).
  // Solo se hace UN fetch por teléfono: prefetches solapados pisan el challenge
  // en el server y rompen la verificación ("Unexpected authentication response challenge").
  const recoveryFetchKeyRef = useRef('');
  useEffect(() => {
    const valid = recoverMode && recoverStep === 'phone' && /^\d{7}$/.test(recoverPhone.number);
    if (!valid) return undefined;
    const phoneKey = `${recoverPhone.code}${recoverPhone.number}`.replace(/\D/g, '').slice(-11);
    if (recoveryFetchKeyRef.current === phoneKey) return undefined;
    let cancelled = false;
    api
      .webauthnLoginOptions({ phone: phoneKey })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          recoveryFetchKeyRef.current = phoneKey;
          setRecoverOptions(res.data.options);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [recoverMode, recoverStep, recoverPhone.code, recoverPhone.number]);

  // Pre-carga las opciones de biometría del login admin al completar el teléfono.
  // Solo se hace UN fetch por teléfono: prefetches solapados pisan el challenge
  // en el server y rompen la verificación.
  useEffect(() => {
    const valid = !recoverMode && /^\d{7}$/.test(loginPhone.number);
    if (!valid) return undefined;
    const phoneKey = `${loginPhone.code}${loginPhone.number}`.replace(/\D/g, '').slice(-11);
    if (bioFetchKeyRef.current === phoneKey) return undefined;
    let cancelled = false;
    api
      .webauthnLoginOptions({ phone: phoneKey })
      .then((res) => {
        if (cancelled) return;
        bioFetchKeyRef.current = phoneKey;
        if (res.ok) {
          setBioNeedsRegister(false);
          setBioOptions(res.data.options);
        } else if (res.status === 404) {
          // No hay biometría registrada en este dominio: el tap debe REGISTRAR
          // (primera vez en este ambiente) en vez de mostrar "no está lista".
          setBioNeedsRegister(true);
          setBioOptions(null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [recoverMode, loginPhone.code, loginPhone.number]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^\d{7}$/.test(loginPhone.number)) {
      setError('Ingresa tu teléfono de administrador.');
      return;
    }
    if (!password) {
      setError('Ingresa la contraseña de administrador.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const phoneKey = `${loginPhone.code}${loginPhone.number}`.replace(/\D/g, '').slice(-11);
      const ok = await onLogin(phoneKey, password);
      if (!ok) setError('Contraseña incorrecta. Verifica tu teléfono y contraseña.');
    } catch {
      setError('No se pudo conectar con el servidor. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Login admin con biometría (huella/Face ID). El teléfono es obligatorio y
  // la biometría reemplaza la contraseña. Si no hay biometría registrada para
  // ese teléfono en este dominio, se registra en el momento (primera vez).
  const handleBiometricLogin = async () => {
    if (!/^\d{7}$/.test(loginPhone.number)) {
      setError('Ingresa tu teléfono de administrador.');
      return;
    }
    const phoneKey = `${loginPhone.code}${loginPhone.number}`.replace(/\D/g, '').slice(-11);
    setError('');
    setBioError('');
    // Si el prefetch aún no cargó las options, las pedimos ahora en lugar de
    // fallar con "no está lista". Así el tap siempre funciona.
    if (bioFetchKeyRef.current !== phoneKey) {
      try {
        const res = await api.webauthnLoginOptions({ phone: phoneKey });
        if (res.ok) {
          bioFetchKeyRef.current = phoneKey;
          setBioNeedsRegister(false);
          setBioOptions(res.data.options);
        } else if (res.status === 404) {
          bioFetchKeyRef.current = phoneKey;
          setBioNeedsRegister(true);
          setBioOptions(null);
        } else {
          setBioError(`No se pudo iniciar la verificación con ${BIO_METHOD_LABEL}. Intenta de nuevo.`);
          return;
        }
      } catch {
        setBioError('No se pudo conectar con el servidor. Intenta de nuevo.');
        return;
      }
    }
    setBioStatus('working');
    try {
      // Primera vez en este dominio (staging/producción): registra la biometría.
      if (bioNeedsRegister || !bioOptions) {
        setBioStatus('register');
        const rres = await api.webauthnRegisterOptions({ phone: phoneKey, customerName: 'Administrador' });
        if (!rres.ok) throw new Error(rres.data.error || 'No se pudo iniciar el registro');
        const regResponse = await startRegistration({ optionsJSON: rres.data.options });
        const ok = await onBiometricRegister(phoneKey, regResponse);
        if (!ok) setBioError(`No se pudo guardar tu ${BIO_METHOD_LABEL}. Intenta de nuevo.`);
        setBioNeedsRegister(false);
        return;
      }
      const authResponse = await startAuthentication({ optionsJSON: bioOptions });
      const ok = await onBiometricLogin(phoneKey, authResponse);
      if (!ok) setBioError((IS_IOS ? 'Face ID no coincidió' : `La ${BIO_METHOD_LABEL} no coincidió`) + '. Verifica que tu número sea de administrador.');
    } catch (err) {
      // Si la credencial se registró bajo un rpID anterior (dominio distinto),
      // el navegador la rechaza con NotAllowedError. Re-registramos en el rpID
      // actual para que quede válida.
      const isRpidMismatch = err?.name === 'NotAllowedError';
      if (!isRpidMismatch) {
        setBioError(friendlyAuthError(err));
        setBioStatus('idle');
        return;
      }
      try {
        setBioStatus('register');
        const rres = await api.webauthnRegisterOptions({ phone: phoneKey, customerName: 'Administrador' });
        if (!rres.ok) throw new Error(rres.data.error || 'No se pudo iniciar el re-registro');
        const regResponse = await startRegistration({ optionsJSON: rres.data.options });
        const ok = await onBiometricRegister(phoneKey, regResponse);
        if (!ok) setBioError(`No se pudo guardar tu ${BIO_METHOD_LABEL}. Intenta de nuevo.`);
      } catch (regErr) {
        setBioError(friendlyAuthError(regErr));
      }
    } finally {
      setBioStatus('idle');
    }
  };

  const startRecovery = async () => {
    if (!/^\d{7}$/.test(recoverPhone.number)) {
      setRecoverError('Ingresa el número de teléfono de administrador.');
      return;
    }
    const phoneKey = `${recoverPhone.code}${recoverPhone.number}`.replace(/\D/g, '').slice(-11);
    setRecoverError('');
    // Sin biometría (dispositivo sin Face ID/huella): se recupera solo con el
    // teléfono admin, sin verificación biométrica (el server acepta response null).
    if (!webauthnSupported) {
      setBiometricResponse(null);
      setRecoverStep('newpass');
      return;
    }
    // Si el prefetch no terminó, pedimos las options ahora en vez de fallar.
    if (recoveryFetchKeyRef.current !== phoneKey || !recoverOptions) {
      try {
        const res = await api.webauthnLoginOptions({ phone: phoneKey });
        if (!res.ok) {
          // Sin biometría registrada para ese teléfono en este dominio (p.ej.
          // staging): se recupera igual con solo el teléfono admin.
          recoveryFetchKeyRef.current = phoneKey;
          setBiometricResponse(null);
          setRecoverStep('newpass');
          return;
        }
        recoveryFetchKeyRef.current = phoneKey;
        setRecoverOptions(res.data.options);
      } catch {
        setRecoverError('No se pudo conectar con el servidor. Intenta de nuevo.');
        return;
      }
    }
    setRecoverStep('biometric');
    try {
      const authResponse = await startAuthentication({ optionsJSON: recoverOptions });
      setBiometricResponse(authResponse);
      setRecoverStep('newpass');
      setRecoverError('');
    } catch {
      // Si la verificación biométrica falla o se cancela, permitimos continuar
      // igual: el server acepta response null y valida solo el teléfono admin.
      setBiometricResponse(null);
      setRecoverStep('newpass');
      setRecoverError('');
    }
  };

  const submitNewPassword = async () => {
    if (newPassword.a !== newPassword.b) {
      setRecoverError('Las contraseñas no coinciden.');
      return;
    }
    if (newPassword.a.length < 6) {
      setRecoverError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    const phoneKey = `${recoverPhone.code}${recoverPhone.number}`.replace(/\D/g, '').slice(-11);
    setRecoverError('');
    const res = await api.recoverPassword(phoneKey, biometricResponse, newPassword.a);
    if (!res.ok) {
      setRecoverError(res.data.error || 'No se pudo recuperar la contraseña.');
      return;
    }
    setRecoverMode(false);
    setRecoverStep('phone');
    setNewPassword({ a: '', b: '' });
    recoveryFetchKeyRef.current = '';
    setRecoverOptions(null);
    setBiometricResponse(null);
    setRecoverPhone({ code: '0412', number: '' });
    setError('Contraseña restablecida. Ahora puedes iniciar sesión.');
  };

  if (recoverMode) {
    return (
      <div className="py-8 sm:py-16 flex items-center justify-center">
        <div className="w-full max-w-md bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 sm:p-8 shadow-2xl backdrop-blur-md space-y-6">
          <div className="text-center space-y-2">
            <span className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <Icon name="key" className="w-7 h-7" />
            </span>
            <h2 className="text-xl font-black text-white">Recuperar Contraseña</h2>
            <p className="text-xs text-slate-400">Ingresa tu teléfono de administrador y crea una nueva contraseña.</p>
          </div>

          {recoverStep === 'phone' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Teléfono de administrador</label>
                <div className="flex gap-2">
                  <select
                    value={recoverPhone.code}
                    onChange={(e) => setRecoverPhone({ ...recoverPhone, code: e.target.value })}
                    className="w-24 shrink-0 px-3 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm font-bold focus:border-amber-500 focus:outline-none"
                  >
                    {PHONE_CODES.map((code) => (<option key={code} value={code}>{code}</option>))}
                  </select>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={recoverPhone.number}
                    onChange={(e) => setRecoverPhone({ ...recoverPhone, number: e.target.value.replace(/\D/g, '').slice(0, 7) })}
                    placeholder="1234567"
                    maxLength={7}
                    className="w-full px-4 py-3 glass-strong bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              {recoverError && <p className="text-xs text-rose-400 mt-2">{recoverError}</p>}
              <button
                onClick={startRecovery}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-bold text-sm hover:from-amber-400 hover:to-rose-400 shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                Continuar
              </button>
            </div>
          )}

          {recoverStep === 'biometric' && (
            <div className="text-center space-y-3">
              <p className="text-xs text-slate-400">Esperando {IS_IOS ? 'tu Face ID' : IS_ANDROID ? 'tu huella' : 'la verificación biométrica'}...</p>
            </div>
          )}

          {recoverStep === 'newpass' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nueva contraseña</label>
                <div className="relative">
                  <input
                    type={showNewPassword.a ? 'text' : 'password'}
                    value={newPassword.a}
                    onChange={(e) => setNewPassword({ ...newPassword, a: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-4 py-3 pr-11 glass-strong bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((s) => ({ ...s, a: !s.a }))}
                    aria-label={showNewPassword.a ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-100 transition-colors"
                  >
                    <Icon name={showNewPassword.a ? 'eyeOff' : 'eye'} className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Repetir contraseña</label>
                <div className="relative">
                  <input
                    type={showNewPassword.b ? 'text' : 'password'}
                    value={newPassword.b}
                    onChange={(e) => setNewPassword({ ...newPassword, b: e.target.value })}
                    placeholder="Repite la contraseña"
                    className="w-full px-4 py-3 pr-11 glass-strong bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((s) => ({ ...s, b: !s.b }))}
                    aria-label={showNewPassword.b ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-100 transition-colors"
                  >
                    <Icon name={showNewPassword.b ? 'eyeOff' : 'eye'} className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {recoverError && <p className="text-xs text-rose-400 mt-2">{recoverError}</p>}
              <button
                onClick={submitNewPassword}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-bold text-sm hover:from-amber-400 hover:to-rose-400 shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                Guardar nueva contraseña
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => { setRecoverMode(false); setRecoverStep('phone'); setRecoverError(''); setNewPassword({ a: '', b: '' }); recoveryFetchKeyRef.current = ''; setRecoverOptions(null); setBiometricResponse(null); setRecoverPhone({ code: '0412', number: '' }); }}
            className="w-full py-2 text-xs text-slate-400 hover:text-white transition-colors"
          >
            ← Volver al login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 sm:py-16 flex items-center justify-center">
      <div className="w-full max-w-md bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 sm:p-8 shadow-2xl backdrop-blur-md space-y-6">
        <div className="text-center space-y-2">
          <span className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-cyan-500/20">
            <Icon name="layers" className="w-7 h-7" />
          </span>
          <h2 className="text-xl font-black text-white">Acceso al Panel Admin</h2>
          <p className="text-xs text-slate-400">Inicia sesión con tu contraseña o {BIO_METHOD_LABEL} para gestionar inventario y pedidos.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Teléfono de administrador</label>
            <div className="flex gap-2">
              <select
                value={loginPhone.code}
                onChange={(e) => setLoginPhone({ ...loginPhone, code: e.target.value })}
                className="w-24 shrink-0 px-3 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm font-bold focus:border-cyan-500 focus:outline-none"
              >
                {PHONE_CODES.map((code) => (<option key={code} value={code}>{code}</option>))}
              </select>
              <input
                type="tel"
                inputMode="numeric"
                value={loginPhone.number}
                onChange={(e) => setLoginPhone({ ...loginPhone, number: e.target.value.replace(/\D/g, '').slice(0, 7) })}
                placeholder="1234567"
                maxLength={7}
                className="w-full px-4 py-3 glass-strong bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-cyan-500 focus:outline-none"
              />
            </div>
            {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
            {bioError && <p className="text-xs text-rose-400 mt-2">{bioError}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 pr-11 glass-strong bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-cyan-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-100 transition-colors"
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} className="w-5 h-5" />
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => {
                setRemember(e.target.checked);
                setRememberSession(e.target.checked);
              }}
              className="w-4 h-4 rounded accent-cyan-500"
            />
            <span className="text-xs text-slate-300 font-semibold">Recordar sesión en este dispositivo</span>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-bold text-sm hover:from-cyan-400 hover:to-blue-400 shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60"
          >
            <Icon name="check" className="w-4 h-4" />
            {isSubmitting ? 'Verificando...' : 'Iniciar sesión'}
          </button>

          {/* Biometría: debajo de Iniciar sesión, sin separador */}
          {webauthnSupported && (
            <button
              type="button"
              onClick={handleBiometricLogin}
              disabled={isSubmitting || bioStatus === 'working' || bioStatus === 'register'}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl bg-slate-800/70 border border-cyan-500/30 hover:border-cyan-400/60 hover:bg-slate-700/60 text-slate-200 transition-all disabled:opacity-60"
            >
              {bioStatus === 'working' || bioStatus === 'register' ? (
                <>
                  {IS_IOS ? <Icon name="apple" className="w-5 h-5" /> : <Icon name="fingerprint" className="w-5 h-5" />}
                  <span>{bioStatus === 'working' ? 'Esperando...' : 'Registrando...'}</span>
                </>
              ) : IS_IOS ? (
                <>
                  <Icon name="apple" className="w-5 h-5" />
                  <Icon name="faceId" className="w-5 h-5" />
                  <span className="font-semibold">Entrar con Face ID</span>
                </>
              ) : (
                <>
                  <Icon name="fingerprint" className="w-6 h-6" />
                  <span className="font-semibold">Entrar con huella</span>
                </>
              )}
            </button>
          )}
        </form>

        <div className="pt-2 border-t border-slate-800 space-y-2">
          <button
            type="button"
            onClick={() => setRecoverMode(true)}
            className="w-full py-2 text-xs text-amber-300 hover:text-amber-200 hover:bg-slate-800/60 rounded-xl transition-all flex items-center justify-center gap-1.5"
          >
            <Icon name="key" className="w-3.5 h-3.5" />
            ¿Olvidaste tu contraseña? Recuperar con {BIO_METHOD_LABEL}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="w-full py-2 text-xs text-slate-400 hover:text-white transition-colors"
          >
            ← Volver a la tienda
          </button>
        </div>
      </div>
    </div>
  );
}
