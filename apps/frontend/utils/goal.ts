export type Goal = 'loss' | 'maintain' | 'gain'
export type Routine = 'seated' | 'mixed' | 'on_feet' | 'physical'
export type Exercise = 'none' | 'light' | 'regular' | 'frequent'
export type GoalInput = {
  mode: 'calculated'; goal: Goal; weight: number; age: number; height: number
  gender: 'male' | 'female'; routine: Routine; exercise: Exercise; pace: 'gentle' | 'moderate'
} | { mode: 'manual'; goal: Goal; weight: number; calories: number; adultConfirmed: true }
export type GoalEstimate = {
  calories: number; restingCalories: number | null; maintenanceCalories: number | null
  activityFactor: number | null; adjustmentPercent: number; adjustmentCalories: number
}
export type GoalSetup = { version: 1; input: GoalInput; estimate: GoalEstimate; savedAt: string }
export type GoalDraft = {
  mode: 'calculated' | 'manual'; goal: Goal; weight: number | null; age: number | null; height: number | null
  gender: 'male' | 'female' | null; routine: Routine | null; exercise: Exercise | null
  pace: 'gentle' | 'moderate'; calories: number | null; adultConfirmed: boolean
}
type Source = Partial<Pick<GoalDraft, 'age' | 'gender' | 'height' | 'weight' | 'calories'>> & { goal?: Goal | null; goalSetup?: GoalSetup | null }
export const goalOptions = [
  { value: 'loss', title: 'Снизить вес', text: 'Небольшой дефицит энергии', symbol: '↘' },
  { value: 'maintain', title: 'Поддерживать вес', text: 'Ориентир на текущий баланс', symbol: '→' },
  { value: 'gain', title: 'Набрать вес', text: 'Постепенно добавить энергии', symbol: '↗' }
] as const
export const routineOptions = [
  { value: 'seated', title: 'В основном сижу', text: 'Работа за столом, поездки, немного бытовых дел' },
  { value: 'mixed', title: 'Сижу и двигаюсь', text: 'Регулярно хожу пешком, чередую стол и дела на ногах' },
  { value: 'on_feet', title: 'Большую часть дня на ногах', text: 'Много хожу или работаю стоя, редко сижу подолгу' },
  { value: 'physical', title: 'Физически работаю', text: 'Регулярно переношу тяжести или выполняю тяжёлую работу' }
] as const
export const exerciseOptions = [
  { value: 'none', title: 'Пока без тренировок', text: 'Только обычные повседневные дела' },
  { value: 'light', title: 'Меньше 2 часов в неделю', text: 'Одна-две короткие тренировки' },
  { value: 'regular', title: 'От 2 до 4 часов', text: 'Несколько занятий в течение недели' },
  { value: 'frequent', title: 'Больше 4 часов', text: 'Продолжительные или частые занятия' }
] as const

export function createGoalDraft(profile: Source = {}): GoalDraft {
  const saved = profile.goalSetup?.version === 1 ? profile.goalSetup.input : null
  return {
    mode: saved?.mode || 'calculated', goal: profile.goal || 'maintain', weight: profile.weight ?? null,
    age: profile.age ?? null, gender: profile.gender ?? null, height: profile.height ?? null,
    calories: profile.calories ?? null, routine: saved?.mode === 'calculated' ? saved.routine : null,
    exercise: saved?.mode === 'calculated' ? saved.exercise : null,
    pace: saved?.mode === 'calculated' ? saved.pace : 'gentle', adultConfirmed: saved?.mode === 'manual' && saved.adultConfirmed,
  }
}

export function goalSteps(draft: Pick<GoalDraft, 'mode' | 'goal'>) {
  if (draft.mode === 'manual') return ['intent', 'manual', 'review'] as const
  return draft.goal === 'maintain' ? ['intent', 'body', 'activity', 'review'] as const : ['intent', 'body', 'activity', 'pace', 'review'] as const
}

export function goalInput(draft: GoalDraft): GoalInput {
  const valid = (v: unknown, min: number, max: number, integer = false): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max && (!integer || Number.isInteger(v))
  if (!valid(draft.weight, 20, 500)) throw new Error('Укажите текущий вес от 20 до 500 кг.')
  const common = { goal: draft.goal, weight: draft.weight }
  if (draft.mode === 'manual') {
    if (!draft.adultConfirmed) throw new Error('Сервис рассчитан на взрослых от 18 лет.')
    if (!valid(draft.calories, 1000, 10000, true)) throw new Error('Укажите целое число от 1 000 до 10 000 ккал.')
    return { ...common, mode: 'manual', calories: draft.calories, adultConfirmed: true }
  }
  if (!valid(draft.age, 18, 120, true) || !valid(draft.height, 100, 250, true) || !draft.gender) throw new Error('Проверьте возраст, рост и пол для расчёта.')
  if (!draft.routine || !draft.exercise) throw new Error('Выберите обычный распорядок и тренировки.')
  return { ...common, mode: 'calculated', age: draft.age, height: draft.height, gender: draft.gender,
    routine: draft.routine, exercise: draft.exercise, pace: draft.goal === 'maintain' ? 'gentle' : draft.pace }
}
