import { defineStore } from 'pinia'
export const useUiStore = defineStore('ui', {
  state: () => ({ message: '', show: false }),
  actions: { notify(msg: string) { this.message = msg; this.show = true } }
})
