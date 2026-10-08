import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const supportedVersion = '3.4.2'
const originalImport = "import Git from 'simple-git';"
const patchedImport = "import { simpleGit as Git } from 'simple-git';"
const modulePath = 'dist/chunks/module-main.mjs'

// DevTools 3.4.2 uses the factory's stable branch/revparse/status APIs, but
// simple-git 4 removed its default export. Keep this compatibility change
// restricted to that import; dependency versions remain owned by the lockfile.
export function patchDevtoolsGit(root) {
  const packageDirectories = [
    join(root, 'node_modules/@nuxt/devtools'),
    join(root, 'apps/frontend/node_modules/@nuxt/devtools'),
  ]
  // Validate every installed copy before writing any of them.
  const plans = packageDirectories.filter(existsSync).map(directory => {
    const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
    if (manifest.name !== '@nuxt/devtools' || manifest.version !== supportedVersion) {
      throw new Error(`Unsupported DevTools package at ${directory}: expected @nuxt/devtools@${supportedVersion}`)
    }
    const path = join(directory, modulePath)
    const source = readFileSync(path, 'utf8')
    const lines = source.split('\n')
    const originalCount = lines.filter(line => line === originalImport).length
    const patchedCount = lines.filter(line => line === patchedImport).length
    const references = source.split('simple-git').length - 1
    if (references !== 1 || originalCount + patchedCount !== 1) {
      throw new Error(`Unsupported DevTools Git import in ${path}: expected exactly one reviewed import`)
    }
    return { path, source, status: patchedCount ? 'already-patched' : 'patched' }
  })
  for (const plan of plans) {
    if (plan.status === 'patched') writeFileSync(plan.path, plan.source.replace(originalImport, patchedImport))
  }
  return plans.map(({ path, status }) => ({ path, status }))
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
    const results = patchDevtoolsGit(root)
    if (!results.length) console.log('DevTools Git compatibility patch: package absent; skipped.')
    else for (const { path, status } of results) console.log(`DevTools Git compatibility patch: ${status}: ${path}`)
  } catch (error) {
    console.error(`DevTools Git compatibility patch failed: ${error.message}`)
    process.exitCode = 1
  }
}
