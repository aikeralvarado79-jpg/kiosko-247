# Kiosco 24/7

App de kiosco con catálogo, pedidos con retiro o envío, y panel de administración. Frontend React + Vite, backend Express, persistencia en Postgres (Supabase) con fallback local a archivo.

**Producción:** https://kiosko-247.onrender.com

## Stack

- **Frontend:** React 18 + Vite + Tailwind CSS v4
- **Backend:** Express (API en `/api`)
- **Persistencia:** Postgres/Supabase (transaction pooler, puerto 6543) con fallback a `server/data.json`
- **Despliegue:** Render (blueprint `render.yaml`, plan free)
- **Tiempo real:** polling cada 5 s (configurable), pausado cuando la pestaña está oculta

## Credenciales

| Servicio   | Valor                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| URL pública | `https://kiosko-247.onrender.com`                                                                      |
| Admin pass | `kiosko247Aa` (definida como `ADMIN_PASSWORD` en Render; localmente `server/config.json` → `kiosko123`) |
| Supabase   | ref `xhklvjvqhnnfpccqygti`; se conecta por **transaction pooler puerto 6543** (el directo 5432 es IPv6-only) |

> Nota: el host directo de Supabase (`db.xhklvjvqhnnfpccqygti.supabase.co`) solo publica IPv6, inalcanzable desde redes IPv4 y desde Render. Usar siempre `aws-0-ca-central-1.pooler.supabase.com:6543`.

## Desarrollo local

Requisitos: Node 18+.

```bash
npm install

# Terminal 1: backend Express en http://localhost:3500
npm run server

# Terminal 2: frontend Vite con proxy a la API
npm run dev
```

Sin `DATABASE_URL` configurada, el backend usa `server/data.json` como almacenamiento (persistencia local). Con `DATABASE_URL` apuntando a Postgres usa el esquema de `server/schema.sql` y crea el seed inicial si la base está vacía.

## Variables de entorno

| Variable             | Dónde              | Descripción                                                               |
| -------------------- | ------------------ | ------------------------------------------------------------------------- |
| `PORT`               | Backend            | Puerto HTTP (default `3500`). Render lo define automáticamente.           |
| `ADMIN_PASSWORD`     | Backend            | Contraseña del panel admin. En Render se setea en el Blueprint.           |
| `ADMIN_PHONES`       | Backend            | Teléfonos admin separados por coma (recuperación de contraseña con biometría). Se combina con `server/config.json`. |
| `DATABASE_URL`       | Backend            | Connection string de Postgres (transaction pooler de Supabase).          |
| `PEXELS_API_KEY`     | Dev (proxy Vite)   | Key de Pexels para sugerencias de imagen al crear productos.              |
| `VITE_POLL_INTERVAL` | Frontend           | Intervalo de polling en ms (default `5000`).                              |

## Deploy (Render)

1. Subí el repo a GitHub (`aikeralvarado79-jpg/kiosko-247`).
2. En Render: **New → Blueprint**, seleccioná el repo.
3. En `render.yaml` las variables `ADMIN_PASSWORD` y `DATABASE_URL` están como `sync: false`, así que Render te las pide al crear.
4. `ADMIN_PASSWORD=kiosko247Aa` y `DATABASE_URL=postgresql://postgres.xhklvjvqhnnfpccqygti:kiosko247Aa@aws-0-ca-central-1.pooler.supabase.com:6543/postgres`
5. **Apply** y esperá el deploy (2–3 min). La URL queda en `https://kiosko-247.onrender.com`.

### Costo y modo free

- Plan **free**: el servicio se duerme tras ~15 min sin visitas; la primera visita tras dormir tarda ~30–50 s (cold start). El panel admin abierto mantiene la app despierta.
- El disco de Render es efímero: **toda** la persistencia real está en Postgres, nunca en `server/data.json` en producción.

## API

- `GET /api/state` → `{ products, categories, orders }`
- `POST /api/auth/login` → `{ token }` (body: `{ password }`)
- `POST /api/orders` → crea pedido, descuenta stock atómicamente (autenticado admin)
- `PATCH /api/orders/:id/status` → cambia estado del pedido (autenticado admin)
- `POST/PATCH/DELETE /api/products` → CRUD productos (autenticado admin)
- `POST/PATCH/DELETE /api/categories` → CRUD categorías (autenticado admin)

## Comandos

```bash
npm run dev          # frontend Vite (dev)
npm run server       # backend Express
npm run dev:all      # backend + frontend juntos
npm run build        # build de producción
npm start            # sirve el build + API (producción)
npm run preview      # previsualiza el build
npm run lint         # ESLint (código)
npm run test         # tests unitarios (Vitest)
npm run format       # Prettier: formatea todo
npm run format:check # Prettier: verifica formato
npm run check        # lint + test + build (gate de calidad local)
```

## Calidad y flujo de trabajo

- **CI (GitHub Actions):** `.github/workflows/ci.yml` corre `lint`, `test` y `build` en cada PR y push a `main`/`develop`. Producción (Render) solo despliega desde `main`.
- **Ramas:** los cambios van por PR a `develop` y de ahí a `main`. `main` protegida (sin push directo).
- **Tests:** `server/store.test.js` (stock/cancelación/eliminación de pedidos), `server/rate.test.js` (tasa BCV con fallbacks) y `src/data.test.js` (helpers). Los tests usan un archivo temporal (`KIOSKO_DATA_FILE`) para no tocar `server/data.json`.
- Antes de pushear: `npm run check`.

## Estructura

```
src/            Frontend (React + Tailwind)
server/         Backend Express (index.js, store.js, rate.js, webauthn.js, config.json)
.github/workflows/  CI (lint + test + build)
render.yaml     Blueprint de despliegue en Render
```
