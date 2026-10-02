import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkAudit, exceptionExpiresAt } from '../audit-dependencies.mjs'
import { assertNoForge } from '../assert-no-forge.mjs'

const approvedTime = Date.parse('2026-10-02T09:36:10Z')
const advisory = { source: 1240912, name: 'node-forge', dependency: 'node-forge', url: 'https://github.com/advisories/GHSA-86w9-cpqp-85rv', severity: 'high', range: '<=1.4.0' }
function fixture() {
  const edges = { 'node-forge': [advisory], listhen: ['node-forge'], '@nuxt/cli': ['listhen'], nitropack: ['listhen'], '@nuxt/nitro-server': ['nitropack', 'nuxt'], nuxt: ['@nuxt/cli', '@nuxt/nitro-server', '@nuxt/vite-builder'], '@nuxt/vite-builder': ['nuxt'] }
  return {
    report: { auditReportVersion: 2, vulnerabilities: Object.fromEntries(Object.entries(edges).map(([name, via]) => [name, { name, severity: 'high', via: structuredClone(via), nodes: [`node_modules/${name}`] }])), metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 7, critical: 0, total: 7 } } },
    lock: { packages: Object.fromEntries(Object.keys(edges).map(name => [`node_modules/${name}`, { version: name === 'node-forge' ? '1.4.0' : '1.0.0' }])) },
  }
}

test('allows exactly the reviewed advisory and transitive cycles before expiry', () => {
  const { report, lock } = fixture()
  assert.deepEqual(checkAudit(report, lock, approvedTime), { excepted: 7 })
})
test('blocks at expiry, including invalid clocks', () => {
  const { report, lock } = fixture()
  for (const now of [Date.parse(exceptionExpiresAt), Date.parse(exceptionExpiresAt) + 1, NaN]) assert.throws(() => checkAudit(report, lock, now), /expired/)
})
test('a clean audit needs no exception even after expiry', () => {
  const { report, lock } = fixture()
  report.vulnerabilities = {}
  report.metadata.vulnerabilities.high = report.metadata.vulnerabilities.total = 0
  assert.deepEqual(checkAudit(report, lock, Date.parse(exceptionExpiresAt) + 1), { excepted: 0 })
})
test('blocks additional advisories on the same package and altered advisory metadata', () => {
  for (const patch of [{ source: 999 }, { url: 'https://github.com/advisories/OTHER' }, { severity: 'critical' }, { range: '*' }, { dependency: 'other' }]) {
    const { report, lock } = fixture()
    report.vulnerabilities['node-forge'].via.push({ ...advisory, ...patch })
    assert.throws(() => checkAudit(report, lock, approvedTime), /Unapproved advisory/)
  }
})
test('blocks changes to forge version, location, and unknown dependency graph nodes', () => {
  for (const mutate of [
    ({ lock }) => { lock.packages['node_modules/node-forge'].version = '1.3.0' },
    ({ report }) => { report.vulnerabilities['node-forge'].nodes.push('apps/backend/node_modules/node-forge') },
    ({ report }) => { report.vulnerabilities.listhen.via.push('unknown') },
    ({ report }) => { report.vulnerabilities.nuxt.via = ['@nuxt/vite-builder'] },
  ]) {
    const data = fixture()
    mutate(data)
    assert.throws(() => checkAudit(data.report, data.lock, approvedTime))
  }
})
test('blocks an unrelated high vulnerability', () => {
  const { report, lock } = fixture()
  report.vulnerabilities.other = { name: 'other', severity: 'high', via: ['node-forge'], nodes: ['node_modules/other'] }
  report.metadata.vulnerabilities.high++
  report.metadata.vulnerabilities.total++
  assert.throws(() => checkAudit(report, lock, approvedTime), /Unapproved vulnerability/)
})
test('fails closed for malformed, incomplete, and error reports', () => {
  const { report, lock } = fixture()
  for (const broken of [null, {}, { ...report, error: { message: 'network failed' } }, { ...report, auditReportVersion: 3 }, { ...report, vulnerabilities: {} }, { ...report, metadata: {} }]) assert.throws(() => checkAudit(broken, lock, approvedTime))
})
test('runtime scan blocks packages, renamed manifests, references, and symlinked packages', () => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-audit-'))
  try {
    writeFileSync(join(root, 'index.mjs'), 'console.log("ready")')
    assert.equal(assertNoForge(root), 1)
    mkdirSync(join(root, 'node-forge'))
    assert.throws(() => assertNoForge(root), /node-forge found/)
    rmSync(join(root, 'node-forge'), { recursive: true })
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'node-forge' }))
    assert.throws(() => assertNoForge(root), /manifest found/)
    rmSync(join(root, 'package.json'))
    writeFileSync(join(root, 'index.mjs'), 'require("node-forge")')
    assert.throws(() => assertNoForge(root), /reference found/)
    writeFileSync(join(root, 'index.mjs'), '')
    mkdirSync(join(root, 'nested'))
    writeFileSync(join(root, 'nested', 'package.json'), JSON.stringify({ name: 'node-forge' }))
    symlinkSync(join(root, 'nested'), join(root, 'alias'))
    assert.throws(() => assertNoForge(root), /manifest found/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
test('runtime scan fails closed if root is missing or empty', () => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-audit-'))
  try { assert.throws(() => assertNoForge(root), /no files/) } finally { rmSync(root, { recursive: true, force: true }) }
  assert.throws(() => assertNoForge(root), /ENOENT/)
})
