import { useState, useEffect, useRef } from 'react';
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { api } from '../../api.js';
import { IS_IOS, BIO_METHOD_LABEL, friendlyAuthError } from '../../utils/bio.js';
import { PHONE_CODES, normalizePhoneDigits } from '../../utils/phone.js';
import { loadLoginMemory, saveLoginMemory, clearLoginMemory } from '../../utils/storage.js';
import { hasRealBiometrics } from '../../utils/pwa.js';
import { useOverlay } from '../../hooks/overlay.js';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    x: <path d="M18 6 6 18M6 6l12 12" />,
    user: <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
    logOut: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
    check: <polyline points="20 6 9 17 4 12" />,
    apple: <path d="M12 2c3 0 5.5 2 7.5 5-2-1-4-1.5-6-1.5S7.5 6 5.5 7C6.5 4.8 8.5 3 11 3l1-1z" />,
    faceId: <><path d="M9 3H5a2 2 0 0 0-2 2v4M15 3h4a2 2 0 0 1 2 2v4M9 21H5a2 2 0 0 1-2-2v-4M15 21h4a2 2 0 0 0 2-2v-4" /><circle cx="9" cy="10" r="0.5" fill="currentColor" /><circle cx="15" cy="10" r="0.5" fill="currentColor" /></>,
    fingerprint: <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4M14 13.12c0 2.38 0 6.38-1 8.88M17.25 8.04c.26.63.4 1.31.4 2.02 0 3.17-1.29 5.97-3.25 7.96M2 12a10 10 0 0 1 18-6M2 16h.01M22 16h.01" />,
    arrowRight: <path d="M5 12h14M12 5l7 7-7 7" />,
    minus: <path d="M5 12h14" />,
    plus: <path d="M12 5v14M5 12h14" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

export default function IdentityModal({ knownCustomers, allCustomers, savedCustomer, onConfirm, onConfirmBiometric, mode = 'login', confirmKind = 'switchback', onClose }) {
  useOverlay(true, onClose);
  const [customerName, setCustomerName] = useState('');
  const [phoneCode, setPhoneCode] = useState('0412');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [errors, setErrors] = useState({});
  const [isWorking, setIsWorking] = useState(false);
  const [step, setStep] = useState('form');
  const [webAuthnStep, setWebAuthnStep] = useState('');
  const [webauthnError, setWebauthnError] = useState('');
  const [webauthnSupported, setWebauthnSupported] = useState(true);
  const [registerMode, setRegisterMode] = useState(false);
  const [remember, setRemember] = useState(false);
  const [panel, setPanel] = useState(mode === 'confirm' ? 'confirm' : 'login');
  const [confirmKindState, setConfirmKindState] = useState(confirmKind);

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

  useEffect(() => {
    const mem = loadLoginMemory();
    if (mem) {
      setCustomerName(mem.customerName || '');
      setPhoneCode(mem.phoneCode || '0412');
      setPhoneNumber(mem.phoneNumber || '');
      setRemember(true);
    }
  }, []);

  const phoneKey = `${phoneCode}${phoneNumber}`.replace(/\D/g, '').slice(-11);
  const nameRef = useRef('');
  useEffect(() => { nameRef.current = customerName; }, [customerName]);
  useEffect(() => {
    if (phoneNumber.length < 7) return;
    let cancelled = false;
    const applyName = (n) => { if (n && !nameRef.current.trim()) setCustomerName(n); };
    const local = [
      ...(knownCustomers || []),
      ...(allCustomers || []).map((c) => ({ phone: c.phone, name: c.customerName || c.name }))
    ].find((c) => normalizePhoneDigits(c.phone) === phoneKey);
    if (local && local.name) { applyName(local.name); return; }
    api.getCustomer(phoneKey).then((res) => {
      if (cancelled) return;
      const n = res && res.ok && res.data ? res.data.customerName : '';
      applyName(n);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [phoneCode, phoneNumber, knownCustomers, allCustomers]);

  const handlePhoneNumber = (value) => { setPhoneNumber(value.replace(/\D/g, '').slice(0, 7)); };

  const toggleRemember = (on) => {
    setRemember(on);
    if (on) saveLoginMemory({ customerName: customerName.trim(), phoneCode, phoneNumber });
    else clearLoginMemory();
  };

  const persistRemember = () => {
    if (remember) saveLoginMemory({ customerName: customerName.trim(), phoneCode, phoneNumber });
    else clearLoginMemory();
  };

  const hasRegisteredBiometry = async (phoneKey) => {
    const res = await api.webauthnLoginOptions({ phone: phoneKey });
    if (res.ok) return true;
    if (res.status === 404) return false;
    throw new Error(res.data.error || 'No se pudo consultar tu registro biometrico');
  };

  const registerBiometry = async (phoneKey, customerName) => {
    setWebAuthnStep('register');
    const res = await api.webauthnRegisterOptions({ phone: phoneKey, customerName: customerName.trim() });
    if (!res.ok) throw new Error(res.data.error || 'No se pudo iniciar el registro');
    const regResponse = await startRegistration({ optionsJSON: res.data.options });
    const verifyRes = await api.webauthnRegisterVerify({ phone: phoneKey, response: regResponse });
    if (!verifyRes.ok) throw new Error(verifyRes.data.error || `No se pudo guardar tu ${BIO_METHOD_LABEL}`);
  };

  const authenticateWithBiometry = async ({ phoneKey, customerName }) => {
    const hasBio = await hasRegisteredBiometry(phoneKey);
    if (hasBio) {
      setWebAuthnStep('login');
      const res = await api.webauthnLoginOptions({ phone: phoneKey });
      if (!res.ok) throw new Error(res.data.error || 'No se pudo iniciar la verificacion');
      try {
        const authResponse = await startAuthentication({ optionsJSON: res.data.options });
        const verifyRes = await api.webauthnLoginVerify({ phone: phoneKey, response: authResponse });
        if (!verifyRes.ok) throw new Error(verifyRes.data.error || (IS_IOS ? 'Face ID no coincidio' : 'La huella no coincidio'));
      } catch (authErr) {
        const isRpidMismatch = authErr?.name === 'NotAllowedError';
        if (!isRpidMismatch) throw authErr;
        await registerBiometry(phoneKey, customerName);
      }
    } else {
      await registerBiometry(phoneKey, customerName);
    }
  };

  const runWebAuthn = async () => {
    setWebauthnError('');
    if (phoneKey.length >= 7) {
      try {
        const existing = await api.getCustomer(phoneKey);
        if (existing.ok && existing.data && existing.data.disabled) {
          setWebauthnError('Tu cuenta esta inhabilitada por el kiosko. Contacta la tienda.');
          return;
        }
      } catch {}
    }
    if (!webauthnSupported) {
      persistRemember();
      onConfirm({ customerName: customerName.trim(), phoneCode, phoneNumber });
      return;
    }
    setStep('webauthn');
    setIsWorking(true);
    try {
      await authenticateWithBiometry({ phoneKey, customerName });
      setIsWorking(false);
      persistRemember();
      onConfirm({ customerName: customerName.trim(), phoneCode, phoneNumber });
    } catch (err) {
      setIsWorking(false);
      setWebauthnError(friendlyAuthError(err));
      setStep('form');
    }
  };

  const handleBiometricAction = () => {
    if (!/^\d{7}$/.test(phoneNumber)) {
      setErrors((prev) => ({ ...prev, phone: `Ingresa los 7 digitos del numero para verificar con ${BIO_METHOD_LABEL}` }));
      return;
    }
    runWebAuthn();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!customerName.trim()) newErrors.customerName = 'Ingresa tu nombre';
    if (!/^\d{7}$/.test(phoneNumber)) newErrors.phone = 'Ingresa los 7 digitos del numero';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    await runWebAuthn();
  };

  const handleConfirmBiometric = async () => {
    const phone = savedCustomer?.phoneNumber || phoneNumber;
    const code = savedCustomer?.phoneCode || phoneCode;
    const name = savedCustomer?.customerName || customerName.trim();
    if (!/^\d{7}$/.test(phone)) { setWebauthnError('No hay un usuario activo para confirmar.'); return; }
    setWebauthnError('');
    if (!webauthnSupported) { onConfirmBiometric(confirmKindState); return; }
    setStep('webauthn');
    setIsWorking(true);
    const confirmKey = `${code}${phone}`.replace(/\D/g, '').slice(-11);
    try {
      await authenticateWithBiometry({ phoneKey: confirmKey, customerName: name });
      setIsWorking(false);
      onConfirmBiometric(confirmKindState);
    } catch (err) {
      setIsWorking(false);
      setWebauthnError(friendlyAuthError(err));
      setStep('form');
    }
  };

  const resetForm = () => { setStep('form'); setWebAuthnStep(''); setWebauthnError(''); };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
      <div className="relative w-full sm:max-w-md glass-strong bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden z-10 animate-screen-up max-h-[92vh] overflow-y-auto">
        <div className="relative pt-[max(1.25rem,env(safe-area-inset-top))] p-5 sm:p-7 border-b border-slate-800 text-center">
          {(savedCustomer?.customerName || panel === 'confirm') && (
            <button type="button" onClick={onClose} aria-label="Cerrar"
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
              <Icon name="x" className="w-5 h-5" />
            </button>
          )}
          <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-slate-950 shadow-lg shadow-teal-500/25">
            <Icon name={panel === 'confirm' && confirmKindState === 'logout' ? 'logOut' : 'user'} className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <h2 className="text-lg sm:text-xl font-black text-white mt-3">
            {panel === 'confirm'
              ? confirmKindState === 'logout' ? 'Cerrar sesion' : `Volver a ${savedCustomer?.customerName?.split(' ')[0] || 'tu cuenta'}`
              : registerMode ? 'Crea tu cuenta'
              : savedCustomer?.customerName ? 'Cambiar de usuario'
              : 'Bienvenido a Empresas Alvarados'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {panel === 'confirm'
              ? `Confirma tu identidad con ${BIO_METHOD_LABEL} para continuar.`
              : registerMode
              ? `Registrate en segundos con tu telefono y ${BIO_METHOD_LABEL}. El nombre se autocompleta en tus proximos accesos.`
              : `Identificate para pedir. Tu telefono + ${BIO_METHOD_LABEL} es tu tarjeta de cliente.`}
          </p>
        </div>

        {panel === 'confirm' ? (
          step === 'form' ? (
            <div className="p-5 sm:p-7 space-y-4">
              <button type="button" onClick={handleConfirmBiometric} disabled={isWorking}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-slate-800/70 border border-teal-500/30 hover:border-teal-400/60 hover:bg-slate-700/60 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                <span className="p-2 rounded-xl bg-teal-500/20 text-teal-400 shrink-0">
                  {IS_IOS ? (
                    <span className="flex items-center gap-1">
                      <Icon name="apple" className="w-4 h-4" />
                      <Icon name="faceId" className="w-4 h-4" />
                    </span>
                  ) : <Icon name="fingerprint" className="w-5 h-5" />}
                </span>
                <span className="flex-1 text-left">
                  <span className="block text-[11px] font-bold text-teal-300">
                    {webauthnSupported ? `Confirmar con ${BIO_METHOD_LABEL}` : 'Continuar sin biometria'}
                  </span>
                  <span className="block text-[11px] text-slate-400 leading-snug">
                    {!webauthnSupported ? `Tu dispositivo no tiene ${BIO_METHOD_LABEL}. Podes continuar igual.` : IS_IOS ? 'Usa tu Face ID' : 'Usa tu huella'}
                  </span>
                </span>
                <Icon name="arrowRight" className="w-4 h-4 text-teal-400 shrink-0" />
              </button>
              {webauthnError && <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5">{webauthnError}</p>}
              {confirmKindState === 'logout' && (
                <button type="button" onClick={() => onConfirmBiometric('logout')}
                  className="w-full py-2 text-[11px] text-slate-500 hover:text-rose-300 transition-colors">
                  Prefiero salir sin biometria
                </button>
              )}
            </div>
          ) : (
            <div className="p-8 sm:p-10 flex flex-col items-center text-center space-y-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-slate-950 shadow-xl shadow-teal-500/30 animate-pulse">
                  <Icon name={webAuthnStep === 'login' ? 'user' : 'check'} className="w-10 h-10" />
                </div>
                <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-4 border-slate-900 flex items-center justify-center">
                  <Icon name="check" className="w-3 h-3 text-slate-950" />
                </span>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {webAuthnStep === 'login' ? 'Confirma tu identidad' : `Registra tu ${BIO_METHOD_LABEL}`}
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {webAuthnStep === 'login' ? 'Usa tu huella o Face ID para confirmar que eres tu.'
                    : 'Usa tu huella o Face ID una vez. La proxima vez te reconoceremos al instante.'}
                </p>
              </div>
              <button type="button" onClick={resetForm} disabled={isWorking}
                className="text-xs text-slate-500 hover:text-teal-300 transition-colors disabled:opacity-50">
                Cancelar
              </button>
            </div>
          )
        ) : step === 'form' ? (
          <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Telefono / WhatsApp *</label>
              <div className="flex gap-2">
                <select value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)}
                  className="w-24 shrink-0 px-3 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm font-bold focus:border-teal-500 focus:outline-none">
                  {PHONE_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
                <input type="tel" inputMode="numeric" value={phoneNumber} onChange={(e) => handlePhoneNumber(e.target.value)}
                  placeholder="1234567" maxLength={7} autoFocus={!savedCustomer?.customerName}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none" />
              </div>
              {errors.phone && <p className="text-xs text-rose-400 mt-1">{errors.phone}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Tu Nombre *</label>
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ej: Juan Perez"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none" />
              {errors.customerName && <p className="text-xs text-rose-400 mt-1">{errors.customerName}</p>}
            </div>
            <button type="button" onClick={() => toggleRemember(!remember)}
              className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-800/50 border border-slate-700/70 hover:border-teal-500/40 transition-all">
              <span className="flex items-center gap-2.5">
                <span className={`p-1.5 rounded-lg transition-all ${remember ? 'bg-teal-500/25 text-teal-400' : 'bg-slate-700/50 text-slate-500'}`}>
                  <Icon name="check" className="w-3.5 h-3.5" />
                </span>
                <span className="text-left">
                  <span className="block text-xs font-semibold text-slate-200">Recordarme</span>
                  <span className="block text-[10px] text-slate-500">Conservo estos datos para tu proxima visita</span>
                </span>
              </span>
              <span className={`relative w-11 h-6 rounded-full transition-all shrink-0 ${remember ? 'bg-teal-500' : 'bg-slate-700'}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${remember ? 'left-5' : 'left-0.5'}`} />
              </span>
            </button>
            <button type="button" onClick={handleBiometricAction} disabled={isWorking}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-slate-800/70 border border-teal-500/30 hover:border-teal-400/60 hover:bg-slate-700/60 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
              <span className="p-2 rounded-xl bg-teal-500/20 text-teal-400 shrink-0">
                {IS_IOS ? (
                  <span className="flex items-center gap-1">
                    <Icon name="apple" className="w-4 h-4" />
                    <Icon name="faceId" className="w-4 h-4" />
                  </span>
                ) : <Icon name="fingerprint" className="w-5 h-5" />}
              </span>
              <span className="flex-1 text-left">
                <span className="block text-[11px] font-bold text-teal-300">Verificar con {BIO_METHOD_LABEL}</span>
                <span className="block text-[11px] text-slate-400 leading-snug">
                  {!webauthnSupported ? `Tu dispositivo no tiene ${BIO_METHOD_LABEL}. Podes entrar con tu telefono y nombre.` : IS_IOS ? 'Usa tu Face ID' : 'Usa tu huella'}
                </span>
              </span>
              <Icon name="arrowRight" className="w-4 h-4 text-teal-400 shrink-0" />
            </button>
            {webauthnError && <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5">{webauthnError}</p>}
            <div className="space-y-2.5 pt-1">
              <button type="submit" disabled={isWorking}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-sm hover:from-teal-400 hover:to-emerald-400 shadow-xl shadow-teal-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                <Icon name="check" className="w-4 h-4" />
                {registerMode ? 'Crear mi cuenta' : 'Entrar a Empresas Alvarados'}
              </button>
              {registerMode ? (
                <button type="button" onClick={() => setRegisterMode(false)}
                  className="w-full py-2.5 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-700/70 transition-all">
                  Ya tienes cuenta? Iniciar sesion
                </button>
              ) : (
                <button type="button" onClick={() => setRegisterMode(true)}
                  className="w-full py-2.5 rounded-2xl bg-slate-800 border border-slate-700 text-teal-300 text-xs font-semibold hover:bg-slate-700/70 transition-all">
                  Primera vez? Registrate
                </button>
              )}
              {savedCustomer?.customerName && (
                <button type="button" onClick={() => { setConfirmKindState('switchback'); setPanel('confirm'); }}
                  className="w-full py-2.5 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-700/70 transition-all">
                  Volver a {savedCustomer.customerName.split(' ')[0]}
                </button>
              )}
            </div>
          </form>
        ) : (
          <div className="p-8 sm:p-10 flex flex-col items-center text-center space-y-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-slate-950 shadow-xl shadow-teal-500/30 animate-pulse">
                {webAuthnStep === 'login' ? <Icon name="user" className="w-10 h-10" /> : <Icon name="check" className="w-10 h-10" />}
              </div>
              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-4 border-slate-900 flex items-center justify-center">
                <Icon name="check" className="w-3 h-3 text-slate-950" />
              </span>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {webAuthnStep === 'login' ? 'Confirma tu identidad' : `Registra tu ${BIO_METHOD_LABEL}`}
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {webAuthnStep === 'login' ? 'Usa tu huella o Face ID para confirmar que eres tu.'
                  : 'Usa tu huella o Face ID una vez. La proxima vez te reconoceremos al instante.'}
              </p>
            </div>
            <button type="button" onClick={resetForm} disabled={isWorking}
              className="text-xs text-slate-500 hover:text-teal-300 transition-colors disabled:opacity-50">
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
