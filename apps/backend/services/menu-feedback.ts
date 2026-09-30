import { round, type Macro } from './generator';

export function dayWarning(dayIndex: number, actual: Macro, target: Macro): string | null {
    const labels: Record<keyof Macro, string> = { calories: 'калории', protein: 'белки', fat: 'жиры', carbs: 'углеводы' };
    const format = (value: number) => String(round(value)).replace('.', ',');
    const deviations = (Object.keys(labels) as Array<keyof Macro>).flatMap(key => {
        const delta = actual[key] - target[key];
        if (Math.abs(delta) / Math.max(target[key], 1) <= (key === 'calories' ? 0.1 : 0.2)) return [];
        const percentage = target[key] > 0 ? ` (${format(Math.abs(delta) / target[key] * 100)}%)` : '';
        return [`${labels[key]} ${delta < 0 ? 'ниже' : 'выше'} цели на ${format(Math.abs(delta))} ${key === 'calories' ? 'ккал' : 'г'}${percentage}`];
    });
    return deviations.length ? `День ${dayIndex + 1}: ${deviations.join('; ')}.` : null;
}
