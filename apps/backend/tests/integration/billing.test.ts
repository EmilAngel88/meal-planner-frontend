import { before, beforeEach, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaClient, type Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from 'dotenv';
import { defaultBillingConfig, type BillingConfig, addDays } from '../../services/billing/config';
import type { PaymentGateway, ProviderPayment } from '../../services/billing/provider';

config({ quiet: true });
const testDatabase = `meal_planner_billing_${process.pid}_${Date.now()}`;
const databaseUrl = new URL(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
if (!process.env.TEST_DATABASE_URL && !['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname)) throw new Error('Для удалённой БД укажите TEST_DATABASE_URL явно');
const databaseAdmin = new PrismaClient({ datasourceUrl: databaseUrl.toString() });
databaseUrl.pathname = `/${testDatabase}`; databaseUrl.searchParams.set('schema', 'public');
Object.assign(process.env, { DATABASE_URL: databaseUrl.toString(), JWT_SECRET: 'billing-test-secret-not-for-production', BILLING_PAYMENT_MODE: 'test', YOOKASSA_SHOP_ID: '123', YOOKASSA_SECRET_KEY: 'test-only-secret', BILLING_RETURN_URL: 'https://example.test/billing', YOOKASSA_RECEIPT_MODE: 'external' });
let prisma: PrismaClient, server: Server, base = '', userA = 0, userB = 0, adminId = 0, tokenA = '', tokenB = '', adminToken = '';
let access: typeof import('../../services/billing/access'), orders: typeof import('../../services/billing/orders');
const nativeFetch = globalThis.fetch;
const tokenFor = (userId: number, claims = {}) => jwt.sign({ userId, ...claims }, process.env.JWT_SECRET!, { expiresIn: '1h' });
async function request(path: string, method = 'GET', body?: unknown, token = tokenA) {
    const response = await nativeFetch(`${base}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
}
const enabledConfig = (): BillingConfig => ({ ...structuredClone(defaultBillingConfig), enabled: true, salesEnabled: true });
async function settings(value = enabledConfig(), version = 1) { await prisma.billingSettings.upsert({ where: { id: 1 }, create: { id: 1, config: value, version }, update: { config: value, version } }); }
const newInput = () => ({ requestId: randomUUID(), offerId: 'month', version: 1 });
function fakeGateway() {
    const payments = new Map<string, ProviderPayment>();
    const requests: { key: string; body: unknown }[] = [];
    const gateway: PaymentGateway = { mode: 'test', merchantId: '123', requestFor: (order, email) => ({ order_id: order.id, amountMinor: order.amountMinor, email }),
        async create(key, body) {
            requests.push({ key, body });
            const input = body as { order_id: string; amountMinor: number };
            if (!payments.has(key)) payments.set(key, { id: key, status: 'pending', paid: false, test: true, amount: { value: (input.amountMinor / 100).toFixed(2), currency: 'RUB' }, recipient: { account_id: '123' }, metadata: { order_id: input.order_id }, confirmation: { confirmation_url: 'https://yoomoney.ru/checkout' } });
            return payments.get(key)!;
        }, async get(id) { return payments.get(id)!; },
    };
    return { gateway, payments, requests };
}
const succeed = (payment: ProviderPayment): ProviderPayment => ({ ...payment, status: 'succeeded', paid: true, confirmation: undefined });
const savePlan = (tx: Prisma.TransactionClient) => tx.mealPlan.create({ data: { userId: userA, targetCalories: 1000, targetProtein: 1, targetFat: 1, targetCarbs: 1, totalCalories: 1000, totalProtein: 1, totalFat: 1, totalCarbs: 1, settings: {} } });

describe('billing authorization, quotas and payments on isolated PostgreSQL', { concurrency: false }, () => {
    before(async () => {
        assert.match(testDatabase, /^meal_planner_billing_\d+_\d+$/);
        await databaseAdmin.$executeRawUnsafe(`CREATE DATABASE "${testDatabase}"`);
        const migration = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { env: process.env, encoding: 'utf8' });
        assert.equal(migration.status, 0, migration.stderr);
        prisma = (await import('../../prisma')).default; access = await import('../../services/billing/access'); orders = await import('../../services/billing/orders');
        const a = await prisma.user.create({ data: { email: 'billing-a@example.test', password: 'unused' } });
        const b = await prisma.user.create({ data: { email: 'billing-b@example.test', password: 'unused' } });
        const admin = await prisma.user.create({ data: { email: 'billing-admin@example.test', password: 'unused', canManageBilling: true } });
        userA = a.id; userB = b.id; adminId = admin.id; tokenA = tokenFor(userA); tokenB = tokenFor(userB); adminToken = tokenFor(adminId);
        const { app } = await import('../../src/app');
        server = await new Promise<Server>(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
        base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });
    beforeEach(async () => {
        globalThis.fetch = nativeFetch; process.env.BILLING_PAYMENT_MODE = 'test';
        await prisma.billingGrant.deleteMany(); await prisma.billingOrder.deleteMany(); await prisma.billingTrial.deleteMany(); await prisma.billingUsage.deleteMany(); await prisma.billingAudit.deleteMany(); await prisma.mealPlan.deleteMany(); await prisma.profile.deleteMany(); await settings();
    });
    after(async () => {
        globalThis.fetch = nativeFetch;
        if (server) await new Promise<void>(resolve => server.close(() => resolve()));
        if (prisma) await prisma.$disconnect();
        assert.match(testDatabase, /^meal_planner_billing_\d+_\d+$/);
        await databaseAdmin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${testDatabase}" WITH (FORCE)`); await databaseAdmin.$disconnect();
    });
    it('requires a dedicated current capability, ignoring registration and JWT claims', async () => {
        assert.equal((await request('/billing', 'GET', undefined, '')).status, 401);
        for (const token of [tokenA, tokenFor(userA, { canManageBilling: true, role: 'admin' })]) {
            assert.equal((await request('/billing/admin/settings', 'GET', undefined, token)).status, 403);
            assert.equal((await request('/billing/admin/settings', 'PUT', { version: 1, config: enabledConfig() }, token)).status, 403);
            assert.equal((await request('/billing/admin/grants', 'POST', {}, token)).status, 403);
        }
        const registered = await request('/auth/register', 'POST', { email: 'billing-forged@example.test', password: 'Test-password-123', canManageBilling: true, role: 'admin' }, '');
        assert.equal(registered.body.user.canManageBilling, false);
        assert.equal((await request('/billing/admin/settings', 'GET', undefined, registered.body.token)).status, 403);
        await prisma.user.update({ where: { id: userA }, data: { role: 'admin', canManageFeedback: true } });
        assert.equal((await request('/billing/admin/settings')).status, 403);
        assert.equal((await request('/auth/me', 'GET', undefined, adminToken)).body.canManageBilling, true);
        await prisma.user.update({ where: { id: adminId }, data: { canManageBilling: false } });
        assert.equal((await request('/billing/admin/settings', 'GET', undefined, adminToken)).status, 403);
        await prisma.user.update({ where: { id: adminId }, data: { canManageBilling: true } });
    });
    it('protects concurrent settings edits and records the previous settings', async () => {
        const results = await Promise.all([4, 5].map(limit => request('/billing/admin/settings', 'PUT', { version: 1, config: { ...enabledConfig(), free: { name: 'Старт', generationsPerMonth: limit } } }, adminToken)));
        assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
        assert.equal(await prisma.billingAudit.count({ where: { action: 'settings' } }), 1);
        const response = await request('/billing/admin/settings', 'GET', undefined, adminToken);
        assert.equal(response.body.version, 2); assert.equal(response.body.history[0].details.before.free.generationsPerMonth, 3);
        assert.equal((await request('/billing/admin/settings', 'PUT', { version: 2, config: { ...enabledConfig(), offers: [] } }, adminToken)).status, 400);
    });
    it('charges only committed plans, limits parallel requests, keeps history readable and never refunds deletion', async () => {
        assert.equal((await request('/menu/generate', 'POST', {})).status, 400); assert.equal(await prisma.billingUsage.count(), 0);
        await assert.rejects(access.withGenerationCharge(userA, async tx => { await savePlan(tx); throw new Error('Failed'); }));
        assert.equal(await prisma.mealPlan.count(), 0); assert.equal(await prisma.billingUsage.count(), 0);
        const results = await Promise.allSettled(Array.from({ length: 8 }, () => access.withGenerationCharge(userA, savePlan)));
        assert.equal(results.filter(r => r.status === 'fulfilled').length, 3);
        assert.ok(results.filter(r => r.status === 'rejected').every(r => (r.reason as { status: number }).status === 402));
        assert.equal(await prisma.mealPlan.count(), 3); assert.equal(await prisma.billingUsage.count(), 3);
        const plan = await prisma.mealPlan.findFirstOrThrow();
        assert.equal((await request(`/menu/${plan.id}`)).status, 200); assert.equal((await request(`/menu/${plan.id}/shopping-list`)).status, 200);
        assert.equal((await request(`/menu/${plan.id}`, 'DELETE')).status, 204); assert.equal((await request('/billing')).body.remaining, 0);
        assert.equal((await request('/billing', 'GET', undefined, tokenB)).body.remaining, 3);
        await prisma.profile.create({ data: { userId: userA, weight: 70, goal: 'maintain', calories: 2000 } });
        assert.equal((await request('/menu/generate', 'POST', {})).status, 402);
    });
    it('does not meter disabled mode and resets free quota at the calendar boundary', async () => {
        await settings({ ...defaultBillingConfig }); await access.withGenerationCharge(userA, savePlan);
        assert.equal(await prisma.billingUsage.count(), 0); assert.equal((await request('/billing')).body.remaining, null);
        await settings(); await prisma.billingUsage.create({ data: { userId: userA, bucket: 'month:2026-01' } });
        assert.equal((await access.billingAccess(userA, prisma, new Date('2026-01-31T23:59:00Z'))).used, 1);
        assert.equal((await access.billingAccess(userA, prisma, new Date('2026-02-01T00:00:00Z'))).used, 0);
    });
    it('starts exactly one trial, freezes its conditions, and does not reset it at month boundaries', async () => {
        const results = await Promise.all([request('/billing/trial', 'POST'), request('/billing/trial', 'POST')]);
        assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
        await settings({ ...enabledConfig(), trial: { enabled: false, days: 1, generations: 1 } });
        assert.equal((await request('/billing')).body.limit, 5);
        const start = new Date('2026-01-30T00:00:00Z');
        await prisma.billingTrial.update({ where: { userId: userA }, data: { startsAt: start, endsAt: new Date('2026-02-06T00:00:00Z') } });
        await prisma.billingUsage.create({ data: { userId: userA, bucket: `trial:${start.toISOString()}` } });
        assert.equal((await access.billingAccess(userA, prisma, new Date('2026-02-01T00:00:00Z'))).used, 1);
        assert.equal((await access.billingAccess(userA, prisma, new Date('2026-02-07T00:00:00Z'))).plan, 'free');
        assert.equal((await request('/billing/trial', 'POST')).status, 409);
    });
    it('deduplicates checkout, snapshots price and blocks duplicate pending orders and forged prices', async () => {
        const fake = fakeGateway(), input = newInput();
        const created = await Promise.all(Array.from({ length: 5 }, () => orders.createOrder(userA, input, fake.gateway)));
        assert.equal(new Set(created.map(o => o.id)).size, 1); assert.equal(await prisma.billingOrder.count(), 1);
        assert.equal(fake.requests.every(r => r.key === created[0].id), true);
        await assert.rejects(orders.createOrder(userA, newInput(), fake.gateway), { status: 409 });
        await settings({ ...enabledConfig(), plus: { name: 'Новый', generationsPerMonth: 100 }, offers: [{ ...defaultBillingConfig.offers[0], priceRub: 999 }] }, 2);
        const repeated = await orders.createOrder(userA, input, fake.gateway); assert.equal(repeated.amountMinor, 29900); assert.equal(repeated.limit, 60);
        assert.equal((await request(`/billing/orders/${repeated.id}/check`, 'POST', undefined, tokenB)).status, 404);
        assert.deepEqual((await request('/billing/orders', 'GET', undefined, tokenB)).body.items, []);
        assert.equal((await request('/billing/orders', 'POST', { ...newInput(), version: 2, amountMinor: 1 })).status, 400);
        assert.equal('providerRequest' in (await request('/billing/orders')).body.items[0], false);
    });
    it('verifies amount, recipient, mode, metadata and paid flag; ten callbacks grant once', async () => {
        const fake = fakeGateway(), order = await orders.createOrder(userA, newInput(), fake.gateway), valid = succeed(fake.payments.get(order.id)!);
        for (const payment of [
            { ...valid, amount: { value: '1.00', currency: 'RUB' } }, { ...valid, amount: { value: '299.00', currency: 'USD' } },
            { ...valid, metadata: { order_id: randomUUID() } }, { ...valid, recipient: { account_id: '999' } },
            { ...valid, test: false }, { ...valid, paid: false }, { ...valid, id: randomUUID() },
        ]) await assert.rejects(orders.applyPayment(order, payment), { status: 502 });
        assert.equal(await prisma.billingGrant.count(), 0);
        await Promise.all(Array.from({ length: 10 }, () => orders.applyPayment(order, valid)));
        assert.equal(await prisma.billingGrant.count(), 1); assert.equal((await request('/billing')).body.limit, 60);
        await orders.applyPayment(order, fake.payments.get(order.id)!);
        assert.equal((await prisma.billingOrder.findUniqueOrThrow({ where: { id: order.id } })).status, 'paid');
    });
    it('queues renewals with frozen limits, excludes test revenue and removes test grants in live mode', async () => {
        const fake = fakeGateway(), first = await orders.createOrder(userA, newInput(), fake.gateway);
        await orders.applyPayment(first, succeed(fake.payments.get(first.id)!));
        await settings({ ...enabledConfig(), plus: { name: 'Новый', generationsPerMonth: 90 } }, 2);
        assert.equal((await request('/billing')).body.limit, 60);
        const next = await orders.createOrder(userA, { ...newInput(), version: 2 }, fake.gateway); await orders.applyPayment(next, succeed(fake.payments.get(next.id)!));
        const grants = await prisma.billingGrant.findMany({ orderBy: { startsAt: 'asc' } });
        assert.equal(grants[0].endsAt.getTime(), grants[1].startsAt.getTime());
        assert.equal((await access.billingAccess(userA, prisma, addDays(grants[1].startsAt, 1))).limit, 90);
        assert.equal((await request('/billing/admin/overview', 'GET', undefined, adminToken)).body.revenueMinor, 0);
        process.env.BILLING_PAYMENT_MODE = 'live'; assert.equal((await request('/billing')).body.plan, 'free');
        await assert.rejects(orders.syncOrder(first, { ...fake.gateway, mode: 'live' }), { status: 409 });
    });
    it('handles partial/full refunds and stale events without revoking another purchase', async () => {
        const fake = fakeGateway(), first = await orders.createOrder(userA, newInput(), fake.gateway), paid = succeed(fake.payments.get(first.id)!);
        await orders.applyPayment(first, paid);
        const next = await orders.createOrder(userA, newInput(), fake.gateway); await orders.applyPayment(next, succeed(fake.payments.get(next.id)!));
        await orders.applyPayment(first, { ...paid, refunded_amount: { value: '100.00', currency: 'RUB' } });
        assert.equal(await prisma.billingGrant.count({ where: { revokedAt: null } }), 2);
        const refunded = { ...paid, refunded_amount: { value: '299.00', currency: 'RUB' } };
        await Promise.all([orders.applyPayment(first, refunded), orders.applyPayment(first, refunded)]); await orders.applyPayment(first, paid);
        assert.equal((await prisma.billingOrder.findUniqueOrThrow({ where: { id: first.id } })).status, 'refunded');
        assert.equal(await prisma.billingGrant.count({ where: { revokedAt: null } }), 1);
        assert.equal((await prisma.billingGrant.findUniqueOrThrow({ where: { orderId: next.id } })).revokedAt, null);
    });
    it('uses verified provider state for webhooks and returns retryable errors on network failures', async () => {
        const fake = fakeGateway(), order = await orders.createOrder(userA, newInput(), fake.gateway);
        const payload = { event: 'payment.succeeded', object: { id: order.providerPaymentId, status: 'succeeded', metadata: { order_id: order.id } } };
        let confirmed = fake.payments.get(order.id)!;
        globalThis.fetch = async input => { assert.match(String(input), /^https:\/\/api\.yookassa\.ru\/v3\/payments\//); return new Response(JSON.stringify(confirmed)); };
        assert.equal((await request('/billing/webhook/yookassa', 'POST', payload, '')).status, 200); assert.equal(await prisma.billingGrant.count(), 0);
        globalThis.fetch = async () => { throw new Error('timeout'); };
        assert.equal((await request('/billing/webhook/yookassa', 'POST', payload, '')).status, 502);
        confirmed = succeed(confirmed); globalThis.fetch = async () => new Response(JSON.stringify(confirmed));
        assert.equal((await request('/billing/webhook/yookassa', 'POST', payload, '')).status, 200);
        assert.equal((await request('/billing/webhook/yookassa', 'POST', payload, '')).status, 200); assert.equal(await prisma.billingGrant.count(), 1);
    });
    it('never recreates an ambiguous charge after provider idempotency retention expires', async () => {
        const fake = fakeGateway(), input = newInput();
        await assert.rejects(orders.createOrder(userA, input, { ...fake.gateway, create: async () => { throw new Error('timeout'); } }));
        const order = await prisma.billingOrder.findFirstOrThrow(); assert.equal(order.providerPaymentId, null);
        await prisma.billingOrder.update({ where: { id: order.id }, data: { createdAt: new Date(Date.now() - 24 * 3600000) } });
        await assert.rejects(orders.createOrder(userA, input, fake.gateway), { status: 409 }); assert.equal(fake.requests.length, 0);
    });
    it('recovers an old unknown provider result through an owner-only verified payment lookup', async () => {
        const fake = fakeGateway(), input = newInput();
        await assert.rejects(orders.createOrder(userA, input, { ...fake.gateway, create: async () => { throw new Error('timeout'); } }));
        const order = await prisma.billingOrder.findFirstOrThrow();
        await prisma.billingOrder.update({ where: { id: order.id }, data: { createdAt: new Date(Date.now() - 24 * 3600000) } });
        const paymentId = randomUUID();
        let payment: ProviderPayment = { id: paymentId, status: 'succeeded', paid: true, test: true, amount: { value: '299.00', currency: 'RUB' }, recipient: { account_id: '123' }, metadata: { order_id: randomUUID() } };
        globalThis.fetch = async () => new Response(JSON.stringify(payment));
        assert.equal((await request(`/billing/admin/orders/${order.id}/link`, 'POST', { paymentId })).status, 403);
        assert.equal((await request(`/billing/admin/orders/${order.id}/link`, 'POST', { paymentId }, adminToken)).status, 502);
        assert.equal(await prisma.billingGrant.count(), 0);
        payment = { ...payment, metadata: { order_id: order.id } };
        assert.equal((await request(`/billing/admin/orders/${order.id}/link`, 'POST', { paymentId }, adminToken)).status, 200);
        assert.equal(await prisma.billingGrant.count(), 1);
        assert.equal((await prisma.billingOrder.findUniqueOrThrow({ where: { id: order.id } })).providerPaymentId, paymentId);
    });
    it('gifts are idempotent, audited and revocable while payments cannot be revoked as gifts', async () => {
        const input = { requestId: randomUUID(), email: 'billing-a@example.test', days: 7, reason: 'Бета-тестирование' };
        const results = await Promise.all([request('/billing/admin/grants', 'POST', input, adminToken), request('/billing/admin/grants', 'POST', input, adminToken)]);
        assert.ok(results.every(r => r.status === 201)); assert.equal(await prisma.billingGrant.count(), 1); assert.equal(await prisma.billingAudit.count({ where: { action: 'gift' } }), 1);
        assert.equal((await request('/billing')).body.plan, 'plus');
        assert.equal((await request(`/billing/admin/grants/${input.requestId}/revoke`, 'POST', { reason: 'Проверка отмены' }, adminToken)).status, 200);
        assert.equal((await request('/billing')).body.plan, 'free');
        const fake = fakeGateway(), order = await orders.createOrder(userA, newInput(), fake.gateway); await orders.applyPayment(order, succeed(fake.payments.get(order.id)!));
        const grant = await prisma.billingGrant.findUniqueOrThrow({ where: { orderId: order.id } });
        assert.equal((await request(`/billing/admin/grants/${grant.id}/revoke`, 'POST', { reason: 'Нельзя отменять оплату так' }, adminToken)).status, 400);
    });
});
