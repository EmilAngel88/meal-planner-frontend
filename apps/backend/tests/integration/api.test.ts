import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import jwt from 'jsonwebtoken';
import { per100g } from '../../services/nutrition';
import { CATALOG_PORTIONS, DAILY_VARIETY_LIMITS, mealWeightLimit, canAddToRecipe, estimatedMealWeight, isPorridge } from '../../services/portions';

config({ quiet: true });
const testDatabase = `meal_planner_test_${process.pid}_${Date.now()}`;
const databaseUrl = new URL(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
if (!process.env.TEST_DATABASE_URL && !['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname)) throw new Error('Для удалённой БД укажите TEST_DATABASE_URL явно');
const admin = new PrismaClient({ datasourceUrl: databaseUrl.toString() });
databaseUrl.pathname = `/${testDatabase}`;
databaseUrl.searchParams.set('schema', 'public');
process.env.DATABASE_URL = databaseUrl.toString();
process.env.JWT_SECRET = 'integration-test-secret-not-for-production';
let server: Server;
let prisma: PrismaClient;
let base = '';
let tokenA = '';
let tokenB = '';
let productId = 0;
let recipeId = 0;
let planId = 0;
let shoppingBefore: unknown;

async function request(path: string, method = 'GET', body?: unknown, token = tokenA) {
    const response = await fetch(`${base}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
}
const product = { name: 'Тестовый продукт', calories: 200, protein: 25, fat: 8, carbs: 7, mealTypes: ['any'], unitType: 'gram' };
const profile = { age: 30, gender: 'male', height: 180, weight: 80, activity: 'medium', goal: 'maintain', calories: 2400 };

describe('API with a fresh isolated PostgreSQL database', { concurrency: false }, () => {
    before(async () => {
        assert.match(testDatabase, /^meal_planner_test_\d+_\d+$/);
        await admin.$executeRawUnsafe(`CREATE DATABASE "${testDatabase}"`);
        const migration = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { env: process.env, encoding: 'utf8' });
        assert.equal(migration.status, 0, migration.stderr);
        const seed = spawnSync(process.execPath, ['-r', 'ts-node/register', 'prisma/seed.ts'], { env: process.env, encoding: 'utf8' });
        assert.equal(seed.status, 0, seed.stderr);
        prisma = (await import('../../prisma')).default;
        const { app } = await import('../../src/app');
        server = await new Promise<Server>(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
        base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });
    after(async () => {
        if (server) await new Promise<void>(resolve => server.close(() => resolve()));
        if (prisma) await prisma.$disconnect();
        assert.match(testDatabase, /^meal_planner_test_\d+_\d+$/);
        await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${testDatabase}" WITH (FORCE)`);
        await admin.$disconnect();
    });
    it('health is ready; protected endpoints and malformed tokens are rejected', async () => {
        assert.equal((await request('/health', 'GET', undefined, '')).status, 200);
        assert.equal((await request('/recipes', 'GET', undefined, '')).status, 401);
        const malformed = jwt.sign({}, process.env.JWT_SECRET!);
        assert.equal((await request('/products', 'GET', undefined, malformed)).status, 401);
    });
    it('registers isolated accounts and prevents normalized duplicate email', async () => {
        const a = await request('/auth/register', 'POST', { email: ' First@Example.test ', password: 'Test-pass-123' }, '');
        assert.equal(a.status, 201); tokenA = a.body.token;
        assert.equal(a.body.user.email, 'first@example.test');
        const b = await request('/auth/register', 'POST', { email: 'second@example.test', password: 'Test-pass-123' }, '');
        assert.equal(b.status, 201); tokenB = b.body.token;
        assert.equal((await request('/auth/register', 'POST', { email: 'FIRST@example.test', password: 'Test-pass-123' }, '')).status, 409);
        assert.equal((await request('/auth/login', 'POST', { email: 'first@example.test', password: 'wrong' }, '')).status, 401);
        assert.equal((await request('/auth/login', 'POST', { email: 'FIRST@example.test', password: 'Test-pass-123' }, '')).status, 200);
    });
    it('returns JSON validation errors and rejects missing profile', async () => {
        assert.equal((await request('/products', 'POST', { ...product, calories: -1 })).status, 400);
        assert.equal((await request('/recipes', 'POST', { title: ' ' })).status, 400);
        assert.equal((await request('/recipes/not-an-id')).status, 400);
        assert.equal((await request('/calories/manual', 'POST', { calories: 2000 })).status, 400);
        assert.equal((await request('/menu/generate', 'POST', {})).status, 400);
    });
    it('allows equal product names across accounts without leaking ingredient metadata', async () => {
        const a = await request('/products', 'POST', product); assert.equal(a.status, 201); productId = a.body.id;
        const b = await request('/products', 'POST', product, tokenB); assert.equal(b.status, 201); assert.notEqual(b.body.id, productId);
        assert.equal((await request('/products', 'POST', product)).status, 409);
        const list = await request('/products', 'GET', undefined, tokenB);
        assert.ok(!list.body.some((p: { id: number }) => p.id === productId));
        assert.ok(list.body.every((p: object) => !('ingredients' in p)));
        assert.equal((await request(`/products/${productId}`, 'GET', undefined, tokenB)).status, 404);
    });
    it('stores private label variants, searches brands and copies complete cooking instructions', async () => {
        const baseProduct = (await request('/products')).body.find((p: any) => p.isBase && p.name === 'Молоко 2.5%');
        const label = { ...product, name: 'Молоко', brand: 'Марка А', baseProductId: baseProduct.id, nutritionBasis: '100ml', unitType: 'ml', density: 1.03 };
        const a = await request('/products', 'POST', label);
        assert.equal(a.status, 201);
        assert.equal((await request('/products', 'POST', { ...label, brand: 'Марка Б' })).status, 201);
        assert.equal((await request('/products', 'POST', { ...label, brand: 'марка а' })).status, 409);
        assert.equal((await request('/products', 'POST', { ...label, brand: 'Х', baseProductId: a.body.id })).status, 400);
        assert.equal((await request('/products?q=' + encodeURIComponent('Марка А'))).body.length, 1);
        assert.equal((await request('/products?q=' + encodeURIComponent('Марка А'), 'GET', undefined, tokenB)).body.length, 0);
        const payload = { title: 'Каша на четыре порции', servings: 4, cookingMode: 'batch', instructions: ['Сварите основу.', 'Разделите на порции.'], prepMinutes: 5, cookMinutes: 10, storageDays: 2, batchNotes: 'Фрукты отдельно', storageInstructions: 'Охладите и уберите в холодильник.', freezerFriendly: true, cookedWeight: 1400, ingredients: [{ productId: a.body.id, weight: 1030 }] };
        const r = await request('/recipes', 'POST', payload);
        assert.equal(r.status, 201);
        assert.equal(r.body.ingredients[0].quantity, 1000);
        const copy = await request(`/recipes/${r.body.id}/copy`, 'POST', {});
        assert.equal(copy.status, 201);
        for (const key of ['servings', 'instructions', 'prepMinutes', 'cookMinutes', 'cookingMode', 'storageDays', 'batchNotes', 'storageInstructions', 'freezerFriendly', 'cookedWeight']) assert.deepEqual(copy.body[key], (payload as any)[key]);
        assert.equal((await request(`/recipes/${r.body.id}/copy`, 'POST', {}, tokenB)).status, 404);
        assert.equal((await request(`/recipes/${r.body.id}`, 'PUT', { ingredients: [...payload.ingredients, ...payload.ingredients] })).status, 400);
        assert.equal((await request(`/recipes/${r.body.id}`)).body.ingredients[0].quantity, 1000);
        const changed = await request(`/recipes/${r.body.id}`, 'PUT', { servings: 5 });
        assert.equal(changed.status, 200);
        assert.equal(changed.body.cookedWeight, null);
    });
    it('reseeding preserves catalogue identities, recipe yields and private data', async () => {
        const beforeProducts = await prisma.product.findMany({ orderBy: { id: 'asc' } });
        const beforeRecipes = await prisma.recipe.findMany({ orderBy: { id: 'asc' } });
        const seed = spawnSync(process.execPath, ['-r', 'ts-node/register', 'prisma/seed.ts'], { env: process.env, encoding: 'utf8' });
        assert.equal(seed.status, 0, seed.stderr);
        assert.deepEqual(await prisma.product.findMany({ orderBy: { id: 'asc' } }), beforeProducts);
        assert.deepEqual(await prisma.recipe.findMany({ orderBy: { id: 'asc' } }), beforeRecipes);
    });
    it('rejects cross-account ingredient references and editing', async () => {
        assert.equal((await request('/recipes', 'POST', { title: 'Чужой', ingredients: [{ productId, weight: 100 }] }, tokenB)).status, 400);
        assert.equal((await request(`/products/${productId}`, 'PUT', product, tokenB)).status, 404);
        const r = await request('/recipes', 'POST', { title: 'Мой рецепт', mealTypes: ['any'], ingredients: [{ productId, weight: 300 }] });
        assert.equal(r.status, 201); recipeId = r.body.id;
        assert.equal((await request(`/recipes/${recipeId}`, 'GET', undefined, tokenB)).status, 404);
        assert.equal((await request(`/products/${productId}`, 'DELETE')).status, 409);
    });
    it('updates recipes atomically and validates ownership of collections and preferences', async () => {
        assert.equal((await request(`/recipes/${recipeId}`, 'PUT', { ingredients: [{ productId: 2147483647, weight: 100 }] })).status, 400);
        assert.equal((await request(`/recipes/${recipeId}`)).body.ingredients.length, 1);
        assert.equal((await request('/menu/preferences', 'PUT', { preferences: [{ recipeId, maxPerWeek: -1 }] })).status, 400);
        assert.equal((await request('/menu/preferences', 'PUT', { preferences: [{ recipeId }] }, tokenB)).status, 400);
        assert.equal((await request('/menu/collections', 'POST', { name: 'Чужая', recipeIds: [recipeId] }, tokenB)).status, 400);
        const collection = await request('/menu/collections', 'POST', { name: 'Любимые', recipeIds: [recipeId, recipeId] });
        assert.equal(collection.status, 201); assert.equal(collection.body.items.length, 1);
        assert.equal((await request(`/menu/collections/${collection.body.id}`, 'DELETE', undefined, tokenB)).status, 404);
    });
    it('saves a goal, weight log and validates dates and activity inputs', async () => {
        assert.equal((await request('/calories/manual', 'POST', profile)).status, 200);
        assert.equal((await request('/calories/profile')).body.calories, 2400);
        assert.equal((await request('/calories/weight-log', 'POST', { weight: 79, date: '2026-02-31' })).status, 400);
        const log = await request('/calories/weight-log', 'POST', { weight: 79, date: '2026-09-27' }); assert.equal(log.status, 201);
        assert.equal((await request(`/calories/logs/${log.body.id}`, 'DELETE', undefined, tokenB)).status, 404);
        assert.equal((await request('/calories/activities', 'POST', { activities: [{ activityId: 1, duration: -20 }] })).status, 400);
        assert.equal((await request(`/calories/logs/${log.body.id}`, 'DELETE')).status, 204);
    });
    it('persists goal adjustments and recipe yield, and validates impossible macro targets', async () => {
        const calculated = await request('/calories/calculate', 'POST', { ...profile, activity: 'training4', goal: 'loss', goalRate: 0.15 });
        assert.equal(calculated.body.calories, 2145);
        assert.equal(calculated.body.profile.goalRate, 0.15);
        const batch = await request('/recipes', 'POST', { title: 'На четыре порции', servings: 4, ingredients: [{ productId, weight: 1000 }] });
        assert.equal(batch.status, 201);
        const copied = await request(`/recipes/${batch.body.id}/copy`, 'POST', {});
        assert.equal(copied.body.servings, 4);
        assert.equal((await request(`/recipes/${batch.body.id}`, 'PUT', { servings: 0 })).status, 400);
        assert.equal((await request(`/recipes/${batch.body.id}`, 'DELETE')).status, 204);
        assert.equal((await request(`/recipes/${copied.body.id}`, 'DELETE')).status, 204);
        await request('/calories/manual', 'POST', { ...profile, calories: 800, weight: 100 });
        const invalid = await request('/menu/generate', 'POST', {});
        assert.equal(invalid.status, 400);
        assert.match(invalid.body.message, /Белки и жиры/);
        await request('/calories/manual', 'POST', profile);
    });
    it('generates six days with separate snacks, consistent totals and saved snapshots', async () => {
        await request('/menu/preferences', 'PUT', { preferences: [{ recipeId, includeInGeneration: true, enabled: true, maxPerWeek: 2 }] });
        const result = await request('/menu/generate', 'POST', { startDate: '2026-09-28' });
        assert.equal(result.status, 201, JSON.stringify(result.body));
        const plan = result.body; planId = plan.id;
        assert.equal(plan.daysCount, 6);
        assert.equal(plan.startDate.slice(0, 10), '2026-09-28');
        for (let day = 0; day < 6; day++) {
            const items = plan.items.filter((i: { dayIndex: number }) => i.dayIndex === day);
            assert.equal(new Set(items.map((i: { mealIndex: number }) => i.mealIndex)).size, 5);
            assert.equal(new Set(items.filter((i: { mealType: string }) => i.mealType === 'snack').map((i: { mealIndex: number }) => i.mealIndex)).size, 2);
            const ids = items.filter((i: { recipeId: number }) => i.recipeId).map((i: { recipeId: number }) => i.recipeId);
            assert.equal(new Set(ids).size, ids.length);
        }
        assert.ok(Math.abs(plan.items.reduce((sum: number, i: { calories: number }) => sum + i.calories, 0) - plan.totalCalories) < 0.01);
        assert.ok(plan.items.every((i: { shoppingSnapshot: unknown[] }) => i.shoppingSnapshot.length > 0));
        assert.equal((await request(`/menu/${planId}`, 'GET', undefined, tokenB)).status, 404);
        assert.equal((await request(`/menu/${planId}/shopping-list`, 'GET', undefined, tokenB)).status, 404);
        const shopping = await request(`/menu/${planId}/shopping-list`); assert.equal(shopping.status, 200); assert.ok(shopping.body.rows.length > 0); shoppingBefore = shopping.body;
    });
    it('generates everyday portions at several calorie targets and reports compromises honestly', async () => {
        await request('/menu/preferences', 'PUT', { preferences: [{ recipeId, includeInGeneration: false, enabled: false }] });
        const products = (await request('/products')).body as Array<{ id: number; calories: number; protein: number; fat: number; carbs: number }>;
        for (const calories of [1600, 2000, 2759, 3200]) {
            await request('/calories/manual', 'POST', { ...profile, calories });
            const response = await request('/menu/generate', 'POST', {});
            assert.equal(response.status, 201, JSON.stringify(response.body));
            const plan = response.body;
            assert.equal(plan.targetProtein, 140 * 6);
            assert.equal(plan.targetFat, 72 * 6);
            assert.equal(plan.settings.generatorVersion, 5);
            assert.equal('oatsMaxGrams' in plan.settings, false);
            for (const item of plan.items) for (const key of ['calories', 'protein', 'fat', 'carbs'] as const) {
                const actual = item.shoppingSnapshot.reduce((sum: number, ingredient: any) => sum + per100g(products.find(p => p.id === ingredient.productId)!)[key] * ingredient.weight / 100, 0);
                assert.equal(item[key], Math.round((actual + 1e-9) * 10) / 10, `Nutrition must match shopping for ${item.title}`);
            }
            const use = new Map<number, number>();
            for (let day = 0; day < 6; day++) {
                const items = plan.items.filter((i: any) => i.dayIndex === day);
                const amounts: Record<string, number> = {};
                for (const item of items) for (const ingredient of item.shoppingSnapshot) {
                    amounts[ingredient.name] = (amounts[ingredient.name] || 0) + ingredient.weight;
                    if (ingredient.name === 'Яйцо куриное' && ['Омлет с цельнозерновым хлебом', 'Яйца с сыром и овощами', 'Рис с яйцом и овощами'].includes(item.title)) assert.ok(Number.isInteger(ingredient.quantity), 'Whole egg dishes must use whole eggs');
                }
                for (const [name, limit] of Object.entries(DAILY_VARIETY_LIMITS)) assert.ok((amounts[name] || 0) <= limit, `${name}: ${amounts[name]} > ${limit}`);
                const total = items.reduce((sum: number, i: any) => sum + i.calories, 0);
                if (Math.abs(total - calories) / calories > 0.1) assert.ok(plan.settings.warnings.some((w: string) => w.startsWith(`День ${day + 1}:`) && w.includes('калории')));
                for (const slot of new Set(items.map((i: any) => i.mealIndex))) {
                    const mealItems = items.filter((i: any) => i.mealIndex === slot);
                    const recipes = mealItems.filter((i: any) => i.sourceType === 'recipe');
                    assert.equal(recipes.length, 1);
                    const main = recipes[0];
                    use.set(main.recipeId, (use.get(main.recipeId) || 0) + 1);
                    assert.ok(mealItems.length <= 2);
                    assert.ok(estimatedMealWeight(mealItems.flatMap((i: any) => i.shoppingSnapshot), isPorridge(main.title)) <= mealWeightLimit(main.mealType) + 1e-8);
                    for (const ingredient of main.shoppingSnapshot) assert.ok(ingredient.weight <= (CATALOG_PORTIONS[ingredient.name]?.max || 300));
                    for (const side of mealItems.filter((i: any) => i.sourceType === 'product')) assert.ok(canAddToRecipe(main.shoppingSnapshot.map((i: any) => i.name), side.title, main.mealType));
                }
            }
            assert.ok([...use.values()].every(count => count <= 4));
            if (calories === 2759) {
                assert.ok(Math.abs(plan.totalCalories / plan.targetCalories - 1) <= 0.1, 'Default catalog should meet the weekly calorie target');
                for (const nutrient of ['Protein', 'Fat', 'Carbs']) assert.ok(Math.abs(plan[`total${nutrient}`] / plan[`target${nutrient}`] - 1) <= 0.2, `Default catalog should balance weekly ${nutrient}`);
            }
        }
        await request('/calories/manual', 'POST', profile);
    });
    it('meets the reported 2800 kcal goal with the saved five-meal rhythm', async () => {
        await request('/calories/manual', 'POST', { ...profile, calories: 2800, weight: 68 });
        const meals = [['breakfast', 0.2], ['snack', 0.1], ['lunch', 0.35], ['snack', 0.1], ['dinner', 0.25]].map(([type, percent]) => ({ type, title: type, percent, maxItems: 2 }));
        const response = await request('/menu/generate', 'POST', { meals, oatsMaxGrams: 65 });
        assert.equal(response.status, 201, JSON.stringify(response.body));
        assert.deepEqual(response.body.settings.warnings, []);
        assert.equal('oatsMaxGrams' in response.body.settings, false);
        for (let day = 0; day < 6; day++) {
            const items = response.body.items.filter((item: any) => item.dayIndex === day);
            assert.equal(new Set(items.map((item: any) => item.mealIndex)).size, 5);
            const calories = items.reduce((sum: number, item: any) => sum + item.calories, 0);
            assert.ok(Math.abs(calories / 2800 - 1) < 0.03, `day ${day + 1}: ${calories}`);
        }
        await request('/calories/manual', 'POST', profile);
    });
    it('ignores obsolete oat caps and reports a deliberately infeasible one-meal day', async () => {
        const response = await request('/menu/generate', 'POST', { daysCount: 1, oatsMaxGrams: 45, meals: [{ type: 'breakfast', title: 'Мой завтрак', percent: 1, maxItems: 2 }] });
        assert.equal(response.status, 201, JSON.stringify(response.body));
        assert.equal('oatsMaxGrams' in response.body.settings, false);
        assert.ok(response.body.settings.warnings.some((warning: string) => warning.includes('калории')));
        assert.equal('oatsMaxGrams' in (await request(`/menu/${response.body.id}`)).body.settings, false);
        await request('/calories/manual', 'POST', profile);
    });
    it('historical shopping survives recipe edits and deletion', async () => {
        // Force a plan sourced from the custom recipe, so the regression does not depend on optimizer choices.
        const source = await prisma.recipe.findUniqueOrThrow({ where: { id: recipeId }, include: { ingredients: { include: { product: true } } } });
        const plan = await prisma.mealPlan.findUniqueOrThrow({ where: { id: planId } });
        await prisma.mealPlanItem.create({ data: { mealPlanId: planId, recipeId, dayIndex: 0, mealIndex: 0, mealTitle: 'Тест', mealType: 'lunch', title: source.title, sourceType: 'recipe', scale: 1, weight: 300, calories: 600, protein: 75, fat: 24, carbs: 21, shoppingSnapshot: [{ productId, name: product.name, weight: 300, quantity: 300, unitType: 'gram' }] } });
        const before = (await request(`/menu/${plan.id}/shopping-list`)).body;
        shoppingBefore = before.rows;
        assert.equal(before.cooking[recipeId].cookingMode, source.cookingMode);
        assert.equal((await request(`/menu/${plan.id}/shopping-list`, 'GET', undefined, tokenB)).status, 404);
        assert.equal((await request(`/recipes/${recipeId}`, 'PUT', { ingredients: [{ productId, weight: 900 }] })).status, 200);
        assert.deepEqual((await request(`/menu/${planId}/shopping-list`)).body.rows, shoppingBefore);
        assert.equal((await request(`/recipes/${recipeId}`, 'DELETE')).status, 204);
        assert.equal((await request(`/products/${productId}`, 'DELETE')).status, 204);
        const after = (await request(`/menu/${planId}/shopping-list`)).body;
        assert.deepEqual(after.rows, shoppingBefore);
        assert.equal(after.cooking[recipeId], undefined);
    });
    it('copies base recipes and refuses modification of the base catalog', async () => {
        const recipes = await request('/recipes'); const baseRecipe = recipes.body.find((r: { isBase: boolean }) => r.isBase);
        const copy = await request(`/recipes/${baseRecipe.id}/copy`, 'POST', {});
        assert.equal(copy.status, 201); assert.equal(copy.body.isBase, false); assert.ok(copy.body.ingredients.length);
        assert.equal((await request(`/recipes/${baseRecipe.id}`, 'PUT', { title: 'Изменено' })).status, 404);
        assert.equal((await request(`/recipes/${baseRecipe.id}`, 'DELETE')).status, 404);
    });
    it('rejects expensive or inconsistent generation requests and isolates deletion', async () => {
        assert.equal((await request('/menu/generate', 'POST', { candidateLimit: 9999 })).status, 400);
        assert.equal((await request('/menu/generate', 'POST', { daysCount: 2.5 })).status, 400);
        assert.equal((await request(`/menu/${planId}`, 'DELETE', undefined, tokenB)).status, 404);
        assert.equal((await request(`/menu/${planId}`, 'DELETE')).status, 204);
        assert.equal((await request(`/menu/${planId}`)).status, 404);
    });
    it('previews a personal goal without saving and persists the questionnaire with a server-owned result', async () => {
        const registration = await request('/auth/register', 'POST', { email: 'goal-preview@example.test', password: 'Test-pass-123' }, '');
        const token = registration.body.token;
        const input = { mode: 'calculated', goal: 'loss', age: 30, height: 180, weight: 80, gender: 'male', routine: 'mixed', exercise: 'regular', pace: 'moderate' };
        assert.equal((await request('/calories/goal/preview', 'POST', input, '')).status, 401);
        const preview = await request('/calories/goal/preview', 'POST', input, token);
        assert.equal(preview.status, 200);
        assert.equal(preview.body.calories, 2500);
        assert.equal((await request('/calories/profile', 'GET', undefined, token)).body, null);
        const otherBefore = (await request('/calories/profile')).body;
        const saved = await request('/calories/goal', 'POST', { ...input, calories: 600, userId: otherBefore.userId, estimate: { calories: 600 } }, token);
        assert.equal(saved.status, 200);
        assert.equal(saved.body.calories, preview.body.calories);
        assert.deepEqual(saved.body.profile.goalSetup.input, input);
        assert.deepEqual(saved.body.profile.goalSetup.estimate, preview.body);
        assert.equal(saved.body.profile.goalSetup.version, 1);
        assert.equal(saved.body.profile.goalRate, 0.15);
        assert.equal(saved.body.profile.activity, null);
        assert.deepEqual((await request('/calories/profile', 'GET', undefined, token)).body, saved.body.profile);
        assert.deepEqual((await request('/calories/profile')).body, otherBefore);
        const invalid = await request('/calories/goal', 'POST', { ...input, weight: 50 }, token);
        assert.equal(invalid.status, 400);
        assert.deepEqual((await request('/calories/profile', 'GET', undefined, token)).body, saved.body.profile);
        await request('/calories/calculate', 'POST', profile, token);
        assert.equal((await request('/calories/profile', 'GET', undefined, token)).body.goalSetup, null);
    });
    it('known targets require no fabricated demographics and work with menu generation and immutable historical goals', async () => {
        const registration = await request('/auth/register', 'POST', { email: 'goal-manual@example.test', password: 'Test-pass-123' }, '');
        const token = registration.body.token;
        const input = { mode: 'manual', goal: 'gain', weight: 80, calories: 2237, adultConfirmed: true };
        assert.equal((await request('/calories/goal', 'POST', { ...input, adultConfirmed: false }, token)).status, 400);
        const saved = await request('/calories/goal', 'POST', input, token);
        assert.equal(saved.status, 200);
        for (const key of ['age', 'gender', 'height', 'activity']) assert.equal(saved.body.profile[key], null);
        assert.equal(saved.body.calories, 2237);
        assert.equal(saved.body.profile.goalRate, 0);
        assert.equal((await request('/calories/profile', 'GET', undefined, token)).body.goalSetup.input.mode, 'manual');
        const generated = await request('/menu/generate', 'POST', { daysCount: 1 }, token);
        assert.equal(generated.status, 201, JSON.stringify(generated.body));
        assert.equal(generated.body.targetCalories, 2237);
        await request('/calories/goal', 'POST', { ...input, calories: 2400 }, token);
        assert.equal((await request(`/menu/${generated.body.id}`, 'GET', undefined, token)).body.targetCalories, 2237);
        const log = await request('/calories/weight-log', 'POST', { weight: 81, date: '2026-09-29' }, token);
        assert.equal(log.status, 201);
        assert.equal((await request('/calories/profile', 'GET', undefined, token)).body.calories, 2400);
        assert.equal((await request('/calories/profile', 'GET', undefined, token)).body.weight, 80);
    });

});
