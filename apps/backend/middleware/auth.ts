import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';

export const authenticate: RequestHandler = async (req, res, next) => {
    const header = req.headers.authorization;
    const match = header && header.length <= 2048 ? header.match(/^Bearer (\S+)$/i) : null;
    if (!match) { res.status(401).json({ message: 'Войдите в аккаунт' }); return; }
    try {
        const payload = jwt.verify(match[1], process.env.JWT_SECRET!, { algorithms: ['HS256'] });
        if (typeof payload === 'string' || !Number.isSafeInteger(payload.userId) || payload.userId <= 0 || payload.userId > 2147483647 || !Number.isFinite(payload.exp)) throw new Error('Invalid token');
        req.userId = payload.userId;
    } catch { res.status(401).json({ message: 'Сессия истекла. Войдите снова.' }); return; }
    try {
        if (!await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true } })) {
            res.status(401).json({ message: 'Аккаунт не найден. Войдите снова.' }); return;
        }
        next();
    } catch (error) { next(error); }
};
