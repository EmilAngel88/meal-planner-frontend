import test from 'node:test'
import assert from 'node:assert/strict'
import { checkAudit, exceptionExpiresAt } from '../audit-dependencies.mjs'

const beforeExpiry = Date.parse('2026-10-09T09:36:09.999Z')
const bracesAdvisory = { source: 1240992, name: 'braces', dependency: 'braces', url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm', severity: 'high', range: '<=3.0.3' }
const forgeAdvisory = { source: 1240912, name: 'node-forge', dependency: 'node-forge', url: 'https://github.com/advisories/GHSA-86w9-cpqp-85rv', severity: 'high', range: '<=1.4.0' }

function fixture({ forge = false, braces = true } = {}) {
  const edges = {
    ...(forge ? { 'node-forge': [forgeAdvisory], listhen: ['node-forge'], '@nuxt/cli': ['listhen'], nitropack: ['listhen'], '@nuxt/nitro-server': ['nitropack', 'nuxt'], nuxt: ['@nuxt/cli', '@nuxt/nitro-server', '@nuxt/vite-builder'], '@nuxt/vite-builder': ['nuxt'] } : {}),
    ...(braces ? { braces: [bracesAdvisory], micromatch: ['braces'], 'fast-glob': ['micromatch'], globby: ['fast-glob', 'micromatch'] } : {}),
  }
  const versions = { braces: '3.0.3', micromatch: '4.0.8', 'fast-glob': '3.3.3', globby: '16.2.4', 'node-forge': '1.4.0' }
  return {
    report: { auditReportVersion: 2, vulnerabilities: Object.fromEntries(Object.entries(edges).map(([name, via]) => [name, { name, severity: 'high', via: structuredClone(via), nodes: [`node_modules/${name}`] }])), metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: Object.keys(edges).length, critical: 0, total: Object.keys(edges).length } } },
    lock: { packages: Object.fromEntries(Object.keys(edges).map(name => [`node_modules/${name}`, { version: versions[name] || '1.0.0' }])) },
  }
}

test('exception permits only the exact four-node braces graph before the unchanged deadline', () => {
  const { report, lock } = fixture()
  assert.deepEqual(checkAudit(report, lock, beforeExpiry), { excepted: 4 })
})

test('the old forge exception keeps its exact deadline and combines without broadening either scope', () => {
  assert.equal(exceptionExpiresAt, '2026-10-09T09:36:10Z')
  const old = fixture({ forge: true, braces: false })
  assert.deepEqual(checkAudit(old.report, old.lock, beforeExpiry), { excepted: 7 })
  const both = fixture({ forge: true })
  assert.deepEqual(checkAudit(both.report, both.lock, beforeExpiry), { excepted: 11 })
})

test('rejects every changed identifying field of the braces advisory', () => {
  for (const patch of [
    { source: 1240993 }, { name: 'other' }, { dependency: 'other' },
    { url: 'https://github.com/advisories/OTHER' }, { severity: 'moderate' }, { range: '*' },
  ]) {
    const { report, lock } = fixture()
    Object.assign(report.vulnerabilities.braces.via[0], patch)
    assert.throws(() => checkAudit(report, lock, beforeExpiry), /Unapproved advisory/)
  }
})

test('rejects changed braces versions, missing versions, and any other dependency location', () => {
  for (const mutate of [
    ({ lock }) => { lock.packages['node_modules/braces'].version = '3.0.4' },
    ({ lock }) => { delete lock.packages['node_modules/braces'].version },
    ({ report }) => { report.vulnerabilities.braces.nodes = ['apps/frontend/node_modules/braces'] },
    ({ report }) => { report.vulnerabilities.braces.nodes.push('other/node_modules/braces') },
    ({ report }) => { report.vulnerabilities.globby.nodes = ['node_modules/nitropack/node_modules/globby'] },
  ]) {
    const f = fixture(); mutate(f)
    assert.throws(() => checkAudit(f.report, f.lock, beforeExpiry))
  }
})

test('rejects additional advisories, duplicate edges, changed graphs, and cross-scope borrowing', () => {
  for (const mutate of [
    ({ report }) => { report.vulnerabilities.braces.via.push(structuredClone(bracesAdvisory)) },
    ({ report }) => { report.vulnerabilities.micromatch.via.push(structuredClone(bracesAdvisory)) },
    ({ report }) => { report.vulnerabilities.globby.via.push('fast-glob') },
    ({ report }) => { report.vulnerabilities.globby.via = ['braces'] },
    ({ report }) => { report.vulnerabilities.micromatch.via = ['globby'] },
    ({ report }) => { report.vulnerabilities.globby.via.push('node-forge') },
    ({ report }) => { report.vulnerabilities.nuxt.via.push('braces') },
  ]) {
    const f = fixture({ forge: true }); mutate(f)
    assert.throws(() => checkAudit(f.report, f.lock, beforeExpiry))
  }
})

test('rejects an unknown high/critical finding and a critical finding under an allowed name', () => {
  for (const severity of ['high', 'critical']) {
    const { report, lock } = fixture()
    report.vulnerabilities.unknown = { name: 'unknown', severity, via: [structuredClone(bracesAdvisory)], nodes: ['node_modules/unknown'] }
    report.metadata.vulnerabilities[severity]++
    report.metadata.vulnerabilities.total++
    assert.throws(() => checkAudit(report, lock, beforeExpiry), /Unapproved vulnerability/)
  }
  const { report, lock } = fixture()
  report.vulnerabilities.braces.severity = 'critical'
  report.metadata.vulnerabilities.high--
  report.metadata.vulnerabilities.critical++
  assert.throws(() => checkAudit(report, lock, beforeExpiry), /Unapproved vulnerability/)
})

test('both exceptions expire at the exact original instant and reject invalid clocks', () => {
  for (const options of [{}, { forge: true, braces: false }, { forge: true }]) {
    const { report, lock } = fixture(options)
    for (const now of [Date.parse(exceptionExpiresAt), Date.parse(exceptionExpiresAt) + 1, NaN, Infinity]) {
      assert.throws(() => checkAudit(report, lock, now), /expired/)
    }
  }
})

test('a clean report still needs no exception after expiry; malformed reports remain blocked', () => {
  const { report, lock } = fixture({ braces: false })
  assert.deepEqual(checkAudit(report, lock, Date.parse(exceptionExpiresAt) + 1), { excepted: 0 })
  for (const broken of [null, {}, { ...report, error: { message: 'network unavailable' } }, { ...report, auditReportVersion: 1 }, { ...report, metadata: { vulnerabilities: { ...report.metadata.vulnerabilities, total: 1 } } }]) {
    assert.throws(() => checkAudit(broken, lock, beforeExpiry))
  }
})

test('the braces exception does not relax the forge version or advisory restriction', () => {
  for (const mutate of [
    ({ lock }) => { lock.packages['node_modules/node-forge'].version = '1.3.0' },
    ({ report }) => { report.vulnerabilities['node-forge'].via[0].source = 999 },
    ({ report }) => { report.vulnerabilities['node-forge'].via.push(structuredClone(bracesAdvisory)) },
  ]) {
    const f = fixture({ forge: true }); mutate(f)
    assert.throws(() => checkAudit(f.report, f.lock, beforeExpiry))
  }
})
