import { before, beforeEach, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from 'dotenv';
import { setFeedbackAdmin } from '../../services/feedback-admin';

config({ quiet: true });
const testDatabase = `meal_planner_feedback_${process.pid}_${Date.now()}`;
const databaseUrl = new URL(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
if (!process.env.TEST_DATABASE_URL && !['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname)) throw new Error('Для удалённой БД укажите TEST_DATABASE_URL явно');
const databaseAdmin = new PrismaClient({ datasourceUrl: databaseUrl.toString() });
databaseUrl.pathname = `/${testDatabase}`;
databaseUrl.searchParams.set('schema', 'public');
process.env.DATABASE_URL = databaseUrl.toString();
process.env.JWT_SECRET = 'feedback-test-secret-not-for-production';
let prisma: PrismaClient;
let server: Server;
let base = '';
let userA = 0;
let userB = 0;
let adminId = 0;
let tokenA = '';
let tokenB = '';
let adminToken = '';
const tokenFor = (userId: number, claims = {}) => jwt.sign({ userId, ...claims }, process.env.JWT_SECRET!, { expiresIn: '1h' });
const payload = () => ({ requestId: randomUUID(), category: 'idea', message: 'Хочу сохранять любимые рецепты', pagePath: '/recipes/:id', deviceType: 'mobile' });

async function request(path: string, method = 'GET', body?: unknown, token = tokenA) {
    const response = await fetch(`${base}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json(), headers: response.headers };
}

describe('durable feedback and permissions on isolated PostgreSQL', { concurrency: false }, () => {
    before(async () => {
        assert.match(testDatabase, /^meal_planner_feedback_\d+_\d+$/);
        await databaseAdmin.$executeRawUnsafe(`CREATE DATABASE "${testDatabase}"`);
        const migration = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { env: process.env, encoding: 'utf8' });
        assert.equal(migration.status, 0, migration.stderr);
        prisma = (await import('../../prisma')).default;
        const { hashPassword } = await import('../../utils/hash');
        const password = await hashPassword('Feedback-password-123');
        const a = await prisma.user.create({ data: { email: 'feedback-a@example.test', password } });
        const b = await prisma.user.create({ data: { email: 'feedback-b@example.test', password } });
        const admin = await prisma.user.create({ data: { email: 'feedback-admin@example.test', password, canManageFeedback: true } });
        userA = a.id; userB = b.id; adminId = admin.id;
        tokenA = tokenFor(userA); tokenB = tokenFor(userB); adminToken = tokenFor(adminId);
        const { app } = await import('../../src/app');
        server = await new Promise<Server>(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
        base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });
    beforeEach(async () => { await prisma.feedback.deleteMany(); });
    after(async () => {
        if (server) await new Promise<void>(resolve => server.close(() => resolve()));
        if (prisma) await prisma.$disconnect();
        assert.match(testDatabase, /^meal_planner_feedback_\d+_\d+$/);
        await databaseAdmin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${testDatabase}" WITH (FORCE)`);
        await databaseAdmin.$disconnect();
    });
    it('requires sign-in and keeps own history private even with foreign cursors or spoofed fields', async () => {
        assert.equal((await request('/feedback', 'POST', payload(), '')).status, 401);
        assert.equal((await request('/feedback', 'GET', undefined, '')).status, 401);
        const input = payload();
        const created = await request('/feedback', 'POST', { ...input, userId: userB, status: 'done', reply: 'fake', version: 99, author: { id: userB } });
        assert.equal(created.status, 201);
        assert.equal(created.body.status, 'new'); assert.equal(created.body.reply, ''); assert.equal(created.body.version, 1);
        assert.equal((await prisma.feedback.findUniqueOrThrow({ where: { id: created.body.id } })).userId, userA);
        assert.equal('userId' in created.body, false); assert.equal('author' in created.body, false);
        const other = await request('/feedback', 'POST', input, tokenB);
        assert.equal(other.status, 201, 'request ids are scoped to an account');
        for (const path of ['/feedback', `/feedback?cursor=${other.body.id + 1}`]) {
            const history = await request(path);
            assert.deepEqual(history.body.items.map((item: { id: number }) => item.id), [created.body.id]);
            assert.equal(history.body.nextCursor, null);
            assert.equal('author' in history.body.items[0], false);
        }
    });
    it('deduplicates ten concurrent retries without using quota and rejects changed payload', async () => {
        const input = payload();
        const results = await Promise.all(Array.from({ length: 10 }, () => request('/feedback', 'POST', input)));
        assert.equal(results.filter(result => result.status === 201).length, 1);
        assert.equal(results.filter(result => result.status === 200).length, 9);
        assert.equal(new Set(results.map(result => result.body.id)).size, 1);
        assert.equal(await prisma.feedback.count(), 1);
        assert.equal((await request('/feedback', 'POST', { ...input, message: 'Другой текст для того же запроса' })).status, 409);
        for (let index = 0; index < 4; index++) assert.equal((await request('/feedback', 'POST', payload())).status, 201);
        assert.equal((await request('/feedback', 'POST', payload())).status, 429);
        assert.equal((await request('/feedback', 'POST', input)).status, 200, 'a retry still works after quota is reached');
    });
    it('enforces persisted burst limits under concurrency and leaves other accounts available', async () => {
        const results = await Promise.all(Array.from({ length: 10 }, () => request('/feedback', 'POST', payload())));
        assert.equal(results.filter(result => result.status === 201).length, 5, JSON.stringify(results));
        const limited = results.filter(result => result.status === 429);
        assert.equal(limited.length, 5);
        assert.ok(limited.every(result => Number(result.headers.get('Retry-After')) > 0 && result.body.retryAfterSeconds <= 600));
        assert.equal(await prisma.feedback.count({ where: { userId: userA } }), 5);
        assert.equal((await request('/feedback', 'POST', payload(), tokenB)).status, 201);
    });
    it('enforces the rolling daily limit from stored submissions and lets expired entries fall out', async () => {
        const now = Date.now();
        await prisma.feedback.createMany({ data: Array.from({ length: 20 }, (_, index) => ({ userId: userA, requestId: randomUUID(), category: 'other', message: 'Уже отправленное обращение', createdAt: new Date(now - (index === 19 ? 23 : 2) * 3600000) })) });
        const limited = await request('/feedback', 'POST', payload());
        assert.equal(limited.status, 429);
        assert.ok(limited.body.retryAfterSeconds > 3500 && limited.body.retryAfterSeconds <= 3600);
        const oldest = await prisma.feedback.findFirstOrThrow({ orderBy: { createdAt: 'asc' } });
        await prisma.feedback.update({ where: { id: oldest.id }, data: { createdAt: new Date(now - 25 * 3600000) } });
        assert.equal((await request('/feedback', 'POST', payload())).status, 201);
    });
    it('paginates stably while new feedback arrives and filters the admin inbox', async () => {
        await prisma.feedback.createMany({ data: Array.from({ length: 5 }, (_, index) => ({ userId: userA, requestId: randomUUID(), category: index % 2 ? 'bug' : 'idea', status: index % 2 ? 'planned' : 'new', message: 'Обращение для списка', createdAt: new Date(Date.now() - 3600000) })) });
        const first = await request('/feedback?limit=2');
        assert.equal(first.body.items.length, 2);
        assert.equal(first.body.nextCursor, first.body.items[1].id);
        assert.equal((await request('/feedback', 'POST', payload())).status, 201);
        const second = await request(`/feedback?limit=2&cursor=${first.body.nextCursor}`);
        const third = await request(`/feedback?limit=2&cursor=${second.body.nextCursor}`);
        const ids = [...first.body.items, ...second.body.items, ...third.body.items].map((item: { id: number }) => item.id);
        assert.equal(ids.length, 5); assert.equal(new Set(ids).size, 5); assert.equal(third.body.nextCursor, null);
        const inbox = await request('/feedback/admin?category=bug&status=planned', 'GET', undefined, adminToken);
        assert.equal(inbox.status, 200); assert.equal(inbox.body.items.length, 2);
        assert.ok(inbox.body.items.every((item: { author: { id: number; email: string } }) => item.author.id === userA && item.author.email === 'feedback-a@example.test'));
        assert.equal('password' in inbox.body.items[0].author, false);
        assert.equal((await request('/feedback?limit=51')).status, 400);
        assert.equal((await request('/feedback/admin?status=wrong', 'GET', undefined, adminToken)).status, 400);
    });
    it('trusts only the current dedicated database capability and never self-promotes through registration', async () => {
        const registered = await request('/auth/register', 'POST', { email: 'feedback-spoof@example.test', password: 'Feedback-password-123', role: 'admin', canManageFeedback: true }, '');
        assert.equal(registered.status, 201); assert.equal(registered.body.user.canManageFeedback, false);
        assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: registered.body.user.id } })).role, 'user');
        assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: registered.body.user.id } })).canManageFeedback, false);
        for (const token of [tokenA, registered.body.token, tokenFor(userA, { role: 'admin', canManageFeedback: true })]) {
            assert.equal((await request('/feedback/admin', 'GET', undefined, token)).status, 403);
            assert.equal((await request('/feedback/admin/1', 'GET', undefined, token)).status, 403);
            assert.equal((await request('/feedback/admin/1', 'PATCH', { status: 'done', reply: '', version: 1 }, token)).status, 403);
        }
        assert.equal((await request('/auth/me', 'GET', undefined, adminToken)).body.canManageFeedback, true);
        const login = await request('/auth/login', 'POST', { email: 'feedback-admin@example.test', password: 'Feedback-password-123' }, '');
        assert.equal(login.body.user.canManageFeedback, true);
        await prisma.user.update({ where: { id: adminId }, data: { canManageFeedback: false } });
        assert.equal((await request('/feedback/admin', 'GET', undefined, adminToken)).status, 403);
        assert.equal((await request('/auth/me', 'GET', undefined, adminToken)).body.canManageFeedback, false);
        await prisma.user.update({ where: { id: adminId }, data: { canManageFeedback: true } });
    });
    it('does not grant feedback access from the broader admin role', async () => {
        const broadAdmin = await prisma.user.create({ data: { email: 'feedback-broad-admin@example.test', password: 'unused', role: 'admin' } });
        const token = tokenFor(broadAdmin.id, { role: 'admin', canManageFeedback: true });
        assert.equal((await request('/auth/me', 'GET', undefined, token)).body.canManageFeedback, false);
        assert.equal((await request('/feedback/admin', 'GET', undefined, token)).status, 403);
        assert.equal((await request('/feedback/admin/1', 'GET', undefined, token)).status, 403);
        assert.equal((await request('/feedback/admin/1', 'PATCH', { status: 'done', reply: '', version: 1 }, token)).status, 403);
    });
    it('publishes replies only to the owner and prevents simultaneous administrator overwrites', async () => {
        const created = await request('/feedback', 'POST', payload());
        const results = await Promise.all(['Первый ответ', 'Второй ответ'].map(reply => request(`/feedback/admin/${created.body.id}`, 'PATCH', { status: 'in_progress', reply, version: 1 }, adminToken)));
        assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
        const accepted = results.find(result => result.status === 200)!;
        assert.equal(accepted.body.version, 2);
        assert.equal(accepted.body.author.id, userA);
        assert.deepEqual((await request(`/feedback/admin/${created.body.id}`, 'GET', undefined, adminToken)).body, accepted.body);
        assert.equal((await request('/feedback/admin/2147483647', 'GET', undefined, adminToken)).status, 404);
        const own = await request('/feedback');
        assert.equal(own.body.items[0].reply, accepted.body.reply);
        assert.equal(own.body.items[0].status, 'in_progress');
        assert.equal((await request('/feedback', 'GET', undefined, tokenB)).body.items.length, 0);
        const updated = await request(`/feedback/admin/${created.body.id}`, 'PATCH', { status: 'done', reply: 'Готово, спасибо!', version: 2 }, adminToken);
        assert.equal(updated.status, 200); assert.equal(updated.body.version, 3);
        assert.equal((await request('/feedback/admin/2147483647', 'PATCH', { status: 'done', reply: '', version: 1 }, adminToken)).status, 404);
    });
    it('rejects sensitive route values and oversize input without writing a row', async () => {
        for (const invalid of [{ pagePath: '/recipes/123' }, { pagePath: '/menu?plan=1' }, { pagePath: 'https://host/menu' }, { message: 'x'.repeat(4001) }, { deviceType: 'raw user-agent' }, { requestId: 'bad' }]) {
            assert.equal((await request('/feedback', 'POST', { ...payload(), ...invalid })).status, 400);
        }
        assert.equal(await prisma.feedback.count(), 0);
    });
    it('requires one existing account for explicit feedback grants and preserves all existing roles', async () => {
        await assert.rejects(setFeedbackAdmin(prisma, 'missing-owner@example.test', 'grant'), /не найден/);
        assert.equal(await prisma.user.count({ where: { email: 'missing-owner@example.test' } }), 0);
        const granted = await setFeedbackAdmin(prisma, ' FEEDBACK-B@example.test ', 'grant');
        assert.equal(granted.id, userB); assert.equal(granted.canManageFeedback, true);
        assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: userB } })).role, 'user');
        assert.equal((await request('/feedback/admin', 'GET', undefined, tokenB)).status, 200);
        await setFeedbackAdmin(prisma, 'feedback-b@example.test', 'revoke');
        assert.equal((await request('/feedback/admin', 'GET', undefined, tokenB)).status, 403);
        assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: userB } })).role, 'user');
        for (const role of ['admin', 'custom-reviewer']) {
            await prisma.user.update({ where: { id: userB }, data: { role } });
            await setFeedbackAdmin(prisma, 'feedback-b@example.test', 'grant');
            assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: userB } })).role, role);
            await setFeedbackAdmin(prisma, 'feedback-b@example.test', 'revoke');
            const user = await prisma.user.findUniqueOrThrow({ where: { id: userB } });
            assert.equal(user.role, role); assert.equal(user.canManageFeedback, false);
        }
        await prisma.user.createMany({ data: [{ email: 'ambiguous@example.test', password: 'unused' }, { email: 'Ambiguous@example.test', password: 'unused' }] });
        await assert.rejects(setFeedbackAdmin(prisma, 'AMBIGUOUS@example.test', 'grant'), /несколько/);
        assert.equal(await prisma.user.count({ where: { email: { equals: 'ambiguous@example.test', mode: 'insensitive' }, canManageFeedback: true } }), 0);
    });
});
