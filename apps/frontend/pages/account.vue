<template>
  <div class="goal-page">
    <header class="mp-page-head">
      <div class="mp-page-head__meta">
        <span class="mp-overline">Основа вашего рациона</span>
        <h1 class="mp-page-title">Моя цель</h1>
        <p class="mp-page-subtitle">Личный ориентир, вокруг которого складывается меню.</p>
      </div>
    </header>

    <div v-if="pageLoading" class="goal-loading" role="status" aria-live="polite">
      <v-progress-circular indeterminate color="primary" size="28" />
      <span>Загружаем вашу цель…</span>
    </div>
    <v-alert v-else-if="loadError" type="error" variant="tonal" role="alert">
      {{ loadError }} <v-btn variant="text" @click="load">Попробовать снова</v-btn>
    </v-alert>

    <template v-else>
      <section v-if="savedCalories" id="goal-summary" class="goal-summary" :class="{ 'goal-summary--new': !savedCalories }" aria-labelledby="goal-summary-title">
        <div class="goal-summary__main">
          <span class="goal-status"><span aria-hidden="true">{{ savedCalories ? '✓' : '01' }}</span>{{ savedCalories ? 'Цель сохранена' : 'Первый шаг' }}</span>
          <template v-if="savedCalories">
            <h2 id="goal-summary-title" class="goal-summary__number">{{ formatNumber(savedCalories) }} <span>ккал / день</span></h2>
            <p>{{ savedGoalLabel }}. Эта цель используется для новых планов питания.</p>
            <p class="goal-saved-method">{{ profile.goalSetup?.input.mode === 'calculated' ? 'Персональный расчёт' : profile.goalSetup?.input.mode === 'manual' ? 'Норма указана вами' : 'Ранее сохранённая цель' }}<template v-if="profile.goalSetup"> · {{ formatDate(profile.goalSetup.savedAt) }}</template></p>
            <details v-if="profile.goalSetup" class="goal-saved-details"><summary>На чём основана цель</summary><div v-if="profile.goalSetup.input.mode === 'calculated'"><p>{{ profile.age }} лет · {{ profile.height }} см · {{ formatNumber(profile.weight!) }} кг · {{ profile.gender === 'male' ? 'мужской' : 'женский' }}</p><p>{{ savedRoutine }}. {{ savedExercise }}.</p><p>Поддержание ≈ {{ formatNumber(profile.goalSetup.estimate.maintenanceCalories!) }} ккал. Поправка {{ profile.goalSetup.estimate.adjustmentPercent > 0 ? '+' : '' }}{{ profile.goalSetup.estimate.adjustmentPercent }}%, результат округлён до 50 ккал.</p><p>Это начальная оценка. Через 2–4 недели сравните её с динамикой веса и самочувствием.</p></div><p v-else>Вы указали {{ formatNumber(savedCalories) }} ккал и вес {{ formatNumber(profile.weight!) }} кг. Дополнительная поправка на цель не применяется.</p></details>
          </template>
        </div>
        <div v-if="savedCalories" class="goal-summary__actions">
          <v-btn color="primary" size="large" to="/menu">Перейти к моей неделе <span class="ml-4" aria-hidden="true">↗</span></v-btn>
          <button class="goal-text-button" type="button" @click="openEditor">{{ editorOpen ? 'Настройки ниже ↓' : 'Изменить цель' }}</button>
        </div>
      </section>

      <GoalSetup v-if="editorOpen" :profile="profile" :latest-log="logs[0]" :can-cancel="!!savedCalories" @saved="onGoalSaved" @cancel="editorOpen = false" />

      <section class="weight-section" aria-labelledby="weight-title">
        <div class="weight-intro">
          <span class="mp-overline">Личная история</span>
          <h2 id="weight-title">Журнал веса</h2>
          <p>Сохраняйте измерения, когда удобно. Записи в журнале не меняют цель автоматически.</p>
          <div v-if="logs.length" class="weight-latest"><strong>{{ formatNumber(logs[0].weight) }} <span>кг</span></strong><small>Последняя запись · {{ formatDate(logs[0].date) }}</small></div>
        </div>
        <div class="weight-panel">
          <v-form ref="weightForm" validate-on="submit lazy" @submit.prevent="add">
            <div class="weight-add-row">
              <v-text-field v-model="date" label="Дата измерения" type="date" :rules="dateRules" :disabled="adding" />
              <v-text-field v-model.number="weight" label="Вес" suffix="кг" type="number" inputmode="decimal" step="0.1" min="20" max="500" :rules="weightRules" :disabled="adding" />
              <v-btn color="primary" variant="tonal" type="submit" :loading="adding" :disabled="adding">Добавить</v-btn>
            </div>
          </v-form>
          <v-alert v-if="logActionError" type="error" variant="tonal" class="mb-4" role="alert">{{ logActionError }}</v-alert>
          <v-alert v-if="logsError" type="error" variant="tonal" role="alert">{{ logsError }} <v-btn variant="text" :loading="logsLoading" @click="loadLogs">Повторить</v-btn></v-alert>
          <div v-else-if="!logs.length" class="weight-empty"><span aria-hidden="true">↗</span><div><h3>Здесь будет ваша история</h3><p>Добавьте первое измерение с помощью формы выше.</p></div></div>
          <v-table v-else class="weight-table" density="comfortable">
            <thead><tr><th scope="col">Дата</th><th scope="col">Вес</th><th scope="col"><span class="sr-only">Действия</span></th></tr></thead>
            <tbody><tr v-for="entry in visibleLogs" :key="entry.id"><td>{{ formatDate(entry.date) }}</td><td class="weight-table__value">{{ formatNumber(entry.weight) }} <span>кг</span></td><td class="text-right"><v-btn size="small" variant="text" color="secondary" :aria-label="`Удалить измерение за ${formatDate(entry.date)}`" :disabled="deleting !== null" :loading="deleting === entry.id" @click="pendingDelete = entry.id">Удалить</v-btn></td></tr></tbody>
          </v-table>
          <button v-if="logs.length > 5" type="button" class="weight-expand" @click="showAllLogs = !showAllLogs">{{ showAllLogs ? 'Показать последние записи' : `Показать все записи (${logs.length})` }}</button>
        </div>
      </section>
    </template>

    <section class="mp-feedback-account" aria-labelledby="billing-account-title">
      <div><h2 id="billing-account-title">Ваш тариф</h2><p>Остаток созданий меню, пробный доступ и история оплат.</p></div>
      <div class="mp-feedback-account__links"><v-btn variant="tonal" color="primary" to="/billing">Тариф и оплата</v-btn><v-btn v-if="auth.canManageBilling" variant="outlined" color="primary" to="/billing/admin">Монетизация</v-btn></div>
    </section>
    <section class="mp-feedback-account" aria-labelledby="feedback-account-title">
      <div><h2 id="feedback-account-title">Давайте сделаем Рацион удобнее</h2><p>Ваши идеи, замечания и ответы команды — в одном месте.</p></div>
      <div class="mp-feedback-account__links"><v-btn variant="tonal" color="primary" to="/feedback">Мои обращения</v-btn><v-btn v-if="auth.canManageFeedback" variant="outlined" color="primary" to="/feedback/admin">Входящие отзывы</v-btn></div>
    </section>

    <section class="account-session" aria-label="Аккаунт">
      <div><span>Вы вошли как</span><strong>{{ auth.user?.email || 'Пользователь Рациона' }}</strong></div>
      <v-btn variant="text" color="primary" @click="auth.logout()">Выйти из аккаунта</v-btn>
    </section>

    <v-dialog v-model="deleteDialog" max-width="410" :persistent="deleting !== null">
      <v-card class="delete-card"><v-card-title>Удалить измерение?</v-card-title><v-card-text>Запись исчезнет из журнала. Цель питания останется прежней.</v-card-text><v-card-actions><v-btn variant="text" :disabled="deleting !== null" @click="pendingDelete = null">Оставить</v-btn><v-spacer /><v-btn color="error" variant="tonal" :loading="deleting !== null" @click="remove">Удалить</v-btn></v-card-actions></v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { Profile } from '~/composables/useApi'
import { goalOptions, routineOptions, exerciseOptions } from '~/utils/goal'
import { useProfileStore } from '~/stores/profile'
import { useAuthStore } from '~/stores/auth'
import { useUiStore } from '~/stores/ui'
import { errorMessage, localDate } from '~/utils/storage'

const store = useProfileStore()
const auth = useAuthStore()
const ui = useUiStore()
const { profile, logs } = storeToRefs(store)
const pageLoading = ref(true)
const loadError = ref('')
const logsError = ref('')
const logActionError = ref('')
const adding = ref(false)
const logsLoading = ref(false)
const deleting = ref<number | null>(null)
const pendingDelete = ref<number | null>(null)
const deleteDialog = computed({ get: () => pendingDelete.value !== null, set: (value: boolean) => { if (!value) pendingDelete.value = null } })
const editorOpen = ref(true)
const showAllLogs = ref(false)
const savedCalories = computed(() => profile.value.calories)
const savedGoalLabel = computed(() => goalOptions.find(item => item.value === profile.value.goal)?.title || 'Ваша цель')
const savedRoutine = computed(() => { const input = profile.value.goalSetup?.input; return input?.mode === 'calculated' ? routineOptions.find(item => item.value === input.routine)?.title : '' })
const savedExercise = computed(() => { const input = profile.value.goalSetup?.input; return input?.mode === 'calculated' ? exerciseOptions.find(item => item.value === input.exercise)?.title : '' })
const weightRules = [(value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 20 && value <= 500 || 'От 20 до 500 кг']
const dateRules = [(value: string) => {
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value || 'Укажите корректную дату'
}]
const visibleLogs = computed(() => showAllLogs.value ? logs.value : logs.value.slice(0, 5))
const weightForm = ref<{ validate: () => Promise<{ valid: boolean }>; resetValidation: () => void }>()
const date = ref(localDate())
const weight = ref<number | null>(null)
const formatNumber = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value)
const formatDate = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value))
const loadLogs = async () => {
  logsLoading.value = true
  logsError.value = ''
  try { await store.fetchLogs() }
  catch (error) { logsError.value = errorMessage(error, 'Не удалось загрузить журнал.') }
  finally { logsLoading.value = false }
}
const load = async () => {
  pageLoading.value = true
  loadError.value = ''
  const results = await Promise.allSettled([store.fetch(), loadLogs()])
  if (results[0].status === 'rejected') loadError.value = errorMessage(results[0].reason, 'Не удалось загрузить цель.')
  else editorOpen.value = !savedCalories.value
  pageLoading.value = false
}
onMounted(load)
const openEditor = async () => {
  editorOpen.value = true
  await nextTick()
  document.getElementById('goal-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
const onGoalSaved = async (value: Profile) => {
  store.profile = value
  editorOpen.value = false
  ui.notify('Цель сохранена. Можно планировать неделю.')
  await nextTick()
  document.getElementById('goal-summary')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
const add = async () => {
  if (adding.value) return
  adding.value = true
  logActionError.value = ''
  try {
    if (!(await weightForm.value?.validate())?.valid || weight.value === null) return
    await store.addLog(date.value, weight.value)
    weight.value = null
    weightForm.value?.resetValidation()
    if (logsError.value) await loadLogs()
    ui.notify('Измерение добавлено')
  } catch (error) { logActionError.value = errorMessage(error) }
  finally { adding.value = false }
}
const remove = async () => {
  if (pendingDelete.value === null || deleting.value !== null) return
  deleting.value = pendingDelete.value
  logActionError.value = ''
  try { await store.deleteLog(pendingDelete.value); ui.notify('Измерение удалено') }
  catch (error) { logActionError.value = errorMessage(error) }
  finally { deleting.value = null; pendingDelete.value = null }
}
</script>

<style scoped>
.goal-page { max-width: 1180px; }
.goal-loading { min-height: 240px; display: flex; align-items: center; justify-content: center; gap: 15px; color: var(--text-secondary); font-size: 14px; }
.goal-summary { margin: 25px 0 30px; background: #e9eedf; border: 1px solid #dce3d2; border-radius: 24px; padding: 32px 36px; display: flex; justify-content: space-between; align-items: center; gap: 28px; }
.goal-status { display: flex; align-items: center; gap: 8px; font-size: 11px; color: #3d5f46; letter-spacing: .02em; }
.goal-status > span { display: inline-flex; justify-content: center; align-items: center; width: 22px; height: 22px; border-radius: 50%; background: #d8e4bd; font-size: 12px; }
.goal-summary__number { font-size: clamp(40px, 4.8vw, 63px); font-weight: 500; letter-spacing: -.04em; color: #264b3f; line-height: 1.1; margin: 18px 0 12px; font-variant-numeric: tabular-nums; }
.goal-summary__number span { font-size: 14px; font-weight: 400; letter-spacing: 0; color: var(--text-secondary); white-space: nowrap; }
.goal-summary p { max-width: 470px; font-size: 12px; line-height: 1.7; color: var(--text-secondary); margin: 0; }
.goal-summary__title { font-family: Georgia, 'Times New Roman', serif; font-weight: 400; font-size: 37px; letter-spacing: -.035em; line-height: 1.16; color: #264b3f; margin: 16px 0; }
.goal-summary__actions { display: flex; align-items: center; flex-direction: column; gap: 15px; flex-shrink: 0; }
.goal-text-button { font-size: 12px; color: #52705b; padding: 7px 0; text-underline-offset: 4px; }
.goal-text-button:hover { text-decoration: underline; }
.goal-text-button:focus-visible, .goal-modes button:focus-visible, .goal-option:focus-visible, summary:focus-visible, .weight-expand:focus-visible { outline: 2px solid #264b3f; outline-offset: 4px; }
.goal-summary__route { display: flex; align-items: center; gap: 14px; font-size: 13px; color: var(--text-secondary); }
.goal-summary__route b { color: #264b3f; font-weight: 500; }
.goal-saved-method { margin-top: 10px !important; }
.goal-saved-details { margin-top: 18px; font-size: 11px; color: #4c6947; }
.goal-saved-details summary { cursor: pointer; text-decoration: underline; text-underline-offset: 4px; }
.goal-saved-details > div, .goal-saved-details > p { margin-top: 12px; }
.goal-saved-details p + p { margin-top: 7px; }
.weight-intro h2 { font: 400 29px/1.2 Georgia, serif; letter-spacing: -.025em; margin: 8px 0 0; color: #264b3f; }
.weight-section { margin-top: 40px; display: grid; grid-template-columns: minmax(180px, .7fr) minmax(0, 1.6fr); gap: 44px; }
.weight-intro { padding-top: 6px; }
.weight-intro > p { font-size: 12px; color: var(--text-secondary); line-height: 1.8; margin: 17px 0; max-width: 250px; }
.weight-latest { margin-top: 30px; }
.weight-latest strong { display: block; font-size: 30px; font-weight: 500; color: #3f5943; font-variant-numeric: tabular-nums; }
.weight-latest strong span { font-size: 14px; font-weight: 400; }
.weight-latest small { display: block; font-size: 12px; color: var(--text-secondary); margin-top: 5px; }
.weight-panel { background: #fff; border-radius: 20px; padding: 25px; border: 1px solid #e0e5da; }
.weight-add-row { display: grid; grid-template-columns: minmax(150px, 1.4fr) minmax(90px, 1fr) auto; gap: 12px; align-items: start; }
.weight-add-row > .v-btn { margin-top: 3px; height: 43px; }
.weight-empty { display: flex; align-items: center; gap: 16px; border-top: 1px solid #e8ece3; padding: 25px 4px 4px; }
.weight-empty > span { background: #eff3e5; color: var(--text-secondary); border-radius: 50%; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.weight-empty h3 { color: #5b6f54; font-size: 13px; font-weight: 500; margin-bottom: 5px; }
.weight-empty p { font-size: 11px; line-height: 1.6; color: var(--text-secondary); margin: 0; }
.weight-table { font-size: 12px; }
.weight-table :deep(th) { color: var(--text-secondary); font-size: 12px; }
.weight-table :deep(td), .weight-table :deep(th) { padding: 0 6px !important; }
.weight-table__value { font-weight: 500; color: #425a3f; font-variant-numeric: tabular-nums; white-space: nowrap; }
.weight-table__value span { color: var(--text-secondary); font-weight: 400; font-size: 11px; }
.weight-expand { display: block; width: 100%; padding: 16px 0 0; font-size: 11px; color: var(--text-secondary); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.account-session { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-top: 25px; margin-top: 38px; border-top: 1px solid #dfe5d9; }
.account-session > div { min-width: 0; }
.account-session span { display: block; color: var(--text-secondary); font-size: 12px; }
.account-session strong { display: block; color: #53694e; font-size: 12px; font-weight: 500; overflow-wrap: anywhere; margin-top: 4px; }
.delete-card { border-radius: 22px !important; padding: 16px; }
.delete-card :deep(.v-card-title) { font-family: Georgia, serif; color: #264b3f; }
.delete-card :deep(.v-card-text) { line-height: 1.7; font-size: 13px; }
@media (max-width: 1100px) {
  .goal-summary { padding: 28px; }
  .weight-section { gap: 25px; grid-template-columns: minmax(170px, .6fr) minmax(0, 1.4fr); }
  .weight-panel { padding: 20px; }
  .weight-add-row { grid-template-columns: 1.4fr 1fr; }
  .weight-add-row > .v-btn { grid-column: 1 / -1; margin: 0 0 15px; }
}
@media (max-width: 760px) {
  .goal-summary { border-radius: 20px; padding: 25px; align-items: stretch; flex-direction: column; gap: 23px; margin: 22px 0; }
  .goal-summary__actions { align-items: stretch; gap: 6px; }
  .goal-summary__number { font-size: 47px; }
  .weight-section { grid-template-columns: 1fr; gap: 20px; margin-top: 32px; }
  .weight-intro > p { max-width: none; margin: 12px 0 0; }
  .weight-latest { margin-top: 16px; }
  .weight-latest strong { font-size: 25px; }
  .weight-add-row { grid-template-columns: minmax(130px, 1.3fr) minmax(70px, 1fr); gap: 8px; }
  .weight-table { font-size: 11px; }
}
@media (max-width: 380px) { .account-session { flex-direction: column; align-items: start; gap: 10px; } }
@media (prefers-reduced-motion: reduce) { .goal-page { scroll-behavior: auto; } }
</style>
