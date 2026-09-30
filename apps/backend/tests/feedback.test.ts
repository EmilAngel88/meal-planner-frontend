import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { adminFeedbackQuerySchema, createFeedbackSchema, feedbackQuerySchema, feedbackRetryAfter, updateFeedbackSchema } from '../utils/feedback';

describe('feedback privacy and input boundaries', () => {
    const input = { requestId: randomUUID(), category: 'idea', message: 'Добавьте любимые блюда' };
    it('normalizes text and strips author, status and privilege fields', () => {
        assert.deepEqual(createFeedbackSchema.parse({ ...input, requestId: input.requestId.toUpperCase(), message: `  ${input.message}  `, userId: 2, status: 'done', reply: 'spoof', version: 99, role: 'admin' }), input);
        for (const message of ['          ', '123456789', 'a'.repeat(4001), 'valid text\0invalid']) assert.equal(createFeedbackSchema.safeParse({ ...input, message }).success, false);
        assert.equal(createFeedbackSchema.safeParse({ ...input, message: 'a'.repeat(4000) }).success, true);
    });
    it('accepts route templates and rejects URLs, record identifiers and query data', () => {
        for (const pagePath of ['/', '/recipes/:id', '/feedback/admin']) assert.equal(createFeedbackSchema.safeParse({ ...input, pagePath }).success, true);
        for (const pagePath of ['https://example.test/menu', '/recipes/42', '/menu?plan=1', '/account#private', '//example.test', '/secret']) assert.equal(createFeedbackSchema.safeParse({ ...input, pagePath }).success, false);
        assert.equal(createFeedbackSchema.safeParse({ ...input, category: 'urgent' }).success, false);
        assert.equal(createFeedbackSchema.safeParse({ ...input, requestId: 'not-a-uuid' }).success, false);
        assert.equal(createFeedbackSchema.safeParse({ ...input, deviceType: 'Mozilla/5' }).success, false);
    });
    it('bounds cursors, limits, categories and status updates', () => {
        assert.deepEqual(feedbackQuerySchema.parse({}), { limit: 20 });
        assert.deepEqual(feedbackQuerySchema.parse({ cursor: '4', limit: '50' }), { cursor: 4, limit: 50 });
        for (const query of [{ cursor: true }, { cursor: ['1'] }, { limit: '0' }, { limit: '51' }]) assert.equal(feedbackQuerySchema.safeParse(query).success, false);
        assert.equal(adminFeedbackQuerySchema.safeParse({ status: 'reviewing' }).success, false);
        assert.equal(updateFeedbackSchema.safeParse({ status: 'new', reply: '', version: 1 }).success, true);
        for (const patch of [{ status: 'other', reply: '', version: 1 }, { status: 'done', reply: 'x'.repeat(2001), version: 1 }, { status: 'new', reply: '', version: 0 }, { status: 'new', reply: '' }]) assert.equal(updateFeedbackSchema.safeParse(patch).success, false);
    });
    it('uses the fifth and twentieth newest submission for rolling limits, including exact expiry', () => {
        const now = new Date('2026-10-02T12:00:00Z');
        const dates = (count: number, ago: number) => Array.from({ length: count }, () => new Date(now.getTime() - ago));
        assert.equal(feedbackRetryAfter(dates(4, 0), now), 0);
        assert.equal(feedbackRetryAfter(dates(5, 1000), now), 599);
        assert.equal(feedbackRetryAfter(dates(5, 600000), now), 0);
        assert.equal(feedbackRetryAfter(dates(19, 3600000), now), 0);
        assert.equal(feedbackRetryAfter(dates(20, 3600000), now), 23 * 3600);
        assert.equal(feedbackRetryAfter(dates(20, 86400000), now), 0);
    });
});
