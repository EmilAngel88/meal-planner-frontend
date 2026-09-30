import test from 'node:test'
import assert from 'node:assert/strict'
import { dateAt, normalizeOptions, periodDays, planProvisions, type CookingInfo } from '../utils/provisions.ts'
import { calculatePurchase, defaultPurchase, purchaseKey, type IngredientRow } from '../utils/purchases.ts'
import { purchaseDefaults } from '../utils/purchase-defaults.ts'

const grain: IngredientRow = { productId: 1, name: 'Булгур сухой', weight: 180, quantity: 180, unitType: 'gram' }
const milk: IngredientRow = { productId: 2, name: 'Молоко 2.5%', weight: 975, quantity: 946.6, unitType: 'ml' }
const beef: IngredientRow = { productId: 3, name: 'Говядина постная', weight: 70, quantity: 70, unitType: 'gram' }
const onion: IngredientRow = { productId: 4, name: 'Лук репчатый', weight: 295, quantity: 295, unitType: 'gram' }
const item = (day: number, rows: IngredientRow[] = [grain], id = day + 1) => ({ id, dayIndex: day, mealIndex: 0, mealTitle: 'Обед', title: 'Булгур с мясом', recipeId: 1, sourceType: 'recipe', shoppingSnapshot: rows })
const info: CookingInfo = { id: 1, cookingMode: 'batch', storageDays: 2, freezerFriendly: true, batchNotes: '', storageInstructions: '' }
const week = { ...normalizeOptions({}, '2026-09-29'), horizon: 'week' as const, batch: false }

test('the reported quantities become useful purchases without changing food amounts', () => {
  for (const [row, buy] of [[grain, 500], [milk, 1000], [beef, 500], [onion, 300]] as const) {
    const original = structuredClone(row)
    const calculated = calculatePurchase(row)
    assert.equal(calculated.buy, buy)
    assert.deepEqual(row, original)
    if (calculated.packs !== null) assert.ok(Number.isInteger(calculated.packs))
  }
  assert.equal(purchaseDefaults('Картофель сырой', 'gram').aisle, 'Овощи и зелень')
})
test('four weeks repeat six meals and leave four explicitly uncovered days', () => {
  const plan = { daysCount: 6, items: Array.from({ length: 6 }, (_, day) => item(day)) }
  const before = structuredClone(plan)
  const result = planProvisions(plan, {}, { ...week, horizon: 'fourWeeks' })
  assert.equal(result.occurrences.length, 24)
  assert.deepEqual(result.freeDays, [6, 13, 20, 27])
  assert.equal(result.purchases[0].needed, 24 * 180)
  assert.equal(result.purchases[0].packs, 9)
  assert.equal(result.trips.length, 1)
  assert.deepEqual(plan, before)
})
test('a chosen free-day repeat is included exactly once per week', () => {
  const plan = { daysCount: 6, items: Array.from({ length: 6 }, (_, day) => item(day)) }
  const result = planProvisions(plan, {}, { ...week, horizon: 'fourWeeks', freeDay: 2 })
  assert.equal(result.freeDays.length, 0)
  assert.equal(result.occurrences.length, 28)
  assert.equal(result.occurrences.filter(o => o.item.id === 3).length, 8)
})
test('calendar months clamp to the next month and partial weeks include only actual days', () => {
  assert.equal(periodDays({ ...week, horizon: 'month', start: '2026-01-31' }), 28)
  assert.equal(periodDays({ ...week, horizon: 'month', start: '2028-01-31' }), 29)
  assert.equal(periodDays({ ...week, horizon: 'month', start: '2026-09-29' }), 30)
  assert.equal(dateAt('2026-10-24', 2), '2026-10-26')
  const result = planProvisions({ daysCount: 6, items: Array.from({ length: 6 }, (_, day) => item(day)) }, {}, { ...week, horizon: 'month' })
  assert.equal(result.occurrences.length, 26)
  assert.equal(result.occurrences.at(-1)?.date, '2026-10-28')
  assert.equal(normalizeOptions({ start: '2026-02-30', horizon: 'bad', freeDay: 40 }, week.start).start, week.start)
})
test('the beef detail identifies its single meal; monthly purchasing sums before rounding packs', () => {
  const result = planProvisions({ daysCount: 6, items: [item(3, [beef])] }, {}, { ...week, horizon: 'fourWeeks' })
  const row = result.purchases[0]
  assert.equal(row.needed, 280)
  assert.equal(row.buy, 500)
  assert.equal(result.uses[row.key].length, 4)
  assert.equal(result.uses[row.key][0].day, 3)
  assert.ok(result.incomplete) // the other days were absent, not silently treated as full meals
})
test('pantry is consumed once for the entire period, never once per repeated week', () => {
  const settings = { [purchaseKey(grain)]: { ...defaultPurchase(grain), pantry: 500, packPrice: 100 } }
  const result = planProvisions({ daysCount: 6, items: [item(0)] }, {}, { ...week, horizon: 'fourWeeks' }, settings)
  assert.equal(result.purchases[0].needed, 720)
  assert.equal(result.purchases[0].buy, 500)
  assert.equal(result.purchases[0].surplus, 280)
  assert.equal(result.purchases[0].cost, 100)
})
test('perishable surplus is not silently carried across weeks; prices include every actual pack', () => {
  const smallMilk = { ...milk, weight: 200, quantity: 200 }
  const settings = { [purchaseKey(milk)]: { ...defaultPurchase(milk), packPrice: 90 } }
  const result = planProvisions({ daysCount: 6, items: [item(0, [smallMilk])] }, {}, { ...week, horizon: 'fourWeeks' }, settings)
  assert.equal(result.trips.length, 4)
  assert.equal(result.purchases[0].needed, 800)
  assert.equal(result.purchases[0].buy, 4000)
  assert.equal(result.purchases[0].cost, 360)
  assert.equal(result.trips[1].rows[0].reviewStock, 800)
})
test('stock that expires before cooking cannot cover a later demand in the same shopping window', () => {
  const result = planProvisions({ daysCount: 6, items: [item(1, [milk])] }, {}, week, {
    [purchaseKey(milk)]: { ...defaultPurchase(milk), pantry: 1000 },
  })
  assert.equal(result.purchases[0].buy, 0) // still within the conservative two-day window
  const later = planProvisions({ daysCount: 6, items: [item(3, [milk])] }, {}, week, {
    [purchaseKey(milk)]: { ...defaultPurchase(milk), pantry: 1000 },
  })
  assert.equal(later.purchases[0].buy, 1000)
})
test('without a freezer raw meat is purchased on the cooking date, not a month ahead', () => {
  const result = planProvisions({ daysCount: 6, items: [item(5, [beef])] }, {}, { ...week, freezer: false })
  assert.equal(result.trips[0].day, 5)
  assert.equal(result.purchases[0].buy, 500)
})
test('batch preparation moves shopping before cooking and identifies frozen future portions', () => {
  const plan = { daysCount: 6, items: [item(0, [beef]), item(2, [beef])] }
  const result = planProvisions(plan, { 1: info }, { ...week, batch: true })
  assert.equal(result.cookingTasks.length, 1)
  assert.equal(result.cookingTasks[0].portions.length, 2)
  assert.equal(result.cookingTasks[0].ingredients[0].weight, 140)
  assert.equal(result.cookingTasks[0].frozen[0].day, 2)
  assert.equal(result.trips[0].day, 0)
  const noFreezer = planProvisions(plan, { 1: info }, { ...week, batch: true, freezer: false })
  assert.deepEqual(noFreezer.cookingTasks.map(t => t.day), [0, 2])
  assert.equal(noFreezer.cookingTasks.flatMap(t => t.frozen).length, 0)
})
test('rice and recipes without storage instructions cannot be batched into unsafe fridge periods', () => {
  const plan = { daysCount: 6, items: [0, 1, 2].map(day => ({ ...item(day), title: 'Рис с овощами' })) }
  const result = planProvisions(plan, { 1: info }, { ...week, batch: true, freezer: false })
  assert.deepEqual(result.cookingTasks.map(t => t.day), [0, 1, 2])
  assert.equal(planProvisions(plan, {}, { ...week, batch: true }).cookingTasks.length, 3)
})
test('different ingredient ratios remain separate batches, while proportional portions combine', () => {
  const plan = { daysCount: 6, items: [item(0, [grain, beef]), item(1, [{ ...grain, weight: 360, quantity: 360 }, { ...beef, weight: 140, quantity: 140 }]), item(2, [grain, { ...beef, weight: 90, quantity: 90 }])] }
  const result = planProvisions(plan, { 1: info }, { ...week, batch: true })
  assert.equal(result.cookingTasks.length, 2)
  assert.equal(result.cookingTasks[0].portions.length, 2)
  assert.equal(result.cookingTasks.reduce((sum, t) => sum + t.ingredients.find(r => r.productId === 3)!.weight, 0), 300)
})
test('piece quantities accumulate before package rounding and source names stay distinct', () => {
  const eggs = { productId: 5, name: 'Яйцо куриное', weight: 82.5, quantity: 1.5, unitType: 'piece' }
  const result = planProvisions({ daysCount: 6, items: [item(0, [eggs]), item(1, [eggs, { ...eggs, productId: 6, name: 'Яйцо куриное · Марка' }])] }, {}, week)
  assert.equal(result.purchases.length, 2)
  assert.equal(result.purchases.find(p => p.source.productId === 5)!.needed, 3)
  assert.equal(result.purchases.find(p => p.source.productId === 5)!.packs, 1)
})
test('checks are tied to dates and purchases, and loose pricing charges the rounded buy amount', () => {
  const plan = { daysCount: 6, items: [item(0, [onion])] }
  const a = planProvisions(plan, {}, week)
  const b = planProvisions(plan, {}, { ...week, start: '2026-10-01' })
  assert.notEqual(a.trips[0].rows[0].checkKey, b.trips[0].rows[0].checkKey)
  assert.equal(calculatePurchase(onion, { ...defaultPurchase(onion), packPrice: 100 }).cost, 30)
})

test('sealed dairy is bought on the main trip but opened surplus expires between cooking days', () => {
  const smallMilk = { ...milk, quantity: 200, weight: 206 }
  const result = planProvisions({ daysCount: 6, items: [item(0, [smallMilk]), item(2, [smallMilk])] }, {}, week)
  assert.equal(result.trips.length, 1)
  assert.equal(result.trips[0].day, 0)
  assert.equal(result.purchases[0].packs, 2)
  assert.equal(result.purchases[0].needed, 400)
  assert.equal(result.trips[0].rows[0].reviewStock, 800)
})
test('cans can be purchased together, but leftovers from an open can cannot cover next week', () => {
  const tuna = { ...beef, name: 'Тунец консервированный в воде', weight: 100, quantity: 100 }
  const result = planProvisions({ daysCount: 6, items: [item(0, [tuna])] }, {}, { ...week, horizon: 'fourWeeks' })
  assert.equal(result.trips.length, 1)
  assert.equal(result.purchases[0].needed, 400)
  assert.equal(result.purchases[0].packs, 4)
  assert.equal(purchaseDefaults('Сок апельсиновый', 'ml').byWeight, false)
  assert.equal(calculatePurchase({ ...milk, name: 'Сок апельсиновый' }).buy, 1000)
})
