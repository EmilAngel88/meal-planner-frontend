import type { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../../prisma';
import { HttpError } from '../../utils/validation';
import { billingConfigSchema, defaultBillingConfig, monthWindow, addDays } from './config';

type Client = Prisma.TransactionClient;
export async function readBillingSettings(client: Client = prisma) {
    const row = await client.billingSettings.findUnique({ where: { id: 1 } });
    return { version: row?.version ?? 0, config: row ? billingConfigSchema.parse(row.config) : structuredClone(defaultBillingConfig) };
}
// Shared across API processes; hold this only for short database transactions, never compute or HTTP.
export async function lockBillingUser(tx: Client, userId: number) {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
}
export const activeGrantSources = () => process.env.BILLING_PAYMENT_MODE === 'test' ? ['payment', 'gift', 'test_payment'] : ['payment', 'gift'];
export async function billingAccess(userId: number, client: Client = prisma, now = new Date()) {
    const { config, version } = await readBillingSettings(client);
    const [trial, grant] = await Promise.all([
        client.billingTrial.findUnique({ where: { userId } }),
        client.billingGrant.findFirst({ where: { userId, source: { in: activeGrantSources() }, revokedAt: null, startsAt: { lte: now }, endsAt: { gt: now } }, orderBy: { startsAt: 'asc' } }),
    ]);
    const month = monthWindow(now);
    const activeTrial = !grant && trial && trial.startsAt <= now && trial.endsAt > now;
    const bucket = activeTrial ? `trial:${trial.startsAt.toISOString()}` : month.bucket;
    const used = await client.billingUsage.count({ where: { userId, bucket } });
    const limit = !config.enabled ? null : grant ? grant.limit : activeTrial ? trial.limit : config.free.generationsPerMonth;
    return {
        version, config, enabled: config.enabled,
        plan: grant ? 'plus' as const : activeTrial ? 'trial' as const : 'free' as const,
        name: grant?.name ?? (activeTrial ? 'Пробный доступ' : config.free.name),
        limit, used, remaining: limit === null ? null : Math.max(0, limit - used), bucket,
        resetsAt: activeTrial ? trial.endsAt : month.end,
        expiresAt: grant?.endsAt ?? (activeTrial ? trial.endsAt : null),
        trialAvailable: config.enabled && config.trial.enabled && !trial && !grant,
    };
}
export async function assertGenerationAccess(userId: number, client: Client = prisma) {
    const access = await billingAccess(userId, client);
    if (access.remaining === 0) throw new HttpError(402, `Лимит создания меню исчерпан. Он обновится ${access.resetsAt.toLocaleDateString('ru-RU', { timeZone: 'UTC' })}. Доступные варианты — в разделе «Тариф и оплата». Сохранённые меню и покупки доступны.`);
    return access;
}
// Persist the plan and the usage event atomically. Deleting a plan cannot refund usage.
export async function withGenerationCharge<T>(userId: number, save: (tx: Client) => Promise<T>, client: PrismaClient = prisma) {
    return client.$transaction(async tx => {
        await lockBillingUser(tx, userId);
        const access = await assertGenerationAccess(userId, tx);
        const result = await save(tx);
        if (access.enabled) await tx.billingUsage.create({ data: { userId, bucket: access.bucket } });
        return result;
    });
}
export async function startTrial(userId: number) {
    return prisma.$transaction(async tx => {
        await lockBillingUser(tx, userId);
        const access = await billingAccess(userId, tx);
        if (!access.trialAvailable) throw new HttpError(409, 'Пробный период недоступен или уже использован');
        const startsAt = new Date();
        await tx.billingTrial.create({ data: { userId, startsAt, endsAt: addDays(startsAt, access.config.trial.days), limit: access.config.trial.generations } });
    });
}
export async function grantPeriod(tx: Client, data: { userId: number; days: number; limit: number; name: string; source: 'payment' | 'test_payment' | 'gift'; orderId?: string }, now = new Date()) {
    const last = await tx.billingGrant.findFirst({ where: { userId: data.userId, source: { in: data.source === 'test_payment' ? ['test_payment'] : ['payment', 'gift'] }, revokedAt: null, endsAt: { gt: now } }, orderBy: { endsAt: 'desc' } });
    const startsAt = last?.endsAt ?? now;
    return tx.billingGrant.create({ data: { userId: data.userId, limit: data.limit, name: data.name, source: data.source, orderId: data.orderId, startsAt, endsAt: addDays(startsAt, data.days) } });
}
