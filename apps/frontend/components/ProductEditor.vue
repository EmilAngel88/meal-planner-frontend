<template>
  <v-dialog v-model="open" max-width="720" :persistent="saving" scrollable>
    <v-card class="product-editor">
      <v-card-title>{{ mode === 'edit' ? 'Изменить продукт' : mode === 'variant' ? 'Мой вариант продукта' : 'Продукт по этикетке' }}</v-card-title>
      <v-card-text>
        <p class="intro">{{ mode === 'variant' ? `Основа — ${product?.name}. Перенесите состав именно вашей упаковки: у разных марок он отличается.` : 'Добавьте продукт своей марки. Он будет доступен вам в рецептах и покупках.' }}</p>
        <v-form ref="formRef" :disabled="saving" @submit.prevent="save">
          <div class="two"><v-text-field v-model.trim="form.name" label="Продукт и жирность" placeholder="Творог 5%" maxlength="200" :rules="[required]" /><v-text-field v-model.trim="form.brand" label="Производитель или марка" maxlength="120" placeholder="Как на упаковке" /></div>
          <div class="two"><v-select v-model="form.foodGroup" :items="foodGroups" label="Группа продуктов" /><v-select v-model="form.preparationState" :items="foodStates" label="Состояние для расчёта" /></div>
          <div class="basis"><h3>Пищевая ценность с упаковки</h3><v-select v-model="form.nutritionBasis" :items="[{ title: 'На 100 г', value: '100g' }, { title: 'На 100 мл', value: '100ml' }]" label="На какое количество?" hide-details /></div>
          <p v-if="mode === 'variant'" class="hint">Значения ниже взяты из основы. Замените их данными этикетки.</p>
          <div class="macros"><v-text-field v-model.number="form.calories" label="Ккал" type="number" min="0" max="1000" step="any" :rules="[validEnergy]" /><v-text-field v-model.number="form.protein" label="Белки, г" type="number" min="0" max="100" step="any" :rules="[validMacro]" /><v-text-field v-model.number="form.fat" label="Жиры, г" type="number" min="0" max="100" step="any" :rules="[validMacro]" /><v-text-field v-model.number="form.carbs" label="Углеводы, г" type="number" min="0" max="100" step="any" :rules="[validMacro]" /></div>
          <div class="two"><v-select v-model="form.unitType" label="Отмеряем в рецепте" :items="[{ title: 'Граммы', value: 'gram' }, { title: 'Миллилитры', value: 'ml' }, { title: 'Штуки', value: 'piece' }]" /><v-text-field v-if="form.unitType === 'piece'" v-model.number="form.unitWeight" label="Съедобный вес штуки, г" hint="Без скорлупы, кожуры и костей" persistent-hint type="number" min="0.1" step="any" :rules="[positive]" /></div>
          <template v-if="form.unitType === 'ml' || form.nutritionBasis === '100ml'"><v-text-field v-model.number="form.density" label="Вес 1 мл, г" type="number" min="0.1" max="2" step="0.01" :rules="[validDensity]" /><p class="hint">Нужен для перевода граммов в миллилитры. Если нет данных, 1 г/мл — приближение для жидкости, похожей на воду. Для молока можно использовать около 1,03; для масла — около 0,91.</p></template>
          <v-textarea v-model="form.notes" label="Примечание — необязательно" placeholder="Например: вес после слива жидкости" rows="2" maxlength="2000" />
          <p v-if="mode === 'edit'" class="hint">Новые расчёты рецептов учтут изменения. Сохранённые меню и покупки сохранят прежние значения.</p>
          <v-alert v-if="saveError" type="error" variant="tonal" class="mb-4">{{ saveError }}</v-alert>
          <div class="actions"><v-btn variant="text" :disabled="saving" @click="open = false">Отмена</v-btn><v-btn type="submit" color="primary" :loading="saving">{{ mode === 'edit' ? 'Сохранить' : 'Добавить мой продукт' }}</v-btn></div>
        </v-form>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
<script setup lang="ts">
import { reactive, ref, watch, nextTick } from 'vue'
import { useApi, type Product, type ProductPayload } from '~/composables/useApi'
import { foodGroups, foodStates } from '~/utils/food'
import { errorMessage } from '~/utils/storage'
const open = defineModel<boolean>({ default: false })
const props = withDefaults(defineProps<{ product?: Product | null; mode?: 'create' | 'variant' | 'edit' }>(), { product: null, mode: 'create' })
const emit = defineEmits<{ saved: [product: Product] }>()
const api = useApi()
const saving = ref(false)
const saveError = ref('')
const formRef = ref()
const form = reactive({ name: '', brand: '', baseProductId: null as number | null, foodGroup: 'other', preparationState: 'as_sold', nutritionBasis: '100g', density: 1, notes: '', calories: null as number | null, protein: null as number | null, fat: null as number | null, carbs: null as number | null, unitType: 'gram', unitWeight: null as number | null, mealTypes: [] as string[], category: 'base' })
watch(open, async value => {
  if (!value) return
  const p = props.product
  Object.assign(form, { name: p?.name || '', brand: props.mode === 'edit' ? p?.brand || '' : '', baseProductId: props.mode === 'variant' ? p?.id || null : p?.baseProductId || null, foodGroup: p?.foodGroup || 'other', preparationState: p?.preparationState || 'as_sold', nutritionBasis: p?.nutritionBasis || '100g', density: p?.density || 1, notes: props.mode === 'edit' ? p?.notes || '' : '', calories: p?.calories ?? null, protein: p?.protein ?? null, fat: p?.fat ?? null, carbs: p?.carbs ?? null, unitType: p?.unitType || 'gram', unitWeight: p?.unitWeight ?? null, mealTypes: [...(p?.mealTypes || [])], category: p?.category || 'base' })
  saveError.value = ''
  await nextTick(); formRef.value?.resetValidation()
})
const required = (v: string) => !!v?.trim() || 'Введите название'
const validEnergy = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1000 || 'От 0 до 1000'
const validMacro = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100 || 'От 0 до 100'
const positive = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 100000 || 'Укажите положительный вес'
const validDensity = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0.1 && v <= 2 || 'От 0,1 до 2 г/мл'
const save = async () => {
  if (saving.value) return
  saving.value = true; saveError.value = ''
  try {
    if (!(await formRef.value?.validate())?.valid) return
    const payload: ProductPayload = { ...form, calories: form.calories!, protein: form.protein!, fat: form.fat!, carbs: form.carbs!, unitWeight: form.unitType === 'piece' ? form.unitWeight : null }
    const saved = props.mode === 'edit' && props.product ? await api.updateProduct(props.product.id, payload) : await api.createProduct(payload)
    emit('saved', saved); open.value = false
  } catch (error) { saveError.value = errorMessage(error) }
  finally { saving.value = false }
}
</script>
<style scoped>
.product-editor { padding: 16px 8px 8px; }.product-editor :deep(.v-card-title) { color: #264b3f; font: 27px/1.3 Georgia,serif; white-space: normal; }.intro,.hint { color: var(--text-secondary); font-size: 12px; line-height: 1.7; margin-bottom: 20px; }.two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; }.basis { display: flex; align-items: center; gap: 20px; margin: 8px 0 20px; }.basis h3 { font-size: 14px; font-weight: 500; }.basis .v-select { min-width: 175px; }.macros { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 12px; }.actions { display: flex; justify-content: space-between; gap: 10px; }@media(max-width:600px) { .two { grid-template-columns: 1fr; gap:0; }.macros { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }.basis { flex-direction: column; align-items: stretch; }.actions { flex-wrap: wrap; } }
</style>
