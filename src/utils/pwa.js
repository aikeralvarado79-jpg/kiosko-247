import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser';
import { api } from '../api';

export const isInstalledPWA = () =>
  (typeof navigator !== 'undefined' && navigator.standalone) ||
  (typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches);

export const hasRealBiometrics = async () => {
  if (typeof navigator === 'undefined' || !browserSupportsWebAuthn()) return false;
  let platformOk = false;
  try {
    platformOk = await platformAuthenticatorIsAvailable();
  } catch {
    platformOk = false;
  }
  if (!platformOk) return false;
  return (
    navigator.maxTouchPoints > 0 ||
    'ontouchstart' in window ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
  );
};

export const urlBase64ToUint8Array = (base64) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
};

export const subscribeToPush = async (phone) => {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false;
    const reg = await navigator.serviceWorker.ready;
    if (!reg.pushManager) return false;
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      const keyRes = await api.getVapidKey();
      if (!keyRes.ok || !keyRes.data?.publicKey) return false;
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyRes.data.publicKey)
      });
    }
    const key = String(phone || '').replace(/\D/g, '').slice(-11);
    if (!key || key.length < 7) return false;
    await api.subscribePush(key, {
      endpoint: subscription.endpoint,
      keys: subscription.toJSON().keys
    });
    return true;
  } catch { return false; }
};
