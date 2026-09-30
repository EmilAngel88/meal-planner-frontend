type Preference = { recipeId: number; enabled: boolean; includeInGeneration: boolean; maxPerWeek?: number | null }

export function changedPreferences(current: Preference[], saved: Record<number, Preference>): Preference[] {
  return current.filter(preference => {
    const previous = saved[preference.recipeId]
    return !previous || previous.enabled !== preference.enabled || previous.includeInGeneration !== preference.includeInGeneration || (previous.maxPerWeek ?? null) !== (preference.maxPerWeek ?? null)
  }).map(({ recipeId, enabled, includeInGeneration, maxPerWeek }) => ({ recipeId, enabled, includeInGeneration, maxPerWeek }))
}
