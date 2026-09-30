import type { RequestHandler } from 'express';
import { serverConfig } from '../utils/config';

export function requestCapacity(limit: number): RequestHandler {
    let active = 0;
    return (_req, res, next) => {
        if (active >= limit) { res.setHeader('Retry-After', '3'); res.status(503).json({ message: 'Сервис занят. Повторите попытку через несколько секунд.' }); return; }
        active++;
        let released = false;
        const release = () => { if (!released) { released = true; active--; } };
        res.once('finish', release);
        res.once('close', release);
        next();
    };
}

// Reserve admission before database reads, and keep a user's slot through persistence.
export function generationAdmission(limit = serverConfig.generationWorkers + serverConfig.generationQueueLimit): RequestHandler {
    const users = new Set<number>();
    return (req, res, next) => {
        if (users.has(req.userId)) { res.setHeader('Retry-After', '5'); res.status(429).json({ message: 'Ваше меню уже составляется. Дождитесь результата.' }); return; }
        if (users.size >= limit) { res.setHeader('Retry-After', '5'); res.status(503).json({ message: 'Сейчас составляется много меню. Повторите попытку через несколько секунд.' }); return; }
        users.add(req.userId);
        let released = false;
        const release = () => { if (!released) { released = true; users.delete(req.userId); } };
        res.once('finish', release);
        res.once('close', release);
        next();
    };
}
