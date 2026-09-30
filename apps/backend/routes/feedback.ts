import { Router, type RequestHandler } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../prisma';
import { authenticate } from '../middleware/auth';
import { HttpError, idSchema } from '../utils/validation';
import { adminFeedbackQuerySchema, createFeedbackSchema, feedbackQuerySchema, feedbackRetryAfter, updateFeedbackSchema } from '../utils/feedback';

const router = Router();
router.use(authenticate);
const select = {
    id: true, requestId: true, category: true, message: true, pagePath: true, deviceType: true,
    status: true, reply: true, version: true, createdAt: true, updatedAt: true,
} satisfies Prisma.FeedbackSelect;
const adminSelect = { ...select, user: { select: { id: true, email: true } } } satisfies Prisma.FeedbackSelect;
type AdminRow = Prisma.FeedbackGetPayload<{ select: typeof adminSelect }>;
const adminItem = ({ user, ...feedback }: AdminRow) => ({ ...feedback, author: user });
const requireAdmin: RequestHandler = async (req, _res, next) => {
    // The token only identifies the account. Permission is read anew on every request.
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { canManageFeedback: true } });
    if (user?.canManageFeedback !== true) throw new HttpError(403, 'Доступ к обращениям есть только у команды проекта');
    next();
};
function page<T extends { id: number }>(rows: T[], limit: number) {
    const items = rows.slice(0, limit);
    return { items, nextCursor: rows.length > limit ? items[items.length - 1].id : null };
}

router.post('/', async (req, res) => {
    const input = createFeedbackSchema.parse(req.body);
    const userId = req.userId!;
    const result = await prisma.$transaction(async client => {
        // A per-account transaction lock makes retries and both rolling limits atomic
        // across requests and processes without blocking unrelated accounts.
        await client.$executeRaw`SELECT pg_advisory_xact_lock(17002, ${userId}::integer)`;
        const existing = await client.feedback.findUnique({ where: { userId_requestId: { userId, requestId: input.requestId } }, select });
        if (existing) {
            if (existing.category !== input.category || existing.message !== input.message || existing.pagePath !== (input.pagePath ?? null) || existing.deviceType !== (input.deviceType ?? null)) {
                throw new HttpError(409, 'Этот запрос уже отправлен с другим текстом. Создайте новое обращение.');
            }
            return { kind: 'replay' as const, item: existing };
        }
        const [{ now }] = await client.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
        const recent = await client.feedback.findMany({
            where: { userId, createdAt: { gt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20, select: { createdAt: true },
        });
        const retryAfterSeconds = feedbackRetryAfter(recent.map(item => item.createdAt), now);
        if (retryAfterSeconds) return { kind: 'limited' as const, retryAfterSeconds };
        const item = await client.feedback.create({ data: { ...input, userId, createdAt: now }, select });
        return { kind: 'created' as const, item };
    });
    if (result.kind === 'limited') {
        res.setHeader('Retry-After', result.retryAfterSeconds);
        res.status(429).json({ message: 'Вы уже отправили несколько обращений. Спасибо! Следующее можно отправить немного позже.', retryAfterSeconds: result.retryAfterSeconds });
        return;
    }
    res.status(result.kind === 'created' ? 201 : 200).json(result.item);
});

router.get('/', async (req, res) => {
    const { cursor, limit } = feedbackQuerySchema.parse(req.query);
    const rows = await prisma.feedback.findMany({
        where: { userId: req.userId!, ...(cursor ? { id: { lt: cursor } } : {}) }, orderBy: { id: 'desc' }, take: limit + 1, select,
    });
    res.json(page(rows, limit));
});

router.get('/admin', requireAdmin, async (req, res) => {
    const { cursor, limit, status, category } = adminFeedbackQuerySchema.parse(req.query);
    const rows = await prisma.feedback.findMany({
        where: { ...(cursor ? { id: { lt: cursor } } : {}), status, category }, orderBy: { id: 'desc' }, take: limit + 1, select: adminSelect,
    });
    res.json(page(rows.map(adminItem), limit));
});

router.get('/admin/:id', requireAdmin, async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const item = await prisma.feedback.findUnique({ where: { id }, select: adminSelect });
    if (!item) throw new HttpError(404, 'Обращение не найдено');
    res.json(adminItem(item));
});

router.patch('/admin/:id', requireAdmin, async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const { status, reply, version } = updateFeedbackSchema.parse(req.body);
    const item = await prisma.$transaction(async client => {
        const result = await client.feedback.updateMany({ where: { id, version }, data: { status, reply, version: { increment: 1 } } });
        if (!result.count) {
            if (!await client.feedback.findUnique({ where: { id }, select: { id: true } })) throw new HttpError(404, 'Обращение не найдено');
            throw new HttpError(409, 'Обращение уже изменилось. Обновите список и повторите правку.');
        }
        return client.feedback.findUniqueOrThrow({ where: { id }, select: adminSelect });
    });
    res.json(adminItem(item));
});

export default router;
