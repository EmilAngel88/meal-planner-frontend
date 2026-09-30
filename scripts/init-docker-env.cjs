/* eslint-disable @typescript-eslint/no-require-imports -- executable CommonJS utility */
const { randomBytes } = require('node:crypto')
const { writeFileSync } = require('node:fs')
const { resolve } = require('node:path')
const target = resolve(__dirname, '../.env')
const content = [
  '# Generated for Docker Compose. Keep this file private and backed up.',
  `POSTGRES_PASSWORD=${randomBytes(32).toString('hex')}`,
  `JWT_SECRET=${randomBytes(48).toString('hex')}`,
  'BIND_ADDRESS=127.0.0.1', 'FRONTEND_PORT=8080', 'BACKEND_PORT=8081',
  'NUXT_PUBLIC_API_BASE=http://localhost:8081',
  'CORS_ORIGINS=http://localhost:8080,http://127.0.0.1:8080',
  'SEED_BASE_CATALOG=true', '',
].join('\n')
try {
  writeFileSync(target, content, { flag: 'wx', mode: 0o600 })
  console.log('Created root .env with random Docker secrets. Existing app environment files were not changed.')
} catch (error) {
  if (error.code === 'EEXIST') console.log('Root .env already exists; left unchanged. Check it against .env.example.')
  else throw error
}
