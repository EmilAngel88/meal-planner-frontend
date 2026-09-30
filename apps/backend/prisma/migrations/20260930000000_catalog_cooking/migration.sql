ALTER TABLE "Product"
 ADD COLUMN "brand" TEXT NOT NULL DEFAULT '',
 ADD COLUMN "baseProductId" INTEGER,
 ADD COLUMN "foodGroup" TEXT NOT NULL DEFAULT 'other',
 ADD COLUMN "preparationState" TEXT NOT NULL DEFAULT 'as_sold',
 ADD COLUMN "nutritionBasis" TEXT NOT NULL DEFAULT '100g',
 ADD COLUMN "density" DOUBLE PRECISION NOT NULL DEFAULT 1,
 ADD COLUMN "notes" TEXT NOT NULL DEFAULT '',
 ADD COLUMN "sourceLabel" TEXT NOT NULL DEFAULT '',
 ADD COLUMN "sourceUrl" TEXT NOT NULL DEFAULT '',
 ADD COLUMN "sourceCode" TEXT NOT NULL DEFAULT '',
 ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
DROP INDEX "Product_userId_name_key";
CREATE UNIQUE INDEX "Product_userId_name_brand_key" ON "Product"("userId", "name", "brand");
ALTER TABLE "Product" ADD CONSTRAINT "Product_baseProductId_fkey" FOREIGN KEY ("baseProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Recipe"
 ADD COLUMN "instructions" TEXT[] DEFAULT ARRAY[]::TEXT[],
 ADD COLUMN "prepMinutes" INTEGER,
 ADD COLUMN "cookMinutes" INTEGER,
 ADD COLUMN "cookingMode" TEXT NOT NULL DEFAULT 'fresh',
 ADD COLUMN "storageDays" INTEGER,
 ADD COLUMN "storageInstructions" TEXT NOT NULL DEFAULT '',
 ADD COLUMN "batchNotes" TEXT NOT NULL DEFAULT '',
 ADD COLUMN "freezerFriendly" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "cookedWeight" DOUBLE PRECISION;
