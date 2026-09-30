<template>
  <div class="billing-page">
    <header class="mp-page-head">
      <div class="mp-page-head__meta"><span class="mp-overline">Больше свободы в планах</span><h1 class="mp-page-title">Тариф и оплата</h1><p class="mp-page-subtitle">Выбирайте свой ритм. Ваши рецепты, меню и покупки всегда под рукой.</p></div>
      <v-btn v-if="auth.canManageBilling" to="/billing/admin" variant="outlined" color="primary">Настроить монетизацию</v-btn>
    </header>
    <v-alert v-if="error" type="error" variant="tonal" class="mb-5" role="alert">{{ error }} <v-btn variant="text" :disabled="busy" @click="load">Обновить</v-btn></v-alert>
    <v-progress-linear v-if="loading" indeterminate color="primary" aria-label="Загрузка тарифа" />
    <template v-if="status">
      <section class="billing-current" aria-labelledby="current-plan-title">
        <div><span class="mp-overline">Сейчас у вас</span><h2 id="current-plan-title">{{ status.enabled ? status.name : 'Свободный доступ' }}</h2><p v-if="!status.enabled">Все возможности открыты. Создавайте меню без ограничения по тарифу.</p><p v-else-if="status.expiresAt">Доступ до {{ billingDate(status.expiresAt) }}. Автосписаний нет.</p><p v-else>Бесплатный тариф без привязки карты.</p></div>
        <div class="billing-balance"><strong>{{ status.remaining === null ? '∞' : status.remaining }}</strong><span>{{ status.remaining === null ? 'без лимита' : 'осталось созданий меню' }}</span><small v-if="status.limit !== null">Использовано {{ status.used }} из {{ status.limit }} · {{ status.plan === 'trial' ? 'до конца пробы' : 'за календарный месяц' }}</small></div>
      </section>
      <p v-if="status.enabled" class="billing-hint">{{ status.plan === 'trial' ? `Пробный период завершится ${billingDate(status.resetsAt)}.` : `Счётчик обновится ${billingDate(status.resetsAt)} в 03:00 по Москве.` }} Одна успешно созданная неделя — одно использование. Неудачные попытки не учитываются.</p>
      <v-alert v-if="status.payment.mode === 'test'" type="info" variant="tonal" class="my-5">Включён тестовый режим оплаты. Настоящие деньги не списываются.</v-alert>
      <template v-if="status.enabled">
        <section v-if="status.trialAvailable" class="billing-trial"><div><h2>Попробуйте, как вам удобнее</h2><p>{{ status.config.trial.generations }} созданий меню на {{ status.config.trial.days }} дней. Бесплатно, без карты и автоматического продления.</p></div><v-btn color="primary" :loading="busy" @click="beginTrial">Попробовать бесплатно</v-btn></section>
        <div class="billing-plans">
          <section class="billing-card"><span class="mp-overline">Для привычного ритма</span><h2>{{ status.config.free.name }}</h2><p class="billing-price">0 ₽ <small>/ всегда</small></p><ul><li>{{ status.config.free.generationsPerMonth }} создания меню в календарный месяц</li><li>Цель питания и личные рецепты</li><li>Сохранённые меню и список покупок</li></ul><p class="billing-hint">После окончания платного доступа вы вернётесь на этот тариф. Ваши данные сохранятся.</p></section>
          <section class="billing-card billing-card--plus"><span class="mp-overline">Когда планы меняются</span><h2>{{ status.config.plus.name }}</h2><p class="billing-feature">{{ status.config.plus.generationsPerMonth }} <small>созданий меню в календарный месяц</small></p><p>Все возможности бесплатного тарифа и больше попыток, чтобы подобрать меню под себя.</p>
            <div class="billing-offers"><div v-for="offer in status.config.offers.filter(item => item.enabled)" :key="offer.id" class="billing-offer"><div><strong>{{ offer.title }}</strong><small>{{ offer.days }} дней доступа</small></div><strong>{{ billingMoney(offer.priceRub * 100) }}</strong><v-btn variant="flat" color="primary" :disabled="!status.canBuy || busy" @click="selectOffer(offer)">Выбрать</v-btn></div></div>
            <p class="billing-hint">Разовая оплата за весь срок. Без автоматического продления. При покупке заранее новый период начнётся после текущего.</p><p v-if="!status.canBuy" class="billing-hint">Приём оплат пока закрыт.</p>
          </section>
        </div>
      </template>
      <section v-if="status.grants.length" class="billing-section"><h2>Ваши периоды доступа</h2><article v-for="grant in status.grants" :key="grant.id" class="billing-row"><div><strong>{{ grant.name }}</strong><p>{{ billingDate(grant.startsAt) }} — {{ billingDate(grant.endsAt) }}</p></div><span>{{ grant.limit }} меню / месяц</span></article></section>
    </template>
    <section v-if="orders.length" class="billing-section" aria-labelledby="payment-history-title"><h2 id="payment-history-title">История оплат</h2><article v-for="order in orders" :key="order.id" class="billing-row"><div><strong>{{ order.name }}</strong><p>{{ billingDate(order.createdAt) }} · {{ orderStatusLabel(order.status) }}{{ order.mode === 'test' ? ' · тест' : '' }}</p><small v-if="order.refundedMinor">Возвращено {{ billingMoney(order.refundedMinor) }}</small><small class="billing-order-id">Заказ {{ order.id }}</small></div><strong>{{ billingMoney(order.amountMinor) }}</strong><div class="billing-order-actions"><v-btn v-if="order.status === 'pending' && safeCheckoutUrl(order.confirmationUrl)" :href="safeCheckoutUrl(order.confirmationUrl)!" color="primary" variant="tonal">Продолжить оплату</v-btn><v-btn v-if="order.status === 'pending' || order.status === 'paid'" :disabled="busy" variant="text" @click="checkOrder(order.id)">Проверить статус</v-btn></div></article><v-btn v-if="hasMore" variant="text" :loading="busy" @click="moreOrders">Показать ещё</v-btn></section>
    <section class="billing-help"><h2>Всё под вашим контролем</h2><p>Пробный период начинается только по вашей кнопке. После его окончания ничего не списывается. Даже если лимит закончился, можно пользоваться готовыми меню, рецептами и покупками.</p><NuxtLink to="/feedback">Вопрос об оплате? Напишите нам →</NuxtLink></section>
    <v-dialog v-model="confirmOpen" max-width="520" :persistent="busy"><v-card v-if="selected" class="pa-6"><h2>Проверьте условия</h2><p class="my-4">{{ selected.planName }} · {{ selected.offer.title }}</p><p><strong>{{ billingMoney(selected.offer.priceRub * 100) }}</strong> за {{ selected.offer.days }} дней, {{ selected.limit }} созданий меню в календарный месяц.</p><p class="my-4">Разовая оплата. Автосписаний нет. Оплаченные условия сохранятся до конца этого периода.</p><v-alert v-if="status?.payment.mode === 'test'" type="info" variant="tonal" class="mb-4">Тестовый платёж без реального списания.</v-alert><div class="billing-dialog-actions"><v-btn variant="text" :disabled="busy" @click="confirmOpen = false">Назад</v-btn><v-btn color="primary" :loading="busy" @click="checkout">Перейти к оплате</v-btn></div></v-card></v-dialog>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useApi } from '~/composables/useApi'
import { useAuthStore } from '~/stores/auth'
import { useUiStore } from '~/stores/ui'
import { errorMessage } from '~/utils/storage'
import { billingDate, billingMoney, orderStatusLabel, safeCheckoutUrl, type BillingStatus, type BillingOrder, type BillingOffer } from '~/utils/billing'
const api = useApi(), auth = useAuthStore(), ui = useUiStore(), route = useRoute()
const status = ref<BillingStatus | null>(null), orders = ref<BillingOrder[]>([])
const loading = ref(false), busy = ref(false), hasMore = ref(false), error = ref(''), confirmOpen = ref(false)
const selected = ref<{ offer: BillingOffer; version: number; requestId: string; planName: string; limit: number } | null>(null)
async function load() {
  loading.value = true; error.value = ''
  try { const [state, history] = await Promise.all([api.getBilling(), api.getBillingOrders()]); status.value = state; orders.value = history.items; hasMore.value = history.hasMore }
  catch (cause) { error.value = errorMessage(cause) }
  finally { loading.value = false }
}
async function beginTrial() {
  busy.value = true; error.value = ''
  try { await api.startBillingTrial(); await load(); ui.notify('Пробный доступ включён') }
  catch (cause) { error.value = errorMessage(cause) }
  finally { busy.value = false }
}
function selectOffer(offer: BillingOffer) {
  if (!status.value) return
  selected.value = { offer: { ...offer }, version: status.value.version, requestId: crypto.randomUUID(), planName: status.value.config.plus.name, limit: status.value.config.plus.generationsPerMonth }
  confirmOpen.value = true
}
async function checkout() {
  if (!selected.value || busy.value) return
  busy.value = true; error.value = ''
  try {
    const order = await api.createBillingOrder({ requestId: selected.value.requestId, offerId: selected.value.offer.id, version: selected.value.version })
    confirmOpen.value = false
    const url = safeCheckoutUrl(order.confirmationUrl)
    if (url) { window.location.assign(url); return }
    await load()
    ui.notify(order.status === 'paid' ? 'Оплата подтверждена, доступ открыт' : 'Заказ создан. Его статус — в истории оплат.')
  } catch (cause) { confirmOpen.value = false; await load(); error.value = errorMessage(cause) }
  finally { busy.value = false }
}
async function checkOrder(id: string) {
  busy.value = true; error.value = ''
  try { const order = await api.checkBillingOrder(id); await load(); ui.notify(order.status === 'paid' ? 'Оплата подтверждена' : orderStatusLabel(order.status), order.status === 'pending' ? 'info' : 'success') }
  catch (cause) { error.value = errorMessage(cause) }
  finally { busy.value = false }
}
async function moreOrders() {
  busy.value = true
  try { const page = await api.getBillingOrders(orders.value.length); orders.value.push(...page.items.filter(item => !orders.value.some(old => old.id === item.id))); hasMore.value = page.hasMore }
  catch (cause) { error.value = errorMessage(cause) }
  finally { busy.value = false }
}
onMounted(async () => { await load(); const id = route.query.order; if (typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)) await checkOrder(id) })
</script>
<style scoped>
.billing-page{max-width:1120px;margin:0 auto}.billing-current{display:flex;justify-content:space-between;gap:28px;align-items:center;padding:32px;border-radius:24px;background:var(--basil-500);color:white}.billing-current .mp-overline{color:var(--basil-100)}.billing-current h2{font:2rem var(--font-display);margin:12px 0}.billing-current p{opacity:.85}.billing-balance{display:grid;gap:4px;min-width:220px}.billing-balance strong{font:3.4rem var(--font-display)}.billing-balance small{opacity:.8}.billing-hint{font-size:.83rem;color:var(--text-secondary);margin:14px 0;line-height:1.65}.billing-plans{display:grid;grid-template-columns:.8fr 1.2fr;gap:22px;margin:24px 0}.billing-card{padding:30px;border:1px solid var(--border-subtle);border-radius:22px;background:var(--surface-card)}.billing-card--plus{border:2px solid var(--basil-500)}.billing-card h2{font:1.9rem var(--font-display);margin:12px 0}.billing-price,.billing-feature{font:2.4rem var(--font-display);margin:18px 0}.billing-price small,.billing-feature small{font: .9rem var(--font-sans);color:var(--text-secondary)}.billing-card ul{padding-left:20px;display:grid;gap:14px;margin:22px 0}.billing-offers{margin:24px 0;display:grid;gap:10px}.billing-offer{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px;background:var(--surface-sunken);border-radius:12px}.billing-offer small{display:block;color:var(--text-secondary)}.billing-trial{display:flex;align-items:center;justify-content:space-between;gap:24px;background:var(--basil-50);padding:24px;border-radius:18px;margin:24px 0}.billing-trial h2,.billing-section h2,.billing-help h2{font:1.45rem var(--font-display);margin-bottom:10px}.billing-section{margin-top:32px}.billing-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 0;border-bottom:1px solid var(--border-subtle)}.billing-row p,.billing-row small{color:var(--text-secondary);font-size:.85rem;margin-top:4px}.billing-order-id{display:block;overflow-wrap:anywhere}.billing-order-actions{display:flex;gap:6px;flex-wrap:wrap}.billing-help{margin:32px 0;padding:26px;background:var(--surface-sunken);border-radius:18px}.billing-help p{max-width:780px}.billing-help a{display:inline-block;color:var(--basil-500);font-weight:600;margin-top:14px}.billing-dialog-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}@media(max-width:760px){.billing-plans{grid-template-columns:1fr}.billing-current,.billing-trial{align-items:flex-start;flex-direction:column;padding:24px}.billing-balance{min-width:0}.billing-card{padding:22px}.billing-row{align-items:flex-start;flex-wrap:wrap}.billing-offer{flex-wrap:wrap}.billing-offer .v-btn{width:100%}.billing-order-actions{width:100%}}
</style>
