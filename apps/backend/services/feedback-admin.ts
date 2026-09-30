import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';

export async function setFeedbackAdmin(client: PrismaClient, emailInput: string, action: 'grant' | 'revoke') {
    const email = z.string().trim().email().max(254).toLowerCase().parse(emailInput);
    return client.$transaction(async transaction => {
        const users = await transaction.user.findMany({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true, email: true }, take: 2 });
        if (users.length === 0) throw new Error('Аккаунт с этим email не найден. Сначала зарегистрируйте владельца; команда не создаёт аккаунты.');
        if (users.length !== 1) throw new Error('Найдено несколько аккаунтов с таким email. Сначала устраните неоднозначность вручную.');
        return transaction.user.update({ where: { id: users[0].id }, data: { canManageFeedback: action === 'grant' }, select: { id: true, email: true, canManageFeedback: true } });
    });
}
