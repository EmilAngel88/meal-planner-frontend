import { Router } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../prisma';
import { authenticate } from '../middleware/auth';
import { idSchema, productSchema, productQuerySchema, HttpError } from '../utils/validation';

const router = Router();
router.use(authenticate);
export const visibleProductWhere = (userId: number) => ({ OR: [{ isBase: true }, { userId }] });
const searchKey = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ru').replaceAll('ё', 'е');
router.get('/', async (req, res) => {
    const { q, limit, offset } = productQuerySchema.parse(req.query);
    const orderBy = [{ isBase: 'desc' as const }, { name: 'asc' as const }, { id: 'asc' as const }];
    if (!q) {
        res.json(await prisma.product.findMany({ where: visibleProductWhere(req.userId), orderBy, take: limit, skip: offset })); return;
    }
    // Filter before pagination; the database normalizer also works in C-locale clusters.
    const matches = await prisma.$queryRaw<Array<{ id: number }>>`
        SELECT "id" FROM "Product"
        WHERE ("isBase" = true OR "userId" = ${req.userId})
          AND strpos(mp_search_key("name" || ' ' || "brand"), ${searchKey(q)}) > 0
        ORDER BY "isBase" DESC, "name" ASC, "id" ASC LIMIT ${limit} OFFSET ${offset}`;
    res.json(await prisma.product.findMany({ where: { id: { in: matches.map(product => product.id) }, ...visibleProductWhere(req.userId) }, orderBy }));
});
router.get('/:id', async (req, res) => {
    const product = await prisma.product.findFirst({ where: { id: idSchema.parse(req.params.id), ...visibleProductWhere(req.userId) } });
    if (!product) throw new HttpError(404, 'Продукт не найден');
    res.json(product);
});
async function checkName(client: Prisma.TransactionClient, userId: number, name: string, brand: string, id?: number) {
    // Serialize duplicate checking and writes per owner, including differently cased names.
    await client.$executeRaw`SELECT pg_advisory_xact_lock(17001, ${userId}::integer)`;
    const matches = await client.$queryRaw<Array<{ id: number }>>`
        SELECT "id" FROM "Product" WHERE "userId" = ${userId}
        AND mp_search_key("name") = ${searchKey(name)} AND mp_search_key("brand") = ${searchKey(brand)}
        AND ${id ? Prisma.sql`"id" <> ${id}` : Prisma.sql`TRUE`} LIMIT 1`;
    if (matches.length) throw new HttpError(409, 'У вас уже есть такой продукт этого производителя');
}
async function checkBase(client: Prisma.TransactionClient, baseProductId: number | null) {
    if (baseProductId && !await client.product.findFirst({ where: { id: baseProductId, isBase: true }, select: { id: true } })) throw new HttpError(400, 'Выберите продукт из базового каталога');
}
router.post('/', async (req, res) => {
    const data = productSchema.parse(req.body);
    const product = await prisma.$transaction(async client => {
        await checkName(client, req.userId, data.name, data.brand);
        await checkBase(client, data.baseProductId);
        return client.product.create({ data: { ...data, userId: req.userId } });
    });
    res.status(201).json(product);
});
router.put('/:id', async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const data = productSchema.parse(req.body);
    const product = await prisma.$transaction(async client => {
        if (!await client.product.findFirst({ where: { id, userId: req.userId, isBase: false }, select: { id: true } })) throw new HttpError(404, 'Продукт не найден');
        await checkName(client, req.userId, data.name, data.brand, id);
        await checkBase(client, data.baseProductId);
        return client.product.update({ where: { id, userId: req.userId, isBase: false }, data });
    });
    res.json(product);
});
router.delete('/:id', async (req, res) => {
    const id = idSchema.parse(req.params.id);
    await prisma.product.delete({ where: { id, userId: req.userId, isBase: false } });
    res.status(204).send();
});
export default router;
