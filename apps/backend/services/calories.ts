export const ACTIVITY_FACTORS = { low: 1.2, light: 1.375, training4: 1.418, training5: 1.462, training6: 1.506, daily: 1.6375, medium: 1.55, high: 1.725, extreme: 1.9 };
export const presets: Record<string, number> = { loss_low: 1800, loss_medium: 2000, maintain_medium: 2400, gain_high: 3000 };
export function calculateCalories(input: { gender: 'male' | 'female'; weight: number; height: number; age: number; activity: keyof typeof ACTIVITY_FACTORS; goal: 'loss' | 'maintain' | 'gain'; goalRate?: number }) {
    const bmr = 10 * input.weight + 6.25 * input.height - 5 * input.age + (input.gender === 'male' ? 5 : -161);
    const tdee = Math.round(Math.round(bmr) * ACTIVITY_FACTORS[input.activity]);
    const rate = input.goalRate ?? (input.goal === 'loss' ? 0.2 : 0.15);
    return Math.round(tdee * (input.goal === 'loss' ? 1 - rate : input.goal === 'gain' ? 1 + rate : 1));
}
