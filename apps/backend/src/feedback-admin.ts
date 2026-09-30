import prisma from '../prisma';
import { setFeedbackAdmin } from '../services/feedback-admin';

async function main() {
    const [action, email, ...extra] = process.argv.slice(2);
    if (!['grant', 'revoke'].includes(action) || !email || extra.length) {
        throw new Error('Использование: feedback:admin -- grant|revoke email. Доступ выдаётся только существующему проверенному аккаунту владельца.');
    }
    const user = await setFeedbackAdmin(prisma, email, action as 'grant' | 'revoke');
    console.log(`${action === 'grant' ? 'Доступ к обращениям выдан' : 'Доступ к обращениям отозван'}: ${user.email} (id ${user.id}). Роль аккаунта не менялась. Обновите страницу в приложении.`);
}
main().catch(error => {
    // Do not print connection strings or database internals on an operator's terminal.
    console.error(error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'Не удалось изменить доступ. Проверьте подключение к базе.');
    process.exitCode = 1;
}).finally(() => prisma.$disconnect());
