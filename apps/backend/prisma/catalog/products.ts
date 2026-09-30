export type BaseProduct = {
 name: string; mealTypes: string[]; calories: number; protein: number; fat: number; carbs: number;
 unitType?: string; unitWeight?: number; category?: string; foodGroup: string; preparationState: string;
 nutritionBasis: string; density: number; notes: string; sourceLabel: string; sourceUrl: string; sourceCode: string; isArchived: boolean;
};
// Reviewed catalogue, September 2026. See docs/product-and-recipe-model.md for provenance.
export const products: BaseProduct[] = [
  {
    "name": "Овсяные хлопья",
    "mealTypes": [
      "breakfast"
    ],
    "calories": 366,
    "protein": 11.9,
    "fat": 7.2,
    "carbs": 69.3,
    "foodGroup": "grain",
    "preparationState": "dry",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "",
    "sourceLabel": "Редакционный ориентир; сверяйте с упаковкой",
    "sourceUrl": "",
    "sourceCode": "",
    "isArchived": false
  },
  {
    "name": "Яйцо куриное",
    "mealTypes": [
      "breakfast",
      "snack"
    ],
    "calories": 143.0,
    "protein": 12.56,
    "fat": 9.51,
    "carbs": 0.72,
    "unitType": "piece",
    "unitWeight": 55,
    "foodGroup": "meat",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться. Вес штуки — ориентир для съедобной части, без кожуры, сердцевины или скорлупы.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/171287/nutrients",
    "sourceCode": "SR Legacy 171287: Egg, whole, raw, fresh",
    "isArchived": false
  },
  {
    "name": "Творог 5%",
    "mealTypes": [
      "breakfast",
      "snack"
    ],
    "calories": 121,
    "protein": 17.2,
    "fat": 5,
    "carbs": 1.8,
    "foodGroup": "dairy",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "",
    "sourceLabel": "Редакционный ориентир; сверяйте с упаковкой",
    "sourceUrl": "",
    "sourceCode": "",
    "isArchived": false
  },
  {
    "name": "Йогурт греческий 2%",
    "mealTypes": [
      "breakfast",
      "snack"
    ],
    "calories": 73,
    "protein": 9,
    "fat": 2,
    "carbs": 4,
    "foodGroup": "dairy",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "",
    "sourceLabel": "Редакционный ориентир; сверяйте с упаковкой",
    "sourceUrl": "",
    "sourceCode": "",
    "isArchived": false
  },
  {
    "name": "Банан",
    "mealTypes": [
      "breakfast",
      "snack"
    ],
    "calories": 89.0,
    "protein": 1.09,
    "fat": 0.33,
    "carbs": 22.84,
    "unitType": "piece",
    "unitWeight": 120,
    "foodGroup": "fruit",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться. Вес штуки — ориентир для съедобной части, без кожуры, сердцевины или скорлупы.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/173944/nutrients",
    "sourceCode": "SR Legacy 173944: Bananas, raw",
    "isArchived": false
  },
  {
    "name": "Яблоко",
    "mealTypes": [
      "snack"
    ],
    "calories": 52.0,
    "protein": 0.26,
    "fat": 0.17,
    "carbs": 13.81,
    "unitType": "piece",
    "unitWeight": 150,
    "foodGroup": "fruit",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться. Вес штуки — ориентир для съедобной части, без кожуры, сердцевины или скорлупы.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/171688/nutrients",
    "sourceCode": "SR Legacy 171688: Apples, raw, with skin (Includes foods for USDA's Food Distribution Program)",
    "isArchived": false
  },
  {
    "name": "Хлеб цельнозерновой",
    "mealTypes": [
      "breakfast",
      "lunch",
      "snack"
    ],
    "calories": 252.0,
    "protein": 12.45,
    "fat": 3.5,
    "carbs": 42.71,
    "foodGroup": "grain",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/172688/nutrients",
    "sourceCode": "SR Legacy 172688: Bread, whole-wheat, commercially prepared",
    "isArchived": false
  },
  {
    "name": "Сыр 30%",
    "mealTypes": [
      "breakfast",
      "snack"
    ],
    "calories": 260,
    "protein": 24,
    "fat": 17,
    "carbs": 0,
    "foodGroup": "dairy",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "30% относится к жирности в сухом веществе, а не к граммам жира на 100 г. Для своей марки перенесите все КБЖУ с упаковки.",
    "sourceLabel": "Редакционный ориентир; сверяйте с упаковкой",
    "sourceUrl": "",
    "sourceCode": "",
    "isArchived": false
  },
  {
    "name": "Куриная грудка",
    "mealTypes": [
      "lunch",
      "dinner"
    ],
    "calories": 113,
    "protein": 23.6,
    "fat": 1.9,
    "carbs": 0.4,
    "foodGroup": "meat",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "",
    "sourceLabel": "Редакционный ориентир; сверяйте с упаковкой",
    "sourceUrl": "",
    "sourceCode": "",
    "isArchived": false
  },
  {
    "name": "Индейка филе",
    "mealTypes": [
      "lunch",
      "dinner"
    ],
    "calories": 114.0,
    "protein": 23.66,
    "fat": 1.48,
    "carbs": 0.14,
    "foodGroup": "meat",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/171098/nutrients",
    "sourceCode": "SR Legacy 171098: Turkey, whole, breast, meat only, raw",
    "isArchived": false
  },
  {
    "name": "Говядина постная",
    "mealTypes": [
      "lunch",
      "dinner"
    ],
    "calories": 158,
    "protein": 22.2,
    "fat": 7.1,
    "carbs": 0,
    "foodGroup": "meat",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "",
    "sourceLabel": "Редакционный ориентир; сверяйте с упаковкой",
    "sourceUrl": "",
    "sourceCode": "",
    "isArchived": false
  },
  {
    "name": "Лосось",
    "mealTypes": [
      "lunch",
      "dinner"
    ],
    "calories": 208.0,
    "protein": 20.42,
    "fat": 13.42,
    "carbs": 0.0,
    "foodGroup": "fish",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/175167/nutrients",
    "sourceCode": "SR Legacy 175167: Fish, salmon, Atlantic, farmed, raw",
    "isArchived": false
  },
  {
    "name": "Тунец консервированный в воде",
    "mealTypes": [
      "lunch",
      "dinner",
      "snack"
    ],
    "calories": 86.0,
    "protein": 19.44,
    "fat": 0.96,
    "carbs": 0.0,
    "foodGroup": "fish",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться. Взвешивайте после слива жидкости.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/173709/nutrients",
    "sourceCode": "SR Legacy 173709: Fish, tuna, light, canned in water, drained solids (Includes foods for USDA's Food Distribution Program)",
    "isArchived": false
  },
  {
    "name": "Рис отварной",
    "mealTypes": [
      "lunch",
      "dinner"
    ],
    "calories": 130.0,
    "protein": 2.69,
    "fat": 0.28,
    "carbs": 28.17,
    "foodGroup": "grain",
    "preparationState": "cooked",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/168878/nutrients",
    "sourceCode": "SR Legacy 168878: Rice, white, long-grain, regular, enriched, cooked",
    "isArchived": false
  },
  {
    "name": "Гречка отварная",
    "mealTypes": [
      "lunch",
      "dinner"
    ],
    "calories": 92.0,
    "protein": 3.38,
    "fat": 0.62,
    "carbs": 19.94,
    "foodGroup": "grain",
    "preparationState": "cooked",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/170686/nutrients",
    "sourceCode": "SR Legacy 170686: Buckwheat groats, roasted, cooked",
    "isArchived": false
  },
  {
    "name": "Макароны отварные",
    "mealTypes": [
      "lunch"
    ],
    "calories": 158.0,
    "protein": 5.8,
    "fat": 0.93,
    "carbs": 30.86,
    "foodGroup": "grain",
    "preparationState": "cooked",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/168928/nutrients",
    "sourceCode": "SR Legacy 168928: Pasta, cooked, unenriched, without added salt",
    "isArchived": false
  },
  {
    "name": "Картофель отварной",
    "mealTypes": [
      "lunch",
      "dinner"
    ],
    "calories": 86.0,
    "protein": 1.71,
    "fat": 0.1,
    "carbs": 20.01,
    "foodGroup": "vegetables",
    "preparationState": "cooked",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/170440/nutrients",
    "sourceCode": "SR Legacy 170440: Potatoes, boiled, cooked without skin, flesh, without salt",
    "isArchived": false
  },
  {
    "name": "Фасоль консервированная",
    "mealTypes": [
      "lunch",
      "dinner"
    ],
    "calories": 124.0,
    "protein": 7.98,
    "fat": 1.05,
    "carbs": 21.49,
    "foodGroup": "legumes",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться. Взвешивайте после слива жидкости.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/174285/nutrients",
    "sourceCode": "SR Legacy 174285: Beans, kidney, red, mature seeds, canned, drained solids",
    "isArchived": false
  },
  {
    "name": "Овощной салат",
    "mealTypes": [
      "lunch",
      "dinner"
    ],
    "calories": 28,
    "protein": 1.2,
    "fat": 0.2,
    "carbs": 5.1,
    "foodGroup": "vegetables",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Устаревшая смесь с неопределённым составом. В новых рецептах используйте отдельные овощи. Сохранён для старых рецептов.",
    "sourceLabel": "Редакционный ориентир; сверяйте с упаковкой",
    "sourceUrl": "",
    "sourceCode": "",
    "isArchived": true
  },
  {
    "name": "Огурец",
    "mealTypes": [
      "lunch",
      "dinner",
      "snack"
    ],
    "calories": 15.0,
    "protein": 0.65,
    "fat": 0.11,
    "carbs": 3.63,
    "foodGroup": "vegetables",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/168409/nutrients",
    "sourceCode": "SR Legacy 168409: Cucumber, with peel, raw",
    "isArchived": false
  },
  {
    "name": "Помидор",
    "mealTypes": [
      "lunch",
      "dinner",
      "snack"
    ],
    "calories": 18.0,
    "protein": 0.88,
    "fat": 0.2,
    "carbs": 3.89,
    "foodGroup": "vegetables",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/170457/nutrients",
    "sourceCode": "SR Legacy 170457: Tomatoes, red, ripe, raw, year round average",
    "isArchived": false
  },
  {
    "name": "Брокколи",
    "mealTypes": [
      "lunch",
      "dinner"
    ],
    "calories": 34.0,
    "protein": 2.82,
    "fat": 0.37,
    "carbs": 6.64,
    "foodGroup": "vegetables",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/170379/nutrients",
    "sourceCode": "SR Legacy 170379: Broccoli, raw",
    "isArchived": false
  },
  {
    "name": "Оливковое масло",
    "mealTypes": [
      "lunch",
      "dinner"
    ],
    "calories": 884.0,
    "protein": 0.0,
    "fat": 100.0,
    "carbs": 0.0,
    "category": "sauce",
    "foodGroup": "fats",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/171413/nutrients",
    "sourceCode": "SR Legacy 171413: Oil, olive, salad or cooking",
    "isArchived": false
  },
  {
    "name": "Орехи миндаль",
    "mealTypes": [
      "snack"
    ],
    "calories": 579.0,
    "protein": 21.15,
    "fat": 49.93,
    "carbs": 21.55,
    "foodGroup": "nuts",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/170567/nutrients",
    "sourceCode": "SR Legacy 170567: Nuts, almonds",
    "isArchived": false
  },
  {
    "name": "Сок апельсиновый",
    "mealTypes": [
      "breakfast",
      "snack"
    ],
    "calories": 45.0,
    "protein": 0.7,
    "fat": 0.2,
    "carbs": 10.4,
    "unitType": "ml",
    "foodGroup": "other",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1.03,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться. Для перевода г ↔ мл используется приблизительная плотность 1,03 г/мл.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/169098/nutrients",
    "sourceCode": "SR Legacy 169098: Orange juice, raw (Includes foods for USDA's Food Distribution Program)",
    "isArchived": false
  },
  {
    "name": "Молоко 2.5%",
    "mealTypes": [
      "breakfast",
      "snack"
    ],
    "calories": 52,
    "protein": 2.8,
    "fat": 2.5,
    "carbs": 4.7,
    "unitType": "ml",
    "foodGroup": "dairy",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1.03,
    "notes": " Для перевода г ↔ мл используется приблизительная плотность 1,03 г/мл.",
    "sourceLabel": "Редакционный ориентир; сверяйте с упаковкой",
    "sourceUrl": "",
    "sourceCode": "",
    "isArchived": false
  },
  {
    "name": "Рис сухой",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "grain",
    "preparationState": "dry",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/169756/nutrients",
    "sourceCode": "SR Legacy 169756: Rice, white, long-grain, regular, raw, unenriched",
    "isArchived": false,
    "calories": 365.0,
    "protein": 7.13,
    "fat": 0.66,
    "carbs": 79.95
  },
  {
    "name": "Гречка сухая",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "grain",
    "preparationState": "dry",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/170685/nutrients",
    "sourceCode": "SR Legacy 170685: Buckwheat groats, roasted, dry",
    "isArchived": false,
    "calories": 346.0,
    "protein": 11.73,
    "fat": 2.71,
    "carbs": 74.95
  },
  {
    "name": "Макароны сухие",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "grain",
    "preparationState": "dry",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/168927/nutrients",
    "sourceCode": "SR Legacy 168927: Pasta, dry, unenriched",
    "isArchived": false,
    "calories": 371.0,
    "protein": 13.04,
    "fat": 1.51,
    "carbs": 74.67
  },
  {
    "name": "Булгур сухой",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "grain",
    "preparationState": "dry",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/170688/nutrients",
    "sourceCode": "SR Legacy 170688: Bulgur, dry",
    "isArchived": false,
    "calories": 342.0,
    "protein": 12.29,
    "fat": 1.33,
    "carbs": 75.87
  },
  {
    "name": "Кускус сухой",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "grain",
    "preparationState": "dry",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/169699/nutrients",
    "sourceCode": "SR Legacy 169699: Couscous, dry",
    "isArchived": false,
    "calories": 376.0,
    "protein": 12.76,
    "fat": 0.64,
    "carbs": 77.43
  },
  {
    "name": "Киноа сухая",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "grain",
    "preparationState": "dry",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/168874/nutrients",
    "sourceCode": "SR Legacy 168874: Quinoa, uncooked",
    "isArchived": false,
    "calories": 368.0,
    "protein": 14.12,
    "fat": 6.07,
    "carbs": 64.16
  },
  {
    "name": "Пшено",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "grain",
    "preparationState": "dry",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/169702/nutrients",
    "sourceCode": "SR Legacy 169702: Millet, raw",
    "isArchived": false,
    "calories": 378.0,
    "protein": 11.02,
    "fat": 4.22,
    "carbs": 72.85
  },
  {
    "name": "Перловая крупа",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "grain",
    "preparationState": "dry",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/170284/nutrients",
    "sourceCode": "SR Legacy 170284: Barley, pearled, raw",
    "isArchived": false,
    "calories": 352.0,
    "protein": 9.91,
    "fat": 1.16,
    "carbs": 77.72
  },
  {
    "name": "Мука пшеничная",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "grain",
    "preparationState": "dry",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/168936/nutrients",
    "sourceCode": "SR Legacy 168936: Wheat flour, white, all-purpose, enriched, unbleached",
    "isArchived": false,
    "calories": 364.0,
    "protein": 10.33,
    "fat": 0.98,
    "carbs": 76.31
  },
  {
    "name": "Чечевица сухая",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "legumes",
    "preparationState": "dry",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/172420/nutrients",
    "sourceCode": "SR Legacy 172420: Lentils, raw",
    "isArchived": false,
    "calories": 352.0,
    "protein": 24.63,
    "fat": 1.06,
    "carbs": 63.35
  },
  {
    "name": "Нут сухой",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "legumes",
    "preparationState": "dry",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/173756/nutrients",
    "sourceCode": "SR Legacy 173756: Chickpeas (garbanzo beans, bengal gram), mature seeds, raw",
    "isArchived": false,
    "calories": 378.0,
    "protein": 20.47,
    "fat": 6.04,
    "carbs": 62.95
  },
  {
    "name": "Нут консервированный",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "legumes",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться. Масса после слива жидкости.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/173800/nutrients",
    "sourceCode": "SR Legacy 173800: Chickpeas (garbanzo beans, bengal gram), mature seeds, canned, drained solids",
    "isArchived": false,
    "calories": 139.0,
    "protein": 7.05,
    "fat": 2.77,
    "carbs": 22.53
  },
  {
    "name": "Тофу плотный",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "legumes",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/172475/nutrients",
    "sourceCode": "SR Legacy 172475: Tofu, raw, firm, prepared with calcium sulfate",
    "isArchived": false,
    "calories": 144.0,
    "protein": 17.27,
    "fat": 8.72,
    "carbs": 2.78
  },
  {
    "name": "Картофель сырой",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "vegetables",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/170026/nutrients",
    "sourceCode": "SR Legacy 170026: Potatoes, flesh and skin, raw",
    "isArchived": false,
    "calories": 77.0,
    "protein": 2.05,
    "fat": 0.09,
    "carbs": 17.49
  },
  {
    "name": "Лук репчатый",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "vegetables",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/170000/nutrients",
    "sourceCode": "SR Legacy 170000: Onions, raw",
    "isArchived": false,
    "calories": 40.0,
    "protein": 1.1,
    "fat": 0.1,
    "carbs": 9.34
  },
  {
    "name": "Морковь",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "vegetables",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/170393/nutrients",
    "sourceCode": "SR Legacy 170393: Carrots, raw",
    "isArchived": false,
    "calories": 41.0,
    "protein": 0.93,
    "fat": 0.24,
    "carbs": 9.58
  },
  {
    "name": "Капуста белокочанная",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "vegetables",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/169975/nutrients",
    "sourceCode": "SR Legacy 169975: Cabbage, raw",
    "isArchived": false,
    "calories": 25.0,
    "protein": 1.28,
    "fat": 0.1,
    "carbs": 5.8
  },
  {
    "name": "Перец сладкий",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "vegetables",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/170108/nutrients",
    "sourceCode": "SR Legacy 170108: Peppers, sweet, red, raw",
    "isArchived": false,
    "calories": 26.0,
    "protein": 0.99,
    "fat": 0.3,
    "carbs": 6.03
  },
  {
    "name": "Кабачок",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "vegetables",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/169291/nutrients",
    "sourceCode": "SR Legacy 169291: Squash, summer, zucchini, includes skin, raw",
    "isArchived": false,
    "calories": 17.0,
    "protein": 1.21,
    "fat": 0.32,
    "carbs": 3.11
  },
  {
    "name": "Цветная капуста",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "vegetables",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/169986/nutrients",
    "sourceCode": "SR Legacy 169986: Cauliflower, raw",
    "isArchived": false,
    "calories": 25.0,
    "protein": 1.92,
    "fat": 0.28,
    "carbs": 4.97
  },
  {
    "name": "Шпинат",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "vegetables",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/168462/nutrients",
    "sourceCode": "SR Legacy 168462: Spinach, raw",
    "isArchived": false,
    "calories": 23.0,
    "protein": 2.86,
    "fat": 0.39,
    "carbs": 3.63
  },
  {
    "name": "Шампиньоны",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "vegetables",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/169251/nutrients",
    "sourceCode": "SR Legacy 169251: Mushrooms, white, raw",
    "isArchived": false,
    "calories": 22.0,
    "protein": 3.09,
    "fat": 0.34,
    "carbs": 3.26
  },
  {
    "name": "Свёкла",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "vegetables",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/169145/nutrients",
    "sourceCode": "SR Legacy 169145: Beets, raw",
    "isArchived": false,
    "calories": 43.0,
    "protein": 1.61,
    "fat": 0.17,
    "carbs": 9.56
  },
  {
    "name": "Тыква",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "vegetables",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/168448/nutrients",
    "sourceCode": "SR Legacy 168448: Pumpkin, raw",
    "isArchived": false,
    "calories": 26.0,
    "protein": 1.0,
    "fat": 0.1,
    "carbs": 6.5
  },
  {
    "name": "Горошек замороженный",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "vegetables",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/170016/nutrients",
    "sourceCode": "SR Legacy 170016: Peas, green, frozen, unprepared (Includes foods for USDA's Food Distribution Program)",
    "isArchived": false,
    "calories": 77.0,
    "protein": 5.22,
    "fat": 0.4,
    "carbs": 13.62
  },
  {
    "name": "Кукуруза замороженная",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "vegetables",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/168398/nutrients",
    "sourceCode": "SR Legacy 168398: Corn, sweet, yellow, frozen, kernels cut off cob, unprepared (Includes foods for USDA's Food Distribution Program)",
    "isArchived": false,
    "calories": 88.0,
    "protein": 3.02,
    "fat": 0.78,
    "carbs": 20.71
  },
  {
    "name": "Томаты протёртые",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "vegetables",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/170460/nutrients",
    "sourceCode": "SR Legacy 170460: Tomato products, canned, puree, without salt added",
    "isArchived": false,
    "calories": 38.0,
    "protein": 1.65,
    "fat": 0.21,
    "carbs": 8.98
  },
  {
    "name": "Апельсин",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "fruit",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/169097/nutrients",
    "sourceCode": "SR Legacy 169097: Oranges, raw, all commercial varieties",
    "isArchived": false,
    "calories": 47.0,
    "protein": 0.94,
    "fat": 0.12,
    "carbs": 11.75
  },
  {
    "name": "Груша",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "fruit",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/167776/nutrients",
    "sourceCode": "SR Legacy 167776: Pears, raw, bartlett (Includes foods for USDA's Food Distribution Program)",
    "isArchived": false,
    "calories": 63.0,
    "protein": 0.39,
    "fat": 0.16,
    "carbs": 15.01
  },
  {
    "name": "Киви",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "fruit",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/168153/nutrients",
    "sourceCode": "SR Legacy 168153: Kiwifruit, green, raw",
    "isArchived": false,
    "calories": 61.0,
    "protein": 1.14,
    "fat": 0.52,
    "carbs": 14.66
  },
  {
    "name": "Клубника",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "fruit",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/167762/nutrients",
    "sourceCode": "SR Legacy 167762: Strawberries, raw",
    "isArchived": false,
    "calories": 32.0,
    "protein": 0.67,
    "fat": 0.3,
    "carbs": 7.68
  },
  {
    "name": "Голубика",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "fruit",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/171711/nutrients",
    "sourceCode": "SR Legacy 171711: Blueberries, raw",
    "isArchived": false,
    "calories": 57.0,
    "protein": 0.74,
    "fat": 0.33,
    "carbs": 14.49
  },
  {
    "name": "Грецкий орех",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "nuts",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/170187/nutrients",
    "sourceCode": "SR Legacy 170187: Nuts, walnuts, english",
    "isArchived": false,
    "calories": 654.0,
    "protein": 15.23,
    "fat": 65.21,
    "carbs": 13.71
  },
  {
    "name": "Арахисовая паста без соли",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "nuts",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/172470/nutrients",
    "sourceCode": "SR Legacy 172470: Peanut butter, smooth style, without salt",
    "isArchived": false,
    "calories": 598.0,
    "protein": 22.21,
    "fat": 51.36,
    "carbs": 22.31
  },
  {
    "name": "Семена льна",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "nuts",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/169414/nutrients",
    "sourceCode": "SR Legacy 169414: Seeds, flaxseed",
    "isArchived": false,
    "calories": 534.0,
    "protein": 18.29,
    "fat": 42.16,
    "carbs": 28.88
  },
  {
    "name": "Масло подсолнечное",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "fats",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/171025/nutrients",
    "sourceCode": "SR Legacy 171025: Oil, sunflower, linoleic, (approx. 65%)",
    "isArchived": false,
    "calories": 884.0,
    "protein": 0.0,
    "fat": 100.0,
    "carbs": 0.0,
    "category": "sauce"
  },
  {
    "name": "Масло сливочное несолёное",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "fats",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/173430/nutrients",
    "sourceCode": "SR Legacy 173430: Butter, without salt",
    "isArchived": false,
    "calories": 717.0,
    "protein": 0.85,
    "fat": 81.11,
    "carbs": 0.06,
    "category": "sauce"
  },
  {
    "name": "Треска, филе",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "fish",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/171955/nutrients",
    "sourceCode": "SR Legacy 171955: Fish, cod, Atlantic, raw",
    "isArchived": false,
    "calories": 82.0,
    "protein": 17.81,
    "fat": 0.67,
    "carbs": 0.0
  },
  {
    "name": "Минтай, филе",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "fish",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/173725/nutrients",
    "sourceCode": "SR Legacy 173725: Fish, pollock, Alaska, raw",
    "isArchived": false,
    "calories": 76.0,
    "protein": 17.17,
    "fat": 0.82,
    "carbs": 0.0
  },
  {
    "name": "Креветки очищенные",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "fish",
    "preparationState": "raw",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/175179/nutrients",
    "sourceCode": "SR Legacy 175179: Crustaceans, shrimp, raw",
    "isArchived": false,
    "calories": 85.0,
    "protein": 20.1,
    "fat": 0.51,
    "carbs": 0.0
  },
  {
    "name": "Сахар",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "other",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/169655/nutrients",
    "sourceCode": "SR Legacy 169655: Sugars, granulated",
    "isArchived": false,
    "calories": 387.0,
    "protein": 0.0,
    "fat": 0.0,
    "carbs": 99.98,
    "category": "sauce"
  },
  {
    "name": "Вода питьевая",
    "mealTypes": [
      "any"
    ],
    "foodGroup": "other",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Справочные значения для съедобной части. Углеводы в USDA включают клетчатку; данные этикетки могут отличаться.",
    "sourceLabel": "USDA FoodData Central · SR Legacy",
    "sourceUrl": "https://fdc.nal.usda.gov/food-details/173647/nutrients",
    "sourceCode": "SR Legacy 173647: Beverages, water, tap, drinking",
    "isArchived": false,
    "calories": 0.0,
    "protein": 0.0,
    "fat": 0.0,
    "carbs": 0.0,
    "category": "sauce",
    "unitType": "ml"
  },
  {
    "name": "Творог 2%",
    "mealTypes": [
      "any"
    ],
    "calories": 103,
    "protein": 18,
    "fat": 2,
    "carbs": 3.3,
    "foodGroup": "dairy",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Обобщённый вариант для планирования. У разных производителей состав заметно отличается; для точности создайте свой вариант по этикетке.",
    "sourceLabel": "Редакционный ориентир; сверяйте с упаковкой",
    "sourceUrl": "",
    "sourceCode": "",
    "isArchived": false
  },
  {
    "name": "Творог 9%",
    "mealTypes": [
      "any"
    ],
    "calories": 159,
    "protein": 16.7,
    "fat": 9,
    "carbs": 2,
    "foodGroup": "dairy",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Обобщённый вариант для планирования. У разных производителей состав заметно отличается; для точности создайте свой вариант по этикетке.",
    "sourceLabel": "Редакционный ориентир; сверяйте с упаковкой",
    "sourceUrl": "",
    "sourceCode": "",
    "isArchived": false
  },
  {
    "name": "Кефир 1%",
    "mealTypes": [
      "any"
    ],
    "calories": 40,
    "protein": 3,
    "fat": 1,
    "carbs": 4,
    "foodGroup": "dairy",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1.03,
    "notes": "Обобщённый вариант для планирования. У разных производителей состав заметно отличается; для точности создайте свой вариант по этикетке.",
    "sourceLabel": "Редакционный ориентир; сверяйте с упаковкой",
    "sourceUrl": "",
    "sourceCode": "",
    "isArchived": false,
    "unitType": "ml"
  },
  {
    "name": "Кефир 2.5%",
    "mealTypes": [
      "any"
    ],
    "calories": 53,
    "protein": 3,
    "fat": 2.5,
    "carbs": 4,
    "foodGroup": "dairy",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1.03,
    "notes": "Обобщённый вариант для планирования. У разных производителей состав заметно отличается; для точности создайте свой вариант по этикетке.",
    "sourceLabel": "Редакционный ориентир; сверяйте с упаковкой",
    "sourceUrl": "",
    "sourceCode": "",
    "isArchived": false,
    "unitType": "ml"
  },
  {
    "name": "Ряженка 4%",
    "mealTypes": [
      "any"
    ],
    "calories": 67,
    "protein": 3,
    "fat": 4,
    "carbs": 4.2,
    "foodGroup": "dairy",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1.03,
    "notes": "Обобщённый вариант для планирования. У разных производителей состав заметно отличается; для точности создайте свой вариант по этикетке.",
    "sourceLabel": "Редакционный ориентир; сверяйте с упаковкой",
    "sourceUrl": "",
    "sourceCode": "",
    "isArchived": false,
    "unitType": "ml"
  },
  {
    "name": "Молоко 1.5%",
    "mealTypes": [
      "any"
    ],
    "calories": 44,
    "protein": 3,
    "fat": 1.5,
    "carbs": 4.7,
    "foodGroup": "dairy",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1.03,
    "notes": "Обобщённый вариант для планирования. У разных производителей состав заметно отличается; для точности создайте свой вариант по этикетке.",
    "sourceLabel": "Редакционный ориентир; сверяйте с упаковкой",
    "sourceUrl": "",
    "sourceCode": "",
    "isArchived": false,
    "unitType": "ml"
  },
  {
    "name": "Молоко 3.2%",
    "mealTypes": [
      "any"
    ],
    "calories": 60,
    "protein": 3,
    "fat": 3.2,
    "carbs": 4.7,
    "foodGroup": "dairy",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1.03,
    "notes": "Обобщённый вариант для планирования. У разных производителей состав заметно отличается; для точности создайте свой вариант по этикетке.",
    "sourceLabel": "Редакционный ориентир; сверяйте с упаковкой",
    "sourceUrl": "",
    "sourceCode": "",
    "isArchived": false,
    "unitType": "ml"
  },
  {
    "name": "Сметана 15%",
    "mealTypes": [
      "any"
    ],
    "calories": 162,
    "protein": 2.6,
    "fat": 15,
    "carbs": 3.6,
    "foodGroup": "dairy",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Обобщённый вариант для планирования. У разных производителей состав заметно отличается; для точности создайте свой вариант по этикетке.",
    "sourceLabel": "Редакционный ориентир; сверяйте с упаковкой",
    "sourceUrl": "",
    "sourceCode": "",
    "isArchived": false
  },
  {
    "name": "Йогурт натуральный без сахара",
    "mealTypes": [
      "any"
    ],
    "calories": 60,
    "protein": 4,
    "fat": 2.5,
    "carbs": 5.4,
    "foodGroup": "dairy",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Обобщённый вариант для планирования. У разных производителей состав заметно отличается; для точности создайте свой вариант по этикетке.",
    "sourceLabel": "Редакционный ориентир; сверяйте с упаковкой",
    "sourceUrl": "",
    "sourceCode": "",
    "isArchived": false
  },
  {
    "name": "Сыр полутвёрдый",
    "mealTypes": [
      "any"
    ],
    "calories": 350,
    "protein": 25,
    "fat": 27,
    "carbs": 1,
    "foodGroup": "dairy",
    "preparationState": "as_sold",
    "nutritionBasis": "100g",
    "density": 1,
    "notes": "Обобщённый вариант для планирования. У разных производителей состав заметно отличается; для точности создайте свой вариант по этикетке.",
    "sourceLabel": "Редакционный ориентир; сверяйте с упаковкой",
    "sourceUrl": "",
    "sourceCode": "",
    "isArchived": false
  }
];
