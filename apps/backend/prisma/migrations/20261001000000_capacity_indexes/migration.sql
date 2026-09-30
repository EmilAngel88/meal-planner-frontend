-- Additive indexes for per-account lists and foreign-key lookups. No user data is rewritten.
CREATE INDEX "UserActivity_userId_date_idx" ON "UserActivity"("userId", "date");
CREATE INDEX "UserActivity_activityId_idx" ON "UserActivity"("activityId");
CREATE INDEX "WeightLog_userId_date_id_idx" ON "WeightLog"("userId", "date", "id");
CREATE INDEX "Recipe_userId_title_id_idx" ON "Recipe"("userId", "title", "id");
CREATE INDEX "Recipe_isBase_isEnabled_idx" ON "Recipe"("isBase", "isEnabled");
CREATE INDEX "Product_isBase_idx" ON "Product"("isBase");
CREATE INDEX "Product_baseProductId_idx" ON "Product"("baseProductId");
CREATE INDEX "Ingredient_recipeId_idx" ON "Ingredient"("recipeId");
CREATE INDEX "Ingredient_productId_idx" ON "Ingredient"("productId");
CREATE INDEX "RecipePreference_recipeId_idx" ON "RecipePreference"("recipeId");
CREATE INDEX "RecipeCollection_userId_updatedAt_id_idx" ON "RecipeCollection"("userId", "updatedAt", "id");
CREATE INDEX "RecipeCollectionItem_recipeId_idx" ON "RecipeCollectionItem"("recipeId");
CREATE INDEX "MealPlanItem_mealPlanId_dayIndex_mealIndex_idx" ON "MealPlanItem"("mealPlanId", "dayIndex", "mealIndex");
CREATE INDEX "MealPlanItem_recipeId_idx" ON "MealPlanItem"("recipeId");
CREATE INDEX "MealPlanItem_productId_idx" ON "MealPlanItem"("productId");

-- Match application search even on PostgreSQL databases initialized with a C locale.
-- Nonunique: historical spelling duplicates must not block an additive deployment.
CREATE FUNCTION mp_search_key(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$
    SELECT replace(lower(translate(normalize(value, NFKC),
        'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ',
        'абвгдеежзийклмнопрстуфхцчшщъыьэюя')), 'ё', 'е')
$$;
CREATE INDEX "Product_userId_search_name_brand_idx" ON "Product"("userId", mp_search_key("name"), mp_search_key("brand"));
