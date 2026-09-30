import { Router } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../prisma';
import { authenticate } from '../middleware/auth';
import { profileSchema, manualProfileSchema, presetProfileSchema, weightLogSchema, activitySchema, idSchema, calorieSchema, listQuerySchema, HttpError } from '../utils/validation';
import { ACTIVITY_FACTORS, presets, calculateCalories } from '../services/calories';
import { assessGoal, goalAssessmentSchema } from '../services/goal-assessment';

const router = Router();
router.use(authenticate);
router.get('/meta', (_req, res) => res.json({ activityFactors: ACTIVITY_FACTORS, presets }));
router.post('/goal/preview', (req, res) => {
    const input = goalAssessmentSchema.parse(req.body);
    res.json(assessGoal(input));
});
router.post('/goal', async (req, res) => {
    const input = goalAssessmentSchema.parse(req.body);
    const estimate = assessGoal(input);
    const calculated = input.mode === 'calculated';
    const data = {
        goal: input.goal, weight: input.weight, calories: estimate.calories,
        age: calculated ? input.age : null, gender: calculated ? input.gender : null,
        height: calculated ? input.height : null, activity: null,
        goalRate: Math.abs(estimate.adjustmentPercent) / 100,
        goalSetup: { version: 1, input, estimate, savedAt: new Date().toISOString() },
    };
    const profile = await prisma.profile.upsert({ where: { userId: req.userId }, create: { userId: req.userId, ...data }, update: data });
    res.json({ calories: estimate.calories, profile });
});
router.post('/calculate', async (req, res) => {
    const input = profileSchema.parse(req.body);
    const calories = calculateCalories(input);
    if (!calorieSchema.safeParse(calories).success) throw new HttpError(400, 'Расчёт выходит за доступный диапазон. Проверьте параметры или задайте цель вручную.');
    const profile = await prisma.profile.upsert({ where: { userId: req.userId }, create: { userId: req.userId, ...input, calories }, update: { ...input, calories, goalSetup: Prisma.DbNull } });
    res.json({ calories, profile });
});
router.post('/manual', async (req, res) => {
    const input = manualProfileSchema.parse(req.body);
    const profile = await prisma.profile.upsert({ where: { userId: req.userId }, create: { userId: req.userId, ...input }, update: { ...input, goalSetup: Prisma.DbNull } });
    res.json({ calories: profile.calories, profile });
});
router.post('/preset', async (req, res) => {
    const { presetKey, ...input } = presetProfileSchema.parse(req.body);
    const key = presetKey || `${input.goal}_${input.activity}`;
    const calories = Object.hasOwn(presets, key) ? presets[key] : undefined;
    if (!calories) throw new HttpError(400, 'Для выбранных цели и активности нет готового значения. Используйте расчёт или ручной ввод.');
    const profile = await prisma.profile.upsert({ where: { userId: req.userId }, create: { userId: req.userId, ...input, calories }, update: { ...input, calories, goalSetup: Prisma.DbNull } });
    res.json({ calories, profile });
});
router.post('/activities', async (req, res) => {
    const { activities } = activitySchema.parse(req.body);
    const profile = await prisma.profile.findUnique({ where: { userId: req.userId } });
    if (!profile) throw new HttpError(400, 'Сначала сохраните профиль');
    const catalog = await prisma.activity.findMany({ where: { id: { in: activities.map(a => a.activityId) } } });
    const byId = new Map(catalog.map(activity => [activity.id, activity]));
    if (activities.some(a => !byId.has(a.activityId))) throw new HttpError(400, 'Активность не найдена');
    await prisma.userActivity.createMany({ data: activities.map(a => ({ ...a, userId: req.userId })) });
    res.json({ addedCalories: Math.round(activities.reduce((sum, a) => sum + byId.get(a.activityId)!.met * profile.weight * a.duration / 60, 0)) });
});
router.get('/activities', async (_req, res) => res.json(await prisma.activity.findMany({ orderBy: { name: 'asc' } })));
router.post('/weight-log', async (req, res) => {
    const { weight, date } = weightLogSchema.parse(req.body);
    res.status(201).json(await prisma.weightLog.create({ data: { userId: req.userId, weight, date: date ? new Date(`${date}T00:00:00.000Z`) : undefined } }));
});
router.get('/logs', async (req, res) => {
    const { limit, offset } = listQuerySchema.parse(req.query);
    res.json(await prisma.weightLog.findMany({ where: { userId: req.userId }, orderBy: [{ date: 'desc' }, { id: 'desc' }], take: limit, skip: offset }));
});
router.delete('/logs/:id', async (req, res) => {
    const id = idSchema.parse(req.params.id);
    await prisma.weightLog.delete({ where: { id, userId: req.userId } });
    res.status(204).send();
});
router.get('/profile', async (req, res) => res.json(await prisma.profile.findUnique({ where: { userId: req.userId } })));
export default router;
