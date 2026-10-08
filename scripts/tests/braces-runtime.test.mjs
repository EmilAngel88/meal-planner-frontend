import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertNoBraces } from '../assert-no-braces.mjs'

test('blocks glob dependency directories, renamed manifests, code references and symlinks', () => {
  const root = mkdtempSync(join(tmpdir(), 'glob-runtime-audit-'))
  try {
    writeFileSync(join(root, 'index.mjs'), 'console.log("ready")')
    assert.equal(assertNoBraces(root), 1)
    for (const name of ['braces', 'micromatch', 'fast-glob', 'globby']) {
      mkdirSync(join(root, name))
      assert.throws(() => assertNoBraces(root), /package found/)
      rmSync(join(root, name), { recursive: true })
      writeFileSync(join(root, 'package.json'), JSON.stringify({ name }))
      assert.throws(() => assertNoBraces(root), /manifest found/)
      rmSync(join(root, 'package.json'))
      writeFileSync(join(root, 'index.mjs'), `require('${name}')`)
      assert.throws(() => assertNoBraces(root), /reference found/)
      writeFileSync(join(root, 'index.mjs'), '')
    }
    mkdirSync(join(root, 'nested'))
    writeFileSync(join(root, 'nested', 'package.json'), JSON.stringify({ name: 'braces' }))
    symlinkSync(join(root, 'nested'), join(root, 'alias'))
    assert.throws(() => assertNoBraces(root), /manifest found/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('does not confuse the separate tinyglobby package with globby', () => {
  const root = mkdtempSync(join(tmpdir(), 'glob-runtime-audit-'))
  try {
    writeFileSync(join(root, 'index.mjs'), "import { glob } from 'tinyglobby'")
    assert.equal(assertNoBraces(root), 1)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('distinguishes manifest metadata from runtime imports and bundled modules', () => {
  const root = mkdtempSync(join(tmpdir(), 'glob-runtime-audit-'))
  try {
    const file = join(root, 'index.mjs')
    writeFileSync(file, 'const developmentManifest = { globby: "11.1.0" }; const braces = []')
    assert.equal(assertNoBraces(root), 1)
    for (const source of ["import 'globby'", "export { glob } from 'globby'", "import('fast-glob')", "// node_modules/micromatch/index.js", 'braces.expand(pattern)']) {
      writeFileSync(file, source)
      assert.throws(() => assertNoBraces(root), /reference found/)
    }
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('fails closed for missing and empty runtime roots', () => {
  const root = mkdtempSync(join(tmpdir(), 'glob-runtime-audit-'))
  try { assert.throws(() => assertNoBraces(root), /no files/) } finally { rmSync(root, { recursive: true, force: true }) }
  assert.throws(() => assertNoBraces(root), /ENOENT/)
})
