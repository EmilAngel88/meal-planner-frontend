import { useAuthStore } from '~/stores/auth'
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()
  await auth.init()
  const publicPage = to.path === '/login' || to.path === '/register'
  if (!auth.isAuthed && !publicPage) return navigateTo({ path: '/login', query: to.path === '/' ? {} : { redirect: to.fullPath } }, { replace: true })
  if (auth.isAuthed && publicPage) return navigateTo('/', { replace: true })
})
