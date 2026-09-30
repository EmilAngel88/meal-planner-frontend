import type { BillingStatus, BillingConfig, BillingOrder, BillingOrderPage, BillingAdminSettings, BillingOverview, BillingGrant } from '~/utils/billing'
import { z } from 'zod'
import { useAuthStore } from '~/stores/auth'
import type { GoalInput, GoalEstimate, GoalSetup } from '~/utils/goal'
import { allPages, inSession } from '~/utils/requests'
import type { FeedbackItem, AdminFeedbackItem, FeedbackCreatePayload, FeedbackPage, FeedbackStatus, FeedbackCategory } from '~/utils/feedback'

export const ProductZ = z.object({
  id: z.number(),
  name: z.string(),
  brand: z.string().optional(), baseProductId: z.number().nullable().optional(), foodGroup: z.string().optional(),
  preparationState: z.string().optional(), nutritionBasis: z.string().optional(), density: z.number().optional(),
  notes: z.string().optional(), sourceLabel: z.string().optional(), sourceUrl: z.string().optional(), sourceCode: z.string().optional(), isArchived: z.boolean().optional(),
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
export const RecipeZ = z.object({
  instructions: z.array(z.string()).optional(), prepMinutes: z.number().nullable().optional(), cookMinutes: z.number().nullable().optional(),
  cookingMode: z.string().optional(), storageDays: z.number().nullable().optional(), storageInstructions: z.string().optional(),
  batchNotes: z.string().optional(), freezerFriendly: z.boolean().optional(), cookedWeight: z.number().nullable().optional(),
  id: z.number(), userId: z.number().nullable().optional(), title: z.string(), description: z.string().optional(), servings: z.number().int().positive().default(1), mealTypes: z.array(z.string()).optional(), isBase: z.boolean().optional(), visibility: z.string().optional(), baseRecipeId: z.number().nullable().optional(), isEnabled: z.boolean().optional(), ingredients: z.array(IngredientZ).optional() })

export const ProfileZ = z.object({ id: z.number().optional(), userId: z.number().optional(),
  age: z.number().nullable(), gender: z.enum(['male','female']).nullable(),
  height: z.number().nullable(), weight: z.number(),
  activity: z.enum(['low','light','training4','training5','training6','daily','medium','high','extreme']).nullable(), goal: z.enum(['loss','maintain','gain']),
  goalRate: z.number().default(0.15), calories: z.number(), goalSetup: z.custom<GoalSetup>().nullable().optional() })
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
export type MealSlot = { type: string; title: string; percent: number; maxItems: number }
export type MenuSettings = {
  defaultMeals: MealSlot[]
  baseRecipes: Recipe[]
  customRecipes: Recipe[]
  preferences: RecipePreference[]
  collections: RecipeCollection[]
  hasMore?: boolean
}
export type MealPlanItem = {
  id: number
  mealPlanId: number
  shoppingSnapshot?: ShoppingRow[] | null
  dayIndex: number
  mealType: string
  mealIndex: number
  mealTitle: string
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
  settings?: { meals?: MealSlot[]; warnings?: string[]; generatorVersion?: number; macroMode?: string; macroRatios?: { protein: number; fat: number; carbs: number }; proteinPerKg?: number; fatPerKg?: number; profileWeight?: number; collectionId?: number | null }
  items: MealPlanItem[]
}
export type ShoppingRow = { productId: number; name: string; weight: number; quantity: number; unitType: string }
export type CookingInfo = { id: number; cookingMode: string; storageDays: number | null; freezerFriendly: boolean; batchNotes: string; storageInstructions: string }
export type ShoppingList = { planId: number; rows: ShoppingRow[]; incomplete: boolean; cooking?: Record<number, CookingInfo> }
export type CaloriesMeta = {
  activityFactors: Record<string, number>
  presets: Record<string, number>
}

export const useApi = () => {
  const config = useRuntimeConfig()
  const base = config.public.apiBase
  const auth = useAuthStore()
  const currentSession = () => `${auth.sessionRevision}:${auth.token}`
  const session = currentSession()
  const requestToken = auth.token

  const request = async <T>(url: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: any, params?: any): Promise<T> => {
    try {
      return await inSession(session, currentSession, () => $fetch<T>(url, {
        baseURL: base, method, body, params,
        headers: requestToken ? { Authorization: `Bearer ${requestToken}` } : {},
        retry: 0, timeout: url === '/menu/generate' ? 60000 : 30000
      }) as Promise<T>)
    }
    catch (error) {
      const status = (error as { status?: number }).status
      if (status === 401 && auth.token === requestToken && !['/auth/login', '/auth/register', '/auth/me'].includes(url)) auth.logout()
      throw error
    }
  }
  const $get = <T>(url: string, params?: any) => request<T>(url, 'GET', undefined, params)
  const $post = <T>(url: string, body?: any) => request<T>(url, 'POST', body)
  const $put = <T>(url: string, body?: any) => request<T>(url, 'PUT', body)
  const $del = <T>(url: string) => request<T>(url, 'DELETE')

  // Auth
  const login = (email: string, password: string) => $post<{ token: string, user: { id: number, email: string, canManageFeedback: boolean, canManageBilling: boolean } }>('/auth/login', { email, password })
  const register = (email: string, password: string) => $post<{ token: string, user: { id: number, email: string, canManageFeedback: boolean, canManageBilling: boolean } }>('/auth/register', { email, password })
  const me = () => $get<{ id:number, email:string, canManageFeedback: boolean, canManageBilling: boolean }>('/auth/me')

  // Profile / Calories
  const getProfile = () => $get<Profile | null>('/calories/profile')
  const previewGoal = (payload: GoalInput) => $post<GoalEstimate>('/calories/goal/preview', payload)
  const saveGoal = (payload: GoalInput) => $post<{ calories: number, profile: Profile }>('/calories/goal', payload)
  const calculateProfile = (payload:any) => $post<{ calories: number, profile: Profile }>('/calories/calculate', payload)
  const manualProfile = (payload:any) => $post<{ calories: number, profile: Profile }>('/calories/manual', payload)
  const presetProfile = (payload:any) => $post<{ calories: number, profile: Profile }>('/calories/preset', payload)
  const getCaloriesMeta = () => $get<CaloriesMeta>('/calories/meta')

  // Weight logs
  const getWeightLogs = () => allPages((limit, offset) => $get<WeightLog[]>('/calories/logs', { limit, offset }))
  const addWeightLog = (payload: { date: string, weight: number }) => $post<WeightLog>('/calories/weight-log', payload)
  const deleteWeightLog = (id: number) => $del(`/calories/logs/${id}`)

  // Recipes / Products (from earlier structure)
  const getRecipes = () => allPages((limit, offset) => $get<Recipe[]>('/recipes', { limit, offset })).then(arr => arr.map(r => RecipeZ.parse(r)))
  const getRecipe = (id: number) => $get<Recipe>(`/recipes/${id}`).then(r => RecipeZ.parse(r))
  const createRecipe = (payload: Partial<Recipe>) => $post<Recipe>('/recipes', payload)
  const updateRecipe = (id: number, payload: Partial<Recipe>) => $put<Recipe>(`/recipes/${id}`, payload)
  const deleteRecipe = (id: number) => $del(`/recipes/${id}`)
  const copyRecipe = (id: number) => $post<Recipe>(`/recipes/${id}/copy`)
  const getProducts = (q?: string) => allPages((limit, offset) => $get<Product[]>('/products', { limit, offset, ...(q ? { q } : {}) }))
  const createProduct = (payload: ProductPayload) => $post<Product>('/products', payload)
  const updateProduct = (id: number, payload: ProductPayload) => $put<Product>(`/products/${id}`, payload)
  const deleteProduct = (id: number) => $del(`/products/${id}`)
  const getMenuSettings = async () => {
    const combined: MenuSettings = { defaultMeals: [], baseRecipes: [], customRecipes: [], preferences: [], collections: [] }
    for (let offset = 0; ; offset += 200) {
      const page = await $get<MenuSettings>('/menu/settings', { limit: 200, offset })
      if (!offset) combined.defaultMeals = page.defaultMeals
      combined.baseRecipes.push(...page.baseRecipes)
      combined.customRecipes.push(...page.customRecipes)
      combined.preferences.push(...page.preferences)
      combined.collections.push(...page.collections)
      if (!page.hasMore) return combined
    }
  }
  const saveMenuPreferences = (preferences: RecipePreference[]) => $put<RecipePreference[]>('/menu/preferences', { preferences })
  const createRecipeCollection = (payload: { name: string, recipeIds: number[] }) => $post<RecipeCollection>('/menu/collections', payload)
  const updateRecipeCollection = (id: number, payload: { name?: string, recipeIds?: number[] }) => $put<RecipeCollection>(`/menu/collections/${id}`, payload)
  const deleteRecipeCollection = (id: number) => $del(`/menu/collections/${id}`)
  const generateMenu = (payload?: any) => $post<MealPlan>('/menu/generate', payload || {})
  const getMealPlans = (offset = 0) => $get<MealPlan[]>('/menu', { limit: 20, offset })
  const getMealPlan = (id: number) => $get<MealPlan>(`/menu/${id}`)
  const deleteMealPlan = (id: number) => $del(`/menu/${id}`)
  const getShoppingList = (id: number) => $get<ShoppingList>(`/menu/${id}/shopping-list`)

  const createFeedback = (payload: FeedbackCreatePayload) => $post<FeedbackItem>('/feedback', payload)
  const getFeedback = (params: { cursor?: number; limit?: number } = {}) => $get<FeedbackPage>('/feedback', params)
  const getAdminFeedback = (params: { cursor?: number; limit?: number; status?: FeedbackStatus; category?: FeedbackCategory } = {}) => $get<FeedbackPage<AdminFeedbackItem>>('/feedback/admin', params)
  const getAdminFeedbackItem = (id: number) => $get<AdminFeedbackItem>(`/feedback/admin/${id}`)
  const updateFeedback = (id: number, payload: { status: FeedbackStatus; reply: string; version: number }) => request<AdminFeedbackItem>(`/feedback/admin/${id}`, 'PATCH', payload)

  const getBilling = () => $get<BillingStatus>('/billing')
  const startBillingTrial = () => $post('/billing/trial')
  const getBillingOrders = (offset = 0) => $get<BillingOrderPage>('/billing/orders', { offset })
  const createBillingOrder = (body: { requestId: string; offerId: string; version: number }) => $post<BillingOrder>('/billing/orders', body)
  const checkBillingOrder = (id: string) => $post<BillingOrder>(`/billing/orders/${id}/check`)
  const getBillingSettings = () => $get<BillingAdminSettings>('/billing/admin/settings')
  const saveBillingSettings = (body: { version: number; config: BillingConfig }) => $put<{ version: number; config: BillingConfig }>('/billing/admin/settings', body)
  const getBillingOverview = () => $get<BillingOverview>('/billing/admin/overview')
  const getAdminBillingOrders = (offset = 0, email = '') => $get<BillingOrderPage>('/billing/admin/orders', { offset, email: email || undefined })
  const checkAdminBillingOrder = (id: string) => $post<BillingOrder>(`/billing/admin/orders/${id}/check`)
  const linkBillingPayment = (id: string, paymentId: string) => $post<BillingOrder>(`/billing/admin/orders/${id}/link`, { paymentId })
  const grantBillingAccess = (body: { requestId: string; email: string; days: number; reason: string }) => $post<BillingGrant>('/billing/admin/grants', body)
  const revokeBillingGift = (id: string, reason: string) => $post(`/billing/admin/grants/${id}/revoke`, { reason })

  return { getBilling, startBillingTrial, getBillingOrders, createBillingOrder, checkBillingOrder, getBillingSettings, saveBillingSettings, getBillingOverview, getAdminBillingOrders, checkAdminBillingOrder, linkBillingPayment, grantBillingAccess, revokeBillingGift, login, register, me, getProfile, previewGoal, saveGoal, calculateProfile, manualProfile, presetProfile, getCaloriesMeta, getWeightLogs, addWeightLog, deleteWeightLog, getRecipes, getRecipe, createRecipe, updateRecipe, deleteRecipe, copyRecipe, getProducts, createProduct, updateProduct, deleteProduct, getMenuSettings, saveMenuPreferences, createRecipeCollection, updateRecipeCollection, deleteRecipeCollection, generateMenu, getMealPlans, getMealPlan, deleteMealPlan, getShoppingList, createFeedback, getFeedback, getAdminFeedback, getAdminFeedbackItem, updateFeedback }
}
