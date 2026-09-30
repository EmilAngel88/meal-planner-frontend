import { Router, type RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../prisma';
import { authenticate } from '../middleware/auth';
import { AuthAttemptWindow } from './auth';
import { HttpError } from '../utils/validation';
import { billingConfigSchema, defaultBillingConfig } from '../services/billing/config';
import { activeGrantSources, billingAccess, grantPeriod, lockBillingUser, readBillingSettings, startTrial } from '../services/billing/access';
import { paymentConnection, yookassaGateway } from '../services/billing/provider';
import { applyPayment, createOrder, publicOrder, syncOrder } from '../services/billing/orders';

const router = Router();
const attempts = new AuthAttemptWindow(30, 60000);
const webhookAttempts = new AuthAttemptWindow(1200, 60000);
const throttle: RequestHandler = (req, res, next) => {
    const retry = req.userId ? attempts.consume(`user:${req.userId}`) : webhookAttempts.consume(`hook:${req.ip}`);
    if (retry) { res.setHeader('Retry-After', retry); res.status(429).json({ message: 'Подождите минуту перед следующей проверкой оплаты' }); return; }
    next();
};
// Notifications are hints only. Amount, recipient, mode and status are fetched from the provider.
router.post('/webhook/yookassa', throttle, async (req, res) => {
    const input = z.object({ event: z.enum(['payment.succeeded', 'payment.canceled', 'refund.succeeded']),
        object: z.object({ id: z.string().regex(/^[a-zA-Z0-9-]{1,64}$/), payment_id: z.string().regex(/^[a-zA-Z0-9-]{1,64}$/).optional(), metadata: z.object({ order_id: z.string().uuid().optional() }).optional() }) }).safeParse(req.body);
    if (!input.success) return res.status(400).json({ message: 'Некорректное уведомление' });
    const paymentId = input.data.event === 'refund.succeeded' ? input.data.object.payment_id : input.data.object.id;
    if (!paymentId) return res.status(400).json({ message: 'Нет номера платежа' });
    const orderId = input.data.event.startsWith('payment.') ? input.data.object.metadata?.order_id : undefined;
    const order = await prisma.billingOrder.findFirst({ where: { OR: [{ providerPaymentId: paymentId }, ...(orderId ? [{ id: orderId }] : [])] } });
    if (!order) return res.json({ received: true });
    const gateway = yookassaGateway();
    if (order.merchantId !== gateway.merchantId || order.providerMode !== gateway.mode) throw new HttpError(409, 'Платёж относится к другому подключению');
    await applyPayment(order, await gateway.get(paymentId));
    res.json({ received: true });
});
router.use(authenticate);
router.get('/', async (req, res) => {
    const access = await billingAccess(req.userId);
    const { bucket: _bucket, ...publicAccess } = access;
    const connection = paymentConnection();
    const grants = await prisma.billingGrant.findMany({ where: { userId: req.userId, source: { in: activeGrantSources() }, revokedAt: null, endsAt: { gt: new Date() } }, orderBy: { startsAt: 'asc' }, take: 30,
        select: { id: true, name: true, source: true, startsAt: true, endsAt: true, limit: true } });
    res.json({ ...publicAccess, payment: connection, canBuy: access.config.enabled && access.config.salesEnabled && connection.ready, grants });
});
router.post('/trial', throttle, async (req, res) => { await startTrial(req.userId); res.status(201).json({ started: true }); });
router.get('/orders', async (req, res) => {
    const { offset } = z.object({ offset: z.coerce.number().int().min(0).max(100000).default(0) }).parse(req.query);
    const orders = await prisma.billingOrder.findMany({ where: { userId: req.userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: offset, take: 21 });
    res.json({ items: orders.slice(0, 20).map(publicOrder), hasMore: orders.length > 20 });
});
router.post('/orders', throttle, async (req, res) => {
    const input = z.object({ requestId: z.string().uuid(), offerId: z.string().max(40), version: z.number().int().min(0) }).strict().parse(req.body);
    res.status(201).json(publicOrder(await createOrder(req.userId, input)));
});
router.post('/orders/:id/check', throttle, async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const order = await prisma.billingOrder.findFirst({ where: { id, userId: req.userId } });
    if (!order) throw new HttpError(404, 'Заказ не найден');
    res.json(publicOrder(await syncOrder(order)));
});
const requireAdmin: RequestHandler = async (req, _res, next) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { canManageBilling: true } });
    if (!user?.canManageBilling) throw new HttpError(403, 'Настройки монетизации доступны только владельцу');
    next();
};
router.use('/admin', requireAdmin);
router.get('/admin/settings', async (_req, res) => {
    const settings = await readBillingSettings();
    const history = await prisma.billingAudit.findMany({ where: { action: 'settings' }, orderBy: { id: 'desc' }, take: 10 });
    res.json({ ...settings, defaults: defaultBillingConfig, payment: paymentConnection(), history });
});
router.put('/admin/settings', async (req, res) => {
    const { version, config } = z.object({ version: z.number().int().min(0), config: billingConfigSchema }).strict().parse(req.body);
    if (config.salesEnabled && !paymentConnection().ready) throw new HttpError(400, 'Сначала подключите платёжный сервис в настройках сервера. Ограничения и пробный период можно включить отдельно.');
    const result = await prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(40728, 1)`;
        const old = await readBillingSettings(tx);
        if (old.version !== version) throw new HttpError(409, 'Настройки уже изменили. Обновите страницу перед сохранением.');
        const updated = await tx.billingSettings.upsert({ where: { id: 1 }, create: { id: 1, version: 1, config }, update: { version: { increment: 1 }, config } });
        await tx.billingAudit.create({ data: { actorId: req.userId, action: 'settings', details: { before: old.config, after: config, version: updated.version } } });
        return { version: updated.version, config };
    });
    res.json(result);
});
router.get('/admin/overview', async (_req, res) => {
    const now = new Date();
    const [paid, refunded, active, trials, latest] = await Promise.all([
        prisma.billingOrder.aggregate({ where: { providerMode: 'live', status: { in: ['paid', 'refunded'] } }, _sum: { amountMinor: true, refundedMinor: true }, _count: true }),
        prisma.billingOrder.count({ where: { providerMode: 'live', status: 'refunded' } }),
        prisma.user.count({ where: { billingGrants: { some: { source: 'payment', revokedAt: null, startsAt: { lte: now }, endsAt: { gt: now } } } } }),
        prisma.billingTrial.count({ where: { endsAt: { gt: now } } }),
        prisma.billingAudit.findMany({ orderBy: { id: 'desc' }, take: 20, select: { id: true, actorId: true, action: true, details: true, createdAt: true } }),
    ]);
    res.json({ revenueMinor: (paid._sum.amountMinor ?? 0) - (paid._sum.refundedMinor ?? 0), paidOrders: paid._count, refundedOrders: refunded, activePaid: active, activeTrials: trials, audit: latest });
});
router.get('/admin/orders', async (req, res) => {
    const { offset, email } = z.object({ offset: z.coerce.number().int().min(0).max(100000).default(0), email: z.string().trim().max(254).optional() }).parse(req.query);
    const orders = await prisma.billingOrder.findMany({ where: email ? { user: { email: { equals: email, mode: 'insensitive' } } } : {}, include: { user: { select: { email: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: offset, take: 21 });
    res.json({ items: orders.slice(0, 20).map(order => ({ ...publicOrder(order), email: order.user.email, providerPaymentId: order.providerPaymentId })), hasMore: orders.length > 20 });
});
router.post('/admin/orders/:id/check', throttle, async (req, res) => {
    const order = await prisma.billingOrder.findUnique({ where: { id: z.string().uuid().parse(req.params.id) } });
    if (!order) throw new HttpError(404, 'Заказ не найден');
    res.json(publicOrder(await syncOrder(order)));
});
router.post('/admin/orders/:id/link', throttle, async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { paymentId } = z.object({ paymentId: z.string().regex(/^[a-zA-Z0-9-]{1,64}$/) }).strict().parse(req.body);
    const order = await prisma.billingOrder.findUnique({ where: { id } });
    if (!order) throw new HttpError(404, 'Заказ не найден');
    const gateway = yookassaGateway();
    if (order.merchantId !== gateway.merchantId || order.providerMode !== gateway.mode) throw new HttpError(409, 'Заказ относится к другому подключению');
    const updated = await applyPayment(order, await gateway.get(paymentId));
    await prisma.billingAudit.create({ data: { actorId: req.userId, action: 'link_payment', details: { orderId: id, paymentId } } });
    res.json(publicOrder(updated));
});
router.post('/admin/grants', async (req, res) => {
    const input = z.object({ requestId: z.string().uuid(), email: z.string().trim().email().max(254), days: z.number().int().min(1).max(366), reason: z.string().trim().min(3).max(300) }).strict().parse(req.body);
    const result = await prisma.$transaction(async tx => {
        const users = await tx.user.findMany({ where: { email: { equals: input.email, mode: 'insensitive' } }, select: { id: true }, take: 2 });
        if (users.length !== 1) throw new HttpError(400, 'Нужен один существующий аккаунт с этим email');
        const userId = users[0].id;
        await lockBillingUser(tx, userId);
        const existing = await tx.billingGrant.findUnique({ where: { id: input.requestId } });
        if (existing) {
            const audit = await tx.billingAudit.findFirst({ where: { action: 'gift', details: { path: ['grantId'], equals: existing.id } } });
            const details = audit?.details as { days?: number; reason?: string } | undefined;
            if (existing.userId !== userId || existing.source !== 'gift' || details?.days !== input.days || details?.reason !== input.reason) throw new HttpError(409, 'Этот запрос уже использован');
            return existing;
        }
        const { config } = await readBillingSettings(tx);
        const grant = await grantPeriod(tx, { userId, days: input.days, name: `${config.plus.name} · подарок`, limit: config.plus.generationsPerMonth, source: 'gift' });
        const saved = await tx.billingGrant.update({ where: { id: grant.id }, data: { id: input.requestId } });
        await tx.billingAudit.create({ data: { actorId: req.userId, action: 'gift', details: { userId, email: input.email, days: input.days, reason: input.reason, grantId: saved.id } } });
        return saved;
    });
    res.status(201).json(result);
});
router.post('/admin/grants/:id/revoke', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { reason } = z.object({ reason: z.string().trim().min(3).max(300) }).parse(req.body);
    await prisma.$transaction(async tx => {
        const grant = await tx.billingGrant.findUnique({ where: { id } });
        if (!grant || grant.source !== 'gift') throw new HttpError(400, 'Здесь можно отозвать только подарочный доступ. Возвраты оплат выполняются в ЮKassa.');
        await lockBillingUser(tx, grant.userId);
        const changed = await tx.billingGrant.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
        if (changed.count) await tx.billingAudit.create({ data: { actorId: req.userId, action: 'revoke_gift', details: { grantId: id, userId: grant.userId, reason } as Prisma.InputJsonValue } });
    });
    res.json({ revoked: true });
});
export default router;
