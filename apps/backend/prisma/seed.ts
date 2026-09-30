import 'dotenv/config';
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

import { products } from './catalog/products';
import { recipes } from './catalog/recipes';
import { quantityForWeight } from '../services/nutrition';
const activities = [
    { name: "Бег (умеренный, 8 км/ч)", category: "cardio", met: 8.3 },
    { name: "Бег (быстрый, 12 км/ч)", category: "cardio", met: 11.5 },
    { name: "Бег (марафонский темп, 16 км/ч)", category: "cardio", met: 13.3 },
    { name: "Ходьба (медленная, 3 км/ч)", category: "cardio", met: 2.5 },
    { name: "Ходьба (быстрая, 5 км/ч)", category: "cardio", met: 3.8 },
    { name: "Ходьба в горку", category: "cardio", met: 6.0 },
    { name: "Плавание (спокойное)", category: "cardio", met: 6.0 },
    { name: "Плавание (интенсивное)", category: "cardio", met: 9.8 },
    { name: "Плавание (брасс)", category: "cardio", met: 8.3 },
    { name: "Плавание (баттерфляй)", category: "cardio", met: 13.8 },
    { name: "Велосипед (медленно, 16 км/ч)", category: "cardio", met: 4.0 },
    { name: "Велосипед (средний темп, 20 км/ч)", category: "cardio", met: 7.5 },
    { name: "Велосипед (быстрый, 25+ км/ч)", category: "cardio", met: 10.0 },
    { name: "Йога", category: "mind_body", met: 2.5 },
    { name: "Растяжка", category: "mind_body", met: 2.3 },
    { name: "Медитация (сидя)", category: "mind_body", met: 1.0 },
    { name: "Силовая тренировка (умеренно)", category: "strength", met: 6.0 },
    { name: "Силовая тренировка (интенсивно)", category: "strength", met: 8.0 },
    { name: "Кроссфит", category: "strength", met: 9.0 },
    { name: "Футбол (любительский)", category: "sport", met: 7.0 },
    { name: "Баскетбол (игра)", category: "sport", met: 8.0 },
    { name: "Теннис (парный)", category: "sport", met: 6.0 },
    { name: "Теннис (одиночный)", category: "sport", met: 8.0 },
    { name: "Настольный теннис", category: "sport", met: 4.0 },
    { name: "Волейбол (пляжный)", category: "sport", met: 6.0 },
    { name: "Эллиптический тренажёр", category: "cardio", met: 5.0 },
    { name: "Гребля (умеренно)", category: "cardio", met: 7.0 },
    { name: "Гребля (интенсивно)", category: "cardio", met: 12.0 },
    { name: "Скакалка (умеренно)", category: "cardio", met: 10.0 },
    { name: "Скакалка (быстро)", category: "cardio", met: 12.3 },
    { name: "Поход (лес, горы)", category: "outdoor", met: 6.0 },
    { name: "Катание на лыжах (спокойно)", category: "outdoor", met: 7.0 },
    { name: "Катание на лыжах (спуск)", category: "outdoor", met: 8.0 },
    { name: "Сноуборд", category: "outdoor", met: 7.0 },
    { name: "Уборка квартиры", category: "daily", met: 3.0 },
    { name: "Мытьё полов", category: "daily", met: 3.5 },
    { name: "Готовка", category: "daily", met: 2.5 },
    { name: "Игры с детьми (активные)", category: "daily", met: 3.5 },
];

async function seedActivities() {
    for (const act of activities) {
        await prisma.activity.upsert({
            where: { name: act.name },
            update: { met: act.met, category: act.category },
            create: { name: act.name, met: act.met, category: act.category },
        });
    }
}

async function main() {
    await seedActivities();
    await prisma.$transaction(async tx => {
        const productMap = new Map<string, Awaited<ReturnType<typeof tx.product.create>>>();
        for (const product of products) {
            const existing = await tx.product.findFirst({ where: { name: product.name, isBase: true } });
            const data = { ...product, isBase: true, visibility: 'public', userId: null,
                unitType: product.unitType ?? 'gram', unitWeight: product.unitWeight ?? null, category: product.category ?? 'base' };
            const saved = existing ? await tx.product.update({ where: { id: existing.id }, data }) : await tx.product.create({ data });
            productMap.set(saved.name, saved);
        }
        for (const { ingredients: sourceIngredients, ...recipe } of recipes) {
            const existing = await tx.recipe.findFirst({ where: { title: recipe.title, isBase: true } });
            const ingredients = sourceIngredients.map(i => {
                const p = productMap.get(i.name);
                if (!p) throw new Error(`Missing catalogue product: ${i.name}`);
                return { productId: p.id, weight: i.weight, unitType: p.unitType, quantity: quantityForWeight(p, i.weight) };
            });
            const data = { ...recipe, isBase: true, visibility: 'public', isEnabled: true, userId: null };
            if (existing) await tx.recipe.update({ where: { id: existing.id }, data: { ...data, ingredients: { deleteMany: {}, create: ingredients } } });
            else await tx.recipe.create({ data: { ...data, ingredients: { create: ingredients } } });
        }
    }, { timeout: 30000 });
    console.log(`Seed completed: ${products.length} products, ${recipes.length} recipes, activities`);
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
