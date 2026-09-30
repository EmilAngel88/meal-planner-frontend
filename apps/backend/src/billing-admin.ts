import prisma from '../prisma';
import { z } from 'zod';

async function main() {
    const [action, input, ...extra] = process.argv.slice(2);
    if (!['grant', 'revoke'].includes(action) || !input || extra.length) throw new Error('Использование: billing:admin -- grant|revoke email');
    const email = z.string().trim().email().max(254).parse(input);
    const user = await prisma.$transaction(async tx => {
        const matches = await tx.user.findMany({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true }, take: 2 });
        if (matches.length !== 1) throw new Error('Нужен один существующий аккаунт с этим email. Сначала зарегистрируйте владельца.');
        const updated = await tx.user.update({ where: { id: matches[0].id }, data: { canManageBilling: action === 'grant' }, select: { id: true, email: true } });
        await tx.billingAudit.create({ data: { actorId: updated.id, action: `admin_${action}`, details: { source: 'server_command', email: updated.email } } });
        return updated;
    });
    console.log(`${action === 'grant' ? 'Доступ к монетизации выдан' : 'Доступ к монетизации отозван'}: ${user.email}. Обновите страницу приложения.`);
}
main().catch(error => {
    console.error(error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'Не удалось изменить доступ. Проверьте подключение к базе и миграции.');
    process.exitCode = 1;
}).finally(() => prisma.$disconnect());
