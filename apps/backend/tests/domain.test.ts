import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCalories } from '../services/calories';
import { aggregateShopping, productSnapshot } from '../services/shopping';
import { pickMealItems, normalizeMeals, targetFromCalories, targetFromWeight, pickDayMeals, type Candidate } from '../services/generator';
import { generateSchema, profileSchema, productSchema, registerSchema, dateSchema } from '../utils/validation';
import { balanceDayPortions, nutrientFitScore } from '../services/balance';
import { add, scaleMacro } from '../services/generator';

const profile = { gender: 'male' as const, weight: 80, height: 180, age: 30, activity: 'low' as const, goal: 'maintain' as const };
test('calorie calculation preserves the established formula and goals', () => {
    assert.equal(calculateCalories(profile), 2136);
    assert.equal(calculateCalories({ ...profile, goal: 'loss' }), 1709);
    assert.equal(calculateCalories({ ...profile, gender: 'female', goal: 'gain' }), 2228);
});
test('profile rejects incomplete, negative and nonnumeric values', () => {
    for (const input of [{}, { ...profile, weight: -1 }, { ...profile, age: 0 }, { ...profile, height: '180' }, { ...profile, activity: '__proto__' }]) assert.equal(profileSchema.safeParse(input).success, false);
});
test('registration normalizes email and checks bcrypt byte limit', () => {
    assert.equal(registerSchema.parse({ email: ' A@Example.com ', password: 'password8' }).email, 'a@example.com');
    for (const password of ['short', 'я'.repeat(37)]) assert.equal(registerSchema.safeParse({ email: 'a@b.test', password }).success, false);
});
test('strict dates reject overflow, impossible and malformed dates', () => {
    assert.equal(dateSchema.safeParse('2024-02-29').success, true);
    for (const date of ['2026-02-29', '2026-02-31', '2026-13-01', 'invalid']) assert.equal(dateSchema.safeParse(date).success, false);
});
test('generation bounds combinatorial work and rejects invalid ratios', () => {
    for (const input of [{ daysCount: 1.5 }, { daysCount: 999 }, { minScale: 2, maxScale: 1 }, { candidateLimit: 1000 }, { macroRatios: { protein: 0.9, fat: 0.9, carbs: 0.9 } }, { meals: [{ type: 'lunch', title: 'Обед', percent: -1, maxItems: 1 }] }]) assert.equal(generateSchema.safeParse(input).success, false);
    assert.equal(generateSchema.parse({}).daysCount, 6);
});
test('piece products require a positive unit weight', () => {
    const product = { name: 'Яйцо', calories: 150, protein: 12, fat: 10, carbs: 1, unitType: 'piece' };
    assert.equal(productSchema.safeParse(product).success, false);
    assert.equal(productSchema.safeParse({ ...product, unitWeight: 55 }).success, true);
    assert.equal(productSchema.safeParse({ ...product, unitWeight: 55, calories: -1 }).success, false);
});
test('meal normalization and macro targets preserve energy', () => {
    const meals = normalizeMeals(2400);
    assert.equal(meals.filter(meal => meal.type === 'snack').length, 2);
    assert.ok(Math.abs(meals.reduce((sum, meal) => sum + meal.percent, 0) - 1) < 1e-10);
    const target = targetFromCalories(2000);
    assert.ok(Math.abs(target.protein * 4 + target.fat * 9 + target.carbs * 4 - 2000) < 1);
});
const candidate: Candidate = { id: 1, title: 'Рецепт', sourceType: 'recipe', mealTypes: ['lunch'], weight: 200, calories: 200, protein: 20, fat: 8, carbs: 12, maxPerWeek: 2, shopping: [] };
const settings = { minScale: 0.5, maxScale: 1.8, candidateLimit: 18, scoreWeights: { calories: 2, protein: 4, fat: 1, carbs: 1 } };
const meal = { type: 'lunch', title: 'Обед', percent: 1, maxItems: 2 };
test('generator respects meal tags, daily duplication and weekly limits', () => {
    assert.equal(pickMealItems([candidate], { ...meal, type: 'breakfast' }, candidate, new Set(), new Map(), new Map(), settings), null);
    assert.equal(pickMealItems([candidate], meal, candidate, new Set([1]), new Map(), new Map(), settings), null);
    assert.equal(pickMealItems([candidate], meal, candidate, new Set(), new Map([[1, 2]]), new Map(), settings), null);
    assert.equal(pickMealItems([candidate], { ...meal, type: 'any' }, candidate, new Set(), new Map(), new Map(), settings)?.items.length, 1);
});
test('candidate pruning prioritizes a suitable portion energy target', () => {
    const poor = { ...candidate, id: 2, calories: 1000, protein: 100 };
    assert.equal(pickMealItems([poor, candidate], meal, candidate, new Set(), new Map(), new Map(), { ...settings, candidateLimit: 1 })?.items[0].id, 1);
});
test('generator keeps scale and stored nutrition consistent', () => {
    const picked = pickMealItems([candidate], meal, { calories: 245, protein: 24.5, fat: 9.8, carbs: 14.7 }, new Set(), new Map(), new Map(), settings)!;
    assert.equal(picked.items[0].scale, 1.25);
    assert.ok(Math.abs(picked.items[0].weight - 250) < 1e-9);
    assert.ok(Math.abs(picked.total.calories - 250) < 1e-9);
});
test('shopping aggregates before rounding pieces and keeps source snapshots immutable', () => {
    const snapshot = productSnapshot({ id: 1, name: 'Яйцо', unitType: 'piece', unitWeight: 55 }, 66);
    const original = structuredClone(snapshot);
    const rows = aggregateShopping([[snapshot], [snapshot]]);
    assert.equal(rows[0].quantity, 3);
    assert.equal(rows[0].weight, 132);
    assert.deepEqual(snapshot, original);
});
test('shopping distinguishes products with equal names and ml units', () => {
    const rows = aggregateShopping([[{ productId: 1, name: 'Молоко', unitType: 'ml', weight: 150, quantity: 150 }, { productId: 2, name: 'Молоко', unitType: 'gram', weight: 100, quantity: 100 }]]);
    assert.equal(rows.length, 2);
});

test('3 × 15 macro targets depend on body weight, with carbohydrates from the remainder', () => {
    assert.deepEqual(targetFromWeight(2400, 80), { calories: 2400, protein: 140, fat: 72, carbs: 298 });
    assert.deepEqual(targetFromWeight(2400, 80, 2, 1), { calories: 2400, protein: 160, fat: 80, carbs: 260 });
    assert.throws(() => targetFromWeight(800, 100), /превышают/);
});
const curd = { id: 11, name: 'Творог 5%', weight: 200, calories: 121, protein: 17.2, fat: 5, carbs: 1.8, unitType: 'gram', unitWeight: null };
const apple = { id: 12, name: 'Яблоко', weight: 150, calories: 47, protein: 0.4, fat: 0.4, carbs: 9.8, unitType: 'piece', unitWeight: 150 };
const breakfast: Candidate = { ...candidate, title: 'Творог с яблоком', calories: 312.5, protein: 35, fat: 10.6, carbs: 18.3, weight: 350, mealTypes: ['breakfast', 'snack'], composition: [curd, apple] };
const bread: Candidate = { ...candidate, id: 99, sourceType: 'product', title: 'Хлеб цельнозерновой', weight: 100, mealTypes: ['any'], calories: 247, composition: [{ ...curd, name: 'Хлеб цельнозерновой', weight: 100, calories: 247 }] };
test('regression: cottage cheese with fruit cannot gain a large bread side or oversized curd', () => {
    const picked = pickMealItems([breakfast, bread], { ...meal, type: 'breakfast', maxItems: 4 }, targetFromCalories(800), new Set(), new Map(), new Map(), { ...settings, maxScale: 3 })!;
    assert.equal(picked.items.length, 1);
    assert.ok(picked.items[0].shopping.find(i => i.name === curd.name)!.weight <= 250);
    assert.ok(picked.total.calories < 800, 'portion bounds win over exact calorie matching');
});
test('a meal contains one complete recipe and never arbitrary raw products or two entrees', () => {
    assert.equal(pickMealItems([bread], meal, candidate, new Set(), new Map(), new Map(), settings), null);
    const picked = pickMealItems([candidate, { ...candidate, id: 2 }], meal, { ...candidate, calories: 600 }, new Set(), new Map(), new Map(), settings)!;
    assert.equal(picked.items.filter(i => i.sourceType === 'recipe').length, 1);
});
test('batch recipe yield produces one portion; shopping and macros use the same rounded ingredients', () => {
    const batch = { ...breakfast, servings: 4, weight: 1400, composition: [curd, apple].map(i => ({ ...i, weight: i.weight * 4 })) };
    const picked = pickMealItems([batch], { ...meal, type: 'breakfast' }, breakfast, new Set(), new Map(), new Map(), { ...settings, minScale: 1, maxScale: 1 })!;
    assert.equal(picked.items[0].scale, 0.25);
    assert.equal(picked.items[0].weight, 350);
    assert.equal(picked.items[0].shopping[0].weight, 200);
    assert.equal(picked.items[0].shopping[1].quantity, 1);
    assert.equal(picked.total.calories, 312.5);
});
test('daily planning balances nutrients across meals rather than imposing the same ratio on each', () => {
    const carbohydrateMeal = { ...candidate, id: 2, mealTypes: ['breakfast'], calories: 400, protein: 5, fat: 5, carbs: 84, weight: 200 };
    const proteinMeal = { ...candidate, id: 3, mealTypes: ['dinner'], calories: 400, protein: 65, fat: 15, carbs: 1, weight: 200 };
    const picked = pickDayMeals([carbohydrateMeal, proteinMeal], [{ ...meal, type: 'breakfast', percent: 0.5 }, { ...meal, type: 'dinner', percent: 0.5 }], { calories: 800, protein: 70, fat: 20, carbs: 85 }, new Map(), new Map(), new Set(), { ...settings, minScale: 1, maxScale: 1 })!;
    assert.equal(picked.length, 2);
    assert.equal(picked.reduce((sum, p) => sum + p.total.protein, 0), 70);
});

test('source calculator activity levels and selected deficit are reproduced', () => {
    assert.equal(calculateCalories({ ...profile, activity: 'training4', goal: 'loss', goalRate: 0.15 }), 2145);
    assert.equal(calculateCalories({ ...profile, activity: 'daily', goal: 'gain', goalRate: 0.2 }), 3498);
    assert.equal(profileSchema.safeParse({ ...profile, goalRate: 0.9 }).success, false);
});

test('video transcript example: 66 kg, 170 cm, age 30, three workouts and 15% gain', () => {
    const example = { ...profile, weight: 66, height: 170, activity: 'light' as const, goalRate: 0.15 };
    assert.equal(calculateCalories(example), 2170);
    assert.equal(calculateCalories({ ...example, goal: 'gain' }), 2496);
    assert.deepEqual(targetFromWeight(2496, 66), { calories: 2496, protein: 115.5, fat: 59.4, carbs: 374.9 });
});

test('ingredient balancing trades excess fat/protein for rice while preserving the dish and snapshots', () => {
    const composition = [
        { ...curd, name: 'Куриная грудка', weight: 160, calories: 113, protein: 23.6, fat: 1.9, carbs: 0.4 },
        { ...curd, id: 12, name: 'Рис отварной', weight: 180, calories: 116, protein: 2.2, fat: 0.5, carbs: 24.9 },
        { ...curd, id: 13, name: 'Оливковое масло', weight: 12, calories: 884, protein: 0, fat: 100, carbs: 0 },
        { ...curd, id: 14, name: 'Овощной салат', weight: 150, calories: 28, protein: 1.2, fat: 0.2, carbs: 5.1 },
    ];
    const nutrition = composition.reduce((sum, i) => add(sum, scaleMacro(i, i.weight / 100)), { calories: 0, protein: 0, fat: 0, carbs: 0 });
    const base: Candidate = { ...candidate, ...nutrition, title: 'Курица с рисом и салатом', isBase: true, composition };
    const picked = pickMealItems([base], meal, nutrition, new Set(), new Map(), new Map(), { ...settings, minScale: 1, maxScale: 1 })!;
    const original = structuredClone(picked);
    const target = { calories: 518.2, protein: 31.5, fat: 8.6, carbs: 76.5 };
    const balanced = balanceDayPortions([picked], [meal], target, settings)[0];
    assert.ok(nutrientFitScore(balanced.total, target, settings.scoreWeights) < nutrientFitScore(picked.total, target, settings.scoreWeights) / 4);
    assert.ok(balanced.total.fat < picked.total.fat);
    assert.ok(balanced.total.carbs > picked.total.carbs);
    assert.equal(balanced.items[0].id, base.id);
    assert.equal(balanced.items[0].shopping.find(i => i.name === 'Овощной салат')!.weight, 150);
    assert.deepEqual(picked, original, 'refinement must not mutate its input');
    const actual = balanced.items[0].shopping.reduce((sum, i) => add(sum, scaleMacro(composition.find(c => c.id === i.productId)!, i.weight / 100)), { calories: 0, protein: 0, fat: 0, carbs: 0 });
    assert.deepEqual(balanced.total, actual);
    const personal = structuredClone(picked); personal.items[0].isBase = false;
    assert.deepEqual(balanceDayPortions([personal], [meal], target, settings), [personal]);
    const unknown = structuredClone(picked); unknown.items[0].title = 'Пирог с рисом';
    assert.deepEqual(balanceDayPortions([unknown], [meal], target, settings), [unknown]);
    assert.deepEqual(balanceDayPortions([picked], [meal], target, { ...settings, minScale: 1, maxScale: 1 }), [picked]);
});
