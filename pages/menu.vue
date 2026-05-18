<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5">Генерация меню</h1>
      <v-spacer />
      <v-btn color="primary" :loading="loading" @click="generate">Сгенерировать</v-btn>
    </div>

    <v-alert v-if="!profile?.calories" type="warning" class="mb-4">
      Сначала создайте цель по калориям в личном кабинете.
    </v-alert>

    <v-row class="mb-4">
      <v-col cols="12" md="3">
        <v-text-field :model-value="profile?.calories || 0" label="Цель, ккал" readonly />
      </v-col>
      <v-col cols="12" md="3">
        <v-text-field v-model.number="macroRatios.protein" label="Белки, доля" step="0.01" type="number" />
      </v-col>
      <v-col cols="12" md="3">
        <v-text-field v-model.number="macroRatios.fat" label="Жиры, доля" step="0.01" type="number" />
      </v-col>
      <v-col cols="12" md="3">
        <v-text-field v-model.number="macroRatios.carbs" label="Углеводы, доля" step="0.01" type="number" />
      </v-col>
    </v-row>

    <v-expansion-panels class="mb-4">
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
      <v-card-title>Итог меню</v-card-title>
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
      <v-col v-for="group in groupedItems" :key="group.type" cols="12" md="6">
        <v-card class="h-100">
          <v-card-title>{{ mealTitle(group.type) }}</v-card-title>
          <v-list>
            <v-list-item v-for="item in group.items" :key="item.id" :to="item.recipeId ? `/recipes/${item.recipeId}` : undefined">
              <v-list-item-title>{{ item.title }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ item.weight }} г · {{ item.calories }} ккал · Б {{ item.protein }} · Ж {{ item.fat }} · У {{ item.carbs }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>
    </v-row>

    <v-card v-if="history.length" class="mt-6">
      <v-card-title>Последние меню</v-card-title>
      <v-table>
        <thead>
          <tr><th>Дата</th><th>Ккал</th><th>Белки</th><th>Жиры</th><th>Углеводы</th></tr>
        </thead>
        <tbody>
          <tr v-for="item in history" :key="item.id">
            <td>{{ new Date(item.createdAt).toLocaleString() }}</td>
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
import { useApi, type MealPlan, type MealPlanItem, type Profile } from '~/composables/useApi'
import { useUiStore } from '~/stores/ui'

const api = useApi()
const ui = useUiStore()

const profile = ref<Profile | null>(null)
const plan = ref<MealPlan | null>(null)
const history = ref<MealPlan[]>([])
const loading = ref(false)
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
  { value: 'snack', title: 'Перекус' }
]

const groupedItems = computed(() => {
  if (!plan.value) return []
  const map = new Map<string, MealPlanItem[]>()
  for (const item of plan.value.items) {
    map.set(item.mealType, [...(map.get(item.mealType) || []), item])
  }
  return Array.from(map.entries()).map(([type, items]) => ({ type, items }))
})

const mealTitle = (type: string) => meals.find(meal => meal.type === type)?.title || type

const load = async () => {
  profile.value = await api.getProfile()
  history.value = await api.getMealPlans()
}

const generate = async () => {
  if (!profile.value?.calories) {
    ui.notify('Сначала создайте цель по калориям')
    return
  }

  loading.value = true
  try {
    plan.value = await api.generateMenu({
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
