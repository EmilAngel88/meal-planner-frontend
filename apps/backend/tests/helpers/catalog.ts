import { products } from '../../prisma/catalog/products';
import { recipes } from '../../prisma/catalog/recipes';
import { add, scaleMacro, type Candidate } from '../../services/generator';
import { per100g } from '../../services/nutrition';
import { productSnapshot } from '../../services/shopping';

export const catalogProducts = products.map((product, index) => per100g({ ...product, id: index + 1, unitType: product.unitType || 'gram', unitWeight: product.unitWeight || null }));
export const catalogCandidates: Candidate[] = [...recipes.map((recipe, index) => {
    const composition = recipe.ingredients.map(row => ({ ...catalogProducts.find(p => p.name === row.name)!, weight: row.weight }));
    return { ...recipe, id: index + 1, isBase: true, sourceType: 'recipe' as const, composition,
        weight: composition.reduce((sum, row) => sum + row.weight, 0),
        shopping: composition.map(row => productSnapshot(row, row.weight)),
        ...composition.reduce((sum, row) => add(sum, scaleMacro(row, row.weight / 100)), { calories: 0, protein: 0, fat: 0, carbs: 0 }),
    };
}), ...catalogProducts.filter(p => !p.isArchived).map(product => ({ ...product, title: product.name, isBase: true, sourceType: 'product' as const, weight: 100, composition: [{ ...product, weight: 100 }], shopping: [productSnapshot(product, 100)] }))];
