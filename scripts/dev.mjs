import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
if (Number(process.versions.node.split('.')[0]) < 22) {
  console.error('Для проекта нужен Node.js 22 или новее. Выполните nvm use.'); process.exit(1)
}
const root = fileURLToPath(new URL('..', import.meta.url))
const children = ['backend', 'frontend'].map(app => spawn(process.execPath, [process.env.npm_execpath, '--prefix', `apps/${app}`, 'run', 'dev'], { cwd: root, stdio: 'inherit', detached: process.platform !== 'win32' }))
let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    try { if (process.platform === 'win32') child.kill(); else process.kill(-child.pid, 'SIGTERM') } catch { /* already stopped */ }
  }
  process.exitCode = code
}
for (const child of children) {
  child.on('error', error => { console.error(error.message); stop(1) })
  child.on('exit', code => stop(code ?? 0))
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
