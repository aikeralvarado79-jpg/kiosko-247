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

// Deriva el origin correcto y el rpID desde el request.
// El rpID debe ser el HOST COMPLETO: WebAuthn ata la biometría al dominio con
// el que se registró. No podemos usar 'onrender.com' como rpID común porque
// está en la Public Suffix List y los navegadores lo rechazan. Consecuencia:
// una biometría registrada en staging NO es válida en producción y viceversa
// (el cliente re-registra una sola vez al detectar el cambio de rpID). En
// desarrollo local se usa 'localhost'.
const deriveRp = (req) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http');
  const hostP = String(host).split(':')[0];
  // RP ID = host completo. NO se puede usar 'onrender.com': está en la Public
  // Suffix List y los navegadores rechazan rpID que sea un sufijo público
  // (error: "The RP ID 'onrender.com' is invalid for this domain").
  let rpID = hostP;
  if (hostP === 'localhost' || hostP === '127.0.0.1') {
    rpID = 'localhost';
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
    // WebAuthn ata la biometría al rpID (= host completo; onrender.com no vale
    // por estar en la Public Suffix List). Si la credencial guardada se registró
    // bajo otro dominio (staging/producción o antes de guardar rpID), el host
    // actual no la acepta: permitimos re-registrar una sola vez.
    if (existing && existing.rpID === rpID) {
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
        // Credencial no-descubrible ligada al dispositivo: solo Face ID / huella
        // del celular. Evita crear una "llave de acceso" (passkey) sincronizada
        // (iCloud/Google) que es lo que muestra el browser como llave externa.
        residentKey: 'discouraged',
        userVerification: 'required'
      }
    });

    challengeStore.set(`reg-${key}`, { challenge: options.challenge, expires: Date.now() + 5 * 60 * 1000 });

    res.json({ options });
  } catch (err) {
    console.error('[kiosko] No se pudo generar la opción de registro:', err);
    res.status(500).json({ error: 'No se pudo iniciar el registro con biometría. Intentá de nuevo.' });
  }
};

// Registro: Paso 2 - verificar la respuesta del autenticador y guardar la credencial
export const registrationVerify = async (req, res) => {
  try {
    const { phone, response } = req.body || {};
    const v = await verifyRegistration(phone, response, req);
    if (!v.ok) return res.status(v.status || 400).json({ error: v.error || 'No se pudo verificar la biometría' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[kiosko] Error verificando el registro:', err);
    res.status(500).json({ error: 'No se pudo guardar tu biometría. Intentá de nuevo.' });
  }
};

// Verifica la respuesta de registro, guarda la credencial y devuelve { ok, status, error }.
// Reutilizable para el registro de biometría del admin (que además emite token).
export const verifyRegistration = async (phone, response, req) => {
  const key = phoneKey(phone);
  const stored = challengeStore.get(`reg-${key}`);
  if (!stored) return { ok: false, status: 400, error: 'La sesión de registro expiró. Intenta de nuevo.' };

  const { rpID, expectedOrigin } = deriveRp(req);

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: stored.challenge,
    expectedOrigin,
    expectedRPID: rpID
  });

  challengeStore.delete(`reg-${key}`);

  if (!verification.verified || !verification.registrationInfo) {
    return { ok: false, status: 400, error: 'No se pudo verificar la biometría' };
  }

  const { credential } = verification.registrationInfo;

  await store.saveWebAuthn(key, {
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey),
    counter: credential.counter,
    rpID
  });

  return { ok: true };
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
    console.error('[kiosko] No se pudo generar la opción de autenticación:', err);
    res.status(500).json({ error: 'No se pudo iniciar la verificación con biometría. Intentá de nuevo.' });
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
    console.error('[kiosko] Error verificando la autenticación:', err);
    res.status(500).json({ error: 'No se pudo verificar tu biometría. Intentá de nuevo.' });
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
