import { productSnapshot, type ShoppingIngredient } from './shopping';
import { BALANCEABLE_BASE_RECIPES, CATALOG_PORTIONS, canAddToRecipe, ingredientLimit, isPorridge, mealComfortCost, mealWeightLimit, portionRows, validDayPortion, validMealPortion } from './portions';

export type Macro = {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
};

export type MealSlot = {
    type: string;
    title: string;
    percent: number;
    maxItems: number;
};

export type Candidate = Macro & {
    id: number;
    title: string;
    sourceType: "recipe" | "product";
    mealTypes: string[];
    weight: number;
    shopping: ShoppingIngredient[];
    isBase?: boolean;
    maxPerWeek?: number;
    servings?: number;
    composition?: Array<Macro & { id: number; name: string; weight: number; unitType: string; unitWeight: number | null; portionName?: string; density?: number }>;
};

export type ScoredItem = Candidate & {
    scale: number;
    weight: number;
    score: number;
};

export const round = (value: number) => Math.round((value + 1e-9) * 10) / 10;

export const add = (a: Macro, b: Macro): Macro => ({
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
    carbs: a.carbs + b.carbs,
});

export const scaleMacro = (macro: Macro, scale: number): Macro => ({
    calories: macro.calories * scale,
    protein: macro.protein * scale,
    fat: macro.fat * scale,
    carbs: macro.carbs * scale,
});

export const macroScore = (actual: Macro, target: Macro, weights: Macro) => {
    const normalized = (key: keyof Macro) => {
        const denominator = Math.max(target[key], 1);
        return Math.abs(actual[key] - target[key]) / denominator * weights[key];
    };

    return normalized("protein") + normalized("calories") + normalized("fat") + normalized("carbs");
};

const defaultMealsForCalories = (calories: number): MealSlot[] => {
    if (calories < 1600) {
        return [
            { type: "breakfast", title: "Завтрак", percent: 0.3, maxItems: 2 },
            { type: "lunch", title: "Обед", percent: 0.4, maxItems: 2 },
            { type: "dinner", title: "Ужин", percent: 0.3, maxItems: 2 },
        ];
    }

    if (calories <= 2200) {
        return [
            { type: "breakfast", title: "Завтрак", percent: 0.25, maxItems: 2 },
            { type: "lunch", title: "Обед", percent: 0.35, maxItems: 2 },
            { type: "snack", title: "Перекус", percent: 0.1, maxItems: 2 },
            { type: "dinner", title: "Ужин", percent: 0.3, maxItems: 2 },
        ];
    }

    if (calories > 2800) return [
        { type: "breakfast", title: "Завтрак", percent: 0.2, maxItems: 2 },
        { type: "snack", title: "Перекус 1", percent: 0.12, maxItems: 2 },
        { type: "lunch", title: "Обед", percent: 0.25, maxItems: 2 },
        { type: "snack", title: "Перекус 2", percent: 0.12, maxItems: 2 },
        { type: "dinner", title: "Ужин", percent: 0.23, maxItems: 2 },
        { type: "snack", title: "Перекус 3", percent: 0.08, maxItems: 2 },
    ];
    return [
        { type: "breakfast", title: "Завтрак", percent: 0.2, maxItems: 2 },
        { type: "snack", title: "Перекус 1", percent: 0.125, maxItems: 2 },
        { type: "lunch", title: "Обед", percent: 0.3, maxItems: 2 },
        { type: "snack", title: "Перекус 2", percent: 0.125, maxItems: 2 },
        { type: "dinner", title: "Ужин", percent: 0.25, maxItems: 2 },
    ];
};

export const normalizeMeals = (calories: number, meals?: MealSlot[]) => {
    const source = meals?.length ? meals : defaultMealsForCalories(calories);
    const total = source.reduce((sum, meal) => sum + meal.percent, 0) || 1;

    return source.map(meal => ({
        ...meal,
        percent: meal.percent / total,
        maxItems: Math.min(2, meal.maxItems || 2),
    }));
};

export const targetFromCalories = (calories: number, macroRatios?: Partial<Macro>): Macro => {
    const proteinRatio = macroRatios?.protein ?? 0.3;
    const fatRatio = macroRatios?.fat ?? 0.25;
    const carbsRatio = macroRatios?.carbs ?? Math.max(0, 1 - proteinRatio - fatRatio);

    return {
        calories,
        protein: round(calories * proteinRatio / 4),
        fat: round(calories * fatRatio / 9),
        carbs: round(calories * carbsRatio / 4),
    };
};

const candidateFitsMeal = (candidate: Candidate, type: string) => {
    return type === "any" || !candidate.mealTypes.length || candidate.mealTypes.includes("any") || candidate.mealTypes.includes(type);
};

export const targetFromWeight = (calories: number, weight: number, proteinPerKg = 1.75, fatPerKg = 0.9): Macro => {
    const protein = round(weight * proteinPerKg);
    const fat = round(weight * fatPerKg);
    const remaining = calories - protein * 4 - fat * 9;
    if (remaining < 0) throw new Error('Белки и жиры превышают цель по калориям. Уменьшите граммы на кг или пересмотрите цель в кабинете.');
    return { calories, protein, fat, carbs: round(remaining / 4) };
};

const ZERO: Macro = { calories: 0, protein: 0, fat: 0, carbs: 0 };
const recipeUsageLimit = (candidate: Candidate) => candidate.maxPerWeek ?? (candidate.isBase ? 4 : 3);
export type GeneratorSettings = { minScale: number; maxScale: number; scoreWeights: Macro; candidateLimit: number };
export type PickedMeal = { score: number; items: ScoredItem[]; total: Macro };

// Round the actual ingredients first, then derive both nutrition and shopping from those weights.
function portion(candidate: Candidate, factor: number): ScoredItem | null {
    const scale = factor / (candidate.servings || 1);
    if (!candidate.composition?.length) {
        return { ...candidate, ...scaleMacro(candidate, scale), scale, weight: candidate.weight * scale, score: 0,
            shopping: candidate.shopping.map(i => ({ ...i, weight: i.weight * scale, quantity: i.quantity * scale })) };
    }
    let total = { ...ZERO };
    const shopping: ShoppingIngredient[] = [];
    for (const ingredient of candidate.composition) {
        const name = ingredient.portionName || ingredient.name;
        const rule = CATALOG_PORTIONS[name];
        const flexible = candidate.sourceType === 'product' || (candidate.isBase && BALANCEABLE_BASE_RECIPES.has(candidate.title));
        // A slice of casserole contains part of an egg. Only reviewed simple dishes
        // use practical per-ingredient steps; other recipes retain their proportions.
        const step = flexible ? (rule?.step || 5) : 0.1;
        const weight = round(Math.max(step, Math.round(ingredient.weight * scale / step) * step));
        if (weight > ingredientLimit(name) + 1e-8) return null;
        shopping.push(productSnapshot(ingredient, weight));
        total = add(total, scaleMacro(ingredient, weight / 100));
    }

    return { ...candidate, ...total, scale, weight: shopping.reduce((sum, item) => sum + item.weight, 0), shopping, score: 0 };
}

function optionsForMeal(candidates: Candidate[], meal: MealSlot, target: Macro, weeklyUsage: Map<number, number>, productUsage: Map<number, number>, settings: GeneratorSettings): PickedMeal[] {
    const recipes = candidates.filter(c => c.sourceType === 'recipe' && candidateFitsMeal(c, meal.type) && c.calories > 0 && (weeklyUsage.get(c.id) || 0) < recipeUsageLimit(c))
        .sort((a, b) => (weeklyUsage.get(a.id) || 0) - (weeklyUsage.get(b.id) || 0) || Math.abs(a.calories / (a.servings || 1) - target.calories) - Math.abs(b.calories / (b.servings || 1) - target.calories) || a.id - b.id);
    const products = candidates.filter(c => c.sourceType === 'product' && CATALOG_PORTIONS[c.title]?.addon);
    const options: PickedMeal[] = [];
    for (const recipe of recipes) {
        const seen = new Set<string>();
        for (const factor of [...new Set([settings.minScale, 0.5, 0.75, 1, 1.25, 1.5, settings.maxScale])].sort((a, b) => a - b)) {
            if (factor < settings.minScale || factor > settings.maxScale) continue;
            const main = portion(recipe, factor);
            if (!main || main.weight > mealWeightLimit(meal.type) || !validMealPortion(portionRows([main]), meal.type, isPorridge(main.title))) continue;
            const signature = main.shopping.length ? JSON.stringify(main.shopping.map(i => i.weight)) : String(main.weight);
            if (seen.has(signature)) continue;
            seen.add(signature);
            const variants: ScoredItem[][] = [[main]];
            if (meal.maxItems > 1) for (const product of products) {
                if (!canAddToRecipe(portionRows([main]).map(i => i.name), product.title, meal.type)) continue;
                for (const weight of CATALOG_PORTIONS[product.title].addon!) {
                    const extra = portion(product, weight / product.weight);
                    if (extra && validMealPortion(portionRows([main, extra]), meal.type, isPorridge(main.title))) variants.push([main, extra]);
                }
            }
            for (const items of variants) {
                const total = items.reduce((sum, item) => add(sum, item), { ...ZERO });
                const repeatCost = (weeklyUsage.get(recipe.id) || 0) * 0.18;
                const addonCost = items.slice(1).reduce((sum, item) => sum + 0.02 + (productUsage.get(item.id) || 0) * 0.01, 0);
                const score = macroScore(total, target, settings.scoreWeights) + repeatCost + addonCost + mealComfortCost(portionRows(items), meal.type, isPorridge(main.title));
                options.push({ items, total, score });
            }
        }
    }
    // Prune only after testing real portions: an oversized first recipe must not
    // hide a usable alternative merely because its unscaled calories looked closer.
    const bestByRecipe = new Map<number, number>();
    for (const option of options) bestByRecipe.set(option.items[0].id, Math.min(bestByRecipe.get(option.items[0].id) ?? Infinity, option.score));
    const selected = new Set([...bestByRecipe].sort((a, b) => a[1] - b[1] || a[0] - b[0]).slice(0, settings.candidateLimit).map(([id]) => id));
    return options.filter(option => selected.has(option.items[0].id));
}

// Kept as a focused single-meal entry point; the weekly planner optimizes whole days below.
export const pickMealItems = (candidates: Candidate[], meal: MealSlot, target: Macro, dayRecipeIds: Set<number>, weeklyUsage: Map<number, number>, productUsage: Map<number, number>, settings: GeneratorSettings): PickedMeal | null =>
    optionsForMeal(candidates.filter(c => c.sourceType !== 'recipe' || !dayRecipeIds.has(c.id)), meal, target, weeklyUsage, productUsage, settings).sort((a, b) => a.score - b.score)[0] || null;

export function pickDayMealOptions(candidates: Candidate[], meals: MealSlot[], dayTarget: Macro, weeklyUsage: Map<number, number>, productUsage: Map<number, number>, previousDay: Set<number>, settings: GeneratorSettings): PickedMeal[][] | null {
    type State = { total: Macro; meals: PickedMeal[]; ids: Set<number>; amounts: Map<string, number>; cost: number; score: number };
    let beam: State[] = [{ total: { ...ZERO }, meals: [], ids: new Set(), amounts: new Map(), cost: 0, score: 0 }];
    let fraction = 0;
    for (const meal of meals) {
        fraction += meal.percent;
        const mealTarget = scaleMacro(dayTarget, meal.percent);
        const partialTarget = scaleMacro(dayTarget, fraction);
        // Retain all portion variants of selected recipes: daily B/F/C may balance across meals.
        const options = optionsForMeal(candidates, meal, mealTarget, weeklyUsage, productUsage, settings);
        const optionRows = new Map(options.map(option => [option, portionRows(option.items)]));
        const comfortCosts = new Map(options.map(option => [option, mealComfortCost(optionRows.get(option)!, meal.type, isPorridge(option.items[0].title))]));
        const next: State[] = [];
        for (const state of beam) for (const option of options) {
            const recipeId = option.items[0].id;
            if (state.ids.has(recipeId)) continue;
            const amounts = new Map(state.amounts);
            for (const ingredient of optionRows.get(option)!) amounts.set(ingredient.name, (amounts.get(ingredient.name) || 0) + ingredient.weight);
            if (!validDayPortion(amounts)) continue;
            const total = add(state.total, option.total);
            const mealDeviation = Math.abs(option.total.calories - mealTarget.calories) / Math.max(1, dayTarget.calories);
            const cost = state.cost + mealDeviation * 0.6 + (weeklyUsage.get(recipeId) || 0) * 0.03 + (previousDay.has(recipeId) ? 0.08 : 0) + (option.items.length - 1) * 0.01 + comfortCosts.get(option)!;
            const score = macroScore(total, partialTarget, settings.scoreWeights) + cost;
            next.push({ total, meals: [...state.meals, option], ids: new Set([...state.ids, recipeId]), amounts, cost, score });
        }
        if (!next.length) return null;
        // Distinct recipe sets preserve alternatives needed by later slots (e.g. two snacks).
        const counts = new Map<string, number>();
        beam = next.sort((a, b) => a.score - b.score).filter(state => {
            const key = [...state.ids].sort((a, b) => a - b).join(',');
            const count = counts.get(key) || 0;
            counts.set(key, count + 1);
            return count < 4;
        }).slice(0, 80);
    }
    const seen = new Set<string>();
    return beam.filter(state => {
        const key = [...state.ids].sort((a, b) => a - b).join(',');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, 8).map(state => state.meals);
}

export const pickDayMeals = (...args: Parameters<typeof pickDayMealOptions>): PickedMeal[] | null => pickDayMealOptions(...args)?.[0] || null;
