import { z } from 'zod';
import { HttpError } from '../../utils/validation';

const gatewayConfigSchema = z.object({
    mode: z.enum(['test', 'live']), shopId: z.string().regex(/^\d+$/), secret: z.string().min(10),
    returnUrl: z.string().url().refine(value => {
        if (!URL.canParse(value)) return false;
        const url = new URL(value);
        return !url.username && !url.password && (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)));
    }),
    receiptMode: z.enum(['external', 'provider']),
    vatCode: z.number().int().min(1).max(12).optional(),
}).refine(value => value.receiptMode !== 'provider' || value.vatCode !== undefined, 'Укажите ставку НДС для чеков');
export function paymentConnection() {
    const parsed = gatewayConfigSchema.safeParse({ mode: process.env.BILLING_PAYMENT_MODE, shopId: process.env.YOOKASSA_SHOP_ID,
        secret: process.env.YOOKASSA_SECRET_KEY, returnUrl: process.env.BILLING_RETURN_URL,
        receiptMode: process.env.YOOKASSA_RECEIPT_MODE, vatCode: process.env.YOOKASSA_VAT_CODE ? Number(process.env.YOOKASSA_VAT_CODE) : undefined });
    return { ready: parsed.success, mode: process.env.BILLING_PAYMENT_MODE === 'live' ? 'live' as const : process.env.BILLING_PAYMENT_MODE === 'test' ? 'test' as const : 'disabled' as const };
}
const paymentSchema = z.object({
    id: z.string().regex(/^[a-zA-Z0-9-]{1,64}$/), status: z.enum(['pending', 'waiting_for_capture', 'succeeded', 'canceled']),
    paid: z.boolean(), test: z.boolean(), amount: z.object({ value: z.string(), currency: z.string() }),
    recipient: z.object({ account_id: z.string() }), metadata: z.object({ order_id: z.string() }),
    confirmation: z.object({ confirmation_url: z.string().url().optional() }).optional(),
    refunded_amount: z.object({ value: z.string(), currency: z.string() }).optional(),
});
export type ProviderPayment = z.infer<typeof paymentSchema>;
export function minorUnits(value: string) {
    if (!/^\d{1,8}\.\d{2}$/.test(value)) throw new HttpError(502, 'Платёжный сервис вернул некорректную сумму');
    const [whole, cents] = value.split('.');
    return Number(whole) * 100 + Number(cents);
}
export function safePaymentUrl(value: string | undefined) {
    if (!value) return null;
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || !['yookassa.ru', 'yoomoney.ru'].some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) {
        throw new HttpError(502, 'Не удалось проверить адрес страницы оплаты');
    }
    return url.toString();
}
export interface PaymentGateway {
    mode: 'test' | 'live'; merchantId: string;
    requestFor(order: { id: string; amountMinor: number; name: string }, email: string): Record<string, unknown>;
    create(id: string, body: unknown): Promise<ProviderPayment>;
    get(id: string): Promise<ProviderPayment>;
}
export function yookassaGateway(fetcher: typeof fetch = fetch): PaymentGateway {
    const parsed = gatewayConfigSchema.safeParse({ mode: process.env.BILLING_PAYMENT_MODE, shopId: process.env.YOOKASSA_SHOP_ID,
        secret: process.env.YOOKASSA_SECRET_KEY, returnUrl: process.env.BILLING_RETURN_URL,
        receiptMode: process.env.YOOKASSA_RECEIPT_MODE, vatCode: process.env.YOOKASSA_VAT_CODE ? Number(process.env.YOOKASSA_VAT_CODE) : undefined });
    if (!parsed.success) throw new HttpError(503, 'Оплата пока не подключена');
    const config = parsed.data;
    const call = async (path: string, method: 'GET' | 'POST', id?: string, body?: unknown) => {
        let response: Response;
        try {
            response = await fetcher(`https://api.yookassa.ru/v3/${path}`, { method,
                headers: { Authorization: `Basic ${Buffer.from(`${config.shopId}:${config.secret}`).toString('base64')}`, 'Content-Type': 'application/json', ...(id ? { 'Idempotence-Key': id } : {}) },
                body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12000), redirect: 'error' });
        } catch { throw new HttpError(502, 'Платёжный сервис не ответил. Повторите проверку этого же заказа.'); }
        if (!response.ok) throw new HttpError(502, 'Не удалось получить подтверждение оплаты. Повторите проверку этого же заказа.');
        try { return paymentSchema.parse(await response.json()); }
        catch { throw new HttpError(502, 'Не удалось проверить ответ платёжного сервиса'); }
    };
    return {
        mode: config.mode, merchantId: config.shopId,
        requestFor(order, email) {
            const returnUrl = new URL(config.returnUrl);
            returnUrl.searchParams.set('order', order.id);
            const amount = { value: (order.amountMinor / 100).toFixed(2), currency: 'RUB' };
            return { amount, capture: true, description: `Рацион: ${order.name}`.slice(0, 128),
                confirmation: { type: 'redirect', return_url: returnUrl.toString() }, metadata: { order_id: order.id },
                ...(config.receiptMode === 'provider' ? { receipt: { customer: { email }, items: [{ description: order.name, quantity: '1.00', amount, vat_code: config.vatCode, payment_mode: 'full_payment', payment_subject: 'service' }] } } : {}) };
        },
        create: (id, body) => call('payments', 'POST', id, body),
        get: id => {
            if (!/^[a-zA-Z0-9-]{1,64}$/.test(id)) throw new HttpError(400, 'Некорректный номер платежа');
            return call(`payments/${id}`, 'GET');
        },
    };
}
