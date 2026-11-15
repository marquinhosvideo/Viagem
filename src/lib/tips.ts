import type { Tip } from '../types'

const MAX_TEMA = 160
const MAX_TEXTO = 2000
const MAX_LINK = 500
const MAX_PHOTO_CHARS = 450_000
const MAX_TIPS = 200

function tipId(): string {
  return `tip-${crypto.randomUUID().slice(0, 8)}`
}

/** Aceita tips antigos (sem id) e campos novos opcionais. */
export function normalizeTip(raw: unknown): Tip | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Partial<Tip> & { titulo?: string; title?: string }
  const tema = String(row.tema ?? row.titulo ?? row.title ?? '')
    .trim()
    .slice(0, MAX_TEMA)
  const texto = String(row.texto ?? '')
    .trim()
    .slice(0, MAX_TEXTO)
  if (!tema || !texto) return null

  const id =
    typeof row.id === 'string' && row.id.trim()
      ? row.id.trim().slice(0, 200)
      : tipId()

  const photoUrl = cleanOptionalUrl(row.photoUrl, MAX_PHOTO_CHARS)
  const link = cleanOptionalUrl(row.link, MAX_LINK)

  return { id, tema, texto, photoUrl, link }
}

export function normalizeTips(tips: unknown): Tip[] {
  if (!Array.isArray(tips)) return []
  const seen = new Set<string>()
  const out: Tip[] = []
  for (const raw of tips) {
    if (out.length >= MAX_TIPS) break
    const tip = normalizeTip(raw)
    if (!tip) continue
    let id = tip.id
    if (seen.has(id)) id = tipId()
    seen.add(id)
    out.push({ ...tip, id })
  }
  return out
}

function cleanOptionalUrl(value: unknown, max: number): string | null {
  if (value == null) return null
  const text = String(value).trim()
  if (!text) return null
  if (text.length > max) return null
  if (
    text.startsWith('https://') ||
    text.startsWith('http://') ||
    text.startsWith('data:image/')
  ) {
    return text
  }
  return null
}

/** Redimensiona a foto no cliente para caber no documento da viagem. */
export async function compressImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Escolha um arquivo de imagem.')
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('A imagem é grande demais (máx. 12 MB).')
  }

  const bitmap = await createImageBitmap(file)
  try {
    const maxEdge = 960
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Não foi possível processar a imagem.')
    ctx.drawImage(bitmap, 0, 0, width, height)

    let quality = 0.72
    let dataUrl = canvas.toDataURL('image/jpeg', quality)
    while (dataUrl.length > MAX_PHOTO_CHARS && quality > 0.4) {
      quality -= 0.08
      dataUrl = canvas.toDataURL('image/jpeg', quality)
    }
    if (dataUrl.length > MAX_PHOTO_CHARS) {
      throw new Error('Não consegui comprimir a foto o bastante. Tente outra.')
    }
    return dataUrl
  } finally {
    bitmap.close()
  }
}
