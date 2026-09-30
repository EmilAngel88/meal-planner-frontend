import test from 'node:test';
import assert from 'node:assert/strict';
import { add, normalizeMeals, pickMealItems, targetFromWeight, type Candidate, type GeneratorSettings } from '../services/generator';
import { planDayMeals } from '../services/planner';
import { dayWarning } from '../services/menu-feedback';
import { balanceDayPortions } from '../services/balance';
import { CATALOG_PORTIONS, canAddToRecipe, estimatedMealWeight, isPorridge, mealWeightLimit, portionRows, validMealPortion } from '../services/portions';
import { generateSchema } from '../utils/validation';
import { catalogCandidates, catalogProducts } from './helpers/catalog';

const settings: GeneratorSettings = { minScale: 0.5, maxScale: 1.8, candidateLimit: 18, scoreWeights: { calories: 5, protein: 1.5, fat: 1, carbs: 1 } };
const zero = { calories: 0, protein: 0, fat: 0, carbs: 0 };
const meal = { type: 'breakfast', title: 'Завтрак', percent: 1, maxItems: 2 };
const bowl = catalogCandidates.find(c => c.title === 'Овсянка с бананом и молоком')!;

test('legacy automatic oat caps are ignored when generating a new menu', () => {
    assert.equal('oatsMaxGrams' in generateSchema.parse({ oatsMaxGrams: 65 }), false);
    assert.equal('oatsMaxGrams' in generateSchema.parse({}), false);
});

test('warnings explain the actual direction and size of a missed target', () => {
    const target = { calories: 2800, protein: 119, fat: 61.2, carbs: 443.3 };
    assert.equal(dayWarning(0, { ...target, calories: 2456.9 }, target), 'День 1: калории ниже цели на 343,1 ккал (12,3%).');
    assert.equal(dayWarning(1, { ...target, calories: 3100 }, target), 'День 2: калории выше цели на 300 ккал (10,7%).');
    assert.equal(dayWarning(0, target, target), null);
});

test('porridge volume includes absorbed water without counting the milk twice', () => {
    assert.equal(estimatedMealWeight([{ name: 'Рис сухой', weight: 100 }]), 270);
    assert.equal(estimatedMealWeight([{ name: 'Рис отварной', weight: 270 }]), 270);
    assert.equal(estimatedMealWeight([{ name: 'Овсяные хлопья', weight: 65 }, { name: 'Молоко 2.5%', weight: 150 }, { name: 'Банан', weight: 120 }], true), 380);
    assert.equal(validMealPortion([{ name: 'Рис сухой', weight: 100 }, { name: 'Куриная грудка', weight: 220 }, { name: 'Брокколи', weight: 200 }], 'lunch'), false, '690 g estimated cooked meal is too large despite only 520 g raw weight');
});

test('split rows, mixed nuts, oils and branded ingredients cannot bypass meal limits', () => {
    assert.equal(validMealPortion([{ name: 'Овсяные хлопья', weight: 90 }, { name: 'Овсяные хлопья', weight: 90 }], 'breakfast', true), false);
    assert.equal(validMealPortion([{ name: 'Орехи миндаль', weight: 25 }, { name: 'Грецкий орех', weight: 20 }], 'snack'), false);
    assert.equal(validMealPortion([{ name: 'Оливковое масло', weight: 12 }, { name: 'Масло подсолнечное', weight: 12 }], 'lunch'), false);
    const rows = portionRows([{ title: 'Каша', shopping: [{ productId: 1, name: 'Хлопья · Моя марка', weight: 180 }], composition: [{ id: 1, name: 'Хлопья', portionName: 'Овсяные хлопья' }] }]);
    assert.equal(validMealPortion(rows, 'breakfast', true), false);
});

test('oats can exceed 65 g while a bucket of porridge remains ineligible', () => {
    const target = { calories: 650, protein: 18, fat: 15, carbs: 105 };
    const picked = pickMealItems([bowl], meal, target, new Set(), new Map(), new Map(), settings)!;
    const refined = balanceDayPortions([picked], [meal], target, settings)[0];
    assert.ok(refined.items[0].shopping.find(row => row.name === 'Овсяные хлопья')!.weight > 65);
    assert.ok(estimatedMealWeight(portionRows(refined.items), true) <= 500);
    assert.equal(validMealPortion([{ name: 'Овсяные хлопья', weight: 200 }, { name: 'Молоко 2.5%', weight: 250 }], 'breakfast', true), false);
});

test('casseroles and personal recipes retain egg fractions and ingredient proportions', () => {
    const casserole = catalogCandidates.find(c => c.title === 'Творожная запеканка с яблоком')!;
    for (const recipe of [casserole, { ...casserole, title: 'Личная запеканка', isBase: false }]) {
        const fixed = { ...settings, minScale: 1, maxScale: 1 };
        const picked = pickMealItems([recipe], meal, { calories: 400, protein: 20, fat: 15, carbs: 50 }, new Set(), new Map(), new Map(), fixed)!;
        assert.ok(picked);
        const main = picked.items[0];
        assert.equal(main.shopping.find(row => row.name === 'Яйцо куриное')!.weight, 27.5);
        for (const ingredient of recipe.composition!) assert.ok(Math.abs(main.shopping.find(row => row.productId === ingredient.id)!.weight - ingredient.weight / recipe.servings!) <= 0.051);
        assert.deepEqual(balanceDayPortions([picked], [meal], { calories: 600, protein: 30, fat: 20, carbs: 75 }, settings), [picked]);
    }
});

test('meal compatibility preserves savory dishes and complete recipe options', () => {
    assert.equal(canAddToRecipe(['Яйцо куриное', 'Помидор'], 'Банан', 'breakfast'), false);
    assert.equal(canAddToRecipe(['Сыр 30%', 'Огурец'], 'Орехи миндаль', 'snack'), false);
    assert.equal(canAddToRecipe(['Овсяные хлопья', 'Молоко 2.5%', 'Банан'], 'Орехи миндаль', 'breakfast'), true);
    assert.equal(canAddToRecipe(['Творог 5%', 'Яблоко'], 'Хлеб цельнозерновой', 'breakfast'), false);
});

test('a candidate limit does not let an infeasible first recipe hide a usable one', () => {
    const invalid: Candidate = { ...bowl, id: 999, calories: 400, servings: 1, composition: bowl.composition!.map(i => ({ ...i, weight: 1000 })) };
    const fixed = { ...settings, minScale: 1, maxScale: 1, candidateLimit: 1 };
    const picked = pickMealItems([invalid, bowl], meal, { ...zero, calories: 400 }, new Set(), new Map(), new Map(), fixed);
    assert.equal(picked?.items[0].id, bowl.id);
});

test('a fixed non-grid portion size is honored and high targets get six editable meals', () => {
    const picked = pickMealItems([bowl], meal, { calories: 400, protein: 20, fat: 15, carbs: 50 }, new Set(), new Map(), new Map(), { ...settings, minScale: 0.8, maxScale: 0.8 });
    assert.ok(picked);
    assert.equal(picked.items[0].scale, 0.8 / bowl.servings!);
    assert.equal(normalizeMeals(3200).length, 6);
    assert.equal(normalizeMeals(3200, [meal]).length, 1, 'explicit user meal count wins');
});

for (const [calories, weight] of [[1400, 60], [1800, 70], [2200, 80], [2496, 66], [2759, 80], [2800, 68], [3200, 90]]) {
    test(`six-day catalog regression: ${calories} kcal / ${weight} kg`, () => {
        const target = targetFromWeight(calories, weight);
        // Reproduce the user's saved rhythm, including the large 35% lunch.
        const slots = calories === 2800 ? normalizeMeals(calories, [
            { ...meal, type: 'breakfast', percent: 0.2 }, { ...meal, type: 'snack', percent: 0.1 },
            { ...meal, type: 'lunch', percent: 0.35 }, { ...meal, type: 'snack', percent: 0.1 },
            { ...meal, type: 'dinner', percent: 0.25 },
        ]) : normalizeMeals(calories);
        const usage = new Map<number, number>();
        const productUsage = new Map<number, number>();
        let previousDay = new Set<number>();
        for (let day = 0; day < 6; day++) {
            const picked = planDayMeals(catalogCandidates, slots, target, usage, productUsage, previousDay, settings);
            assert.ok(picked, `day ${day + 1} must be complete`);
            const total = picked.reduce((sum, option) => add(sum, option.total), zero);
            assert.ok(Math.abs(total.calories / calories - 1) < 0.03, `day ${day + 1}: ${total.calories} kcal`);
            for (const nutrient of ['protein', 'fat', 'carbs'] as const) assert.ok(Math.abs(total[nutrient] / target[nutrient] - 1) < 0.2, `${nutrient}, day ${day + 1}`);
            const ids = new Set<number>();
            let nutsInDay = 0;
            for (const [index, option] of picked.entries()) {
                assert.equal(option.items.filter(item => item.sourceType === 'recipe').length, 1);
                assert.ok(option.items.length <= 2);
                const main = option.items[0];
                assert.equal(ids.has(main.id), false);
                ids.add(main.id);
                usage.set(main.id, (usage.get(main.id) || 0) + 1);
                assert.ok(usage.get(main.id)! <= 4);
                const rows = portionRows(option.items);
                nutsInDay += rows.filter(row => CATALOG_PORTIONS[row.name]?.group === 'nuts').reduce((sum, row) => sum + row.weight, 0);
                assert.ok(estimatedMealWeight(rows, isPorridge(main.title)) <= mealWeightLimit(slots[index].type) + 1e-8);
                for (const item of option.items) {
                    for (const nutrient of ['calories', 'protein', 'fat', 'carbs'] as const) {
                        const actual = item.shopping.reduce((sum, row) => sum + catalogProducts.find(p => p.id === row.productId)![nutrient] * row.weight / 100, 0);
                        assert.ok(Math.abs(item[nutrient] - actual) < 1e-7, `${item.title}: ${nutrient} must match shopping`);
                    }
                    if (item.sourceType === 'product') productUsage.set(item.id, (productUsage.get(item.id) || 0) + 1);
                }
            }
            assert.ok(nutsInDay <= 50);
            previousDay = ids;
        }
    });
}
