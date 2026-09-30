import { z } from 'zod';
import { HttpError } from '../utils/validation';

const number = z.number().finite();
const common = {
    goal: z.enum(['loss', 'maintain', 'gain']),
    weight: number.min(20, 'Укажите вес от 20 до 500 кг').max(500, 'Укажите вес от 20 до 500 кг'),
};
export const goalAssessmentSchema = z.discriminatedUnion('mode', [
    z.object({
        ...common, mode: z.literal('calculated'),
        age: number.int().min(18, 'Расчёт доступен с 18 лет').max(120),
        gender: z.enum(['male', 'female']),
        height: number.int().min(100).max(250),
        routine: z.enum(['seated', 'mixed', 'on_feet', 'physical']),
        exercise: z.enum(['none', 'light', 'regular', 'frequent']),
        pace: z.enum(['gentle', 'moderate']),
    }),
    z.object({
        ...common, mode: z.literal('manual'), adultConfirmed: z.literal(true),
        calories: number.int().min(1000, 'Для новой цели укажите не менее 1 000 ккал').max(10000),
    }),
]);
export type GoalInput = z.infer<typeof goalAssessmentSchema>;

// Coarse product assumptions about the whole week, not a validated activity survey.
// The reference and limitations are documented in docs/GOAL-SETTING.md.
const ROUTINE_FACTORS = { seated: 1.4, mixed: 1.55, on_feet: 1.7, physical: 1.9 };
const EXERCISE_INCREMENTS = { none: 0, light: 0.05, regular: 0.1, frequent: 0.2 };

export function assessGoal(input: GoalInput) {
    if (input.mode === 'manual') return {
        calories: input.calories, restingCalories: null, maintenanceCalories: null,
        activityFactor: null, adjustmentPercent: 0, adjustmentCalories: 0,
    };
    const bmi = input.weight / (input.height / 100) ** 2;
    if (input.goal === 'loss' && bmi < 18.5) {
        throw new HttpError(400, 'При таком соотношении роста и веса автоматическое снижение недоступно. Проверьте параметры или обсудите цель со специалистом.');
    }
    const resting = 10 * input.weight + 6.25 * input.height - 5 * input.age + (input.gender === 'male' ? 5 : -161);
    const activityFactor = Math.round((ROUTINE_FACTORS[input.routine] + EXERCISE_INCREMENTS[input.exercise]) * 100) / 100;
    const maintenance = resting * activityFactor;
    const adjustmentPercent = input.goal === 'maintain' ? 0
        : input.goal === 'loss' ? (input.pace === 'gentle' ? -10 : -15)
            : (input.pace === 'gentle' ? 5 : 10);
    const target = maintenance * (1 + adjustmentPercent / 100);
    // No silent clamp: the questionnaire must never turn an out-of-scope result into a recommendation.
    if (resting <= 0 || target < 1000 || target > 10000) {
        throw new HttpError(400, 'Расчёт выходит за диапазон сервиса (1 000–10 000 ккал). Проверьте параметры. Индивидуальную норму лучше определить со специалистом.');
    }
    const calories = Math.round(target / 50) * 50;
    const maintenanceCalories = Math.round(maintenance);
    return { calories, restingCalories: Math.round(resting), maintenanceCalories, activityFactor,
        adjustmentPercent, adjustmentCalories: calories - maintenanceCalories };
}
