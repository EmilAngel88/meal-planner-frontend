import { Router, type RequestHandler } from 'express';
import { createHash } from 'node:crypto';
import prisma from '../prisma';
import { hashPassword, comparePassword } from '../utils/hash';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/auth';
import { authSchema, registerSchema, HttpError } from '../utils/validation';

const router = Router();
// Entries stay in expiry order. Cleanup is amortized O(1), with a hard memory cap.
export class AuthAttemptWindow {
    private readonly entries = new Map<string, { count: number; until: number }>();
    constructor(private readonly limit: number, private readonly duration = 15 * 60 * 1000, private readonly capacity = 10000) {}
    consume(key: string, now = Date.now()): number {
        for (const [expiredKey, entry] of this.entries) {
            if (entry.until > now) break;
            this.entries.delete(expiredKey);
        }
        let entry = this.entries.get(key);
        if (!entry) {
            // New identities must not bypass throttling once the map is full.
            if (this.entries.size >= this.capacity) return Math.max(1, Math.ceil((this.entries.values().next().value!.until - now) / 1000));
            entry = { count: 0, until: now + this.duration };
            this.entries.set(key, entry);
        }
        if (entry.count >= this.limit) return Math.max(1, Math.ceil((entry.until - now) / 1000));
        entry.count++;
        return 0;
    }
    reset(key: string) { this.entries.delete(key); }
}
// A shared network may contain hundreds of users; restrict each IP/email pair more tightly.
const ipAttempts = new AuthAttemptWindow(600);
const identityAttempts = new AuthAttemptWindow(12);
const identityKey = (ip: string, email: string) => createHash('sha256').update(`${ip}\0${email}`).digest('hex');
const throttle: RequestHandler = (req, res, next) => {
    const ip = req.ip || 'unknown';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '';
    const retryAfter = ipAttempts.consume(ip) || identityAttempts.consume(identityKey(ip, email));
    if (retryAfter) {
        res.setHeader('Retry-After', retryAfter);
        res.status(429).json({ message: 'Слишком много попыток входа. Попробуйте позже.' }); return;
    }
    next();
};
const tokenFor = (userId: number) => jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '7d', algorithm: 'HS256' });
router.post('/register', throttle, async (req, res) => {
    const { email, password } = registerSchema.parse(req.body);
    if (await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } })) throw new HttpError(409, 'Аккаунт с таким email уже существует');
    const user = await prisma.user.create({ data: { email, password: await hashPassword(password) }, select: { id: true, email: true } });
    identityAttempts.reset(identityKey(req.ip || 'unknown', email));
    res.status(201).json({ token: tokenFor(user.id), user: { id: user.id, email: user.email, canManageFeedback: false, canManageBilling: false } });
});
router.post('/login', throttle, async (req, res) => {
    const { email, password } = authSchema.parse(req.body);
    const select = { id: true, email: true, password: true, canManageFeedback: true, canManageBilling: true };
    // New accounts have normalized email and use the unique index; retain legacy casing support.
    const user = await prisma.user.findUnique({ where: { email }, select })
        || await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select });
    const validPassword = await comparePassword(password, user?.password);
    if (!user || !validPassword) throw new HttpError(401, 'Неверный email или пароль');
    identityAttempts.reset(identityKey(req.ip || 'unknown', email));
    res.json({ token: tokenFor(user.id), user: { id: user.id, email: user.email, canManageFeedback: user.canManageFeedback, canManageBilling: user.canManageBilling } });
});
router.get('/me', authenticate, async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, email: true, canManageFeedback: true, canManageBilling: true } });
    if (!user) throw new HttpError(401, 'Аккаунт не найден. Войдите снова.');
    res.json(user);
});
export default router;
