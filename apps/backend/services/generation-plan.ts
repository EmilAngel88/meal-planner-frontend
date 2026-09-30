import { add, round, type Candidate, type Macro, type MealSlot, type GeneratorSettings, type ScoredItem } from './generator';
import { planDayMeals } from './planner';
import { dayWarning } from './menu-feedback';

export type GenerationInput = {
    candidates: Candidate[];
    daysCount: number;
    meals: MealSlot[];
    dayTarget: Macro;
    settings: GeneratorSettings;
};
export type GenerationResult = {
    pickedMeals: Array<{ dayIndex: number; mealIndex: number; meal: MealSlot; items: ScoredItem[] }>;
    total: Macro;
    warnings: string[];
};

// Pure computation: workers never open database connections or receive credentials.
export function generatePlan({ candidates, daysCount, meals, dayTarget, settings }: GenerationInput): GenerationResult {
    const weeklyRecipeUsage = new Map<number, number>();
    const productUsage = new Map<number, number>();
    const pickedMeals: GenerationResult['pickedMeals'] = [];
    const warnings: string[] = [];
    let previousDay = new Set<number>();
    for (let dayIndex = 0; dayIndex < daysCount; dayIndex++) {
        const pickedDay = planDayMeals(candidates, meals, dayTarget, weeklyRecipeUsage, productUsage, previousDay, settings);
        if (!pickedDay) throw new Error(`Не удалось составить день ${dayIndex + 1} из полноценных блюд с допустимыми порциями. Добавьте рецепты для нужных приёмов пищи, проверьте число порций в рецепте или лимиты повторений.`);
        const daily = pickedDay.reduce((sum, meal) => add(sum, meal.total), { calories: 0, protein: 0, fat: 0, carbs: 0 });
        const warning = dayWarning(dayIndex, daily, dayTarget);
        if (warning) warnings.push(warning);
        previousDay = new Set();
        for (const [mealIndex, picked] of pickedDay.entries()) {
            for (const item of picked.items) {
                if (item.sourceType === 'recipe') {
                    previousDay.add(item.id);
                    weeklyRecipeUsage.set(item.id, (weeklyRecipeUsage.get(item.id) || 0) + 1);
                } else productUsage.set(item.id, (productUsage.get(item.id) || 0) + 1);
            }
            pickedMeals.push({ dayIndex, mealIndex, meal: meals[mealIndex], items: picked.items });
        }
    }
    const total = pickedMeals.flatMap(meal => meal.items).reduce<Macro>((sum, item) => add(sum, { calories: round(item.calories), protein: round(item.protein), fat: round(item.fat), carbs: round(item.carbs) }), { calories: 0, protein: 0, fat: 0, carbs: 0 });
    return { pickedMeals, total, warnings };
}
