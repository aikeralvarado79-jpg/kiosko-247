import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const pexelsKey = env.PEXELS_API_KEY;

  if (!pexelsKey) {
    console.warn('[kiosko] PEXELS_API_KEY no configurada: las sugerencias de imagen no funcionarán.');
  }

  return {
    plugins: [react(), tailwindcss()],
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
