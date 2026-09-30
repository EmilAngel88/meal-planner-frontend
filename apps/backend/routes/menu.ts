import { assertGenerationAccess, withGenerationCharge } from '../services/billing/access';
import { per100g } from '../services/nutrition';
import { Router } from "express";
import { Prisma } from '@prisma/client';
import { idSchema, preferencesSchema, collectionSchema, generateSchema, HttpError } from '../utils/validation';
import { type Macro, type Candidate, round, add, normalizeMeals, targetFromCalories, targetFromWeight } from '../services/generator';
import { aggregateShopping, productSnapshot, type ShoppingIngredient } from '../services/shopping';
import { generationPool } from '../services/generation-pool';
import { generationAdmission } from '../middleware/capacity';
import { z } from 'zod';
import prisma from "../prisma";
import { authenticate } from "../middleware/auth";

const router = Router();
router.use(authenticate);
const generationProductSelect = {
    id: true, name: true, brand: true, isBase: true, isArchived: true, category: true,
    baseProductId: true, mealTypes: true, unitType: true, unitWeight: true,
    nutritionBasis: true, density: true, calories: true, protein: true, fat: true, carbs: true,
} as const;

const parseStartDate = (value: unknown) => {
    if (typeof value !== "string" || !value) return new Date();
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? new Date() : date;
};

router.get("/settings", async (req, res) => {
    const userId = req.userId;
    const { limit, offset } = z.object({ limit: z.coerce.number().int().min(1).max(200).default(200), offset: z.coerce.number().int().min(0).max(1000000).default(0) }).parse(req.query);
    const [recipes, preferences, collections, profile] = await Promise.all([
        prisma.recipe.findMany({
            where: { OR: [{ isBase: true, isEnabled: true }, { userId }] },
            select: { id: true, title: true, servings: true, mealTypes: true, isBase: true, isEnabled: true, userId: true },
            orderBy: [{ isBase: "desc" }, { title: "asc" }, { id: 'asc' }],
            take: limit + 1, skip: offset,
        }),
        prisma.recipePreference.findMany({ where: { userId }, orderBy: { id: 'asc' }, take: limit + 1, skip: offset }),
        prisma.recipeCollection.findMany({
            where: { userId },
            include: { items: true },
            orderBy: [{ updatedAt: "desc" }, { id: 'desc' }],
            take: limit + 1, skip: offset,
        }),
        prisma.profile.findUnique({ where: { userId } }),
    ]);

    res.json({
        defaultMeals: normalizeMeals(profile?.calories || 2000),
        baseRecipes: recipes.slice(0, limit).filter((recipe) => recipe.isBase),
        customRecipes: recipes.slice(0, limit).filter((recipe) => !recipe.isBase),
        preferences: preferences.slice(0, limit),
        collections: collections.slice(0, limit),
        hasMore: recipes.length > limit || preferences.length > limit || collections.length > limit,
    });
});

router.put("/preferences", async (req, res) => {
    const userId = req.userId;
    const { preferences } = preferencesSchema.parse(req.body);

    const allowed = await prisma.recipe.findMany({ where: { id: { in: preferences.map(p => p.recipeId) }, OR: [{ isBase: true, isEnabled: true }, { userId }] }, select: { id: true } });
    if (preferences.some(pref => !allowed.some(recipe => recipe.id === pref.recipeId))) throw new HttpError(400, 'Рецепт недоступен');
    const saved = await prisma.$transaction(preferences.map(({ recipeId, ...data }) => prisma.recipePreference.upsert({
        where: { userId_recipeId: { userId, recipeId } }, update: data, create: { userId, recipeId, ...data },
    })));

    res.json(saved);
});

router.post("/collections", async (req, res) => {
    const userId = req.userId;
    const { name, recipeIds } = collectionSchema.parse(req.body);

    const allowedRecipes = await prisma.recipe.findMany({
        where: { id: { in: recipeIds }, userId, isBase: false },
        select: { id: true },
    });

    if (allowedRecipes.length !== recipeIds.length) throw new HttpError(400, 'Коллекция может содержать только ваши рецепты');
    const collection = await prisma.recipeCollection.create({
        data: {
            userId,
            name,
            items: { create: allowedRecipes.map((recipe) => ({ recipeId: recipe.id })) },
        },
        include: { items: { include: { recipe: true } } },
    });

    res.status(201).json(collection);
});

router.put("/collections/:id", async (req, res) => {
    const userId = req.userId;
    const id = idSchema.parse(req.params.id);
    const collection = await prisma.recipeCollection.findFirst({ where: { id, userId } });
    if (!collection) return res.status(404).json({ message: "Коллекция не найдена" });

    const { name, recipeIds } = collectionSchema.partial().parse(req.body);
    const allowedRecipes = recipeIds
        ? await prisma.recipe.findMany({
            where: { id: { in: recipeIds }, userId, isBase: false },
            select: { id: true },
        })
        : null;

    if (recipeIds && allowedRecipes?.length !== recipeIds.length) throw new HttpError(400, 'Коллекция может содержать только ваши рецепты');
    const updated = await prisma.recipeCollection.update({
        where: { id },
        data: {
            name,
            ...(allowedRecipes ? { items: { deleteMany: {}, create: allowedRecipes.map((recipe) => ({ recipeId: recipe.id })) } } : {}),
        },
        include: { items: { include: { recipe: true } } },
    });

    res.json(updated);
});

router.delete("/collections/:id", async (req, res) => {
    const userId = req.userId;
    const id = idSchema.parse(req.params.id);
    const collection = await prisma.recipeCollection.findFirst({ where: { id, userId } });
    if (!collection) return res.status(404).json({ message: "Коллекция не найдена" });

    await prisma.recipeCollection.delete({ where: { id } });
    res.status(204).send();
});

router.post("/generate", generationAdmission(), async (req, res) => {
    const input = generateSchema.parse(req.body ?? {});
    const userId = req.userId;
    const profile = await prisma.profile.findUnique({ where: { userId } });

    if (!profile) {
        return res.status(400).json({ message: "Сначала создайте цель по калориям в профиле" });
    }

    await assertGenerationAccess(userId);
    const daysCount = input.daysCount;
    const startDate = parseStartDate(input.startDate);
    const settings = {
        daysCount,
        generatorVersion: 5,
        macroMode: input.macroMode || (input.macroRatios ? 'ratio' : 'weight'),
        proteinPerKg: input.proteinPerKg,
        fatPerKg: input.fatPerKg,
        profileWeight: profile.weight,
        collectionId: input.collectionId ?? null,
        warnings: [] as string[],
        startDate: startDate.toISOString().slice(0, 10),
        meals: normalizeMeals(profile.calories, input.meals),
        macroRatios: input.macroRatios,
        minScale: input.minScale ?? 0.5,
        maxScale: input.maxScale ?? 1.8,
        candidateLimit: input.candidateLimit ?? 18,
        scoreWeights: {
            protein: input.scoreWeights?.protein ?? 1.5,
            calories: input.scoreWeights?.calories ?? 5,
            fat: input.scoreWeights?.fat ?? 1,
            carbs: input.scoreWeights?.carbs ?? 1,
        },
    };
    let dayTarget: Macro;
    try {
        dayTarget = settings.macroMode === 'ratio' ? targetFromCalories(profile.calories, settings.macroRatios) : targetFromWeight(profile.calories, profile.weight, settings.proteinPerKg, settings.fatPerKg);
    } catch (error) { throw new HttpError(400, (error as Error).message); }
    const selectedRecipeIds = new Set<number>(input.recipeIds);

    if (input.collectionId) {
        const collection = await prisma.recipeCollection.findFirst({
            where: { id: input.collectionId, userId },
            include: { items: true },
        });
        if (!collection) throw new HttpError(404, 'Коллекция не найдена');
        collection.items.forEach(item => selectedRecipeIds.add(item.recipeId));
    }

    const [recipes, products, preferences] = await Promise.all([
        prisma.recipe.findMany({
            where: { OR: [{ isBase: true, isEnabled: true }, { userId, OR: [{ id: { in: [...selectedRecipeIds] } }, { preferences: { some: { userId, includeInGeneration: true, enabled: true } } }] }] },
            select: { id: true, title: true, servings: true, mealTypes: true, isBase: true,
                ingredients: { select: { weight: true, product: { select: generationProductSelect } } } },
            orderBy: { id: 'asc' },
            take: 501,
        }),
        prisma.product.findMany({ where: { isBase: true }, select: generationProductSelect }),
        prisma.recipePreference.findMany({ where: { userId, recipe: { OR: [{ isBase: true }, { id: { in: [...selectedRecipeIds] } }, { preferences: { some: { userId, includeInGeneration: true, enabled: true } } }] } }, take: 501 }),
    ]);
    if (recipes.length > 500) throw new HttpError(422, 'Для одного составления меню выберите не более 500 рецептов. Отключите лишние рецепты в настройках меню.');

    const productNames = new Map(products.filter(p => p.isBase).map(p => [p.id, p.name]));
    const preferenceMap = new Map(preferences.map(pref => [pref.recipeId, pref] as const));
    const enabledRecipes = recipes.filter((recipe) => {
        const pref = preferenceMap.get(recipe.id);
        if (pref?.enabled === false || recipe.ingredients.some(i => i.product.isArchived)) return false;
        if (recipe.isBase) return true;
        return pref?.includeInGeneration === true || selectedRecipeIds.has(recipe.id);
    });

    const recipeCandidates: Candidate[] = enabledRecipes.map((recipe) => {
        const macro = recipe.ingredients.reduce((sum: Macro, ingredient) => {
            const multiplier = ingredient.weight / 100;
            const product = per100g(ingredient.product);
            return add(sum, {
                calories: product.calories * multiplier,
                protein: product.protein * multiplier,
                fat: product.fat * multiplier,
                carbs: product.carbs * multiplier,
            });
        }, { calories: 0, protein: 0, fat: 0, carbs: 0 });
        const pref = preferenceMap.get(recipe.id);

        return {
            id: recipe.id,
            title: recipe.title,
            servings: recipe.servings,
            composition: recipe.ingredients.map(i => ({ ...per100g(i.product), portionName: productNames.get(i.product.baseProductId ?? i.product.id) || i.product.name, weight: i.weight })),
            sourceType: "recipe" as const,
            shopping: recipe.ingredients.map(ingredient => productSnapshot(ingredient.product, ingredient.weight)),
            mealTypes: recipe.mealTypes,
            weight: recipe.ingredients.reduce((sum: number, ingredient) => sum + ingredient.weight, 0),
            isBase: recipe.isBase,
            maxPerWeek: pref?.maxPerWeek ?? undefined,
            ...macro,
        };
    }).filter((recipe: Candidate) => recipe.calories > 0);

    const productCandidates: Candidate[] = products.filter(product => product.isBase && !product.isArchived && product.category !== "sauce").map(per100g).map((product) => ({
        id: product.id,
        title: product.name,
        composition: [{ ...product, weight: product.unitType === "piece" && product.unitWeight ? product.unitWeight : 100 }],
        sourceType: "product" as const,
        shopping: [productSnapshot(product, product.unitType === "piece" && product.unitWeight ? product.unitWeight : 100)],
        mealTypes: product.mealTypes,
        weight: product.unitType === "piece" && product.unitWeight ? product.unitWeight : 100,
        calories: product.calories * ((product.unitType === "piece" && product.unitWeight ? product.unitWeight : 100) / 100),
        protein: product.protein * ((product.unitType === "piece" && product.unitWeight ? product.unitWeight : 100) / 100),
        fat: product.fat * ((product.unitType === "piece" && product.unitWeight ? product.unitWeight : 100) / 100),
        carbs: product.carbs * ((product.unitType === "piece" && product.unitWeight ? product.unitWeight : 100) / 100),
    }));

    const candidates = [...recipeCandidates, ...productCandidates];
    if (!candidates.length) {
        return res.status(400).json({ message: "Добавьте базовые или пользовательские рецепты для генерации меню" });
    }

    if (res.destroyed) return;
    const controller = new AbortController();
    const cancel = () => { if (!res.writableFinished) controller.abort(); };
    res.once('close', cancel);
    let generated;
    try { generated = await generationPool.run({ candidates, daysCount, meals: settings.meals, dayTarget, settings }, controller.signal); }
    finally { res.off('close', cancel); }
    if (controller.signal.aborted || res.destroyed) return;
    const { pickedMeals, total, warnings } = generated;
    settings.warnings = warnings;
    const plan = await withGenerationCharge(userId, tx => tx.mealPlan.create({
        data: {
            userId,
            startDate,
            daysCount,
            targetCalories: Math.round(dayTarget.calories * daysCount),
            targetProtein: round(dayTarget.protein * daysCount),
            targetFat: round(dayTarget.fat * daysCount),
            targetCarbs: round(dayTarget.carbs * daysCount),
            totalCalories: round(total.calories),
            totalProtein: round(total.protein),
            totalFat: round(total.fat),
            totalCarbs: round(total.carbs),
            settings: JSON.parse(JSON.stringify(settings)) as Prisma.InputJsonValue,
            items: {
                create: pickedMeals.flatMap(meal => meal.items.map(item => ({
                    dayIndex: meal.dayIndex,
                    mealIndex: meal.mealIndex,
                    mealTitle: meal.meal.title,
                    shoppingSnapshot: item.shopping as Prisma.InputJsonValue,
                    mealType: meal.meal.type,
                    title: item.title,
                    sourceType: item.sourceType,
                    recipeId: item.sourceType === "recipe" ? item.id : undefined,
                    productId: item.sourceType === "product" ? item.id : undefined,
                    scale: item.scale,
                    weight: round(item.weight),
                    calories: round(item.calories),
                    protein: round(item.protein),
                    fat: round(item.fat),
                    carbs: round(item.carbs),
                }))),
            },
        },
        include: { items: true },
    })).catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
            throw new HttpError(409, 'Во время составления меню один из рецептов или продуктов был удалён. Обновите список и составьте меню ещё раз.');
        }
        throw error;
    });

    res.status(201).json(plan);

});

router.get("/", async (req, res) => {
    const userId = req.userId;
    const { limit, offset } = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20), offset: z.coerce.number().int().min(0).max(1000000).default(0) }).parse(req.query);
    const plans = await prisma.mealPlan.findMany({
        where: { userId },
        include: { items: { orderBy: [{ dayIndex: "asc" }, { mealIndex: "asc" }, { id: "asc" }] } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
        skip: offset,
    });

    res.json(plans);
});

router.get('/:id/shopping-list', async (req, res) => {
    const plan = await prisma.mealPlan.findFirst({ where: { id: idSchema.parse(req.params.id), userId: req.userId }, include: { items: { include: { recipe: { select: {
        id: true, cookingMode: true, storageDays: true, freezerFriendly: true, batchNotes: true, storageInstructions: true,
    } } } } } });
    if (!plan) throw new HttpError(404, 'Меню не найдено');
    const snapshots = plan.items.map(item => Array.isArray(item.shoppingSnapshot) ? item.shoppingSnapshot as ShoppingIngredient[] : []);
    const cooking = Object.fromEntries(plan.items.filter(item => item.recipe).map(item => [item.recipe!.id, item.recipe]));
    res.json({ planId: plan.id, rows: aggregateShopping(snapshots), cooking, incomplete: plan.items.some(item => !Array.isArray(item.shoppingSnapshot) || !item.shoppingSnapshot.length) });
});

router.delete('/:id', async (req, res) => {
    const id = idSchema.parse(req.params.id);
    if (!await prisma.mealPlan.findFirst({ where: { id, userId: req.userId } })) throw new HttpError(404, 'Меню не найдено');
    await prisma.mealPlan.delete({ where: { id } });
    res.status(204).send();
});

router.get("/:id", async (req, res) => {
    const userId = req.userId;
    const id = idSchema.parse(req.params.id);
    const plan = await prisma.mealPlan.findFirst({
        where: { id, userId },
        include: { items: true },
    });

    if (!plan) return res.status(404).json({ message: "Меню не найдено" });
    res.json(plan);
});

export default router;
