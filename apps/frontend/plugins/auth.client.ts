import { useAuthStore } from '~/stores/auth'

export default defineNuxtPlugin(async () => {
  const auth = useAuthStore()
  await auth.init()
  window.addEventListener('storage', async event => {
    if (event.storageArea !== localStorage || event.key !== 'token' && event.key !== null) return
    const token = event.key === null ? '' : event.newValue || ''
    if (token === auth.token) return
    await auth.restoreSession(token)
    // A later storage event may already have restored another account.
    if (auth.token !== token && auth.isAuthed) return
    await navigateTo(auth.isAuthed ? '/' : '/login', { replace: true })
  })
})
