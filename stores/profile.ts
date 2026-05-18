// ~/stores/profile.ts
import { defineStore } from 'pinia'
import { useApi } from '~/composables/useApi'
import { useAuthStore } from '~/stores/auth'

type ProfileState = {
  age: number | null
  gender: 'male' | 'female' | null
  height: number | null
  weight: number | null
  activity: 'low' | 'light' | 'medium' | 'high' | 'extreme' | null
  goal: 'loss' | 'maintain' | 'gain' | null
  calories: number | null
}

type WeightLogState = {
  id: number
  userId: number
  weight: number
  date: string
}

export const useProfileStore = defineStore('profile', {
  state: () => ({
    profile: {
      age: null,
      gender: null,
      height: null,
      weight: null,
      activity: null,
      goal: null,
      calories: null
    } as ProfileState,
    logs: [] as WeightLogState[]
  }),

  actions: {
    async fetch() {
      const a = useAuthStore()
      if (!a.user?.id) throw new Error('Нет userId')
      const { getProfile } = useApi()
      const profile = await getProfile()
      if (profile) this.profile = profile
    },

    async fetchLogs() {
      const a = useAuthStore()
      if (!a.user?.id) throw new Error('Нет userId')
      const { getWeightLogs } = useApi()
      this.logs = await getWeightLogs()
    },

    async calculate() {
      const a = useAuthStore()
      if (!a.user?.id) throw new Error('Нет userId')
      const { calculateProfile } = useApi()
      const r = await calculateProfile(this.profile)
      this.profile = r.profile
    },

    async preset() {
      const a = useAuthStore()
      if (!a.user?.id) throw new Error('Нет userId')
      const { presetProfile } = useApi()
      const r = await presetProfile(this.profile)
      this.profile = r.profile
    },

    async manual() {
      const a = useAuthStore()
      if (!a.user?.id) throw new Error('Нет userId')
      const { manualProfile } = useApi()
      const r = await manualProfile(this.profile)
      this.profile = r.profile
    },

    async addLog(date: string, weight: number) {
      const a = useAuthStore()
      if (!a.user?.id) throw new Error('Нет userId')
      const { addWeightLog } = useApi()
      const r = await addWeightLog({ weight, date })
      this.logs.unshift(r)
    },

    async deleteLog(id: number) {
      const { deleteWeightLog } = useApi()
      await deleteWeightLog(id)
      this.logs = this.logs.filter(l => l.id !== id)
    }
  }
})
