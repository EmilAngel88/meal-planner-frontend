import prisma from '../prisma';
import { syncOrder } from '../services/billing/orders';
import { yookassaGateway } from '../services/billing/provider';

async function main() {
    const gateway = yookassaGateway();
    // Cursor pagination never accumulates the entire ledger in memory.
    let cursor: string | undefined;
    let checked = 0, failed = 0;
    for (;;) {
        const page = await prisma.billingOrder.findMany({ where: { providerMode: gateway.mode, merchantId: gateway.merchantId, status: { in: ['pending', 'paid'] } },
            orderBy: { id: 'asc' }, take: 50, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
        if (!page.length) break;
        for (const order of page) {
            try { await syncOrder(order, gateway); checked++; }
            catch { failed++; console.error(`Не удалось проверить заказ ${order.id}. Проверьте подключение и журнал заказов.`); }
        }
        cursor = page[page.length - 1].id;
    }
    console.log(`Проверено: ${checked}. Требуют проверки: ${failed}.`);
    if (failed) process.exitCode = 1;
}
main().catch(() => { console.error('Проверка оплат не выполнена. Проверьте настройки подключения.'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
