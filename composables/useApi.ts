import { z } from 'zod'
import { useAuthStore } from '~/stores/auth'

export const ProductZ = z.object({
  id: z.number(),
  name: z.string(),
  mealTypes: z.array(z.string()).optional(),
  calories: z.number(),
  protein: z.number(),
  fat: z.number(),
  carbs: z.number(),
  userId: z.number().nullable().optional(),
  isBase: z.boolean().optional(),
  visibility: z.string().optional(),
  unitType: z.string().optional(),
  unitWeight: z.number().nullable().optional(),
  category: z.string().optional()
})
export const IngredientZ = z.object({ id: z.number().optional(), recipeId: z.number().optional(), productId: z.number(), weight: z.number(), quantity: z.number().nullable().optional(), unitType: z.string().nullable().optional(), product: ProductZ.optional() })
export const RecipeZ = z.object({ id: z.number(), userId: z.number().nullable().optional(), title: z.string(), description: z.string().optional(), mealTypes: z.array(z.string()).optional(), isBase: z.boolean().optional(), visibility: z.string().optional(), baseRecipeId: z.number().nullable().optional(), isEnabled: z.boolean().optional(), ingredients: z.array(IngredientZ).optional() })

export const ProfileZ = z.object({ id: z.number().optional(), userId: z.number().optional(),
  age: z.number(), gender: z.enum(['male','female']),
  height: z.number(), weight: z.number(),
  activity: z.enum(['low','light','medium','high','extreme']), goal: z.enum(['loss','maintain','gain']),
  calories: z.number() })
export const WeightLogZ = z.object({ id: z.number(), userId: z.number(), date: z.string(), weight: z.number() })

export type Product = z.infer<typeof ProductZ>
export type Ingredient = z.infer<typeof IngredientZ>
export type Recipe = z.infer<typeof RecipeZ>
export type Profile = z.infer<typeof ProfileZ>
export type WeightLog = z.infer<typeof WeightLogZ>
export type ProductPayload = Omit<Product, 'id'>
export type RecipePreference = {
  id?: number
  userId?: number
  recipeId: number
  enabled: boolean
  includeInGeneration: boolean
  maxPerWeek?: number | null
}
export type RecipeCollection = {
  id: number
  userId: number
  name: string
  items: Array<{ id: number, collectionId: number, recipeId: number, recipe?: Recipe }>
}
export type MenuSettings = {
  baseRecipes: Recipe[]
  customRecipes: Recipe[]
  preferences: RecipePreference[]
  collections: RecipeCollection[]
}
export type MealPlanItem = {
  id: number
  mealPlanId: number
  dayIndex: number
  mealType: string
  title: string
  sourceType: 'recipe' | 'product'
  recipeId?: number | null
  productId?: number | null
  scale: number
  weight: number
  calories: number
  protein: number
  fat: number
  carbs: number
}
export type MealPlan = {
  id: number
  startDate?: string | null
  daysCount: number
  targetCalories: number
  targetProtein: number
  targetFat: number
  targetCarbs: number
  totalCalories: number
  totalProtein: number
  totalFat: number
  totalCarbs: number
  createdAt: string
  items: MealPlanItem[]
}

export const useApi = () => {
  const config = useRuntimeConfig()
  const base = config.public.apiBase
  const auth = useAuthStore()
  const getHeaders = (): Record<string, string> => {
    if (!auth.token) return {}
    return { Authorization: `Bearer ${auth.token}` }
  }

  const $get = async <T>(url: string, params?: any) => $fetch<T>(url, { baseURL: base, params, headers: getHeaders() })
  const $post = async <T>(url: string, body?: any) => $fetch<T>(url, { baseURL: base, method: 'POST', body, headers: getHeaders() })
  const $put = async <T>(url: string, body?: any) => $fetch<T>(url, { baseURL: base, method: 'PUT', body, headers: getHeaders() })
  const $del = async <T>(url: string) => $fetch<T>(url, { baseURL: base, method: 'DELETE', headers: getHeaders() })

  // Auth
  const login = (email: string, password: string) => $post<{ token: string, user: { id: number, email: string } }>('/auth/login', { email, password })
  const register = (email: string, password: string) => $post<{ token: string, user: { id: number, email: string } }>('/auth/register', { email, password })
  const me = () => $get<{ id:number, email:string }>('/auth/me')

  // Profile / Calories
  const getProfile = () => $get<Profile | null>('/calories/profile')
  const calculateProfile = (payload:any) => $post<{ calories: number, profile: Profile }>('/calories/calculate', payload)
  const manualProfile = (payload:any) => $post<{ calories: number, profile: Profile }>('/calories/manual', payload)
  const presetProfile = (payload:any) => $post<{ calories: number, profile: Profile }>('/calories/preset', payload)

  // Weight logs
  const getWeightLogs = () => $get<WeightLog[]>('/calories/logs')
  const addWeightLog = (payload: { date: string, weight: number }) => $post<WeightLog>('/calories/weight-log', payload)
  const deleteWeightLog = (id: number) => $del(`/calories/logs/${id}`)

  // Recipes / Products (from earlier structure)
  const getRecipes = () => $get<Recipe[]>('/recipes').then(arr => arr.map(r => RecipeZ.parse(r)))
  const getRecipe = (id: number) => $get<Recipe>(`/recipes/${id}`).then(r => RecipeZ.parse(r))
  const createRecipe = (payload: Partial<Recipe>) => $post<Recipe>('/recipes', payload)
  const updateRecipe = (id: number, payload: Partial<Recipe>) => $put<Recipe>(`/recipes/${id}`, payload)
  const deleteRecipe = (id: number) => $del(`/recipes/${id}`)
  const copyRecipe = (id: number) => $post<Recipe>(`/recipes/${id}/copy`)
  const getProducts = (q?: string) => $get<Product[]>('/products', q ? { q } : undefined)
  const createProduct = (payload: ProductPayload) => $post<Product>('/products', payload)
  const updateProduct = (id: number, payload: ProductPayload) => $put<Product>(`/products/${id}`, payload)
  const deleteProduct = (id: number) => $del(`/products/${id}`)
  const getMenuSettings = () => $get<MenuSettings>('/menu/settings')
  const saveMenuPreferences = (preferences: RecipePreference[]) => $put<RecipePreference[]>('/menu/preferences', { preferences })
  const createRecipeCollection = (payload: { name: string, recipeIds: number[] }) => $post<RecipeCollection>('/menu/collections', payload)
  const updateRecipeCollection = (id: number, payload: { name?: string, recipeIds?: number[] }) => $put<RecipeCollection>(`/menu/collections/${id}`, payload)
  const deleteRecipeCollection = (id: number) => $del(`/menu/collections/${id}`)
  const generateMenu = (payload?: any) => $post<MealPlan>('/menu/generate', payload || {})
  const getMealPlans = () => $get<MealPlan[]>('/menu')

  return { login, register, me, getProfile, calculateProfile, manualProfile, presetProfile, getWeightLogs, addWeightLog, deleteWeightLog, getRecipes, getRecipe, createRecipe, updateRecipe, deleteRecipe, copyRecipe, getProducts, createProduct, updateProduct, deleteProduct, getMenuSettings, saveMenuPreferences, createRecipeCollection, updateRecipeCollection, deleteRecipeCollection, generateMenu, getMealPlans }
}
