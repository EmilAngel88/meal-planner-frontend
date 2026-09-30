export type BillingOffer = { id: string; title: string; days: number; priceRub: number; enabled: boolean }
export type BillingConfig = {
  enabled: boolean; salesEnabled: boolean
  free: { name: string; generationsPerMonth: number }
  plus: { name: string; generationsPerMonth: number }
  trial: { enabled: boolean; days: number; generations: number }
  offers: BillingOffer[]
}
export type PaymentConnection = { ready: boolean; mode: 'disabled' | 'test' | 'live' }
export type BillingGrant = { id: string; name: string; source: string; startsAt: string; endsAt: string; limit: number }
export type BillingStatus = {
  version: number; config: BillingConfig; enabled: boolean; plan: 'free' | 'trial' | 'plus'; name: string
  limit: number | null; used: number; remaining: number | null; resetsAt: string; expiresAt: string | null
  trialAvailable: boolean; payment: PaymentConnection; canBuy: boolean; grants: BillingGrant[]
}
export type BillingOrder = {
  id: string; name: string; days: number; limit: number; amountMinor: number; currency: string
  status: 'pending' | 'paid' | 'canceled' | 'refunded'; mode: string; confirmationUrl: string | null
  refundedMinor: number; createdAt: string; paidAt: string | null; email?: string; providerPaymentId?: string | null
}
export type BillingOrderPage = { items: BillingOrder[]; hasMore: boolean }
export type BillingAudit = { id: number; actorId: number; action: string; createdAt: string; details: { before?: BillingConfig; after?: BillingConfig; version?: number; email?: string; reason?: string; days?: number; grantId?: string } }
export type BillingAdminSettings = { version: number; config: BillingConfig; defaults: BillingConfig; payment: PaymentConnection; history: BillingAudit[] }
export type BillingOverview = { revenueMinor: number; paidOrders: number; refundedOrders: number; activePaid: number; activeTrials: number; audit: BillingAudit[] }
export const billingMoney = (minor: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(minor / 100)
export const billingDate = (date: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' }).format(new Date(date))
export const orderStatusLabel = (status: BillingOrder['status']) => ({ pending: 'Ожидает оплаты', paid: 'Оплачен', canceled: 'Отменён', refunded: 'Возврат выполнен' })[status]
export const safeCheckoutUrl = (value: string | null) => {
  if (!value) return null
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && ['yookassa.ru', 'yoomoney.ru'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url.toString() : null }
  catch { return null }
}
