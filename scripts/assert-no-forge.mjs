import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'

export function assertNoForge(root) {
  const seen = new Set()
  let files = 0
  function walk(path) {
    let resolved
    try { resolved = realpathSync(path) } catch (error) {
      // npm workspace installs may contain dangling links to omitted workspaces.
      if (error.code === 'ENOENT' && path !== root) return
      throw error
    }
    if (seen.has(resolved)) return
    seen.add(resolved)
    if (basename(resolved) === 'node-forge') throw new Error(`node-forge found in runtime: ${path}`)
    if (statSync(resolved).isDirectory()) {
      for (const entry of readdirSync(resolved)) walk(join(resolved, entry))
    } else {
      files++
      if (basename(resolved) === 'package.json' && JSON.parse(readFileSync(resolved, 'utf8')).name === 'node-forge') throw new Error(`node-forge manifest found: ${path}`)
      if (/\.(?:js|mjs|cjs)$/.test(resolved) && /node-forge/.test(readFileSync(resolved, 'utf8'))) throw new Error(`node-forge reference found in runtime code: ${path}`)
    }
  }
  walk(root)
  if (!files) throw new Error('Runtime scan found no files')
  return files
}

if (process.argv[1] === '-' || (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)) {
  const root = process.argv[2] || '/app'
  console.log(`Runtime node-forge absence check passed: ${assertNoForge(root)} files inspected in ${root}`)
}
