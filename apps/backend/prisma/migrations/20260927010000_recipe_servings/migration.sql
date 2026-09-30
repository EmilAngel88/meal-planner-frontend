ALTER TABLE "Recipe" ADD COLUMN "servings" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_servings_positive" CHECK ("servings" BETWEEN 1 AND 50);
ALTER TABLE "Profile" ADD COLUMN "goalRate" DOUBLE PRECISION NOT NULL DEFAULT 0.15;
-- Preserve the rate previously used for existing weight-loss goals; calories remain unchanged.
UPDATE "Profile" SET "goalRate" = 0.2 WHERE "goal" = 'loss';
