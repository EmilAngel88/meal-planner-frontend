import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { safeCheckoutUrl, billingMoney } from '../utils/billing.ts'
describe('checkout navigation', () => {
  it('allows only HTTPS payment destinations and formats integer kopecks', () => {
    assert.equal(safeCheckoutUrl('https://yoomoney.ru/checkout'), 'https://yoomoney.ru/checkout')
    for (const url of [null, 'javascript:alert(1)', 'https://yookassa.ru.bad.test', 'https://yookassa.ru@bad.test', 'http://yookassa.ru']) assert.equal(safeCheckoutUrl(url), null)
    assert.match(billingMoney(29900), /299/)
  })
})
