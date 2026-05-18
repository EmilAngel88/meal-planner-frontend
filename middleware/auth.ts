import { useAuthStore } from '~/stores/auth'
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  const protectedRoutes = ['/account','/menu','/shopping-list','/recipes','/products']
  if (!auth.isAuthed) {
    if (to.path === '/' || protectedRoutes.some(p => to.path.startsWith(p))) {
      return navigateTo('/login')
    }
  } else {
    if (to.path === '/login' || to.path === '/register' || to.path === '/') {
      return navigateTo('/account')
    }
  }
})
