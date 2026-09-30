import { parentPort } from 'node:worker_threads';
import { generatePlan, type GenerationInput } from './generation-plan';

if (!parentPort) throw new Error('Generation worker requires a parent port');
parentPort.on('message', (input: GenerationInput) => {
    try { parentPort!.postMessage({ ok: true, result: generatePlan(input) }); }
    catch (error) { parentPort!.postMessage({ ok: false, message: error instanceof Error ? error.message : 'Не удалось составить меню' }); }
});
