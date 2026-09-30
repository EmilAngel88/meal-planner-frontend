// Private browsing and storage quotas must not prevent using the app.
export function readStorage(key: string) { try { return localStorage.getItem(key) } catch { return null } }
export function writeStorage(key: string, value: string | null) { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value) } catch { /* session remains usable in memory */ } }
export function localDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
export function errorMessage(error: unknown, fallback = 'Не удалось выполнить действие. Повторите попытку.') {
  const e = error as { data?: { message?: string; error?: string }; message?: string }
  return e?.data?.message || e?.data?.error || (error instanceof Error && !e.message?.includes('fetch') ? error.message : fallback)
}
