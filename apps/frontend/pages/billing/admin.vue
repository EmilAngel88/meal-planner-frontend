<template>
  <div class="billing-admin">
    <header class="mp-page-head"><div class="mp-page-head__meta"><span class="mp-overline">Панель владельца</span><h1 class="mp-page-title">Монетизация</h1><p class="mp-page-subtitle">Цены, лимиты и пробный период — в одном месте. Изменения применяются после сохранения.</p></div><v-btn to="/billing" variant="outlined" color="primary">Как видит пользователь</v-btn></header>
    <v-alert v-if="error" type="error" variant="tonal" class="mb-5" role="alert">{{ error }} <v-btn v-if="!dirty" variant="text" @click="load">Обновить</v-btn></v-alert>
    <v-progress-linear v-if="loading" indeterminate color="primary" aria-label="Загрузка настроек" />
    <section v-if="denied" class="admin-card"><h2>Этот раздел доступен владельцу</h2><p>Доступ выдаётся существующему аккаунту отдельной командой на сервере. Обычная регистрация его не предоставляет.</p><v-btn variant="tonal" color="primary" class="mt-4" @click="load">Проверить доступ</v-btn></section>
    <template v-if="draft && settings && !denied">
      <div class="admin-mode"><span class="mode-dot" :class="{ 'mode-dot--on': settings.config.enabled }" /><strong>{{ settings.config.enabled ? 'Монетизация включена' : 'Сейчас всё бесплатно' }}</strong><span>{{ settings.config.salesEnabled ? 'Продажи открыты' : 'Продажи закрыты' }}</span><span>Версия {{ settings.version }}</span></div>
      <div class="admin-layout">
        <div class="admin-editor">
          <section class="admin-card"><span class="mp-overline">01 · Режим работы</span><h2>Начните в удобном темпе</h2><p>Можно сначала проверить тарифы, затем включить ограничения и отдельно открыть оплату.</p><v-switch v-model="draft.enabled" color="primary" label="Включить лимиты тарифов" hide-details @update:model-value="value => { if (!value && draft) draft.salesEnabled = false }" /><p class="field-help">Когда выключено, пользователи создают меню без лимита. Уже выданные периоды продолжают идти.</p><v-switch v-model="draft.salesEnabled" :disabled="(!draft.enabled || !settings.payment.ready) && !draft.salesEnabled" color="primary" label="Открыть приём оплат" hide-details /><p class="field-help">{{ settings.payment.ready ? `Оплата подключена: ${settings.payment.mode === 'test' ? 'тестовый режим, без настоящих денег' : 'реальные платежи'}.` : 'Оплата пока не подключена. Ниже есть инструкция для первого подключения.' }}</p></section>
          <section class="admin-card"><span class="mp-overline">02 · Тарифы</span><h2>За что платит пользователь</h2><p>Платный тариф даёт больше созданий меню. Доступ к рецептам, готовым меню и покупкам остаётся у всех.</p><div class="admin-fields"><v-text-field v-model="draft.free.name" label="Название бесплатного тарифа" maxlength="60" /><v-text-field v-model.number="draft.free.generationsPerMonth" type="number" min="1" max="10000" label="Меню в месяц · бесплатно" /><v-text-field v-model="draft.plus.name" label="Название платного тарифа" maxlength="60" /><v-text-field v-model.number="draft.plus.generationsPerMonth" type="number" min="1" max="10000" label="Меню в месяц · платно" /></div><p class="field-help">Счётчик обновляется 1-го числа в 03:00 по Москве. Пример: 3 бесплатных создания позволяют попробовать сервис, а 60 дают запас для частых изменений.</p></section>
          <section class="admin-card"><span class="mp-overline">03 · Знакомство с сервисом</span><h2>Пробный период</h2><v-switch v-model="draft.trial.enabled" color="primary" label="Разрешить бесплатную пробу" hide-details /><div class="admin-fields mt-4"><v-text-field v-model.number="draft.trial.days" :disabled="!draft.trial.enabled" label="Длительность, дней" type="number" min="1" max="30" /><v-text-field v-model.number="draft.trial.generations" :disabled="!draft.trial.enabled" label="Меню на весь пробный период" type="number" min="1" max="10000" /></div><p class="field-help">Один раз на аккаунт, по кнопке пользователя, без карты. Уже начавшийся пробный период сохраняет прежние условия.</p></section>
          <section class="admin-card"><span class="mp-overline">04 · Варианты оплаты</span><h2>Цена и срок доступа</h2><p>Все суммы — в рублях за весь указанный срок. Автоматического продления нет.</p><article v-for="(offer, index) in draft.offers" :key="offer.id" class="admin-offer"><div class="admin-offer-head"><h3>Вариант {{ index + 1 }}</h3><v-btn v-if="draft.offers.length > 1" variant="text" color="secondary" :aria-label="`Убрать вариант ${index + 1}`" @click="draft.offers.splice(index, 1)">Убрать</v-btn></div><v-text-field v-model="offer.title" label="Название на странице оплаты" maxlength="60" /><div class="admin-fields"><v-text-field v-model.number="offer.days" label="Доступ, дней" type="number" min="1" max="366" /><v-text-field v-model.number="offer.priceRub" label="Цена за весь срок, ₽" type="number" min="1" max="100000" /></div><v-switch v-model="offer.enabled" color="primary" label="Показывать этот вариант" hide-details /></article><v-btn v-if="draft.offers.length < 8" variant="tonal" color="primary" @click="addOffer">Добавить вариант оплаты</v-btn><p class="field-help">299 ₽ за 30 дней и 2 490 ₽ за 365 дней — стартовые примеры для проверки спроса. Их можно изменить. Оплаченные периоды и ранее созданные заказы сохранят свою цену и лимит.</p></section>
          <section class="admin-card"><h2>История настроек</h2><p>Можно вернуть предыдущие значения в форму, проверить их и сохранить как новую версию.</p><div class="admin-restore"><v-btn variant="text" color="primary" @click="restore(settings.defaults)">Загрузить стартовые значения</v-btn><div v-for="entry in settings.history" :key="entry.id" class="admin-history-row"><span>{{ billingDate(entry.createdAt) }} · версия {{ entry.details.version }}</span><v-btn v-if="entry.details.before" variant="text" color="primary" @click="restore(entry.details.before)">Вернуть значения до изменения</v-btn></div></div></section>
        </div>
        <aside class="admin-preview"><div class="admin-card"><span class="mp-overline">Предпросмотр</span><h2>{{ draft.enabled ? 'Ваше предложение' : 'Свободный доступ' }}</h2><p v-if="!draft.enabled">Без ограничения на создание меню. Платные предложения скрыты.</p><template v-else><p><strong>{{ draft.free.name }}</strong><br>{{ draft.free.generationsPerMonth }} меню / месяц · бесплатно</p><hr><p><strong>{{ draft.plus.name }}</strong><br>{{ draft.plus.generationsPerMonth }} меню / месяц</p><p v-for="offer in draft.offers.filter(item => item.enabled)" :key="offer.id">{{ offer.title }} · {{ offer.days }} дней<br><strong>{{ billingMoney(offer.priceRub * 100) }}</strong></p><p v-if="draft.trial.enabled">Проба: {{ draft.trial.days }} дней, {{ draft.trial.generations }} меню</p><p>{{ draft.salesEnabled ? 'Оплата будет доступна' : 'Оплата закрыта' }}</p></template><v-alert v-if="validationError" type="warning" variant="tonal" class="mt-4">{{ validationError }}</v-alert><div class="admin-save"><v-btn color="primary" size="large" block :disabled="!dirty || !!validationError" :loading="saving" @click="save">Сохранить настройки</v-btn><v-btn variant="text" block :disabled="!dirty || saving" @click="discard">Отменить мои изменения</v-btn><small role="status">{{ dirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены' }}</small></div></div></aside>
      </div>
      <section class="admin-card"><h2>Первое подключение оплаты</h2><p>Цены и лимиты меняются здесь. Ключ магазина вводится один раз в защищённые настройки сервера.</p><ol><li>Создайте тестовый магазин ЮKassa.</li><li>Укажите на сервере режим, идентификатор магазина, секретный ключ, адрес возврата и способ передачи чеков. Точные поля описаны в инструкции проекта «Монетизация».</li><li>В кабинете ЮKassa подключите уведомления об успешной оплате, отмене и возврате.</li><li>Проверьте тестовую покупку и возврат. Затем подключите боевой магазин и откройте приём оплат.</li></ol><p class="field-help">{{ settings.payment.ready ? 'Настройки подключения заполнены. Их работоспособность проверяется тестовой оплатой.' : 'До подключения доступны бесплатная проба и выдача подарочного доступа.' }}</p></section>
      <section v-if="overview" class="admin-card"><h2>Результаты за всё время</h2><div class="admin-stats"><div><strong>{{ billingMoney(overview.revenueMinor) }}</strong><span>оплаты за вычетом возвратов</span></div><div><strong>{{ overview.activePaid }}</strong><span>пользователей с оплаченным доступом</span></div><div><strong>{{ overview.paidOrders }}</strong><span>успешных оплат, включая возвраты</span></div><div><strong>{{ overview.activeTrials }}</strong><span>незавершённых пробных периодов</span></div></div><p class="field-help">Тестовые платежи и подарки в выручку не входят. Комиссии платёжного сервиса здесь не вычитаются.</p></section>
      <section class="admin-card"><h2>Подарить доступ</h2><p>Для тестировщиков, знакомых или компенсации. Это не платёж и не увеличивает выручку. Если доступ уже действует, подарок добавится после него.</p><form @submit.prevent="giveAccess"><div class="admin-fields mt-5"><v-text-field v-model="gift.email" type="email" label="Email существующего аккаунта" required /><v-text-field v-model.number="gift.days" type="number" label="На сколько дней" min="1" max="366" required /></div><v-text-field v-model="gift.reason" label="Причина для журнала" maxlength="300" required /><v-btn type="submit" color="primary" variant="tonal" :loading="gifting">Выдать подарок</v-btn></form></section>
      <section class="admin-card"><h2>Последние заказы</h2><form class="admin-search" @submit.prevent="loadOrders(true)"><v-text-field v-model="orderEmail" type="email" label="Фильтр по точному email" clearable hide-details /><v-btn type="submit" variant="tonal" color="primary" :loading="ordersLoading">Найти</v-btn></form><p v-if="!orders.length" class="field-help">Заказов пока нет.</p><article v-for="order in orders" :key="order.id" class="admin-order"><div><strong>{{ order.email }} · {{ order.name }}</strong><p>{{ orderStatusLabel(order.status) }} · {{ billingMoney(order.amountMinor) }}{{ order.mode === 'test' ? ' · тестовый' : '' }}</p><small>Заказ {{ order.id }}</small><small v-if="order.providerPaymentId">ЮKassa {{ order.providerPaymentId }}</small></div><v-btn v-if="!order.providerPaymentId && order.status === 'pending'" variant="tonal" @click="linkOrderId = order.id; linkPaymentId = ''">Найти платёж</v-btn><v-btn variant="text" :disabled="checking !== ''" :loading="checking === order.id" @click="checkOrder(order.id)">Проверить</v-btn></article><v-btn v-if="ordersMore" variant="text" :loading="ordersLoading" @click="loadOrders(false)">Показать ещё</v-btn></section>
      <section v-if="overview?.audit.length" class="admin-card"><h2>Журнал действий</h2><article v-for="entry in overview.audit" :key="entry.id" class="admin-history-row"><div><strong>{{ actionLabel(entry.action) }}</strong><p>{{ billingDate(entry.createdAt) }} · аккаунт №{{ entry.actorId }}{{ entry.details.email ? ` · ${entry.details.email}` : '' }}</p><small v-if="entry.details.reason">{{ entry.details.reason }}</small></div><v-btn v-if="entry.action === 'gift' && entry.details.grantId" variant="text" @click="revokeId = entry.details.grantId; revokeReason = ''">Отозвать подарок</v-btn></article></section>
    </template>
    <v-dialog :model-value="!!linkOrderId" max-width="560" :persistent="!!checking" @update:model-value="value => { if (!value) linkOrderId = '' }"><v-card class="pa-6"><h2>Проверить платёж в ЮKassa</h2><p class="my-4">Откройте кабинет вашего магазина, найдите платёж по номеру заказа {{ linkOrderId }} и скопируйте его идентификатор. Мы проверим сумму, магазин и статус перед выдачей доступа.</p><v-text-field v-model="linkPaymentId" label="Идентификатор платежа ЮKassa" maxlength="64" /><div class="admin-dialog-actions"><v-btn variant="text" :disabled="!!checking" @click="linkOrderId = ''">Назад</v-btn><v-btn color="primary" :loading="!!checking" :disabled="!linkPaymentId.trim()" @click="linkPayment">Проверить и связать</v-btn></div></v-card></v-dialog>
    <v-dialog :model-value="!!revokeId" max-width="500" :persistent="gifting" @update:model-value="value => { if (!value) revokeId = '' }"><v-card class="pa-6"><h2>Отозвать подарочный доступ</h2><p class="my-4">Оплаченные периоды останутся доступными.</p><v-text-field v-model="revokeReason" label="Причина" maxlength="300" /><div class="admin-dialog-actions"><v-btn variant="text" :disabled="gifting" @click="revokeId = ''">Отмена</v-btn><v-btn color="secondary" :loading="gifting" :disabled="revokeReason.trim().length < 3" @click="revokeGift">Отозвать подарок</v-btn></div></v-card></v-dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, reactive, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useApi } from '~/composables/useApi'
import { useAuthStore } from '~/stores/auth'
import { useUiStore } from '~/stores/ui'
import { errorMessage } from '~/utils/storage'
import { billingDate, billingMoney, orderStatusLabel, type BillingAdminSettings, type BillingConfig, type BillingOverview, type BillingOrder } from '~/utils/billing'
const api = useApi(), auth = useAuthStore(), ui = useUiStore()
const settings = ref<BillingAdminSettings | null>(null), draft = ref<BillingConfig | null>(null), overview = ref<BillingOverview | null>(null)
const loading = ref(false), saving = ref(false), denied = ref(false), error = ref(''), gifting = ref(false), checking = ref('')
const linkOrderId = ref(''), linkPaymentId = ref('')
const orders = ref<BillingOrder[]>([]), orderEmail = ref(''), ordersMore = ref(false), ordersLoading = ref(false)
const gift = reactive({ email: '', days: 30, reason: '' }), giftKey = ref(''), giftPayload = ref(''), revokeId = ref(''), revokeReason = ref('')
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
const dirty = computed(() => !!settings.value && !!draft.value && JSON.stringify(settings.value.config) !== JSON.stringify(draft.value))
const positive = (value: number, max: number) => Number.isInteger(value) && value > 0 && value <= max
const validationError = computed(() => {
  const d = draft.value; if (!d) return ''
  if (!d.free.name.trim() || !d.plus.name.trim()) return 'Заполните названия тарифов.'
  if (!positive(d.free.generationsPerMonth, 10000) || !positive(d.plus.generationsPerMonth, 10000)) return 'Лимиты должны быть целыми числами от 1 до 10 000.'
  if (d.plus.generationsPerMonth <= d.free.generationsPerMonth) return 'У платного тарифа должно быть больше созданий меню.'
  if (!positive(d.trial.days, 30) || !positive(d.trial.generations, 10000)) return 'Для пробы укажите от 1 до 30 дней и положительный лимит меню.'
  if (d.offers.some(o => !o.title.trim() || !positive(o.days, 366) || !positive(o.priceRub, 100000))) return 'У каждого варианта нужны название, целое число дней (1–366) и цена (1–100 000 ₽).'
  if (d.salesEnabled && !d.offers.some(o => o.enabled)) return 'Для продаж включите хотя бы один вариант оплаты.'
  return ''
})
async function load() {
  loading.value = true; error.value = ''; denied.value = false
  try { const data = await api.getBillingSettings(); settings.value = data; draft.value = clone(data.config); await auth.me(false); await refreshReports() }
  catch (cause) { denied.value = (cause as { status?: number }).status === 403; if (!denied.value) error.value = errorMessage(cause) }
  finally { loading.value = false }
}
async function refreshReports() { overview.value = await api.getBillingOverview(); await loadOrders(true) }
async function loadOrders(reset: boolean) {
  ordersLoading.value = true
  try { const result = await api.getAdminBillingOrders(reset ? 0 : orders.value.length, orderEmail.value || ''); orders.value = reset ? result.items : [...orders.value, ...result.items]; ordersMore.value = result.hasMore }
  catch (cause) { error.value = errorMessage(cause) }
  finally { ordersLoading.value = false }
}
async function save() {
  if (!draft.value || !settings.value || validationError.value) return
  saving.value = true; error.value = ''
  try {
    const submitted = clone(draft.value)
    const result = await api.saveBillingSettings({ version: settings.value.version, config: submitted })
    settings.value.config = result.config; settings.value.version = result.version
    if (JSON.stringify(draft.value) === JSON.stringify(submitted)) draft.value = clone(result.config)
    ui.notify('Настройки монетизации сохранены')
    settings.value.history = (await api.getBillingSettings()).history
    await refreshReports()
  } catch (cause) { error.value = errorMessage(cause) }
  finally { saving.value = false }
}
function discard() { if (settings.value) draft.value = clone(settings.value.config); error.value = '' }
function restore(config: BillingConfig) { draft.value = clone(config); ui.notify('Значения перенесены в форму. Проверьте и сохраните.', 'info') }
function addOffer() { draft.value?.offers.push({ id: `offer_${crypto.randomUUID().slice(0, 8)}`, title: 'Новый вариант', days: 90, priceRub: 790, enabled: true }) }
async function giveAccess() {
  if (gifting.value) return
  const snapshot = JSON.stringify(gift)
  if (!giftKey.value || snapshot !== giftPayload.value) { giftKey.value = crypto.randomUUID(); giftPayload.value = snapshot }
  gifting.value = true; error.value = ''
  try { await api.grantBillingAccess({ ...gift, requestId: giftKey.value }); giftKey.value = ''; gift.email = ''; gift.reason = ''; ui.notify('Подарочный доступ выдан'); await refreshReports() }
  catch (cause) { error.value = errorMessage(cause) }
  finally { gifting.value = false }
}
async function revokeGift() {
  gifting.value = true
  try { await api.revokeBillingGift(revokeId.value, revokeReason.value); revokeId.value = ''; ui.notify('Подарок отозван'); await refreshReports() }
  catch (cause) { error.value = errorMessage(cause) }
  finally { gifting.value = false }
}
async function checkOrder(id: string) {
  checking.value = id
  try { await api.checkAdminBillingOrder(id); await refreshReports(); ui.notify('Статус заказа обновлён') }
  catch (cause) { error.value = errorMessage(cause) }
  finally { checking.value = '' }
}
async function linkPayment() {
  checking.value = linkOrderId.value
  try { await api.linkBillingPayment(linkOrderId.value, linkPaymentId.value.trim()); linkOrderId.value = ''; await refreshReports(); ui.notify('Платёж проверен и связан с заказом') }
  catch (cause) { error.value = errorMessage(cause); linkOrderId.value = '' }
  finally { checking.value = '' }
}
const actionLabel = (action: string) => ({ settings: 'Изменение настроек', gift: 'Подарочный доступ', revoke_gift: 'Подарок отозван', link_payment: 'Платёж связан с заказом', admin_grant: 'Выдан доступ владельца', admin_revoke: 'Доступ владельца отозван' })[action] || action
function beforeUnload(event: BeforeUnloadEvent) { if (dirty.value) { event.preventDefault(); event.returnValue = '' } }
onBeforeRouteLeave(() => !dirty.value || window.confirm('Есть несохранённые настройки. Уйти без сохранения?'))
onMounted(() => { window.addEventListener('beforeunload', beforeUnload); void load() })
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>
<style scoped>
.billing-admin{max-width:1200px;margin:0 auto}.admin-mode{display:flex;gap:16px;align-items:center;flex-wrap:wrap;background:var(--surface-sunken);padding:16px 22px;border-radius:14px;margin:20px 0}.admin-mode>span:not(.mode-dot){font-size:.85rem;color:var(--text-secondary)}.mode-dot{width:10px;height:10px;border-radius:50%;background:var(--clay-300)}.mode-dot--on{background:var(--basil-500)}.admin-layout{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:22px}.admin-editor{min-width:0}.admin-card{background:var(--surface-card);border:1px solid var(--border-subtle);border-radius:20px;padding:28px;margin-bottom:22px;min-width:0}.admin-card h2{font:1.55rem var(--font-display);margin:8px 0 14px}.admin-card>p{margin-bottom:18px;color:var(--text-secondary)}.admin-fields{display:grid;grid-template-columns:1fr 1fr;gap:4px 18px;margin-top:22px}.field-help{font-size:.83rem;color:var(--text-secondary);line-height:1.7;margin-top:12px}.admin-offer{border:1px solid var(--border-subtle);padding:20px;border-radius:14px;margin:20px 0}.admin-offer-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.admin-offer .admin-fields{margin-top:0}.admin-offer h3{font-size:1rem}.admin-preview{align-self:start;position:sticky;top:18px}.admin-preview .admin-card{background:var(--basil-50);border-color:var(--basil-100)}.admin-preview hr{border:0;border-top:1px solid var(--border-subtle);margin:18px 0}.admin-save{display:grid;gap:8px;margin-top:24px}.admin-save small{text-align:center;color:var(--text-secondary)}.admin-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:24px;margin:24px 0}.admin-stats strong{display:block;font:1.9rem var(--font-display);margin-bottom:6px}.admin-stats span{font-size:.85rem;color:var(--text-secondary)}.admin-card ol{padding-left:20px;display:grid;gap:12px}.admin-history-row,.admin-order{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:15px 0;border-bottom:1px solid var(--border-subtle);overflow-wrap:anywhere}.admin-history-row p,.admin-order p,.admin-order small{font-size:.83rem;color:var(--text-secondary)}.admin-order small{display:block;margin-top:4px}.admin-search{display:flex;gap:14px;align-items:center;margin:20px 0}.admin-dialog-actions{display:flex;gap:10px;justify-content:flex-end}@media(max-width:1000px){.admin-layout{grid-template-columns:1fr}.admin-preview{position:static;grid-row:1}.admin-stats{grid-template-columns:1fr 1fr}}@media(max-width:560px){.admin-card{padding:20px}.admin-fields{grid-template-columns:1fr}.admin-history-row,.admin-order{flex-direction:column;align-items:flex-start}.admin-search{flex-direction:column;align-items:stretch}.admin-stats{gap:20px}.admin-stats strong{font-size:1.6rem}}
</style>
