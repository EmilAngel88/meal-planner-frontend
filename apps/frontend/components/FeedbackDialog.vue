<template>
  <v-dialog :model-value="open" max-width="650" :persistent="saving" scrollable aria-labelledby="feedback-dialog-title" @update:model-value="value => { if (!value) requestClose() }">
    <v-card class="feedback-dialog">
      <div class="feedback-dialog__heading">
        <div><span class="feedback-eyebrow">Развиваем Рацион вместе</span><h2 id="feedback-dialog-title">{{ sent ? 'Спасибо за отзыв' : 'Что можно улучшить?' }}</h2></div>
        <button type="button" class="mp-icon-button" aria-label="Закрыть отзыв" :disabled="saving" @click="requestClose"><MpIcon name="close" /></button>
      </div>
      <v-card-text>
        <div v-if="sent" class="feedback-success" role="status" aria-live="polite">
          <span class="feedback-success__mark" aria-hidden="true"><MpIcon name="check" :size="28" /></span>
          <h3>Отзыв №{{ sent.id }} получен</h3>
          <p>Ваши наблюдения помогают выбирать, что улучшать дальше. Статус и ответ команды можно посмотреть в разделе «Мои обращения».</p>
          <div class="feedback-actions"><v-btn variant="text" @click="open = false">Продолжить</v-btn><v-btn to="/feedback" color="primary" @click="open = false">Мои обращения</v-btn></div>
        </div>
        <v-form v-else ref="formRef" :disabled="saving" validate-on="submit lazy" @submit.prevent="send">
          <p class="feedback-intro">Заметили ошибку или придумали, как сделать Рацион удобнее? Расскажите — даже небольшая деталь полезна.</p>
          <fieldset class="feedback-categories" :disabled="saving">
            <legend>О чём отзыв?</legend>
            <label v-for="item in feedbackCategories" :key="item.value" class="feedback-category" :class="{ 'feedback-category--selected': category === item.value }">
              <input v-model="category" type="radio" name="feedback-category" :value="item.value">
              <span><strong>{{ item.title }}</strong><small>{{ item.description }}</small></span>
            </label>
          </fieldset>
          <v-textarea v-model="message" label="Ваш отзыв" :placeholder="selectedCategory.placeholder" :rules="[feedbackMessageRule]" rows="5" auto-grow counter="4000" maxlength="4000" :disabled="saving" class="feedback-message" />
          <p class="feedback-privacy">Отзыв виден только вам и команде Рациона. Не указывайте пароли и платёжные данные.</p>
          <div class="feedback-context">
            <v-checkbox v-model="includeContext" :disabled="saving" label="Приложить страницу и тип устройства" hide-details density="compact" />
            <p>{{ contextDescription }} Без параметров ссылки и данных вашего рациона.</p>
          </div>
          <v-alert v-if="sendError" type="error" variant="tonal" role="alert" class="feedback-error">{{ sendError }}<p v-if="retryHint" class="feedback-retry-hint">{{ retryHint }}</p></v-alert>
          <div class="feedback-actions"><v-btn variant="text" :disabled="saving" @click="requestClose">Закрыть</v-btn><v-btn type="submit" color="primary" :loading="saving" :disabled="saving">{{ sendError ? 'Повторить отправку' : 'Отправить отзыв' }}</v-btn></div>
        </v-form>
      </v-card-text>
    </v-card>
  </v-dialog>
  <v-dialog v-model="confirmClose" max-width="440" aria-labelledby="feedback-close-title">
    <v-card class="feedback-close">
      <v-card-title id="feedback-close-title">Продолжить позже?</v-card-title>
      <v-card-text>Черновик останется в этой вкладке до перезагрузки страницы или выхода из аккаунта. Он ещё не отправлен.</v-card-text>
      <v-card-actions><v-btn variant="text" @click="confirmClose = false">Вернуться</v-btn><v-btn color="primary" @click="keepDraft">Сохранить и закрыть</v-btn></v-card-actions>
      <button type="button" class="feedback-discard" @click="discardDraft">Удалить черновик и закрыть</button>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useApi } from '~/composables/useApi'
import { errorMessage } from '~/utils/storage'
import {
  feedbackCategories, feedbackDeviceLabels, feedbackMessageRule, feedbackPageLabel,
  prepareFeedbackSubmission, sanitizeFeedbackPagePath,
  type FeedbackCategory, type FeedbackCreatePayload, type FeedbackDeviceType, type FeedbackItem
} from '~/utils/feedback'

const open = defineModel<boolean>({ default: false })
const props = defineProps<{ pagePath?: string | null; deviceType?: FeedbackDeviceType | null }>()
const emit = defineEmits<{ sent: [feedback: FeedbackItem] }>()
const api = useApi()
const category = ref<FeedbackCategory>('idea')
const message = ref('')
const includeContext = ref(true)
const draftPagePath = ref<string>()
const draftDeviceType = ref<FeedbackDeviceType>()
const saving = ref(false)
const sendError = ref('')
const retryHint = ref('')
const confirmClose = ref(false)
const sent = ref<FeedbackItem | null>(null)
const lastSubmission = ref<FeedbackCreatePayload | null>(null)
const formRef = ref<{ validate: () => Promise<{ valid: boolean }>; resetValidation: () => void }>()
const selectedCategory = computed(() => feedbackCategories.find(item => item.value === category.value)!)
const contextDescription = computed(() => [draftPagePath.value ? `Страница: «${feedbackPageLabel(draftPagePath.value)}».` : '', draftDeviceType.value ? `Устройство: ${feedbackDeviceLabels[draftDeviceType.value].toLocaleLowerCase('ru-RU')}.` : ''].filter(Boolean).join(' '))

const captureContext = () => {
  draftPagePath.value = props.pagePath ? sanitizeFeedbackPagePath(props.pagePath) : undefined
  draftDeviceType.value = props.deviceType ?? undefined
}
const resetDraft = () => {
  category.value = 'idea'
  message.value = ''
  includeContext.value = true
  lastSubmission.value = null
  sendError.value = ''
  retryHint.value = ''
  formRef.value?.resetValidation()
}
watch(open, async value => {
  if (!value) { confirmClose.value = false; return }
  if (!message.value) { sent.value = null; captureContext() }
  await nextTick()
  formRef.value?.resetValidation()
})
const requestClose = () => {
  if (saving.value) return
  if (!sent.value && message.value.trim()) confirmClose.value = true
  else open.value = false
}
const keepDraft = () => { confirmClose.value = false; open.value = false }
const discardDraft = () => { resetDraft(); confirmClose.value = false; open.value = false }
const send = async () => {
  if (saving.value) return
  saving.value = true
  sendError.value = ''
  retryHint.value = ''
  try {
    if (!(await formRef.value?.validate())?.valid) return
    lastSubmission.value = prepareFeedbackSubmission({
      category: category.value, message: message.value,
      ...(includeContext.value ? { pagePath: draftPagePath.value, deviceType: draftDeviceType.value } : {})
    }, lastSubmission.value)
    const feedback = await api.createFeedback(lastSubmission.value)
    resetDraft()
    sent.value = feedback
    emit('sent', feedback)
  } catch (error) {
    sendError.value = errorMessage(error, 'Не удалось подтвердить отправку. Текст сохранён — попробуйте ещё раз.')
    const response = error as { status?: number; statusCode?: number; data?: { retryAfterSeconds?: number } }
    const status = response.status || response.statusCode
    if (status === 429) {
      const seconds = response.data?.retryAfterSeconds
      retryHint.value = typeof seconds === 'number' && seconds > 0 ? `Повторите примерно через ${Math.ceil(seconds / 60)} мин. Черновик сохранён.` : 'Подождите немного и отправьте снова. Черновик сохранён.'
    } else if (!status || status >= 500) retryHint.value = 'Повторная отправка того же текста не создаст второй отзыв.'
  } finally { saving.value = false }
}
</script>

<style scoped>
.feedback-dialog { padding: 24px 8px 10px; border: 1px solid var(--border-strong); }
.feedback-dialog__heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; padding: 0 24px 14px; }
.feedback-dialog__heading > div { min-width: 0; }
.feedback-eyebrow { display: inline-block; font-size: 11px; font-weight: 600; color: var(--color-accent); margin-bottom: 8px; }
.feedback-dialog h2 { margin: 0; color: var(--text-strong); font: 400 29px/1.2 var(--font-display); overflow-wrap: anywhere; }
.feedback-dialog :deep(.v-card-text) { padding: 8px 24px 16px; }
.feedback-intro, .feedback-success p { margin: 0 0 23px; color: var(--text-secondary); font-size: 14px; line-height: 1.7; }
.feedback-categories { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; border: 0; padding: 0; margin: 0 0 25px; min-width: 0; }
.feedback-categories legend { margin-bottom: 10px; color: var(--text-strong); font-size: 13px; font-weight: 600; }
.feedback-category { display: flex; align-items: flex-start; gap: 8px; border: 1px solid var(--border-strong); border-radius: 12px; padding: 12px 10px; cursor: pointer; background: #fff; min-width: 0; }
.feedback-category--selected { border-color: var(--color-primary); background: var(--color-primary-soft); box-shadow: inset 0 0 0 1px var(--color-primary); }
.feedback-category:has(input:focus-visible) { outline: 2px solid var(--color-primary); outline-offset: 3px; }
.feedback-category input { margin-top: 4px; flex-shrink: 0; accent-color: var(--color-primary); }
.feedback-category strong { display: block; font-size: 13px; font-weight: 600; color: var(--text-strong); }
.feedback-category small { display: block; margin-top: 3px; color: var(--text-secondary); font-size: 11px; line-height: 1.45; }
.feedback-message { margin-bottom: 2px; }
.feedback-privacy { margin: 0 0 18px; color: var(--text-secondary); font-size: 12px; line-height: 1.6; }
.feedback-context { border: 1px solid #d9c696; background: var(--color-honey-soft); border-radius: 12px; padding: 8px 12px 12px; margin-bottom: 24px; }
.feedback-context :deep(.v-label) { opacity: 1; color: var(--text-body); font-size: 13px; white-space: normal; }
.feedback-context p { margin: 2px 0 0 40px; color: var(--text-secondary); font-size: 12px; line-height: 1.6; }
.feedback-actions { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
.feedback-error { margin-bottom: 18px; font-size: 13px; overflow-wrap: anywhere; }
.feedback-retry-hint { margin-top: 8px; font-size: 12px; }
.feedback-success { padding: 10px 0 0; }
.feedback-success__mark { display: inline-flex; justify-content: center; align-items: center; width: 56px; height: 56px; border: 1px solid #a7bd89; border-radius: 18px 18px 18px 5px; background: var(--color-primary-soft); color: var(--color-primary); margin-bottom: 18px; }
.feedback-success h3 { font-size: 19px; font-weight: 500; color: var(--text-strong); margin-bottom: 12px; }
.feedback-close { padding: 14px 8px; }
.feedback-close :deep(.v-card-title) { white-space: normal; font-family: var(--font-display); font-size: 25px; color: var(--text-strong); }
.feedback-close :deep(.v-card-text) { font-size: 14px; line-height: 1.7; color: var(--text-secondary); }
.feedback-close :deep(.v-card-actions) { justify-content: flex-end; flex-wrap: wrap; gap: 6px; }
.feedback-discard { align-self: flex-end; margin: 14px 16px 5px; border: 0; background: transparent; color: var(--color-accent); font-size: 12px; text-decoration: underline; text-underline-offset: 3px; }
@media (max-width: 520px) {
  .feedback-dialog { padding: 18px 0 8px; }
  .feedback-dialog__heading { padding-inline: 16px; gap: 6px; }
  .feedback-dialog :deep(.v-card-text) { padding-inline: 16px; }
  .feedback-dialog h2 { font-size: 25px; }
  .feedback-categories { grid-template-columns: 1fr; gap: 7px; }
  .feedback-category { padding: 10px 12px; align-items: center; }
  .feedback-category input { margin-top: 0; }
  .feedback-category span { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 10px; }
  .feedback-category small { margin-top: 0; }
  .feedback-context { padding-inline: 6px; }
  .feedback-context p { margin-left: 38px; }
  .feedback-actions { gap: 7px; }
}
@media (max-width: 360px) { .feedback-actions { align-items: stretch; flex-direction: column-reverse; }.feedback-actions > * { width: 100%; } }
</style>
