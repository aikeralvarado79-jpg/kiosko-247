import { useState, useEffect, useMemo } from 'react';
import { api } from '../../api.js';
import { useOverlay } from '../../hooks/overlay.js';
import { PHONE_CODES } from '../../utils/phone.js';
import { formatUsd, formatBs, usdToBs } from '../../utils/format.js';
import { compressImage } from '../../utils/image.js';
import ProductImg from '../ui/ProductImg.jsx';
import Money from '../ui/Money.jsx';
import MapPickerModal from './MapPickerModal.jsx';

const Icon = ({ name, className = 'w-5 h-5', ...props }) => {
  const icons = {
    x: <path d="M18 6 6 18M6 6l12 12" />,
    user: <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
    store: <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4M2 7h20M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7" />,
    mapPin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
    check: <polyline points="20 6 9 17 4 12" />,
    cash: <><rect width="20" height="12" x="2" y="6" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" /></>,
    smartphone: <><rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" /></>,
    bank: <path d="M2 10h20M4 6h16M6 14h12M4 10v8M20 10v8M12 10v8M8 14v4M16 14v4" />,
    wallet: <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a3 3 0 0 0-3-3h-3" />,
    creditCard: <><rect width="20" height="14" x="2" y="5" rx="2" /><path d="M2 10h20" /></>,
    upload: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />,
    alertTriangle: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4M12 17h.01" /></>,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

export default function CheckoutModal({ onClose, cart, cartTotal, rate, isPlacingOrder, onSubmit, savedCustomer, knownCustomers, allCustomers, onSaveCustomer, customerProfile, onSaveAddress, addToast, paymentConfig, holdDeadline }) {
  const [nowMs, setNowMs] = useState(Date.now());

  useOverlay(true, onClose);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const holdLeft = holdDeadline ? Math.max(0, holdDeadline - nowMs) : 0;
  const holdMin = Math.floor(holdLeft / 60000);
  const holdSec = Math.floor((holdLeft % 60000) / 1000);

  const [formData, setFormData] = useState({
    customerName: savedCustomer?.customerName || '',
    phoneCode: savedCustomer?.phoneCode || '0412',
    phoneNumber: savedCustomer?.phoneNumber || '',
    type: savedCustomer?.type || 'pickup',
    address: savedCustomer?.address || '',
    notes: '',
    credit: false,
    lat: null,
    lng: null,
    mapAddress: null,
    paymentMethod: 'efectivo',
    paymentReference: '',
    paymentProof: null,
    restPaymentMethod: '',
    walletApplied: 0
  });

  const walletAvailable = customerProfile && Number(customerProfile.balance) < 0 ? Math.abs(Number(customerProfile.balance)) : 0;

  const [errors, setErrors] = useState({});
  const [showPhoneSuggestions, setShowPhoneSuggestions] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');
  const [showMapPicker, setShowMapPicker] = useState(false);

  const getGeoPermission = () =>
    navigator.permissions && navigator.permissions.query
      ? navigator.permissions.query({ name: 'geolocation' })
      : null;

  const handleUseMyLocation = async () => {
    setLocError('');
    if (!navigator.geolocation) {
      setLocError('Tu navegador no soporta geolocalizacion. Ingresa la direccion manualmente.');
      addToast('Tu navegador no soporta geolocalizacion', 'error');
      return;
    }
    try {
      const perm = getGeoPermission();
      if (perm) {
        const state = await perm;
        if (state && state.state === 'denied') {
          setLocError('El navegador tiene la ubicacion bloqueada. Para que pregunte de nuevo, activa el permiso de ubicacion para este sitio en los ajustes del navegador (icono del candado junto a la URL) y recarga la pagina.');
          addToast('Permiso de ubicacion bloqueado en el navegador', 'error');
          return;
        }
      }
    } catch {}
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({ ...prev, lat: pos.coords.latitude, lng: pos.coords.longitude }));
        setLocating(false);
        addToast('Ubicacion capturada. La entrega se hara en este punto.', 'success');
      },
      (err) => {
        setLocating(false);
        const denied = err && err.code === 1;
        const msg = denied
          ? 'Permiso de ubicacion denegado. Activalo en los ajustes del navegador (candado junto a la URL) y recarga, o ingresa la direccion manualmente.'
          : 'No se pudo obtener la ubicacion. Ingresa la direccion manualmente.';
        setLocError(msg);
        addToast(msg, 'error');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  const phoneSuggestions = useMemo(() => {
    if (formData.phoneNumber.length < 3) return [];
    const q = formData.phoneNumber;
    const known = (knownCustomers || []).filter((c) => (c.number || '').startsWith(q));
    const server = (allCustomers || [])
      .map((c) => ({ name: c.customerName || c.name || '', code: String(c.phone || '').slice(0, 4), number: String(c.phone || '').slice(-7), address: Array.isArray(c.addresses) && c.addresses[0] ? c.addresses[0] : '' }))
      .filter((c) => c.number.startsWith(q));
    const extra = server.filter((s) => !known.some((k) => k.number === s.number));
    return [...known, ...extra].slice(0, 3);
  }, [knownCustomers, allCustomers, formData.phoneNumber]);

  useEffect(() => {
    if (formData.phoneNumber.length !== 7 || formData.customerName.trim()) return;
    let cancelled = false;
    const phoneDigits = `${formData.phoneCode}${formData.phoneNumber}`.replace(/\D/g, '').slice(-11);
    api.getCustomer(phoneDigits).then((res) => {
      if (cancelled) return;
      const n = res && res.ok && res.data ? res.data.customerName : '';
      if (n) setFormData((prev) => (prev.customerName.trim() ? prev : { ...prev, customerName: n }));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [formData.phoneCode, formData.phoneNumber]);

  const applyCustomer = (customer) => {
    setFormData((prev) => ({ ...prev, customerName: customer.name || prev.customerName, phoneCode: customer.code || prev.phoneCode, phoneNumber: customer.number || prev.phoneNumber, address: customer.address || prev.address }));
    setShowPhoneSuggestions(false);
    if (customer.address) setFormData((prev) => ({ ...prev, type: 'delivery' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.customerName.trim()) newErrors.customerName = 'Ingresa tu nombre completo';
    if (!/^\d{7}$/.test(formData.phoneNumber)) newErrors.phone = 'Ingresa los 7 digitos del numero';
    if (formData.type === 'delivery' && !formData.address.trim() && (formData.lat == null || formData.lng == null)) {
      newErrors.address = 'Ingresa la direccion o comparte tu ubicacion';
    }
    if (!formData.credit && formData.paymentMethod && formData.paymentMethod !== 'efectivo' && formData.paymentMethod !== 'cartera' && !formData.paymentProof) {
      newErrors.payment = 'Adjunta el comprobante del pago (foto de la transferencia o pago movil)';
    }
    if (!formData.credit && formData.paymentMethod === 'cartera' && walletAvailable < cartTotal) {
      if (!formData.restPaymentMethod) newErrors.payment = 'Tu cartera no cubre todo: elige con que metodo pagas el resto';
      else if (formData.restPaymentMethod !== 'efectivo' && !formData.paymentProof) newErrors.payment = 'Adjunta el comprobante del pago del resto';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isPlacingOrder) return;
    if (/^\d{7}$/.test(formData.phoneNumber)) {
      const phoneDigits = `${formData.phoneCode}${formData.phoneNumber}`.replace(/\D/g, '').slice(-11);
      try {
        const existing = await api.getCustomer(phoneDigits);
        if (existing.ok && existing.data && existing.data.disabled) { setErrors({ phone: 'Tu cuenta esta inhabilitada por el kiosko. Contacta la tienda.' }); return; }
      } catch {}
    }
    if (validate()) {
      let paymentMethod = formData.paymentMethod;
      let walletApplied = 0;
      if (formData.paymentMethod === 'cartera' && walletAvailable > 0) {
        walletApplied = Math.min(walletAvailable, cartTotal);
        paymentMethod = walletApplied >= cartTotal ? 'cartera' : formData.restPaymentMethod || 'efectivo';
      }
      const full = { ...formData, paymentMethod, walletApplied, phone: `${formData.phoneCode} ${formData.phoneNumber}` };
      if (onSaveCustomer) onSaveCustomer({ customerName: formData.customerName, phoneCode: formData.phoneCode, phoneNumber: formData.phoneNumber, address: formData.address || '', type: formData.type });
      onSubmit(full);
    }
  };

  const handlePhoneNumber = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 7);
    setFormData({ ...formData, phoneNumber: digits });
    setShowPhoneSuggestions(digits.length >= 3);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] glass-strong bg-slate-900 border border-slate-700 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-screen-up flex flex-col">
        <div className="sm:hidden absolute top-2.5 left-1/2 -translate-x-1/2 z-20 w-12 h-1.5 rounded-full bg-slate-700" />

        <div className="pt-[max(1rem,env(safe-area-inset-top))] p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Finalizar Pedido</h2>
            {holdLeft > 0 && (
              <p className={`text-[11px] font-bold mt-0.5 ${holdLeft <= 60000 ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`}>
                Reserva por {holdMin}:{String(holdSec).padStart(2, '0')} para completar el pago
              </p>
            )}
            {savedCustomer?.customerName ? (
              <p className="text-xs text-teal-400 mt-0.5 flex items-center gap-1">
                <Icon name="user" className="w-3 h-3" />
                Hola de nuevo, {savedCustomer.customerName.split(' ')[0]}! Tus datos ya estan listos.
              </p>
            ) : (
              <p className="text-xs text-slate-400 mt-0.5">Completa tus datos para enviarlo a la tienda</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 sm:px-6 pt-4 sm:pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4 sm:space-y-5 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-2 gap-2 sm:gap-3 p-1 sm:p-1.5 rounded-2xl bg-slate-800 border border-slate-700">
            <button type="button" onClick={() => setFormData({ ...formData, type: 'pickup' })}
              className={`py-2.5 sm:py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${formData.type === 'pickup' ? 'bg-teal-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}>
              <Icon name="store" className="w-4 h-4" />Retiro en Tienda
            </button>
            <button type="button" onClick={() => setFormData({ ...formData, type: 'delivery' })}
              className={`py-2.5 sm:py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${formData.type === 'delivery' ? 'bg-teal-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}>
              <Icon name="mapPin" className="w-4 h-4" />Envio a Domicilio
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre y Apellido *</label>
              <input type="text" value={formData.customerName} onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="Ej: Juan Perez"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none" />
              {errors.customerName && <p className="text-xs text-rose-400 mt-1">{errors.customerName}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Telefono / WhatsApp *</label>
              <div className="flex gap-2">
                <select value={formData.phoneCode} onChange={(e) => setFormData({ ...formData, phoneCode: e.target.value })}
                  className="w-24 shrink-0 px-3 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm font-bold focus:border-teal-500 focus:outline-none">
                  {PHONE_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
                <input type="tel" inputMode="numeric" value={formData.phoneNumber} onChange={(e) => handlePhoneNumber(e.target.value)}
                  onBlur={() => setTimeout(() => setShowPhoneSuggestions(false), 150)} placeholder="1234567" maxLength={7}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none" />
              </div>
              {showPhoneSuggestions && phoneSuggestions.length > 0 && (
                <div className="mt-2 space-y-1.5 animate-fade-in">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Clientes conocidos — toca para autocompletar</p>
                  {phoneSuggestions.map((c) => (
                    <button key={c.phone} type="button" onMouseDown={(e) => { e.preventDefault(); applyCustomer(c); }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-slate-800 border border-teal-500/30 hover:border-teal-400/60 hover:bg-slate-700/60 transition-all text-left">
                      <span className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400 shrink-0"><Icon name="user" className="w-3.5 h-3.5" /></span>
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-white truncate">{c.name}</span>
                        <span className="block text-[10px] text-slate-400 truncate">{c.code} {c.number}{c.address ? ` · ${c.address}` : ''}</span>
                      </span>
                      <Icon name="arrowRight" className="w-3.5 h-3.5 text-teal-400 shrink-0 ml-auto" />
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-slate-500 mt-1">Codigo movil + 7 digitos (ej: {formData.phoneCode} 1234567)</p>
              {errors.phone && <p className="text-xs text-rose-400 mt-1">{errors.phone}</p>}
            </div>

            {formData.type === 'delivery' && (
              <div className="animate-fade-in space-y-2">
                {customerProfile?.addresses?.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300 mb-0.5">Tus direcciones guardadas</label>
                    <div className="flex flex-wrap gap-1.5">
                      {customerProfile.addresses.map((addr) => (
                        <button key={addr} type="button" onClick={() => setFormData((prev) => ({ ...prev, address: addr }))}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all text-left ${formData.address === addr ? 'bg-teal-500/20 text-teal-300 border-teal-500/50' : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-teal-500/40'}`}>
                          {addr}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Direccion de Entrega</label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button type="button" onClick={handleUseMyLocation} disabled={locating}
                      className={`px-2 py-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${formData.lat != null && formData.lng != null ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-teal-500/15 border-teal-500/40 text-teal-300 hover:bg-teal-500/25'} ${locating ? 'opacity-60 pointer-events-none' : ''}`}>
                      <Icon name="mapPin" className="w-3.5 h-3.5 shrink-0" />{locating ? 'Obteniendo...' : 'Mi ubicacion (GPS)'}
                    </button>
                    <button type="button" onClick={() => setShowMapPicker(true)}
                      className={`px-2 py-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${formData.mapAddress ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-sky-500/15 border-sky-500/40 text-sky-300 hover:bg-sky-500/25'}`}>
                      <Icon name="search" className="w-3.5 h-3.5 shrink-0" />Elegir punto en el mapa
                    </button>
                  </div>
                  {(formData.lat != null || formData.mapAddress) && (
                    <a href={`https://www.google.com/maps?q=${formData.lat},${formData.lng}`} target="_blank" rel="noopener noreferrer"
                      className="block text-[11px] text-sky-300 underline mb-2">Ver punto en Google Maps</a>
                  )}
                  {locError && (
                    <p className="text-xs text-rose-400 mb-2 flex items-center gap-1.5">
                      <Icon name="alertTriangle" className="w-3.5 h-3.5 flex-shrink-0" />{locError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Calle, Numero, Piso/Depto (opcional si compartiste ubicacion)"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none" />
                    <button type="button" onClick={() => {
                        const phone = `${formData.phoneCode}${formData.phoneNumber}`.replace(/\D/g, '').slice(-11);
                        if (!formData.address.trim() || !/^\d{7}$/.test(formData.phoneNumber)) { addToast('Completa la direccion y el telefono para guardarla', 'warning'); return; }
                        onSaveAddress?.(phone, formData.customerName, formData.address.trim());
                      }}
                      className="shrink-0 px-3 py-3 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-300 hover:bg-teal-500/30 transition-all flex items-center gap-1.5 text-xs font-bold"
                      title="Guardar esta direccion en tu perfil">
                      <Icon name="plus" className="w-3.5 h-3.5" />Guardar
                    </button>
                  </div>
                  {errors.address && <p className="text-xs text-rose-400 mt-1">{errors.address}</p>}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Aclaraciones o Notas (Opcional)</label>
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Ej: Si no hay Sprite reemplazar por 7Up..." rows={2}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none resize-none" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Resumen del Pedido</span>
            <div className="space-y-2 pt-0.5">
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center gap-2.5">
                  <ProductImg product={item.product} alt={item.product.name} className="w-9 h-9 rounded-lg object-cover bg-slate-900 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-200 truncate">{item.product.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {formatUsd(item.product.price)} c/u
                      {rate?.rate > 0 && <span className="block text-[9px] text-slate-600">{formatBs(usdToBs(item.product.price, rate.rate))} c/u</span>}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-300 bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5 shrink-0">x{item.quantity}</span>
                  <span className="text-xs font-bold text-white w-14 sm:w-16 text-right shrink-0">{formatUsd(item.product.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="text-xs text-slate-300 flex justify-between border-t border-slate-800 pt-2">
              <span>Subtotal ({cart.reduce((acc, i) => acc + i.quantity, 0)} articulos)</span>
              <span className="font-bold text-white text-right">
                <Money value={cartTotal} />
                {rate?.rate > 0 && <span className="block text-[11px] text-teal-300/90">{formatBs(usdToBs(cartTotal, rate.rate))}</span>}
              </span>
            </div>
            {formData.paymentMethod === 'cartera' && walletAvailable > 0 && (
              <>
                <div className="text-xs flex justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5"><Icon name="wallet" className="w-3.5 h-3.5 text-emerald-400" />Mi Cartera</span>
                  <span className="font-bold text-emerald-400 text-right">-{formatUsd(Math.min(walletAvailable, cartTotal))}</span>
                </div>
                <div className="text-xs text-slate-300 flex justify-between border-t border-slate-800 pt-2">
                  <span className="font-semibold">A pagar</span>
                  <span className="font-black text-white text-right">
                    {formatUsd(Math.max(0, cartTotal - walletAvailable))}
                    {rate?.rate > 0 && <span className="block text-[11px] text-slate-400">{formatBs(usdToBs(Math.max(0, cartTotal - walletAvailable), rate.rate))}</span>}
                  </span>
                </div>
              </>
            )}
          </div>

          {customerProfile?.isBenefited && (
            <div className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${formData.credit ? 'bg-indigo-500/10 border-indigo-400' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
              onClick={() => setFormData({ ...formData, credit: !formData.credit })}>
              <div className="flex items-start gap-3">
                <span className={`p-2 rounded-xl shrink-0 ${formData.credit ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  <Icon name="creditCard" className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">Enviar pedido a la cuenta</p>
                  <p className="text-[11px] text-slate-400">Lo pagas luego; se suma a tu saldo. La tienda debe aceptarlo antes de prepararlo.</p>
                </div>
              </div>
            </div>
          )}

          {!formData.credit && (
            <div className="space-y-2.5">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Metodo de pago</span>
              <div className={`grid gap-2 sm:gap-2.5 ${walletAvailable > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                {[
                  { key: 'efectivo', label: 'Efectivo', icon: 'cash', desc: 'Pago en tienda' },
                  { key: 'pago_movil', label: 'Pago Movil', icon: 'smartphone', desc: 'Pega y paga' },
                  { key: 'transferencia', label: 'Transferencia', icon: 'bank', desc: 'Cuenta bancaria' },
                  ...(walletAvailable > 0 ? [{ key: 'cartera', label: 'Mi Cartera', icon: 'wallet', sub: formatUsd(walletAvailable), desc: 'Saldo a favor' }] : [])
                ].map((m) => {
                  const active = formData.paymentMethod === m.key;
                  return (
                    <button key={m.key} type="button"
                      onClick={() => setFormData({ ...formData, paymentMethod: active ? '' : m.key, restPaymentMethod: m.key === 'cartera' ? formData.restPaymentMethod : '' })}
                      className={`relative px-2 py-3 sm:py-3.5 rounded-2xl border text-[11px] sm:text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${active ? 'bg-gradient-to-b from-teal-500/20 to-teal-500/5 border-teal-400/60 text-teal-200 shadow-lg shadow-teal-500/10 ring-1 ring-teal-400/30' : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:border-slate-500 hover:bg-slate-800'}`}>
                      <span className={`p-2 rounded-xl transition-all ${active ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/40' : 'bg-slate-900 text-slate-400 border border-slate-700'}`}>
                        <Icon name={m.icon} className="w-4 h-4" />
                      </span>
                      <span className={active ? 'text-teal-200' : 'text-slate-300'}>{m.label}</span>
                      {m.sub ? <span className="text-[9px] text-emerald-400 font-bold leading-none">{m.sub}</span>
                        : <span className={`text-[9px] font-medium leading-none ${active ? 'text-teal-300/70' : 'text-slate-500'}`}>{m.desc}</span>}
                      {active && <span className="absolute top-1.5 right-1.5 p-0.5 rounded-full bg-teal-500 text-slate-950 shadow"><Icon name="check" className="w-3 h-3" /></span>}
                    </button>
                  );
                })}
              </div>

              {formData.paymentMethod === 'cartera' && walletAvailable > 0 && (
                <div className="space-y-2.5 animate-fade-in">
                  <p className="text-[11px] text-slate-300 bg-slate-800/60 rounded-xl p-3 border border-slate-700 flex items-start gap-2">
                    <Icon name="wallet" className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                    {walletAvailable >= cartTotal
                      ? <span>Tu cartera cubre todo el pedido ({formatUsd(cartTotal)}). Se descuenta al confirmar; no necesitas pagar nada mas.</span>
                      : <span>Tu cartera cubre <b className="text-emerald-300">{formatUsd(walletAvailable)}</b> y el resto es <b className="text-amber-300">{formatUsd(cartTotal - walletAvailable)}</b>. Elige con que pagas la diferencia.</span>}
                  </p>
                  {walletAvailable < cartTotal && (
                    <div className="grid grid-cols-3 gap-2">
                      {[{ key: 'efectivo', label: 'Efectivo', icon: 'cash' }, { key: 'pago_movil', label: 'Pago Movil', icon: 'smartphone' }, { key: 'transferencia', label: 'Transferencia', icon: 'bank' }].map((m) => {
                        const active = formData.restPaymentMethod === m.key;
                        return (
                          <button key={m.key} type="button" onClick={() => setFormData({ ...formData, restPaymentMethod: active ? '' : m.key })}
                            className={`relative px-2 py-2.5 rounded-xl border text-[10px] sm:text-[11px] font-bold flex flex-col items-center gap-1.5 transition-all ${active ? 'bg-gradient-to-b from-teal-500/20 to-teal-500/5 border-teal-400/60 text-teal-200 ring-1 ring-teal-400/30' : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                            <span className={`p-1.5 rounded-lg transition-all ${active ? 'bg-teal-500 text-slate-950 shadow' : 'bg-slate-900 text-slate-400 border border-slate-700'}`}>
                              <Icon name={m.icon} className="w-3.5 h-3.5" />
                            </span>
                            {m.label}
                            {active && <span className="absolute top-1 right-1 p-0.5 rounded-full bg-teal-500 text-slate-950"><Icon name="check" className="w-2.5 h-2.5" /></span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {formData.restPaymentMethod === 'pago_movil' && paymentConfig?.pagoMovil && (
                    <p className="text-[11px] text-slate-300 bg-slate-800/60 rounded-xl p-3 border border-slate-700">
                      <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider mb-1">Datos para el pago movil</span>
                      Banco: <span className="text-white font-bold">{paymentConfig.pagoMovil.bank || '—'}</span> · Telefono: <span className="text-white font-bold">{paymentConfig.pagoMovil.phone || '—'}</span> · Cedula: <span className="text-white font-bold">{paymentConfig.pagoMovil.id || '—'}</span>
                    </p>
                  )}
                  {formData.restPaymentMethod === 'transferencia' && paymentConfig?.bank && (
                    <p className="text-[11px] text-slate-300 bg-slate-800/60 rounded-xl p-3 border border-slate-700">
                      <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider mb-1">Datos para la transferencia</span>
                      Banco: <span className="text-white font-bold">{paymentConfig.bank.name || '—'}</span> · Numero de cuenta: <span className="text-white font-bold">{paymentConfig.bank.account || '—'}</span>
                      {paymentConfig.bank.titular && <> · Titular: <span className="text-white font-bold">{paymentConfig.bank.titular}</span></>}
                    </p>
                  )}
                  {formData.restPaymentMethod && formData.restPaymentMethod !== 'efectivo' && (
                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Numero de referencia / comprobante (opcional)</label>
                        <input type="text" value={formData.paymentReference} onChange={(e) => setFormData({ ...formData, paymentReference: e.target.value })}
                          placeholder="Ej: 12H3456789"
                          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Foto del comprobante *</label>
                        <label className="w-full flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/60 cursor-pointer hover:border-teal-500/50 transition-all text-center">
                          {formData.paymentProof ? (
                            <>
                              <img src={formData.paymentProof} alt="Comprobante de pago" className="max-h-36 rounded-lg object-contain" />
                              <span className="text-[11px] text-teal-300 font-semibold flex items-center gap-1"><Icon name="check" className="w-3.5 h-3.5" />Comprobante adjunto — toca para cambiarlo</span>
                            </>
                          ) : (
                            <>
                              <Icon name="upload" className="w-6 h-6 text-slate-500" />
                              <span className="text-xs text-slate-400">Toca para tomar una foto, elegir de la galeria o subir un archivo del comprobante</span>
                            </>
                          )}
                          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                            const file = e.target.files && e.target.files[0];
                            if (!file) return;
                            if (file.size > 8 * 1024 * 1024) { addToast('La imagen supera 8 MB. Elige una mas liviana.', 'error'); e.target.value = ''; return; }
                            try { const compressed = await compressImage(file); setFormData({ ...formData, paymentProof: compressed }); }
                            catch { addToast('No se pudo procesar la imagen. Prueba con otra.', 'error'); }
                            finally { e.target.value = ''; }
                          }} />
                        </label>
                      </div>
                    </div>
                  )}
                  {errors.payment && <p className="text-xs text-rose-400 mt-1">{errors.payment}</p>}
                </div>
              )}

              {formData.paymentMethod === 'pago_movil' && paymentConfig?.pagoMovil && (
                <p className="text-[11px] text-slate-300 bg-slate-800/60 rounded-xl p-3 border border-slate-700">
                  <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider mb-1">Datos para el pago movil</span>
                  Banco: <span className="text-white font-bold">{paymentConfig.pagoMovil.bank || '—'}</span> · Telefono: <span className="text-white font-bold">{paymentConfig.pagoMovil.phone || '—'}</span> · Cedula: <span className="text-white font-bold">{paymentConfig.pagoMovil.id || '—'}</span>
                </p>
              )}

              {formData.paymentMethod === 'transferencia' && paymentConfig?.bank && (
                <p className="text-[11px] text-slate-300 bg-slate-800/60 rounded-xl p-3 border border-slate-700">
                  <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider mb-1">Datos para la transferencia</span>
                  Banco: <span className="text-white font-bold">{paymentConfig.bank.name || '—'}</span> · Numero de cuenta: <span className="text-white font-bold">{paymentConfig.bank.account || '—'}</span>
                  {paymentConfig.bank.titular && <> · Titular: <span className="text-white font-bold">{paymentConfig.bank.titular}</span></>}
                </p>
              )}

              {formData.paymentMethod !== '' && formData.paymentMethod !== 'efectivo' && formData.paymentMethod !== 'cartera' && (
                <div className="space-y-2.5 animate-fade-in">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Numero de referencia / comprobante (opcional)</label>
                    <input type="text" value={formData.paymentReference} onChange={(e) => setFormData({ ...formData, paymentReference: e.target.value })}
                      placeholder="Ej: 12H3456789"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Foto del comprobante *</label>
                    <label className="w-full flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/60 cursor-pointer hover:border-teal-500/50 transition-all text-center">
                      {formData.paymentProof ? (
                        <>
                          <img src={formData.paymentProof} alt="Comprobante de pago" className="max-h-36 rounded-lg object-contain" />
                          <span className="text-[11px] text-teal-300 font-semibold flex items-center gap-1"><Icon name="check" className="w-3.5 h-3.5" />Comprobante adjunto — toca para cambiarlo</span>
                        </>
                      ) : (
                        <>
                          <Icon name="upload" className="w-6 h-6 text-slate-500" />
                          <span className="text-xs text-slate-400">Toca para tomar una foto, elegir de la galeria o subir un archivo del comprobante</span>
                          <span className="text-[10px] text-slate-500">Se comprime automaticamente</span>
                        </>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files && e.target.files[0];
                        if (!file) return;
                        if (file.size > 8 * 1024 * 1024) { addToast('La imagen supera 8 MB. Elige una mas liviana.', 'error'); e.target.value = ''; return; }
                        try { const compressed = await compressImage(file); setFormData({ ...formData, paymentProof: compressed }); }
                        catch { addToast('No se pudo procesar la imagen. Prueba con otra.', 'error'); }
                        finally { e.target.value = ''; }
                      }} />
                    </label>
                  </div>
                  {errors.payment && <p className="text-xs text-rose-400 mt-1">{errors.payment}</p>}
                </div>
              )}
            </div>
          )}

          <button type="submit" disabled={isPlacingOrder}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-sm hover:from-teal-400 hover:to-emerald-400 shadow-xl shadow-teal-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none">
            <Icon name="check" className="w-5 h-5" />
            <span>{isPlacingOrder ? 'Enviando pedido...' : 'Confirmar y Enviar Pedido'}</span>
          </button>
        </form>

        {showMapPicker && (
          <MapPickerModal title="Donde recibis el pedido?" initial={formData.lat != null ? { lat: formData.lat, lng: formData.lng } : null}
            onPick={(p) => {
              setFormData((prev) => ({ ...prev, lat: p.lat, lng: p.lng, address: p.address || prev.address || '', mapAddress: p.address || prev.address || '' }));
              setLocError(''); setShowMapPicker(false);
              addToast('Punto de entrega elegido en el mapa', 'success');
            }}
            onClose={() => setShowMapPicker(false)} />
        )}
      </div>
    </div>
  );
}
