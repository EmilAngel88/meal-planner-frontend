import { useAuthStore } from '~/stores/auth'
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()
  await auth.init()
  const authPage = to.path === '/login' || to.path === '/register'
  const publicPage = authPage || to.path.replace(/\/$/, '') === '/tutorial'
  if (!auth.isAuthed && !publicPage) return navigateTo({ path: '/login', query: to.path === '/' ? {} : { redirect: to.fullPath } }, { replace: true })
  if (auth.isAuthed && authPage) return navigateTo('/', { replace: true })
})
