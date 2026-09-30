import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ingredientAmount, nutritionForWeight, recipeNutrition, quantityForWeight, weightForQuantity, productLabel } from '../utils/food.ts'
const milk = { id: 1, name: 'Молоко', brand: 'Своя марка', calories: 52, protein: 3, fat: 2.5, carbs: 4.7, unitType: 'ml', nutritionBasis: '100ml', density: 1.03 }
const oats = { id: 2, name: 'Хлопья', calories: 370, protein: 12, fat: 6, carbs: 60, unitType: 'gram' }

test('liquids display millilitres and use the same label basis for nutrition', () => {
  assert.equal(weightForQuantity(milk, 250), 257.5)
  assert.equal(quantityForWeight(milk, 257.5), 250)
  assert.equal(ingredientAmount({ productId: 1, product: milk, weight: 257.5 }, 4), '1 000 мл')
  assert.ok(Math.abs(nutritionForWeight(milk, 257.5).calories - 130) < 1e-9)
  assert.equal(productLabel(milk), 'Молоко · Своя марка')
})
test('batch scaling preserves per-serving nutrition, changing yield divides it', () => {
  const one = [{ productId: 1, product: milk, weight: 257.5 }, { productId: 2, product: oats, weight: 60 }]
  const four = one.map(i => ({ ...i, weight: i.weight * 4 }))
  assert.deepEqual(recipeNutrition(one, 1), recipeNutrition(four, 4))
  assert.equal(recipeNutrition(four, 8).calories, recipeNutrition(one, 1).calories / 2)
  assert.equal(one[0].weight, 257.5)
})
test('piece sizes are edible grams and gram-labelled liquids keep their own nutrition basis', () => {
  const egg = { ...oats, unitType: 'piece', unitWeight: 55 }
  assert.equal(weightForQuantity(egg, 2), 110)
  assert.equal(quantityForWeight(egg, 165), 3)
  assert.equal(ingredientAmount({ productId: 2, product: egg, weight: 110 }), '2 шт.')
  assert.equal(nutritionForWeight({ ...milk, nutritionBasis: '100g' }, 100).calories, 52)
})
