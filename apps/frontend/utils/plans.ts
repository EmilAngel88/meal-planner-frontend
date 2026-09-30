import type { MealPlan } from '../composables/useApi'

export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function dayInPlan(plan: Pick<MealPlan, 'startDate' | 'daysCount'>, today = localDateKey()): number | null {
  if (!plan.startDate) return null
  const start = Date.parse(`${plan.startDate.slice(0, 10)}T00:00:00Z`)
  const current = Date.parse(`${today}T00:00:00Z`)
  const index = Math.round((current - start) / 86400000)
  return Number.isFinite(index) && index >= 0 && index < plan.daysCount ? index : null
}

export function relevantPlan(plans: MealPlan[], today = localDateKey()): MealPlan | null {
  const sorted = [...plans].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
  return sorted.find(plan => dayInPlan(plan, today) !== null) || sorted[0] || null
}

export function planDateLabel(plan: Pick<MealPlan, 'startDate' | 'daysCount'>): string {
  if (!plan.startDate) return `${plan.daysCount} дней без даты`
  const start = new Date(`${plan.startDate.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(start.getTime())) return `${plan.daysCount} дней`
  const end = new Date(start)
  end.setDate(end.getDate() + plan.daysCount - 1)
  const format = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
  return `${format.format(start)} — ${format.format(end)}`
}
