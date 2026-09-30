import { z } from 'zod';

const name = z.string().trim().min(1).max(60);
const limit = z.number().int().min(1).max(10000);
export const billingConfigSchema = z.object({
    enabled: z.boolean(),
    salesEnabled: z.boolean(),
    free: z.object({ name, generationsPerMonth: limit }).strict(),
    plus: z.object({ name, generationsPerMonth: limit }).strict(),
    trial: z.object({ enabled: z.boolean(), days: z.number().int().min(1).max(30), generations: limit }).strict(),
    offers: z.array(z.object({
        id: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/), title: name,
        days: z.number().int().min(1).max(366),
        priceRub: z.number().int().min(1).max(100000), enabled: z.boolean(),
    }).strict()).min(1).max(8),
}).strict().superRefine((value, ctx) => {
    if (new Set(value.offers.map(offer => offer.id)).size !== value.offers.length) ctx.addIssue({ code: 'custom', path: ['offers'], message: 'Коды вариантов оплаты должны быть разными' });
    if (value.plus.generationsPerMonth <= value.free.generationsPerMonth) ctx.addIssue({ code: 'custom', path: ['plus', 'generationsPerMonth'], message: 'Лимит Плюс должен быть больше бесплатного' });
    if (value.salesEnabled && (!value.enabled || !value.offers.some(offer => offer.enabled))) ctx.addIssue({ code: 'custom', path: ['salesEnabled'], message: 'Для продаж включите монетизацию и хотя бы один вариант оплаты' });
});
export type BillingConfig = z.infer<typeof billingConfigSchema>;
export const defaultBillingConfig: BillingConfig = {
    enabled: false, salesEnabled: false,
    free: { name: 'Базовый', generationsPerMonth: 3 },
    plus: { name: 'Плюс', generationsPerMonth: 60 },
    trial: { enabled: true, days: 7, generations: 5 },
    offers: [
        { id: 'month', title: '30 дней', days: 30, priceRub: 299, enabled: true },
        { id: 'year', title: '365 дней', days: 365, priceRub: 2490, enabled: true },
    ],
};
export function monthWindow(now: Date) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { bucket: `month:${start.toISOString().slice(0, 7)}`, end };
}
export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);
