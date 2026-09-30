import { defineStore } from 'pinia'
import { errorMessage } from '~/utils/storage'
import { SessionChangedError } from '~/utils/requests'
export const useUiStore = defineStore('ui', {
  state: () => ({ message: '', show: false, color: 'success' }),
  actions: {
    notify(message: string, color = 'success') { this.message = message; this.color = color; this.show = true },
    error(error: unknown) { if (!(error instanceof SessionChangedError)) this.notify(errorMessage(error), 'error') }
  }
})
