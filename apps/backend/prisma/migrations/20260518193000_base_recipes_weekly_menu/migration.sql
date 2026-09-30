ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';

ALTER TABLE "Product" ADD COLUMN "userId" INTEGER;
ALTER TABLE "Product" ADD COLUMN "isBase" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'private';
ALTER TABLE "Product" ADD COLUMN "unitType" TEXT NOT NULL DEFAULT 'gram';
ALTER TABLE "Product" ADD COLUMN "unitWeight" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'base';
ALTER TABLE "Product" ADD CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Recipe" DROP CONSTRAINT IF EXISTS "Recipe_userId_fkey";
ALTER TABLE "Recipe" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Recipe" ADD COLUMN "isBase" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Recipe" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'private';
ALTER TABLE "Recipe" ADD COLUMN "baseRecipeId" INTEGER;
ALTER TABLE "Recipe" ADD COLUMN "isEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Ingredient" ADD COLUMN "quantity" DOUBLE PRECISION;
ALTER TABLE "Ingredient" ADD COLUMN "unitType" TEXT;

CREATE TABLE "RecipePreference" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "recipeId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "includeInGeneration" BOOLEAN NOT NULL DEFAULT false,
    "maxPerWeek" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipePreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecipePreference_userId_recipeId_key" ON "RecipePreference"("userId", "recipeId");
ALTER TABLE "RecipePreference" ADD CONSTRAINT "RecipePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipePreference" ADD CONSTRAINT "RecipePreference_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RecipeCollection" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeCollection_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RecipeCollection" ADD CONSTRAINT "RecipeCollection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RecipeCollectionItem" (
    "id" SERIAL NOT NULL,
    "collectionId" INTEGER NOT NULL,
    "recipeId" INTEGER NOT NULL,

    CONSTRAINT "RecipeCollectionItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecipeCollectionItem_collectionId_recipeId_key" ON "RecipeCollectionItem"("collectionId", "recipeId");
ALTER TABLE "RecipeCollectionItem" ADD CONSTRAINT "RecipeCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "RecipeCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeCollectionItem" ADD CONSTRAINT "RecipeCollectionItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MealPlan" ADD COLUMN "startDate" TIMESTAMP(3);
ALTER TABLE "MealPlan" ADD COLUMN "daysCount" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "MealPlanItem" ADD COLUMN "dayIndex" INTEGER NOT NULL DEFAULT 0;
