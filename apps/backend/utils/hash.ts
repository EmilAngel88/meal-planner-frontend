import bcrypt from 'bcrypt';
import { HttpError } from './validation';

// Keep expensive bcrypt work from filling libuv's queue and starving other requests.
const MAX_PASSWORD_OPERATIONS = 8;
let activeOperations = 0;
async function passwordOperation<T>(operation: () => Promise<T>): Promise<T> {
    if (activeOperations >= MAX_PASSWORD_OPERATIONS) throw new HttpError(503, 'Вход временно занят. Попробуйте через несколько секунд.');
    activeOperations++;
    try { return await operation(); }
    finally { activeOperations--; }
}

// A real cost-10 hash makes unknown accounts follow the same password-check path.
const dummyHash = '$2b$10$TxtuQGd.6RCNrV9Bwp51PeOMJYFAYqHzdnX4sS/34UAB9ug9G8.u.';
export const hashPassword = (password: string) => passwordOperation(() => bcrypt.hash(password, 10));
export const comparePassword = (password: string, hash?: string) => passwordOperation(() => bcrypt.compare(password, hash || dummyHash));
