<template>
  <div class="product-library">
    <div class="mp-page-head product-head"><div class="mp-page-head__meta"><span class="mp-overline">Основа повседневного питания</span><h1 class="mp-page-title">Ваши продукты</h1><p class="mp-page-subtitle">Обычные продукты уже здесь. Для любимой марки добавьте свой вариант по этикетке.</p></div><v-btn color="primary" size="large" @click="openEditor()">+ Продукт по этикетке</v-btn></div>
    <div class="product-note"><div class="product-note__icon" aria-hidden="true"><v-icon icon="mdi-food-apple" size="25" /></div><div><strong>Справочник → ваша марка → ваш рецепт</strong><p>Найдите основу, выберите «Свой вариант» и уточните КБЖУ. Затем замените ингредиент в своей версии блюда.</p></div><span class="product-note__count"><b>{{ products.filter(p => !p.isArchived).length }}</b> продуктов</span></div>
    <v-alert v-if="loadError" type="error" variant="tonal" class="mb-5">{{ loadError }} <v-btn variant="text" @click="loadProducts">Повторить</v-btn></v-alert>
    <section class="product-panel">
      <div class="product-controls"><v-text-field v-model="search" class="product-search" label="Продукт или производитель" clearable prepend-inner-icon="mdi-magnify" hide-details /><div class="source-switch" aria-label="Источник продуктов"><button v-for="filter in [{ value: 'all', title: 'Все' }, { value: 'base', title: 'Базовые' }, { value: 'mine', title: `Мои · ${customCount}` }]" :key="filter.value" :class="{ active: sourceFilter === filter.value }" :aria-pressed="sourceFilter === filter.value" @click="sourceFilter = filter.value">{{ filter.title }}</button></div></div>
      <div class="group-filters" aria-label="Группа продуктов"><button :class="{ active: groupFilter === 'all' }" :aria-pressed="groupFilter === 'all'" @click="groupFilter = 'all'">Весь каталог</button><button v-for="group in foodGroups" :key="group.value" :class="{ active: groupFilter === group.value }" :aria-pressed="groupFilter === group.value" @click="groupFilter = group.value">{{ group.title }}</button></div>
      <div class="product-table-caption"><span>На 100 г или 100 мл — указано у продукта</span><span aria-live="polite">Найдено: {{ filteredProducts.length }}</span></div>
      <div v-if="loading" class="product-loading" role="status">Готовим каталог…</div>
      <table v-else-if="filteredProducts.length" class="product-table"><thead><tr><th scope="col">Продукт</th><th scope="col" class="numeric">Ккал</th><th scope="col" class="numeric">Белки, г</th><th scope="col" class="numeric">Жиры, г</th><th scope="col" class="numeric">Углеводы, г</th><th scope="col">Отмеряем</th><th scope="col"><span class="sr-only">Действия</span></th></tr></thead><tbody><tr v-for="product in pagedProducts" :key="product.id"><td class="product-name"><button class="product-link" @click="selected = product">{{ productLabel(product) }}</button><span>{{ stateLabel(product) }} · {{ product.nutritionBasis === '100ml' ? '100 мл' : '100 г' }}<i v-if="!product.isBase">Мой продукт</i><i v-if="product.isArchived">Архив</i></span></td><td class="numeric energy" data-label="Ккал">{{ numberText(product.calories) }}</td><td class="numeric" data-label="Белки">{{ numberText(product.protein) }}</td><td class="numeric" data-label="Жиры">{{ numberText(product.fat) }}</td><td class="numeric" data-label="Углеводы">{{ numberText(product.carbs) }}</td><td class="product-unit">{{ unitLabel(product) }}<span v-if="product.unitType === 'piece'"> · ≈ {{ product.unitWeight }} г/шт.</span></td><td class="product-actions"><v-btn v-if="product.isBase && !product.isArchived" variant="text" size="small" @click="openEditor(product, 'variant')">Свой вариант</v-btn><v-menu v-else-if="!product.isBase" location="bottom end"><template #activator="{ props: menuProps }"><v-btn v-bind="menuProps" variant="text" size="small" :aria-label="`Действия: ${productLabel(product)}`">•••</v-btn></template><v-list><v-list-item title="Изменить" @click="openEditor(product, 'edit')" /><v-list-item title="Удалить продукт" base-color="error" @click="remove(product.id)" /></v-list></v-menu></td></tr></tbody></table>
      <div v-else-if="!loadError" class="product-empty"><h2>{{ sourceFilter === 'mine' && !customCount ? 'Здесь будут ваши марки' : 'Продукты не найдены' }}</h2><p>{{ sourceFilter === 'mine' && !customCount ? 'Выберите базовый продукт и сохраните свой вариант или добавьте новый по этикетке.' : 'Попробуйте другое название или добавьте продукт самостоятельно.' }}</p><v-btn variant="outlined" @click="resetFilters">Весь каталог</v-btn><v-btn color="primary" class="ml-2" @click="openEditor()">Добавить свой</v-btn></div>
      <v-pagination aria-label="Страницы каталога" next-aria-label="Следующая страница" previous-aria-label="Предыдущая страница" page-aria-label="Перейти на страницу {0}" current-page-aria-label="Страница {0}, текущая" v-if="filteredProducts.length > pageSize" v-model="page" :length="Math.ceil(filteredProducts.length / pageSize)" :total-visible="5" density="comfortable" class="py-3" />
    </section>
    <div class="product-footer"><p>Базовые КБЖУ — ориентир. Источник, состояние и особенности взвешивания указаны в карточке продукта. Данные вашей упаковки точнее для конкретной марки.</p><v-checkbox v-model="showArchived" label="Показать устаревшие позиции для старых рецептов" density="compact" hide-details /></div>
    <ProductEditor v-model="formDialog" :product="editorProduct" :mode="editorMode" @saved="onSaved" />
    <v-dialog :model-value="!!selected" max-width="620" @update:model-value="!$event && (selected = null)"><v-card v-if="selected" class="product-dialog"><v-card-title>{{ productLabel(selected) }}</v-card-title><v-card-text><p class="product-detail-meta">{{ stateLabel(selected) }} · значения на {{ selected.nutritionBasis === '100ml' ? '100 мл' : '100 г' }}</p><div class="product-detail-macros"><strong>{{ numberText(selected.calories) }} <small>ккал</small></strong><span>Б {{ numberText(selected.protein) }} г</span><span>Ж {{ numberText(selected.fat) }} г</span><span>У {{ numberText(selected.carbs) }} г</span></div><p class="product-detail-note">{{ selected.notes || 'Используйте массу съедобной части продукта.' }}</p><p v-if="selected.baseProductId" class="product-detail-note">Основа: {{ products.find(p => p.id === selected?.baseProductId)?.name || 'продукт из библиотеки' }}. Эта версия доступна только вам.</p><p class="product-detail-source">{{ selected.isBase ? selected.sourceLabel || 'Редакционный справочник' : 'Ваши данные с упаковки' }}<a v-if="safeSource(selected.sourceUrl)" :href="selected.sourceUrl" target="_blank" rel="noopener noreferrer">Открыть источник ↗</a></p><p v-if="relatedVariants.length" class="product-detail-note">Ваши варианты: {{ relatedVariants.map(productLabel).join(', ') }}</p></v-card-text><v-card-actions><v-btn variant="text" @click="selected = null">Закрыть</v-btn><v-spacer /><v-btn v-if="!selected.isArchived" color="primary" variant="flat" @click="openSelectedEditor">{{ selected.isBase ? 'Создать свой вариант' : 'Изменить' }}</v-btn></v-card-actions></v-card></v-dialog>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useApi, type Product } from '~/composables/useApi'
import { foodGroups, productLabel, stateLabel, numberText, unitLabel } from '~/utils/food'
import { errorMessage } from '~/utils/storage'
import { useUiStore } from '~/stores/ui'
useHead({ title: 'Продукты — Рацион' })
const api = useApi(), ui = useUiStore()
const products = ref<Product[]>([])
const search = ref(''), sourceFilter = ref('all'), groupFilter = ref('all'), showArchived = ref(false)
const formDialog = ref(false), selected = ref<Product | null>(null), editorProduct = ref<Product | null>(null)
const editorMode = ref<'create' | 'variant' | 'edit'>('create')
const loading = ref(true), loadError = ref(''), page = ref(1), pageSize = 20
const customCount = computed(() => products.value.filter(p => !p.isBase).length)
const filteredProducts = computed(() => products.value.filter(p => (showArchived.value || !p.isArchived) && (sourceFilter.value === 'all' || (sourceFilter.value === 'mine' ? !p.isBase : p.isBase)) && (groupFilter.value === 'all' || p.foodGroup === groupFilter.value) && productLabel(p).toLocaleLowerCase('ru').replaceAll('ё', 'е').includes((search.value || '').trim().toLocaleLowerCase('ru').replaceAll('ё', 'е'))))
const pagedProducts = computed(() => filteredProducts.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const relatedVariants = computed(() => products.value.filter(p => p.baseProductId === selected.value?.id))
watch([search, sourceFilter, groupFilter, showArchived], () => { page.value = 1 })
const resetFilters = () => { search.value = ''; sourceFilter.value = 'all'; groupFilter.value = 'all'; showArchived.value = false }
const safeSource = (url?: string) => !!url && /^https:\/\//.test(url)
const openEditor = (product: Product | null = null, mode: 'create' | 'variant' | 'edit' = 'create') => { editorProduct.value = product; editorMode.value = mode; formDialog.value = true }
const openSelectedEditor = () => { const p = selected.value!; selected.value = null; openEditor(p, p.isBase ? 'variant' : 'edit') }
const onSaved = (p: Product) => { const index = products.value.findIndex(v => v.id === p.id); if (index >= 0) products.value[index] = p; else products.value.unshift(p); ui.notify('Продукт сохранён'); sourceFilter.value = 'mine'; groupFilter.value = 'all'; search.value = ''; page.value = 1 }
const loadProducts = async () => { loading.value = true; loadError.value = ''; try { products.value = await api.getProducts() } catch (error) { loadError.value = errorMessage(error) } finally { loading.value = false } }
const remove = async (id: number) => { if (!confirm('Удалить свой продукт? Если он используется в рецепте, сначала уберите его из состава.')) return; try { await api.deleteProduct(id); products.value = products.value.filter(p => p.id !== id); page.value = Math.min(page.value, Math.max(1, Math.ceil(filteredProducts.value.length / pageSize))); ui.notify('Продукт удалён') } catch (error) { ui.error(error) } }
onMounted(loadProducts)
</script>
<style scoped>
.back-link { display: inline-block; color: var(--text-secondary); font-size: 12px; text-decoration: none; margin-bottom: 25px; }
.product-head { align-items: center; justify-content: space-between; gap: 20px; }
.button-plus { margin-right: 10px; font-size: 22px; font-weight: 400; }
.product-note { display: flex; align-items: center; gap: 16px; margin: 28px 0; padding: 21px 25px; background: #eaf0dd; border: 1px solid #e0e8d0; border-radius: 17px; }
.product-note__icon { width: 47px; height: 47px; flex-shrink: 0; display: grid; place-items: center; color: var(--text-secondary); border: 1px solid #cedabf; border-radius: 50%; }
.product-note strong { color: #3f5c37; font-size: 13px; font-weight: 500; }
.product-note p { color: var(--text-secondary); font-size: 11px; line-height: 1.7; margin-top: 4px; }
.product-note__count { margin-left: auto; color: var(--text-secondary); font-size: 12px; white-space: nowrap; }
.product-note__count b { color: #3a5636; font-size: 26px; font-weight: 400; margin-right: 6px; }
.product-panel { background: white; border: 1px solid var(--border-subtle, #e1e6dc); border-radius: 20px; overflow: hidden; }
.product-controls { padding: 23px; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.product-search { max-width: 440px; }
.source-switch { display: flex; padding: 4px; background: #f2f4ed; border-radius: 12px; flex-shrink: 0; }
.source-switch button { padding: 10px 16px; border-radius: 9px; font-size: 12px; color: var(--text-secondary); }
.source-switch button.active { background: white; color: #264b3f; box-shadow: 0 2px 4px #264b3f0b; }
.source-switch button span { margin-left: 4px; font-size: 12px; color: var(--text-secondary); }
.product-table-caption { display: flex; justify-content: space-between; padding: 0 25px 18px; color: var(--text-secondary); font-size: 12px; }
.product-table { border-collapse: collapse; width: 100%; text-align: left; }
.product-table th { background: #f8faf4; border-block: 1px solid #edf1e5; padding: 13px 15px; color: var(--text-secondary); font-size: 12px; font-weight: 500; white-space: nowrap; }
.product-table th:first-child, .product-table td:first-child { padding-left: 25px; }
.product-table th:last-child, .product-table td:last-child { padding-right: 25px; }
.product-table td { padding: 18px 15px; border-bottom: 1px solid #f0f2eb; font-size: 12px; color: var(--text-secondary); }
.product-table tbody tr:last-child td { border-bottom: 0; }
.product-table tbody tr:hover { background: #fcfdf9; }
.product-table .numeric { text-align: right; font-variant-numeric: tabular-nums; }
.product-table .energy { color: #47663c; font-weight: 600; }
.product-name { width: 34%; }
.product-name strong { display: block; color: #3c5037; font-size: 13px; font-weight: 500; }
.product-name > span { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; color: var(--text-secondary); font-size: 12px; margin-top: 6px; }
.product-name i { background: #eef3e4; padding: 2px 5px; border-radius: 4px; color: var(--text-secondary); font-style: normal; font-size: 12px; }
.product-unit { font-size: 12px !important; }
.product-actions { width: 85px; text-align: right; }
.base-label { color: var(--text-secondary); font-size: 12px; }
.product-actions .v-btn { min-width: 30px; color: var(--text-secondary); }
.product-loading { padding: 60px; text-align: center; color: var(--text-secondary); font-size: 13px; }
.product-empty { text-align: center; padding: 65px 25px; }
.product-empty h2 { font: 26px/1.3 Georgia, serif; color: #264b3f; }
.product-empty p { margin: 12px 0 24px; color: var(--text-secondary); font-size: 13px; }
.product-footer { color: var(--text-secondary); font-size: 12px; line-height: 1.8; margin: 17px 3px; }
.product-dialog { padding: 16px 8px 8px; }
.product-dialog :deep(.v-card-title) { font: 27px/1.3 Georgia, serif; color: #264b3f; margin-bottom: 8px; }
.dialog-intro { color: var(--text-secondary); font-size: 12px; line-height: 1.8; margin-bottom: 24px; }
.form-section-label { display: block; color: var(--text-secondary); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; margin: 9px 0 14px; }
.nutrition-inputs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.unit-inputs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 15px; }
.dialog-actions { display: flex; justify-content: space-between; gap: 15px; margin-top: 16px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@media (max-width: 1050px) { .product-table th, .product-table td { padding-right: 10px; padding-left: 10px; } .product-controls { gap: 15px; } .source-switch button { padding: 10px 11px; } }
@media (max-width: 750px) { .product-head { flex-direction: column; align-items: flex-start; } .product-note { padding: 19px; } .product-note__count { display: none; } .product-controls { flex-direction: column; align-items: stretch; padding: 18px; } .product-search { max-width: none; } .source-switch button { flex: 1; } .product-table, .product-table tbody { display: block; } .product-table thead { display: none; } .product-table tbody tr { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 17px 20px; border-top: 1px solid #eaf0e2; gap: 16px 10px; } .product-table td { border: 0; display: block; padding: 0 !important; } .product-name { width: auto; grid-column: 1 / 4; grid-row: 1; } .product-actions { grid-column: 4; grid-row: 1; width: auto; } .product-table .numeric { text-align: left; grid-row: 2; color: #49673e; font-size: 15px; } .product-table .numeric::before { content: attr(data-label); display: block; color: var(--text-secondary); font-size: 12px; margin-bottom: 5px; font-weight: 400; } .product-table .product-unit { grid-column: 1 / -1; color: var(--text-secondary); } .product-unit::before { content: 'В покупках: '; } .nutrition-inputs { grid-template-columns: repeat(2, minmax(0, 1fr)); } .unit-inputs { grid-template-columns: minmax(0, 1fr); gap: 0; } }
</style>
<style scoped>
.group-filters { display:flex; flex-wrap:wrap; gap:7px; padding:0 23px 23px; }.group-filters button { padding:7px 11px; border:1px solid #e4e9dd; border-radius:20px; font-size:11px; color: var(--text-secondary); }.group-filters button.active { background:#264b3f; color:white; border-color:#264b3f; }.product-link { text-align:left; color:#264b3f; font-size:13px; font-weight:600; }.product-link:hover { text-decoration:underline; }.product-actions { width:110px; }.product-actions .v-btn { color:#426236; font-size: 12px; }.product-footer { color: var(--text-secondary); font-size:12px; }.product-footer :deep(.v-label) { font-size:11px; }.product-detail-meta,.product-detail-source { color: var(--text-secondary); font-size:12px; }.product-detail-source a { display:block; color:#264b3f; margin-top:8px; }.product-detail-macros { display:flex; gap:20px; align-items:baseline; flex-wrap:wrap; margin:24px 0; color:#264b3f; }.product-detail-macros strong { font-size:32px; }.product-detail-macros small { font-size:12px; }.product-detail-note { font-size:14px; line-height:1.8; margin:16px 0; }.product-dialog :deep(.v-card-title) { white-space:normal; }@media(max-width:750px) { .product-actions { width:auto; }.product-name { grid-column:1 / -1; padding-right:100px!important; }.product-actions { grid-column:3 / 5; justify-self:end; }.group-filters { padding-inline:18px; } }
</style>
