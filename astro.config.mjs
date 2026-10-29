// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// Canonical URLs and share images need an absolute address; Vercel provides the production domain
const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;

// https://astro.build/config
export default defineConfig({
  site: productionHost ? `https://${productionHost}` : 'http://localhost:3000',
  integrations: [react()],
  server: { port: 3000 },
});
