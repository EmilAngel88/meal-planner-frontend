import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGoalDraft, goalInput, goalSteps, type GoalSetup } from '../utils/goal.ts'

test('legacy profiles keep their numbers and do not invent a routine from old training frequency', () => {
  const old = { age: 30, gender: 'male' as const, weight: 80, height: 180, goal: 'gain' as const, calories: 2400 }
  const draft = createGoalDraft(old)
  assert.equal(draft.calories, 2400)
  assert.equal(draft.routine, null)
  assert.equal(draft.exercise, null)
  draft.weight = 90
  assert.equal(old.weight, 80)
})
test('the route adapts to mode and skips irrelevant adjustment questions for maintenance', () => {
  assert.deepEqual(goalSteps({ mode: 'calculated', goal: 'maintain' }), ['intent', 'body', 'activity', 'review'])
  assert.deepEqual(goalSteps({ mode: 'calculated', goal: 'loss' }), ['intent', 'body', 'activity', 'pace', 'review'])
  assert.deepEqual(goalSteps({ mode: 'manual', goal: 'gain' }), ['intent', 'manual', 'review'])
})
test('manual payloads strip demographics, activity and stale adjustments', () => {
  const draft = { ...createGoalDraft(), mode: 'manual' as const, goal: 'loss' as const, weight: 80, calories: 2345, adultConfirmed: true, age: 30, routine: 'physical' as const, pace: 'moderate' as const }
  assert.deepEqual(goalInput(draft), { mode: 'manual', goal: 'loss', weight: 80, calories: 2345, adultConfirmed: true })
  assert.throws(() => goalInput({ ...draft, adultConfirmed: false }), /18 лет/)
})
test('incomplete input cannot create a preview or fall back to zero', () => {
  assert.throws(() => goalInput(createGoalDraft()), /вес/)
  const draft = { ...createGoalDraft(), age: 30, height: 180, weight: 80, gender: 'male' as const }
  assert.throws(() => goalInput(draft), /распорядок/)
  assert.throws(() => goalInput({ ...draft, weight: NaN }), /вес/)
  const input = goalInput({ ...draft, routine: 'seated', exercise: 'none', pace: 'moderate' })
  assert.equal(input.mode === 'calculated' && input.pace, 'gentle')
})
test('saved questionnaire round-trips and respects the selected manual mode', () => {
  const input = { mode: 'manual', weight: 78, goal: 'maintain', calories: 2300, adultConfirmed: true } as const
  const setup: GoalSetup = { version: 1, savedAt: '2026-09-29', input, estimate: { calories: 2300, restingCalories: null, maintenanceCalories: null, activityFactor: null, adjustmentPercent: 0, adjustmentCalories: 0 } }
  const draft = createGoalDraft({ ...input, goalSetup: setup })
  assert.deepEqual(goalInput(draft), input)
})
