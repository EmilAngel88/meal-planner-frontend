import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeProductUrl, productSearchLinks, calculatePurchase, defaultPurchase, normalizePurchase, purchaseSummary, purchaseCsv, purchaseText, purchaseKey, type IngredientRow } from '../utils/purchases.ts'
const curd: IngredientRow = { productId: 1, name: 'Творог 5%', weight: 600, quantity: 600, unitType: 'gram' }
const rice: IngredientRow = { productId: 2, name: 'Рис отварной', weight: 900, quantity: 900, unitType: 'gram' }
const eggs: IngredientRow = { productId: 3, name: 'Яйцо куриное', weight: 660, quantity: 12, unitType: 'piece' }
const milk: IngredientRow = { productId: 4, name: 'Молоко', weight: 1200, quantity: 1200, unitType: 'ml' }

test('cooked weight is converted before pantry and package calculations, without changing the snapshot', () => {
  const before = structuredClone(rice)
  const result = calculatePurchase(rice, { ...defaultPurchase(rice), pantry: 100, packSize: 500, packPrice: 90 })
  assert.equal(result.settings.name, 'Рис сухой')
  assert.equal(result.needed, 300)
  assert.equal(result.missing, 200)
  assert.equal(result.packs, 1)
  assert.equal(result.surplus, 300)
  assert.equal(result.cost, 90)
  assert.deepEqual(rice, before)
  assert.equal(calculatePurchase(rice, { ...defaultPurchase(rice), yield: 2 }).needed, 450)
})

test('packages are rounded after subtracting pantry, and an exact multiple does not gain an extra pack', () => {
  assert.equal(calculatePurchase(curd, { packSize: 200 }).packs, 3)
  const result = calculatePurchase(curd, { pantry: 250, packSize: 200, packPrice: 100 })
  assert.equal(result.packs, 2)
  assert.equal(result.buy, 400)
  assert.equal(result.surplus, 50)
  assert.equal(result.cost, 200)
  const decimal = { ...curd, weight: 0.3, quantity: 0.3 }
  assert.equal(calculatePurchase(decimal, { packSize: 0.1 }).packs, 3)
})

test('pantry can fully cover a purchase without requiring a price or a negative quantity', () => {
  const result = calculatePurchase(curd, { pantry: 1000, packSize: 200 })
  assert.equal(result.buy, 0)
  assert.equal(result.packs, 0)
  assert.equal(result.cost, 0)
  assert.equal(result.surplus, 0)
  assert.deepEqual(purchaseSummary([result]), { total: 0, unknown: 0, toBuy: 0, covered: 1 })
})

test('pieces and millilitres keep their own units and reject a cooking factor', () => {
  const result = calculatePurchase(eggs, { pantry: 3, packSize: 10, packPrice: 110, yield: 3 })
  assert.equal(result.needed, 12)
  assert.equal(result.packs, 1)
  assert.equal(result.surplus, 1)
  const liquid = calculatePurchase(milk, { pantry: 200, packSize: 1000, packPrice: 95, yield: 2 })
  assert.equal(liquid.unit, 'мл')
  assert.equal(liquid.buy, 1000)
  assert.equal(liquid.cost, 95)
})

test('loose products use the exact missing weight at a price per kilogram', () => {
  const result = calculatePurchase(curd, { pantry: 150, packSize: 1000, packPrice: 400, byWeight: true })
  assert.equal(result.buy, 450)
  assert.equal(result.packs, null)
  assert.equal(result.surplus, 0)
  assert.equal(result.cost, 180)
  assert.equal(calculatePurchase(eggs, { byWeight: true, packSize: 10 }).packs, 2)
})

test('unknown cost remains unknown rather than zero; an explicitly free package is supported', () => {
  const unknown = calculatePurchase(curd, { packSize: 200 })
  const priced = calculatePurchase(milk, { packSize: 1000, packPrice: 99.95 })
  assert.equal(unknown.cost, null)
  assert.deepEqual(purchaseSummary([unknown, priced]), { total: 199.9, unknown: 1, toBuy: 2, covered: 0 })
  assert.equal(calculatePurchase(curd, { packSize: 200, packPrice: 0 }).cost, 0)
})

test('invalid persisted settings are sanitized; unknown ingredient compositions are not guessed', () => {
  assert.deepEqual(normalizePurchase(curd, { pantry: -1, yield: 0, packSize: Infinity, packPrice: NaN, name: ' ', note: [], byWeight: 'yes' }), defaultPurchase(curd))
  assert.deepEqual(normalizePurchase(curd, []), defaultPurchase(curd))
  assert.equal(normalizePurchase(eggs, { packSize: 1.5 }).packSize, 10)
  const custom = { ...curd, name: 'Авторский салат' }
  assert.equal(calculatePurchase(custom).needed, 600)
  assert.equal(calculatePurchase(custom).settings.name, custom.name)
  assert.notEqual(purchaseKey(curd), purchaseKey({ ...curd, productId: 8 }))
})

test('text exports include conversions, purchase state and missing prices', () => {
  const row = calculatePurchase(rice, { packSize: 500 })
  const text = purchaseText([row], 'Меню №1', [row.key])
  assert.match(text, /Куплено: Рис сухой — 500 г/)
  assert.match(text, /останется 200 г/)
  assert.match(text, /выход ×3/)
  assert.match(text, /1 поз. без цены/)
})

test('CSV quotes separators, newlines and quotes, and neutralizes spreadsheet formulas', () => {
  const row = calculatePurchase(curd, { name: '=HYPERLINK("url")', note: 'два; слова\nстрока' })
  const csv = purchaseCsv([row])
  assert.ok(csv.startsWith('\uFEFF'))
  assert.ok(csv.includes('"\'=HYPERLINK(""url"")"'))
  assert.ok(csv.includes('"два; слова\nстрока"'))
})


test('saved product links reject active content and embedded credentials, including restored data', () => {
  for (const input of ['javascript:alert(1)', 'data:text/html,test', '//example.com/product', 'https://user:password@example.com/product', 'not a link']) {
    assert.equal(normalizeProductUrl(input), '')
    assert.equal(calculatePurchase(curd, { productUrl: input }).settings.productUrl, '')
  }
  const url = 'https://www.ozon.ru/product/example-123/?from=search&value=5%25'
  const row = calculatePurchase(curd, { productUrl: url })
  assert.equal(row.settings.productUrl, url)
  assert.ok(purchaseText([row], 'Меню').includes(url))
  assert.ok(purchaseCsv([row]).includes(url))
  assert.equal(normalizePurchase(curd, { pantry: 5 }).productUrl, '')
})

test('shop search keeps special characters in one query and uses the purchase name', () => {
  const name = 'Творог 5% & йогурт #1 + молоко'
  for (const link of productSearchLinks(name)) {
    const url = new URL(link.url)
    assert.equal(url.searchParams.get('text'), name)
    assert.equal([...url.searchParams.keys()].length, 1)
    assert.equal(url.hash, '')
    assert.equal(url.protocol, 'https:')
  }
  assert.equal(new URL(productSearchLinks(calculatePurchase(rice).settings.name)[0].url).searchParams.get('text'), 'Рис сухой')
})
