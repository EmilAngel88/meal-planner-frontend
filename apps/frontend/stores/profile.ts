// ~/stores/profile.ts
import { defineStore } from 'pinia'
import { useApi } from '~/composables/useApi'
import type { GoalSetup } from '~/utils/goal'

type ProfileState = {
  age: number | null
  gender: 'male' | 'female' | null
  height: number | null
  weight: number | null
  activity: 'low' | 'light' | 'training4' | 'training5' | 'training6' | 'daily' | 'medium' | 'high' | 'extreme' | null
  goal: 'loss' | 'maintain' | 'gain' | null
  goalRate: number
  calories: number | null
  goalSetup?: GoalSetup | null
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
      goalRate: 0.15,
      calories: null
    } as ProfileState,
    logs: [] as WeightLogState[]
  }),

  actions: {
    async fetch() {
      const { getProfile } = useApi()
      const profile = await getProfile()
      if (profile) this.profile = profile
    },

    async fetchLogs() {
      const { getWeightLogs } = useApi()
      this.logs = await getWeightLogs()
    },

    async calculate() {
      const { calculateProfile } = useApi()
      const r = await calculateProfile(this.profile)
      this.profile = r.profile
    },

    async preset() {
      const { presetProfile } = useApi()
      const r = await presetProfile(this.profile)
      this.profile = r.profile
    },

    async manual() {
      const { manualProfile } = useApi()
      const r = await manualProfile(this.profile)
      this.profile = r.profile
    },

    async addLog(date: string, weight: number) {
      const { addWeightLog } = useApi()
      const r = await addWeightLog({ weight, date })
      this.logs = [...this.logs, r].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    },

    async deleteLog(id: number) {
      const { deleteWeightLog } = useApi()
      await deleteWeightLog(id)
      this.logs = this.logs.filter(l => l.id !== id)
    }
  }
})
