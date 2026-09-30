import { calculatePurchase, normalizePurchase, purchaseKey, type IngredientRow, type PurchaseRow, type PurchaseSettings } from './purchases.ts'
import { purchaseDefaults } from './purchase-defaults.ts'

type PlanItem = { id: number; dayIndex: number; mealIndex: number; mealTitle: string; title: string; recipeId?: number | null; sourceType: string; shoppingSnapshot?: IngredientRow[] | null }
type Plan = { daysCount: number; items: PlanItem[] }
export type CookingInfo = { id: number; cookingMode: string; storageDays: number | null; freezerFriendly: boolean; batchNotes: string; storageInstructions: string }
export type ProvisionOptions = { start: string; horizon: 'week' | 'fortnight' | 'fourWeeks' | 'month'; freeDay: number; freezer: boolean; batch: boolean }
export type Use = { day: number; date: string; title: string; meal: string; amount: number; unit: string }
export type Occurrence = { item: PlanItem; day: number; date: string; key: string }
export type CookingTask = { key: string; day: number; title: string; recipeId?: number | null; info?: CookingInfo; portions: Occurrence[]; ingredients: IngredientRow[]; frozen: Occurrence[] }
export type TripRow = PurchaseRow & { checkKey: string; carry: number; reviewStock: number }
export type Trip = { day: number; date: string; rows: TripRow[] }
const rounded = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const units = (row: IngredientRow) => row.unitType === 'piece' ? 'шт.' : row.unitType === 'ml' ? 'мл' : 'г'
const amount = (row: IngredientRow) => row.unitType === 'gram' ? row.weight : row.quantity

export function dateAt(start: string, offset: number): string {
  const date = new Date(`${start}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}
export function periodDays(options: ProvisionOptions): number {
  if (options.horizon !== 'month') return { week: 7, fortnight: 14, fourWeeks: 28 }[options.horizon]
  const date = new Date(`${options.start}T12:00:00Z`)
  const day = date.getUTCDate()
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + 1)
  const endOfMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(day, endOfMonth))
  return Math.round((date.getTime() - Date.parse(`${options.start}T12:00:00Z`)) / 86400000)
}
export function normalizeOptions(input: unknown, fallbackStart: string, sourceDays = 6): ProvisionOptions {
  const value = input && typeof input === 'object' ? input as Partial<ProvisionOptions> : {}
  const validDate = typeof value.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.start) && Number.isFinite(Date.parse(`${value.start}T12:00:00Z`)) && dateAt(value.start, 0) === value.start
  return {
    start: validDate ? value.start! : fallbackStart,
    horizon: ['week', 'fortnight', 'fourWeeks', 'month'].includes(String(value.horizon)) ? value.horizon! : 'month',
    freeDay: Number.isInteger(value.freeDay) && value.freeDay! >= 0 && value.freeDay! < sourceDays ? value.freeDay! : -1,
    freezer: typeof value.freezer === 'boolean' ? value.freezer : true,
    batch: typeof value.batch === 'boolean' ? value.batch : true,
  }
}
export function sumIngredients(groups: IngredientRow[][]): IngredientRow[] {
  const map = new Map<string, IngredientRow>()
  for (const row of groups.flat()) {
    if (!Number.isFinite(row.weight) || !Number.isFinite(row.quantity) || row.weight < 0 || row.quantity < 0) continue
    const key = purchaseKey(row), previous = map.get(key)
    if (previous) { previous.weight += row.weight; previous.quantity += row.quantity }
    else map.set(key, { ...row })
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}
function composition(item: PlanItem): string {
  const rows = sumIngredients([item.shoppingSnapshot || []])
  const total = rows.reduce((sum, row) => sum + row.weight, 0)
  // Different ingredient ratios cannot become a single pot without changing macros.
  return JSON.stringify(rows.map(row => [purchaseKey(row), Math.round(row.weight / Math.max(total, 1) * 1e6)]))
}
const anchor = (day: number) => Math.floor(day / 7) * 7 + (day % 7 >= 3 ? 3 : 0)

export function planProvisions(plan: Plan, cooking: Record<number, CookingInfo>, options: ProvisionOptions, inputs: Record<string, PurchaseSettings> = {}) {
  const days = periodDays(options)
  const sourceDays = Math.max(1, Math.min(7, plan.daysCount))
  const occurrences: Occurrence[] = [], freeDays: number[] = [], missingDays: number[] = []
  for (let day = 0; day < days; day++) {
    const slot = day % 7
    const sourceDay = slot < sourceDays ? slot : options.freeDay
    if (sourceDay < 0) { freeDays.push(day); continue }
    const items = plan.items.filter(item => item.dayIndex === sourceDay)
    if (!items.length) missingDays.push(day)
    for (const item of items) occurrences.push({ item, day, date: dateAt(options.start, day), key: `${day}:${item.id}` })
  }
  const tasks = new Map<string, CookingTask>()
  for (const occurrence of occurrences) {
    const { item, day } = occurrence
    const info = item.recipeId ? cooking[item.recipeId] : undefined
    const hasRice = /рис/i.test(item.title) || item.shoppingSnapshot?.some(row => /^рис(?:\s|$)/i.test(row.name))
    const safeDays = Math.min(info?.storageDays ?? 0, hasRice ? 1 : 2)
    const cookAhead = options.batch && info?.cookingMode === 'batch'
    let cookDay = day
    if (cookAhead) {
      const proposed = anchor(day)
      if (options.freezer && info.freezerFriendly || day - proposed < safeDays) cookDay = proposed
    }
    const key = cookAhead ? `${cookDay}:${item.recipeId}:${composition(item)}` : `${day}:${item.id}`
    let task = tasks.get(key)
    if (!task) {
      task = { key, day: cookDay, title: item.title, recipeId: item.recipeId, info, portions: [], ingredients: [], frozen: [] }
      tasks.set(key, task)
    }
    task.portions.push(occurrence)
    if (cookDay < day && day - cookDay >= safeDays) task.frozen.push(occurrence)
  }
  const cookingTasks = [...tasks.values()].sort((a, b) => a.day - b.day || a.title.localeCompare(b.title, 'ru'))
  for (const task of cookingTasks) task.ingredients = sumIngredients(task.portions.map(portion => portion.item.shoppingSnapshot || []))
  const sources = sumIngredients(occurrences.map(occurrence => occurrence.item.shoppingSnapshot || []))
  const uses: Record<string, Use[]> = {}
  for (const occurrence of occurrences) for (const row of occurrence.item.shoppingSnapshot || []) {
    (uses[purchaseKey(row)] ||= []).push({ day: occurrence.day, date: occurrence.date, title: occurrence.item.title, meal: occurrence.item.mealTitle, amount: amount(row), unit: units(row) })
  }
  const trips = new Map<number, Trip>()
  const purchases: PurchaseRow[] = []
  for (const source of sources) {
    const key = purchaseKey(source)
    const settings = normalizePurchase(source, inputs[key])
    const profile = purchaseDefaults(source.name, source.unitType)
    const longStorage = settings.supply === 'pantry' || settings.supply === 'freezer' && options.freezer
    const keepDays = settings.supply === 'freezer' ? (options.freezer ? days + 1 : 1) : longStorage ? profile.afterOpening ?? days + 1 : profile.keepDays
    const unopenedDays = settings.supply === 'fresh' && profile.sealed ? 4 : keepDays
    const demands = new Map<number, IngredientRow[]>()
    for (const task of cookingTasks) {
      const ingredient = task.ingredients.find(row => purchaseKey(row) === key)
      if (!ingredient) continue
      const group = demands.get(task.day) || []
      group.push(ingredient); demands.set(task.day, group)
    }
    // Stock is a projection for this period. Lots carry only while usable; no
    // localStorage pantry value is ever decremented or silently carried a month.
    let lots = [{ quantity: settings.pantry, expiry: keepDays - 1 }]
    const groupedTrips = new Map<number, TripRow>()
    let unverifiedStock = 0
    for (const [useDay, demand] of [...demands].sort(([a], [b]) => a - b)) {
      const regularDay = anchor(useDay)
      const day = longStorage ? 0 : useDay - regularDay < unopenedDays ? regularDay : useDay
      // Existing lots must last until cooking, not just the shopping date.
      const expired = lots.filter(lot => lot.expiry < useDay).reduce((sum, lot) => sum + lot.quantity, 0)
      unverifiedStock += expired
      lots = lots.filter(lot => lot.expiry >= useDay)
      const available = lots.reduce((sum, lot) => sum + lot.quantity, 0)
      const aggregated = sumIngredients([demand])[0]
      const purchase = calculatePurchase(aggregated, { ...settings, pantry: available }, false)
      let consume = purchase.needed
      // Packages are purchased sealed, then opened as needed. Only the opened
      // remainder expires here; this also applies to shelf-stable cans/juice.
      if (purchase.buy) lots.push({ quantity: purchase.buy, expiry: useDay + keepDays - 1 })
      for (const lot of lots) { const used = Math.min(consume, lot.quantity); consume -= used; lot.quantity -= used }
      const row: TripRow = { ...purchase, carry: rounded(lots.reduce((sum, lot) => sum + lot.quantity, 0)), reviewStock: rounded(expired),
        checkKey: `${options.start}:${options.horizon}:${day}:${key}:${purchase.buy}:${settings.name}:${settings.productUrl}` }
      const previous = groupedTrips.get(day)
      if (previous) {
        previous.source = sumIngredients([[previous.source, aggregated]])[0]
        previous.needed = rounded(previous.needed + row.needed)
        previous.missing = rounded(previous.missing + row.missing)
        previous.buy = rounded(previous.buy + row.buy)
        previous.packs = previous.packs === null || row.packs === null ? null : previous.packs + row.packs
        previous.cost = previous.cost === null || row.cost === null ? null : rounded(previous.cost + row.cost)
        previous.carry = row.carry
        previous.reviewStock = rounded(previous.reviewStock + row.reviewStock)
      } else groupedTrips.set(day, row)
    }
    const productTrips = [...groupedTrips.values()]
    for (const [day, row] of groupedTrips) {
      row.surplus = row.carry
      row.checkKey = `${options.start}:${options.horizon}:${day}:${key}:${row.buy}:${settings.name}:${settings.productUrl}`
      const trip = trips.get(day) || { day, date: dateAt(options.start, day), rows: [] }
      trip.rows.push(row); trips.set(day, trip)
    }
    const base = calculatePurchase(source, settings)
    const buy = rounded(productTrips.reduce((sum, row) => sum + row.buy, 0))
    purchases.push({ ...base, buy, missing: buy > 0 ? base.missing || buy : 0,
      packs: productTrips.every(row => row.packs !== null) ? productTrips.reduce((sum, row) => sum + row.packs!, 0) : null,
      cost: productTrips.some(row => row.cost === null) ? null : rounded(productTrips.reduce((sum, row) => sum + row.cost!, 0)),
      surplus: rounded(lots.reduce((sum, lot) => sum + lot.quantity, 0) + unverifiedStock),
    })
  }
  return { days, occurrences, freeDays, missingDays, cookingTasks, purchases, uses,
    trips: [...trips.values()].sort((a, b) => a.day - b.day),
    incomplete: missingDays.length > 0 || occurrences.some(({ item }) => !item.shoppingSnapshot?.length),
  }
}
