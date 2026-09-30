import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dayInPlan, relevantPlan, planDateLabel } from '../utils/plans.ts'

const plan = (id: number, startDate: string | null, createdAt: string) => ({ id, startDate, daysCount: 6, createdAt, items: [], targetCalories: 2000, targetProtein: 100, targetFat: 70, targetCarbs: 240, totalCalories: 12000, totalProtein: 600, totalFat: 420, totalCarbs: 1440 })

test('planned days include the first and last day, but not the free day', () => {
  const value = plan(1, '2026-09-28T00:00:00.000Z', '2026-09-27')
  assert.equal(dayInPlan(value, '2026-09-28'), 0)
  assert.equal(dayInPlan(value, '2026-10-03'), 5)
  assert.equal(dayInPlan(value, '2026-09-27'), null)
  assert.equal(dayInPlan(value, '2026-10-04'), null)
})

test('calendar days remain correct across daylight-saving changes', () => {
  assert.equal(dayInPlan(plan(1, '2026-03-27', '2026-03-27'), '2026-03-30'), 3)
  assert.equal(dayInPlan(plan(1, null, '2026-03-27'), '2026-03-30'), null)
  assert.equal(dayInPlan(plan(1, 'bad date', '2026-03-27'), '2026-03-30'), null)
})

test('overview prefers a current plan over a newer future plan without mutating history', () => {
  const history = [plan(3, '2026-10-05', '2026-09-29'), plan(2, '2026-09-28', '2026-09-28'), plan(1, '2026-09-28', '2026-09-27')]
  assert.equal(relevantPlan(history, '2026-09-29')?.id, 2)
  assert.equal(relevantPlan(history, '2026-12-01')?.id, 3)
  assert.deepEqual(history.map(item => item.id), [3, 2, 1])
  assert.equal(relevantPlan([], '2026-09-29'), null)
})

test('undated and cross-month menus have clear date labels', () => {
  assert.equal(planDateLabel(plan(1, null, '2026-09-29')), '6 дней без даты')
  assert.match(planDateLabel(plan(1, '2026-09-28', '2026-09-29')), /28.*3/)
})
