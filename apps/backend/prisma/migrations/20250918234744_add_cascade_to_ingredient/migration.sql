-- DropForeignKey
ALTER TABLE "public"."Ingredient" DROP CONSTRAINT "Ingredient_recipeId_fkey";

-- AddForeignKey
ALTER TABLE "public"."Ingredient" ADD CONSTRAINT "Ingredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "public"."Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
