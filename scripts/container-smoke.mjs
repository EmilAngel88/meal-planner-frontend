import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'

const base = process.env.SMOKE_API_URL || 'http://127.0.0.1:18081'
const frontend = process.env.SMOKE_WEB_URL || 'http://127.0.0.1:18080'
const request = (path, options = {}) => fetch(`${base}${path}`, { ...options, signal: AbortSignal.timeout(10000) })
assert.equal((await request('/health')).status, 200, 'API must connect to PostgreSQL')
assert.equal((await fetch(frontend, { signal: AbortSignal.timeout(10000) })).status, 200, 'Frontend must start')
assert.equal((await fetch(`${frontend}/tutorial`, { signal: AbortSignal.timeout(10000) })).status, 200, 'Tutorial page must be available')
const video = await fetch(`${frontend}/tutorial-video.mp4`, { headers: { Range: 'bytes=0-1023' }, signal: AbortSignal.timeout(10000) })
assert.equal(video.status, 206, 'Tutorial must stream requested ranges instead of buffering the whole video')
assert.equal(video.headers.get('content-type'), 'video/mp4')
assert.equal((await video.arrayBuffer()).byteLength, 1024)
const captions = await fetch(`${frontend}/tutorial-assets/ration-tutorial-ru.vtt`, { signal: AbortSignal.timeout(10000) })
assert.equal(captions.status, 200)
assert.match(await captions.text(), /^WEBVTT/)
const suffix = randomBytes(12).toString('hex')
const credentials = { email: `ci-${suffix}@example.com`, password: randomBytes(24).toString('hex') }
const registered = await request('/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) })
assert.equal(registered.status, 201)
const { token, user } = await registered.json()
assert.equal(user.canManageBilling, false, 'Self registration must never grant admin access')
assert.equal(user.canManageFeedback, false)
const headers = { Authorization: `Bearer ${token}` }
assert.equal((await request('/auth/me', { headers })).status, 200)
const billingResponse = await request('/billing', { headers })
assert.equal(billingResponse.status, 200, 'Billing must load without payment credentials')
const billing = await billingResponse.json()
assert.equal(billing.config.enabled, false, 'A new deployment must not enable charges by default')
assert.equal(billing.canBuy, false)
assert.equal((await request('/billing/admin/settings', { headers })).status, 403)
const login = await request('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) })
assert.equal(login.status, 200, 'The new account must be persisted')
console.log('Container smoke passed: PostgreSQL, migrations, frontend, authentication and billing access.')
