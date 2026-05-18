<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5">Продукты</h1>
      <v-spacer />
      <v-text-field
        v-model="search"
        density="compact"
        hide-details
        label="Поиск"
        max-width="280"
        variant="outlined"
        @update:model-value="loadProducts"
      />
    </div>

    <v-card class="mb-6">
      <v-card-title>{{ editingId ? 'Редактировать продукт' : 'Новый продукт' }}</v-card-title>
      <v-card-text>
        <v-form ref="formRef" @submit.prevent="save">
          <v-row>
            <v-col cols="12" md="4">
              <v-text-field v-model.trim="form.name" label="Название" :rules="[required]" />
            </v-col>
            <v-col cols="12" md="8">
              <v-select
                v-model="form.mealTypes"
                chips
                clearable
                :items="mealTypeItems"
                item-title="title"
                item-value="value"
                label="Подходит для"
                multiple
              />
            </v-col>
            <v-col cols="12" sm="6" md="2">
              <v-text-field v-model.number="form.calories" label="Ккал / 100 г" min="0" type="number" :rules="[nonNegative]" />
            </v-col>
            <v-col cols="12" sm="6" md="2">
              <v-text-field v-model.number="form.protein" label="Белки" min="0" type="number" :rules="[nonNegative]" />
            </v-col>
            <v-col cols="12" sm="6" md="2">
              <v-text-field v-model.number="form.fat" label="Жиры" min="0" type="number" :rules="[nonNegative]" />
            </v-col>
            <v-col cols="12" sm="6" md="2">
              <v-text-field v-model.number="form.carbs" label="Углеводы" min="0" type="number" :rules="[nonNegative]" />
            </v-col>
          </v-row>

          <div class="d-flex ga-2">
            <v-btn color="primary" :loading="saving" type="submit">
              {{ editingId ? 'Сохранить' : 'Добавить' }}
            </v-btn>
            <v-btn v-if="editingId" variant="text" @click="resetForm">Отмена</v-btn>
          </div>
        </v-form>
      </v-card-text>
    </v-card>

    <v-table>
      <thead>
        <tr>
          <th>Название</th>
          <th>Типы</th>
          <th class="text-right">Ккал</th>
          <th class="text-right">Белки</th>
          <th class="text-right">Жиры</th>
          <th class="text-right">Углеводы</th>
          <th class="text-right"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td colspan="7" class="text-medium-emphasis">Загрузка...</td>
        </tr>
        <tr v-else-if="!products.length">
          <td colspan="7" class="text-medium-emphasis">Продуктов пока нет</td>
        </tr>
        <tr v-for="product in products" v-else :key="product.id">
          <td>{{ product.name }}</td>
          <td>{{ formatMealTypes(product.mealTypes || []) }}</td>
          <td class="text-right">{{ product.calories }}</td>
          <td class="text-right">{{ product.protein }}</td>
          <td class="text-right">{{ product.fat }}</td>
          <td class="text-right">{{ product.carbs }}</td>
          <td class="text-right">
            <v-btn size="small" variant="text" @click="edit(product)">Изменить</v-btn>
            <v-btn color="error" size="small" variant="text" @click="remove(product.id)">Удалить</v-btn>
          </td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import { useApi, type Product, type ProductPayload } from '~/composables/useApi'
import { useUiStore } from '~/stores/ui'

const api = useApi()
const ui = useUiStore()

const products = ref<Product[]>([])
const search = ref('')
const loading = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref()
const mealTypeItems = [
  { value: 'breakfast', title: 'Завтрак' },
  { value: 'lunch', title: 'Обед' },
  { value: 'dinner', title: 'Ужин' },
  { value: 'snack', title: 'Перекус' },
  { value: 'any', title: 'Любой' }
]

const emptyForm = (): ProductPayload => ({
  name: '',
  mealTypes: [],
  calories: 0,
  protein: 0,
  fat: 0,
  carbs: 0
})

const form = reactive<ProductPayload>(emptyForm())

const required = (value: string) => !!value || 'Заполните поле'
const nonNegative = (value: number) => Number.isFinite(value) && value >= 0 || 'Введите число не меньше 0'
const formatMealTypes = (types: string[]) => {
  if (!types.length) return 'Любой'
  return types.map(type => mealTypeItems.find(item => item.value === type)?.title || type).join(', ')
}

const loadProducts = async () => {
  loading.value = true
  try {
    products.value = await api.getProducts(search.value || undefined)
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  editingId.value = null
  Object.assign(form, emptyForm())
  formRef.value?.resetValidation()
}

const edit = (product: Product) => {
  editingId.value = product.id
  Object.assign(form, {
    name: product.name,
    mealTypes: product.mealTypes || [],
    calories: product.calories,
    protein: product.protein,
    fat: product.fat,
    carbs: product.carbs
  })
}

const save = async () => {
  const result = await formRef.value?.validate()
  if (!result?.valid) return

  saving.value = true
  try {
    if (editingId.value) {
      await api.updateProduct(editingId.value, form)
      ui.notify('Продукт обновлён')
    } else {
      await api.createProduct(form)
      ui.notify('Продукт добавлен')
    }

    resetForm()
    await loadProducts()
  } finally {
    saving.value = false
  }
}

const remove = async (id: number) => {
  await api.deleteProduct(id)
  ui.notify('Продукт удалён')
  await loadProducts()
}

onMounted(loadProducts)
</script>
