// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

// Canonical URLs and share images need an absolute address; Vercel provides the production domain
const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;

// https://astro.build/config
export default defineConfig({
  site: productionHost ? `https://${productionHost}` : 'http://localhost:3000',
  server: { port: 3000 },
  // Self-hosted at build time, preloaded, with a metric-matched fallback so text doesn't jump
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Inter',
      cssVariable: '--font-inter',
      weights: ['100 900'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['sans-serif'],
    },
  ],
});
