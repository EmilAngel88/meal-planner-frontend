<template>
  <article class="recipe-card" :class="`recipe-card--${mealType}`">
    <div class="recipe-card__topline">
      <div class="recipe-card__symbol" aria-hidden="true">
        <svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="22" stroke="currentColor" stroke-width="1.4"/><circle cx="32" cy="32" r="15" stroke="currentColor" stroke-width="1.2"/><path d="M28 40c-2-11 1-19 13-21 1 11-3 18-13 21Zm0 0 9-15M8 17v12m-4-12v8c0 5 8 5 8 0v-8M8 29v19m49-31c-4 5-4 11 0 15v16m0-31v15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <span class="recipe-card__kind">{{ recipe.isBase ? 'Из библиотеки' : 'Мой рецепт' }}</span>
      <v-menu v-if="onDelete && !recipe.isBase" location="bottom end">
        <template #activator="{ props: menuProps }"><v-btn v-bind="menuProps" class="recipe-card__more" variant="text" size="small" :aria-label="`Действия с рецептом ${recipe.title}`">•••</v-btn></template>
        <v-list><v-list-item title="Удалить рецепт" base-color="error" @click="onDelete?.(recipe.id)" /></v-list>
      </v-menu>
    </div>
    <div class="recipe-card__body">
      <span class="recipe-card__meal">{{ mealLabel }}</span>
      <h3><NuxtLink :to="`/recipes/${recipe.id}`">{{ recipe.title }}</NuxtLink></h3>
      <p class="recipe-card__description">{{ recipe.description || ingredientNames || 'Добавьте состав — и рецепт будет готов для вашего меню.' }}</p>
      <div class="recipe-card__facts"><span>{{ cookingModes.find(m => m.value === recipe.cookingMode)?.title || ingredientCount }}</span><span>{{ recipe.servings || 1 }} {{ servingsLabel }}</span></div>
    </div>
    <div class="recipe-card__footer">
      <template v-if="hasNutrition">
        <div class="recipe-card__energy"><strong class="mp-num">{{ nutrition.calories }}</strong><span>ккал / порция</span></div>
        <div class="recipe-card__macros" aria-label="Пищевая ценность на порцию"><span>Б <b>{{ nutrition.protein }}</b></span><span>Ж <b>{{ nutrition.fat }}</b></span><span>У <b>{{ nutrition.carbs }}</b></span></div>
      </template>
      <span v-else class="recipe-card__unfinished">Состав ещё не заполнен</span>
      <NuxtLink class="recipe-card__arrow" :to="`/recipes/${recipe.id}`" :aria-label="`Открыть ${recipe.title}`">↗</NuxtLink>
    </div>
  </article>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { recipeNutrition, cookingModes } from '~/utils/food'
import type { Recipe } from '~/composables/useApi'
const props = defineProps<{ recipe: Recipe, onDelete?: (id: number) => void }>()
const labels: Record<string, string> = { breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин', snack: 'Перекус', any: 'На каждый день' }
const mealType = computed(() => props.recipe.mealTypes?.find(type => type !== 'any') || 'any')
const mealLabel = computed(() => (props.recipe.mealTypes || []).filter(type => type !== 'any').map(type => labels[type] || type).join(' · ') || 'На каждый день')
const ingredientNames = computed(() => props.recipe.ingredients?.map(ing => ing.product?.name).filter(Boolean).join(', '))
const plural = (count: number, one: string, few: string, many: string) => count % 100 >= 11 && count % 100 <= 14 ? many : count % 10 === 1 ? one : count % 10 >= 2 && count % 10 <= 4 ? few : many
const ingredientCount = computed(() => { const n = props.recipe.ingredients?.length || 0; return `${n} ${plural(n, 'ингредиент', 'ингредиента', 'ингредиентов')}` })
const servingsLabel = computed(() => plural(props.recipe.servings || 1, 'порция', 'порции', 'порций'))
const hasNutrition = computed(() => !!props.recipe.ingredients?.length && props.recipe.ingredients.every(ing => !!ing.product))
const nutrition = computed(() => {
  const totals = recipeNutrition(props.recipe.ingredients || [], props.recipe.servings || 1)
  return { calories: Math.round(totals.calories), protein: Math.round(totals.protein), fat: Math.round(totals.fat), carbs: Math.round(totals.carbs) }
})
</script>
<style scoped>
.recipe-card { --recipe-tint: #edf3e6; --recipe-accent: #3e6849; display: flex; flex-direction: column; height: 100%; background: #fff; border: 1px solid var(--border-subtle, #e1e6dc); border-radius: 20px; overflow: hidden; transition: border-color .2s, transform .2s; }
.recipe-card:hover { border-color: #8a9c86; transform: translateY(-3px); }
.recipe-card--breakfast { --recipe-tint: #fbf1d8; --recipe-accent: #886020; }
.recipe-card--lunch { --recipe-tint: #e9f1df; --recipe-accent: #3e6849; }
.recipe-card--dinner { --recipe-tint: #eaf3f5; --recipe-accent: #376b79; }
.recipe-card--snack { --recipe-tint: #fff0e7; --recipe-accent: #a34e2c; }
.recipe-card__topline { display: flex; align-items: center; gap: 12px; padding: 16px 20px; background: var(--recipe-tint); border-top: 3px solid var(--recipe-accent); }
.recipe-card__symbol { width: 57px; height: 57px; border-radius: 50%; padding: 7px; color: var(--recipe-accent); background: #ffffffb3; border: 1px solid var(--recipe-accent); flex-shrink: 0; }
.recipe-card__symbol svg { width: 100%; height: 100%; }
.recipe-card__kind { color: var(--recipe-accent); font-weight: 600; font-size: 11px; letter-spacing: .04em; }
.recipe-card__more { margin-left: auto; min-width: 32px; color: var(--text-secondary); }
.recipe-card__body { padding: 20px 22px 18px; flex: 1; }
.recipe-card__meal { color: var(--recipe-accent); font-size: 11px; font-weight: 600; }
.recipe-card h3 { font-size: 19px; line-height: 1.35; font-weight: 600; margin: 7px 0 10px; overflow-wrap: anywhere; letter-spacing: -.025em; }
.recipe-card h3 a { color: #264b3f; text-decoration: none; }
.recipe-card h3 a:hover { text-decoration: underline; text-underline-offset: 4px; }
.recipe-card__description { min-height: 43px; color: var(--text-secondary); font-size: 12px; line-height: 1.8; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.recipe-card__facts { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 18px; font-size: 11px; color: var(--text-secondary); }
.recipe-card__facts span + span::before { content: '·'; margin-right: 14px; }
.recipe-card__footer { flex-wrap: wrap; min-height: 77px; padding: 14px 20px; background: #fbfcf8; border-top: 1px solid #edf0e7; display: flex; gap: 14px; align-items: center; }
.recipe-card__energy { display: flex; flex-direction: column; flex-shrink: 0; gap: 2px; }
.recipe-card__energy strong { color: #264b3f; font-size: 20px; font-weight: 600; line-height: 1; }
.recipe-card__energy span { color: var(--text-secondary); font-size: 12px; }
.recipe-card__macros { display: flex; gap: 8px; font-size: 12px; color: var(--text-secondary); }
.recipe-card__macros b { font-weight: 600; color: inherit; }
.recipe-card__macros span { padding: 3px 5px; border-radius: 5px; background: var(--macro-protein-soft); color: var(--macro-protein); }
.recipe-card__macros span:nth-child(2) { background: var(--macro-fat-soft); color: var(--macro-fat); }
.recipe-card__macros span:nth-child(3) { background: var(--macro-carbs-soft); color: var(--macro-carbs); }
.recipe-card__arrow { color: #264b3f; text-decoration: none; margin-left: auto; border: 1px solid #dfe6d8; border-radius: 50%; height: 34px; width: 34px; flex-shrink: 0; display: grid; place-items: center; font-size: 19px; }
.recipe-card__arrow:hover { background: #dce8ad; }
.recipe-card__unfinished { color: var(--text-secondary); font-size: 12px; }
@media (prefers-reduced-motion: reduce) { .recipe-card { transition: none; } .recipe-card:hover { transform: none; } }
</style>
