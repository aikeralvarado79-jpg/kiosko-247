import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Estampa dentro de public/sw.js un hash de los assets de cada build
// (reemplaza __APP_VERSION__). Como sw.js cambia en cada deploy, todos los
// dispositivos con una versión vieja detectan el nuevo service worker al
// chequear y reciben el aviso con el botón "Actualizar" (ver src/main.jsx).
function swVersionStamp() {
  let outDir = 'dist';
  return {
    name: 'kiosko-sw-version-stamp',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.build.outDir || 'dist');
    },
    closeBundle() {
      const swPath = join(outDir, 'sw.js');
      if (!existsSync(swPath)) return;
      try {
        const walk = (dir) =>
          readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
            const p = join(dir, entry.name);
            return entry.isDirectory() ? walk(p) : [p];
          });
        const stamp = walk(outDir)
          .filter((f) => /\.(js|css|html)$/.test(f) && !f.endsWith('.map') && !/[\\/]sw\.js$/.test(f))
          .sort()
          .map((f) => `${f.slice(outDir.length).replace(/\\/g, '/')}:${statSync(f).mtimeMs}`)
          .join('|');
        const version = createHash('sha1').update(stamp).digest('hex').slice(0, 10);
        writeFileSync(swPath, readFileSync(swPath, 'utf8').replaceAll('__APP_VERSION__', version), 'utf8');
        console.log(`[kiosko] sw.js versionado: ${version}`);
      } catch (err) {
        console.warn('[kiosko] No se pudo estampar la versión en sw.js:', err.message);
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const pexelsKey = env.PEXELS_API_KEY;

  if (!pexelsKey) {
    console.warn('[kiosko] PEXELS_API_KEY no configurada: las sugerencias de imagen no funcionarán.');
  }

  return {
    plugins: [react(), tailwindcss(), swVersionStamp()],
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3500',
          changeOrigin: true
        },
        '/pexels-api': {
          target: 'https://api.pexels.com/v1',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/pexels-api/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (pexelsKey) {
                proxyReq.setHeader('Authorization', pexelsKey);
              }
            });
          }
        }
      }
    }
  };
});