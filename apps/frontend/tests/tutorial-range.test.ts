import assert from 'node:assert/strict'
import test from 'node:test'
import { tutorialByteRange } from '../server/utils/tutorial-range.ts'

test('tutorial seeking supports bounded, open and suffix byte ranges', () => {
  assert.deepEqual(tutorialByteRange(undefined, 1000), { start: 0, end: 999 })
  assert.deepEqual(tutorialByteRange('bytes=100-199', 1000), { start: 100, end: 199 })
  assert.deepEqual(tutorialByteRange('bytes=950-', 1000), { start: 950, end: 999 })
  assert.deepEqual(tutorialByteRange('bytes=-100', 1000), { start: 900, end: 999 })
  assert.deepEqual(tutorialByteRange('bytes=900-5000', 1000), { start: 900, end: 999 })
  assert.deepEqual(tutorialByteRange('bytes=-5000', 1000), { start: 0, end: 999 })
})

test('tutorial streaming rejects unsatisfiable and malformed ranges', () => {
  for (const header of ['bytes=1000-', 'bytes=200-100', 'bytes=-0', 'bytes=-', 'items=0-1', 'bytes=0-1,5-6', 'bytes=9007199254740992-']) {
    assert.equal(tutorialByteRange(header, 1000), null, header)
  }
})
