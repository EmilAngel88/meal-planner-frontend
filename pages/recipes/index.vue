<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5">Рецепты</h1>
      <v-spacer />
      <v-btn color="primary" @click="dialog=true">Добавить рецепт</v-btn>
    </div>
    <v-row>
      <v-col v-for="r in recipes" :key="r.id" cols="12" sm="6" md="4">
        <RecipeCard :recipe="r" :onDelete="remove"/>
      </v-col>
    </v-row>
    <v-dialog v-model="dialog" max-width="600">
      <v-card>
        <v-card-title>Новый рецепт</v-card-title>
        <v-card-text>
          <v-text-field v-model="title" label="Название" />
          <v-textarea v-model="description" label="Описание" />
          <v-select
            v-model="mealTypes"
            chips
            clearable
            :items="mealTypeItems"
            item-title="title"
            item-value="value"
            label="Подходит для"
            multiple
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer /><v-btn variant="text" @click="dialog=false">Отмена</v-btn>
          <v-btn color="primary" @click="create">Создать</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
<script setup lang="ts">
import { useRecipesStore } from '~/stores/recipes'
import { storeToRefs } from 'pinia'
import RecipeCard from '~/components/RecipeCard.vue'
const store = useRecipesStore()
const { list: recipes } = storeToRefs(store)
const dialog = ref(false)
const title = ref('')
const description = ref('')
const mealTypes = ref<string[]>([])
const mealTypeItems = [
  { value: 'breakfast', title: 'Завтрак' },
  { value: 'lunch', title: 'Обед' },
  { value: 'dinner', title: 'Ужин' },
  { value: 'snack', title: 'Перекус' },
  { value: 'any', title: 'Любой' }
]
onMounted(async () => { await store.fetchAll() })
const create = async () => {
  await store.create({ title: title.value, description: description.value, mealTypes: mealTypes.value })
  title.value = ''
  description.value = ''
  mealTypes.value = []
  dialog.value=false
}
const remove = async (id: number) => { await store.remove(id) }
</script>
