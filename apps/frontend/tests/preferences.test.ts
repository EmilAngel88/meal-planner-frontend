import { test } from 'node:test'
import assert from 'node:assert/strict'
import { changedPreferences } from '../utils/preferences.ts'

const preference = (recipeId: number) => ({ recipeId, enabled: true, includeInGeneration: false, maxPerWeek: 3 })

test('one edit sends only that recipe, leaving other-tab settings untouched', () => {
  const saved = Object.fromEntries(Array.from({ length: 600 }, (_, index) => [index, preference(index)]))
  const current = Object.values(saved).map(value => ({ ...value }))
  current[250].includeInGeneration = true
  assert.deepEqual(changedPreferences(current, saved), [{ ...preference(250), includeInGeneration: true }])
  assert.equal(saved[250].includeInGeneration, false)
  assert.deepEqual(changedPreferences(Object.values(saved), saved), [])
})

test('queued saves compare their captured inputs with the last successful save', () => {
  const saved = { 1: preference(1), 2: preference(2) }
  const first = [{ ...preference(1), includeInGeneration: true }, preference(2)]
  const second = [preference(1), { ...preference(2), maxPerWeek: 2 }]
  for (const change of changedPreferences(first, saved)) saved[change.recipeId as 1 | 2] = change as typeof saved[1]
  assert.deepEqual(changedPreferences(second, saved), second)
})

test('failed saves remain retryable and changes are snapshots rather than reactive references', () => {
  const saved = { 1: preference(1) }
  const draft = { ...preference(1), maxPerWeek: 4 }
  const changes = changedPreferences([draft], saved)
  draft.maxPerWeek = 5
  assert.equal(changes[0].maxPerWeek, 4)
  assert.equal(changedPreferences([draft], saved)[0].maxPerWeek, 5)
  assert.deepEqual(changedPreferences([{ ...preference(2), maxPerWeek: null }], { 2: { ...preference(2), maxPerWeek: undefined } }), [])
})
