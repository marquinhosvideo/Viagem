import type { WorkSheet } from 'xlsx'
import { BUDGET_LABELS, type Activity, type BudgetId, type Day, type Expense, type SavedPlace, type Tip, type Trip } from '../types'
import { brlToUsd, usdToBrl } from './currency'
import { formatShortDate, formatWeekdayShort, parseAmount, uid } from './format'
import { normalizeBudgetId } from './budgets'
import { periodFromActivityId } from './display'
import { collectTripLocations, inferPlaceCategory, normalizePlace } from './locations'
import { parseDayMeta } from './dayMeta'

type XLSXModule = typeof import('xlsx')
const MAX_IMPORT_BYTES = 10 * 1024 * 1024
const MAX_SHEET_ROWS = 5000

async function loadXlsx(): Promise<XLSXModule> {
  return import('xlsx')
}

function mapBudget(value: unknown): BudgetId {
  return normalizeBudgetId(value) ?? 'outros'
}

type Row = Record<string, unknown>

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function clean(value: unknown): string {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\0/g, '')
    .slice(0, 10_000)
    .trim()
}

function isEmptyPeriod(value: unknown): boolean {
  const t = clean(value)
  return !t || t === '—' || t === '-'
}

function excelDateToIso(value: unknown, XLSX: XLSXModule, defaultYear = 2026): string | null {
  if (value == null || value === '') return null
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return null
    const mm = String(parsed.m).padStart(2, '0')
    const dd = String(parsed.d).padStart(2, '0')
    return `${parsed.y}-${mm}-${dd}`
  }
  const text = String(value).trim()
  const br = text.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/)
  if (br) {
    const day = br[1].padStart(2, '0')
    const month = br[2].padStart(2, '0')
    const year = br[3]
      ? br[3].length === 2
        ? `20${br[3]}`
        : br[3]
      : String(defaultYear)
    return `${year}-${month}-${day}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  return null
}

function formatTime(value: unknown): string | undefined {
  if (value == null || value === '') return undefined
  if (typeof value === 'number') {
    const totalMinutes = Math.round(value * 24 * 60)
    const h = Math.floor(totalMinutes / 60) % 24
    const m = totalMinutes % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  const text = String(value).trim()
  const match = text.match(/^(\d{1,2}):(\d{2})/)
  if (match) return `${match[1].padStart(2, '0')}:${match[2]}`
  return text
}

function sheetToRows(XLSX: XLSXModule, sheet: WorkSheet): Row[] {
  return XLSX.utils.sheet_to_json<Row>(sheet, { defval: '' })
}

function pick(row: Row, keys: string[]): unknown {
  const entries = Object.entries(row)
  for (const key of keys) {
    const found = entries.find(([k]) => normalizeHeader(k) === key)
    if (found && found[1] !== '') return found[1]
  }
  return ''
}

function hasOrlandoColumns(rows: Row[]): boolean {
  if (!rows.length) return false
  const headers = Object.keys(rows[0]).map(normalizeHeader)
  return headers.includes('manha') && headers.includes('tarde') && headers.includes('noite')
}

function periodTitle(period: string, text: string): string {
  const line = text.split('\n')[0]
  const body = line.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s⭐]*\s*/u, '')
  const short = body.length > 100 ? `${body.slice(0, 97)}…` : body
  return `${period} — ${short}`
}

function buildOrlandoDays(rows: Row[], XLSX: XLSXModule): Day[] {
  const days: Day[] = []

  for (const row of rows) {
    const date = excelDateToIso(pick(row, ['data', 'date']), XLSX, 2026)
    if (!date) continue

    const label =
      clean(pick(row, ['tipo do dia', 'tipo'])) ||
      clean(pick(row, ['dia', 'label'])) ||
      `Dia ${days.length + 1}`

    const location = clean(
      pick(row, ['lugares e enderecos', 'lugares e endereços', 'local', 'endereco']),
    )
    const drive = clean(
      Object.entries(row).find(([k]) => normalizeHeader(k).includes('carro'))?.[1],
    )
    const kid = clean(
      Object.entries(row).find(([k]) => normalizeHeader(k).includes('crianca'))?.[1],
    )
    const obs = clean(
      pick(row, ['observacoes / horarios', 'observacoes', 'obs', 'notas']),
    )

    const dayNotes = [
      location && location !== '—' ? `📍 ${location}` : '',
      drive && drive !== '—' ? `🚗 ${drive}` : '',
      kid && kid !== '—' ? `👶 ${kid}` : '',
      obs && obs !== '—' ? `📝 ${obs}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')

    const periods: { key: string; time: string; keys: string[] }[] = [
      { key: 'Manhã', time: '09:00', keys: ['manha', 'manhã'] },
      { key: 'Tarde', time: '14:00', keys: ['tarde'] },
      { key: 'Noite', time: '19:00', keys: ['noite'] },
    ]

    const activities: Activity[] = []
    for (const period of periods) {
      const raw = pick(row, period.keys)
      if (isEmptyPeriod(raw)) continue
      const text = clean(raw)
      const periodSlug =
        period.key === 'Manhã' ? 'manha' : period.key === 'Tarde' ? 'tarde' : 'noite'
      activities.push({
        id: `act-${date}-${periodSlug}`,
        time: period.time,
        title: periodTitle(period.key, text),
        location:
          location && location !== '—'
            ? location.split('|')[0].trim()
            : undefined,
        notes: text,
        done: false,
      })
    }

    if (!activities.length) continue

    days.push({
      id: `day-${date}`,
      date,
      label,
      dayNotes: dayNotes || undefined,
      activities,
    })
  }

  return days.sort((a, b) => a.date.localeCompare(b.date))
}

function buildDaysFromRows(rows: Row[], XLSX: XLSXModule): Day[] {
  if (hasOrlandoColumns(rows)) return buildOrlandoDays(rows, XLSX)

  const byDate = new Map<string, Day>()

  for (const row of rows) {
    const date = excelDateToIso(pick(row, ['data', 'date']), XLSX)
    const title = clean(
      pick(row, [
        'atividade',
        'atividade/programacao',
        'programacao',
        'titulo',
        'title',
        'item',
      ]),
    )
    if (!date || !title) continue

    if (!byDate.has(date)) {
      const label =
        clean(pick(row, ['dia', 'label', 'titulo do dia', 'nome do dia', 'tipo do dia'])) ||
        `Dia ${byDate.size + 1}`
      byDate.set(date, {
        id: uid('day'),
        date,
        label,
        activities: [],
      })
    }

    const day = byDate.get(date)!
    const diaCol = clean(pick(row, ['dia']))
    if (diaCol && !excelDateToIso(diaCol, XLSX)) day.label = diaCol
    const maybeLabel = clean(pick(row, ['label', 'titulo do dia', 'nome do dia', 'tipo do dia']))
    if (maybeLabel) day.label = maybeLabel

    day.activities.push({
      id: uid('act'),
      time: formatTime(pick(row, ['horario', 'hora', 'time'])),
      title,
      location: clean(pick(row, ['local', 'lugar', 'location', 'endereco'])) || undefined,
      notes: clean(pick(row, ['observacoes', 'obs', 'notas', 'notes', 'detalhes'])) || undefined,
      done: false,
    })
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

function buildExpensesFromRows(
  rows: Row[],
  days: Day[],
  XLSX: XLSXModule,
): Expense[] {
  const dayByDate = new Map(days.map((d) => [d.date, d.id]))

  return rows
    .map((row) => {
      const date = excelDateToIso(pick(row, ['data', 'date']), XLSX)
      const description = clean(
        pick(row, ['descricao', 'descrição', 'description', 'item', 'gasto']),
      ).slice(0, 500)
      // Planilha de gastos: valores em USD → grava em BRL
      const amountUsd = parseAmount(
        pick(row, ['valor', 'amount', 'preco', 'preço', 'custo']),
      )
      if (!date || !description || amountUsd <= 0) return null

      let dayId = dayByDate.get(date)
      if (!dayId) {
        const newDay: Day = {
          id: uid('day'),
          date,
          label: `Dia ${days.length + 1}`,
          activities: [],
        }
        days.push(newDay)
        dayByDate.set(date, newDay.id)
        dayId = newDay.id
      }

      return {
        id: uid('exp'),
        dayId,
        budgetId: mapBudget(
          pick(row, [
            'orcamento',
            'orçamento',
            'budget',
            'pessoa',
            'categoria',
            'category',
            'tipo',
          ]),
        ),
        description,
        amount: usdToBrl(amountUsd),
        createdAt: new Date().toISOString(),
      } satisfies Expense
    })
    .filter((e): e is Expense => e != null)
}

function buildTips(rows: Row[]): Tip[] {
  return rows
    .map((row) => ({
      tema: clean(pick(row, ['tema', 'titulo', 'title'])),
      texto: clean(pick(row, ['dica / ressalva', 'dica', 'ressalva', 'texto', 'nota'])),
    }))
    .filter((t) => t.tema && t.texto)
}

function buildLocations(rows: Row[], categoryKeys: string[]): SavedPlace[] {
  const locations: SavedPlace[] = []
  const hasExplicitCategory = categoryKeys.includes('categoria')
  for (const row of rows) {
    const name = clean(pick(row, ['nome / local', 'nome', 'lugar', 'local']))
    const rawAddress = clean(pick(row, ['endereco', 'endereço']))
    if (!rawAddress) continue

    const categoryHint = clean(pick(row, categoryKeys))
    const parsed = parseDayMeta(`📍 ${name ? `${name} – ${rawAddress}` : rawAddress}`).places
    for (const place of parsed) {
      const normalized = normalizePlace({
        name: place.name,
        address: place.addr,
        category:
          (hasExplicitCategory ? categoryHint : '') ||
          inferPlaceCategory(place.name, categoryHint),
      })
      if (normalized) locations.push(normalized)
    }
  }
  return locations
}

export type ImportResult = {
  trip: Trip
  stats: {
    days: number
    activities: number
    expenses: number
    tips: number
    locations: number
  }
}

export async function importTripFromFile(
  file: File,
  current: Trip,
): Promise<ImportResult> {
  if (!/\.xlsx?$/i.test(file.name)) {
    throw new Error('Use um arquivo Excel .xlsx ou .xls.')
  }
  if (file.size <= 0 || file.size > MAX_IMPORT_BYTES) {
    throw new Error('O arquivo deve ter até 10 MB.')
  }

  const XLSX = await loadXlsx()
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: false,
    sheetRows: MAX_SHEET_ROWS,
  })

  const sheetNames = workbook.SheetNames.slice(0, 30)
  const roteiroName =
    sheetNames.find((n) =>
      /roteiro|itinerario|programacao|agenda|plano|completo/i.test(n),
    ) ?? sheetNames[0]
  const gastosName = sheetNames.find((n) =>
    /gasto|despesa|expense|custo|financeiro/i.test(n),
  )
  const tipsName = sheetNames.find((n) => /dica|ressalva/i.test(n))
  const metaName = sheetNames.find((n) => /viagem|trip|info|geral/i.test(n))
  const childPlacesName = sheetNames.find((n) => /lugares.*crian/i.test(n))
  const shoppingName = sheetNames.find((n) => /compras.*extra/i.test(n))
  const locaisName = sheetNames.find((n) => /^locais$/i.test(n) || /^locations$/i.test(n))

  const roteiroSheet = roteiroName ? workbook.Sheets[roteiroName] : undefined
  const gastosSheet = gastosName ? workbook.Sheets[gastosName] : undefined
  const tipsSheet = tipsName ? workbook.Sheets[tipsName] : undefined
  const metaSheet = metaName ? workbook.Sheets[metaName] : undefined
  const childPlacesSheet = childPlacesName
    ? workbook.Sheets[childPlacesName]
    : undefined
  const shoppingSheet = shoppingName ? workbook.Sheets[shoppingName] : undefined
  const locaisSheet = locaisName ? workbook.Sheets[locaisName] : undefined

  const roteiroRows = roteiroSheet ? sheetToRows(XLSX, roteiroSheet) : []
  const days = buildDaysFromRows(roteiroRows, XLSX)

  if (!days.length) {
    throw new Error(
      'Não encontrei o roteiro. Na planilha Orlando use a aba “Roteiro completo” (Data, Manhã, Tarde, Noite).',
    )
  }

  const expenseRows = gastosSheet
    ? sheetToRows(XLSX, gastosSheet)
    : roteiroRows.filter((row) => {
        const valor = pick(row, ['valor', 'amount', 'preco', 'preço', 'custo'])
        const desc = pick(row, ['descricao', 'descrição', 'gasto'])
        return valor !== '' && desc !== ''
      })

  const expenses = buildExpensesFromRows(expenseRows, days, XLSX)
  const tips = tipsSheet ? buildTips(sheetToRows(XLSX, tipsSheet)) : current.tips
  const importedLocations = [
    ...(shoppingSheet
      ? buildLocations(sheetToRows(XLSX, shoppingSheet), ['categoria'])
      : []),
    ...(locaisSheet
      ? buildLocations(sheetToRows(XLSX, locaisSheet), ['categoria'])
      : []),
    ...(childPlacesSheet
      ? buildLocations(sheetToRows(XLSX, childPlacesSheet), ['o que e', 'o que é'])
      : []),
  ]

  const metaRows = metaSheet ? sheetToRows(XLSX, metaSheet) : []
  const meta = metaRows[0] ?? {}
  const looksOrlando = hasOrlandoColumns(roteiroRows)

  const trip: Trip = {
    name: looksOrlando
      ? 'Orlando 2026'
      : clean(pick(meta, ['nome', 'name', 'viagem'])) || current.name,
    destination: looksOrlando
      ? 'Orlando, Flórida · família'
      : clean(pick(meta, ['destino', 'destination', 'cidade'])) ||
        current.destination,
    startDate: days[0].date,
    endDate: days[days.length - 1].date,
    currency: 'BRL',
    days,
    expenses,
    tips,
    locations: collectTripLocations({
      ...current,
      days,
      expenses,
      tips,
      locations: [...(current.locations ?? []), ...importedLocations],
    }),
    budgetLimits: current.budgetLimits ?? {
      marcos: 5000,
      dielen: 5000,
      helena: 5000,
      alimentacao: 5000,
      outros: 5000,
    },
  }

  return {
    trip,
    stats: {
      days: days.length,
      activities: days.reduce((sum, d) => sum + d.activities.length, 0),
      expenses: expenses.length,
      tips: tips?.length ?? 0,
      locations: trip.locations?.length ?? 0,
    },
  }
}

function periodNotes(day: Day, key: 'manha' | 'tarde' | 'noite'): string {
  return day.activities
    .filter((activity) => periodFromActivityId(activity.id).key === key)
    .map((activity) => activity.notes?.trim() || activity.title)
    .filter(Boolean)
    .join('\n')
}

function exportPlaces(day: Day): string {
  const fromNotes = parseDayMeta(day.dayNotes).places
    .map((place) => (place.addr && place.addr !== 'Buscar pelo nome' ? `${place.name} – ${place.addr}` : place.name))
    .filter(Boolean)
  if (fromNotes.length) return fromNotes.join(' | ')
  const fromActivities = [
    ...new Set(day.activities.map((activity) => activity.location?.trim()).filter(Boolean)),
  ]
  return fromActivities.join(' | ')
}

function noteByLabel(day: Day, label: string): string {
  return parseDayMeta(day.dayNotes).notes.find((note) => note.label === label)?.text ?? ''
}

export function buildExportSheets(trip: Trip): Record<string, (string | number)[][]> {
  const roteiro: (string | number)[][] = [
    [
      'Data',
      'Dia',
      'Tipo do dia',
      'Manhã',
      'Tarde',
      'Noite',
      'Lugares e endereços',
      'Carro a partir do hotel',
      'Criança (soneca, carrinho, comida)',
      'Observações / horários',
    ],
    ...trip.days.map((day) => [
      formatShortDate(day.date),
      formatWeekdayShort(day.date),
      day.label,
      periodNotes(day, 'manha') || '—',
      periodNotes(day, 'tarde') || '—',
      periodNotes(day, 'noite') || '—',
      exportPlaces(day) || '—',
      noteByLabel(day, 'Deslocamento') || '—',
      noteByLabel(day, 'Com a criança') || '—',
      noteByLabel(day, 'Observações') || '—',
    ]),
  ]

  const locais: (string | number)[][] = [
    ['Categoria', 'Nome / Local', 'Endereço'],
    ...collectTripLocations(trip).map((place) => [place.category, place.name, place.address]),
  ]

  const gastos: (string | number)[][] = [
    ['Data', 'Descrição', 'Valor', 'Orçamento'],
    ...trip.expenses.map((expense) => {
      const day = trip.days.find((item) => item.id === expense.dayId)
      return [
        day ? formatShortDate(day.date) : '',
        expense.description,
        brlToUsd(expense.amount),
        BUDGET_LABELS[expense.budgetId] ?? expense.budgetId,
      ]
    }),
  ]

  const dicas: (string | number)[][] = [
    ['Tema', 'Dica / ressalva'],
    ...(trip.tips ?? []).map((tip) => [tip.tema, tip.texto]),
  ]

  const viagem: (string | number)[][] = [
    ['Nome', 'Destino', 'Início', 'Fim'],
    [trip.name, trip.destination, trip.startDate, trip.endDate],
  ]

  return { 'Roteiro completo': roteiro, Locais: locais, Gastos: gastos, 'Dicas e ressalvas': dicas, Viagem: viagem }
}

function downloadWorkbook(XLSX: XLSXModule, sheets: Record<string, (string | number)[][]>, filename: string) {
  const wb = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name.slice(0, 31))
  }
  XLSX.writeFile(wb, filename)
}

export async function exportTripToExcel(trip: Trip): Promise<string> {
  const XLSX = await loadXlsx()
  const slug = trip.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'roteiro'
  const filename = `${slug}.xlsx`
  downloadWorkbook(XLSX, buildExportSheets(trip), filename)
  return filename
}
