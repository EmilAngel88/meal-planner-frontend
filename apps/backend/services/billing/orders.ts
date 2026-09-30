import { randomUUID } from 'node:crypto';
import type { BillingOrder, Prisma } from '@prisma/client';
import prisma from '../../prisma';
import { HttpError } from '../../utils/validation';
import { grantPeriod, lockBillingUser, readBillingSettings } from './access';
import { minorUnits, safePaymentUrl, yookassaGateway, type PaymentGateway, type ProviderPayment } from './provider';

export const publicOrder = (order: BillingOrder) => ({ id: order.id, name: order.name, days: order.days, limit: order.limit,
    amountMinor: order.amountMinor, currency: order.currency, status: order.status, mode: order.providerMode,
    confirmationUrl: order.status === 'pending' ? order.confirmationUrl : null, refundedMinor: order.refundedMinor,
    createdAt: order.createdAt, paidAt: order.paidAt });

export async function createOrder(userId: number, input: { requestId: string; offerId: string; version: number }, gateway: PaymentGateway = yookassaGateway()) {
    const order = await prisma.$transaction(async tx => {
        await lockBillingUser(tx, userId);
        const existing = await tx.billingOrder.findUnique({ where: { userId_requestId: { userId, requestId: input.requestId } } });
        if (existing) {
            if (existing.offerId !== input.offerId || existing.configVersion !== input.version) throw new HttpError(409, 'Этот запрос уже связан с другим заказом');
            return existing;
        }
        const { config, version } = await readBillingSettings(tx);
        if (!config.enabled || !config.salesEnabled) throw new HttpError(409, 'Продажи сейчас приостановлены');
        if (input.version !== version) throw new HttpError(409, 'Условия изменились. Обновите страницу и проверьте цену перед оплатой.');
        const offer = config.offers.find(item => item.id === input.offerId && item.enabled);
        if (!offer) throw new HttpError(400, 'Этот вариант оплаты недоступен');
        // Prevent double-clicks and separate tabs from producing two payable orders.
        const pending = await tx.billingOrder.findFirst({ where: { userId, status: 'pending', providerMode: gateway.mode, merchantId: gateway.merchantId } });
        if (pending) throw new HttpError(409, 'У вас уже есть незавершённый заказ. Откройте его в истории оплат и проверьте статус.');
        const recent = await tx.billingOrder.count({ where: { userId, createdAt: { gt: new Date(Date.now() - 86400000) } } });
        if (recent >= 10) throw new HttpError(429, 'Сегодня создано слишком много заказов. Попробуйте завтра.');
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
        const data = { id: randomUUID(), userId, requestId: input.requestId, offerId: offer.id, name: `${config.plus.name} · ${offer.title}`,
            days: offer.days, limit: config.plus.generationsPerMonth, amountMinor: offer.priceRub * 100, configVersion: version,
            providerMode: gateway.mode, merchantId: gateway.merchantId };
        return tx.billingOrder.create({ data: { ...data, providerRequest: gateway.requestFor(data, user.email) as Prisma.InputJsonObject } });
    });
    return syncOrder(order, gateway);
}
export function verifyPayment(order: BillingOrder, payment: ProviderPayment) {
    if (payment.metadata.order_id !== order.id || payment.recipient.account_id !== order.merchantId
        || payment.test !== (order.providerMode === 'test') || payment.amount.currency !== order.currency
        || minorUnits(payment.amount.value) !== order.amountMinor || (order.providerPaymentId && payment.id !== order.providerPaymentId)
        || (payment.status === 'succeeded' && !payment.paid)) throw new HttpError(502, 'Параметры платежа не совпали с заказом. Доступ не изменён.');
    if (payment.refunded_amount && (payment.refunded_amount.currency !== order.currency || minorUnits(payment.refunded_amount.value) > order.amountMinor)) throw new HttpError(502, 'Некорректная сумма возврата');
}
export async function applyPayment(order: BillingOrder, payment: ProviderPayment) {
    verifyPayment(order, payment);
    const confirmationUrl = safePaymentUrl(payment.confirmation?.confirmation_url);
    return prisma.$transaction(async tx => {
        await lockBillingUser(tx, order.userId);
        const current = await tx.billingOrder.findUniqueOrThrow({ where: { id: order.id } });
        verifyPayment(current, payment);
        const refundedMinor = Math.max(current.refundedMinor, payment.refunded_amount ? minorUnits(payment.refunded_amount.value) : 0);
        // Never downgrade a settled order because an older callback arrived later.
        if (current.status === 'refunded') return current;
        if (refundedMinor === current.amountMinor) {
            await tx.billingGrant.updateMany({ where: { orderId: current.id, revokedAt: null }, data: { revokedAt: new Date() } });
            return tx.billingOrder.update({ where: { id: current.id }, data: { status: 'refunded', refundedMinor, providerPaymentId: payment.id, confirmationUrl: null } });
        }
        if (payment.status === 'succeeded') {
            if (!await tx.billingGrant.findUnique({ where: { orderId: current.id } })) {
                await grantPeriod(tx, { userId: current.userId, days: current.days, limit: current.limit,
                    name: current.name, source: current.providerMode === 'test' ? 'test_payment' : 'payment', orderId: current.id });
            }
            return tx.billingOrder.update({ where: { id: current.id }, data: { status: 'paid', paidAt: current.paidAt ?? new Date(), providerPaymentId: payment.id, refundedMinor, confirmationUrl: null } });
        }
        if (current.status === 'paid' || current.status === 'canceled') return current;
        return tx.billingOrder.update({ where: { id: current.id }, data: { providerPaymentId: payment.id, confirmationUrl,
            status: payment.status === 'canceled' ? 'canceled' : 'pending' } });
    });
}
export async function syncOrder(order: BillingOrder, gateway: PaymentGateway = yookassaGateway()) {
    if (order.merchantId !== gateway.merchantId || order.providerMode !== gateway.mode) throw new HttpError(409, 'Этот заказ создан в другом режиме оплаты. Обратитесь к владельцу сервиса.');
    let payment: ProviderPayment;
    if (order.providerPaymentId) payment = await gateway.get(order.providerPaymentId);
    else {
        // YooKassa keeps idempotency keys for 24h; an ambiguous old request must not be charged again.
        if (Date.now() - order.createdAt.getTime() > 23 * 3600000) throw new HttpError(409, 'Срок безопасного повтора истёк. Напишите в поддержку: заказ нужно проверить в ЮKassa.');
        payment = await gateway.create(order.id, order.providerRequest);
    }
    return applyPayment(order, payment);
}
