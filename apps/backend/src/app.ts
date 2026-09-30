import type {} from '../types';
import { serverConfig } from '../utils/config';
import express from 'express';
import cors from 'cors';
import prisma from '../prisma';
import authRoutes from '../routes/auth';
import recipeRoutes from '../routes/recipes';
import productRoutes from '../routes/products';
import caloriesRoutes from '../routes/calories';
import menuRoutes from '../routes/menu';
import feedbackRoutes from '../routes/feedback';
import billingRoutes from '../routes/billing';
import { errorHandler } from '../middleware/errors';
import { requestCapacity } from '../middleware/capacity';

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', serverConfig.trustProxy);
app.use(cors({ origin: serverConfig.corsOrigins }));
app.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
let stopping = false;
export const beginShutdown = () => { stopping = true; };
app.get('/live', (_req, res) => res.json({ status: 'ok' }));
app.use((_req, res, next) => {
    if (stopping) { res.setHeader('Retry-After', '5'); res.status(503).json({ status: 'unavailable', message: 'Сервис перезапускается' }); return; }
    next();
});
// Coalesce readiness probes so a monitor burst cannot fill the database pool.
let health: Promise<boolean> | undefined;
let healthExpires = 0;
app.get(['/health', '/ready'], async (_req, res) => {
    if (!health || Date.now() > healthExpires) {
        healthExpires = Infinity;
        health = prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false).finally(() => { healthExpires = Date.now() + 1000; });
    }
    const ready = await health;
    res.status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'unavailable' });
});
app.use(requestCapacity(serverConfig.maxConcurrentRequests));
app.use(express.json({ limit: '256kb' }));
app.use('/auth', authRoutes);
app.use('/recipes', recipeRoutes);
app.use('/products', productRoutes);
app.use('/calories', caloriesRoutes);
app.use('/menu', menuRoutes);
app.use('/feedback', feedbackRoutes);
app.use('/billing', billingRoutes);
app.get('/', (_req, res) => res.json({ message: 'Meal Planner API' }));
app.use((_req, res) => res.status(404).json({ message: 'Маршрут не найден' }));
app.use(errorHandler);
