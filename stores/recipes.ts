import { defineStore } from 'pinia'
import { useApi, type Recipe, type Product } from '~/composables/useApi'
export const useRecipesStore = defineStore('recipes', {
  state: () => ({ list: [] as Recipe[], current: null as Recipe | null, products: [] as Product[] }),
  actions: {
    async fetchAll() { this.list = await useApi().getRecipes() },
    async fetchOne(id: number) { this.current = await useApi().getRecipe(id) },
    async create(payload: Partial<Recipe>) { const r = await useApi().createRecipe(payload); this.list.unshift(r) },
    async copy(id: number) { const r = await useApi().copyRecipe(id); this.list.unshift(r); return r },
    async update(id: number, payload: Partial<Recipe>) { const r = await useApi().updateRecipe(id, payload); this.current = r; this.list = this.list.map(x => x.id===id ? r : x) },
    async remove(id: number) { await useApi().deleteRecipe(id); this.list = this.list.filter(r => r.id !== id) },
    async fetchProducts(q?: string) { this.products = await useApi().getProducts(q) }
  }
})
