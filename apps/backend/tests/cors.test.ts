import { it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';

const backendRoot = resolve(__dirname, '..');
const envFile = resolve(backendRoot, '.env');
const localOrigins = (existsSync(envFile) ? parse(readFileSync(envFile)).CORS_ORIGINS : undefined)
    ?? 'http://localhost:3000,http://127.0.0.1:3000';

// Fresh processes exercise import order; no database connection or user data is needed.
for (const scenario of [
    { name: 'local startup', cwd: backendRoot, origins: undefined, expected: localOrigins },
    { name: 'startup from the repository root', cwd: resolve(backendRoot, '../..'), origins: undefined, expected: localOrigins },
    { name: 'explicit deployment settings', cwd: backendRoot, origins: 'http://localhost:8080, https://menu.example.test', expected: 'http://localhost:8080,https://menu.example.test' },
]) {
    it(`preserves CORS for ${scenario.name} when a dependency loads another environment`, () => {
        const env: NodeJS.ProcessEnv = { ...process.env, TS_NODE_PROJECT: resolve(backendRoot, 'tsconfig.json') };
        delete env.CORS_ORIGINS;
        if (scenario.origins !== undefined) env.CORS_ORIGINS = scenario.origins;
        const script = `
            const assert = require('node:assert/strict');
            require(${JSON.stringify(resolve(backendRoot, 'utils/config.ts'))});
            // Reproduce Prisma loading the .env captured by its generated client.
            process.env.CORS_ORIGINS = 'https://unrelated.example.test';
            const { app } = require(${JSON.stringify(resolve(backendRoot, 'src/app.ts'))});
            const server = app.listen(0, '127.0.0.1', async (listenError) => {
                if (listenError) { console.error(listenError); process.exitCode = 1; return; }
                try {
                    const base = 'http://127.0.0.1:' + server.address().port;
                    for (const origin of ${JSON.stringify(scenario.expected.split(',').map(s => s.trim()).filter(Boolean))}) {
                        for (const path of ['/auth/me', '/calories/profile', '/calories/logs']) {
                            const preflight = await fetch(base + path, { method: 'OPTIONS', headers: {
                                Origin: origin, 'Access-Control-Request-Method': 'GET',
                                'Access-Control-Request-Headers': 'authorization,content-type'
                            }});
                            assert.equal(preflight.status, 204);
                            assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
                            assert.match(preflight.headers.get('access-control-allow-headers'), /authorization/i);
                            const response = await fetch(base + path, { headers: { Origin: origin } });
                            assert.equal(response.status, 401);
                            assert.equal(response.headers.get('access-control-allow-origin'), origin);
                            await response.text();
                        }
                    }
                    const forbidden = await fetch(base + '/auth/me', { method: 'OPTIONS', headers: {
                        Origin: 'https://unrelated.example.test', 'Access-Control-Request-Method': 'GET'
                    }});
                    assert.equal(forbidden.headers.get('access-control-allow-origin'), null);
                } catch (error) { console.error(error); process.exitCode = 1; }
                finally { server.close(); }
            });
        `;
        const result = spawnSync(process.execPath, ['-r', require.resolve('ts-node/register'), '-e', script], {
            cwd: scenario.cwd, env, encoding: 'utf8', timeout: 30_000,
        });
        assert.equal(result.status, 0, result.stderr || result.error?.message);
    });
}
