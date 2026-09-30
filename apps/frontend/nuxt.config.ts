import { defineNuxtConfig } from 'nuxt/config'
export default defineNuxtConfig({
  ssr: false,
  // Project stores and helpers use explicit imports; scanning misidentifies nested schema/action names as exports.
  imports: { scan: false },
  devtools: { enabled: false },
  app: { head: { link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }], title: 'Рацион — еда в вашем ритме', htmlAttrs: { lang: 'ru' }, meta: [{ name: 'description', content: 'Ваша цель, меню на неделю и покупки. Чуть меньше забот о еде.' }] } },
  modules: ['@pinia/nuxt'],
  css: ['vuetify/styles','~/assets/styles/main.scss'],
  build: { transpile: ['vuetify'] },
  routeRules: {
    '/**': { headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'self'; object-src 'none'"
    } }
  },
  runtimeConfig: { public: { apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:5001' } },
  nitro: { compatibilityDate: '2025-09-29' }
})
