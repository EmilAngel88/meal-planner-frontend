import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const script = resolve('scripts/deploy-release.sh')
function deploy(scenario) {
  const root = mkdtempSync(join(tmpdir(), 'meal-deploy-'))
  const app = join(root, 'app'), release = join(app, 'releases', 'test'), bin = join(root, 'bin')
  mkdirSync(join(release, 'docker'), { recursive: true })
  mkdirSync(bin)
  writeFileSync(join(app, '.env'), 'POSTGRES_PASSWORD=test-only\n')
  writeFileSync(join(release, 'images.env'), 'BACKEND_IMAGE=new-backend\nFRONTEND_IMAGE=new-frontend\nMIGRATE_IMAGE=new-migrate\n')
  const log = join(root, 'calls.jsonl')
  const mock = `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
const tool = require('node:path').basename(process.argv[1]);
fs.appendFileSync(process.env.CALL_LOG, JSON.stringify({tool, args, backend:process.env.BACKEND_IMAGE, frontend:process.env.FRONTEND_IMAGE})+'\\n');
const has = value => args.includes(value);
const fail = process.env.SCENARIO;
if (tool === 'docker') {
  if (has('pull') && fail === 'pull') process.exit(1);
  if (has('ps')) console.log(has('backend')?'old-api':'old-web');
  if (has('inspect')) console.log(args.at(-1)==='old-api'?'sha256:old-api':'sha256:old-web');
  if (has('pg_dump')) process.stdout.write('test archive');
  if (has('pg_restore') && fail === 'backup') process.exit(1);
  if (has('run') && fail === 'migration') process.exit(1);
  if (has('up') && has('backend') && fail === 'startup' && !process.env.BACKEND_IMAGE) process.exit(1);
}
if (tool === 'curl' && fail === 'health') process.exit(1);
if (tool === 'mv') fs.renameSync(args.at(-2), args.at(-1));
`
  for (const tool of ['docker', 'flock', 'curl', 'mv']) writeFileSync(join(bin, tool), mock, { mode: 0o755 })
  const result = spawnSync('bash', [script, app, release, 'false', 'https://app.example.com/health'], {
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, CALL_LOG: log, SCENARIO: scenario }, encoding: 'utf8',
  })
  const calls = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line)) : []
  return { root, app, release, result, calls }
}
const is = (call, command) => call.tool === 'docker' && call.args.includes(command)
for (const scenario of ['success', 'pull', 'backup', 'migration', 'startup', 'health']) {
  test(`Deployment ${scenario}: preserve data and only switch verified images`, () => {
    const run = deploy(scenario)
    try {
      const { result, calls, app, release } = run
      assert.equal(result.status, scenario === 'success' ? 0 : 1, result.stderr)
      assert.equal(calls.some(call => call.args.includes('down')), false)
      const migrations = calls.filter(call => is(call, 'run'))
      const rollouts = calls.filter(call => is(call, 'up') && call.args.includes('backend'))
      if (['pull', 'backup'].includes(scenario)) assert.equal(migrations.length, 0)
      if (['pull', 'backup', 'migration'].includes(scenario)) assert.equal(rollouts.length, 0)
      if (['startup', 'health'].includes(scenario)) {
        assert.equal(rollouts.length, 2)
        assert.equal(rollouts[1].backend, 'sha256:old-api')
        assert.equal(rollouts[1].frontend, 'sha256:old-web')
        assert.equal(existsSync(join(app, 'current-release')), false)
      }
      if (scenario === 'success') {
        assert.equal(rollouts.length, 1)
        assert.ok(calls.findIndex(call => is(call, 'pg_restore')) < calls.findIndex(call => is(call, 'run')))
        assert.ok(existsSync(join(app, 'backups/pre-test.dump')))
        assert.equal(realpathSync(join(app, 'current-release')), realpathSync(release))
      }
    } finally { rmSync(run.root, { recursive: true, force: true }) }
  })
}
