import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer, type AddressInfo } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

// Never reset, migrate or seed an existing database. Only this generated database is dropped.
if (!process.env.TEST_DATABASE_URL) throw new Error('Укажите TEST_DATABASE_URL для сервера PostgreSQL с правом CREATE DATABASE');
const adminUrl = new URL(process.env.TEST_DATABASE_URL);
const name = `meal_planner_capacity_${process.pid}_${Date.now()}`;
assert.match(name, /^meal_planner_capacity_\d+_\d+$/);
const url = new URL(adminUrl);
url.pathname = `/${name}`;
url.search = '?schema=public&connection_limit=10&pool_timeout=5&connect_timeout=5&socket_timeout=30';
const admin = new PrismaClient({ datasourceUrl: adminUrl.toString() });
const fixture = new PrismaClient({ datasourceUrl: url.toString() });
const secret = 'capacity-smoke-isolated-database-secret';
let child: ChildProcess | undefined;
let created = false;
let logs = '';

async function main() {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
    created = true;
    const env = { ...process.env, DATABASE_URL: url.toString(), JWT_SECRET: secret };
    for (const args of [[require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], ['-r', 'ts-node/register', 'prisma/seed.ts']]) {
        const result = spawnSync(process.execPath, args, { env, encoding: 'utf8', timeout: 60000 });
        assert.equal(result.status, 0, result.stderr);
    }
    const accountCount = 300;
    await fixture.user.createMany({ data: Array.from({ length: accountCount }, (_, i) => ({ email: `capacity-${i}@example.test`, password: 'unused-fixture-password' })) });
    const users = await fixture.user.findMany({ orderBy: { id: 'asc' } });
    await fixture.profile.createMany({ data: users.map(user => ({ userId: user.id, weight: 80, goal: 'maintain', calories: 2400 })) });
    await fixture.product.createMany({ data: users.map(user => ({ userId: user.id, name: `Private ${user.id}`, calories: 100, protein: 10, fat: 4, carbs: 6 })) });
    const tokens = users.map(user => jwt.sign({ userId: user.id }, secret, { expiresIn: '10m' }));
    const socket = createServer();
    socket.listen(0, '127.0.0.1');
    await once(socket, 'listening');
    const port = (socket.address() as AddressInfo).port;
    await new Promise<void>(resolve => socket.close(() => resolve()));
    child = spawn(process.execPath, ['dist/src/index.js'], { env: { ...env, HOST: '127.0.0.1', PORT: String(port), GENERATION_WORKERS: '2', GENERATION_QUEUE_LIMIT: '4', NODE_ENV: 'production' }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout!.on('data', chunk => { logs = (logs + chunk.toString()).slice(-10000); });
    child.stderr!.on('data', chunk => { logs = (logs + chunk.toString()).slice(-10000); });
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let i = 0; i < 100 && !ready; i++) {
        ready = await fetch(`${base}/ready`).then(response => response.ok).catch(() => false);
        if (!ready) await delay(100);
    }
    assert.ok(ready, logs);
    const request = (index: number, path: string, body?: unknown) => fetch(`${base}${path}`, {
        method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${tokens[index % tokens.length]}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60000),
    });
    await request(0, '/products');
    const statuses: Record<number, number> = {};
    const latencies: number[] = [];
    // A compute burst overlaps reads. Excess compute must fail quickly, without taking reads down.
    const generations = Array.from({ length: 10 }, (_, index) => request(index, '/menu/generate', { daysCount: 6 }).then(async response => {
        statuses[response.status] = (statuses[response.status] || 0) + 1;
        assert.ok([201, 503].includes(response.status), JSON.stringify(await response.json()));
    }));
    const readCount = 1200;
    let next = 0;
    const start = performance.now();
    await Promise.all(Array.from({ length: 50 }, async () => {
        while (next < readCount) {
            const index = next++;
            const path = ['/products?limit=200&offset=0', '/calories/profile', '/menu/settings?limit=200&offset=0', '/menu?limit=20&offset=0'][index % 4];
            const begin = performance.now();
            const response = await request(index, path);
            const body = await response.json();
            latencies.push(performance.now() - begin);
            assert.equal(response.status, 200, JSON.stringify(body));
            if (index % 4 === 0) assert.ok(body.every((product: { userId: number | null }) => product.userId === null || product.userId === users[index % users.length].id), 'Private product leaked');
            if (index % 4 === 1) assert.equal(body.userId, users[index % users.length].id, 'Profile leaked');
        }
    }));
    const readDurationMs = performance.now() - start;
    await Promise.all(generations);
    assert.ok(statuses[201] > 0 && statuses[503] > 0, 'The bounded generation queue must accept work and shed the burst');
    assert.equal((await fetch(`${base}/ready`)).status, 200);
    const connections = await admin.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM pg_stat_activity WHERE datname = ${name}`;
    latencies.sort((a, b) => a - b);
    console.log(JSON.stringify({ accounts: accountCount, concurrentReads: 50, readRequests: readCount, readErrors: 0,
        elapsedReadMs: Math.round(readDurationMs), readRequestsPerSecond: Math.round(readCount / readDurationMs * 1000),
        readP50Ms: Math.round(latencies[Math.floor(latencies.length * 0.5)]), readP95Ms: Math.round(latencies[Math.floor(latencies.length * 0.95)]), readMaxMs: Math.round(latencies.at(-1)!),
        generationBurst: statuses, databaseConnectionsIncludingFixtureClient: Number(connections[0].count),
        note: 'Local smoke, 300 accounts with 50 concurrent reads; not a production capacity guarantee.' }, null, 2));
    child.kill('SIGTERM');
    const [code] = await once(child, 'exit');
    assert.equal(code, 0, `Graceful shutdown failed: ${logs}`);
}

main().catch(error => { console.error(error); console.error(logs); process.exitCode = 1; }).finally(async () => {
    if (child && child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await once(child, 'exit'); }
    await fixture.$disconnect();
    if (created) await admin.$executeRawUnsafe(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.$disconnect();
});
