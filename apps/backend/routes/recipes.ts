import { Router } from 'express';
import prisma from '../prisma';
import { authenticate } from '../middleware/auth';
import { recipeSchema, recipeUpdateSchema, idSchema, listQuerySchema, HttpError } from '../utils/validation';
import { quantityForWeight } from '../services/nutrition';
import { visibleProductWhere } from './products';

const router = Router();
router.use(authenticate);
const recipeInclude = { ingredients: { include: { product: true }, orderBy: { id: 'asc' as const } } };
export const visibleRecipeWhere = (userId: number) => ({ OR: [{ isBase: true, isEnabled: true }, { userId }] });
// Every referenced product must belong to the user or the base catalog.
async function ingredientsFor(userId: number, ingredients: Array<{ productId: number; weight: number }>) {
    if (new Set(ingredients.map(i => i.productId)).size !== ingredients.length) throw new HttpError(400, 'Объедините повторяющиеся ингредиенты');
    const products = await prisma.product.findMany({ where: { id: { in: ingredients.map(i => i.productId) }, ...visibleProductWhere(userId) } });
    const byId = new Map(products.map(product => [product.id, product]));
    return ingredients.map(ingredient => {
        const product = byId.get(ingredient.productId);
        if (!product) throw new HttpError(400, 'Ингредиент содержит недоступный продукт');
        return { productId: product.id, weight: ingredient.weight, unitType: product.unitType, quantity: quantityForWeight(product, ingredient.weight) };
    });
}
router.get('/', async (req, res) => {
    const { limit, offset } = listQuerySchema.parse(req.query);
    res.json(await prisma.recipe.findMany({ where: visibleRecipeWhere(req.userId), include: recipeInclude, orderBy: [{ isBase: 'desc' }, { title: 'asc' }, { id: 'asc' }], take: limit, skip: offset }));
});
router.get('/:id', async (req, res) => {
    const recipe = await prisma.recipe.findFirst({ where: { id: idSchema.parse(req.params.id), ...visibleRecipeWhere(req.userId) }, include: recipeInclude });
    if (!recipe) throw new HttpError(404, 'Рецепт не найден');
    res.json(recipe);
});
router.post('/', async (req, res) => {
    const { ingredients, ...data } = recipeSchema.parse(req.body);
    res.status(201).json(await prisma.recipe.create({ data: { ...data, userId: req.userId, ingredients: { create: await ingredientsFor(req.userId, ingredients) } }, include: recipeInclude }));
});
router.post('/:id/copy', async (req, res) => {
    const source = await prisma.recipe.findFirst({ where: { id: idSchema.parse(req.params.id), ...visibleRecipeWhere(req.userId) }, include: recipeInclude });
    if (!source) throw new HttpError(404, 'Рецепт не найден');
    const title = req.body?.title === undefined ? `${source.title.slice(0, 185)} (моя версия)` : recipeSchema.shape.title.parse(req.body.title);
    res.status(201).json(await prisma.recipe.create({ data: { ...recipeSchema.omit({ ingredients: true, title: true }).parse(source), title, mealTypes: source.mealTypes, userId: req.userId, baseRecipeId: source.isBase ? source.id : source.baseRecipeId, ingredients: { create: await ingredientsFor(req.userId, source.ingredients) } }, include: recipeInclude }));
});
router.put('/:id', async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const { ingredients, ...data } = recipeUpdateSchema.parse(req.body);
    if (!await prisma.recipe.findFirst({ where: { id, userId: req.userId, isBase: false }, select: { id: true } })) throw new HttpError(404, 'Рецепт не найден');
    const ingredientData = ingredients === undefined ? undefined : { deleteMany: {}, create: await ingredientsFor(req.userId, ingredients) };
    res.json(await prisma.recipe.update({ where: { id, userId: req.userId, isBase: false }, data: { ...data, ...(ingredients !== undefined || data.servings !== undefined ? { cookedWeight: null } : {}), ingredients: ingredientData }, include: recipeInclude }));
});
router.delete('/:id', async (req, res) => {
    const id = idSchema.parse(req.params.id);
    await prisma.recipe.delete({ where: { id, userId: req.userId, isBase: false } });
    res.status(204).send();
});
export default router;
