import { test } from 'node:test'
import assert from 'node:assert/strict'
import { feedbackMessageRule, prepareFeedbackSubmission, sanitizeFeedbackPagePath } from '../utils/feedback.ts'

test('feedback context removes identifiers and secret URL parts, and rejects arbitrary paths', () => {
  assert.equal(sanitizeFeedbackPagePath('/recipes/123?token=secret#weight=75'), '/recipes/:id')
  assert.equal(sanitizeFeedbackPagePath('/menu?plan=123'), '/menu')
  assert.equal(sanitizeFeedbackPagePath('/feedback/admin/'), '/feedback/admin')
  assert.equal(sanitizeFeedbackPagePath('/recipes/:id'), '/recipes/:id')
  for (const path of ['', '?secret=1', 'https://example.com/menu', '//example.com/menu', '/account/private@example.test', '/recipes/private-title', '/%6denu']) {
    assert.equal(sanitizeFeedbackPagePath(path), undefined)
  }
})

test('feedback validation counts meaningful content and accepts both message boundaries', () => {
  assert.equal(typeof feedbackMessageRule(' '.repeat(30)), 'string')
  assert.equal(typeof feedbackMessageRule('123456789'), 'string')
  assert.equal(feedbackMessageRule(' 1234567890 '), true)
  assert.equal(feedbackMessageRule('я'.repeat(4000)), true)
  assert.equal(typeof feedbackMessageRule('я'.repeat(4001)), 'string')
})

test('lost-response retries retain the request identity and original immutable payload', () => {
  const draft = { category: 'bug' as const, message: ' Кнопка не работает ', pagePath: '/recipes/52?plan=1', deviceType: 'mobile' as const }
  const first = prepareFeedbackSubmission(draft, null, () => 'first-id')
  const retry = prepareFeedbackSubmission(draft, first, () => { throw new Error('Retry must not mint a new ID') })
  assert.equal(first, retry)
  draft.message = 'Другая проблема с кнопкой'
  assert.equal(first.message, 'Кнопка не работает')
  assert.equal(first.pagePath, '/recipes/:id')
  const changed = prepareFeedbackSubmission(draft, first, () => 'second-id')
  assert.equal(changed.requestId, 'second-id')
})

test('turning context off removes both page and device, including on retries', () => {
  const first = prepareFeedbackSubmission({ category: 'idea', message: 'Хочу удобный список покупок', pagePath: '/shopping-list', deviceType: 'desktop' }, null, () => 'first-id')
  const withoutContext = prepareFeedbackSubmission({ category: 'idea', message: first.message }, first, () => 'second-id')
  assert.deepEqual(withoutContext, { requestId: 'second-id', category: 'idea', message: first.message })
  assert.equal(prepareFeedbackSubmission({ category: 'idea', message: first.message }, withoutContext), withoutContext)
})
