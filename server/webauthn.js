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

// Deriva el origin correcto desde el request y un rpID portable.
// El rpID ES EL PROBLEMA CLAVE: las credenciales WebAuthn quedan atadas al
// rpID con el que se registraron. Como staging y producción viven en subdominios
// distintos de onrender.com (kiosko-247-staging.onrender.com vs kiosko-247.onrender.com),
// si derivamos el rpID del host, una biometría registrada en uno NO es válida en el otro
// y el navegador cancela la autenticación justo después del Face ID (NotAllowedError).
// Al fijar el rpID al dominio registrable común (onrender.com), la credencial es
// portable entre ambos entornos. En desarrollo local se usa 'localhost'.
const deriveRp = (req) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http');
  const hostP = String(host).split(':')[0];
  let rpID = hostP;
  if (hostP === 'localhost' || hostP === '127.0.0.1') {
    rpID = 'localhost';
  } else if (hostP.endsWith('.onrender.com')) {
    rpID = 'onrender.com';
  }
  return { expectedOrigin: `${proto}://${host}`, rpID };
};

// Registro: Paso 1 - generá los options para navigator.credentials.create
export const registrationOptions = async (req, res) => {
  try {
    const { phone, customerName } = req.body || {};
    const key = phoneKey(phone);
    if (key.length < 7) return res.status(400).json({ error: 'Teléfono inválido' });

    const { rpID } = deriveRp(req);
    const existing = await store.getWebAuthnByPhone(key);
    // Si la credencial se registró bajo otro rpID (por ej. antes de que el
    // rpID fuera portable entre staging y producción), el dominio ya no la
    // acepta. Permitimos re-registrar solo cuando el rpID almacenado existe y
    // difiere del actual (datos legados sin rpID siguen bloqueados a mano).
    if (existing && (!existing.rpID || existing.rpID === rpID)) {
      return res.status(409).json({ error: 'Este teléfono ya tiene biometría registrada' });
    }

    const options = await generateRegistrationOptions({
      rpName: 'Empresas Alvarados',
      rpID,
      userName: key,
      userID: phoneToUserId(key),
      userDisplayName: customerName || 'Cliente',
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        // Credencial local no-discoverable: exige solo la huella / Face ID del
        // dispositivo. Con 'required' se creaba un passkey discoverable y, en
        // Android, Google Credential Manager pedía una "llave de acceso" de Google.
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
      counter: credential.counter,
      rpID
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

    const { rpID } = deriveRp(req);

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
    const v = await verifyAuth(phone, response, req);
    if (!v.ok) return res.status(v.status || 400).json({ error: v.error || 'Biometría no verificada' });
    const key = phoneKey(phone);
    const customer = await store.getCustomerByPhone(key);
    res.json({ ok: true, customer: customer || { phone: key } });
  } catch (err) {
    res.status(500).json({ error: 'Error verificando la autenticación: ' + err.message });
  }
};

// Función reutilizable: verifica biometría y devuelve { ok, error, status }
export const verifyAuth = async (phone, response, req) => {
  const key = phoneKey(phone);
  const stored = challengeStore.get(`auth-${key}`);
  if (!stored) return { ok: false, status: 400, error: 'La sesión de autenticación expiró. Intenta de nuevo.' };
  const credential = await store.getWebAuthnByPhone(key);
  if (!credential) return { ok: false, status: 404, error: 'Credencial no encontrada' };
  const { rpID, expectedOrigin } = deriveRp(req);
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: stored.challenge,
    expectedOrigin,
    expectedRPID: rpID,
    credential: { id: credential.credentialId, publicKey: credential.publicKey, counter: credential.counter }
  });
  challengeStore.delete(`auth-${key}`);
  if (!verification.verified) return { ok: false, status: 400, error: 'Biometría no verificada' };
  await store.saveWebAuthn(key, {
    credentialId: credential.credentialId,
    publicKey: credential.publicKey,
    counter: verification.authenticationInfo.newCounter,
    rpID: credential.rpID || rpID
  });
  return { ok: true };
};
