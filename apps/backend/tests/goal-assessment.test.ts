import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessGoal, goalAssessmentSchema, type GoalInput } from '../services/goal-assessment';

const base = { mode: 'calculated', goal: 'maintain', weight: 80, height: 180, age: 30, gender: 'male', routine: 'seated', exercise: 'none', pace: 'gentle' } as const;
const parse = (input: unknown) => goalAssessmentSchema.parse(input);

test('the result explains resting energy, everyday activity, adjustment and rounding', () => {
    assert.deepEqual(assessGoal(base), { calories: 2500, restingCalories: 1780, maintenanceCalories: 2492, activityFactor: 1.4, adjustmentPercent: 0, adjustmentCalories: 8 });
    const loss = assessGoal({ ...base, goal: 'loss' });
    assert.equal(loss.calories, 2250);
    assert.equal(loss.adjustmentPercent, -10);
    assert.equal(assessGoal({ ...base, goal: 'gain', pace: 'moderate' }).calories, 2750);
    assert.equal(assessGoal({ ...base, gender: 'female' }).restingCalories, 1614);
});
test('daily routine and training contribute separately, without legacy workout multipliers', () => {
    const seated = assessGoal(base);
    const active = assessGoal({ ...base, routine: 'on_feet' });
    const training = assessGoal({ ...base, exercise: 'regular' });
    const both = assessGoal({ ...base, routine: 'on_feet', exercise: 'regular' });
    assert.equal(training.activityFactor, 1.5);
    assert.equal(both.activityFactor, 1.8);
    assert.ok(active.calories > training.calories && training.calories > seated.calories);
    assert.equal(assessGoal({ ...base, routine: 'physical', exercise: 'frequent' }).activityFactor, 2.1);
});
test('maintenance ignores pace; loss and gain have distinct moderate and gentle adjustments', () => {
    assert.deepEqual(assessGoal(base), assessGoal({ ...base, pace: 'moderate' }));
    for (const [goal, pace, percent] of [['loss', 'gentle', -10], ['loss', 'moderate', -15], ['gain', 'gentle', 5], ['gain', 'moderate', 10]] as const) {
        assert.equal(assessGoal({ ...base, goal, pace }).adjustmentPercent, percent);
    }
});
test('known targets need only weight, intention, calories and adult confirmation', () => {
    const input = parse({ mode: 'manual', goal: 'loss', weight: 80, calories: 2237, adultConfirmed: true });
    assert.deepEqual(assessGoal(input), { calories: 2237, restingCalories: null, maintenanceCalories: null, activityFactor: null, adjustmentPercent: 0, adjustmentCalories: 0 });
    assert.equal(goalAssessmentSchema.safeParse({ ...input, adultConfirmed: false }).success, false);
});
test('answers are required and numeric input and scope boundaries are enforced', () => {
    for (const change of [{ age: 17 }, { age: 30.5 }, { height: 99 }, { weight: NaN }, { weight: Infinity }, { routine: '' }, { exercise: undefined }, { gender: null }, { weight: '80' }, { pace: 'aggressive' }]) {
        assert.equal(goalAssessmentSchema.safeParse({ ...base, ...change }).success, false, JSON.stringify(change));
    }
    for (const calories of [999, 10001, 2200.1, NaN]) {
        assert.equal(goalAssessmentSchema.safeParse({ mode: 'manual', goal: 'maintain', weight: 70, calories, adultConfirmed: true }).success, false);
    }
});
test('the server ignores client-provided estimates and old activity parameters', () => {
    const input = parse({ ...base, calories: 600, activity: 'extreme', goalRate: 0.75, estimate: { calories: 600 } });
    assert.deepEqual(input, base);
    assert.equal(assessGoal(input).calories, 2500);
});
test('out-of-scope loss or calorie results are rejected rather than silently clamped', () => {
    assert.throws(() => assessGoal({ ...base, goal: 'loss', weight: 50 }), /автоматическое снижение недоступно/);
    assert.doesNotThrow(() => assessGoal({ ...base, goal: 'maintain', weight: 50 }));
    const low = parse({ ...base, height: 100, weight: 25, age: 90, gender: 'female' });
    assert.throws(() => assessGoal(low), /диапазон сервиса/);
    assert.throws(() => assessGoal({ ...base, weight: 500, height: 250, routine: 'physical', exercise: 'frequent' }), /диапазон сервиса/);
});
test('every selectable combination yields a finite rounded target for ordinary adult parameters', () => {
    for (const routine of ['seated', 'mixed', 'on_feet', 'physical'] as const) for (const exercise of ['none', 'light', 'regular', 'frequent'] as const) for (const goal of ['loss', 'maintain', 'gain'] as const) for (const pace of ['gentle', 'moderate'] as const) {
        const result = assessGoal(parse({ ...base, routine, exercise, goal, pace }) as GoalInput);
        assert.ok(Number.isFinite(result.calories));
        assert.equal(result.calories % 50, 0);
    }
});
