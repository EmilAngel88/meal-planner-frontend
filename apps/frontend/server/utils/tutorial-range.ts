export function tutorialByteRange(header: string | undefined, size: number): { start: number; end: number } | null {
  if (!header) return { start: 0, end: size - 1 }
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match || (!match[1] && !match[2])) return null
  const first = match[1] ? Number(match[1]) : undefined
  const last = match[2] ? Number(match[2]) : undefined
  if ((first !== undefined && !Number.isSafeInteger(first)) || (last !== undefined && !Number.isSafeInteger(last))) return null
  if (first === undefined) return last && last > 0 ? { start: Math.max(0, size - last), end: size - 1 } : null
  const end = Math.min(last ?? size - 1, size - 1)
  return first < size && first <= end ? { start: first, end } : null
}
