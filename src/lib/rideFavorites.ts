const STORAGE_KEY = 'roteiro-orlando-ride-favorites-v1'

function readIds(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((value) => Number(value))
      .filter((id) => Number.isFinite(id) && id > 0)
  } catch {
    return []
  }
}

function writeIds(ids: number[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}

export function loadFavoriteRideIds(): Set<number> {
  return new Set(readIds())
}

export function toggleFavoriteRideId(id: number): Set<number> {
  const next = loadFavoriteRideIds()
  if (next.has(id)) next.delete(id)
  else next.add(id)
  writeIds([...next])
  return next
}
