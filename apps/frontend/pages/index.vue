<template>
  <div class="overview">
    <div class="mp-page-head">
      <div class="mp-page-head__meta"><span class="mp-overline">Еда в вашем ритме</span><h1 class="mp-page-title">Пусть неделя будет легче.</h1><p class="mp-page-subtitle">Немного планирования — и больше времени на всё остальное.</p></div>
      <NuxtLink to="/account" class="overview-goal-link"><MpIcon name="target" :size="17" />Моя цель<MpIcon name="chevron-right" :size="15" /></NuxtLink>
    </div>
    <v-progress-linear v-if="loading" indeterminate color="primary" aria-label="Загружаем ваш обзор" class="mb-6" />
    <v-alert v-if="error" type="error" variant="tonal" class="mb-6">{{ error }}<v-btn variant="text" @click="load">Повторить</v-btn></v-alert>
    <template v-if="!loading && !error">
      <section class="overview-hero" :class="{ 'overview-hero--ready': plan }">
        <div class="overview-hero__copy"><span class="overview-eyebrow"><span />{{ !profile?.calories ? 'Начнём с вас' : plan ? 'Ваш план под рукой' : 'Всё готово к первому меню' }}</span>
          <h2>{{ !profile?.calories ? 'У каждого свой ритм.\nНайдём ваш.' : plan ? 'Меньше «что приготовить?».\nБольше свободного времени.' : 'Ваша неделя.\nУже почти готова.' }}</h2>
          <p>{{ !profile?.calories ? 'Укажите свою цель. Мы поможем рассчитать порции и собрать меню из привычных продуктов.' : plan ? `Меню на ${plan.daysCount} дней сохранено. Блюда, состав порций и список покупок — всё в одном месте.` : 'Выберите дату начала. Подберём блюда под вашу цель и соберём продукты в один список.' }}</p>
          <v-btn :to="!profile?.calories ? '/account' : plan ? `/menu?plan=${plan.id}` : '/menu?new=1'" class="overview-hero__button" variant="flat" size="large">{{ !profile?.calories ? 'Настроить мою цель' : plan ? 'Открыть мою неделю' : 'Составить первую неделю' }}<MpIcon name="arrow-right" :size="18" /></v-btn>
          <span v-if="plan && profile?.calories" class="overview-hero__footnote">{{ planDateLabel(plan) }}</span>
          <span v-else class="overview-hero__footnote">6 дней по плану · 1 день для себя</span>
        </div>
        <div class="overview-illustration" aria-hidden="true">
          <div class="overview-orbit overview-orbit--one" /><div class="overview-orbit overview-orbit--two" />
          <div class="overview-plate"><div class="overview-plate__rim"><svg viewBox="0 0 240 240" fill="none"><path d="M49 109c-22-27-5-62 22-49 2-35 46-40 53-11 36-16 51 23 26 41 28 20 13 58-13 51 4 31-42 41-52 13-25 13-47-17-36-45Z" fill="#839e57"/><path d="M48 87c36 10 66 27 84 59M80 53l7 52 54-28M59 128l39-13" stroke="#bbcb8b" stroke-width="3" stroke-linecap="round"/><path d="M118 162c14-41 55-58 75-19 9 18-3 36-19 45-20 12-64 1-56-26Z" fill="#dfa57b"/><path d="m143 145 33 28m-40-12 20 20m3-48 24 24" stroke="#bf8159" stroke-width="4" stroke-linecap="round"/><circle cx="167" cy="84" r="25" fill="#e9d898"/><circle cx="167" cy="84" r="18" stroke="#f5ebc4" stroke-width="2"/><path d="m167 67 1 33m-17-19 32 9m-26 6 20-23" stroke="#f5ebc4" stroke-width="2"/><circle cx="79" cy="174" r="16" fill="#b96c4e"/><circle cx="78" cy="173" r="10" stroke="#dba581" stroke-width="2"/><path d="m75 152 6 9 7-8" stroke="#637b49" stroke-width="3" stroke-linecap="round"/></svg></div></div>
          <div class="overview-floating-note"><MpIcon name="check" :size="15" /><span>Место для хороших привычек</span></div>
          <span class="overview-illustration__caption">Просто. Разнообразно. По-вашему.</span>
        </div>
      </section>

      <div class="overview-path" aria-label="Как устроен ваш план">
        <NuxtLink v-for="(step, i) in steps" :key="step.to" :to="step.to" class="overview-step"><span class="overview-step__number" :class="{ 'is-complete': step.done }"><MpIcon v-if="step.done" name="check" :size="16" /><template v-else>0{{ i + 1 }}</template></span><span><strong>{{ step.title }}</strong><small>{{ step.caption }}</small></span><MpIcon name="chevron-right" :size="17" /></NuxtLink>
      </div>

      <div class="overview-columns">
        <section class="overview-day mp-panel">
          <div class="overview-section-head"><div><span class="mp-overline">{{ activeDay === null ? 'Ближайший взгляд' : 'Сегодня по плану' }}</span><h2>{{ plan ? activeDay === null ? 'Первый день меню' : 'Что приготовим сегодня' : 'Здесь будет ваш день' }}</h2></div><NuxtLink v-if="plan" :to="`/menu?plan=${plan.id}&day=${activeDay ?? 0}`" class="overview-text-link">Весь день <MpIcon name="arrow-right" :size="16" /></NuxtLink></div>
          <template v-if="plan">
            <p v-if="activeDay === null" class="overview-day__hint">Это сохранённое меню на {{ planDateLabel(plan).toLowerCase() }}.</p>
            <div class="overview-meals"><NuxtLink v-for="(meal, i) in meals" :key="meal.index" :to="`/menu?plan=${plan.id}&day=${activeDay ?? 0}`" class="overview-meal"><span class="overview-meal__icon" :class="`overview-meal__icon--${i % 3}`"><MpIcon :name="i === 0 ? 'sun' : i === 1 ? 'leaf' : 'book'" :size="22" /></span><div><span>{{ meal.title }}</span><h3>{{ meal.items.map(item => item.title).join(' + ') }}</h3></div><span class="overview-meal__calories">{{ Math.round(meal.items.reduce((sum, item) => sum + item.calories, 0)).toLocaleString('ru-RU') }}<small>ккал</small></span></NuxtLink></div>
            <div class="overview-day__total"><span>Итого за день</span><strong>{{ Math.round(dayCalories).toLocaleString('ru-RU') }} <small>ккал</small></strong></div>
          </template>
          <div v-else class="overview-day-empty"><span class="overview-day-empty__icon"><MpIcon name="calendar" :size="38" /></span><h3>Ответ на ежедневный вопрос</h3><p>После составления меню здесь появятся блюда и порции. Не нужно придумывать всё заново.</p><v-btn :to="profile?.calories ? '/menu?new=1' : '/account'" variant="outlined">{{ profile?.calories ? 'Составить меню' : 'Начать с моей цели' }}<MpIcon name="arrow-right" :size="16" /></v-btn></div>
        </section>
        <aside class="overview-aside">
          <section class="overview-target"><div class="overview-section-head"><span class="mp-overline">Ваш ориентир</span><MpIcon name="target" :size="22" /></div><template v-if="profile?.calories"><div class="overview-target__value">{{ Math.round(profile.calories).toLocaleString('ru-RU') }}<span>ккал в день</span></div><p>{{ goalLabel }} · цель для планирования</p></template><template v-else><h2>Всё начинается<br>с вашей цели</h2><p>Рассчитайте ориентир или задайте калории вручную.</p></template><NuxtLink to="/account" class="overview-text-link">{{ profile?.calories ? 'Посмотреть настройки' : 'Настроить цель' }}<MpIcon name="arrow-right" :size="16" /></NuxtLink></section>
          <NuxtLink :to="plan ? `/shopping-list?plan=${plan.id}` : '/shopping-list'" class="overview-shopping"><span class="overview-shopping__icon"><MpIcon name="bag" :size="27" /></span><h3>В магазин —<br>с готовым списком.</h3><p>{{ plan ? 'Все ингредиенты меню уже собраны. Осталось проверить, что есть дома.' : 'Соберём ингредиенты, учтём ваши запасы и объединим повторения.' }}</p><span class="overview-text-link">К покупкам<MpIcon name="arrow-right" :size="17" /></span></NuxtLink>
        </aside>
      </div>
      <section class="overview-library"><div><span class="mp-overline">Вдохновение на каждый день</span><h2>Свои рецепты. Знакомые продукты.</h2><p>Соберите библиотеку блюд, которые хочется готовить снова.</p></div><v-btn to="/recipes" variant="outlined">Открыть рецепты<MpIcon name="arrow-right" :size="17" /></v-btn></section>
    </template>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useApi, type MealPlan, type MealPlanItem, type Profile } from '~/composables/useApi'
import { errorMessage } from '~/utils/storage'
import { dayInPlan, relevantPlan, planDateLabel } from '~/utils/plans'
const api = useApi()
const loading = ref(true)
const error = ref('')
const profile = ref<Profile | null>(null)
const plan = ref<MealPlan | null>(null)
const activeDay = computed(() => plan.value ? dayInPlan(plan.value) : null)
const dayItems = computed(() => plan.value?.items.filter(item => item.dayIndex === (activeDay.value ?? 0)) || [])
const dayCalories = computed(() => dayItems.value.reduce((sum, item) => sum + item.calories, 0))
const meals = computed(() => {
  const grouped = new Map<number, { index: number; title: string; items: MealPlanItem[] }>()
  for (const item of dayItems.value) {
    if (!grouped.has(item.mealIndex)) grouped.set(item.mealIndex, { index: item.mealIndex, title: item.mealTitle || 'Приём пищи', items: [] })
    grouped.get(item.mealIndex)!.items.push(item)
  }
  return [...grouped.values()].sort((a, b) => a.index - b.index)
})
const goalLabel = computed(() => ({ loss: 'Снижение веса', maintain: 'Поддержание веса', gain: 'Набор массы' })[profile.value?.goal || 'maintain'])
const steps = computed(() => [
  { to: '/account', title: 'Моя цель', caption: profile.value?.calories ? 'Ориентир сохранён' : 'Подстроим питание под вас', done: !!profile.value?.calories },
  { to: plan.value ? `/menu?plan=${plan.value.id}` : '/menu', title: 'Моя неделя', caption: plan.value ? 'Меню под рукой' : 'Блюда и подходящие порции', done: !!plan.value },
  { to: plan.value ? `/shopping-list?plan=${plan.value.id}` : '/shopping-list', title: 'Мои покупки', caption: plan.value ? 'Список уже собран' : 'Всё нужное в одном списке', done: false }
])
async function load() {
  loading.value = true; error.value = ''
  try {
    const [savedProfile, plans] = await Promise.all([api.getProfile(), api.getMealPlans()])
    const selected = relevantPlan(plans)
    const full = selected ? await api.getMealPlan(selected.id) : null
    profile.value = savedProfile; plan.value = full
  } catch (e) { error.value = errorMessage(e) }
  finally { loading.value = false }
}
onMounted(load)
useHead({ title: 'Обзор — Рацион' })
</script>
<style scoped>
.overview-goal-link,.overview-text-link { display: inline-flex; gap: 8px; align-items: center; font-size: 12px; color: var(--color-primary); font-weight: 500; }
.overview-goal-link { padding: 9px 0; }
.overview-hero { border-radius: 22px; background: #264b3f; color: #fff; padding: 38px 40px; display: grid; grid-template-columns: 1.2fr 1fr; gap: 12px; overflow: hidden; position: relative; }
.overview-eyebrow { display: flex; align-items: center; gap: 8px; color: #dce8ad; font-size: 12px; text-transform: uppercase; letter-spacing: 1.4px; }
.overview-eyebrow > span { width: 5px; height: 5px; border-radius: 50%; background: #dce8ad; }
.overview-hero h2 { font: 400 clamp(28px, 3vw, 40px)/1.2 var(--font-display); letter-spacing: -.7px; margin: 21px 0 16px; white-space: pre-line; }
.overview-hero p { color: #d4dfd1; max-width: 385px; font-size: 13px; line-height: 1.8; margin-bottom: 25px; }
.overview-hero__button { background: #dce8ad !important; color: #264b3f !important; padding-inline: 20px !important; font-weight: 600 !important; }
.overview-hero__footnote { display: block; margin-top: 16px; color: #b6c6b3; font-size: 12px; }
.overview-illustration { position: relative; display: flex; justify-content: center; align-items: center; min-height: 280px; }
.overview-orbit { position: absolute; height: 360px; width: 360px; border: 1px solid #6d8b7245; border-radius: 50%; }
.overview-orbit--two { width: 420px; height: 420px; }
.overview-plate { width: 255px; height: 255px; border-radius: 50%; background: #ebecdf; border: 1px solid #ffffef; padding: 22px; transform: rotate(-13deg); box-shadow: 7px 20px 25px #0e2a273f; position: relative; }
.overview-plate__rim { height: 100%; border: 1px solid #d4d8c5; border-radius: 50%; background: #f7f6ea; box-shadow: inset 1px 2px 10px #737c5710; }
.overview-plate svg { width: 100%; height: 100%; }
.overview-floating-note { position: absolute; right: -2px; bottom: 60px; border: 1px solid #e7ead3; color: #42563a; background: #f8f7e9; padding: 10px 13px; border-radius: 9px; font-size: 12px; display: flex; gap: 7px; align-items: center; transform: rotate(-5deg); box-shadow: 0 5px 15px #102a2720; }
.overview-illustration__caption { position: absolute; bottom: 6px; font-size: 12px; color: #b6c6b3; letter-spacing: .6px; }
.overview-path { display: grid; grid-template-columns: repeat(3,1fr); padding: 25px 0 30px; }
.overview-step { display: flex; align-items: center; gap: 12px; padding: 5px 22px; border-right: 1px solid var(--border-subtle); }
.overview-step:first-child { padding-left: 0; }.overview-step:last-child { border: 0; padding-right: 0; }
.overview-step__number { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 34px; height: 34px; border-radius: 50%; border: 1px solid #d7dece; font-size: 11px; color: var(--text-secondary); }.overview-step__number.is-complete { background: #e9eedb; border-color: #e9eedb; color: var(--color-primary); }
.overview-step strong { display: block; font-weight: 500; font-size: 13px; }.overview-step small { display: block; font-size: 12px; color: var(--text-secondary); margin-top: 2px; }.overview-step > .mp-icon { margin-left: auto; color: var(--text-secondary); }
.overview-columns { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(260px, 1fr); gap: 22px; }
.overview-day { padding: 27px; }.overview-section-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }.overview-section-head h2 { font: 400 23px/1.3 var(--font-display); color: var(--text-strong); margin-top: 7px; }.overview-day__hint { font-size: 11px; color: var(--text-secondary); margin-top: 13px; }
.overview-aside { display: grid; gap: 18px; align-content: start; }.overview-target { border: 1px solid #dce2cc; border-radius: 18px; padding: 24px; background: var(--color-primary-soft); border-top: 3px solid #9db56b; }.overview-target__value { margin-top: 16px; font: 400 43px var(--font-display); color: var(--text-strong); }.overview-target__value span { font: 12px var(--font-sans); padding-left: 9px; color: var(--text-secondary); }.overview-target p { font-size: 11px; color: var(--text-secondary); margin: 8px 0 22px; }.overview-target h2 { font: 400 27px/1.25 var(--font-display); margin: 18px 0 12px; }.overview-target .overview-text-link { font-size: 11px; }
.overview-shopping { position: relative; display: block; padding: 23px; border: 1px solid var(--border-subtle); border-radius: 18px; background: var(--color-accent-soft); border-left: 3px solid var(--color-accent); }.overview-shopping__icon { position: absolute; top: 25px; right: 22px; color: var(--text-secondary); }.overview-shopping h3 { font: 400 24px/1.15 var(--font-display); max-width: 200px; }.overview-shopping p { font-size: 11px; color: var(--text-secondary); line-height: 1.7; margin: 14px 0 17px; max-width: 250px; }.overview-shopping .overview-text-link { font-size: 11px; }
.overview-day-empty { text-align: center; padding: 52px 15px 35px; }.overview-day-empty__icon { display: inline-flex; color: var(--text-secondary); border-radius: 50%; padding: 22px; background: #f1f4e8; margin-bottom: 20px; }.overview-day-empty h3 { font: 400 24px var(--font-display); }.overview-day-empty p { max-width: 300px; font-size: 12px; line-height: 1.8; margin: 15px auto 25px; color: var(--text-secondary); }
.overview-meals { margin-top: 20px; }.overview-meal { display: flex; align-items: center; gap: 14px; padding: 20px 0; border-bottom: 1px solid var(--border-subtle); }.overview-meal__icon { display: inline-flex; flex-shrink: 0; padding: 14px; background: #f5efdf; border-radius: 12px; color: var(--text-secondary); }.overview-meal__icon--1 { background: #eaf0e2; color: var(--text-secondary); }.overview-meal__icon--2 { background: #eef1f0; color: var(--text-secondary); }.overview-meal > div { min-width: 0; }.overview-meal h3 { font-size: 13px; font-weight: 500; margin-top: 5px; overflow-wrap: anywhere; }.overview-meal > div > span { font-size: 12px; color: var(--text-secondary); }.overview-meal__calories { margin-left: auto; padding-left: 5px; font-size: 15px; font-variant-numeric: tabular-nums; }.overview-meal__calories small { display: block; color: var(--text-secondary); font-size: 12px; text-align: right; }.overview-day__total { display: flex; justify-content: space-between; align-items: center; padding-top: 22px; font-size: 12px; }.overview-day__total strong { font-size: 22px; font-weight: 500; }.overview-day__total small { font-size: 11px; color: var(--text-secondary); font-weight: 400; }
.overview-library { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 30px 2px 0; }.overview-library h2 { font: 400 25px var(--font-display); margin: 9px 0; }.overview-library p { font-size: 12px; color: var(--text-secondary); }
@media(max-width: 1150px) { .overview-hero { padding: 30px; grid-template-columns: 1.2fr .8fr; }.overview-plate { width: 210px; height: 210px; }.overview-floating-note { right: -14px; bottom: 58px; font-size: 12px; }.overview-columns { grid-template-columns: minmax(0,1.5fr) minmax(230px,1fr); gap: 16px; }.overview-step { padding-inline: 14px; }.overview-step small { font-size: 12px; }.overview-day { padding: 22px; }.overview-section-head .overview-text-link { font-size: 12px; } }
@media(max-width: 650px) { .overview-goal-link { display: none; }.overview-hero { grid-template-columns: 1fr; padding: 28px; }.overview-hero__copy { z-index: 1; }.overview-hero h2 { font-size: 31px; }.overview-hero p { max-width: 100%; }.overview-illustration { min-height: 210px; margin: 10px 0 0; }.overview-plate { width: 180px; height: 180px; padding: 15px; }.overview-orbit { width: 250px; height: 250px; }.overview-orbit--two { width: 300px; height: 300px; }.overview-floating-note { right: 0; bottom: 34px; }.overview-illustration__caption { bottom: -5px; font-size: 12px; }.overview-path { gap: 8px; padding-block: 20px; }.overview-step { padding: 0 8px !important; flex-direction: column; gap: 8px; align-items: flex-start; }.overview-step:first-child { padding-left: 0 !important; }.overview-step > .mp-icon { display: none; }.overview-step strong { font-size: 11px; }.overview-step small { font-size: 12px; line-height: 1.4; }.overview-columns { grid-template-columns: 1fr; }.overview-section-head h2 { font-size: 21px; }.overview-target, .overview-shopping { padding: 22px; }.overview-library { flex-direction: column; align-items: flex-start; padding-top: 28px; }.overview-library h2 { font-size: 24px; }.overview-day-empty { padding-block: 30px; }.overview-meal { gap: 10px; }.overview-meal__icon { padding: 10px; }.overview-meal h3 { font-size: 12px; } }
</style>
