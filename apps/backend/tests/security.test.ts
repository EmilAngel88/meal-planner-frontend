import { describe, it } from 'node:test';
import type {} from '../types';
import assert from 'node:assert/strict';
import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AuthAttemptWindow } from '../routes/auth';
import { authenticate } from '../middleware/auth';
import { errorHandler } from '../middleware/errors';
import { comparePassword, hashPassword } from '../utils/hash';
import { activitySchema, authSchema, idSchema, listQuerySchema, productQuerySchema } from '../utils/validation';

describe('request validation and bounded authentication', () => {
    it('rejects ambiguous identifiers and pagination inputs', () => {
        for (const value of [true, false, null, [1], '', '1e2', '1.0', ' 1', '01', 0, -1, 2147483648]) assert.equal(idSchema.safeParse(value).success, false, String(value));
        assert.equal(idSchema.parse('2147483647'), 2147483647);
        assert.deepEqual(listQuerySchema.parse({}), { limit: 200, offset: 0 });
        assert.deepEqual(listQuerySchema.parse({ limit: '25', offset: '200' }), { limit: 25, offset: 200 });
        for (const input of [{ limit: 201 }, { offset: -1 }, { limit: ['20'] }, { offset: '1e5' }]) assert.equal(listQuerySchema.safeParse(input).success, false);
        assert.equal(productQuerySchema.safeParse({ q: ['milk'] }).success, false);
        assert.equal(productQuerySchema.safeParse({ q: 'a'.repeat(201) }).success, false);
        assert.equal(productQuerySchema.safeParse({ q: 'a\0b' }).success, false);
    });
    it('validates bcrypt byte length and activity totals', () => {
        assert.equal(authSchema.safeParse({ email: 'user@example.test', password: 'я'.repeat(37) }).success, false);
        assert.equal(authSchema.safeParse({ email: 'user@example.test', password: 'я'.repeat(36) }).success, true);
        assert.equal(activitySchema.safeParse({ activities: [{ activityId: 1, duration: 60 }, { activityId: 1, duration: 30 }] }).success, false);
        assert.equal(activitySchema.safeParse({ activities: [{ activityId: 1, duration: 1000 }, { activityId: 2, duration: 1000 }] }).success, false);
    });
    it('throttles existing keys and fails closed when memory capacity is reached', () => {
        const window = new AuthAttemptWindow(2, 10_000, 2);
        assert.equal(window.consume('a', 0), 0);
        assert.equal(window.consume('a', 1), 0);
        assert.equal(window.consume('a', 2), 10);
        assert.equal(window.consume('b', 100), 0);
        assert.equal(window.consume('new-key', 200), 10);
        assert.equal(window.consume('new-key', 10_000), 0);
        assert.equal(window.consume('b', 10_000), 0);
        assert.equal(window.consume('b', 10_001), 1);
        window.reset('b');
        assert.equal(window.consume('b', 10_002), 0);
    });
    it('bounds expensive password work and releases slots after completion', async () => {
        const pending = Array.from({ length: 8 }, () => hashPassword('A valid test password'));
        await assert.rejects(hashPassword('A ninth password'), { status: 503 });
        const [hash] = await Promise.all(pending);
        assert.equal(await comparePassword('A valid test password', hash), true);
        assert.equal(await comparePassword('Wrong password', hash), false);
        assert.equal(await comparePassword('A missing account'), false);
    });
    it('rejects oversized authorization headers before token processing', async () => {
        let status = 0;
        const res = { status(code: number) { status = code; return this; }, json() { return this; } } as unknown as Response;
        await authenticate({ headers: { authorization: `Bearer ${'a'.repeat(3000)}` } } as Request, res, (() => assert.fail('Must reject the header')) as NextFunction);
        assert.equal(status, 401);
    });
    it('returns retryable overload errors without database internals', () => {
        for (const code of ['P2024', 'P2028', 'P2037']) {
            let status = 0;
            let body: { message: string } | undefined;
            const headers = new Map<string, string>();
            const res = { headersSent: false, setHeader(name: string, value: string) { headers.set(name, value); }, status(value: number) { status = value; return this; }, json(value: { message: string }) { body = value; return this; } } as unknown as Response;
            errorHandler(new Prisma.PrismaClientKnownRequestError('secret database connection details', { code, clientVersion: 'test' }), {} as Request, res, (() => assert.fail('Must handle known errors')) as NextFunction);
            assert.equal(status, 503);
            assert.equal(headers.get('Retry-After'), '3');
            assert.ok(body && !body.message.includes('secret'));
        }
    });
});
