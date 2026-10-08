import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const exceptionExpiresAt = '2026-10-09T09:36:10Z'
const advisoryUrl = 'https://github.com/advisories/GHSA-86w9-cpqp-85rv'
const bracesAdvisoryUrl = 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm'
const bracesPackages = new Set(['braces', 'micromatch', 'fast-glob', 'globby'])
const bracesEdges = new Map([['micromatch', ['braces']], ['fast-glob', ['micromatch']], ['globby', ['fast-glob', 'micromatch']]])
const approvedPackages = new Set(['@nuxt/cli', '@nuxt/nitro-server', '@nuxt/vite-builder', 'listhen', 'nitropack', 'node-forge', 'nuxt'])
const severities = ['info', 'low', 'moderate', 'high', 'critical']
const fail = (message) => { throw new Error(message) }

// This is a temporary, explicitly approved exception, not a patched dependency.
export function checkAudit(report, lock, now = Date.now()) {
  if (report?.error || report?.auditReportVersion !== 2 || !report.vulnerabilities || Array.isArray(report.vulnerabilities) || !report.metadata?.vulnerabilities) fail('Invalid npm audit report')
  const entries = Object.entries(report.vulnerabilities)
  for (const severity of severities) {
    if (report.metadata.vulnerabilities[severity] !== entries.filter(([, value]) => value.severity === severity).length) fail('Audit severity counts do not match')
  }
  if (report.metadata.vulnerabilities.total !== entries.length) fail('Audit total does not match')
  for (const [name, value] of entries) {
    if (value.name !== name || !severities.includes(value.severity) || !Array.isArray(value.via) || !value.via.length) fail(`Invalid audit entry: ${name}`)
  }
  const blocked = entries.filter(([, value]) => ['high', 'critical'].includes(value.severity))
  if (!blocked.length) return { excepted: 0 }
  if (!Number.isFinite(now) || now >= Date.parse(exceptionExpiresAt)) fail(`Security exception expired at ${exceptionExpiresAt}`)
  for (const [root] of blocked) {
    const isBraces = bracesPackages.has(root)
    const scopedPackages = isBraces ? bracesPackages : approvedPackages
    const expectedAdvisory = isBraces
      ? { name: 'braces', source: 1240992, url: bracesAdvisoryUrl, range: '<=3.0.3' }
      : { name: 'node-forge', source: 1240912, url: advisoryUrl, range: '<=1.4.0' }
    const pending = [root]
    const seen = new Set()
    let foundAdvisory = false
    while (pending.length) {
      const name = pending.pop()
      if (seen.has(name)) continue
      seen.add(name)
      const value = report.vulnerabilities[name]
      if (!value || !scopedPackages.has(name) || value.severity !== 'high') fail(`Unapproved vulnerability: ${name}`)
      const expectedPath = `node_modules/${name}`
      if (!Array.isArray(value.nodes) || value.nodes.length !== 1 || value.nodes[0] !== expectedPath || !lock?.packages?.[expectedPath]?.version) fail(`Unapproved dependency location: ${name}`)
      if (name === 'node-forge' && lock.packages[expectedPath].version !== '1.4.0') fail('Exception only covers node-forge 1.4.0')
      if (name === 'braces' && lock.packages[expectedPath].version !== '3.0.3') fail('Exception only covers braces 3.0.3')
      if (isBraces) {
        const expectedEdges = bracesEdges.get(name) || []
        const actualEdges = value.via.filter(via => typeof via === 'string')
        if (actualEdges.length !== expectedEdges.length || expectedEdges.some(edge => actualEdges.filter(via => via === edge).length !== 1)) fail(`Unapproved braces dependency graph: ${name}`)
        if (name === 'braces' ? value.via.length !== 1 : value.via.length !== actualEdges.length) fail(`Unapproved braces advisory placement: ${name}`)
      }
      for (const via of value.via) {
        if (typeof via === 'string') { pending.push(via); continue }
        if (name !== expectedAdvisory.name || via?.source !== expectedAdvisory.source || via?.url !== expectedAdvisory.url || via?.name !== expectedAdvisory.name || via?.dependency !== expectedAdvisory.name || via?.severity !== 'high' || via?.range !== expectedAdvisory.range) fail(`Unapproved advisory affecting ${name}`)
        foundAdvisory = true
      }
    }
    if (!foundAdvisory) fail(`No approved advisory explains ${root}`)
  }
  return { excepted: blocked.length }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = spawnSync('npm', ['audit', '--json', '--audit-level=high'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 120000 })
    if (result.error || result.signal || ![0, 1].includes(result.status)) fail('npm audit failed to produce a usable report')
    const report = JSON.parse(result.stdout)
    const decision = checkAudit(report, JSON.parse(readFileSync('package-lock.json', 'utf8')))
    if (decision.excepted) {
      const exceptions = []
      if (report.vulnerabilities['node-forge']) exceptions.push(`${advisoryUrl}; node-forge@1.4.0; runtime check: assert-no-forge.mjs`)
      if (report.vulnerabilities.braces) exceptions.push(`${bracesAdvisoryUrl}; braces@3.0.3; runtime check: assert-no-braces.mjs`)
      console.log(`TEMPORARY EXCEPTION: ${exceptions.join(' | ')}; expires ${exceptionExpiresAt}; ${decision.excepted} affected dependency entries.`)
    }
    else console.log('Dependency audit passed without a security exception.')
  } catch (error) {
    console.error(`Dependency audit blocked: ${error.message}`)
    process.exitCode = 1
  }
}
