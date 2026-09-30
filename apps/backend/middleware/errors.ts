import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { HttpError } from '../utils/validation';

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
    if (res.headersSent) { next(error); return; }
    if (error instanceof ZodError) {
        res.status(400).json({ message: error.issues.slice(0, 8).map(i => `${i.path.join('.')}: ${i.message}`).join('; ') });
        return;
    }
    if (error instanceof HttpError) {
        if (error.status === 503) res.setHeader('Retry-After', '3');
        res.status(error.status).json({ message: error.message }); return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') { res.status(409).json({ message: 'Такая запись уже существует' }); return; }
        if (error.code === 'P2003') { res.status(409).json({ message: 'Запись используется в рецепте. Сначала уберите её из ингредиентов.' }); return; }
        if (error.code === 'P2025') { res.status(404).json({ message: 'Запись не найдена' }); return; }
        if (error.code === 'P2034') { res.status(409).json({ message: 'Запись изменилась одновременно с вашим запросом. Повторите действие.' }); return; }
        if (['P2024', 'P2028', 'P2037'].includes(error.code)) {
            res.setHeader('Retry-After', '3');
            res.status(503).json({ message: 'Сервис временно занят. Попробуйте через несколько секунд.' }); return;
        }
    }
    if (error instanceof SyntaxError && 'body' in error) { res.status(400).json({ message: 'Некорректный JSON' }); return; }
    if (typeof error === 'object' && error && 'status' in error && error.status === 413) { res.status(413).json({ message: 'Слишком большой запрос' }); return; }
    console.error('API request failed:', error instanceof Error ? error.name : 'Unknown error');
    res.status(500).json({ message: 'Не удалось выполнить запрос. Повторите попытку позже.' });
};
