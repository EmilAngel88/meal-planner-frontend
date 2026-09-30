import js from '@eslint/js'
import ts from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
export default ts.config(
  { ignores: ['**/node_modules/**', '**/.nuxt/**', '**/.output/**', '**/dist/**', 'tmp/**', '.agents/**', '.backups/**'] },
  js.configs.recommended, ...ts.configs.recommended, ...vue.configs['flat/essential'],
  { languageOptions: { globals: { ...globals.node, ...globals.browser } }, rules: { '@typescript-eslint/no-explicit-any': 'off', '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }], '@typescript-eslint/no-namespace': 'off' } },
  { files: ['apps/frontend/**/*.{ts,vue}'], languageOptions: { globals: Object.fromEntries(['defineNuxtPlugin', 'defineNuxtRouteMiddleware', 'definePageMeta', 'useRuntimeConfig', 'navigateTo', 'useRoute', 'useRouter', 'useHead', 'ref', 'reactive', 'computed', 'watch', 'onMounted', 'onUnmounted', 'onBeforeUnmount', 'onBeforeRouteLeave', '$fetch'].map(n => [n, 'readonly'])) } },
  { files: ['**/*.vue'], languageOptions: { parserOptions: { parser: ts.parser, extraFileExtensions: ['.vue'] } }, rules: { 'vue/multi-word-component-names': 'off' } },
)
