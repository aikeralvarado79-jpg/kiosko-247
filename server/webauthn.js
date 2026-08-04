import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse
} from '@simplewebauthn/server';
import * as store from './store.js';

// Cache en memoria de challenges (simple, single-instance)
const challengeStore = new Map();

const cleanupChallenges = () => {
  const now = Date.now();
  for (const [key, { expires }] of challengeStore) {
    if (expires < now) challengeStore.delete(key);
  }
};
setInterval(cleanupChallenges, 5 * 60 * 1000).unref?.();

const phoneKey = (phone) => String(phone || '').replace(/\D/g, '').slice(-11);

// Convierte el teléfono a un userID estable (WebAuthn requiere bytes únicos)
const phoneToUserId = (key) => new Uint8Array(Buffer.from(key));

// Deriva el origin/rpID correctos desde el request (dev localhost vs prod onrender)
const deriveRp = (req) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http');
  const rpID = host.split(':')[0];
  return { expectedOrigin: `${proto}://${host}`, rpID };
};

// Registro: Paso 1 - generá los options para navigator.credentials.create
export const registrationOptions = async (req, res) => {
  try {
    const { phone, customerName } = req.body || {};
    const key = phoneKey(phone);
    if (key.length < 7) return res.status(400).json({ error: 'Teléfono inválido' });

    const existing = await store.getWebAuthnByPhone(key);
    if (existing) return res.status(409).json({ error: 'Este teléfono ya tiene biometría registrada' });

    const { rpID, expectedOrigin } = deriveRp(req);

    const options = await generateRegistrationOptions({
      rpName: 'Empresas Alvarados',
      rpID,
      userName: key,
      userID: phoneToUserId(key),
      userDisplayName: customerName || 'Cliente',
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'discouraged',
        userVerification: 'required'
      },
      preferredAuthenticatorType: 'localDevice'
    });

    challengeStore.set(`reg-${key}`, { challenge: options.challenge, expires: Date.now() + 5 * 60 * 1000 });

    res.json({ options });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo generar la opción de registro: ' + err.message });
  }
};

// Registro: Paso 2 - verificar la respuesta del autenticador y guardar la credencial
export const registrationVerify = async (req, res) => {
  try {
    const { phone, response } = req.body || {};
    const key = phoneKey(phone);
    const stored = challengeStore.get(`reg-${key}`);
    if (!stored) return res.status(400).json({ error: 'La sesión de registro expiró. Intenta de nuevo.' });

    const { rpID, expectedOrigin } = deriveRp(req);

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin,
      expectedRPID: rpID
    });

    challengeStore.delete(`reg-${key}`);

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'No se pudo verificar la biometría' });
    }

    const { credential } = verification.registrationInfo;

    await store.saveWebAuthn(key, {
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error verificando el registro: ' + err.message });
  }
};

// Login: Paso 1 - generá los options para navigator.credentials.get
export const authenticationOptions = async (req, res) => {
  try {
    const { phone } = req.body || {};
    const key = phoneKey(phone);
    const credential = await store.getWebAuthnByPhone(key);
    if (!credential) return res.status(404).json({ error: 'Este teléfono no tiene biometría registrada' });

    const { rpID, expectedOrigin } = deriveRp(req);

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: [{ id: credential.credentialId }],
      userVerification: 'required'
    });

    challengeStore.set(`auth-${key}`, { challenge: options.challenge, expires: Date.now() + 5 * 60 * 1000 });

    res.json({ options, credentialId: credential.credentialId });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo generar la opción de autenticación: ' + err.message });
  }
};

// Login: Paso 2 - verificar la firma del autenticador y actualizar el contador
export const authenticationVerify = async (req, res) => {
  try {
    const { phone, response } = req.body || {};
    const key = phoneKey(phone);
    const stored = challengeStore.get(`auth-${key}`);
    if (!stored) return res.status(400).json({ error: 'La sesión de autenticación expiró. Intenta de nuevo.' });

    const credential = await store.getWebAuthnByPhone(key);
    if (!credential) return res.status(404).json({ error: 'Credencial no encontrada' });

    const { rpID, expectedOrigin } = deriveRp(req);

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      credential: {
        id: credential.credentialId,
        publicKey: credential.publicKey,
        counter: credential.counter
      }
    });

    challengeStore.delete(`auth-${key}`);

    if (!verification.verified) {
      return res.status(400).json({ error: 'Biometría no verificada' });
    }

    await store.saveWebAuthn(key, {
      credentialId: credential.credentialId,
      publicKey: credential.publicKey,
      counter: verification.authenticationInfo.newCounter
    });

    const customer = await store.getCustomerByPhone(key);
    res.json({ ok: true, customer: customer || { phone: key } });
  } catch (err) {
    res.status(500).json({ error: 'Error verificando la autenticación: ' + err.message });
  }
};
