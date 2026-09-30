import { serverConfig, validateProductionSecret } from '../utils/config';
import { app, beginShutdown } from './app';
import prisma from '../prisma';
import { generationPool } from '../services/generation-pool';

async function start() {
    if (!process.env.JWT_SECRET) throw new Error('Задайте JWT_SECRET в apps/backend/.env');
    validateProductionSecret(process.env.JWT_SECRET, process.env.NODE_ENV);
    if (!process.env.DATABASE_URL) throw new Error('Задайте DATABASE_URL в apps/backend/.env');
    await prisma.$connect();
    const { port, host } = serverConfig;
    const server = app.listen(port, host, () => console.log(`Meal Planner API: http://${host}:${port}`));
    server.headersTimeout = 10000;
    server.requestTimeout = 15000;
    server.timeout = Math.max(65000, serverConfig.generationTimeoutMs + 15000);
    server.keepAliveTimeout = 5000;
    server.maxRequestsPerSocket = 1000;
    server.on('error', error => { console.error(error.message); void generationPool.close(); void prisma.$disconnect(); process.exitCode = 1; });
    let stopping = false;
    const stop = () => {
        if (stopping) return;
        stopping = true;
        beginShutdown();
        const deadline = setTimeout(() => { server.closeAllConnections(); void generationPool.close(); process.exit(1); }, serverConfig.shutdownTimeoutMs);
        deadline.unref();
        server.close(() => {
            void (async () => {
                await generationPool.close();
                await prisma.$disconnect();
                clearTimeout(deadline);
            })().catch(error => { console.error('Shutdown failed:', error.message); process.exitCode = 1; });
        });
        server.closeIdleConnections();
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
}
start().catch(error => { console.error(error.message); process.exitCode = 1; });
