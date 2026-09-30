import type { Product, Ingredient } from '../composables/useApi'
export const foodGroups = [
  { value: 'grain', title: 'Крупы и хлеб' }, { value: 'meat', title: 'Мясо и яйца' },
  { value: 'fish', title: 'Рыба и морепродукты' }, { value: 'dairy', title: 'Молочные' },
  { value: 'legumes', title: 'Бобовые и тофу' }, { value: 'vegetables', title: 'Овощи' },
  { value: 'fruit', title: 'Фрукты и ягоды' }, { value: 'nuts', title: 'Орехи и семена' },
  { value: 'fats', title: 'Масла' }, { value: 'other', title: 'Другое' }
]
export const foodStates = [{ value: 'raw', title: 'Сырой' }, { value: 'dry', title: 'Сухой' }, { value: 'cooked', title: 'Готовый' }, { value: 'as_sold', title: 'Как в упаковке' }]
export const cookingModes = [{ value: 'batch', title: 'Готовим впрок' }, { value: 'assembly', title: 'Собираем перед едой' }, { value: 'fresh', title: 'Готовим и едим' }]
export const productLabel = (p?: Product) => p ? [p.name, p.brand].filter(Boolean).join(' · ') : 'Продукт'
export const stateLabel = (p?: Product) => foodStates.find(s => s.value === p?.preparationState)?.title || 'Как в упаковке'
export const unitLabel = (p?: Product) => p?.unitType === 'ml' ? 'мл' : p?.unitType === 'piece' ? 'шт.' : 'г'
export const numberText = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(n)
export const quantityForWeight = (p: Product | undefined, weight: number) => p?.unitType === 'piece' && p.unitWeight ? weight / p.unitWeight : p?.unitType === 'ml' ? weight / (p.density || 1) : weight
export const weightForQuantity = (p: Product | undefined, amount: number) => p?.unitType === 'piece' && p.unitWeight ? amount * p.unitWeight : p?.unitType === 'ml' ? amount * (p.density || 1) : amount
export const ingredientAmount = (i: Ingredient, factor = 1) => `${numberText(quantityForWeight(i.product, i.weight * factor))} ${unitLabel(i.product)}`
export const nutritionForWeight = (p: Product | undefined, weight: number) => {
  const factor = Math.max(0, Number.isFinite(weight) ? weight : 0) / 100 / (p?.nutritionBasis === '100ml' ? (p.density || 1) : 1)
  return { calories: (p?.calories || 0) * factor, protein: (p?.protein || 0) * factor, fat: (p?.fat || 0) * factor, carbs: (p?.carbs || 0) * factor }
}
export const recipeNutrition = (ingredients: Ingredient[], servings = 1) => ingredients.reduce((sum, i) => {
  const values = nutritionForWeight(i.product, i.weight)
  for (const key of ['calories', 'protein', 'fat', 'carbs'] as const) sum[key] += values[key] / Math.max(1, servings)
  return sum
}, { calories: 0, protein: 0, fat: 0, carbs: 0 })
