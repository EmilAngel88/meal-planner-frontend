import { defineStore } from 'pinia'
import { useApi } from '~/composables/useApi'

type User = { id:number, email:string }

export const useAuthStore = defineStore('auth', {
  state:()=>({
    token: process.client ? localStorage.getItem('token') || '' : '',
    user: null as User|null,
    initialized: false
  }),
  getters:{ isAuthed:s=>!!s.token },
  actions:{
    async login(email:string,password:string){
      const { login } = useApi()
      const r = await login(email,password)
      this.token=r.token
      this.user=r.user
      if(process.client) localStorage.setItem('token',this.token)
    },
    async register(email:string,password:string){
      const { register } = useApi()
      const r = await register(email,password)
      this.token=r.token
      this.user=r.user
      if(process.client) localStorage.setItem('token',this.token)
    },
    async init(){
      if (this.initialized) return
      if (process.client && !this.token) {
        this.token = localStorage.getItem('token') || ''
      }

      if (this.token && !this.user) {
        await this.me(false)
      }

      this.initialized = true
    },
    async me(redirectOnFail = true){
      if (!this.token) return
      try {
        const { me } = useApi()
        this.user = await me()
      } catch (e) {
        console.error("Не удалось загрузить пользователя", e)
        this.logout(redirectOnFail)
      }
    },
    logout(redirect = true){
      this.token=''
      this.user=null
      this.initialized=true
      if(process.client) localStorage.removeItem('token')
      if (redirect) navigateTo('/login')
    }
  }
})
