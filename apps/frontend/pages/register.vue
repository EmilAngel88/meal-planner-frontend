<template>
  <div class="access-page">
    <section class="access-story" aria-labelledby="start-title">
      <div>
        <span class="access-eyebrow">План, в котором есть место вам</span>
        <h2 id="start-title">Хорошая неделя<br> начинается<br> <em>с простого.</em></h2>
        <p>Задайте цель, выберите блюда и отправляйтесь за продуктами с готовым списком.</p>
      </div>
      <ol class="access-steps" aria-label="Первые шаги в Рационе">
        <li><span>01</span><div>Задайте ориентир<small>Рассчитайте цель или укажите свою</small></div></li>
        <li><span>02</span><div>Соберите неделю<small>Настройте блюда и приёмы пищи</small></div></li>
        <li><span>03</span><div>Подготовьте покупки<small>Ингредиенты соберутся в один список</small></div></li>
      </ol>
    </section>

    <section class="access-form" aria-labelledby="register-title">
      <span class="mp-overline">Добро пожаловать в Рацион</span>
      <h1 id="register-title">Начнём с вас.</h1>
      <p class="access-description">Создайте аккаунт, чтобы сохранять свою цель, рецепты и планы питания.</p>
      <v-alert v-if="submitError" type="error" variant="tonal" class="mb-6" role="alert">{{ submitError }}</v-alert>
      <v-form ref="form" validate-on="submit lazy" @submit.prevent="submit">
        <v-text-field v-model="email" label="Email" type="email" autocomplete="email" inputmode="email" :rules="emailRules" :disabled="loading" required />
        <v-text-field v-model="password" class="mt-2" label="Придумайте пароль" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" :rules="passwordRules" hint="Не менее 8 символов" persistent-hint :disabled="loading" required>
          <template #append-inner>
            <button class="password-toggle" type="button" :aria-label="showPassword ? 'Скрыть пароль' : 'Показать пароль'" :aria-pressed="showPassword" :disabled="loading" @click="showPassword = !showPassword">{{ showPassword ? 'Скрыть' : 'Показать' }}</button>
          </template>
        </v-text-field>
        <v-btn :loading="loading" :disabled="loading" color="primary" type="submit" block size="large" class="mt-5">Создать аккаунт <span class="access-arrow" aria-hidden="true">↗</span></v-btn>
      </v-form>
      <p class="access-switch">Уже с нами? <NuxtLink :to="loginLink">Войти</NuxtLink></p>
      <div class="access-footnote"><span aria-hidden="true">✳</span> После регистрации настроим вашу первую цель.</div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { errorMessage } from '~/utils/storage'

const auth = useAuthStore()
const route = useRoute()
const form = ref<{ validate: () => Promise<{ valid: boolean }> }>()
const email = ref('')
const password = ref('')
const loading = ref(false)
const showPassword = ref(false)
const submitError = ref('')
const redirect = computed(() => {
  const value = route.query.redirect
  return typeof value === 'string' && /^\/(?!\/)/.test(value) && !/[\\\r\n]/.test(value) && !/^\/(login|register)(?:[/?#]|$)/.test(value) ? value : ''
})
const loginLink = computed(() => ({ path: '/login', query: redirect.value ? { redirect: redirect.value } : {} }))
const emailRules = [(value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || 'Введите email, например name@example.com']
const passwordRules = [
  (value: string) => value.length >= 8 || 'В пароле должно быть не менее 8 символов',
  (value: string) => new TextEncoder().encode(value).length <= 72 || 'Пароль слишком длинный. Используйте более короткий пароль.'
]
const submit = async () => {
  if (loading.value) return
  loading.value = true
  submitError.value = ''
  try {
    if (!(await form.value?.validate())?.valid) return
    await auth.register(email.value.trim(), password.value)
    await navigateTo(redirect.value || '/account')
  } catch (error) {
    submitError.value = errorMessage(error, 'Не удалось создать аккаунт. Проверьте соединение и попробуйте ещё раз.')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.access-page { display: grid; grid-template-columns: 1.1fr 1fr; max-width: 1192px; min-height: 650px; margin: 0 auto; padding: 12px 24px 44px; gap: clamp(40px, 7vw, 108px); align-items: center; }
.access-story { align-self: stretch; background: #264b3f; color: #f7f8f2; padding: clamp(30px, 4vw, 58px); border-radius: 28px; display: flex; flex-direction: column; justify-content: space-between; gap: 60px; }
.access-eyebrow { display: inline-block; color: #dce8ad; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; }
.access-story h2 { margin: 32px 0 26px; font-family: Georgia, 'Times New Roman', serif; font-weight: 400; font-size: clamp(42px, 4.7vw, 65px); letter-spacing: -.04em; line-height: 1.06; }
.access-story h2 em { font-weight: 400; color: #dce8ad; }
.access-story p { max-width: 330px; font-size: 15px; line-height: 1.8; color: #d0ddd4; }
.access-steps { list-style: none; padding: 0; margin: 0; display: grid; gap: 17px; }
.access-steps li { display: flex; align-items: baseline; gap: 18px; padding-top: 16px; border-top: 1px solid #ffffff24; font-size: 14px; }
.access-steps li > span { font-size: 11px; color: #b7c5b2; font-variant-numeric: tabular-nums; }
.access-steps small { display: block; color: #b9ccbf; font-size: 11px; margin-top: 2px; }
.access-form { padding: 25px 12px 25px 0; max-width: 410px; width: 100%; }
.access-form h1 { font-family: Georgia, 'Times New Roman', serif; font-size: clamp(36px, 3.5vw, 47px); font-weight: 400; letter-spacing: -.035em; line-height: 1.15; margin: 15px 0; color: #264b3f; }
.access-description { line-height: 1.7; color: var(--text-secondary, #6e776d); margin-bottom: 32px; max-width: 330px; font-size: 14px; }
.password-toggle { color: #526958; font-size: 11px; padding: 9px 2px 9px 9px; border-radius: 4px; }
.password-toggle:focus-visible { outline: 2px solid #264b3f; outline-offset: 2px; }
.access-arrow { position: absolute; right: 18px; font-size: 21px; font-weight: 400; }
.access-switch { margin: 28px 0 0; text-align: center; font-size: 13px; color: var(--text-secondary); }
.access-switch a { color: #264b3f; font-weight: 600; text-decoration: underline; text-underline-offset: 4px; margin-left: 4px; }
.access-footnote { border-top: 1px solid #dfe5d9; color: var(--text-secondary); font-size: 11px; margin-top: 58px; padding-top: 23px; display: flex; align-items: center; gap: 12px; }
.access-footnote span { color: var(--text-secondary); font-size: 26px; }
@media (max-width: 760px) {
  .access-page { grid-template-columns: 1fr; min-height: auto; gap: 28px; padding: 0 0 20px; max-width: 520px; }
  .access-story { border-radius: 20px; padding: 26px; gap: 0; }
  .access-story h2 { font-size: 33px; margin: 16px 0 14px; }
  .access-story h2 br { display: none; }
  .access-story h2 br::after { content: ' '; }
  .access-story p { font-size: 12px; max-width: none; line-height: 1.65; }
  .access-eyebrow { font-size: 12px; }
  .access-steps { display: none; }
  .access-form { padding: 0 5px; max-width: none; }
  .access-form h1 { font-size: 34px; margin: 10px 0; }
  .access-description { margin-bottom: 23px; }
  .access-footnote { margin-top: 32px; }
}
</style>
