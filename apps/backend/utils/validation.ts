import { z } from 'zod';

const plainText = z.string().regex(/^[^\0]*$/, 'Текст содержит недопустимый символ');
// IDs may arrive as path strings, but booleans, arrays and exponent notation are not IDs.
export const idSchema = z.union([z.number(), z.string().regex(/^[1-9]\d*$/).transform(Number)]).pipe(z.number().int().positive().max(2147483647));
const queryInteger = z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).pipe(z.number().int().nonnegative().max(2147483647));
export const listQuerySchema = z.object({ limit: queryInteger.pipe(z.number().min(1).max(200)).default(200), offset: queryInteger.default(0) });
export const productQuerySchema = listQuerySchema.extend({ q: plainText.trim().max(200).default('') });
const number = z.number().finite();
const title = plainText.trim().min(1, 'Введите название').max(200);
const mealTypes = z.array(z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'any'])).max(5).default([]).transform(values => [...new Set(values)]);
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Укажите дату').refine(value => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Некорректная дата');
export const authSchema = z.object({ email: z.string().trim().email('Некорректный email').max(254).toLowerCase(), password: z.string().min(1, 'Введите пароль').refine(v => Buffer.byteLength(v, 'utf8') <= 72, 'Пароль должен занимать не более 72 байт') });
export const registerSchema = authSchema.extend({ password: authSchema.shape.password.refine(v => v.length >= 8, 'Пароль должен содержать не менее 8 символов') });
export const productSchema = z.object({
    brand: plainText.trim().max(120).default(''), baseProductId: idSchema.nullable().optional().default(null),
    foodGroup: z.enum(['grain', 'meat', 'fish', 'dairy', 'legumes', 'vegetables', 'fruit', 'nuts', 'fats', 'other']).default('other'),
    preparationState: z.enum(['raw', 'dry', 'cooked', 'as_sold']).default('as_sold'),
    nutritionBasis: z.enum(['100g', '100ml']).default('100g'), density: number.min(0.1).max(2).default(1),
    notes: plainText.trim().max(2000).default(''),
    name: title, mealTypes, calories: number.min(0).max(1000), protein: number.min(0).max(100), fat: number.min(0).max(100), carbs: number.min(0).max(100),
    unitType: z.enum(['gram', 'piece', 'ml']).default('gram'), unitWeight: number.positive().max(100000).nullable().optional().default(null), category: z.enum(['base', 'sauce']).default('base'),
}).refine(v => v.unitType !== 'piece' || !!v.unitWeight, { path: ['unitWeight'], message: 'Для штучного продукта укажите вес штуки' });
export const ingredientSchema = z.object({ productId: idSchema, weight: number.positive().max(100000), quantity: number.positive().max(100000).nullable().optional(), unitType: z.enum(['gram', 'piece', 'ml']).nullable().optional() });
export const recipeSchema = z.object({
    instructions: z.array(plainText.trim().min(1).max(2000)).max(30).default([]),
    prepMinutes: number.int().min(0).max(1440).nullable().optional().default(null),
    cookMinutes: number.int().min(0).max(1440).nullable().optional().default(null),
    cookingMode: z.enum(['fresh', 'batch', 'assembly']).default('fresh'),
    storageDays: number.int().min(0).max(4).nullable().optional().default(null),
    storageInstructions: plainText.trim().max(2000).default(''), batchNotes: plainText.trim().max(2000).default(''),
    freezerFriendly: z.boolean().default(false), cookedWeight: number.positive().max(100000).nullable().optional().default(null),
    title, description: plainText.max(10000).default(''), servings: number.int().min(1).max(50).default(1), mealTypes, ingredients: z.array(ingredientSchema).max(100).default([]) });
export const recipeUpdateSchema = recipeSchema.partial();
export const profileSchema = z.object({ age: number.int().min(18).max(120), gender: z.enum(['male', 'female']), height: number.int().min(100).max(250), weight: number.min(20).max(500), activity: z.enum(['low', 'light', 'training4', 'training5', 'training6', 'daily', 'medium', 'high', 'extreme']), goal: z.enum(['loss', 'maintain', 'gain']), goalRate: z.union([z.literal(0.15), z.literal(0.2), z.literal(0.25)]).default(0.15) });
export const calorieSchema = number.int().min(800).max(10000);
export const manualProfileSchema = profileSchema.extend({ calories: calorieSchema });
export const presetProfileSchema = profileSchema.extend({ presetKey: z.string().max(100).optional() });
export const weightLogSchema = z.object({ weight: number.min(20).max(500), date: dateSchema.optional() });
export const activitySchema = z.object({ activities: z.array(z.object({ activityId: idSchema, duration: number.int().positive().max(1440) })).min(1).max(50) }).superRefine(({ activities }, context) => {
    if (new Set(activities.map(activity => activity.activityId)).size !== activities.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['activities'], message: 'Объедините повторяющиеся активности' });
    if (activities.reduce((total, activity) => total + activity.duration, 0) > 1440) context.addIssue({ code: z.ZodIssueCode.custom, path: ['activities'], message: 'Суммарная длительность не может превышать 24 часа' });
});
export const preferenceSchema = z.object({ recipeId: idSchema, enabled: z.boolean().default(true), includeInGeneration: z.boolean().default(false), maxPerWeek: number.int().min(1).max(7).nullable().optional().default(null) });
export const preferencesSchema = z.object({ preferences: z.array(preferenceSchema).max(500) });
export const collectionSchema = z.object({ name: title, recipeIds: z.array(idSchema).max(500).transform(ids => [...new Set(ids)]) });
const ratio = number.min(0).max(1);
const macros = z.object({ protein: ratio, fat: ratio, carbs: ratio }).refine(v => Math.abs(v.protein + v.fat + v.carbs - 1) < 0.001, 'Доли белков, жиров и углеводов должны давать 1');
export const generateSchema = z.object({
    daysCount: number.int().min(1).max(6).default(6), startDate: dateSchema.optional(),
    recipeIds: z.array(idSchema).max(500).default([]), collectionId: idSchema.nullable().optional(),
    meals: z.array(z.object({ type: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'any']), title, percent: number.positive().max(1), maxItems: number.int().min(1).max(4) })).min(1).max(6).optional(),
    macroMode: z.enum(['weight', 'ratio']).optional(), proteinPerKg: number.min(1.75).max(2.2).default(1.75), fatPerKg: number.min(0.8).max(1).default(0.9),
    macroRatios: macros.optional(), minScale: number.min(0.1).max(3).default(0.5), maxScale: number.min(0.1).max(3).default(1.8), candidateLimit: number.int().min(1).max(18).default(18),
    scoreWeights: z.object({ protein: number.positive().max(10), calories: number.positive().max(10), fat: number.positive().max(10), carbs: number.positive().max(10) }).optional(),
}).refine(v => v.minScale <= v.maxScale, 'Минимальная порция не может превышать максимальную');

export class HttpError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
