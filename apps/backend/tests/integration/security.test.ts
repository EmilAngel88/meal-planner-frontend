import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config({ quiet: true });
const testDatabase = `meal_planner_security_${process.pid}_${Date.now()}`;
const databaseUrl = new URL(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
if (!process.env.TEST_DATABASE_URL && !['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname)) throw new Error('Для удалённой БД укажите TEST_DATABASE_URL явно');
const admin = new PrismaClient({ datasourceUrl: databaseUrl.toString() });
databaseUrl.pathname = `/${testDatabase}`;
databaseUrl.searchParams.set('schema', 'public');
process.env.DATABASE_URL = databaseUrl.toString();
process.env.JWT_SECRET = 'security-test-secret-not-for-production';
let prisma: PrismaClient;
let server: Server;
let base = '';
let tokenA = '';
let tokenB = '';
let userA = 0;
let userB = 0;
const product = { name: 'Мой продукт', calories: 200, protein: 20, fat: 10, carbs: 5 };

async function request(path: string, method = 'GET', body?: unknown, token = tokenA) {
    const response = await fetch(`${base}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: response.status === 204 ? null : await response.json(), headers: response.headers };
}

describe('security and pagination on isolated PostgreSQL', { concurrency: false }, () => {
    before(async () => {
        assert.match(testDatabase, /^meal_planner_security_\d+_\d+$/);
        await admin.$executeRawUnsafe(`CREATE DATABASE "${testDatabase}"`);
        const migration = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { env: process.env, encoding: 'utf8' });
        assert.equal(migration.status, 0, migration.stderr);
        prisma = (await import('../../prisma')).default;
        const { app } = await import('../../src/app');
        server = await new Promise<Server>(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
        base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        const a = await request('/auth/register', 'POST', { email: 'security-a@example.test', password: 'Test-pass-123' }, '');
        const b = await request('/auth/register', 'POST', { email: 'security-b@example.test', password: 'Test-pass-123' }, '');
        assert.equal(a.status, 201); assert.equal(b.status, 201);
        tokenA = a.body.token; userA = a.body.user.id;
        tokenB = b.body.token; userB = b.body.user.id;
    });
    after(async () => {
        if (server) await new Promise<void>(resolve => server.close(() => resolve()));
        if (prisma) await prisma.$disconnect();
        assert.match(testDatabase, /^meal_planner_security_\d+_\d+$/);
        await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${testDatabase}" WITH (FORCE)`);
        await admin.$disconnect();
    });
    it('does not distinguish incorrect credentials from an unknown email', async () => {
        const known = await request('/auth/login', 'POST', { email: 'security-a@example.test', password: 'Wrong password' }, '');
        const unknown = await request('/auth/login', 'POST', { email: 'unknown@example.test', password: 'Wrong password' }, '');
        assert.equal(known.status, 401);
        assert.equal(unknown.status, 401);
        assert.deepEqual(known.body, unknown.body);
    });
    it('prevents concurrent normalized duplicates without blocking different owners', async () => {
        const names = ['Ёгурт', 'ёгурт', 'ЕГУРТ', 'егурт', 'ЁГУРТ'];
        const responses = await Promise.all(names.map(name => request('/products', 'POST', { ...product, name, brand: 'Марка' })));
        assert.equal(responses.filter(response => response.status === 201).length, 1, JSON.stringify(responses.map(response => response.body)));
        assert.equal(responses.filter(response => response.status === 409).length, 4);
        assert.equal((await request('/products', 'POST', { ...product, name: 'Егурт', brand: 'Марка' }, tokenB)).status, 201);
    });
    it('paginates catalogs and weight logs without leaking the other account', async () => {
        await prisma.product.createMany({ data: Array.from({ length: 205 }, (_, index) => ({ ...product, name: `Продукт ${String(index).padStart(3, '0')}`, userId: userA })) });
        await prisma.recipe.createMany({ data: Array.from({ length: 205 }, () => ({ title: 'Одинаковое название', description: '', userId: userA })) });
        await prisma.recipe.create({ data: { title: 'Чужой рецепт', description: '', userId: userB } });
        await prisma.weightLog.createMany({ data: Array.from({ length: 205 }, (_, index) => ({ weight: 70 + index / 100, userId: userA, date: new Date('2026-09-01') })) });
        await prisma.weightLog.create({ data: { weight: 100, userId: userB } });
        for (const [path, expected] of [['/products', 206], ['/recipes', 205], ['/calories/logs', 205]] as const) {
            const first = await request(path);
            const second = await request(`${path}?offset=200&limit=200`);
            assert.equal(first.status, 200);
            assert.equal(first.body.length, 200);
            const rows = [...first.body, ...second.body] as Array<{ id: number; userId: number }>;
            assert.equal(rows.length, expected);
            assert.equal(new Set(rows.map(row => row.id)).size, expected);
            assert.ok(rows.every(row => row.userId === userA));
            assert.equal((await request(`${path}?limit=201`)).status, 400);
        }
        const search = await request(`/products?q=${encodeURIComponent('еГУРТ мАрКа')}&limit=1`);
        assert.equal(search.body.length, 1);
        assert.equal(search.body[0].userId, userA);
        assert.equal((await request(`/products?q=${encodeURIComponent('еГУРТ мАрКа')}&limit=1&offset=1`)).body.length, 0);
        assert.equal((await request('/products?q=one&q=two')).status, 400);
    });
    it('enforces ownership in mutation conditions and strips privileged input', async () => {
        const ownProduct = await request('/products', 'POST', { ...product, name: 'Защищённый продукт', userId: userB, isBase: true, visibility: 'public' });
        assert.equal(ownProduct.status, 201);
        assert.equal(ownProduct.body.userId, userA);
        assert.equal(ownProduct.body.isBase, false);
        assert.equal((await request(`/products/${ownProduct.body.id}`, 'DELETE', undefined, tokenB)).status, 404);
        assert.equal((await request(`/products/${ownProduct.body.id}`, 'PUT', product, tokenB)).status, 404);
        const recipe = await request('/recipes', 'POST', { title: 'Защищённый рецепт', ingredients: [{ productId: ownProduct.body.id, weight: 100 }], userId: userB, isBase: true });
        assert.equal(recipe.status, 201);
        assert.equal(recipe.body.userId, userA);
        assert.equal(recipe.body.isBase, false);
        assert.equal((await request(`/recipes/${recipe.body.id}`, 'PUT', { title: 'Чужое изменение' }, tokenB)).status, 404);
        assert.equal((await request(`/recipes/${recipe.body.id}`, 'DELETE', undefined, tokenB)).status, 404);
        assert.equal((await request('/recipes', 'POST', { title: 'Недоступный состав', ingredients: [{ productId: ownProduct.body.id, weight: 100 }] }, tokenB)).status, 400);
        assert.equal((await request('/recipes', 'POST', { title: 'Неверный id', ingredients: [{ productId: true, weight: 100 }] })).status, 400);
        const log = await prisma.weightLog.findFirstOrThrow({ where: { userId: userA } });
        assert.equal((await request(`/calories/logs/${log.id}`, 'DELETE', undefined, tokenB)).status, 404);
        assert.equal((await request(`/recipes/${recipe.body.id}`, 'DELETE')).status, 204);
        assert.equal((await request(`/products/${ownProduct.body.id}`, 'DELETE')).status, 204);
    });
});
