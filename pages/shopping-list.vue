<template>
  <div>
    <h1 class="text-h5 mb-4">Список покупок</h1>
    <v-alert type="info" class="mb-4">Формируется из ингредиентов рецептов.</v-alert>
    <v-table>
      <thead><tr><th>Продукт</th><th>Кол-во (г)</th></tr></thead>
      <tbody>
        <tr v-for="row in rows" :key="row.name">
          <td>{{ row.name }}</td><td>{{ row.amount }}</td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>
<script setup lang="ts">
import { useRecipesStore } from '~/stores/recipes'
const recipesStore = useRecipesStore()
const rows = computed(() => {
  const map = new Map<string, number>()
  for (const r of recipesStore.list) {
    if (!r.ingredients) continue
    for (const ing of r.ingredients) {
      const name = ing.product?.name || `#${ing.productId}`
      const w = ing.weight || 0
      map.set(name, (map.get(name) || 0) + w)
    }
  }
  return Array.from(map.entries()).map(([name, amount]) => ({ name, amount }))
})
onMounted(async () => { if (!recipesStore.list.length) await recipesStore.fetchAll() })
</script>
