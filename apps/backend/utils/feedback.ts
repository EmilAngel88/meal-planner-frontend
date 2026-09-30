import { z } from 'zod';
import { idSchema } from './validation';

export const feedbackCategorySchema = z.enum(['bug', 'idea', 'other']);
export const feedbackStatusSchema = z.enum(['new', 'planned', 'in_progress', 'done', 'closed']);
const text = z.string().regex(/^[^\0]*$/, 'Текст содержит недопустимый символ').trim();
// Only route templates are accepted: never persist an origin, query, recipe ID or fragment.
export const feedbackPageSchema = z.enum(['/', '/menu', '/products', '/recipes', '/recipes/:id', '/shopping-list', '/account', '/feedback', '/feedback/admin', '/login', '/register']);
export const createFeedbackSchema = z.object({
    requestId: z.string().uuid('Не удалось распознать запрос. Обновите страницу.').transform(value => value.toLowerCase()),
    category: feedbackCategorySchema,
    message: text.min(10, 'Напишите хотя бы 10 символов').max(4000, 'Не более 4000 символов'),
    pagePath: feedbackPageSchema.optional(),
    deviceType: z.enum(['mobile', 'tablet', 'desktop']).optional(),
});
export const feedbackQuerySchema = z.object({
    cursor: idSchema.optional(),
    limit: idSchema.pipe(z.number().max(50)).default(20),
});
export const adminFeedbackQuerySchema = feedbackQuerySchema.extend({
    status: feedbackStatusSchema.optional(), category: feedbackCategorySchema.optional(),
});
export const updateFeedbackSchema = z.object({
    status: feedbackStatusSchema,
    reply: text.max(2000, 'Ответ не должен превышать 2000 символов'),
    version: z.number().int().positive().max(2147483646),
});

// newestFirst contains at most the latest 20 submissions in the last 24 hours.
export function feedbackRetryAfter(newestFirst: readonly Date[], now: Date): number {
    const current = now.getTime();
    const shortWindow = 10 * 60 * 1000;
    const dayWindow = 24 * 60 * 60 * 1000;
    const shortRetry = newestFirst.length >= 5 ? newestFirst[4].getTime() + shortWindow - current : 0;
    const dayRetry = newestFirst.length >= 20 ? newestFirst[19].getTime() + dayWindow - current : 0;
    return Math.max(0, Math.ceil(Math.max(shortRetry, dayRetry) / 1000));
}
