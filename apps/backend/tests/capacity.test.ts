import type {} from '../types';
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { setTimeout as delay } from 'node:timers/promises';
import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import type { AddressInfo } from 'node:net';
import { generationAdmission, requestCapacity } from '../middleware/capacity';
import { pooledDatabaseUrl, validateProductionSecret } from '../utils/config';
import { GenerationPool } from '../services/generation-pool';
import { normalizeMeals, targetFromWeight } from '../services/generator';
import { catalogCandidates } from './helpers/catalog';

const input = {
    candidates: catalogCandidates, daysCount: 1, meals: normalizeMeals(2400), dayTarget: targetFromWeight(2400, 80),
    settings: { minScale: 0.5, maxScale: 1.8, candidateLimit: 18, scoreWeights: { calories: 5, protein: 1.5, fat: 1, carbs: 1 } },
};

test('database pool defaults are bounded and explicit deployment settings win', () => {
    const defaults = new URL(pooledDatabaseUrl('postgresql://local@localhost/test')!);
    assert.equal(defaults.searchParams.get('connection_limit'), '10');
    assert.equal(defaults.searchParams.get('pool_timeout'), '5');
    assert.equal(new URL(pooledDatabaseUrl('postgresql://local@localhost/test?connection_limit=4')!).searchParams.get('connection_limit'), '4');
});

test('production refuses short or documented placeholder JWT secrets without changing development secrets', () => {
    assert.throws(() => validateProductionSecret(undefined, 'production'), /JWT_SECRET/);
    assert.throws(() => validateProductionSecret('short', 'production'), /32 байт/);
    assert.throws(() => validateProductionSecret('replace-with-a-random-secret-at-least-32-characters', 'production'), /env.example/);
    assert.doesNotThrow(() => validateProductionSecret('f903b5408780d657377be89b2e3f9da5c71d52a53d6965c28cdb52b95244594d', 'production'));
    assert.doesNotThrow(() => validateProductionSecret('existing-local-secret', 'development'));
});

test('generation runs off the event loop, rejects overflow, cancels jobs and recovers', async () => {
    const pool = new GenerationPool({ workers: 1, queueLimit: 1, timeoutMs: 30000 });
    try {
        const controller = new AbortController();
        const first = pool.run(input, controller.signal);
        const rejected = assert.rejects(first, /отменён/);
        const second = pool.run(input);
        await assert.rejects(pool.run(input), /много меню/);
        await delay(10);
        controller.abort();
        await rejected;
        const result = await second;
        assert.equal(result.pickedMeals.length, input.meals.length);
        assert.ok(result.total.calories > 0);
        assert.equal((await pool.run(input)).pickedMeals.length, input.meals.length);
    } finally { await pool.close(); }
    await assert.rejects(pool.run(input), /перезапускается/);
});

test('generation deadline terminates computation and releases its slot', async () => {
    const pool = new GenerationPool({ workers: 1, queueLimit: 0, timeoutMs: 1 });
    try { await assert.rejects(pool.run(input), /много времени/); }
    finally { await pool.close(); }
});

test('closing a generation pool settles both running and queued requests', async () => {
    const pool = new GenerationPool({ workers: 1, queueLimit: 1, timeoutMs: 30000 });
    const running = assert.rejects(pool.run(input), /перезапускается/);
    const waiting = assert.rejects(pool.run(input), /перезапускается/);
    await pool.close();
    await Promise.all([running, waiting]);
});

test('a late close from a completed generation cannot release the same user’s newer request', () => {
    const admission = generationAdmission(1);
    const request = { userId: 1 } as Request;
    const response = () => Object.assign(new EventEmitter(), {
        code: 0, setHeader() {}, status(code: number) { this.code = code; return this; }, json() {},
    });
    const first = response();
    const second = response();
    const third = response();
    let admitted = 0;
    admission(request, first as unknown as Response, () => { admitted++; });
    first.emit('finish');
    admission(request, second as unknown as Response, () => { admitted++; });
    first.emit('close');
    admission(request, third as unknown as Response, () => { admitted++; });
    assert.equal(admitted, 2);
    assert.equal(third.code, 429);
    second.emit('close');
});

test('request admission isolates duplicate users and releases capacity after responses', async () => {
    const app = express();
    app.use((req, _res, next) => { req.userId = Number(req.headers['x-test-user']); next(); });
    const release: Array<() => void> = [];
    app.get('/', requestCapacity(3), generationAdmission(2), async (_req, res) => {
        await new Promise<void>(resolve => release.push(resolve));
        res.json({ ok: true });
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const request = (user: number) => fetch(url, { headers: { 'x-test-user': String(user) } });
    try {
        const first = request(1);
        while (!release.length) await delay(5);
        assert.equal((await request(1)).status, 429);
        const second = request(2);
        while (release.length < 2) await delay(5);
        const busy = await request(3);
        assert.equal(busy.status, 503);
        assert.equal(busy.headers.get('Retry-After'), '5');
        release.splice(0).forEach(done => done());
        assert.equal((await first).status, 200);
        assert.equal((await second).status, 200);
        const third = request(3);
        while (!release.length) await delay(5);
        release.splice(0).forEach(done => done());
        assert.equal((await third).status, 200);
    } finally {
        release.splice(0).forEach(done => done());
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
    }
});
