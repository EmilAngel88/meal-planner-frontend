import { Worker } from 'node:worker_threads';
import { extname, join } from 'node:path';
import { serverConfig } from '../utils/config';
import { HttpError } from '../utils/validation';
import type { GenerationInput, GenerationResult } from './generation-plan';

type Job = {
    input: GenerationInput;
    resolve: (result: GenerationResult) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
    cleanup: () => void;
};
type Slot = { worker: Worker; job?: Job; retiring?: boolean };

export class GenerationPool {
    private slots = new Set<Slot>();
    private queue: Job[] = [];
    private closed = false;

    constructor(private options = {
        workers: serverConfig.generationWorkers,
        queueLimit: serverConfig.generationQueueLimit,
        timeoutMs: serverConfig.generationTimeoutMs,
    }) {}

    run(input: GenerationInput, signal?: AbortSignal): Promise<GenerationResult> {
        if (this.closed) return Promise.reject(new HttpError(503, 'Сервис перезапускается. Повторите попытку чуть позже.'));
        if (signal?.aborted) return Promise.reject(new HttpError(499, 'Запрос отменён'));
        const active = [...this.slots].filter(slot => slot.job).length;
        if (active + this.queue.length >= this.options.workers + this.options.queueLimit) {
            return Promise.reject(new HttpError(503, 'Сейчас составляется много меню. Повторите попытку через несколько секунд.'));
        }
        return new Promise((resolve, reject) => {
            const cancel = () => this.cancel(job, new HttpError(499, 'Запрос отменён'));
            const job: Job = {
                input, resolve, reject,
                timer: setTimeout(() => this.cancel(job, new HttpError(503, 'Составление меню заняло слишком много времени. Попробуйте ещё раз или уменьшите число дней.')), this.options.timeoutMs),
                cleanup: () => { clearTimeout(job.timer); signal?.removeEventListener('abort', cancel); },
            };
            signal?.addEventListener('abort', cancel, { once: true });
            this.queue.push(job);
            this.drain();
        });
    }

    private cancel(job: Job, error: Error) {
        const index = this.queue.indexOf(job);
        if (index >= 0) this.queue.splice(index, 1);
        else {
            const slot = [...this.slots].find(item => item.job === job);
            if (!slot) return;
            slot.job = undefined;
            slot.retiring = true;
            void slot.worker.terminate().finally(() => { this.slots.delete(slot); this.drain(); });
        }
        job.cleanup();
        job.reject(error);
        this.drain();
    }

    private createSlot(): Slot {
        const extension = extname(__filename);
        const worker = new Worker(join(__dirname, `generation-worker${extension}`), {
            execArgv: extension === '.ts' ? ['-r', require.resolve('ts-node/register/transpile-only')] : [],
            env: {},
            resourceLimits: { maxOldGenerationSizeMb: 256 },
        });
        const slot: Slot = { worker };
        this.slots.add(slot);
        worker.on('message', (message: { ok: boolean; result: GenerationResult; message: string }) => {
            const job = slot.job;
            if (!job) return;
            slot.job = undefined;
            job.cleanup();
            worker.unref();
            if (message.ok) job.resolve(message.result);
            else job.reject(new HttpError(422, message.message));
            this.drain();
        });
        const fail = () => {
            if (!this.slots.delete(slot)) return;
            const job = slot.job;
            slot.job = undefined;
            if (job) {
                job.cleanup();
                job.reject(new HttpError(503, 'Не удалось завершить составление меню. Повторите попытку.'));
            }
            void worker.terminate();
            this.drain();
        };
        worker.on('error', fail);
        worker.on('exit', fail);
        worker.unref();
        return slot;
    }

    private drain() {
        while (!this.closed && this.queue.length) {
            let slot = [...this.slots].find(item => !item.job && !item.retiring);
            if (!slot && this.slots.size < this.options.workers) {
                try { slot = this.createSlot(); }
                catch { this.cancel(this.queue[0], new HttpError(503, 'Сервис составления меню временно недоступен')); return; }
            }
            if (!slot) return;
            slot.job = this.queue.shift()!;
            slot.worker.ref();
            slot.worker.postMessage(slot.job.input);
        }
    }

    async close() {
        this.closed = true;
        for (const job of this.queue.splice(0)) { job.cleanup(); job.reject(new HttpError(503, 'Сервис перезапускается')); }
        const slots = [...this.slots];
        this.slots.clear();
        for (const slot of slots) {
            if (slot.job) { slot.job.cleanup(); slot.job.reject(new HttpError(503, 'Сервис перезапускается')); slot.job = undefined; }
        }
        await Promise.all(slots.map(slot => slot.worker.terminate()));
    }
}

export const generationPool = new GenerationPool();
