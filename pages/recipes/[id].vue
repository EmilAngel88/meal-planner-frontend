<template>
  <div v-if="recipe">
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5">{{ recipe.title }}</h1>
      <v-spacer />
      <v-chip v-if="recipe.isBase" class="mr-2" variant="tonal">Базовый</v-chip>
      <v-btn v-if="recipe.isBase" color="primary" :loading="copying" @click="copyBaseRecipe">Скопировать к себе</v-btn>
      <v-btn v-else color="primary" @click="edit=true">Редактировать</v-btn>
    </div>
    <p class="mb-4">{{ recipe.description }}</p>

    <div class="d-flex align-center mb-2">
      <h2 class="text-h6">Ингредиенты</h2>
      <v-spacer />
      <v-btn
        v-if="recipe.ingredients?.length && !recipe.isBase"
        color="primary"
        size="small"
        :loading="savingIngredients"
        @click="saveIngredients"
      >
        Сохранить вес
      </v-btn>
    </div>

    <v-row v-if="recipe.ingredients?.length" class="mb-4">
      <v-col cols="6" md="3">
        <v-sheet border rounded class="pa-3">
          <div class="text-caption text-medium-emphasis">Ккал</div>
          <div class="text-h6">{{ nutrition.calories }}</div>
        </v-sheet>
      </v-col>
      <v-col cols="6" md="3">
        <v-sheet border rounded class="pa-3">
          <div class="text-caption text-medium-emphasis">Белки</div>
          <div class="text-h6">{{ nutrition.protein }} г</div>
        </v-sheet>
      </v-col>
      <v-col cols="6" md="3">
        <v-sheet border rounded class="pa-3">
          <div class="text-caption text-medium-emphasis">Жиры</div>
          <div class="text-h6">{{ nutrition.fat }} г</div>
        </v-sheet>
      </v-col>
      <v-col cols="6" md="3">
        <v-sheet border rounded class="pa-3">
          <div class="text-caption text-medium-emphasis">Углеводы</div>
          <div class="text-h6">{{ nutrition.carbs }} г</div>
        </v-sheet>
      </v-col>
    </v-row>

    <v-table v-if="recipe.ingredients?.length">
      <thead>
        <tr>
          <th>Продукт</th>
          <th style="width: 180px">Вес (г)</th>
          <th class="text-right">Ккал</th>
          <th class="text-right">Б</th>
          <th class="text-right">Ж</th>
          <th class="text-right">У</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(ing,idx) in recipe.ingredients" :key="idx">
          <td>{{ ing.product?.name || ing.productId }}</td>
          <td>
            <v-text-field
              v-model.number="ing.weight"
              density="compact"
              hide-details
              min="1"
              type="number"
              variant="outlined"
              :readonly="recipe.isBase"
            />
          </td>
          <td class="text-right">{{ ingredientNutrition(ing).calories }}</td>
          <td class="text-right">{{ ingredientNutrition(ing).protein }}</td>
          <td class="text-right">{{ ingredientNutrition(ing).fat }}</td>
          <td class="text-right">{{ ingredientNutrition(ing).carbs }}</td>
        </tr>
      </tbody>
    </v-table>
    <div v-else class="text-medium-emphasis">Ингредиенты пока не добавлены</div>

    <template v-if="!recipe.isBase">
      <v-divider class="my-6" />

      <h3 class="text-subtitle-1 mb-2">Добавить ингредиент</h3>
      <v-row>
        <v-col cols="12" md="6">
          <v-autocomplete v-model="newIng.productId" :items="products" item-title="name" item-value="id"
                          label="Продукт" :loading="loadingProducts" @update:search="searchProducts"/>
        </v-col>
        <v-col cols="12" md="3"><v-text-field v-model.number="newIng.weight" label="Вес (г)" type="number" /></v-col>
        <v-col cols="12" md="3"><v-btn class="mt-1" @click="addIngredient">Добавить</v-btn></v-col>
      </v-row>
    </template>

    <v-dialog v-model="edit" max-width="640">
      <v-card>
        <v-card-title>Редактирование</v-card-title>
        <v-card-text>
          <v-text-field v-model="local.title" label="Название" />
          <v-textarea v-model="local.description" label="Описание" />
          <v-select
            v-model="local.mealTypes"
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
          <v-spacer /><v-btn variant="text" @click="edit=false">Отмена</v-btn>
          <v-btn color="primary" @click="save">Сохранить</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
  <div v-else>Загрузка…</div>
</template>
<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useRouter } from 'vue-router'
import { useRecipesStore } from '~/stores/recipes'
import { storeToRefs } from 'pinia'
const route = useRoute()
const router = useRouter()
const id = Number(route.params.id)
const store = useRecipesStore()
const { current: recipe } = storeToRefs(store)
const edit = ref(false)
const local = reactive({ title: '', description: '', mealTypes: [] as string[] })
const products = computed(() => store.products)
const newIng = reactive<{ productId: number | null, weight: number | null }>({ productId: null, weight: null })
const loadingProducts = ref(false)
const savingIngredients = ref(false)
const copying = ref(false)
const mealTypeItems = [
  { value: 'breakfast', title: 'Завтрак' },
  { value: 'lunch', title: 'Обед' },
  { value: 'dinner', title: 'Ужин' },
  { value: 'snack', title: 'Перекус' },
  { value: 'any', title: 'Любой' }
]

const round = (value: number) => Math.round(value * 10) / 10
const ingredientNutrition = (ing: { weight: number, product?: { calories: number, protein: number, fat: number, carbs: number } }) => {
  const multiplier = (ing.weight || 0) / 100
  const product = ing.product

  return {
    calories: round((product?.calories || 0) * multiplier),
    protein: round((product?.protein || 0) * multiplier),
    fat: round((product?.fat || 0) * multiplier),
    carbs: round((product?.carbs || 0) * multiplier)
  }
}
const nutrition = computed(() => {
  const ingredients = recipe.value?.ingredients || []
  const total = ingredients.reduce((acc, ing) => {
    const item = ingredientNutrition(ing)
    acc.calories += item.calories
    acc.protein += item.protein
    acc.fat += item.fat
    acc.carbs += item.carbs
    return acc
  }, { calories: 0, protein: 0, fat: 0, carbs: 0 })

  return {
    calories: round(total.calories),
    protein: round(total.protein),
    fat: round(total.fat),
    carbs: round(total.carbs)
  }
})

onMounted(async () => {
  await store.fetchOne(id)
  Object.assign(local, {
    title: recipe.value?.title || '',
    description: recipe.value?.description || '',
    mealTypes: recipe.value?.mealTypes || []
  })
})

const save = async () => { await store.update(id, local); edit.value=false }
const searchProducts = async (q: string) => { loadingProducts.value = true; try { await store.fetchProducts(q) } finally { loadingProducts.value = false } }
const addIngredient = async () => {
  if (!newIng.productId || !newIng.weight) return
  const payload = { ingredients: [...(recipe.value?.ingredients || []), { productId: newIng.productId, weight: newIng.weight }] }
  await store.update(id, payload as any); newIng.productId = null; newIng.weight = null
}
const saveIngredients = async () => {
  const ingredients = recipe.value?.ingredients || []
  if (!ingredients.length) return

  savingIngredients.value = true
  try {
    await store.update(id, {
      ingredients: ingredients.map(ing => ({
        productId: ing.productId,
        weight: ing.weight
      }))
    })
  } finally {
    savingIngredients.value = false
  }
}
const copyBaseRecipe = async () => {
  copying.value = true
  try {
    const copied = await store.copy(id)
    await router.push(`/recipes/${copied.id}`)
  } finally {
    copying.value = false
  }
}
</script>
