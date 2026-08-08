// Almacenamiento externo de comprobantes de pago (Supabase Storage).
// Nivel B del plan de ancho de banda: si hay SUPABASE_URL + una key de Supabase
// configurados, las imágenes se suben a un bucket público y en la BD solo se
// guarda la URL (mucho más liviana que el base64). Si no están configurados o
// el upload falla, se cae al comportamiento actual (base64 en la BD).
//
// Env esperados:
//   SUPABASE_URL              -> https://xxxx.supabase.co
//   SUPABASE_SERVICE_KEY      -> secret key (service_role, BYPASSRLS). Preferida
//                                para el server: sube sin depender de políticas.
//   SUPABASE_ANON_KEY         -> publishable/anon key (fallback).
//   SUPABASE_STORAGE_BUCKET   -> nombre del bucket (default: comprobantes)

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'comprobantes';

export const isStorageConfigured = () => Boolean(SUPABASE_URL && (SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY));

// Extrae { mime, base64 } de una data URL "data:image/png;base64,....".
const parseDataUrl = (dataUrl) => {
  const m = /^data:([a-z0-9]+\/[a-z0-9.+-]+);base64,(.*)$/s.exec(String(dataUrl || ''));
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
};

// Sube una imagen base64 al bucket y devuelve la URL pública, o null si falla.
export async function uploadProof(orderId, dataUrl) {
  if (!isStorageConfigured()) return null;
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  try {
    const ext = (parsed.mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const objectPath = `proofs/${orderId}-${Date.now()}.${ext}`;
    const key = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'Content-Type': parsed.mime
      },
      body: Buffer.from(parsed.base64, 'base64')
    });
    if (!res.ok) {
      console.warn(`[kiosko] Supabase upload falló (${res.status}): ${(await res.text().catch(() => '')).slice(0, 200)}`);
      return null;
    }
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`;
  } catch (err) {
    console.warn('[kiosko] Supabase upload error:', err.message);
    return null;
  }
}
