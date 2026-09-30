import { add, pickDayMealOptions, type Macro, type PickedMeal } from './generator';
import { balanceDayPortions, nutrientFitScore } from './balance';
import { isPorridge, mealComfortCost, portionRows } from './portions';

// Compare complete, refined days. A promising coarse portion grid can otherwise
// lock in recipes that cannot absorb a remaining calorie gap after refinement.
export function planDayMeals(...args: Parameters<typeof pickDayMealOptions>): PickedMeal[] | null {
    const [, slots, target, weeklyUsage, , previousDay, settings] = args;
    const alternatives = pickDayMealOptions(...args);
    if (!alternatives?.length) return null;
    let best: PickedMeal[] | null = null;
    let bestScore = Infinity;
    for (const initial of alternatives) {
        const day = balanceDayPortions(initial, slots, target, settings);
        const total = day.reduce<Macro>((sum, meal) => add(sum, meal.total), { calories: 0, protein: 0, fat: 0, carbs: 0 });
        const score = nutrientFitScore(total, target, settings.scoreWeights)
            + 10 * Math.max(0, Math.abs(total.calories / target.calories - 1) - 0.03)
            + day.reduce((sum, meal, index) => sum
                + mealComfortCost(portionRows(meal.items), slots[index].type, isPorridge(meal.items[0].title))
                + (weeklyUsage.get(meal.items[0].id) || 0) * 0.005 + (previousDay.has(meal.items[0].id) ? 0.01 : 0), 0);
        if (score < bestScore) { bestScore = score; best = day; }
    }
    return best;
}
