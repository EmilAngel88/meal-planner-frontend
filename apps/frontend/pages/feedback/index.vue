<template>
  <div class="feedback-page">
    <header class="mp-page-head">
      <div class="mp-page-head__meta"><span class="mp-overline">Развиваем Рацион вместе</span><h1 class="mp-page-title">Обратная связь</h1><p class="mp-page-subtitle">Ваши идеи, замечания и ответы команды — в одном месте.</p></div>
      <v-btn color="primary" @click="openFeedback()"><MpIcon name="plus" :size="18" class="mr-2" />Написать отзыв</v-btn>
    </header>
    <div class="feedback-note"><span class="feedback-note__mark" aria-hidden="true"><MpIcon name="leaf" :size="24" /></span><p>Расскажите, что получается легко, а где приходится разбираться. Отзывы видны только вам и команде Рациона. Ответы и изменения статуса появятся здесь.</p></div>
    <section aria-labelledby="feedback-history-title" class="feedback-history">
      <div class="feedback-history__heading"><h2 id="feedback-history-title">Мои обращения</h2><v-btn variant="text" size="small" :loading="refreshing" :disabled="loadingMore || refreshing" @click="load(true)">Обновить</v-btn></div>
      <div v-if="initialLoading" class="feedback-loading" role="status" aria-live="polite"><v-progress-circular indeterminate color="primary" size="26" /><span>Загружаем отзывы…</span></div>
      <v-alert v-if="loadError" type="error" variant="tonal" role="alert" class="feedback-load-error">{{ loadError }} <v-btn variant="text" :disabled="refreshing || loadingMore" @click="load(errorWasMore ? false : true)">Повторить</v-btn></v-alert>
      <div v-if="!initialLoading && !loadError && !items.length" class="feedback-empty"><span class="feedback-empty__symbol" aria-hidden="true">↗</span><h3>Начнём с вашего впечатления</h3><p>Что было удобно, а что хотелось бы изменить? Первый отзыв можно написать в пару предложений.</p><v-btn variant="tonal" color="primary" @click="openFeedback()">Написать первый отзыв</v-btn></div>
      <div v-if="items.length" class="feedback-list">
        <article v-for="item in items" :key="item.id" class="feedback-item" :aria-label="`${feedbackCategoryLabels[item.category]}, отзыв №${item.id}`">
          <header class="feedback-item__header"><span class="feedback-kind" :class="`feedback-kind--${item.category}`">{{ feedbackCategoryLabels[item.category] }}</span><span class="feedback-status" :class="`feedback-status--${item.status}`">{{ feedbackStatusLabels[item.status] }}</span><time :datetime="item.createdAt">{{ formatDate(item.createdAt) }}</time></header>
          <p class="feedback-item__message">{{ item.message }}</p>
          <div v-if="item.pagePath || item.deviceType" class="feedback-item__context"><span v-if="item.pagePath">{{ feedbackPageLabel(item.pagePath) }}</span><span v-if="item.deviceType">{{ feedbackDeviceLabels[item.deviceType] }}</span></div>
          <div v-if="item.reply" class="feedback-reply"><h3><MpIcon name="leaf" :size="16" />Ответ команды</h3><p>{{ item.reply }}</p></div>
          <footer class="feedback-item__footer">Отзыв №{{ item.id }}<span v-if="item.updatedAt !== item.createdAt"> · Обновлён {{ formatDate(item.updatedAt) }}</span></footer>
        </article>
      </div>
      <div v-if="nextCursor !== null" class="feedback-more"><v-btn variant="outlined" color="primary" :loading="loadingMore" :disabled="refreshing" @click="load(false)">Показать предыдущие</v-btn></div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useState } from '#imports'
import { useApi } from '~/composables/useApi'
import { useFeedbackComposer } from '~/composables/useFeedbackComposer'
import { errorMessage } from '~/utils/storage'
import { feedbackCategoryLabels, feedbackDeviceLabels, feedbackPageLabel, feedbackStatusLabels, type FeedbackItem } from '~/utils/feedback'

const api = useApi()
const { openFeedback } = useFeedbackComposer()
const revision = useState<number>('feedback:revision', () => 0)
const items = ref<FeedbackItem[]>([])
const nextCursor = ref<number | null>(null)
const initialLoading = ref(true)
const refreshing = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const errorWasMore = ref(false)
let sequence = 0
const formatDate = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
const load = async (reset: boolean) => {
  if (!reset && (loadingMore.value || refreshing.value || nextCursor.value === null)) return
  const requestSequence = ++sequence
  refreshing.value = reset
  loadingMore.value = !reset
  loadError.value = ''
  try {
    const page = await api.getFeedback({ limit: 20, ...(reset ? {} : { cursor: nextCursor.value! }) })
    if (requestSequence !== sequence) return
    const seen = new Set(items.value.map(item => item.id))
    items.value = reset ? page.items : [...items.value, ...page.items.filter(item => !seen.has(item.id))]
    nextCursor.value = page.nextCursor
  } catch (error) {
    if (requestSequence !== sequence) return
    loadError.value = errorMessage(error, 'Не удалось загрузить отзывы. Попробуйте ещё раз.')
    errorWasMore.value = !reset
  } finally {
    if (requestSequence === sequence) { initialLoading.value = false; refreshing.value = false; loadingMore.value = false }
  }
}
onMounted(() => load(true))
watch(revision, () => load(true))
</script>

<style scoped>
.feedback-page { max-width: 1050px; }
.feedback-note { display: flex; align-items: center; gap: 17px; background: var(--color-honey-soft); border: 1px solid #d9c696; border-radius: 18px 18px 18px 5px; padding: 21px 24px; }
.feedback-note__mark { flex-shrink: 0; display: flex; color: var(--color-honey); }
.feedback-note p { margin: 0; font-size: 14px; line-height: 1.7; color: var(--text-secondary); max-width: 730px; }
.feedback-history { margin-top: 34px; }
.feedback-history__heading { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 18px; }
.feedback-history__heading h2 { font: 400 27px/1.2 var(--font-display); color: var(--text-strong); }
.feedback-loading { min-height: 200px; display: flex; gap: 12px; align-items: center; justify-content: center; font-size: 14px; color: var(--text-secondary); }
.feedback-load-error { margin-bottom: 18px; overflow-wrap: anywhere; }
.feedback-empty { border: 1px dashed var(--border-strong); border-radius: 20px; padding: 35px; text-align: center; background: #f0f3e9; }
.feedback-empty__symbol { display: block; color: var(--color-primary); font: 40px/1 var(--font-display); margin-bottom: 14px; }
.feedback-empty h3 { font: 400 27px/1.2 var(--font-display); color: var(--text-strong); }
.feedback-empty p { max-width: 490px; margin: 14px auto 23px; font-size: 14px; line-height: 1.7; color: var(--text-secondary); }
.feedback-list { display: grid; gap: 18px; }
.feedback-item { border: 1px solid var(--border-strong); background: #fff; border-radius: 19px; padding: 24px; min-width: 0; }
.feedback-item__header { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.feedback-kind, .feedback-status { display: inline-flex; padding: 5px 10px; border-radius: 7px; font-size: 12px; line-height: 1.5; }
.feedback-kind { color: var(--color-primary); background: var(--color-primary-soft); font-weight: 600; }
.feedback-kind--bug { color: var(--color-accent); background: var(--color-accent-soft); }
.feedback-kind--other { color: var(--color-lake); background: var(--color-lake-soft); }
.feedback-status { color: var(--text-secondary); border: 1px solid var(--border-subtle); }
.feedback-status--planned { color: var(--color-honey); border-color: #d9c696; background: var(--color-honey-soft); }
.feedback-status--in_progress { color: var(--color-lake); border-color: #b5d0d5; background: var(--color-lake-soft); }
.feedback-status--done { color: var(--color-primary); border-color: #adbf9a; background: var(--color-primary-soft); }
.feedback-status--closed { background: var(--surface-sunken); }
.feedback-item time { margin-left: auto; color: var(--text-secondary); font-size: 12px; }
.feedback-item__message, .feedback-reply p { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.75; font-size: 14px; color: var(--text-body); }
.feedback-item__message { margin: 19px 0 14px; }
.feedback-item__context { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: var(--text-secondary); }
.feedback-item__context span + span::before { content: '·'; margin-right: 8px; }
.feedback-reply { background: var(--color-primary-soft); border-left: 3px solid var(--color-primary); border-radius: 0 10px 10px 0; margin-top: 22px; padding: 16px 18px; }
.feedback-reply h3 { display: flex; align-items: center; gap: 7px; color: var(--color-primary); font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.feedback-reply p { margin: 0; }
.feedback-item__footer { margin-top: 18px; color: var(--text-secondary); font-size: 11px; }
.feedback-more { display: flex; justify-content: center; margin-top: 24px; }
@media (max-width: 600px) { .feedback-note { align-items: flex-start; padding: 18px; gap: 12px; }.feedback-note p { font-size: 13px; }.feedback-item { padding: 18px; }.feedback-item time { flex-basis: 100%; margin: 4px 0 0; }.feedback-empty { padding: 26px 18px; }.feedback-reply { padding: 13px; } }
</style>
