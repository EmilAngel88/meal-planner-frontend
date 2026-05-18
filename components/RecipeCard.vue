<template>
  <v-card
    border
    class="recipe-card h-100 d-flex flex-column"
    :class="recipe.isBase ? 'recipe-card--base' : 'recipe-card--custom'"
    flat
    :ripple="false"
    :to="`/recipes/${recipe.id}`"
  >
    <v-card-title class="text-wrap">{{ recipe.title }}</v-card-title>
    <v-card-text class="text-body-2">
      <v-chip v-if="recipe.isBase" class="mb-2" size="small" variant="outlined">Базовый</v-chip>
      <v-chip v-else class="mb-2" color="primary" size="small" variant="outlined">Мой</v-chip>
      <div>{{ recipe.description }}</div>
    </v-card-text>
    <v-spacer />
    <v-card-actions>
      <v-btn :to="`/recipes/${recipe.id}`" variant="text">Открыть</v-btn>
      <v-spacer />
      <v-btn v-if="onDelete && !recipe.isBase" color="error" variant="text" @click.stop="onDelete(recipe.id)">Удалить</v-btn>
    </v-card-actions>
  </v-card>
</template>
<script setup lang="ts">
import type { Recipe } from '~/composables/useApi'
defineProps<{ recipe: Recipe, onDelete?: (id:number)=>void }>()
</script>
<style scoped>
.recipe-card {
  border-color: rgba(var(--v-theme-on-surface), 0.22) !important;
  border-radius: 8px;
  box-shadow: none;
  transition: border-color 120ms ease, background-color 120ms ease;
}

.recipe-card:hover {
  border-color: rgba(var(--v-theme-primary), 0.65) !important;
}

.recipe-card--base {
  background: rgba(var(--v-theme-surface), 1);
}

.recipe-card--custom {
  background: rgba(var(--v-theme-primary), 0.035);
}
</style>
