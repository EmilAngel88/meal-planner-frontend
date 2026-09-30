import { config } from 'dotenv';
import { basename, dirname, resolve } from 'node:path';

// Both ts-node (utils/) and the compiled server (dist/utils/) use the backend's
// own .env. The repository .env belongs to Docker Compose, not the local API.
const moduleRoot = resolve(__dirname, '..');
const backendRoot = basename(moduleRoot) === 'dist' ? dirname(moduleRoot) : moduleRoot;
config({ path: resolve(backendRoot, '.env'), quiet: true });

function integerSetting(name: string, fallback: number, min: number, max: number) {
    const value = Number(process.env[name] ?? fallback);
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} должен быть целым числом от ${min} до ${max}`);
    return value;
}

// Trust only explicitly configured proxy addresses/CIDRs, never arbitrary X-Forwarded-For.
const trustProxy = process.env.TRUST_PROXY?.split(',').map(value => value.trim()).filter(Boolean);
if (trustProxy?.some(value => ['true', 'false'].includes(value) || /^\d+$/.test(value))) {
    throw new Error('TRUST_PROXY должен содержать адреса или CIDR доверенных прокси');
}

export function pooledDatabaseUrl(value: string | undefined) {
    if (!value) return undefined;
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL должен указывать на PostgreSQL');
    for (const [key, fallback] of Object.entries({ connection_limit: 10, pool_timeout: 5, connect_timeout: 5, socket_timeout: 30 })) {
        if (!url.searchParams.has(key)) url.searchParams.set(key, String(fallback));
    }
    return url.toString();
}

export function validateProductionSecret(secret: string | undefined, environment: string | undefined) {
    if (environment !== 'production') return;
    const placeholder = /^(replace[-_ ]with|change[-_ ]?me|your[-_ ](?:jwt[-_ ])?secret)/i;
    if (!secret || Buffer.byteLength(secret, 'utf8') < 32 || placeholder.test(secret.trim())) {
        throw new Error('Для production задайте случайный JWT_SECRET длиной не менее 32 байт; значение из .env.example использовать нельзя');
    }
}

// Capture settings before Prisma can load the .env recorded during generation.
// Explicit deployment environment variables still take precedence over .env.
export const serverConfig = {
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://127.0.0.1:3000')
        .split(',').map(origin => origin.trim()).filter(Boolean),
    port: integerSetting('PORT', 5001, 1, 65535),
    host: process.env.HOST || '127.0.0.1',
    trustProxy: trustProxy?.length ? trustProxy : false,
    maxConcurrentRequests: integerSetting('MAX_CONCURRENT_REQUESTS', 256, 1, 10000),
    generationWorkers: integerSetting('GENERATION_WORKERS', 2, 1, 8),
    generationQueueLimit: integerSetting('GENERATION_QUEUE_LIMIT', 4, 0, 100),
    generationTimeoutMs: integerSetting('GENERATION_TIMEOUT_MS', 45000, 1000, 120000),
    shutdownTimeoutMs: integerSetting('SHUTDOWN_TIMEOUT_MS', 30000, 1000, 120000),
    databaseUrl: pooledDatabaseUrl(process.env.DATABASE_URL),
};
