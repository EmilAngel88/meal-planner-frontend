<template>
  <div class="recipe-library">
    <div class="mp-page-head library-head">
      <div class="mp-page-head__meta">
        <span class="mp-overline">Кухня начинается с идеи</span>
        <h1 class="mp-page-title">Что будем готовить?</h1>
        <p class="mp-page-subtitle">Готовьте на один раз или сразу на несколько порций. Здесь — состав, шаги и хранение.</p>
      </div>
      <v-btn color="primary" size="large" @click="openCreate"><span class="button-plus">+</span> Свой рецепт</v-btn>
    </div>

    <div class="library-tabs" role="tablist" aria-label="Рецепты и коллекции">
      <button role="tab" :aria-selected="tab === 'recipes'" :class="{ active: tab === 'recipes' }" @click="tab = 'recipes'">Все рецепты <span>{{ recipes.length }}</span></button>
      <button role="tab" :aria-selected="tab === 'collections'" :class="{ active: tab === 'collections' }" @click="tab = 'collections'">Мои коллекции <span>{{ collections.length }}</span></button>
      <NuxtLink to="/products">Каталог продуктов <span aria-hidden="true">↗</span></NuxtLink>
    </div>

    <v-alert v-if="loadError" type="error" variant="tonal" class="mb-5">Не удалось загрузить библиотеку. {{ loadError }} <v-btn variant="text" @click="load">Повторить</v-btn></v-alert>
    <template v-if="tab === 'recipes'">
      <section class="library-controls" aria-label="Поиск и фильтры рецептов">
        <div class="library-controls__top">
          <v-text-field v-model="search" class="library-search" label="Найти блюдо или ингредиент" prepend-inner-icon="mdi-magnify" clearable hide-details />
          <div class="source-switch" aria-label="Источник рецептов">
            <button v-for="source in [{ value: 'all', title: 'Все' }, { value: 'mine', title: 'Мои' }, { value: 'base', title: 'Библиотека' }]" :key="source.value" :aria-pressed="sourceFilter === source.value" :class="{ active: sourceFilter === source.value }" @click="sourceFilter = source.value">{{ source.title }}</button>
          </div>
        </div>
        <div class="meal-filters" aria-label="Способ приготовления"><button :class="{ active: cookingFilter === 'all' }" :aria-pressed="cookingFilter === 'all'" @click="cookingFilter = 'all'">Любая готовка</button><button v-for="mode in cookingModes" :key="mode.value" :class="{ active: cookingFilter === mode.value }" :aria-pressed="cookingFilter === mode.value" @click="cookingFilter = mode.value">{{ mode.title }}</button></div>
        <div class="meal-filters" aria-label="Приём пищи">
          <button :class="{ active: mealFilter === 'all' }" :aria-pressed="mealFilter === 'all'" @click="mealFilter = 'all'">На весь день</button>
          <button v-for="meal in mealTypeItems.filter(item => item.value !== 'any')" :key="meal.value" :class="{ active: mealFilter === meal.value }" :aria-pressed="mealFilter === meal.value" @click="mealFilter = meal.value">{{ meal.title }}</button>
        </div>
      </section>
      <div class="library-results"><span>{{ sourceFilter === 'mine' ? 'Ваши любимые сочетания' : sourceFilter === 'base' ? 'Идеи для повседневного меню' : 'Вдохновение на каждый день' }}</span><span aria-live="polite">{{ filteredRecipes.length }} из {{ recipes.length }}</span></div>
      <div v-if="loading" class="recipe-grid" aria-busy="true" aria-label="Загрузка рецептов"><div v-for="n in 6" :key="n" class="recipe-placeholder"><span /><i /><i /><i /></div></div>
      <div v-else-if="filteredRecipes.length" class="recipe-grid"><RecipeCard v-for="r in pagedRecipes" :key="r.id" :recipe="r" :on-delete="remove" /></div>
      <section v-else-if="!loadError" class="library-empty">
        <span class="library-empty__symbol" aria-hidden="true">⌕</span>
        <h2>{{ recipes.length ? 'Пока без совпадений' : 'Здесь будет ваша кулинарная книга' }}</h2>
        <p>{{ recipes.length ? 'Попробуйте другой ингредиент или расширьте выбор.' : 'Добавьте первый рецепт — мы посчитаем его пищевую ценность и поможем включить в меню.' }}</p>
        <v-btn v-if="recipes.length" variant="outlined" @click="resetFilters">Сбросить фильтры</v-btn><v-btn v-else color="primary" @click="openCreate">Добавить рецепт</v-btn>
      </section>
      <v-pagination v-if="!loading && filteredRecipes.length > pageSize" v-model="page" :length="Math.ceil(filteredRecipes.length / pageSize)" :total-visible="5" aria-label="Страницы рецептов" next-aria-label="Следующая страница" previous-aria-label="Предыдущая страница" page-aria-label="Перейти на страницу {0}" current-page-aria-label="Страница {0}, текущая" class="mt-6" />
    </template>

    <template v-else>
      <div class="collection-intro"><div><h2>Ваши подборки на любой случай</h2><p>Соберите свои рецепты в коллекции и выбирайте их при планировании недели.</p></div><v-btn color="primary" variant="outlined" @click="openCollectionDialog()">Создать коллекцию</v-btn></div>
      <v-progress-linear v-if="loading" indeterminate color="primary" />
      <div v-else-if="collections.length" class="collection-grid">
        <article v-for="collection in collections" :key="collection.id" class="collection-card">
          <span class="collection-card__label">Моя коллекция · {{ collection.items.length }} рец.</span><h3>{{ collection.name }}</h3>
          <div class="collection-card__recipes"><span v-for="item in collection.items.slice(0, 4)" :key="item.id">{{ recipeTitle(item.recipeId) }}</span><span v-if="collection.items.length > 4">Ещё {{ collection.items.length - 4 }}</span><span v-if="!collection.items.length">Добавьте рецепты в эту подборку</span></div>
          <div class="collection-card__actions"><v-btn variant="text" @click="openCollectionDialog(collection)">Изменить подборку</v-btn><v-btn color="error" variant="text" size="small" @click="removeCollection(collection.id)">Удалить</v-btn></div>
        </article>
      </div>
      <section v-else-if="!loadError" class="library-empty"><span class="library-empty__symbol" aria-hidden="true">≡</span><h2>У хороших рецептов есть компания</h2><p>«Быстрые ужины», «Любимые завтраки» — соберите свою первую подборку.</p><v-btn color="primary" @click="openCollectionDialog()">Создать коллекцию</v-btn></section>
    </template>

    <v-dialog v-model="dialog" max-width="600" scrollable :persistent="creating"><v-card class="library-dialog"><v-card-title>Ваш новый рецепт</v-card-title><v-card-text><p class="dialog-intro">Начните с названия. Состав и количество порций добавим на следующем шаге.</p><v-text-field v-model="title" :disabled="creating" autofocus label="Название блюда" maxlength="200" /><v-textarea v-model="description" :disabled="creating" maxlength="2000" label="Короткое описание" rows="3" /><v-select v-model="mealTypes" :disabled="creating" chips clearable :items="mealTypeItems" item-title="title" item-value="value" label="Когда готовим?" multiple /></v-card-text><v-card-actions><v-btn variant="text" :disabled="creating" @click="dialog = false">Отмена</v-btn><v-spacer /><v-btn color="primary" variant="flat" :loading="creating" :disabled="creating || !title.trim()" @click="create">Перейти к составу →</v-btn></v-card-actions></v-card></v-dialog>
    <v-dialog v-model="collectionDialog" max-width="680" scrollable :persistent="savingCollection"><v-card class="library-dialog"><v-card-title>{{ editingCollectionId ? 'Изменить коллекцию' : 'Новая коллекция' }}</v-card-title><v-card-text><v-text-field v-model.trim="collectionName" label="Название подборки" maxlength="120" :disabled="savingCollection" /><v-text-field v-model.trim="collectionSearch" clearable prepend-inner-icon="mdi-magnify" label="Найти среди моих рецептов" /><p class="dialog-intro">Выбрано: {{ collectionRecipeIds.length }}. В коллекцию можно добавить свои рецепты и копии блюд из библиотеки.</p><div v-if="customRecipes.length" class="select-list"><label v-for="recipe in filteredCollectionRecipes" :key="recipe.id" class="select-row" :class="{ 'select-row--active': collectionRecipeIds.includes(recipe.id) }"><v-checkbox color="primary" density="compact" hide-details :disabled="savingCollection" :model-value="collectionRecipeIds.includes(recipe.id)" :aria-label="`Включить ${recipe.title}`" @update:model-value="toggleCollectionRecipe(recipe.id, Boolean($event))" /><div><strong>{{ recipe.title }}</strong><small>{{ formatMealTypes(recipe.mealTypes || []) }}</small></div></label><p v-if="!filteredCollectionRecipes.length" class="pa-4 text-medium-emphasis">Рецепты не найдены.</p></div><v-alert v-else type="info" variant="tonal">Сначала добавьте свой рецепт или сохраните копию из библиотеки.</v-alert></v-card-text><v-card-actions><v-btn variant="text" :disabled="savingCollection" @click="closeCollectionDialog">Отмена</v-btn><v-spacer /><v-btn color="primary" variant="flat" :loading="savingCollection" :disabled="savingCollection || !collectionName.trim()" @click="saveCollection">Сохранить подборку</v-btn></v-card-actions></v-card></v-dialog>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRecipesStore } from '~/stores/recipes'
import { storeToRefs } from 'pinia'
import RecipeCard from '~/components/RecipeCard.vue'
import { useApi, type RecipeCollection } from '~/composables/useApi'
import { cookingModes, productLabel } from '~/utils/food'
import { errorMessage } from '~/utils/storage'
import { useUiStore } from '~/stores/ui'
useHead({ title: 'Рецепты — Рацион' })
const api = useApi()
const ui = useUiStore()
const store = useRecipesStore()
const { list: recipes } = storeToRefs(store)
const tab = ref('recipes')
const search = ref('')
const page = ref(1), pageSize = 24
const mealFilter = ref('all')
const sourceFilter = ref('all')
const cookingFilter = ref('all')
const loading = ref(true)
const loadError = ref('')
const creating = ref(false)
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
const filteredRecipes = computed(() => {
  const query = (search.value || '').trim().toLowerCase()
  return recipes.value.filter(recipe => {
    const matchesSource = sourceFilter.value === 'all' || (sourceFilter.value === 'mine' ? !recipe.isBase : recipe.isBase)
    const matchesMeal = mealFilter.value === 'all' || !recipe.mealTypes?.length || recipe.mealTypes.includes('any') || recipe.mealTypes.includes(mealFilter.value)
    const haystack = [recipe.title, recipe.description || '', ...(recipe.ingredients || []).map(ing => productLabel(ing.product))].join(' ').toLowerCase()
    return (cookingFilter.value === 'all' || recipe.cookingMode === cookingFilter.value) && matchesSource && matchesMeal && (!query || haystack.includes(query))
  })
})
const pagedRecipes = computed(() => filteredRecipes.value.slice((page.value - 1) * pageSize, page.value * pageSize))
watch([search, mealFilter, sourceFilter, cookingFilter], () => { page.value = 1 })
watch(() => filteredRecipes.value.length, length => { page.value = Math.min(page.value, Math.max(1, Math.ceil(length / pageSize))) })
const resetFilters = () => { search.value = ''; mealFilter.value = 'all'; sourceFilter.value = 'all'; cookingFilter.value = 'all' }
const openCreate = () => { title.value = ''; description.value = ''; mealTypes.value = []; dialog.value = true }
const filteredCollectionRecipes = computed(() => {
  const query = (collectionSearch.value || '').trim().toLowerCase()
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
const load = async () => {
  loading.value = true
  loadError.value = ''
  try { await Promise.all([store.fetchAll(), loadCollections()]) }
  catch (error) { loadError.value = errorMessage(error) }
  finally { loading.value = false }
}
onMounted(load)
const create = async () => {
  if (creating.value || !title.value.trim()) return
  creating.value = true
  try {
    const recipe = await store.create({ title: title.value.trim(), description: description.value, mealTypes: mealTypes.value || [] })
    dialog.value = false
    ui.notify('Рецепт создан. Добавьте ингредиенты.')
    await navigateTo(`/recipes/${recipe.id}`)
  } catch (error) { ui.error(error) }
  finally { creating.value = false }
}
const remove = async (id: number) => {
  if (!confirm('Удалить рецепт? Сохранённые меню и их покупки останутся.')) return
  try { await store.remove(id); await loadCollections(); ui.notify('Рецепт удалён') }
  catch (error) { ui.error(error) }
}
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

  if (savingCollection.value) return
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
  } catch (error) { ui.error(error) } finally {
    savingCollection.value = false
  }
}
const removeCollection = async (id: number) => {
  if (!confirm('Удалить коллекцию? Рецепты останутся.')) return
  try { await api.deleteRecipeCollection(id); ui.notify('Коллекция удалена'); await loadCollections() }
  catch (error) { ui.error(error) }
}
</script>
<style scoped>
.library-head { align-items: center; justify-content: space-between; gap: 20px; }
.button-plus { margin-right: 10px; font-size: 23px; font-weight: 400; }
.library-tabs { display: flex; align-items: center; gap: 28px; border-bottom: 1px solid var(--border-subtle, #e1e6dc); margin: 32px 0 26px; }
.library-tabs button { position: relative; padding: 0 0 16px; color: var(--text-secondary); font-size: 13px; font-weight: 500; }
.library-tabs button.active { color: #264b3f; }
.library-tabs button.active::after { position: absolute; bottom: -1px; left: 0; right: 0; height: 2px; background: #264b3f; content: ''; }
.library-tabs button span { display: inline-flex; align-items: center; justify-content: center; font-size: 12px; min-width: 24px; height: 21px; padding: 0 6px; margin-left: 5px; background: #e9ede1; border-radius: 7px; }
.library-tabs > a { margin: 0 0 16px auto; color: var(--text-secondary); font-size: 12px; text-decoration: none; }
.library-tabs > a span { margin-left: 10px; }
.library-controls { background: #fff; border: 1px solid var(--border-subtle, #e1e6dc); border-radius: 18px; padding: 20px; }
.library-controls__top { display: flex; align-items: center; gap: 20px; }
.library-search { flex: 1; }
.source-switch { display: flex; padding: 4px; background: #f2f4ed; border-radius: 12px; flex-shrink: 0; }
.source-switch button { padding: 10px 17px; border-radius: 9px; font-size: 12px; color: var(--text-secondary); }
.source-switch button.active { background: white; color: #264b3f; box-shadow: 0 2px 4px #264b3f0b; }
.meal-filters { display: flex; gap: 8px; margin-top: 20px; flex-wrap: wrap; }
.meal-filters button { padding: 8px 17px; font-size: 12px; border: 1px solid #e5e9df; border-radius: 100px; color: var(--text-secondary); }
.meal-filters button.active { background: #264b3f; border-color: #264b3f; color: #fff; }
.library-results { display: flex; justify-content: space-between; margin: 28px 0 16px; color: var(--text-secondary); font-size: 12px; }
.recipe-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
.recipe-placeholder { min-height: 320px; border: 1px solid #e5e9df; border-radius: 20px; background: #fff; padding: 24px; }
.recipe-placeholder span { display: block; width: 57px; height: 57px; border-radius: 50%; background: #edf0e6; margin-bottom: 32px; }
.recipe-placeholder i { display: block; height: 13px; background: #edf0e6; border-radius: 4px; margin-bottom: 14px; }
.recipe-placeholder i:last-child { width: 60%; }
.library-empty { padding: 55px 24px; border: 1px dashed #d8e0d0; border-radius: 20px; text-align: center; }
.library-empty__symbol { display: inline-grid; place-items: center; width: 56px; height: 56px; border-radius: 50%; background: #e9eedc; color: #264b3f; font-size: 32px; margin-bottom: 16px; }
.library-empty h2, .collection-intro h2 { font-family: Georgia, serif; font-weight: 400; font-size: 24px; color: #264b3f; }
.library-empty p { max-width: 450px; margin: 12px auto 22px; color: var(--text-secondary); font-size: 13px; line-height: 1.7; }
.collection-intro { display: flex; justify-content: space-between; align-items: center; gap: 24px; margin-bottom: 25px; }
.collection-intro p { font-size: 13px; color: var(--text-secondary); margin-top: 8px; }
.collection-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.collection-card { padding: 25px; border-radius: 20px; border: 1px solid #dfe6d8; background: #fff; }
.collection-card__label { color: var(--text-secondary); font-size: 11px; }
.collection-card h3 { font: 26px/1.3 Georgia, serif; color: #264b3f; margin: 12px 0 18px; }
.collection-card__recipes { display: flex; flex-wrap: wrap; gap: 7px; min-height: 62px; align-content: start; }
.collection-card__recipes span { border-radius: 7px; padding: 5px 9px; background: #f2f5e9; color: var(--text-secondary); font-size: 11px; }
.collection-card__actions { display: flex; justify-content: space-between; margin: 20px -8px -7px; }
.library-dialog { padding: 14px 8px 10px; }
.library-dialog :deep(.v-card-title) { font-family: Georgia, serif; font-size: 27px; color: #264b3f; white-space: normal; }
.dialog-intro { color: var(--text-secondary); font-size: 13px; line-height: 1.7; margin-bottom: 22px; }
.select-list { border: 1px solid #e0e6d9; border-radius: 12px; overflow: auto; max-height: 350px; }
.select-row { display: flex; gap: 8px; padding: 8px 12px; align-items: center; border-bottom: 1px solid #edf0e8; }
.select-row :deep(.v-input) { flex: 0 0 auto; }
.select-row:last-child { border-bottom: 0; }
.select-row--active { background: #f1f5e9; }
.select-row strong { display: block; font-size: 13px; font-weight: 500; }
.select-row small { display: block; font-size: 11px; color: var(--text-secondary); margin-top: 3px; }
@media (max-width: 1150px) { .recipe-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 650px) { .library-head, .collection-intro { align-items: flex-start; flex-direction: column; } .library-tabs { gap: 20px; flex-wrap: wrap; } .library-tabs > a { width: 100%; margin: -4px 0 13px; } .library-controls { padding: 15px; } .library-controls__top { flex-direction: column; align-items: stretch; gap: 14px; } .source-switch button { flex: 1; } .meal-filters { gap: 6px; } .meal-filters button { padding: 7px 13px; } .recipe-grid, .collection-grid { grid-template-columns: minmax(0, 1fr); } .library-results { gap: 12px; } }
</style>
