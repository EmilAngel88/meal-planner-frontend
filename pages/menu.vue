<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5">Генерация меню</h1>
      <v-spacer />
      <v-btn color="primary" :loading="loading" @click="generate">Сгенерировать на 6 дней</v-btn>
    </div>

    <v-alert v-if="!profile?.calories" type="warning" class="mb-4">
      Сначала создайте цель по калориям в личном кабинете.
    </v-alert>

    <v-row class="mb-4">
      <v-col cols="12" md="3">
        <v-text-field :model-value="profile?.calories || 0" label="Цель в день, ккал" readonly />
      </v-col>
      <v-col cols="12" md="3">
        <v-text-field v-model="startDate" label="Дата старта" type="date" />
      </v-col>
      <v-col cols="12" md="2">
        <v-text-field v-model.number="macroRatios.protein" label="Белки, доля" step="0.01" type="number" />
      </v-col>
      <v-col cols="12" md="2">
        <v-text-field v-model.number="macroRatios.fat" label="Жиры, доля" step="0.01" type="number" />
      </v-col>
      <v-col cols="12" md="2">
        <v-text-field v-model.number="macroRatios.carbs" label="Углеводы, доля" step="0.01" type="number" />
      </v-col>
    </v-row>

    <v-expansion-panels class="mb-4">
      <v-expansion-panel>
        <v-expansion-panel-title>Рецепты для генерации</v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-tabs v-model="recipeTab" class="mb-3">
            <v-tab value="custom">Мои рецепты</v-tab>
            <v-tab value="collections">Коллекции</v-tab>
          </v-tabs>

          <v-window v-model="recipeTab">
            <v-window-item value="custom">
              <v-alert v-if="!(settings?.customRecipes || []).length" type="info" variant="tonal">
                Пользовательских рецептов пока нет. После добавления они появятся здесь и по умолчанию не будут включены.
              </v-alert>
              <v-row v-else>
                <v-col cols="12" lg="8">
                  <v-table class="clear-table" density="comfortable">
                    <thead>
                      <tr>
                        <th style="width: 84px">Включить</th>
                        <th>Рецепт</th>
                        <th>Приемы пищи</th>
                        <th style="width: 170px">Повторов в неделю</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="recipe in settings?.customRecipes || []"
                        :key="recipe.id"
                        :class="{ 'selected-row': selectedCustomRecipeIds.includes(recipe.id) }"
                      >
                        <td>
                          <v-checkbox
                            class="strong-checkbox"
                            color="primary"
                            density="compact"
                            hide-details
                            :model-value="selectedCustomRecipeIds.includes(recipe.id)"
                            @update:model-value="setCustomRecipeEnabled(recipe, Boolean($event))"
                          />
                        </td>
                        <td>
                          <div class="font-weight-medium">{{ recipe.title }}</div>
                          <div v-if="recipeCollectionNames(recipe.id).length" class="mt-1">
                            <v-chip
                              v-for="name in recipeCollectionNames(recipe.id)"
                              :key="name"
                              class="mr-1 mb-1"
                              size="x-small"
                              variant="outlined"
                            >
                              {{ name }}
                            </v-chip>
                          </div>
                        </td>
                        <td>{{ formatMealTypes(recipe.mealTypes || []) }}</td>
                        <td>
                          <v-text-field
                            v-model.number="preferenceFor(recipe).maxPerWeek"
                            density="compact"
                            hide-details
                            min="1"
                            max="6"
                            type="number"
                            variant="outlined"
                            @update:model-value="scheduleSavePreferences"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                </v-col>

                <v-col cols="12" lg="4">
                  <v-card border class="summary-card" flat>
                    <v-card-title class="text-subtitle-1">Будет добавлено</v-card-title>
                    <v-card-text>
                      <div class="text-caption text-medium-emphasis mb-2">
                        Рецептов: {{ selectedRecipesForGeneration.length }}
                      </div>

                      <div v-if="selectedCollection" class="mb-3">
                        <div class="text-caption text-medium-emphasis mb-1">Коллекция</div>
                        <v-chip size="small" variant="outlined">{{ selectedCollection.name }}</v-chip>
                      </div>

                      <v-list class="summary-list" density="compact">
                        <v-list-item
                          v-for="item in selectedRecipesForGeneration"
                          :key="item.recipe.id"
                          :to="`/recipes/${item.recipe.id}`"
                        >
                          <v-list-item-title>{{ item.recipe.title }}</v-list-item-title>
                          <v-list-item-subtitle v-if="item.from">
                            {{ item.from }}
                          </v-list-item-subtitle>
                        </v-list-item>
                      </v-list>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>
            </v-window-item>

            <v-window-item value="collections">
              <v-row class="align-center">
                <v-col cols="12" md="5">
                  <v-select
                    v-model="selectedCollectionId"
                    clearable
                    :items="settings?.collections || []"
                    item-title="name"
                    item-value="id"
                    label="Включить коллекцию при генерации"
                  />
                </v-col>
                <v-col cols="12" md="7">
                  <v-card v-if="selectedCollection" border class="collection-preview" flat>
                    <v-card-title class="text-subtitle-1">{{ selectedCollection.name }}</v-card-title>
                    <v-card-text>
                      <div class="text-caption text-medium-emphasis mb-2">
                        Рецептов: {{ selectedCollectionRecipeIds.length }}
                      </div>
                      <v-chip
                        v-for="rid in selectedCollectionRecipeIds"
                        :key="rid"
                        class="mr-1 mb-1"
                        size="small"
                        variant="tonal"
                      >
                        {{ recipeTitleById(rid) }}
                      </v-chip>
                    </v-card-text>
                  </v-card>
                  <v-alert v-else type="info" variant="tonal">
                    Выберите коллекцию. Создание коллекций находится на странице рецептов.
                  </v-alert>
                </v-col>
              </v-row>
            </v-window-item>
          </v-window>
        </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel>
        <v-expansion-panel-title>Настройки распределения</v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-row v-for="meal in meals" :key="meal.key" class="align-center">
            <v-col cols="12" md="3">
              <v-select v-model="meal.type" :items="mealTypeItems" item-title="title" item-value="value" label="Тип" />
            </v-col>
            <v-col cols="12" md="3">
              <v-text-field v-model="meal.title" label="Название" />
            </v-col>
            <v-col cols="6" md="3">
              <v-text-field v-model.number="meal.percent" label="Доля" step="0.01" type="number" />
            </v-col>
            <v-col cols="6" md="3">
              <v-text-field v-model.number="meal.maxItems" label="Позиции" min="1" max="4" type="number" />
            </v-col>
          </v-row>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <v-card v-if="plan" class="mb-4">
      <v-card-title>Итог меню за {{ plan.daysCount }} дней</v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="6" md="3">Ккал: {{ plan.totalCalories }} / {{ plan.targetCalories }}</v-col>
          <v-col cols="6" md="3">Белки: {{ plan.totalProtein }} / {{ plan.targetProtein }} г</v-col>
          <v-col cols="6" md="3">Жиры: {{ plan.totalFat }} / {{ plan.targetFat }} г</v-col>
          <v-col cols="6" md="3">Углеводы: {{ plan.totalCarbs }} / {{ plan.targetCarbs }} г</v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-row v-if="plan">
      <v-col v-for="day in planDays" :key="day.index" cols="12" lg="6">
        <v-card class="h-100">
          <v-card-title>{{ day.title }}</v-card-title>
          <v-card-subtitle>{{ day.subtitle }}</v-card-subtitle>
          <v-card-text v-if="day.free" class="text-medium-emphasis">
            Свободный день. В генерацию пока не входит.
          </v-card-text>
          <v-card-text v-else>
            <div v-for="group in day.groups" :key="group.type" class="mb-4">
              <div class="text-subtitle-2 mb-1">{{ mealTitle(group.type) }}</div>
              <v-list density="compact">
                <v-list-item v-for="item in group.items" :key="item.id" :to="item.recipeId ? `/recipes/${item.recipeId}` : undefined">
                  <v-list-item-title>{{ item.title }}</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ item.weight }} г · {{ item.calories }} ккал · Б {{ item.protein }} · Ж {{ item.fat }} · У {{ item.carbs }}
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-card v-if="history.length" class="mt-6">
      <v-card-title>Последние меню</v-card-title>
      <v-table>
        <thead>
          <tr><th>Дата</th><th>Дней</th><th>Ккал</th><th>Белки</th><th>Жиры</th><th>Углеводы</th></tr>
        </thead>
        <tbody>
          <tr v-for="item in history" :key="item.id">
            <td>{{ new Date(item.createdAt).toLocaleString() }}</td>
            <td>{{ item.daysCount }}</td>
            <td>{{ item.totalCalories }}</td>
            <td>{{ item.totalProtein }}</td>
            <td>{{ item.totalFat }}</td>
            <td>{{ item.totalCarbs }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { useApi, type MealPlan, type MealPlanItem, type MenuSettings, type Profile, type Recipe, type RecipePreference } from '~/composables/useApi'
import { useUiStore } from '~/stores/ui'

const api = useApi()
const ui = useUiStore()

const profile = ref<Profile | null>(null)
const plan = ref<MealPlan | null>(null)
const history = ref<MealPlan[]>([])
const settings = ref<MenuSettings | null>(null)
const loading = ref(false)
const savingPreferences = ref(false)
const recipeTab = ref('custom')
const selectedCollectionId = ref<number | null>(null)
const startDate = ref(new Date().toISOString().slice(0, 10))
const selectedCustomRecipeIds = ref<number[]>([])
const preferences = reactive<Record<number, RecipePreference>>({})
let saveTimer: ReturnType<typeof setTimeout> | null = null

const macroRatios = reactive({ protein: 0.3, fat: 0.25, carbs: 0.45 })
const meals = reactive([
  { key: 'breakfast', type: 'breakfast', title: 'Завтрак', percent: 0.25, maxItems: 2 },
  { key: 'lunch', type: 'lunch', title: 'Обед', percent: 0.35, maxItems: 3 },
  { key: 'snack', type: 'snack', title: 'Перекус', percent: 0.1, maxItems: 2 },
  { key: 'dinner', type: 'dinner', title: 'Ужин', percent: 0.3, maxItems: 3 }
])
const mealTypeItems = [
  { value: 'breakfast', title: 'Завтрак' },
  { value: 'lunch', title: 'Обед' },
  { value: 'dinner', title: 'Ужин' },
  { value: 'snack', title: 'Перекус' },
  { value: 'any', title: 'Любой' }
]

const hydratePreferences = () => {
  const allRecipes = [...(settings.value?.baseRecipes || []), ...(settings.value?.customRecipes || [])]
  const existing = new Map((settings.value?.preferences || []).map(pref => [pref.recipeId, pref]))
  for (const recipe of allRecipes) {
    preferences[recipe.id] = {
      recipeId: recipe.id,
      enabled: existing.get(recipe.id)?.enabled ?? true,
      includeInGeneration: existing.get(recipe.id)?.includeInGeneration ?? false,
      maxPerWeek: existing.get(recipe.id)?.maxPerWeek ?? (recipe.isBase ? 4 : 3)
    }
  }
  selectedCustomRecipeIds.value = (settings.value?.customRecipes || [])
    .filter(recipe => preferences[recipe.id]?.includeInGeneration)
    .map(recipe => recipe.id)
}

const preferenceFor = (recipe: Recipe) => {
  if (!preferences[recipe.id]) {
    preferences[recipe.id] = {
      recipeId: recipe.id,
      enabled: true,
      includeInGeneration: false,
      maxPerWeek: recipe.isBase ? 4 : 3
    }
  }
  return preferences[recipe.id]
}

const setCustomRecipeEnabled = (recipe: Recipe, enabled: boolean) => {
  const current = new Set(selectedCustomRecipeIds.value)
  if (enabled) current.add(recipe.id)
  else current.delete(recipe.id)
  selectedCustomRecipeIds.value = Array.from(current)
  preferenceFor(recipe).includeInGeneration = enabled
  scheduleSavePreferences()
}

const savePreferences = async () => {
  savingPreferences.value = true
  try {
    for (const recipe of settings.value?.customRecipes || []) {
      preferenceFor(recipe).includeInGeneration = selectedCustomRecipeIds.value.includes(recipe.id)
    }
    await api.saveMenuPreferences(Object.values(preferences))
  } finally {
    savingPreferences.value = false
  }
}

const scheduleSavePreferences = () => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(savePreferences, 400)
}

const planDays = computed(() => {
  if (!plan.value) return []
  const groupsByDay = new Map<number, Map<string, MealPlanItem[]>>()
  for (const item of plan.value.items) {
    const day = groupsByDay.get(item.dayIndex) || new Map<string, MealPlanItem[]>()
    day.set(item.mealType, [...(day.get(item.mealType) || []), item])
    groupsByDay.set(item.dayIndex, day)
  }

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startDate.value)
    date.setDate(date.getDate() + index)
    const groups = Array.from((groupsByDay.get(index) || new Map()).entries()).map(([type, items]) => ({ type, items }))
    return {
      index,
      title: `День ${index + 1}`,
      subtitle: date.toLocaleDateString(),
      free: index >= 6,
      groups
    }
  })
})

const mealTitle = (type: string) => meals.find(meal => meal.type === type)?.title || type
const formatMealTypes = (types: string[]) => {
  if (!types.length) return 'Любой'
  return types.map(type => mealTypeItems.find(item => item.value === type)?.title || type).join(', ')
}
const recipeTitleById = (id: number) => {
  const all = [...(settings.value?.customRecipes || []), ...(settings.value?.baseRecipes || [])]
  return all.find(r => r.id === id)?.title || `#${id}`
}

const recipeCollectionsMap = computed(() => {
  const map = new Map<number, string[]>()
  for (const collection of settings.value?.collections || []) {
    for (const item of collection.items || []) {
      const list = map.get(item.recipeId) || []
      list.push(collection.name)
      map.set(item.recipeId, list)
    }
  }
  for (const [key, value] of map.entries()) {
    map.set(key, Array.from(new Set(value)).sort((a, b) => a.localeCompare(b)))
  }
  return map
})

const recipeCollectionNames = (recipeId: number) => recipeCollectionsMap.value.get(recipeId) || []

const selectedCollection = computed(() => {
  if (!selectedCollectionId.value) return null
  return (settings.value?.collections || []).find(c => c.id === selectedCollectionId.value) || null
})

const selectedCollectionRecipeIds = computed(() => {
  return selectedCollection.value?.items?.map(item => item.recipeId) || []
})

const selectedRecipesForGeneration = computed(() => {
  const customRecipes = settings.value?.customRecipes || []
  const selectedByUser = new Set(selectedCustomRecipeIds.value)
  const selectedFromCollection = new Set(selectedCollectionRecipeIds.value)

  const result: Array<{ recipe: Recipe; from?: string }> = []
  for (const recipe of customRecipes) {
    const inUser = selectedByUser.has(recipe.id)
    const inCol = selectedFromCollection.has(recipe.id)
    if (!inUser && !inCol) continue

    let from: string | undefined
    if (inUser && inCol) from = "Выбрано + коллекция"
    else if (inUser) from = "Выбрано вручную"
    else from = "Из коллекции"

    result.push({ recipe, from })
  }

  return result.sort((a, b) => a.recipe.title.localeCompare(b.recipe.title))
})

const load = async () => {
  profile.value = await api.getProfile()
  history.value = await api.getMealPlans()
  settings.value = await api.getMenuSettings()
  hydratePreferences()
}

const generate = async () => {
  if (!profile.value?.calories) {
    ui.notify('Сначала создайте цель по калориям')
    return
  }

  loading.value = true
  try {
    await savePreferences()
    plan.value = await api.generateMenu({
      daysCount: 6,
      startDate: startDate.value,
      collectionId: selectedCollectionId.value,
      macroRatios,
      meals: meals.map(({ type, title, percent, maxItems }) => ({ type, title, percent, maxItems })),
      scoreWeights: { protein: 4, calories: 2, fat: 1, carbs: 1 }
    })
    history.value = await api.getMealPlans()
    ui.notify('Меню сгенерировано')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>
<style scoped>
.clear-table {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.2);
  border-radius: 8px;
  overflow: hidden;
}

.clear-table :deep(tbody tr) {
  transition: background-color 120ms ease;
}

.selected-row {
  background: rgba(var(--v-theme-primary), 0.08);
  box-shadow: inset 3px 0 0 rgb(var(--v-theme-primary));
}

.strong-checkbox :deep(.v-selection-control__input) {
  opacity: 1;
}

.summary-card {
  border-color: rgba(var(--v-theme-on-surface), 0.22) !important;
  border-radius: 8px;
  box-shadow: none;
}

.summary-list {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.14);
  border-radius: 8px;
}

.collection-preview {
  border-color: rgba(var(--v-theme-on-surface), 0.22) !important;
  border-radius: 8px;
  box-shadow: none;
}
</style>
