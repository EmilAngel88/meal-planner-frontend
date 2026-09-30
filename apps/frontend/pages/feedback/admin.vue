<template>
  <div class="feedback-inbox">
    <header class="mp-page-head">
      <div class="mp-page-head__meta"><span class="mp-overline">Развиваем вместе</span><h1 class="mp-page-title">Входящие отзывы</h1><p class="mp-page-subtitle">Замечания и идеи первых пользователей. Ответ появится в их обращении.</p></div>
      <v-btn variant="outlined" color="primary" to="/feedback">Мои обращения</v-btn>
    </header>

    <section v-if="denied" class="inbox-empty" aria-labelledby="inbox-denied-title">
      <MpIcon name="inbox" :size="36" /><h2 id="inbox-denied-title">Раздел для команды</h2>
      <p>Здесь можно разбирать отзывы пользователей. Для этого аккаунта доступ пока не открыт.</p>
      <v-btn color="primary" variant="tonal" :loading="loading" @click="load(true)">Проверить доступ</v-btn>
    </section>
    <template v-else>
      <section class="inbox-filters" aria-label="Фильтры отзывов">
        <v-select v-model="statusFilter" label="Статус" :items="[{ value: '', title: 'Все статусы' }, ...feedbackStatuses]" item-title="title" item-value="value" hide-details />
        <v-select v-model="categoryFilter" label="Тип обращения" :items="[{ value: '', title: 'Все типы' }, ...feedbackCategories]" item-title="title" item-value="value" hide-details />
        <v-btn variant="text" color="primary" :loading="loading" @click="load(true)">Обновить</v-btn>
      </section>
      <v-alert v-if="loadError" type="error" variant="tonal" class="mb-5" role="alert">{{ loadError }}<v-btn variant="text" :loading="loading" @click="load(items.length === 0)">Повторить</v-btn></v-alert>
      <v-progress-linear v-if="loading" indeterminate color="primary" aria-label="Загрузка отзывов" class="mb-5" />
      <section v-if="!loading && !loadError && !items.length" class="inbox-empty">
        <MpIcon name="inbox" :size="36" /><h2>{{ statusFilter === 'new' ? 'Новых обращений пока нет' : 'Здесь пока пусто' }}</h2>
        <p>{{ statusFilter || categoryFilter ? 'Попробуйте другой фильтр или проверьте все обращения.' : 'Пользователи могут написать вам через кнопку «Написать отзыв».' }}</p>
        <v-btn v-if="statusFilter || categoryFilter" variant="text" color="primary" @click="clearFilters">Показать все обращения</v-btn>
      </section>
      <section v-if="items.length" class="inbox-list" aria-label="Обращения пользователей">
        <article v-for="item in items" :key="item.id" class="inbox-card">
          <div class="inbox-card__top"><span class="inbox-category">{{ feedbackCategoryLabels[item.category] }}</span><span class="inbox-status" :data-status="item.status">{{ feedbackStatusLabels[item.status] }}</span></div>
          <h2><button type="button" @click="openItem(item)">Обращение №{{ item.id }}<MpIcon name="arrow-right" :size="19" /></button></h2>
          <p class="inbox-message-preview">{{ item.message }}</p>
          <div class="inbox-card__bottom"><span>{{ item.author.email }}</span><time :datetime="item.createdAt">{{ formatDate(item.createdAt) }}</time></div>
          <button class="inbox-open" type="button" @click="openItem(item)">{{ item.reply ? 'Посмотреть и изменить ответ' : 'Разобрать обращение' }}</button>
        </article>
      </section>
      <div v-if="items.length" class="inbox-pagination"><span>Показано: {{ items.length }}</span><v-btn v-if="nextCursor !== null" variant="outlined" color="primary" :loading="loading" @click="load(false)">Загрузить ещё</v-btn></div>
    </template>

    <v-dialog :model-value="selected !== null" max-width="720" scrollable :persistent="saving || dirty" @update:model-value="value => { if (!value) requestClose() }">
      <v-card v-if="selected" class="inbox-editor">
        <v-card-title class="inbox-editor__title"><span>Обращение №{{ selected.id }}</span><button type="button" class="mp-icon-button" aria-label="Закрыть обращение" :disabled="saving" @click="requestClose"><MpIcon name="close" /></button></v-card-title>
        <v-card-text>
          <p class="inbox-editor__author">{{ selected.author.email }} · {{ formatDate(selected.createdAt) }}</p>
          <div class="inbox-editor__context"><span>{{ feedbackCategoryLabels[selected.category] }}</span><span v-if="selected.pagePath">{{ feedbackPageLabel(selected.pagePath) }}</span><span v-if="selected.deviceType">{{ feedbackDeviceLabels[selected.deviceType] }}</span></div>
          <p class="inbox-message">{{ selected.message }}</p>
          <v-divider class="my-6" />
          <v-alert v-if="saveError" type="error" variant="tonal" class="mb-5" role="alert">{{ saveError }}<v-btn v-if="conflict" variant="text" :disabled="saving" @click="discardAction = 'reload'">Загрузить актуальную версию</v-btn></v-alert>
          <v-form id="feedback-admin-form" ref="form" validate-on="submit lazy" @submit.prevent="save">
            <v-select v-model="draftStatus" label="Статус обращения" :items="feedbackStatuses" item-title="title" item-value="value" :disabled="saving || conflict" />
            <v-textarea v-model="draftReply" label="Ответ пользователю" placeholder="Поблагодарите за отзыв и расскажите, что будет дальше." :rules="replyRules" :maxlength="2000" counter="2000" rows="5" :disabled="saving || conflict" hint="Необязательно. Этот текст увидит автор в разделе «Мои обращения»." persistent-hint />
          </v-form>
        </v-card-text>
        <v-card-actions class="inbox-editor__actions"><v-btn variant="text" :disabled="saving" @click="requestClose">Закрыть</v-btn><v-spacer /><v-btn type="submit" form="feedback-admin-form" color="primary" variant="flat" :loading="saving" :disabled="saving || !dirty || conflict">Сохранить</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog :model-value="discardAction !== null" max-width="420" :persistent="saving" @update:model-value="value => { if (!value) discardAction = null }">
      <v-card class="inbox-discard"><v-card-title>{{ discardAction === 'reload' ? 'Загрузить свежую версию?' : 'Закрыть без сохранения?' }}</v-card-title><v-card-text>{{ discardAction === 'reload' ? 'Текущий черновик заменится последними сохранёнными статусом и ответом.' : 'Изменения статуса и ответа не будут сохранены.' }}</v-card-text><v-card-actions><v-btn variant="text" :disabled="saving" @click="discardAction = null">Продолжить работу</v-btn><v-btn color="primary" :loading="saving" @click="confirmDiscard">{{ discardAction === 'reload' ? 'Загрузить' : 'Закрыть' }}</v-btn></v-card-actions></v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useApi } from '~/composables/useApi'
import { useAuthStore } from '~/stores/auth'
import { useUiStore } from '~/stores/ui'
import { errorMessage } from '~/utils/storage'
import { feedbackCategories, feedbackStatuses, feedbackCategoryLabels, feedbackStatusLabels, feedbackDeviceLabels, feedbackPageLabel, type AdminFeedbackItem, type FeedbackCategory, type FeedbackStatus } from '~/utils/feedback'

const auth = useAuthStore()
const ui = useUiStore()
const api = useApi()
const items = ref<AdminFeedbackItem[]>([])
const nextCursor = ref<number | null>(null)
const statusFilter = ref<FeedbackStatus | ''>('new')
const categoryFilter = ref<FeedbackCategory | ''>('')
const loading = ref(false)
const denied = ref(false)
const loadError = ref('')
let loadVersion = 0
const selected = ref<AdminFeedbackItem | null>(null)
const draftStatus = ref<FeedbackStatus>('new')
const draftReply = ref('')
const saving = ref(false)
const saveError = ref('')
const conflict = ref(false)
const discardAction = ref<'close' | 'reload' | null>(null)
const form = ref<{ validate: () => Promise<{ valid: boolean }> }>()
const dirty = computed(() => !!selected.value && (draftStatus.value !== selected.value.status || draftReply.value.trim() !== selected.value.reply))
const replyRules = [(value: string) => value.trim().length <= 2000 || 'Ответ должен быть не длиннее 2000 символов']
const formatDate = (date: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(date))

const load = async (reset: boolean) => {
  if (!reset && (loading.value || nextCursor.value === null)) return
  const version = ++loadVersion
  loading.value = true
  loadError.value = ''
  if (reset) { items.value = []; nextCursor.value = null }
  try {
    const result = await api.getAdminFeedback({ limit: 20, ...(reset ? {} : { cursor: nextCursor.value! }), ...(statusFilter.value ? { status: statusFilter.value } : {}), ...(categoryFilter.value ? { category: categoryFilter.value } : {}) })
    if (version !== loadVersion) return
    denied.value = false
    if (auth.user) auth.user.canManageFeedback = true
    items.value = reset ? result.items : [...items.value, ...result.items.filter(item => !items.value.some(current => current.id === item.id))]
    nextCursor.value = result.nextCursor
  } catch (error) {
    if (version !== loadVersion) return
    if ((error as { status?: number }).status === 403) { denied.value = true; if (auth.user) auth.user.canManageFeedback = false }
    else loadError.value = errorMessage(error, 'Не удалось загрузить отзывы. Попробуйте ещё раз.')
  } finally { if (version === loadVersion) loading.value = false }
}
onMounted(() => load(true))
watch([statusFilter, categoryFilter], () => load(true))
const clearFilters = () => { statusFilter.value = ''; categoryFilter.value = '' }
const openItem = (item: AdminFeedbackItem) => {
  selected.value = item
  draftStatus.value = item.status
  draftReply.value = item.reply
  saveError.value = ''
  conflict.value = false
}
const requestClose = () => {
  if (saving.value) return
  if (dirty.value) discardAction.value = 'close'
  else selected.value = null
}
const confirmDiscard = async () => {
  if (saving.value) return
  if (discardAction.value === 'reload' && selected.value) {
    saving.value = true
    try { openItem(await api.getAdminFeedbackItem(selected.value.id)); discardAction.value = null }
    catch (error) { saveError.value = errorMessage(error); discardAction.value = null }
    finally { saving.value = false }
  } else { selected.value = null; discardAction.value = null }
}
const save = async () => {
  if (saving.value || !selected.value || !dirty.value || conflict.value) return
  saving.value = true
  saveError.value = ''
  try {
    if (!(await form.value?.validate())?.valid) return
    const updated = await api.updateFeedback(selected.value.id, { status: draftStatus.value, reply: draftReply.value.trim(), version: selected.value.version })
    items.value = items.value.map(item => item.id === updated.id ? updated : item).filter(item => (!statusFilter.value || item.status === statusFilter.value) && (!categoryFilter.value || item.category === categoryFilter.value))
    selected.value = null
    ui.notify('Обращение обновлено. Автор увидит статус и ответ в приложении.')
  } catch (error) {
    conflict.value = (error as { status?: number }).status === 409
    saveError.value = conflict.value ? 'Обращение уже изменено в другой вкладке. Загрузите актуальную версию перед сохранением.' : errorMessage(error)
  } finally { saving.value = false }
}
</script>

<style scoped>
.feedback-inbox { max-width: 1180px; margin: 0 auto; }
.inbox-filters { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; align-items: center; gap: 16px; padding: 22px; margin: 28px 0; background: #fff; border: 1px solid var(--border-subtle); border-radius: 18px; }
.inbox-empty { text-align: center; padding: 48px 24px; color: var(--text-secondary); border: 1px dashed #b7c2aa; border-radius: 20px; margin-block: 28px; }
.inbox-empty h2 { font-family: var(--font-display); color: var(--text-strong); font-size: 28px; margin: 16px 0 8px; }
.inbox-empty p { margin-bottom: 20px; }
.inbox-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.inbox-card { border: 1px solid #cdd5c4; border-top: 3px solid #52755a; border-radius: 16px; background: #fff; padding: 22px; min-width: 0; }
.inbox-card__top, .inbox-card__bottom { display: flex; align-items: center; flex-wrap: wrap; justify-content: space-between; gap: 10px; }
.inbox-category { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
.inbox-status { font-size: 12px; font-weight: 600; border: 1px solid #c4d2b8; border-radius: 8px; padding: 4px 9px; background: #edf3e6; color: #345343; }
.inbox-status[data-status="new"] { border-color: #ddbb9e; background: #fff2e7; color: #8b4a27; }
.inbox-status[data-status="closed"] { border-color: #d8d9d4; background: #f4f4f1; color: #566151; }
.inbox-card h2 { font-size: 18px; margin: 18px 0 12px; }
.inbox-card h2 button { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; text-align: left; color: var(--text-strong); }
.inbox-message-preview { white-space: pre-wrap; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; font-size: 14px; line-height: 1.7; margin-bottom: 18px; }
.inbox-card__bottom { color: var(--text-secondary); font-size: 12px; overflow-wrap: anywhere; }
.inbox-card__bottom span { min-width: 0; }
.inbox-open { margin-top: 18px; font-size: 14px; font-weight: 600; color: var(--color-primary); text-decoration: underline; text-underline-offset: 4px; }
.inbox-pagination { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; margin-top: 24px; font-size: 13px; color: var(--text-secondary); }
.inbox-editor { border-radius: 20px !important; }
.inbox-editor__title { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-family: var(--font-display); font-size: 27px; white-space: normal; padding: 24px 26px 12px; }
.inbox-editor__author { font-size: 13px; color: var(--text-secondary); overflow-wrap: anywhere; margin-bottom: 12px; }
.inbox-editor__context { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
.inbox-editor__context span { font-size: 12px; color: #705331; background: #faf1de; border: 1px solid #e2d0a9; border-radius: 6px; padding: 4px 8px; }
.inbox-message { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.75; font-size: 15px; }
.inbox-editor__actions { padding: 16px 24px 22px; flex-wrap: wrap; }
.inbox-discard { padding: 14px; border-radius: 18px !important; }
.inbox-discard :deep(.v-card-title) { white-space: normal; }
.inbox-discard :deep(.v-card-actions) { flex-wrap: wrap; justify-content: flex-end; }
@media (max-width: 760px) { .inbox-list { grid-template-columns: minmax(0, 1fr); } .inbox-filters { grid-template-columns: minmax(0, 1fr); padding: 18px; } .inbox-card { padding: 18px; } .inbox-editor__title { font-size: 23px; padding-inline: 20px; } }
</style>
