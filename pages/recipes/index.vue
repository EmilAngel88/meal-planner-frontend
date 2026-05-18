<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5">Рецепты</h1>
      <v-spacer />
      <v-btn color="primary" @click="dialog=true">Добавить рецепт</v-btn>
    </div>

    <v-tabs v-model="tab" class="mb-4">
      <v-tab value="recipes">Рецепты</v-tab>
      <v-tab value="collections">Коллекции</v-tab>
    </v-tabs>

    <v-window v-model="tab">
      <v-window-item value="recipes">
        <v-row>
          <v-col v-for="r in recipes" :key="r.id" cols="12" sm="6" md="4">
            <RecipeCard :recipe="r" :onDelete="remove"/>
          </v-col>
        </v-row>
      </v-window-item>

      <v-window-item value="collections">
        <div class="d-flex align-center mb-4">
          <h2 class="text-h6">Коллекции рецептов</h2>
          <v-spacer />
          <v-btn color="primary" @click="openCollectionDialog()">Создать коллекцию</v-btn>
        </div>

        <v-alert v-if="!collections.length" type="info" variant="tonal">
          Коллекций пока нет. Создайте набор рецептов, чтобы быстро подключать его при генерации меню.
        </v-alert>

        <v-row v-else>
          <v-col v-for="collection in collections" :key="collection.id" cols="12" md="6">
            <v-card class="h-100">
              <v-card-title>{{ collection.name }}</v-card-title>
              <v-card-text>
                <div class="text-caption text-medium-emphasis mb-2">Рецептов: {{ collection.items.length }}</div>
                <v-chip
                  v-for="item in collection.items"
                  :key="item.id"
                  class="mr-1 mb-1"
                  size="small"
                  variant="tonal"
                >
                  {{ recipeTitle(item.recipeId) }}
                </v-chip>
              </v-card-text>
              <v-card-actions>
                <v-btn variant="text" @click="openCollectionDialog(collection)">Изменить</v-btn>
                <v-spacer />
                <v-btn color="error" variant="text" @click="removeCollection(collection.id)">Удалить</v-btn>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>
      </v-window-item>
    </v-window>

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

    <v-dialog v-model="collectionDialog" max-width="760">
      <v-card>
        <v-card-title>{{ editingCollectionId ? 'Редактировать коллекцию' : 'Новая коллекция' }}</v-card-title>
        <v-card-text>
          <v-text-field v-model.trim="collectionName" label="Название" />
          <v-text-field v-model.trim="collectionSearch" clearable label="Поиск рецепта" />
          <v-table density="comfortable">
            <thead>
              <tr>
                <th style="width: 72px">Выбор</th>
                <th>Рецепт</th>
                <th>Тип</th>
                <th>Приемы пищи</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="recipe in filteredCollectionRecipes" :key="recipe.id">
                <td>
                  <v-checkbox-btn
                    :model-value="collectionRecipeIds.includes(recipe.id)"
                    @update:model-value="toggleCollectionRecipe(recipe.id, Boolean($event))"
                  />
                </td>
                <td>{{ recipe.title }}</td>
                <td>
                  <v-chip v-if="recipe.isBase" size="small" variant="tonal">Базовый</v-chip>
                  <v-chip v-else size="small" variant="tonal">Мой</v-chip>
                </td>
                <td>{{ formatMealTypes(recipe.mealTypes || []) }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeCollectionDialog">Отмена</v-btn>
          <v-btn color="primary" :loading="savingCollection" @click="saveCollection">Сохранить</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
<script setup lang="ts">
import { useRecipesStore } from '~/stores/recipes'
import { storeToRefs } from 'pinia'
import RecipeCard from '~/components/RecipeCard.vue'
import { useApi, type RecipeCollection } from '~/composables/useApi'
import { useUiStore } from '~/stores/ui'
const api = useApi()
const ui = useUiStore()
const store = useRecipesStore()
const { list: recipes } = storeToRefs(store)
const tab = ref('recipes')
const dialog = ref(false)
const title = ref('')
const description = ref('')
const mealTypes = ref<string[]>([])
const collections = ref<RecipeCollection[]>([])
const collectionDialog = ref(false)
const editingCollectionId = ref<number | null>(null)
const collectionName = ref('')
const collectionSearch = ref('')
const collectionRecipeIds = ref<number[]>([])
const savingCollection = ref(false)
const mealTypeItems = [
  { value: 'breakfast', title: 'Завтрак' },
  { value: 'lunch', title: 'Обед' },
  { value: 'dinner', title: 'Ужин' },
  { value: 'snack', title: 'Перекус' },
  { value: 'any', title: 'Любой' }
]
const filteredCollectionRecipes = computed(() => {
  const query = collectionSearch.value.trim().toLowerCase()
  if (!query) return recipes.value
  return recipes.value.filter(recipe => recipe.title.toLowerCase().includes(query))
})

const formatMealTypes = (types: string[]) => {
  if (!types.length) return 'Любой'
  return types.map(type => mealTypeItems.find(item => item.value === type)?.title || type).join(', ')
}
const recipeTitle = (id: number) => recipes.value.find(recipe => recipe.id === id)?.title || `#${id}`
const loadCollections = async () => {
  const settings = await api.getMenuSettings()
  collections.value = settings.collections
}
onMounted(async () => {
  await store.fetchAll()
  await loadCollections()
})
const create = async () => {
  await store.create({ title: title.value, description: description.value, mealTypes: mealTypes.value })
  title.value = ''
  description.value = ''
  mealTypes.value = []
  dialog.value=false
}
const remove = async (id: number) => { await store.remove(id) }
const openCollectionDialog = (collection?: RecipeCollection) => {
  editingCollectionId.value = collection?.id || null
  collectionName.value = collection?.name || ''
  collectionRecipeIds.value = collection?.items.map(item => item.recipeId) || []
  collectionSearch.value = ''
  collectionDialog.value = true
}
const closeCollectionDialog = () => {
  collectionDialog.value = false
  editingCollectionId.value = null
  collectionName.value = ''
  collectionRecipeIds.value = []
  collectionSearch.value = ''
}
const toggleCollectionRecipe = (id: number, enabled: boolean) => {
  const current = new Set(collectionRecipeIds.value)
  if (enabled) current.add(id)
  else current.delete(id)
  collectionRecipeIds.value = Array.from(current)
}
const saveCollection = async () => {
  if (!collectionName.value.trim()) {
    ui.notify('Введите название коллекции')
    return
  }

  savingCollection.value = true
  try {
    if (editingCollectionId.value) {
      await api.updateRecipeCollection(editingCollectionId.value, {
        name: collectionName.value.trim(),
        recipeIds: collectionRecipeIds.value
      })
      ui.notify('Коллекция обновлена')
    } else {
      await api.createRecipeCollection({
        name: collectionName.value.trim(),
        recipeIds: collectionRecipeIds.value
      })
      ui.notify('Коллекция создана')
    }
    closeCollectionDialog()
    await loadCollections()
  } finally {
    savingCollection.value = false
  }
}
const removeCollection = async (id: number) => {
  await api.deleteRecipeCollection(id)
  ui.notify('Коллекция удалена')
  await loadCollections()
}
</script>
