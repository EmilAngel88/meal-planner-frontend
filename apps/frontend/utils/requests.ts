export class SessionChangedError extends Error {
  constructor() { super('Сессия изменилась. Откройте страницу заново.'); this.name = 'SessionChangedError' }
}

// Check before starting queued work and again on both success and failure. An old
// request must neither write into a new account nor log that account out on 401.
export async function inSession<T>(expected: string, current: () => string, operation: () => Promise<T>): Promise<T> {
  if (expected !== current()) throw new SessionChangedError()
  try {
    const result = await operation()
    if (expected !== current()) throw new SessionChangedError()
    return result
  } catch (error) {
    if (expected !== current()) throw new SessionChangedError()
    throw error
  }
}

export async function allPages<T>(read: (limit: number, offset: number) => Promise<T[]>, limit = 200): Promise<T[]> {
  const result: T[] = []
  for (let offset = 0; ; offset += limit) {
    const page = await read(limit, offset)
    result.push(...page)
    if (page.length < limit) return result
  }
}
