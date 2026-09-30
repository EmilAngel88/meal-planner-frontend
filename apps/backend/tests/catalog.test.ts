import { test } from 'node:test';
import assert from 'node:assert/strict';
import { per100g, quantityForWeight } from '../services/nutrition';
import { productSnapshot, aggregateShopping } from '../services/shopping';
import { productSchema, recipeSchema } from '../utils/validation';
import { products } from '../prisma/catalog/products';
import { CATALOG_PORTIONS } from '../services/portions';
import { recipes } from '../prisma/catalog/recipes';

test('liquid labels normalize once to grams and snapshots retain branded millilitres', () => {
    const milk = { id: 1, name: 'Молоко', brand: 'Моя марка', unitType: 'ml', unitWeight: null, nutritionBasis: '100ml', density: 1.03, calories: 52, protein: 3, fat: 2.5, carbs: 4.7 };
    assert.ok(Math.abs(per100g(milk).calories * 257.5 / 100 - 130) < 1e-9);
    assert.deepEqual(per100g(per100g(milk)), per100g(milk));
    assert.equal(quantityForWeight(milk, 257.5), 250);
    const snapshot = productSnapshot(milk, 257.5);
    assert.equal(snapshot.name, 'Молоко · Моя марка');
    assert.equal(snapshot.quantity, 250);
    assert.equal(aggregateShopping([[snapshot], [snapshot]])[0].quantity, 500);
});

test('legacy gram nutrition is unchanged and branded products remain separate purchases', () => {
    const p = { id: 1, name: 'Творог', calories: 121, protein: 17.2, fat: 5, carbs: 1.8, unitType: 'gram', unitWeight: null };
    assert.equal(per100g(p).calories, 121);
    assert.equal(aggregateShopping([[productSnapshot({ ...p, brand: 'А' }, 100)], [productSnapshot({ ...p, brand: 'Б' }, 150)]]).length, 2);
});

test('density, metadata and impossible batch sizes are validated', () => {
    const p = { name: 'Мой продукт', calories: 100, protein: 10, fat: 4, carbs: 6 };
    assert.equal(productSchema.safeParse({ ...p, density: 0 }).success, false);
    assert.equal(productSchema.safeParse({ ...p, nutritionBasis: 'portion' }).success, false);
    assert.equal(productSchema.safeParse({ ...p, unitType: 'piece', unitWeight: null }).success, false);
    assert.equal(recipeSchema.safeParse({ title: 'Рецепт', servings: 51 }).success, false);
    assert.equal(recipeSchema.safeParse({ title: 'Рецепт', instructions: [''] }).success, false);
    assert.equal(recipeSchema.safeParse({ title: 'Рецепт', cookedWeight: 0 }).success, false);
});

test('catalogue is traceable, recipes use explicit ingredients and batch instructions', () => {
    const map = new Map(products.map(p => [p.name, p]));
    assert.equal(map.size, products.length);
    assert.ok(products.filter(p => !p.isArchived).length >= 70);
    assert.ok(products.filter(p => p.sourceUrl.startsWith('https://fdc.nal.usda.gov/')).length >= 50);
    for (const p of products) {
        assert.equal(productSchema.safeParse(p).success, true, p.name);
        assert.ok(Object.hasOwn(CATALOG_PORTIONS, p.name), `${p.name} needs an explicit portion rule`);
    }
    for (const r of recipes) {
        assert.ok(r.instructions.length >= 2, r.title);
        assert.ok(r.servings >= 2, r.title);
        assert.equal(new Set(r.ingredients.map(i => i.name)).size, r.ingredients.length, r.title);
        for (const i of r.ingredients) { assert.ok(map.has(i.name), i.name); assert.equal(map.get(i.name)!.isArchived, false); assert.ok(i.weight > 0); }
        if (r.ingredients.some(i => i.name === 'Рис сухой')) { assert.equal(r.storageDays, 1); assert.match(r.storageInstructions, /24 часов/); }
        if (r.cookingMode === 'batch') assert.ok(r.batchNotes && r.storageInstructions);
    }
    assert.ok(!recipes.some(r => r.ingredients.some(i => /отварн/.test(i.name))), 'Preparation recipes start with dry/raw foods');
});
