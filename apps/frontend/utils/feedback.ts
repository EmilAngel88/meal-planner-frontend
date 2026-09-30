export type FeedbackCategory = 'bug' | 'idea' | 'other'
export type FeedbackStatus = 'new' | 'planned' | 'in_progress' | 'done' | 'closed'
export type FeedbackDeviceType = 'mobile' | 'tablet' | 'desktop'

export type FeedbackCreatePayload = {
  requestId: string
  category: FeedbackCategory
  message: string
  pagePath?: string
  deviceType?: FeedbackDeviceType
}
export type CreateFeedbackPayload = FeedbackCreatePayload
export type FeedbackItem = {
  id: number
  requestId: string
  category: FeedbackCategory
  message: string
  pagePath: string | null
  deviceType: FeedbackDeviceType | null
  status: FeedbackStatus
  reply: string
  version: number
  createdAt: string
  updatedAt: string
}
export type AdminFeedbackItem = FeedbackItem & { author: { id: number; email: string } }
export type FeedbackPage<T = FeedbackItem> = { items: T[]; nextCursor: number | null }

export const feedbackCategories: ReadonlyArray<{ value: FeedbackCategory; title: string; description: string; placeholder: string }> = [
  { value: 'bug', title: 'Проблема', description: 'Что-то не работает', placeholder: 'Что вы хотели сделать, что произошло и какого результата ожидали?' },
  { value: 'idea', title: 'Идея', description: 'Можно сделать удобнее', placeholder: 'Чего вам не хватает в Рационе? Расскажите, в какой ситуации это помогло бы.' },
  { value: 'other', title: 'Другое', description: 'Впечатление или вопрос', placeholder: 'Что понравилось, запутало или осталось непонятным?' }
]
export const feedbackCategoryLabels: Record<FeedbackCategory, string> = { bug: 'Проблема', idea: 'Идея', other: 'Другое' }
export const feedbackStatusLabels: Record<FeedbackStatus, string> = { new: 'Получен', planned: 'В планах', in_progress: 'В работе', done: 'Готово', closed: 'Закрыт' }
export const feedbackStatuses: ReadonlyArray<{ value: FeedbackStatus; title: string }> = [
  { value: 'new', title: feedbackStatusLabels.new },
  { value: 'planned', title: feedbackStatusLabels.planned },
  { value: 'in_progress', title: feedbackStatusLabels.in_progress },
  { value: 'done', title: feedbackStatusLabels.done },
  { value: 'closed', title: feedbackStatusLabels.closed }
]
export const feedbackDeviceLabels: Record<FeedbackDeviceType, string> = { mobile: 'Телефон', tablet: 'Планшет', desktop: 'Компьютер' }
const pageLabels: Record<string, string> = {
  '/': 'Обзор', '/menu': 'Моя неделя', '/recipes': 'Рецепты', '/recipes/:id': 'Карточка рецепта',
  '/products': 'Продукты', '/shopping-list': 'Покупки', '/account': 'Моя цель',
  '/feedback': 'Обратная связь', '/feedback/admin': 'Отзывы пользователей'
}

// Only known page names leave the browser. Query strings, hashes and recipe IDs never do.
export function sanitizeFeedbackPagePath(path: string): string | undefined {
  if (!path.startsWith('/') || path.startsWith('//')) return undefined
  const pathname = path.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/'
  if (/^\/recipes\/\d+$/.test(pathname)) return '/recipes/:id'
  return Object.hasOwn(pageLabels, pathname) ? pathname : undefined
}
export function feedbackPageLabel(path: string | null | undefined): string {
  return path ? pageLabels[path] || 'Страница приложения' : 'Страница не приложена'
}
export function feedbackMessageRule(value: string): true | string {
  const length = value.trim().length
  if (length < 10) return 'Добавьте немного деталей — хотя бы 10 символов.'
  if (length > 4000) return 'Сократите сообщение до 4000 символов.'
  return true
}

export type FeedbackDraft = Omit<FeedbackCreatePayload, 'requestId'>
// Identical retries reuse the same ID; edited messages become a distinct submission.
export function prepareFeedbackSubmission(
  draft: FeedbackDraft,
  previous: FeedbackCreatePayload | null,
  createId: () => string = () => crypto.randomUUID()
): FeedbackCreatePayload {
  const pagePath = draft.pagePath ? sanitizeFeedbackPagePath(draft.pagePath) : undefined
  const clean: FeedbackDraft = {
    category: draft.category, message: draft.message.trim(),
    ...(pagePath ? { pagePath } : {}), ...(draft.deviceType ? { deviceType: draft.deviceType } : {})
  }
  if (previous && previous.category === clean.category && previous.message === clean.message &&
    previous.pagePath === clean.pagePath && previous.deviceType === clean.deviceType) return previous
  return { requestId: createId(), ...clean }
}
