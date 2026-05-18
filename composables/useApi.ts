import { z } from 'zod'
import { useAuthStore } from '~/stores/auth'

export const ProductZ = z.object({ id: z.number(), name: z.string(), mealTypes: z.array(z.string()).optional(), calories: z.number(), protein: z.number(), fat: z.number(), carbs: z.number() })
export const IngredientZ = z.object({ id: z.number().optional(), recipeId: z.number().optional(), productId: z.number(), weight: z.number(), product: ProductZ.optional() })
export const RecipeZ = z.object({ id: z.number(), userId: z.number().optional(), title: z.string(), description: z.string().optional(), mealTypes: z.array(z.string()).optional(), ingredients: z.array(IngredientZ).optional() })

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
export type MealPlanItem = {
  id: number
  mealPlanId: number
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
  const getProducts = (q?: string) => $get<Product[]>('/products', q ? { q } : undefined)
  const createProduct = (payload: ProductPayload) => $post<Product>('/products', payload)
  const updateProduct = (id: number, payload: ProductPayload) => $put<Product>(`/products/${id}`, payload)
  const deleteProduct = (id: number) => $del(`/products/${id}`)
  const generateMenu = (payload?: any) => $post<MealPlan>('/menu/generate', payload || {})
  const getMealPlans = () => $get<MealPlan[]>('/menu')
  const seedDemoRecipes = () => $post<{ products: number, recipes: number, createdProducts: number, createdRecipes: number }>('/demo/seed-recipes')

  return { login, register, me, getProfile, calculateProfile, manualProfile, presetProfile, getWeightLogs, addWeightLog, deleteWeightLog, getRecipes, getRecipe, createRecipe, updateRecipe, deleteRecipe, getProducts, createProduct, updateProduct, deleteProduct, generateMenu, getMealPlans, seedDemoRecipes }
}
