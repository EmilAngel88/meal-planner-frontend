import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { billingConfigSchema, defaultBillingConfig, monthWindow, addDays } from '../services/billing/config';
import { minorUnits, paymentConnection, safePaymentUrl, yookassaGateway } from '../services/billing/provider';

describe('billing validation and payment adapter', () => {
    it('starts disabled and rejects pricing and allowance mistakes', () => {
        assert.equal(defaultBillingConfig.enabled, false);
        assert.equal(defaultBillingConfig.salesEnabled, false);
        assert.ok(billingConfigSchema.safeParse(defaultBillingConfig).success);
        for (const config of [
            { ...defaultBillingConfig, salesEnabled: true },
            { ...defaultBillingConfig, plus: { name: 'Плюс', generationsPerMonth: 1 } },
            { ...defaultBillingConfig, free: { name: '', generationsPerMonth: 3 } },
            { ...defaultBillingConfig, offers: [defaultBillingConfig.offers[0], defaultBillingConfig.offers[0]] },
            { ...defaultBillingConfig, offers: [{ ...defaultBillingConfig.offers[0], priceRub: 0.5 }] },
            { ...defaultBillingConfig, trial: { enabled: true, days: 31, generations: 3 } },
        ]) assert.equal(billingConfigSchema.safeParse(config).success, false);
    });
    it('uses UTC calendar periods through leap years and December', () => {
        assert.deepEqual(monthWindow(new Date('2028-02-29T23:59:59Z')), { bucket: 'month:2028-02', end: new Date('2028-03-01T00:00:00Z') });
        assert.equal(monthWindow(new Date('2026-12-31T23:59:59Z')).end.toISOString(), '2027-01-01T00:00:00.000Z');
        assert.equal(addDays(new Date('2028-02-28T10:00:00Z'), 2).toISOString(), '2028-03-01T10:00:00.000Z');
    });
    it('keeps billing readable when Docker passes empty or malformed payment settings', () => {
        const previous = { ...process.env };
        try {
            Object.assign(process.env, { BILLING_PAYMENT_MODE: 'disabled', YOOKASSA_SHOP_ID: '', YOOKASSA_SECRET_KEY: '', BILLING_RETURN_URL: '', YOOKASSA_RECEIPT_MODE: '', YOOKASSA_VAT_CODE: '' });
            assert.deepEqual(paymentConnection(), { ready: false, mode: 'disabled' });
            assert.throws(() => yookassaGateway(), { status: 503 });
            Object.assign(process.env, { BILLING_PAYMENT_MODE: 'test', YOOKASSA_SHOP_ID: '123', YOOKASSA_SECRET_KEY: 'test-only-secret', YOOKASSA_RECEIPT_MODE: 'external' });
            for (const returnUrl of ['', 'not a URL', 'https://']) {
                process.env.BILLING_RETURN_URL = returnUrl;
                assert.deepEqual(paymentConnection(), { ready: false, mode: 'test' });
                assert.throws(() => yookassaGateway(), { status: 503 });
            }
        } finally { for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key]; Object.assign(process.env, previous); }
    });
    it('uses integer kopecks and restricts redirect destinations', () => {
        assert.equal(minorUnits('299.00'), 29900); assert.equal(minorUnits('2490.99'), 249099);
        for (const value of ['NaN', '-1.00', '1e2', '1', '1.001', '1000000000.00']) assert.throws(() => minorUnits(value));
        for (const url of ['javascript:alert(1)', 'https://yoomoney.ru.evil.test', 'https://yoomoney.ru@evil.test', 'http://yoomoney.ru', 'https://evil.test']) assert.throws(() => safePaymentUrl(url));
        assert.equal(safePaymentUrl('https://yoomoney.ru/checkout'), 'https://yoomoney.ru/checkout');
    });
    it('sends a stable idempotency key, a server return URL and receipt without saving a card', async () => {
        const previous = { ...process.env };
        Object.assign(process.env, { BILLING_PAYMENT_MODE: 'test', YOOKASSA_SHOP_ID: '123', YOOKASSA_SECRET_KEY: 'test-only-secret', BILLING_RETURN_URL: 'https://example.test/billing', YOOKASSA_RECEIPT_MODE: 'provider', YOOKASSA_VAT_CODE: '1' });
        try {
            let sent: RequestInit | undefined;
            const gateway = yookassaGateway(async (_url, init) => {
                sent = init;
                return new Response(JSON.stringify({ id: 'payment-test', status: 'pending', paid: false, test: true, amount: { value: '299.00', currency: 'RUB' }, recipient: { account_id: '123' }, metadata: { order_id: 'order-test' } }));
            });
            const body = gateway.requestFor({ id: 'order-test', amountMinor: 29900, name: 'Плюс' }, 'buyer@example.test');
            await gateway.create('order-test', body);
            assert.equal((sent!.headers as Record<string, string>)['Idempotence-Key'], 'order-test');
            assert.equal((body.confirmation as { return_url: string }).return_url, 'https://example.test/billing?order=order-test');
            assert.equal('save_payment_method' in body, false);
            assert.deepEqual((body.receipt as { customer: unknown }).customer, { email: 'buyer@example.test' });
        } finally { for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key]; Object.assign(process.env, previous); }
    });
});
