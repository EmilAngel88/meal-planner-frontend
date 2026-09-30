import { purchaseDefaults, type Supply } from './purchase-defaults.ts'
export type IngredientRow = { productId: number; name: string; weight: number; quantity: number; unitType: string }
export type PurchaseSettings = {
  name: string
  yield: number
  pantry: number
  packSize: number | null
  packPrice: number | null
  byWeight: boolean
  note: string
  productUrl: string
  supply: Supply
}
export type PurchaseRow = ReturnType<typeof calculatePurchase>

// Starting estimates, not cooking constants: users can change the yield for their method.
const cooked: Record<string, { name: string; yield: number }> = {
  'Рис отварной': { name: 'Рис сухой', yield: 3 },
  'Гречка отварная': { name: 'Гречка сухая', yield: 2.5 },
  'Макароны отварные': { name: 'Макароны сухие', yield: 2.5 },
  'Картофель отварной': { name: 'Картофель сырой', yield: 0.85 },
}
export const purchaseKey = (row: IngredientRow) => `${row.productId}:${row.name}:${row.unitType}`
export const purchaseUnit = (row: IngredientRow) => row.unitType === 'piece' ? 'шт.' : row.unitType === 'ml' ? 'мл' : 'г'
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const ceil = (value: number, step = 1) => Math.max(0, Math.ceil(value / step - 1e-8) * step)
const validNumber = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max

export function normalizeProductUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) return ''
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''
  } catch { return '' }
}

export function productSearchLinks(name: string) {
  const query = encodeURIComponent(name.trim())
  return [
    { name: 'Ozon', url: `https://www.ozon.ru/search/?text=${query}` },
    { name: 'Яндекс Маркет', url: `https://market.yandex.ru/search?text=${query}` },
  ]
}

export function defaultPurchase(row: IngredientRow): PurchaseSettings {
  const conversion = row.unitType === 'gram' ? cooked[row.name] : undefined
  const defaults = purchaseDefaults(conversion?.name || row.name, row.unitType)
  return { name: conversion?.name || row.name, yield: conversion?.yield || 1, pantry: 0, packSize: defaults.packSize, packPrice: null, byWeight: defaults.byWeight, note: '', productUrl: '', supply: defaults.supply }
}

export function normalizePurchase(row: IngredientRow, input?: unknown): PurchaseSettings {
  const defaults = defaultPurchase(row)
  if (!input || typeof input !== 'object' || Array.isArray(input)) return defaults
  const value = input as Record<string, unknown>
  const packSize = value.packSize === null ? null : validNumber(value.packSize, 0.01, 1000000) && (row.unitType !== 'piece' || Number.isInteger(value.packSize)) ? value.packSize : defaults.packSize
  return {
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim().slice(0, 160) : defaults.name,
    yield: row.unitType === 'gram' && validNumber(value.yield, 0.05, 20) ? value.yield : defaults.yield,
    pantry: validNumber(value.pantry, 0, 1000000) ? (row.unitType === 'piece' ? Math.floor(value.pantry) : value.pantry) : 0,
    packSize,
    packPrice: packSize !== null && validNumber(value.packPrice, 0, 1000000) ? value.packPrice : null,
    byWeight: row.unitType !== 'piece' && (typeof value.byWeight === 'boolean' ? value.byWeight : defaults.byWeight),
    note: typeof value.note === 'string' ? value.note.trim().slice(0, 500) : '',
    productUrl: normalizeProductUrl(value.productUrl),
    supply: ['pantry', 'fresh', 'freezer'].includes(String(value.supply)) ? value.supply as Supply : defaults.supply,
  }
}

export function calculatePurchase(source: IngredientRow, input?: unknown, roundPieces = true) {
  const settings = normalizePurchase(source, input)
  const sourceAmount = source.unitType === 'gram' ? source.weight : source.quantity
  const needed = round(ceil(sourceAmount / settings.yield, source.unitType === 'piece' ? (roundPieces ? 1 : 0.01) : 0.1))
  const missing = round(Math.max(0, needed - settings.pantry))
  const packs = settings.packSize === null || settings.byWeight ? null : ceil(missing / settings.packSize)
  const buy = packs === null ? ceil(missing, source.unitType === 'piece' ? 1 : 50) : round(packs * settings.packSize!)
  const surplus = round(Math.max(0, buy - missing))
  const cost = missing === 0 ? 0 : settings.packSize !== null && settings.packPrice !== null ? round((settings.byWeight ? buy / settings.packSize : packs!) * settings.packPrice) : null
  return { key: purchaseKey(source), source, settings, unit: purchaseUnit(source), needed, missing, packs, buy, surplus, cost }
}

export function purchaseSummary(rows: PurchaseRow[]) {
  return {
    total: round(rows.reduce((sum, row) => sum + (row.cost ?? 0), 0)),
    unknown: rows.filter(row => row.cost === null).length,
    toBuy: rows.filter(row => row.missing > 0).length,
    covered: rows.filter(row => row.missing === 0).length,
  }
}

export const quantityText = (amount: number, unit: string) => `${amount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${unit}`
export function purchaseText(rows: PurchaseRow[], title: string, checked: string[] = []) {
  const summary = purchaseSummary(rows)
  return [title, ...rows.map(row => {
    const mark = row.missing === 0 ? 'Есть дома' : checked.includes(row.key) ? 'Куплено' : 'Купить'
    const pack = row.packs === null || row.missing === 0 ? '' : ` (${row.packs} уп. × ${quantityText(row.settings.packSize!, row.unit)})`
    const price = row.missing === 0 ? '' : row.cost === null ? '; цена не указана' : `; ${quantityText(row.cost, '₽')}`
    const extra = row.surplus > 0 ? `; останется ${quantityText(row.surplus, row.unit)}` : ''
    const conversion = row.settings.yield !== 1 ? `; в меню ${quantityText(row.source.weight, 'г')} «${row.source.name}», выход ×${row.settings.yield}` : ''
    return `${mark}: ${row.settings.name} — ${quantityText(row.buy, row.unit)}${pack}${price}${extra}${conversion}${row.settings.note ? `; ${row.settings.note}` : ''}${row.settings.productUrl ? `\nТовар: ${row.settings.productUrl}` : ''}`
  }), `Оценка стоимости: ${quantityText(summary.total, '₽')}${summary.unknown ? ` + ${summary.unknown} поз. без цены` : ''}. Без доставки.`,
  'Фасовки — редактируемые ориентиры, цены укажите по магазину. На вес округляем вверх до 50 г/мл.'].join('\n')
}

export function purchaseCsv(rows: PurchaseRow[], checked: string[] = []) {
  // Escape formulas as well as separators when opening the file in spreadsheet applications.
  const cell = (value: string | number | null) => {
    const text = value === null ? '' : String(value)
    return `"${(/^[=+\-@\t\r\n]/.test(text) ? "'" : '') + text.replace(/"/g, '""')}"`
  }
  const header = ['Продукт', 'Ед.', 'Нужно', 'Есть дома', 'Купить', 'Упаковка / количество для цены', 'Упаковок', 'Остаток покупки', 'Цена за указанное количество, ₽', 'Стоимость, ₽', 'Статус', 'Ингредиент меню', 'Выход после приготовления', 'Примечание', 'На вес', 'Выбранный товар', 'Поиск Ozon', 'Поиск Яндекс Маркет']
  return '\uFEFF' + [header, ...rows.map(row => [row.settings.name, row.unit, row.needed, row.settings.pantry, row.buy,
    row.settings.packSize, row.packs, row.surplus, row.settings.packPrice, row.cost,
    row.missing === 0 ? 'Есть дома' : checked.includes(row.key) ? 'Куплено' : 'Купить', row.source.name, row.settings.yield, row.settings.note, row.settings.byWeight ? 'Да' : 'Нет', row.settings.productUrl, ...productSearchLinks(row.settings.name).map(link => link.url)])]
    .map(cells => cells.map(cell).join(';')).join('\r\n')
}
