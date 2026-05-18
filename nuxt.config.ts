import { defineNuxtConfig } from 'nuxt/config'
export default defineNuxtConfig({
  modules: ['@pinia/nuxt'],
  css: ['vuetify/styles','~/assets/styles/main.scss'],
  build: { transpile: ['vuetify'] },
  runtimeConfig: { public: { apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:5001' } },
  nitro: { compatibilityDate: '2025-09-29' }
})
