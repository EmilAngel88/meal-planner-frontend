import { defineStore } from 'pinia'
import { useApi } from '~/composables/useApi'
import { useProfileStore } from '~/stores/profile'
import { useRecipesStore } from '~/stores/recipes'
import { useUiStore } from '~/stores/ui'
import { readStorage, writeStorage } from '~/utils/storage'

type User = { id: number; email: string; canManageFeedback?: boolean; canManageBilling?: boolean }
export const useAuthStore = defineStore('auth', {
  state: () => ({ token: '', user: null as User | null, initialized: false, sessionRevision: 0 }),
  getters: { isAuthed: s => !!s.token, canManageFeedback: s => s.user?.canManageFeedback === true, canManageBilling: s => s.user?.canManageBilling === true },
  actions: {
    setSession(result: { token: string; user: User }) {
      this.sessionRevision += 1
      useProfileStore().$reset()
      useRecipesStore().$reset()
      useUiStore().$reset()
      this.token = result.token
      this.user = result.user
      this.initialized = true
      writeStorage('token', result.token)
    },
    async login(email: string, password: string) { this.setSession(await useApi().login(email, password)) },
    async register(email: string, password: string) { this.setSession(await useApi().register(email, password)) },
    async restoreSession(token: string) {
      if (token === this.token) return
      this.sessionRevision += 1
      this.token = token
      this.user = null
      this.initialized = true
      useProfileStore().$reset()
      useRecipesStore().$reset()
      useUiStore().$reset()
      if (token) await this.me(false)
    },
    async init() {
      if (this.initialized) return
      this.token = readStorage('token') || ''
      if (this.token) await this.me(false)
      this.initialized = true
    },
    async me(redirectOnFail = true) {
      if (!this.token) return
      try { this.user = await useApi().me() }
      catch (error) {
        if ((error as { status?: number }).status === 401) this.logout(redirectOnFail)
        // A temporary outage must not erase a valid session.
      }
    },
    logout(redirect = true) {
      this.sessionRevision += 1
      this.token = ''
      this.user = null
      this.initialized = true
      writeStorage('token', null)
      useProfileStore().$reset()
      useRecipesStore().$reset()
      useUiStore().$reset()
      if (redirect) void navigateTo('/login')
    }
  }
})
