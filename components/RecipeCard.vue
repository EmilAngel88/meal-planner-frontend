<template>
  <v-card :to="`/recipes/${recipe.id}`" class="h-100 d-flex flex-column">
    <v-card-title class="text-wrap">{{ recipe.title }}</v-card-title>
    <v-card-text class="text-body-2">{{ recipe.description }}</v-card-text>
    <v-spacer />
    <v-card-actions>
      <v-btn :to="`/recipes/${recipe.id}`" variant="text">Открыть</v-btn>
      <v-spacer />
      <v-btn v-if="onDelete" color="error" variant="text" @click.stop="onDelete(recipe.id)">Удалить</v-btn>
    </v-card-actions>
  </v-card>
</template>
<script setup lang="ts">
import type { Recipe } from '~/composables/useApi'
defineProps<{ recipe: Recipe, onDelete?: (id:number)=>void }>()
</script>
