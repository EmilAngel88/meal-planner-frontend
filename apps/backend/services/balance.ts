import { add, scaleMacro, type Macro, type MealSlot, type PickedMeal, type GeneratorSettings } from './generator';
import { BALANCEABLE_BASE_RECIPES, CATALOG_PORTIONS, ingredientLimit, isPorridge, mealComfortCost, portionRows, validDayPortion, validMealPortion } from './portions';
import { productSnapshot } from './shopping';

const keys = ['calories', 'protein', 'fat', 'carbs'] as const;
const zero = (): Macro => ({ calories: 0, protein: 0, fat: 0, carbs: 0 });

// Balance daily nutrient errors, retaining a strong calorie priority and macro tolerance bands.
export const nutrientFitScore = (actual: Macro, target: Macro, weights: Macro) =>
    keys.reduce((sum, key) => sum + weights[key] * ((actual[key] - target[key]) / Math.max(1, target[key])) ** 2, 0)
    // A substantial calorie deficit must not be traded for a slightly smaller plate.
    + 3 * Math.abs(actual.calories - target.calories) / Math.max(1, target.calories)
    + (['protein', 'fat', 'carbs'] as const).reduce((sum, key) => sum
        + 2 * Math.max(0, Math.abs(actual[key] - target[key]) / Math.max(1, target[key]) - 0.18), 0);

/** Refine a chosen day, as in the video: adjust ingredients, then re-evaluate the entire day. */
export function balanceDayPortions(picked: PickedMeal[], slots: MealSlot[], target: Macro, settings: GeneratorSettings): PickedMeal[] {
    if (settings.minScale === settings.maxScale) return picked;
    const result = picked.map(meal => ({ ...meal, total: { ...meal.total }, items: meal.items.map(item => ({ ...item, shopping: item.shopping.map(i => ({ ...i })) })) }));
    let total = result.reduce((sum, meal) => add(sum, meal.total), zero());
    const calorieTolerance = Math.max(0.1, Math.abs(total.calories / target.calories - 1));
    const dailyAmounts = new Map<string, number>();
    const mealRows = result.map(meal => portionRows(meal.items));
    for (const rows of mealRows) for (const row of rows) dailyAmounts.set(row.name, (dailyAmounts.get(row.name) || 0) + row.weight);
    const porridge = result.map(meal => isPorridge(meal.items[0].title));
    const minimumMealCalories = result.map((meal, index) => Math.min(meal.total.calories, target.calories * slots[index].percent * 0.6));
    type Variable = { meal: number; row: number; name: string; step: number; min: number; max: number; macro: Macro };
    const variables: Variable[] = [];
    for (const [meal, option] of result.entries()) {
        const main = option.items[0];
        if (!main?.isBase || !BALANCEABLE_BASE_RECIPES.has(main.title) || !main.composition?.length || main.composition.length !== main.shopping.length) continue;
        if (main.composition.some(i => !Object.hasOwn(CATALOG_PORTIONS, i.portionName || i.name))) continue;
        for (const [row, ingredient] of main.composition.entries()) {
            const name = ingredient.portionName || ingredient.name;
            const rule = CATALOG_PORTIONS[name];
            // Keep the vegetable component: it is not a calorie filler to be optimized away.
            if (rule.group === 'vegetable') continue;
            const standardWeight = ingredient.weight / (main.servings || 1);
            const min = rule.group === 'oil' ? Math.min(3, standardWeight) : Math.max(rule.step, Math.round(standardWeight * settings.minScale / rule.step) * rule.step);
            const max = Math.min(Math.floor(ingredientLimit(name) / rule.step) * rule.step, Math.round(standardWeight * Math.min(settings.maxScale, 1.8) / rule.step) * rule.step);
            variables.push({ meal, row, name, step: rule.step, min, max, macro: ingredient });
        }
    }
    if (!variables.length) return picked;

    type Move = { variable: Variable; delta: number; macro: Macro };
    const distributionCost = (calories: number, index: number) => 0.15 * ((calories - target.calories * slots[index].percent) / target.calories) ** 2;
    let score = nutrientFitScore(total, target, settings.scoreWeights) + result.reduce((sum, meal, index) => sum + distributionCost(meal.total.calories, index) + mealComfortCost(mealRows[index], slots[index].type, porridge[index]), 0);

    // Bounded coordinate search, with pairs to trade e.g. oil for a little more rice.
    // A single change alone may not improve the day even though the pair does.
    for (let iteration = 0; iteration < 80; iteration++) {
        const moves: Move[] = [];
        for (const variable of variables) for (const direction of [-1, 1]) {
            const weight = result[variable.meal].items[0].shopping[variable.row].weight + direction * variable.step;
            if (weight < variable.min || weight > variable.max) continue;
            const delta = direction * variable.step;
            moves.push({ variable, delta, macro: scaleMacro(variable.macro, delta / 100) });
        }
        let best: Move[] | null = null;
        let bestScore = score;
        const consider = (first: Move, second?: Move) => {
            if (second?.variable === first.variable) return;
            const changes = second ? [first, second] : [first];
            const nextTotal = changes.reduce((sum, move) => add(sum, move.macro), total);
            if (Math.abs(nextTotal.calories / target.calories - 1) > calorieTolerance + 1e-9) return;
            const nextAmounts = new Map(dailyAmounts);
            for (const move of changes) nextAmounts.set(move.variable.name, (nextAmounts.get(move.variable.name) || 0) + move.delta);
            if (!validDayPortion(nextAmounts)) return;
            const affected = [...new Set(changes.map(move => move.variable.meal))];
            // Check the same culinary rules used during selection, including the side.
            const proposedRows = new Map(affected.map(index => [index, mealRows[index].map(row => ({ ...row }))]));
            for (const move of changes) proposedRows.get(move.variable.meal)![move.variable.row].weight += move.delta;
            for (const index of affected) {
                if (!validMealPortion(proposedRows.get(index)!, slots[index].type, porridge[index])) return;
                const calories = result[index].total.calories + changes.reduce((sum, m) => sum + (m.variable.meal === index ? m.macro.calories : 0), 0);
                if (calories < minimumMealCalories[index] - 1e-8) return;
            }
            let candidateScore = nutrientFitScore(nextTotal, target, settings.scoreWeights);
            for (const [index, meal] of result.entries()) {
                const delta = changes.reduce((sum, m) => sum + (m.variable.meal === index ? m.macro.calories : 0), 0);
                candidateScore += distributionCost(meal.total.calories + delta, index) + mealComfortCost(proposedRows.get(index) || mealRows[index], slots[index].type, porridge[index]);
            }
            if (candidateScore < bestScore - 1e-9) { bestScore = candidateScore; best = changes; }
        };
        for (let i = 0; i < moves.length; i++) {
            consider(moves[i]);
            for (let j = i + 1; j < moves.length; j++) consider(moves[i], moves[j]);
        }
        if (!best) break;
        for (const move of best as Move[]) {
            const { meal, row, name } = move.variable;
            const option = result[meal];
            const main = option.items[0];
            main.shopping[row] = productSnapshot(main.composition![row], main.shopping[row].weight + move.delta);
            Object.assign(main, add(main, move.macro));
            main.weight += move.delta;
            option.total = add(option.total, move.macro);
            total = add(total, move.macro);
            mealRows[meal][row].weight += move.delta;
            dailyAmounts.set(name, (dailyAmounts.get(name) || 0) + move.delta);
        }
        score = bestScore;
    }
    // Recompute from actual weights to avoid accumulated floating-point drift.
    for (const meal of result) {
        const main = meal.items[0];
        if (variables.some(v => result[v.meal] === meal)) {
            const nutrition = main.shopping.reduce((sum, row, index) => add(sum, scaleMacro(main.composition![index], row.weight / 100)), zero());
            Object.assign(main, nutrition);
            main.shopping = main.shopping.filter(row => row.weight > 0);
            main.weight = main.shopping.reduce((sum, row) => sum + row.weight, 0);
        }
        meal.total = meal.items.reduce((sum, item) => add(sum, item), zero());
    }
    return result;
}
