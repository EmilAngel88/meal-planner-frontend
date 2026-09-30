type Nutrition = { calories: number; protein: number; fat: number; carbs: number; nutritionBasis?: string; density?: number };
type Units = { unitType?: string; unitWeight?: number | null; density?: number };
// Ingredient weights are always grams; label values can be per 100 ml.
export function per100g<T extends Nutrition>(product: T): T {
    const divisor = product.nutritionBasis === '100ml' ? (product.density || 1) : 1;
    return { ...product, calories: product.calories / divisor, protein: product.protein / divisor, fat: product.fat / divisor, carbs: product.carbs / divisor, nutritionBasis: '100g' };
}
export function quantityForWeight(product: Units, weight: number) {
    return product.unitType === 'piece' && product.unitWeight ? weight / product.unitWeight : product.unitType === 'ml' ? weight / (product.density || 1) : weight;
}
