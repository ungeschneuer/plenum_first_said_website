// Local share tool: npm run teilen, then http://localhost:5180. Not part of the published site.
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { shareServer } from './server.mjs';
import { SITE_URL } from '../../src/siteConfig.js';

const FRONTEND = path.resolve(import.meta.dirname, '..', '..');

export default defineConfig(() => {
  // Access data for Instagram, LinkedIn and GitHub from frontend/.env.teilen; only the server reads them.
  const environment = loadEnv('teilen', FRONTEND, '');
  return {
    root: import.meta.dirname,
    envDir: false,
    plugins: [react(), tailwindcss(), shareServer(environment)],
    resolve: { alias: { '@': path.join(FRONTEND, 'src') } },
    define: {
      // The tool reads the published data, so it always shows what the site shows.
      'import.meta.env.VITE_DATA_BASE_URL': JSON.stringify(environment.TEILEN_DATA_URL || `${SITE_URL}data`),
    },
    server: { host: 'localhost', port: 5180, strictPort: true, fs: { allow: [FRONTEND] } },
    clearScreen: false,
  };
});
