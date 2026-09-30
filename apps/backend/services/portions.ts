// Culinary defaults for this catalog, not medical intake limits.
// Bounds apply to an ingredient in one meal; recipes remain the unit of composition.
export type FoodGroup = 'grain' | 'bread' | 'protein' | 'egg' | 'dairy' | 'fruit' | 'vegetable' | 'nuts' | 'oil' | 'drink' | 'other';
type Portion = { group: FoodGroup; max: number; step: number; addon?: number[]; cookedFactor?: number };
export const CATALOG_PORTIONS: Record<string, Portion> = {
    'Рис сухой': { group: 'grain', max: 110, step: 5, cookedFactor: 2.7 },
    'Гречка сухая': { group: 'grain', max: 120, step: 5, cookedFactor: 2.5 },
    'Макароны сухие': { group: 'grain', max: 120, step: 5, cookedFactor: 2.5 },
    'Картофель сырой': { group: 'grain', max: 300, step: 25 },
    'Овсяные хлопья': { group: 'grain', max: Infinity, step: 5 },
    'Яйцо куриное': { group: 'egg', max: 165, step: 55 },
    'Творог 5%': { group: 'dairy', max: 250, step: 25 },
    'Йогурт греческий 2%': { group: 'dairy', max: 250, step: 25 },
    'Молоко 2.5%': { group: 'drink', max: 250, step: 25 },
    'Сок апельсиновый': { group: 'drink', max: 200, step: 25 },
    'Банан': { group: 'fruit', max: 180, step: 60, addon: [120] },
    'Яблоко': { group: 'fruit', max: 200, step: 75, addon: [150] },
    'Хлеб цельнозерновой': { group: 'bread', max: 80, step: 10, addon: [30, 50] },
    'Сыр 30%': { group: 'dairy', max: 50, step: 5 },
    'Куриная грудка': { group: 'protein', max: 220, step: 10 },
    'Индейка филе': { group: 'protein', max: 220, step: 10 },
    'Говядина постная': { group: 'protein', max: 220, step: 10 },
    'Лосось': { group: 'protein', max: 220, step: 10 },
    'Тунец консервированный в воде': { group: 'protein', max: 200, step: 10 },
    'Рис отварной': { group: 'grain', max: 300, step: 25 },
    'Гречка отварная': { group: 'grain', max: 300, step: 25 },
    'Макароны отварные': { group: 'grain', max: 300, step: 25 },
    'Картофель отварной': { group: 'grain', max: 300, step: 25 },
    'Фасоль консервированная': { group: 'grain', max: 250, step: 25 },
    'Овощной салат': { group: 'vegetable', max: 250, step: 25 },
    'Огурец': { group: 'vegetable', max: 200, step: 25 },
    'Помидор': { group: 'vegetable', max: 200, step: 25 },
    'Брокколи': { group: 'vegetable', max: 250, step: 25 },
    'Оливковое масло': { group: 'oil', max: 15, step: 1 },
    'Орехи миндаль': { group: 'nuts', max: 30, step: 5, addon: [15, 25] },
};
export const mealWeightLimit = (type: string) => type === 'snack' ? 350 : type === 'breakfast' ? 500 : 650;
// Prevent repeatedly using the same convenient ingredient to fill the entire day.
export const DAILY_VARIETY_LIMITS: Record<string, number> = {
    'Банан': 300, 'Яблоко': 300, 'Творог 5%': 400, 'Йогурт греческий 2%': 450,
    'Орехи миндаль': 50, 'Яйцо куриное': 220, 'Хлеб цельнозерновой': 150,
    'Сок апельсиновый': 250,
};

// Reviewed simple dishes whose ingredients can vary independently without breaking a recipe.
// Personal recipes and future catalog additions retain their original proportions by default.
export const BALANCEABLE_BASE_RECIPES = new Set([
    'Овсянка с яблоком и миндалем', 'Тосты с бананом и творогом', 'Йогурт с овсяными хлопьями и яблоком',
    'Банан с миндалем', 'Овсянка с бананом и молоком', 'Омлет с цельнозерновым хлебом',
    'Творог с яблоком', 'Греческий йогурт с бананом и миндалем', 'Яйца с сыром и овощами',
    'Курица с рисом и салатом', 'Индейка с гречкой и брокколи', 'Говядина с картофелем и салатом',
    'Лосось с рисом и овощами', 'Паста с тунцом и овощами', 'Фасоль с курицей и овощами',
    'Курица с гречкой', 'Индейка с рисом', 'Легкий ужин с тунцом', 'Лосось с брокколи',
    'Творог с миндалем', 'Сэндвич с тунцом', 'Яблоко с миндалем', 'Йогурт и сок', 'Банан и творог',
    'Рис с яйцом и овощами', 'Картофель с индейкой и салатом', 'Гречка с говядиной', 'Куриный салат с хлебом',
    'Чечевица с овощами в томатном соусе', 'Булгур с индейкой и овощами',
    'Треска с картофелем и овощами', 'Курица с нутом в томатном соусе', 'Тофу с гречкой и грибами',
    'Тосты с арахисовой пастой и бананом', 'Йогурт с грушей и грецким орехом',
    'Тосты с сыром и помидором', 'Творог с ягодами и грецким орехом',
]);

// Explicit coverage of the expanded catalog: no 300 g fallback for oil, seeds or sugar.
Object.assign(CATALOG_PORTIONS, Object.fromEntries([
    ...['Булгур сухой', 'Кускус сухой', 'Киноа сухая', 'Пшено', 'Перловая крупа'].map(name => [name, { group: 'grain', max: 120, step: 5, cookedFactor: 2.7 }]),
    ...['Чечевица сухая', 'Нут сухой'].map(name => [name, { group: 'grain', max: 90, step: 5, cookedFactor: 2.5 }]),
    ...['Лук репчатый', 'Морковь', 'Капуста белокочанная', 'Перец сладкий', 'Кабачок', 'Цветная капуста', 'Шпинат', 'Шампиньоны', 'Свёкла', 'Тыква', 'Горошек замороженный', 'Кукуруза замороженная', 'Томаты протёртые'].map(name => [name, { group: 'vegetable', max: 250, step: 5 }]),
    ...['Апельсин', 'Груша', 'Киви', 'Клубника', 'Голубика'].map(name => [name, { group: 'fruit', max: 200, step: 25 }]),
    ...['Треска, филе', 'Минтай, филе', 'Креветки очищенные', 'Тофу плотный'].map(name => [name, { group: 'protein', max: 220, step: 10 }]),
    ...['Творог 2%', 'Творог 9%', 'Йогурт натуральный без сахара'].map(name => [name, { group: 'dairy', max: 250, step: 25 }]),
    ...['Кефир 1%', 'Кефир 2.5%', 'Ряженка 4%', 'Молоко 1.5%', 'Молоко 3.2%'].map(name => [name, { group: 'drink', max: 250, step: 25 }]),
]));
Object.assign(CATALOG_PORTIONS, {
    'Нут консервированный': { group: 'grain', max: 250, step: 25 },
    'Мука пшеничная': { group: 'other', max: 80, step: 5 },
    'Грецкий орех': { group: 'nuts', max: 30, step: 5 },
    'Арахисовая паста без соли': { group: 'nuts', max: 30, step: 5 },
    'Семена льна': { group: 'nuts', max: 15, step: 5 },
    'Масло подсолнечное': { group: 'oil', max: 15, step: 1 },
    'Масло сливочное несолёное': { group: 'oil', max: 15, step: 1 },
    'Сахар': { group: 'other', max: 15, step: 1 },
    'Вода питьевая': { group: 'drink', max: 400, step: 25 },
    'Сметана 15%': { group: 'dairy', max: 40, step: 5 },
    'Сыр полутвёрдый': { group: 'dairy', max: 50, step: 5 },
});

// Oats are governed by the recipe and cooked meal volume, with no personal gram cap.
export const ingredientLimit = (name: string) => CATALOG_PORTIONS[name]?.max ?? 300;

export type PortionRow = { name: string; weight: number };
type PortionItem = { title: string; shopping: Array<{ productId: number; name: string; weight: number }>; composition?: Array<{ id: number; name: string; portionName?: string }> };
// Use the ingredient identity, not its display label (which may include a brand).
export function portionRows(items: PortionItem[]): PortionRow[] {
    return items.flatMap(item => item.shopping.map(row => {
        const ingredient = item.composition?.find(i => i.id === row.productId);
        return { name: ingredient?.portionName || ingredient?.name || row.name, weight: row.weight };
    }));
}

// A conservative planning estimate, not a measured cooked yield. Milk/water already
// present in porridge count toward its hydration, rather than being counted twice.
export function estimatedMealWeight(rows: PortionRow[], porridge = false): number {
    const weight = rows.reduce((sum, row) => sum + row.weight * (CATALOG_PORTIONS[row.name]?.cookedFactor ?? 1), 0);
    if (!porridge) return weight;
    const oats = rows.filter(r => r.name === 'Овсяные хлопья').reduce((sum, r) => sum + r.weight, 0);
    const liquid = rows.filter(r => r.name.startsWith('Молоко ') || r.name === 'Вода питьевая').reduce((sum, r) => sum + r.weight, 0);
    return weight + Math.max(0, oats * 3 - liquid);
}
export const isPorridge = (title: string) => /^Овсянка /i.test(title);
const groupLimits: Partial<Record<FoodGroup, number>> = { grain: 350, bread: 80, nuts: 30, oil: 15, fruit: 250, protein: 250, egg: 165, dairy: 300, drink: 400, vegetable: 350 };
export function validMealPortion(rows: PortionRow[], type: string, porridge = false): boolean {
    const amounts = new Map<string, number>();
    const groups = new Map<FoodGroup, number>();
    for (const row of rows) {
        if (!Number.isFinite(row.weight) || row.weight < 0) return false;
        amounts.set(row.name, (amounts.get(row.name) || 0) + row.weight);
        const rule = CATALOG_PORTIONS[row.name];
        if (rule) groups.set(rule.group, (groups.get(rule.group) || 0) + row.weight * (rule.cookedFactor ?? 1));
    }
    if ([...amounts].some(([name, weight]) => weight > ingredientLimit(name) + 1e-8)) return false;
    if ([...groups].some(([group, weight]) => weight > (groupLimits[group] ?? Infinity) + 1e-8)) return false;
    if (porridge) {
        const oats = amounts.get('Овсяные хлопья') || 0;
        const liquid = [...amounts].reduce((sum, [name, weight]) => sum + (name.startsWith('Молоко ') || name === 'Вода питьевая' ? weight : 0), 0);
        if (liquid > 0 && oats > 0 && (liquid < oats * 1.5 || liquid > oats * 4.5)) return false;
    }
    return estimatedMealWeight(rows, porridge) <= mealWeightLimit(type) + 1e-8;
}
export function validDayPortion(amounts: Map<string, number>): boolean {
    if ([...amounts].some(([name, weight]) => weight > (DAILY_VARIETY_LIMITS[name] ?? Infinity) + 1e-8)) return false;
    const groupWeight = (group: FoodGroup) => [...amounts].reduce((sum, [name, weight]) => sum + (CATALOG_PORTIONS[name]?.group === group ? weight : 0), 0);
    return groupWeight('nuts') <= 50 + 1e-8 && groupWeight('oil') <= 40 + 1e-8 && groupWeight('dairy') <= 650 + 1e-8;
}
export function mealComfortCost(rows: PortionRow[], type: string, porridge = false): number {
    const comfortableWeight = type === 'snack' ? 275 : type === 'breakfast' ? 400 : 525;
    return 0.015 * Math.max(0, (estimatedMealWeight(rows, porridge) - comfortableWeight) / (mealWeightLimit(type) - comfortableWeight)) ** 2;
}

export function canAddToRecipe(ingredientNames: string[], productName: string, mealType: string) {
    if (ingredientNames.includes(productName)) return false;
    const addon = CATALOG_PORTIONS[productName];
    if (!addon?.addon) return false;
    const groups = new Set<FoodGroup | undefined>(ingredientNames.map(name => CATALOG_PORTIONS[name]?.group));
    if (groups.has(undefined)) return false;
    // Sweet bowl pairings must not attach nuts to savory cheese/vegetable dishes.
    const sweet = !groups.has('egg') && !groups.has('protein') && !groups.has('vegetable') && !groups.has('bread');
    if (addon.group === 'nuts') return ['breakfast', 'snack'].includes(mealType) && sweet && (groups.has('dairy') || groups.has('grain')) && !groups.has('nuts');
    if (addon.group === 'fruit') return ['breakfast', 'snack'].includes(mealType) && sweet && !groups.has('fruit') && (groups.has('dairy') || groups.has('grain'));
    if (addon.group === 'bread') return ['lunch', 'dinner', 'any'].includes(mealType) && groups.has('protein') && groups.has('vegetable') && !groups.has('grain') && !groups.has('bread');
    return false;
}
