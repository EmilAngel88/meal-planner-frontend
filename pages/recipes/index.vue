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
        <section v-if="customRecipes.length" class="recipe-section">
          <div class="recipe-section__header">
            <h2 class="text-h6">Мои рецепты</h2>
            <span class="text-caption text-medium-emphasis">{{ customRecipes.length }}</span>
          </div>
          <v-row>
            <v-col v-for="r in customRecipes" :key="r.id" cols="12" sm="6" md="4">
              <RecipeCard :recipe="r" :onDelete="remove"/>
            </v-col>
          </v-row>
        </section>

        <section class="recipe-section">
          <div class="recipe-section__header">
            <h2 class="text-h6">Базовые рецепты</h2>
            <span class="text-caption text-medium-emphasis">{{ baseRecipes.length }}</span>
          </div>
          <v-row>
            <v-col v-for="r in baseRecipes" :key="r.id" cols="12" sm="6" md="4">
              <RecipeCard :recipe="r" :onDelete="remove"/>
            </v-col>
          </v-row>
        </section>
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
            <v-card border class="collection-card h-100" flat>
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
          <v-text-field v-model.trim="collectionSearch" clearable label="Поиск по моим рецептам" />
          <v-alert v-if="!customRecipes.length" class="mb-3" type="info" variant="tonal">
            Для коллекций используются только пользовательские рецепты.
          </v-alert>
          <div v-else class="select-list">
            <button
              v-for="recipe in filteredCollectionRecipes"
              :key="recipe.id"
              class="select-row"
              :class="{ 'select-row--active': collectionRecipeIds.includes(recipe.id) }"
              type="button"
              @click="toggleCollectionRecipe(recipe.id, !collectionRecipeIds.includes(recipe.id))"
            >
              <v-checkbox
                class="strong-checkbox"
                color="primary"
                density="compact"
                hide-details
                :model-value="collectionRecipeIds.includes(recipe.id)"
                @click.stop
                @update:model-value="toggleCollectionRecipe(recipe.id, Boolean($event))"
              />
              <div class="select-row__content">
                <div class="font-weight-medium">{{ recipe.title }}</div>
                <div class="text-caption text-medium-emphasis">{{ formatMealTypes(recipe.mealTypes || []) }}</div>
              </div>
            </button>
          </div>
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
const customRecipes = computed(() => recipes.value.filter(recipe => !recipe.isBase))
const baseRecipes = computed(() => recipes.value.filter(recipe => recipe.isBase))
const filteredCollectionRecipes = computed(() => {
  const query = collectionSearch.value.trim().toLowerCase()
  if (!query) return customRecipes.value
  return customRecipes.value.filter(recipe => recipe.title.toLowerCase().includes(query))
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
  const customRecipeIds = new Set(customRecipes.value.map(recipe => recipe.id))
  collectionRecipeIds.value = collection?.items.map(item => item.recipeId).filter(id => customRecipeIds.has(id)) || []
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
<style scoped>
.recipe-section {
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.18);
  padding-top: 18px;
}

.recipe-section + .recipe-section {
  margin-top: 28px;
}

.recipe-section__header {
  align-items: center;
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}

.collection-card {
  border-color: rgba(var(--v-theme-on-surface), 0.22) !important;
  border-radius: 8px;
  box-shadow: none;
}

.select-list {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.2);
  border-radius: 8px;
  overflow: hidden;
}

.select-row {
  align-items: center;
  background: rgb(var(--v-theme-surface));
  border: 0;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.14);
  cursor: pointer;
  display: flex;
  gap: 12px;
  min-height: 58px;
  padding: 8px 14px;
  text-align: left;
  width: 100%;
}

.select-row:last-child {
  border-bottom: 0;
}

.select-row--active {
  background: rgba(var(--v-theme-primary), 0.08);
  box-shadow: inset 3px 0 0 rgb(var(--v-theme-primary));
}

.select-row__content {
  min-width: 0;
}

.strong-checkbox :deep(.v-selection-control__input) {
  opacity: 1;
}
</style>
