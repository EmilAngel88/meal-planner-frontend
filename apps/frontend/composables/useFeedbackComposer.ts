import { sanitizeFeedbackPagePath, type FeedbackDeviceType } from '~/utils/feedback'

export const useFeedbackComposer = () => {
  const route = useRoute()
  const state = useState<{ open: boolean; pagePath: string | null; deviceType: FeedbackDeviceType | null }>('feedbackComposer', () => ({ open: false, pagePath: null, deviceType: null }))
  const openFeedback = () => {
    // Keep page identifiers, query strings and personal settings out of reports.
    state.value.pagePath = sanitizeFeedbackPagePath(route.path) ?? null
    if (import.meta.client) state.value.deviceType = window.innerWidth < 600 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop'
    state.value.open = true
  }
  return { state, openFeedback }
}
