<template>
  <section id="goal-editor" class="setup" aria-labelledby="setup-title">
    <aside class="setup-rail">
      <span class="mp-overline">Личный ориентир</span>
      <h2>Начнём<br>с вас.</h2>
      <p>Несколько вопросов о том, как вы живёте сейчас.</p>
      <ol class="setup-steps" aria-label="Этапы настройки">
        <li v-for="(step, index) in steps" :key="step" :class="{ active: index === stepIndex, done: index < stepIndex }">
          <button type="button" :disabled="index >= stepIndex || busy" :aria-current="index === stepIndex ? 'step' : undefined" @click="goTo(index)"><span>{{ index < stepIndex ? '✓' : String(index + 1).padStart(2, '0') }}</span>{{ stepLabels[step] }}</button>
        </li>
      </ol>
      <small>Ответы сохранятся только после вашего подтверждения.</small>
    </aside>

    <div class="setup-content">
      <div class="setup-topline"><span>Шаг {{ stepIndex + 1 }} из {{ steps.length }}</span><button v-if="canCancel" type="button" :disabled="busy" class="setup-link" @click="emit('cancel')">Отменить</button></div>
      <div class="setup-progress" aria-hidden="true"><span :style="{ width: `${(stepIndex + 1) / steps.length * 100}%` }" /></div>
      <h2 id="setup-title" ref="stepTitle" tabindex="-1">{{ titles[activeStep] }}</h2>
      <p class="setup-lead">{{ descriptions[activeStep] }}</p>
      <v-form :key="activeStep" ref="form" :disabled="busy" validate-on="submit lazy" @submit.prevent="advance">
        <fieldset class="setup-fields" :disabled="busy">
          <template v-if="activeStep === 'intent'">
            <fieldset class="setup-group"><legend>Что для вас сейчас важно?</legend>
              <div class="setup-intents">
                <label v-for="item in goalOptions" :key="item.value" class="choice choice-intent" :class="{ selected: draft.goal === item.value }">
                  <input v-model="draft.goal" type="radio" name="goal" :value="item.value">
                  <span class="choice-symbol" aria-hidden="true">{{ item.symbol }}</span><strong>{{ item.title }}</strong><small>{{ item.text }}</small>
                </label>
              </div>
            </fieldset>
            <fieldset class="setup-group"><legend>Как определим норму?</legend>
              <div class="setup-methods">
                <label class="choice" :class="{ selected: draft.mode === 'calculated' }"><input v-model="draft.mode" type="radio" name="mode" value="calculated"><span><strong>Рассчитать по моим данным</strong><small>Параметры тела, повседневная активность и тренировки</small></span><span class="choice-dot" aria-hidden="true" /></label>
                <label class="choice" :class="{ selected: draft.mode === 'manual' }"><input v-model="draft.mode" type="radio" name="mode" value="manual"><span><strong>У меня уже есть норма</strong><small>Например, вы определили её со специалистом</small></span><span class="choice-dot" aria-hidden="true" /></label>
              </div>
            </fieldset>
            <p v-if="draft.mode === 'calculated'" class="setup-note">Расчёт предназначен для взрослых. При беременности, грудном вскармливании или лечебной диете используйте индивидуальную норму от специалиста.</p>
            <p v-if="profile.calories && !profile.goalSetup" class="setup-note">Ваша прежняя цель — {{ number(profile.calories) }} ккал. Она останется действовать до сохранения. Повседневную активность нужно выбрать заново.</p>
          </template>

          <template v-else-if="activeStep === 'body'">
            <div class="setup-inputs">
              <v-text-field v-model.number="draft.age" label="Возраст" suffix="лет" type="number" inputmode="numeric" min="18" max="120" :rules="ageRules" />
              <v-select v-model="draft.gender" label="Пол" :items="sexes" :rules="requiredRules" />
              <v-text-field v-model.number="draft.height" label="Рост" suffix="см" type="number" inputmode="numeric" min="100" max="250" :rules="heightRules" />
              <v-text-field v-model.number="draft.weight" label="Текущий вес" suffix="кг" type="number" inputmode="decimal" step="0.1" min="20" max="500" :rules="weightRules" />
            </div>
            <button v-if="latestLog" type="button" class="setup-use-weight" @click="draft.weight = latestLog.weight">Взять {{ number(latestLog.weight) }} кг из журнала за {{ dateLabel(latestLog.date) }} <span aria-hidden="true">↗</span></button>
            <div class="setup-aside"><strong>Почему именно эти данные?</strong><p>Возраст, рост, вес и пол используются в формуле расхода энергии в покое. Вес также нужен для расчёта белков и жиров в меню. Вводите фактический вес, а не желаемый.</p></div>
          </template>

          <template v-else-if="activeStep === 'activity'">
            <fieldset class="setup-group"><legend>Как проходит день без тренировок?</legend><div class="setup-choices">
              <label v-for="item in routineOptions" :key="item.value" class="choice" :class="{ selected: draft.routine === item.value }"><input v-model="draft.routine" type="radio" name="routine" :value="item.value"><span><strong>{{ item.title }}</strong><small>{{ item.text }}</small></span><span class="choice-dot" aria-hidden="true" /></label>
            </div></fieldset>
            <fieldset class="setup-group"><legend>Сколько времени занимают тренировки?</legend><p class="setup-hint">Суммарно за обычную неделю: занятия с заметным усилием, например быстрая ходьба, плавание или зал. Уже учтённую выше ходьбу второй раз не добавляйте.</p><div class="setup-choices">
              <label v-for="item in exerciseOptions" :key="item.value" class="choice" :class="{ selected: draft.exercise === item.value }"><input v-model="draft.exercise" type="radio" name="exercise" :value="item.value"><span><strong>{{ item.title }}</strong><small>{{ item.text }}</small></span><span class="choice-dot" aria-hidden="true" /></label>
            </div></fieldset>
            <p class="setup-note">Выбирайте привычную неделю, а не самую активную. При сомнении начните с меньшей нагрузки — ориентир можно уточнить позже.</p>
          </template>

          <template v-else-if="activeStep === 'pace'">
            <fieldset class="setup-group"><legend>{{ draft.goal === 'loss' ? 'Насколько уменьшить калории?' : 'Насколько добавить калорий?' }}</legend><div class="setup-pace">
              <label v-for="pace in paceOptions" :key="pace.value" class="choice pace-choice" :class="{ selected: draft.pace === pace.value }"><input v-model="draft.pace" type="radio" name="pace" :value="pace.value"><span class="pace-choice__top"><strong>{{ pace.title }}</strong><span class="pace-percent">{{ pace.percent }}</span></span><small>{{ pace.text }}</small><span v-if="pace.value === 'gentle'" class="setup-tag">Для первого ориентира</span></label>
            </div></fieldset>
            <div class="setup-aside"><strong>Без обещаний к определённой дате</strong><p>Это изменение от расчётной нормы поддержания. Оно не гарантирует конкретную скорость изменения веса: первый ориентир нужно сверить с вашей реальной динамикой и самочувствием.</p></div>
          </template>

          <template v-else-if="activeStep === 'manual'">
            <div class="setup-inputs">
              <v-text-field v-model.number="draft.calories" label="Известная норма" suffix="ккал / день" type="number" inputmode="numeric" min="1000" max="10000" :rules="calorieRules" />
              <v-text-field v-model.number="draft.weight" label="Текущий вес" suffix="кг" type="number" inputmode="decimal" step="0.1" min="20" max="500" :rules="weightRules" />
            </div>
            <button v-if="latestLog" type="button" class="setup-use-weight" @click="draft.weight = latestLog.weight">Взять {{ number(latestLog.weight) }} кг из журнала за {{ dateLabel(latestLog.date) }}</button>
            <v-checkbox v-model="draft.adultConfirmed" label="Мне 18 лет или больше" :rules="[v => v === true || 'Сервис рассчитан на взрослых от 18 лет']" color="primary" />
            <div class="setup-aside"><strong>Только то, что нужно для меню</strong><p>Сохраним указанное количество калорий без поправки на выбранную цель. Вес нужен для подбора белков и жиров; возраст, рост и активность для этого способа не требуются.</p></div>
          </template>

          <template v-else-if="activeStep === 'review' && estimate">
            <div class="setup-result"><span>{{ draft.mode === 'manual' ? 'Ваша норма на день' : 'Отправная точка на день' }}</span><strong>{{ number(estimate.calories) }} <small>ккал</small></strong><p>{{ selectedGoal }} · {{ draft.mode === 'manual' ? 'указано вами' : 'персональный расчёт' }}</p></div>
            <dl v-if="draft.mode === 'calculated'" class="setup-breakdown">
              <div><dt>Расход в покое</dt><dd>≈ {{ number(estimate.restingCalories!) }} ккал</dd></div>
              <div><dt>С учётом вашего ритма</dt><dd>≈ {{ number(estimate.maintenanceCalories!) }} ккал</dd></div>
              <div><dt>{{ estimate.adjustmentPercent === 0 ? 'Поддержание веса' : draft.goal === 'loss' ? 'Уменьшение от поддержания' : 'Прибавка к поддержанию' }}</dt><dd>{{ estimate.adjustmentPercent > 0 ? '+' : '' }}{{ estimate.adjustmentPercent }}%</dd></div>
            </dl>
            <p v-if="draft.mode === 'calculated'" class="setup-note">Округлили до 50 ккал: расчёт приблизительный, точность до одной калории здесь ничего не даёт.</p>
            <div class="setup-review-answers">
              <div><span>{{ draft.mode === 'manual' ? `${number(draft.weight!)} кг · ваша норма` : `${draft.age} лет · ${draft.height} см · ${number(draft.weight!)} кг · ${draft.gender === 'male' ? 'мужской' : 'женский'}` }}</span><button type="button" class="setup-link" @click="goTo(1)">Изменить</button></div>
              <div v-if="draft.mode === 'calculated'"><span>{{ routineLabel }}<br>{{ exerciseLabel }}</span><button type="button" class="setup-link" @click="goTo(2)">Изменить</button></div>
            </div>
            <div class="setup-aside"><strong>{{ draft.mode === 'calculated' ? 'Дальше — наблюдать и уточнять' : 'Готово для планирования' }}</strong><p>{{ draft.mode === 'calculated' ? 'В ближайшие 2–4 недели отмечайте вес в похожих условиях. Затем оцените тенденцию за несколько измерений, голод и самочувствие. Цель можно пересмотреть; одна запись в журнале её не изменит.' : 'Новые меню будут опираться на эту норму. Если специалист уточнит её, вы сможете изменить значение здесь.' }}</p></div>
            <details v-if="draft.mode === 'calculated'" class="setup-method"><summary>Формула, допущения и источники</summary><p>Формула Миффлина — Сан Жеора оценивает расход в покое. Умножаем его на коэффициент {{ estimate.activityFactor?.toLocaleString('ru-RU') }} для обычного дня и тренировок, затем применяем выбранную поправку.</p><p>Коэффициенты активности — приближённая шкала сервиса, а не измерение обмена веществ. Она не описывает особенности профессионального спорта, заболевания или приём лекарств.</p><p><a href="https://pubmed.ncbi.nlm.nih.gov/2305711/" target="_blank" rel="noopener noreferrer">Исследование формулы</a> · <a href="https://www.fao.org/4/y5686e/y5686e07.htm" target="_blank" rel="noopener noreferrer">FAO: энергия и образ жизни</a></p></details>
            <p class="setup-note">После сохранения цель будет использоваться в новых меню. Уже составленные недели сохранят свои значения.</p>
          </template>
        </fieldset>
        <v-alert v-if="error" type="error" variant="tonal" class="mt-5" role="alert">{{ error }}</v-alert>
        <footer class="setup-footer">
          <v-btn v-if="stepIndex > 0" variant="text" :disabled="busy" @click="goTo(stepIndex - 1)">Назад</v-btn><span v-else class="setup-time">{{ draft.mode === 'manual' ? 'Около минуты' : 'Около 3 минут' }}</span>
          <v-btn type="submit" color="primary" size="large" :loading="busy" :disabled="busy">{{ activeStep === 'review' ? 'Сохранить цель' : nextIsReview ? 'Посмотреть результат' : 'Продолжить' }} <span class="ml-3" aria-hidden="true">{{ activeStep === 'review' ? '✓' : '→' }}</span></v-btn>
        </footer>
      </v-form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useApi, type Profile } from '~/composables/useApi'
import { createGoalDraft, exerciseOptions, goalInput, goalOptions, goalSteps, routineOptions, type GoalEstimate, type GoalInput } from '~/utils/goal'
import { errorMessage } from '~/utils/storage'
const props = defineProps<{ profile: NonNullable<Parameters<typeof createGoalDraft>[0]>; latestLog?: { weight: number; date: string }; canCancel: boolean }>()
const emit = defineEmits<{ saved: [profile: Profile]; cancel: [] }>()
const api = useApi()
const draft = reactive(createGoalDraft(props.profile))
const stepIndex = ref(0)
const steps = computed(() => goalSteps(draft))
const activeStep = computed(() => steps.value[stepIndex.value]!)
const nextIsReview = computed(() => steps.value[stepIndex.value + 1] === 'review')
const stepLabels = { intent: 'Направление', body: 'Параметры', activity: 'Ваш ритм', pace: 'Поправка', manual: 'Ваша норма', review: 'Результат' }
const titles = { intent: 'У каждого свой ритм.', body: 'Немного о вас.', activity: 'Движение — это весь день.', pace: 'Начните с посильного.', manual: 'Ваш знакомый ориентир.', review: 'Вот с чего можно начать.' }
const descriptions = { intent: 'Выберите направление и способ. Остальные вопросы подстроятся под вас.', body: 'Эти данные помогут оценить, сколько энергии нужно вашему телу.', activity: 'Работа, дорога и домашние дела тоже влияют на расход энергии.', pace: 'Выберите небольшое изменение, которое будет удобно поддерживать.', manual: 'Введите норму, которую хотите использовать при составлении меню.', review: 'Проверьте ответы и сохраните цель, когда будете готовы.' }
const estimate = ref<GoalEstimate | null>(null)
const previewedInput = ref<GoalInput | null>(null)
const busy = ref(false)
const error = ref('')
const form = ref<{ validate: () => Promise<{ valid: boolean }> }>()
const stepTitle = ref<HTMLElement>()
const sexes = [{ value: 'female', title: 'Женский' }, { value: 'male', title: 'Мужской' }]
const requiredRules = [(v: unknown) => !!v || 'Выберите значение']
const numericRule = (min: number, max: number, message: string, integer = false) => [(v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max && (!integer || Number.isInteger(v)) || message]
const ageRules = numericRule(18, 120, 'Целое число от 18 до 120 лет', true)
const heightRules = numericRule(100, 250, 'Целое число от 100 до 250 см', true)
const weightRules = numericRule(20, 500, 'От 20 до 500 кг')
const calorieRules = numericRule(1000, 10000, 'Целое число от 1 000 до 10 000', true)
const number = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value)
const dateLabel = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(value))
const selectedGoal = computed(() => goalOptions.find(item => item.value === draft.goal)?.title)
const routineLabel = computed(() => routineOptions.find(item => item.value === draft.routine)?.title)
const exerciseLabel = computed(() => exerciseOptions.find(item => item.value === draft.exercise)?.title)
const paceOptions = computed(() => [
  { value: 'gentle', title: 'Мягкое изменение', percent: draft.goal === 'loss' ? '−10%' : '+5%', text: 'Меньше изменений в привычном питании. Удобный вариант для начала.' },
  { value: 'moderate', title: 'Умеренное изменение', percent: draft.goal === 'loss' ? '−15%' : '+10%', text: 'Более заметная поправка. Следите, чтобы питание оставалось комфортным.' }
])
watch(draft, () => { estimate.value = null; previewedInput.value = null; error.value = '' }, { deep: true, flush: 'sync' })
const focusStep = async () => {
  await nextTick()
  stepTitle.value?.focus({ preventScroll: true })
  document.getElementById('goal-editor')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
}
const goTo = (index: number) => { if (!busy.value && index >= 0 && index < stepIndex.value) { stepIndex.value = index; error.value = ''; void focusStep() } }
const advance = async () => {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    if (!(await form.value?.validate())?.valid) { busy.value = false; await nextTick(); document.querySelector<HTMLElement>('#goal-editor .v-input--error input')?.focus(); return }
    if (activeStep.value === 'review') {
      if (!previewedInput.value) throw new Error('Вернитесь назад, чтобы обновить результат.')
      const result = await api.saveGoal(previewedInput.value)
      emit('saved', result.profile)
      return
    }
    if (activeStep.value === 'activity' && (!draft.routine || !draft.exercise)) throw new Error('Выберите обычный распорядок и время тренировок.')
    if (nextIsReview.value) {
      const payload = goalInput(draft)
      estimate.value = await api.previewGoal(payload)
      previewedInput.value = payload
    }
    stepIndex.value += 1
    await focusStep()
  } catch (err) { error.value = errorMessage(err, 'Не удалось получить результат. Ваши ответы остались на месте — попробуйте ещё раз.') }
  finally { busy.value = false }
}
</script>

<style scoped>
.setup { display: grid; grid-template-columns: 230px minmax(0, 1fr); background: white; border: 1px solid #dfe5d9; border-radius: 24px; overflow: hidden; scroll-margin-top: 24px; }
.setup-rail { padding: 32px 26px; background: #f0f3e8; border-right: 1px solid #e1e6d9; display: flex; flex-direction: column; }
.setup-rail h2 { font: 400 40px/1.05 Georgia, serif; color: #264b3f; letter-spacing: -.04em; margin: 20px 0 16px; }
.setup-rail p { font-size: 12px; line-height: 1.75; color: var(--text-secondary); }
.setup-rail > small { font-size: 11px; line-height: 1.7; color: var(--text-secondary); margin-top: auto; padding-top: 30px; }
.setup-steps { list-style: none; margin: 30px 0; padding: 0; display: grid; gap: 18px; }
.setup-steps button { display: flex; align-items: center; gap: 11px; font-size: 12px; color: var(--text-secondary); text-align: left; min-height: 32px; }
.setup-steps span { width: 30px; height: 30px; display: grid; place-items: center; border: 1px solid #d4ddc8; border-radius: 50%; font-size: 12px; }
.setup-steps .active button { color: #264b3f; font-weight: 600; }
.setup-steps .active span { background: #264b3f; border-color: #264b3f; color: white; }
.setup-steps .done span { background: #dce8ad; color: #264b3f; border-color: #dce8ad; }
.setup-content { padding: 28px 36px 30px; min-width: 0; }
.setup-topline { display: flex; justify-content: space-between; align-items: center; min-height: 30px; font-size: 11px; color: var(--text-secondary); margin-bottom: 18px; }
.setup-progress { display: none; }
.setup-content > h2 { color: #264b3f; font: 400 clamp(26px, 3vw, 34px)/1.2 Georgia, serif; letter-spacing: -.025em; scroll-margin-top: 24px; outline: none; }
.setup-lead { font-size: 13px; line-height: 1.75; color: var(--text-secondary); margin: 12px 0 28px; max-width: 530px; }
.setup-fields, .setup-group { border: 0; min-width: 0; margin: 0; padding: 0; }
.setup-group { margin-bottom: 26px; }
.setup-group legend { color: #3f5445; font-size: 13px; font-weight: 600; margin-bottom: 13px; }
.setup-intents { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; }
.choice { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 17px; border: 1px solid #dee4d8; border-radius: 13px; cursor: pointer; color: #53634d; transition: border-color .15s, background .15s; }
.choice:hover { border-color: #93a688; }
.choice.selected { background: #f4f7ec; border-color: #456248; color: #264b3f; }
.choice:focus-within { outline: 2px solid #264b3f; outline-offset: 3px; }
.choice input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.choice strong { display: block; font-size: 12px; font-weight: 600; line-height: 1.5; }
.choice small { display: block; font-size: 11px; line-height: 1.6; color: var(--text-secondary); margin-top: 5px; }
.choice-intent { display: block; padding: 16px 13px; }
.choice-symbol { display: block; font: 25px Georgia, serif; margin-bottom: 12px; }
.choice-dot { width: 16px; height: 16px; border: 1px solid #bfccb7; border-radius: 50%; flex-shrink: 0; }
.selected .choice-dot { border: 5px solid #42634b; }
.setup-methods { display: grid; gap: 10px; }
.setup-choices, .setup-pace, .setup-inputs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.setup-inputs { gap: 8px 18px; margin-top: 6px; }
.setup-hint { font-size: 11px; color: var(--text-secondary); line-height: 1.7; margin: -2px 0 13px; }
.setup-note { font-size: 11px; color: var(--text-secondary); line-height: 1.75; margin: 16px 0 0; }
.setup-aside { border-left: 2px solid #c3d1a7; padding: 3px 0 3px 17px; margin: 25px 0 8px; }
.setup-aside strong { font-size: 12px; font-weight: 600; color: #4d6349; }
.setup-aside p { font-size: 12px; line-height: 1.8; color: var(--text-secondary); margin: 6px 0 0; }
.setup-use-weight { display: block; text-align: left; font-size: 11px; color: #496b4e; padding: 7px 0; text-decoration: underline; text-underline-offset: 4px; }
.pace-choice { display: block; padding: 20px; }
.pace-choice__top { display: flex; flex-direction: column; gap: 10px; }
.pace-percent { font-size: 32px; font-weight: 500; letter-spacing: -.035em; }
.setup-tag { display: inline-block; font-size: 12px; color: #526b3d; padding: 4px 8px; border-radius: 5px; background: #e2ebc7; margin-top: 13px; }
.setup-result { padding: 25px 28px; background: #eaf0df; border: 1px solid #dae5c8; border-radius: 17px; color: #264b3f; }
.setup-result > span { font-size: 11px; color: var(--text-secondary); }
.setup-result strong { display: block; font-size: clamp(42px, 6vw, 58px); font-weight: 500; line-height: 1.15; letter-spacing: -.05em; margin: 9px 0; font-variant-numeric: tabular-nums; }
.setup-result small { font-size: 15px; letter-spacing: 0; font-weight: 400; }
.setup-result p { font-size: 12px; color: var(--text-secondary); margin: 0; }
.setup-breakdown { margin: 20px 0 0; }
.setup-breakdown > div { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-size: 12px; padding: 9px 0; border-bottom: 1px solid #edf0e8; }
.setup-breakdown dt { color: var(--text-secondary); }
.setup-breakdown dd { color: #3d5541; white-space: nowrap; }
.setup-review-answers { margin: 22px 0; border-top: 1px solid #e4e9dd; }
.setup-review-answers > div { display: flex; justify-content: space-between; gap: 18px; align-items: center; padding: 13px 0; border-bottom: 1px solid #e4e9dd; font-size: 12px; line-height: 1.7; color: var(--text-secondary); }
.setup-link { color: #3d644a; text-decoration: underline; text-underline-offset: 4px; font-size: 11px; padding: 7px 0; }
.setup-method { color: var(--text-secondary); font-size: 11px; line-height: 1.8; margin-top: 22px; }
.setup-method summary { cursor: pointer; color: #446449; }
.setup-method p { margin-top: 12px; }
.setup-method a { color: #446449; text-underline-offset: 3px; }
.setup-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-top: 24px; margin-top: 25px; border-top: 1px solid #e4e9dd; }
.setup-time { font-size: 11px; color: var(--text-secondary); }
button:focus-visible, summary:focus-visible { outline: 2px solid #264b3f; outline-offset: 4px; }
fieldset:disabled .choice { cursor: wait; }
@media (max-width: 1100px) { .setup { grid-template-columns: 190px minmax(0, 1fr); } .setup-rail { padding: 28px 20px; } .setup-content { padding: 25px; } .setup-intents { gap: 7px; } .choice-intent { padding: 13px 10px; } .choice-intent small { font-size: 12px; } }
@media (max-width: 800px) { .setup { grid-template-columns: 1fr; } .setup-rail { display: none; } .setup-content { padding: 24px; } .setup-progress { display: block; height: 3px; background: #e9eee0; margin: -3px 0 25px; border-radius: 3px; overflow: hidden; } .setup-progress span { display: block; background: #597547; height: 100%; } }
@media (max-width: 520px) { .setup-content { padding: 22px 18px; } .setup-intents { grid-template-columns: 1fr; gap: 8px; } .choice-intent { display: grid; grid-template-columns: 28px 1fr; gap: 0 10px; padding: 13px; } .choice-intent .choice-symbol { margin: 0; grid-row: span 2; align-self: center; } .choice-intent small { font-size: 11px; margin-top: 2px; } .setup-lead { font-size: 12px; margin-bottom: 24px; } .setup-choices, .setup-pace { grid-template-columns: 1fr; gap: 8px; } .setup-inputs { gap: 8px 12px; } .choice { padding: 14px; } .pace-choice__top { flex-direction: row; justify-content: space-between; align-items: center; } .pace-percent { font-size: 26px; } .setup-footer { flex-wrap: wrap; gap: 12px; } .setup-footer > .v-btn:last-child { flex: 1; } .setup-time { display: none; } .setup-result { padding: 22px; } .setup-breakdown > div { font-size: 11px; } }
@media (prefers-reduced-motion: reduce) { .choice { transition: none; } }
</style>
