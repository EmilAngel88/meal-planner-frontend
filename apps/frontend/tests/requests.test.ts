import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allPages, inSession, SessionChangedError } from '../utils/requests.ts'

test('catalog paging preserves every item including a full last page', async () => {
  const offsets: number[] = []
  const items = Array.from({ length: 400 }, (_, id) => ({ id }))
  const result = await allPages(async (limit, offset) => { offsets.push(offset); return items.slice(offset, offset + limit) })
  assert.deepEqual(result, items)
  assert.deepEqual(offsets, [0, 200, 400])
})

test('page failure rejects the whole load instead of showing an incomplete catalog', async () => {
  await assert.rejects(allPages(async (_, offset) => {
    if (offset) throw new Error('offline')
    return Array.from({ length: 200 }, (_, id) => id)
  }), /offline/)
})

test('queued work cannot start in a different account', async () => {
  let started = false
  await assert.rejects(inSession('old', () => 'new', async () => { started = true }), SessionChangedError)
  assert.equal(started, false)
})

test('late success and unauthorized responses are discarded after session changes', async () => {
  for (const fails of [false, true]) {
    let session = 'old'
    await assert.rejects(inSession('old', () => session, async () => {
      session = 'new'
      if (fails) throw Object.assign(new Error('unauthorized'), { status: 401 })
      return { private: 'old account data' }
    }), SessionChangedError)
  }
})

test('unchanged sessions keep successful results and actionable errors', async () => {
  assert.equal(await inSession('same', () => 'same', async () => 42), 42)
  await assert.rejects(inSession('same', () => 'same', async () => { throw new Error('offline') }), /offline/)
})
