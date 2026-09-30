<template>
  <div v-if="recipe" class="recipe-detail">
    <NuxtLink to="/recipes" class="back-link">← Все рецепты</NuxtLink>
    <div class="mp-page-head detail-head">
      <div class="mp-page-head__meta"><div class="recipe-eyebrow"><span>{{ recipe.isBase ? 'Из библиотеки Рациона' : 'Моя кулинарная книга' }}</span><span>{{ mealLabels }}</span></div><h1 class="mp-page-title">{{ recipe.title }}</h1><p v-if="recipe.description" class="mp-page-subtitle recipe-description">{{ recipe.description }}</p></div>
      <v-btn v-if="recipe.isBase" color="primary" :loading="copying" @click="copyBaseRecipe">Сохранить свою версию</v-btn><v-btn v-else variant="outlined" :disabled="savingIngredients" @click="openEdit">Описание и приготовление</v-btn>
    </div>
    <v-alert v-if="loadError" type="error" variant="tonal" class="mb-5">{{ loadError }} <v-btn variant="text" @click="load">Повторить</v-btn></v-alert>
    <div v-if="!recipe.isBase" class="recipe-mode-switch"><button :class="{ active: !editingIngredients }" :disabled="isDirty" @click="editingIngredients = false">Приготовить</button><button :class="{ active: editingIngredients }" @click="editingIngredients = true">Редактировать состав</button><span v-if="isDirty">Сохраните или отмените изменения состава.</span></div>
    <div class="detail-layout">
      <RecipeCooking v-if="!editingIngredients" :recipe="recipe" />
      <section v-else class="ingredient-panel">
        <div class="panel-heading"><div><span class="section-kicker">В основе блюда</span><h2>Ингредиенты</h2></div><span class="count-badge">{{ ingredients.length }}</span></div>
        <div class="servings-control"><div><strong>Выход исходного рецепта</strong><p>На сколько порций делится весь состав ниже. Это меняет КБЖУ порции, но не количество ингредиентов. Для готовки большей партии используйте вкладку «Приготовить».</p></div><div v-if="!recipe.isBase" class="servings-stepper"><button :disabled="Number(servings) <= 1 || savingIngredients" aria-label="Уменьшить количество порций" @click="servings = Math.max(1, Number(servings) - 1)">−</button><input v-model.number="servings" type="number" min="1" max="50" :disabled="savingIngredients" aria-label="Количество порций" /><button :disabled="Number(servings) >= 50 || savingIngredients" aria-label="Увеличить количество порций" @click="servings = Math.min(50, Number(servings) + 1)">+</button></div><strong v-else class="servings-value">{{ servings }}</strong></div>
        <div v-if="ingredients.length" class="ingredient-list">
          <div class="ingredient-list__labels"><span>Продукт</span><span>На весь исходный рецепт</span></div>
          <div v-for="(ing, index) in ingredients" :key="ing.productId" class="ingredient-row"><span class="ingredient-row__index">{{ String(index + 1).padStart(2, '0') }}</span><div class="ingredient-row__name"><strong>{{ productLabel(ing.product) }}</strong><span>{{ stateLabel(ing.product) }} · {{ ingredientNutrition(ing).calories }} ккал · Б {{ ingredientNutrition(ing).protein }} · Ж {{ ingredientNutrition(ing).fat }} · У {{ ingredientNutrition(ing).carbs }}</span></div><v-text-field v-if="!recipe.isBase" :model-value="round(quantityForWeight(ing.product, ing.weight))" class="ingredient-row__weight" :aria-label="`Количество: ${productLabel(ing.product)}`" @update:model-value="ing.weight = weightForQuantity(ing.product, Number($event))" density="compact" hide-details min="0.1" step="any" type="number" :suffix="unitLabel(ing.product)" :disabled="savingIngredients" /><strong v-else class="ingredient-row__readonly mp-num">{{ ing.weight }} <span>г</span></strong><button v-if="!recipe.isBase" class="ingredient-replace" :disabled="savingIngredients" :aria-label="`Заменить ${productLabel(ing.product)}`" @click="openReplacement(index)">↔</button><button v-if="!recipe.isBase" class="ingredient-remove" :disabled="savingIngredients" :aria-label="`Убрать ${ing.product?.name || 'ингредиент'}`" @click="removeIngredient(index)">×</button></div>
        </div>
        <div v-else class="ingredients-empty"><div aria-hidden="true">＋</div><h3>С чего начнём?</h3><p>Добавьте продукты и их вес. Пищевая ценность блюда появится автоматически.</p></div>
        <div v-if="!recipe.isBase" class="add-ingredient"><h3>Добавить продукт</h3><form class="add-ingredient__form" @submit.prevent="addIngredient"><v-autocomplete v-model="newIng.productId" class="add-ingredient__product" :items="products.filter(p => !p.isArchived)" :item-title="productLabel" item-value="id" label="Найти продукт" no-data-text="Продукт не найден" :loading="loadingProducts" hide-details clearable :disabled="savingIngredients" /><v-text-field v-model.number="newIng.weight" class="add-ingredient__weight" label="Количество" :suffix="unitLabel(newProduct)" min="0.1" step="any" type="number" hide-details :disabled="savingIngredients" /><v-btn color="primary" variant="tonal" type="submit" :disabled="!newIng.productId || !newIng.weight || savingIngredients">Добавить</v-btn></form><p>Нет нужного ингредиента? <button class="inline-product-create" @click="productDialog = true">Добавьте по этикетке прямо здесь ↗</button></p></div>
        <div v-if="!recipe.isBase" class="ingredient-save"><span aria-live="polite">{{ isDirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены' }}</span><div><v-btn v-if="isDirty" variant="text" :disabled="savingIngredients" @click="resetDraft">Отменить</v-btn><v-btn color="primary" :disabled="!isDirty || saving" :loading="savingIngredients" @click="saveIngredients">Сохранить состав</v-btn></div></div>
      </section>
      <aside class="detail-aside">
        <section class="nutrition-panel"><span class="section-kicker">Пищевая ценность</span><h2>Одна порция</h2><div class="nutrition-energy"><strong class="mp-num">{{ nutrition.calories }}</strong><span>ккал</span></div><div class="macro-bar" aria-hidden="true"><i v-for="macro in macroDistribution" :key="macro.key" :class="`macro-bar--${macro.key}`" :style="{ flex: macro.value }" /></div><dl class="nutrition-macros"><div><dt><i class="protein-dot" />Белки</dt><dd>{{ nutrition.protein }} <span>г</span></dd></div><div><dt><i class="fat-dot" />Жиры</dt><dd>{{ nutrition.fat }} <span>г</span></dd></div><div><dt><i class="carbs-dot" />Углеводы</dt><dd>{{ nutrition.carbs }} <span>г</span></dd></div></dl><p class="nutrition-note">{{ ingredients.length ? 'Размер партии не меняет КБЖУ одной порции. Состав и выход рецепта — меняют.' : 'Добавьте ингредиенты, чтобы рассчитать пищевую ценность.' }}</p></section>
        <section v-if="recipe.isBase" class="planning-panel"><span class="section-kicker">В вашей неделе</span><h3>Предлагать это блюдо</h3><p>Рацион сможет включать его в новое меню.</p><v-switch v-model="baseGenerationEnabled" color="primary" hide-details inset :label="baseGenerationEnabled ? 'Добавлять в меню' : 'Не добавлять в меню'" :loading="savingGeneration" @update:model-value="saveBaseGenerationPreference" /><v-select v-model="baseMaxPerWeek" :items="[1, 2, 3, 4, 5, 6, 7]" label="Не чаще раз в неделю" hide-details :disabled="!baseGenerationEnabled" class="mt-3" @update:model-value="saveBaseGenerationPreference" /><p class="planning-panel__hint" role="status">{{ savingGeneration ? 'Сохраняем выбор…' : generationSaveError ? 'Изменения пока не сохранены' : 'Сохраняется автоматически.' }}</p><div v-if="generationSaveError" class="planning-panel__error" role="alert"><p>Не удалось сохранить настройку. {{ generationSaveError }}</p><v-btn variant="text" color="primary" size="small" :loading="savingGeneration" @click="retryGenerationPreference">Повторить</v-btn></div></section>
        <section v-else class="recipe-tip"><span aria-hidden="true">↗</span><p>Готовый рецепт можно добавить в свою коллекцию и использовать при планировании недели.</p><NuxtLink to="/menu">К моей неделе →</NuxtLink></section>
      </aside>
    </div>
    <v-dialog v-model="leaveConfirmationOpen" max-width="470" persistent><v-card class="detail-dialog"><v-card-title>Настройка ещё не сохранена</v-card-title><v-card-text>Не удалось сохранить выбор блюда для меню. Можно остаться и повторить попытку или уйти без сохранения этой настройки.</v-card-text><v-card-actions><v-btn variant="text" @click="finishLeaveDecision(false)">Остаться</v-btn><v-spacer /><v-btn color="primary" variant="flat" @click="finishLeaveDecision(true)">Уйти без сохранения</v-btn></v-card-actions></v-card></v-dialog>
    <v-dialog :model-value="edit" max-width="680" :persistent="saving" scrollable @update:model-value="!$event && closeEdit()"><v-card class="detail-dialog"><v-card-title>О вашем блюде</v-card-title><v-card-text><v-form ref="metadataForm" :disabled="saving" @submit.prevent="save"><v-text-field v-model="local.title" label="Название блюда" maxlength="200" :rules="[requiredTitle]" /><v-textarea v-model="local.description" label="Короткое описание" rows="2" /><v-select v-model="local.mealTypes" chips clearable :items="mealTypeItems" item-title="title" item-value="value" label="Когда готовим?" multiple /><v-select v-model="local.cookingMode" :items="cookingModes" label="Как организовать готовку" /><div class="recipe-meta-row"><v-text-field v-model.number="local.prepMinutes" :rules="[optionalMinutes]" label="Подготовка, мин" min="0" max="1440" type="number" clearable /><v-text-field v-model.number="local.cookMinutes" :rules="[optionalMinutes]" label="Приготовление, мин" min="0" max="1440" type="number" clearable /></div><v-textarea v-model="local.steps" label="Шаги приготовления" hint="Каждый шаг с новой строки. Указывайте время и признаки готовности." persistent-hint rows="5" /><v-textarea v-model="local.batchNotes" label="Что можно сделать заранее" rows="2" maxlength="2000" /><div class="recipe-meta-row"><v-text-field v-model.number="local.storageDays" :rules="[optionalStorageDays]" label="Хранение в холодильнике, дней" hint="0 — подавать сразу; пусто — не указано" persistent-hint type="number" min="0" max="4" clearable /><v-switch v-model="local.freezerFriendly" color="primary" label="Можно замораживать" /></div><v-textarea v-model="local.storageInstructions" label="Условия хранения и разогрева" rows="3" maxlength="2000" /><v-text-field v-model.number="local.cookedWeight" :rules="[optionalCookedWeight]" label="Измеренный вес исходной готовой партии, г" hint="Необязательно. Только фактический вес без посуды, на исходное число порций." persistent-hint type="number" min="1" max="100000" clearable /><v-alert v-if="metadataError" type="error" variant="tonal" role="alert">{{ metadataError }}</v-alert></v-form></v-card-text><v-card-actions><v-btn variant="text" :disabled="saving" @click="closeEdit">Отмена</v-btn><v-spacer /><v-btn color="primary" variant="flat" :loading="saving" :disabled="saving || !local.title.trim()" @click="save">Сохранить</v-btn></v-card-actions></v-card></v-dialog>
    <ProductEditor v-model="productDialog" @saved="productCreated" />
    <v-dialog v-model="replacementDialog" max-width="540"><v-card class="detail-dialog"><v-card-title>Заменить ингредиент</v-card-title><v-card-text><p class="replacement-intro">Выберите свою марку или другой продукт. Сохраним количество в исходных единицах; КБЖУ пересчитаются. Проверьте способ приготовления, если меняете сам продукт.</p><v-autocomplete v-model="replacementId" :items="replacementProducts" :item-title="productLabel" item-value="id" label="Продукт или марка" no-data-text="Сначала добавьте продукт по этикетке" /><p class="replacement-intro">Ваши варианты этого продукта показаны первыми.</p></v-card-text><v-card-actions><v-btn variant="text" @click="replacementDialog = false">Отмена</v-btn><v-spacer /><v-btn color="primary" :disabled="!replacementId" @click="replaceIngredient">Заменить</v-btn></v-card-actions></v-card></v-dialog>
  </div>
  <v-alert v-else-if="loadError" type="error" variant="tonal">{{ loadError }} <v-btn to="/recipes" variant="text">К рецептам</v-btn><v-btn variant="text" @click="load">Повторить</v-btn></v-alert>
  <div v-else class="detail-loading" role="status"><v-progress-circular color="primary" indeterminate size="30" /><p>Собираем ингредиенты…</p></div>
</template>
<script setup lang="ts">
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRecipesStore } from '~/stores/recipes'
import { storeToRefs } from 'pinia'
import { useApi, type RecipePreference, type Ingredient, type Product } from '~/composables/useApi'
import { productLabel, stateLabel, unitLabel, quantityForWeight, weightForQuantity, nutritionForWeight, recipeNutrition, cookingModes } from '~/utils/food'
import { errorMessage } from '~/utils/storage'
import { useUiStore } from '~/stores/ui'
definePageMeta({ key: route => String(route.params.id) })
const route = useRoute()
const router = useRouter()
const api = useApi()
const ui = useUiStore()
const id = Number(route.params.id)
const store = useRecipesStore()
const { current } = storeToRefs(store)
const recipe = computed(() => current.value?.id === id ? current.value : null)
useHead(() => ({ title: `${recipe.value?.title || 'Рецепт'} — Рацион` }))
const edit = ref(false)
const saving = ref(false)
const metadataForm = ref<{ validate: () => Promise<{ valid: boolean }> }>()
const metadataError = ref('')
const metadataSnapshot = ref('')
const requiredTitle = (value: string) => !!value.trim() || 'Введите название блюда'
const optionalNumber = (value: unknown, min: number, max: number, integer = false) => value === null || value === '' || typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value))
const optionalMinutes = (value: unknown) => optionalNumber(value, 0, 1440, true) || 'Целое число от 0 до 1 440 или пустое поле'
const optionalStorageDays = (value: unknown) => optionalNumber(value, 0, 4, true) || 'Целое число от 0 до 4 или пустое поле'
const optionalCookedWeight = (value: unknown) => optionalNumber(value, 1, 100000) || 'От 1 до 100 000 г или пустое поле'
const loadError = ref('')
const local = reactive({ title: '', description: '', mealTypes: [] as string[], steps: '', cookingMode: 'fresh', prepMinutes: null as number | null, cookMinutes: null as number | null, storageDays: null as number | null, storageInstructions: '', batchNotes: '', freezerFriendly: false, cookedWeight: null as number | null })
const metadataDirty = computed(() => edit.value && JSON.stringify(local) !== metadataSnapshot.value)
const closeEdit = () => {
  if (saving.value || metadataDirty.value && !confirm('Описание ещё не сохранено. Закрыть без сохранения?')) return
  edit.value = false
}
const editingIngredients = ref(false)
const productDialog = ref(false)
const replacementDialog = ref(false)
const replacementIndex = ref(0)
const replacementId = ref<number | null>(null)
const products = computed(() => store.products)
const ingredients = ref<Ingredient[]>([])
const servings = ref(1)
const newIng = reactive<{ productId: number | null, weight: number | null }>({ productId: null, weight: null })
const loadingProducts = ref(false)
const savingIngredients = ref(false)
const copying = ref(false)
const savingGeneration = ref(false)
const generationSaveError = ref('')
const leaveConfirmationOpen = ref(false)
const baseGenerationEnabled = ref(true)
const baseMaxPerWeek = ref(4)
let generationSaveTimer: ReturnType<typeof setTimeout> | null = null
let pendingGenerationSave = Promise.resolve()
let generationRevision = 0
let savedGenerationRevision = 0
let leaveDecision: Promise<boolean> | null = null
let resolveLeaveDecision: ((leave: boolean) => void) | null = null
const mealTypeItems = [{ value: 'breakfast', title: 'Завтрак' }, { value: 'lunch', title: 'Обед' }, { value: 'dinner', title: 'Ужин' }, { value: 'snack', title: 'Перекус' }, { value: 'any', title: 'Любой' }]
const mealLabels = computed(() => (recipe.value?.mealTypes || []).map(type => mealTypeItems.find(item => item.value === type)?.title).filter(Boolean).join(' · ') || 'На каждый день')
const snapshot = (items: Ingredient[], count: number) => JSON.stringify({ servings: count, ingredients: items.map(ing => ({ productId: ing.productId, weight: ing.weight })) })
const isDirty = computed(() => !recipe.value?.isBase && snapshot(ingredients.value, servings.value) !== snapshot(recipe.value?.ingredients || [], recipe.value?.servings || 1))
const resetDraft = () => { ingredients.value = (recipe.value?.ingredients || []).map(ing => ({ ...ing })); servings.value = recipe.value?.servings || 1 }
const round = (value: number) => Math.round(value * 10) / 10
const ingredientNutrition = (ing: Ingredient) => {
  const n = nutritionForWeight(ing.product, ing.weight)
  return { calories: round(n.calories), protein: round(n.protein), fat: round(n.fat), carbs: round(n.carbs) }
}
const nutrition = computed(() => {
  const n = recipeNutrition(ingredients.value, servings.value)
  return { calories: Math.round(n.calories), protein: round(n.protein), fat: round(n.fat), carbs: round(n.carbs) }
})
const newProduct = computed(() => products.value.find(p => p.id === newIng.productId))
const productCreated = (product: Product) => { store.products.unshift(product); newIng.productId = product.id; ui.notify('Продукт добавлен. Укажите его количество в рецепте.') }
const replacementProducts = computed(() => {
  const original = ingredients.value[replacementIndex.value]?.product
  const baseId = original?.baseProductId || original?.id
  return products.value.filter(p => !p.isArchived).slice().sort((a, b) => Number(b.baseProductId === baseId) - Number(a.baseProductId === baseId) || productLabel(a).localeCompare(productLabel(b), 'ru'))
})
const openReplacement = (index: number) => { replacementIndex.value = index; replacementId.value = null; replacementDialog.value = true }
const replaceIngredient = () => {
  const original = ingredients.value[replacementIndex.value]
  const product = products.value.find(p => p.id === replacementId.value)
  if (!product || !original) return
  const amount = quantityForWeight(original.product, original.weight)
  const weight = original.product?.unitType === product.unitType ? weightForQuantity(product, amount) : original.weight
  const existing = ingredients.value.find((i, index) => index !== replacementIndex.value && i.productId === product.id)
  if (existing) { existing.weight += weight; ingredients.value.splice(replacementIndex.value, 1) }
  else ingredients.value[replacementIndex.value] = { productId: product.id, product, weight }
  replacementDialog.value = false
}
const macroDistribution = computed(() => [{ key: 'protein', value: nutrition.value.protein * 4 }, { key: 'fat', value: nutrition.value.fat * 9 }, { key: 'carbs', value: nutrition.value.carbs * 4 }])
const load = async () => {
  loadError.value = ''
  store.current = null
  try { await store.fetchOne(id); resetDraft(); editingIngredients.value = !recipe.value?.isBase && !ingredients.value.length; if (recipe.value?.isBase) await loadBaseGenerationPreference(); else { loadingProducts.value = true; await store.fetchProducts() } }
  catch (error) { loadError.value = errorMessage(error) }
  finally { loadingProducts.value = false }
}
const warnBeforeUnload = (event: BeforeUnloadEvent) => {
  if (!isDirty.value && !metadataDirty.value && generationRevision <= savedGenerationRevision) return
  event.preventDefault()
  event.returnValue = ''
}
onMounted(() => { void load(); window.addEventListener('beforeunload', warnBeforeUnload) })
const openEdit = () => { const r = recipe.value; Object.assign(local, { title: r?.title || '', description: r?.description || '', mealTypes: [...(r?.mealTypes || [])], steps: (r?.instructions || []).join('\n'), cookingMode: r?.cookingMode || 'fresh', prepMinutes: r?.prepMinutes ?? null, cookMinutes: r?.cookMinutes ?? null, storageDays: r?.storageDays ?? null, storageInstructions: r?.storageInstructions || '', batchNotes: r?.batchNotes || '', freezerFriendly: r?.freezerFriendly || false, cookedWeight: r?.cookedWeight ?? null }); metadataSnapshot.value = JSON.stringify(local); metadataError.value = ''; edit.value = true }
const save = async () => {
  if (saving.value || !local.title.trim()) return
  saving.value = true
  metadataError.value = ''
  try {
    if (!(await metadataForm.value?.validate())?.valid) return
    const { steps, ...metadata } = local; await store.update(id, { ...metadata, title: local.title.trim(), mealTypes: local.mealTypes || [], instructions: steps.split('\n').map(s => s.trim()).filter(Boolean), prepMinutes: local.prepMinutes === null || String(local.prepMinutes) === '' ? null : Number(local.prepMinutes), cookMinutes: local.cookMinutes === null || String(local.cookMinutes) === '' ? null : Number(local.cookMinutes), storageDays: local.storageDays === null || String(local.storageDays) === '' ? null : Number(local.storageDays), cookedWeight: local.cookedWeight === null || String(local.cookedWeight) === '' ? null : Number(local.cookedWeight) }); edit.value = false; ui.notify('Рецепт сохранён') }
  catch (error) { metadataError.value = errorMessage(error) }
  finally { saving.value = false }
}
const addIngredient = () => {
  if (savingIngredients.value) return
  if (!newIng.productId || !Number.isFinite(newIng.weight) || Number(newIng.weight) <= 0) { ui.notify('Выберите продукт и укажите положительный вес', 'error'); return }
  const product = products.value.find(item => item.id === newIng.productId)
  if (!product) return
  const weight = weightForQuantity(product, Number(newIng.weight))
  const existing = ingredients.value.find(ing => ing.productId === newIng.productId)
  if (existing) existing.weight = Number(existing.weight || 0) + weight
  else ingredients.value.push({ productId: product.id, product, weight })
  newIng.productId = null
  newIng.weight = null
}
const removeIngredient = (index: number) => { if (!savingIngredients.value) ingredients.value.splice(index, 1) }
const saveIngredients = async () => {
  if (savingIngredients.value) return
  if (!Number.isInteger(servings.value) || servings.value < 1 || servings.value > 50) { ui.notify('Укажите от 1 до 50 порций', 'error'); return }
  if (ingredients.value.some(ing => !Number.isFinite(ing.weight) || ing.weight <= 0 || ing.weight > 100000)) { ui.notify('Вес каждого ингредиента должен быть больше нуля и не больше 100 000 г', 'error'); return }
  savingIngredients.value = true
  try { await store.update(id, { servings: servings.value, ingredients: ingredients.value.map(ing => ({ productId: ing.productId, weight: ing.weight })) }); resetDraft(); ui.notify('Состав и порции сохранены') }
  catch (error) { ui.error(error) }
  finally { savingIngredients.value = false }
}
const copyBaseRecipe = async () => {
  if (copying.value) return
  copying.value = true
  try { const copied = await store.copy(id); await router.push(`/recipes/${copied.id}`); ui.notify('Это ваша версия. Состав можно менять.') }
  catch (error) { ui.error(error) }
  finally { copying.value = false }
}
const loadBaseGenerationPreference = async () => { const settings = await api.getMenuSettings(); const pref = settings.preferences.find(item => item.recipeId === id); baseGenerationEnabled.value = pref?.enabled ?? true; baseMaxPerWeek.value = pref?.maxPerWeek ?? 4 }
const persistGenerationPreference = () => {
  if (generationSaveTimer) { clearTimeout(generationSaveTimer); generationSaveTimer = null }
  const preference: RecipePreference = { recipeId: id, enabled: baseGenerationEnabled.value, includeInGeneration: false, maxPerWeek: baseMaxPerWeek.value }
  const revision = generationRevision
  savingGeneration.value = true
  const request = pendingGenerationSave.catch(() => undefined).then(async () => {
    try {
      await api.saveMenuPreferences([preference])
      savedGenerationRevision = Math.max(savedGenerationRevision, revision)
      if (revision === generationRevision) generationSaveError.value = ''
    } catch (error) {
      if (revision === generationRevision) generationSaveError.value = errorMessage(error)
      throw error
    }
  })
  pendingGenerationSave = request
  return request.finally(() => { if (pendingGenerationSave === request) savingGeneration.value = false })
}
const retryGenerationPreference = () => { void persistGenerationPreference().catch(() => undefined) }
const saveBaseGenerationPreference = () => {
  if (!recipe.value?.isBase) return
  generationRevision += 1
  if (generationSaveTimer) clearTimeout(generationSaveTimer)
  generationSaveTimer = setTimeout(retryGenerationPreference, 400)
}
const confirmUnsavedLeave = () => {
  if (!leaveDecision) {
    leaveDecision = new Promise<boolean>(resolve => { resolveLeaveDecision = resolve })
    leaveConfirmationOpen.value = true
  }
  return leaveDecision
}
const finishLeaveDecision = (leave: boolean) => {
  leaveConfirmationOpen.value = false
  resolveLeaveDecision?.(leave)
  resolveLeaveDecision = null
  leaveDecision = null
}
const beforeNavigation = async (to: { path: string }) => {
  if (to.path === '/login') return
  if (savingIngredients.value || saving.value) { ui.notify('Дождитесь сохранения рецепта'); return false }
  if ((isDirty.value || metadataDirty.value) && !confirm('Изменения рецепта ещё не сохранены. Уйти без сохранения?')) return false
  try {
    if (generationSaveTimer || generationRevision > savedGenerationRevision || generationSaveError.value) await persistGenerationPreference()
    else await pendingGenerationSave
  } catch { return confirmUnsavedLeave() }
}
onBeforeRouteLeave(beforeNavigation)
onBeforeRouteUpdate(beforeNavigation)
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', warnBeforeUnload)
  if (generationSaveTimer) clearTimeout(generationSaveTimer)
  if (leaveDecision) finishLeaveDecision(false)
})
</script>
<style scoped>
.back-link { display: inline-block; color: var(--text-secondary); font-size: 12px; text-decoration: none; margin-bottom: 25px; }
.back-link:hover { color: #264b3f; }
.detail-head { justify-content: space-between; align-items: flex-start; gap: 30px; margin-bottom: 32px; }
.recipe-eyebrow { display: flex; flex-wrap: wrap; gap: 16px; color: var(--text-secondary); font-size: 11px; margin-bottom: 14px; }
.recipe-eyebrow span + span { color: #466445; }
.recipe-description { max-width: 680px; white-space: pre-line; }
.detail-layout { display: grid; grid-template-columns: minmax(0, 1fr) 285px; gap: 25px; align-items: start; }
.ingredient-panel, .planning-panel { border: 1px solid var(--border-subtle, #e1e6dc); background: #fff; border-radius: 20px; }
.panel-heading { display: flex; justify-content: space-between; align-items: center; padding: 26px 26px 20px; }
.section-kicker { display: block; color: var(--text-secondary); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 8px; }
.panel-heading h2, .nutrition-panel h2 { color: #264b3f; font: 28px/1.2 Georgia, serif; }
.count-badge { display: grid; place-items: center; width: 35px; height: 35px; background: #f0f3e8; border-radius: 50%; font-size: 13px; color: var(--text-secondary); }
.servings-control { margin: 0 26px 22px; border-radius: 12px; background: #f6f7f0; padding: 17px; display: flex; justify-content: space-between; gap: 16px; align-items: center; }
.servings-control strong { font-size: 12px; font-weight: 500; color: #44583d; }
.servings-control p { font-size: 12px; color: var(--text-secondary); margin-top: 5px; }
.servings-stepper { display: flex; align-items: center; background: #fff; border: 1px solid #e0e6d7; border-radius: 9px; flex-shrink: 0; }
.servings-stepper button { width: 30px; height: 36px; color: #264b3f; font-size: 19px; }
.servings-stepper button:disabled { opacity: .3; }
.servings-stepper input { width: 35px; padding: 0; text-align: center; appearance: textfield; -moz-appearance: textfield; font-size: 13px; color: #264b3f; outline-offset: 1px; }
.servings-stepper input::-webkit-inner-spin-button { -webkit-appearance: none; }
.servings-value { font-size: 24px !important; }
.ingredient-list { margin: 0 26px; }
.ingredient-list__labels { display: flex; justify-content: space-between; padding-bottom: 12px; color: var(--text-secondary); font-size: 12px; }
.ingredient-row { display: flex; align-items: center; gap: 12px; border-top: 1px solid #eef1e8; padding: 17px 0; }
.ingredient-row__index { font-size: 12px; color: var(--text-secondary); width: 17px; flex-shrink: 0; }
.ingredient-row__name { flex: 1; min-width: 0; }
.ingredient-row__name strong { color: #3f5239; font-size: 13px; font-weight: 500; display: block; }
.ingredient-row__name span { display: block; margin-top: 5px; font-size: 12px; color: var(--text-secondary); }
.ingredient-row__weight { max-width: 102px; flex-shrink: 0; }
.ingredient-row__weight :deep(input) { font-size: 12px; }
.ingredient-row__weight :deep(.v-field__suffix) { font-size: 11px; }
.ingredient-row__readonly { color: #3f5239; font-size: 14px; font-weight: 500; }
.ingredient-row__readonly span { font-size: 11px; color: var(--text-secondary); }
.ingredient-remove { color: var(--text-secondary); font-size: 22px; width: 24px; height: 36px; flex-shrink: 0; }
.ingredient-remove:hover { color: var(--text-secondary); }
.ingredients-empty { text-align: center; padding: 30px; }
.ingredients-empty > div { font-size: 30px; color: var(--text-secondary); }
.ingredients-empty h3 { color: #47613e; font-size: 16px; font-weight: 500; }
.ingredients-empty p { color: var(--text-secondary); font-size: 12px; max-width: 290px; line-height: 1.8; margin: 8px auto; }
.add-ingredient { border-top: 1px solid #edf0e6; padding: 24px 26px; }
.add-ingredient h3 { color: #465d3e; font-size: 12px; font-weight: 600; margin-bottom: 14px; }
.add-ingredient__form { display: flex; align-items: center; gap: 9px; }
.add-ingredient__product { min-width: 0; flex: 1; }
.add-ingredient__weight { max-width: 95px; }
.add-ingredient p { font-size: 12px; color: var(--text-secondary); margin-top: 13px; line-height: 1.8; }
.add-ingredient a { color: var(--text-secondary); text-underline-offset: 3px; }
.ingredient-save { display: flex; justify-content: space-between; align-items: center; gap: 10px; background: #f9faf6; border-top: 1px solid #e8ede0; border-radius: 0 0 20px 20px; padding: 16px 24px; }
.ingredient-save > span { color: var(--text-secondary); font-size: 12px; }
.ingredient-save > div { display: flex; gap: 4px; flex-shrink: 0; }
.detail-aside { display: grid; gap: 20px; }
.nutrition-panel { background: #eaf0db; border: 1px solid #e0e8cd; border-radius: 20px; padding: 26px; }
.nutrition-energy { display: flex; gap: 10px; align-items: baseline; margin: 27px 0 20px; color: #264b3f; }
.nutrition-energy strong { font-size: 60px; line-height: 1; letter-spacing: -.06em; font-weight: 400; }
.nutrition-energy > span { font-size: 12px; }
.macro-bar { height: 7px; border-radius: 9px; display: flex; overflow: hidden; gap: 3px; background: #dce6c9; margin-bottom: 23px; }
.macro-bar--protein, .protein-dot { background: #46694d; }
.macro-bar--fat, .fat-dot { background: #bba86a; }
.macro-bar--carbs, .carbs-dot { background: #99af75; }
.nutrition-macros > div { display: flex; justify-content: space-between; margin: 16px 0; font-size: 12px; color: #596b4c; }
.nutrition-macros dt { display: flex; align-items: center; gap: 8px; }
.nutrition-macros dt i { width: 6px; height: 6px; border-radius: 50%; }
.nutrition-macros dd { font-size: 16px; color: #264b3f; }
.nutrition-macros dd span { font-size: 12px; }
.nutrition-note { font-size: 12px; color: var(--text-secondary); line-height: 1.8; border-top: 1px solid #d5dfc2; padding-top: 17px; margin-top: 20px; }
.planning-panel { padding: 24px; }
.planning-panel h3 { font-weight: 500; font-size: 16px; color: #3f593a; }
.planning-panel > p { color: var(--text-secondary); font-size: 11px; line-height: 1.8; margin-top: 8px; }
.planning-panel :deep(.v-label) { font-size: 12px; }
.planning-panel__hint { font-size: 12px !important; }
.planning-panel__error { margin-top: 12px; padding: 12px; background: #fbf2e9; border: 1px solid #ecddce; border-radius: 10px; }
.planning-panel__error p { font-size: 11px; line-height: 1.6; color: var(--text-secondary); overflow-wrap: anywhere; }
.planning-panel__error .v-btn { margin: 7px 0 0 -8px; }
.recipe-tip { padding: 3px 10px; }
.recipe-tip > span { color: var(--text-secondary); font-size: 24px; }
.recipe-tip p { color: var(--text-secondary); font-size: 12px; line-height: 1.8; margin: 8px 0 15px; }
.recipe-tip a { color: #48643f; font-size: 12px; text-decoration: none; }
.detail-dialog { padding: 16px 8px 10px; }
.detail-dialog :deep(.v-card-title) { font: 27px/1.3 Georgia, serif; color: #264b3f; margin-bottom: 8px; white-space: normal; }
.detail-loading { display: grid; justify-items: center; padding: 80px 20px; gap: 18px; color: var(--text-secondary); font-size: 13px; }
@media (max-width: 1100px) { .detail-layout { grid-template-columns: minmax(0, 1fr); } .detail-aside { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 650px) { .detail-head { flex-direction: column; gap: 18px; } .detail-aside { grid-template-columns: minmax(0, 1fr); } .panel-heading, .add-ingredient { padding: 22px 17px; } .ingredient-list { margin: 0 17px; } .servings-control { margin: 0 17px 20px; padding: 13px; } .ingredient-row { gap: 8px; } .ingredient-row__index { display: none; } .ingredient-row__weight { max-width: 83px; } .ingredient-row__name span { font-size: 12px; } .ingredient-row__name strong { font-size: 12px; } .add-ingredient__form { flex-wrap: wrap; } .add-ingredient__product { flex-basis: calc(100% - 108px); } .add-ingredient__form > .v-btn { width: 100%; margin-top: 5px; } .ingredient-save { flex-direction: column; align-items: stretch; padding: 17px; } .ingredient-save > div { justify-content: flex-end; } .recipe-description { font-size: 13px; } }
</style>

<style scoped>
.recipe-mode-switch { display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:24px; }.recipe-mode-switch button { padding:10px 18px; font-size:12px; border-radius:10px; border:1px solid #dae3d2; color: var(--text-secondary); }.recipe-mode-switch button.active { background:#264b3f; color:white; border-color:#264b3f; }.recipe-mode-switch button:disabled { opacity:.5; }.recipe-mode-switch>span { font-size:11px; color: var(--text-secondary); }.ingredient-replace { color: var(--text-secondary); font-size:22px; width:27px; flex-shrink:0; }.inline-product-create { color:#426e3b; text-decoration:underline; text-align:left; }.recipe-meta-row { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:15px; }.replacement-intro { font-size:13px; color: var(--text-secondary); line-height:1.8; margin-bottom:18px; }.servings-control p { max-width:440px; line-height:1.6; }.detail-dialog :deep(.v-card-title) { white-space:normal; }@media(max-width:650px) { .recipe-meta-row { grid-template-columns:1fr; }.servings-control { flex-wrap:wrap; gap:15px; }.ingredient-row__weight { max-width:100px; min-width:82px; }.ingredient-row__name { min-width:0; }.ingredient-row__name strong { overflow-wrap:anywhere; } }
</style>
