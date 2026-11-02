import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'swap-api-server',
        async configureServer(server) {
          const { apiApp } = await import('./server/index.ts');
          server.middlewares.use('/api', apiApp);
        },
      },
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      global: 'globalThis',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      include: [
        '@lifi/widget',
        '@lifi/widget-provider-ethereum',
        '@walletconnect/ethereum-provider',
        '@coinbase/wallet-sdk',
        '@reown/appkit',
        '@reown/appkit/core',
      ],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
