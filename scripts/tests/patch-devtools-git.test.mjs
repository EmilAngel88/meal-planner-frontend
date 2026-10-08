import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { patchDevtoolsGit } from '../patch-devtools-git.mjs'

const originalImport = "import Git from 'simple-git';"
const patchedImport = "import { simpleGit as Git } from 'simple-git';"
const source = `${originalImport}
// These are the Git APIs used by DevTools' build analysis.
export async function analyze(root) {
  const git = Git(root);
  const branch = await git.branch();
  const sha = await git.revparse(['--short', 'HEAD']);
  const clean = (await git.status()).isClean();
  return { branch: branch.current, sha, clean };
}
`

function sandbox(t) {
  const root = mkdtempSync(join(tmpdir(), 'devtools-git-patch-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return root
}

function fixture(root, { workspace = false, version = '3.4.2', name = '@nuxt/devtools', code = source } = {}) {
  const directory = join(root, workspace ? 'apps/frontend/node_modules/@nuxt/devtools' : 'node_modules/@nuxt/devtools')
  const path = join(directory, 'dist/chunks/module-main.mjs')
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ name, version, type: 'module' }))
  writeFileSync(path, code)
  return { path, directory }
}

test('repairs the ESM import and preserves the Git APIs actually used by DevTools', async t => {
  const root = sandbox(t)
  const { path } = fixture(root)
  const gitDirectory = join(root, 'node_modules/simple-git')
  mkdirSync(gitDirectory, { recursive: true })
  writeFileSync(join(gitDirectory, 'package.json'), JSON.stringify({ name: 'simple-git', version: '4.0.2', type: 'module', exports: './index.mjs' }))
  // A named-only export reproduces the relevant simple-git 4 API boundary.
  writeFileSync(join(gitDirectory, 'index.mjs'), `export function simpleGit(root) {
    if (root !== '/project') throw new Error('Wrong working directory');
    return {
      branch: async () => ({ current: 'master' }),
      revparse: async args => {
        if (JSON.stringify(args) !== '["--short","HEAD"]') throw new Error('Wrong revision options');
        return 'abc123';
      },
      status: async () => ({ isClean: () => true }),
    };
  }`)
  await assert.rejects(import(`${pathToFileURL(path).href}?before`), /does not provide an export named 'default'/)
  assert.deepEqual(patchDevtoolsGit(root), [{ path, status: 'patched' }])
  assert.equal(readFileSync(path, 'utf8'), source.replace(originalImport, patchedImport))
  const module = await import(`${pathToFileURL(path).href}?after`)
  assert.deepEqual(await module.analyze('/project'), { branch: 'master', sha: 'abc123', clean: true })
})

test('is idempotent without rewriting an already patched file', t => {
  const root = sandbox(t)
  const { path } = fixture(root)
  patchDevtoolsGit(root)
  const before = statSync(path, { bigint: true }).mtimeNs
  assert.deepEqual(patchDevtoolsGit(root), [{ path, status: 'already-patched' }])
  assert.equal(statSync(path, { bigint: true }).mtimeNs, before)
})

test('skips an installation without DevTools, such as the backend production workspace', t => {
  assert.deepEqual(patchDevtoolsGit(sandbox(t)), [])
})

test('handles a frontend-workspace installation without searching outside the project', t => {
  const root = sandbox(t)
  const { path } = fixture(root, { workspace: true })
  assert.deepEqual(patchDevtoolsGit(root), [{ path, status: 'patched' }])
})

test('rejects unsupported package versions and names without changing code', t => {
  for (const options of [{ version: '3.4.3' }, { version: '4.0.0-beta.4' }, { name: 'other-package' }]) {
    const root = sandbox(t)
    const { path } = fixture(root, options)
    assert.throws(() => patchDevtoolsGit(root), /Unsupported DevTools package/)
    assert.equal(readFileSync(path, 'utf8'), source)
  }
})

test('fails closed for missing, duplicate, mixed, or changed imports', t => {
  for (const code of [
    'export const unrelated = true;\n',
    `${source}${originalImport}\n`,
    `${source}${patchedImport}\n`,
    `${patchedImport}\n${patchedImport}\n`,
    source.replace(originalImport, 'import Git from "simple-git";'),
    `// ${originalImport}\nexport const unrelated = true;\n`,
    `${source}export { simpleGit } from 'simple-git';\n`,
  ]) {
    const root = sandbox(t)
    const { path } = fixture(root, { code })
    assert.throws(() => patchDevtoolsGit(root), /expected exactly one reviewed import/)
    assert.equal(readFileSync(path, 'utf8'), code)
  }
})

test('does not mistake a damaged installation for an absent package', t => {
  for (const damage of ['manifest', 'module']) {
    const root = sandbox(t)
    const { directory, path } = fixture(root)
    if (damage === 'manifest') writeFileSync(join(directory, 'package.json'), '{broken')
    else rmSync(path)
    assert.throws(() => patchDevtoolsGit(root))
  }
})

test('validates all installed copies before modifying any file', t => {
  const root = sandbox(t)
  const { path } = fixture(root)
  fixture(root, { workspace: true, version: '3.4.3' })
  assert.throws(() => patchDevtoolsGit(root), /Unsupported DevTools package/)
  assert.equal(readFileSync(path, 'utf8'), source)
})
