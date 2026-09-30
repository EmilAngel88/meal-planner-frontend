-- Additive migration: keep existing plans and derive snapshots before sources can change.
ALTER TABLE "MealPlanItem" ADD COLUMN "mealIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MealPlanItem" ADD COLUMN "mealTitle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "MealPlanItem" ADD COLUMN "shoppingSnapshot" JSONB;
UPDATE "MealPlanItem" item SET "shoppingSnapshot" = (
    SELECT jsonb_agg(jsonb_build_object('productId', p.id, 'name', p.name,
        'weight', ing.weight * item.scale, 'unitType', p."unitType",
        'quantity', CASE WHEN p."unitType" = 'piece' AND p."unitWeight" > 0 THEN ing.weight * item.scale / p."unitWeight" ELSE ing.weight * item.scale END))
    FROM "Ingredient" ing JOIN "Product" p ON p.id = ing."productId" WHERE ing."recipeId" = item."recipeId"
) WHERE item."recipeId" IS NOT NULL;
UPDATE "MealPlanItem" item SET "shoppingSnapshot" = (
    SELECT jsonb_build_array(jsonb_build_object('productId', p.id, 'name', p.name,
        'weight', item.weight, 'unitType', p."unitType",
        'quantity', CASE WHEN p."unitType" = 'piece' AND p."unitWeight" > 0 THEN item.weight / p."unitWeight" ELSE item.weight END))
    FROM "Product" p WHERE p.id = item."productId"
) WHERE item."productId" IS NOT NULL;
ALTER TABLE "MealPlanItem" DROP CONSTRAINT "MealPlanItem_recipeId_fkey";
ALTER TABLE "MealPlanItem" ADD CONSTRAINT "MealPlanItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MealPlanItem" DROP CONSTRAINT "MealPlanItem_productId_fkey";
ALTER TABLE "MealPlanItem" ADD CONSTRAINT "MealPlanItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
DROP INDEX "Product_name_key";
CREATE UNIQUE INDEX "Product_userId_name_key" ON "Product" ("userId", "name");
CREATE UNIQUE INDEX "Product_base_name_key" ON "Product" ("name") WHERE "isBase" = true;
CREATE INDEX "MealPlan_userId_createdAt_idx" ON "MealPlan" ("userId", "createdAt");
