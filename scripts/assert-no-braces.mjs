import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const buildPackages = new Set(['braces', 'micromatch', 'fast-glob', 'globby'])
// Inspect module references, not generic words: picomatch calls syntax tokens
// "braces", and Prisma embeds a development manifest mentioning globby.
const codeReference = /\b(?:from\s*|(?:require|import)\s*\(\s*|import\s*)["'](?:braces|micromatch|fast-glob|globby)(?:\/[^"']*)?["']|node_modules\/(?:braces|micromatch|fast-glob|globby)\b|\bbraces\.(?:compile|expand|parse|stringify)\s*\(/

// Supplemental runtime check; the full dependency audit remains mandatory.
export function assertNoBraces(root) {
  const seen = new Set()
  let files = 0
  function walk(path) {
    let resolved
    try { resolved = realpathSync(path) } catch (error) {
      if (error.code === 'ENOENT' && path !== root) return
      throw error
    }
    if (seen.has(resolved)) return
    seen.add(resolved)
    if (buildPackages.has(basename(resolved))) throw new Error(`Build glob package found in runtime: ${path}`)
    if (statSync(resolved).isDirectory()) {
      for (const entry of readdirSync(resolved)) walk(join(resolved, entry))
    } else {
      files++
      if (basename(resolved) === 'package.json' && buildPackages.has(JSON.parse(readFileSync(resolved, 'utf8')).name)) throw new Error(`Build glob manifest found in runtime: ${path}`)
      if (/\.(?:js|mjs|cjs|map)$/.test(resolved) && codeReference.test(readFileSync(resolved, 'utf8'))) throw new Error(`Build glob reference found in runtime code: ${path}`)
    }
  }
  walk(root)
  if (!files) throw new Error('Runtime scan found no files')
  return files
}

if (process.argv[1] === '-' || (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)) {
  const root = process.argv[2] || '/app'
  console.log(`Runtime braces dependency absence check passed: ${assertNoBraces(root)} files inspected in ${root}`)
}
