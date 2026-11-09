import type { WorkSheet } from 'xlsx'
import {
  BUDGET_LABELS,
  PLACE_CATEGORY_LABELS,
  type BudgetId,
  type Day,
  type Expense,
  type Place,
  type PlaceCategory,
  type Stop,
  type Tip,
  type Trip,
} from '../types'
import { brlToUsd, usdToBrl } from './currency'
import { formatShortDate, formatWeekdayShort, parseAmount, uid } from './format'
import { normalizeBudgetId } from './budgets'
import {
  applyCanonicalHotel,
  CANONICAL_HOTEL,
  resolveHotelFromMeta,
} from './hotel'
import { normalizePlaceCategory, normalizeStopStatus } from './places'

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

function dashOrNull(value: unknown): string | null {
  const text = clean(value)
  if (!text || text === '—' || text === '-') return null
  return text
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

function hasParadasColumns(rows: Row[]): boolean {
  if (!rows.length) return false
  const headers = Object.keys(rows[0]).map(normalizeHeader)
  return (
    headers.includes('seq') &&
    headers.includes('ordem no dia') &&
    headers.includes('local') &&
    headers.includes('categoria') &&
    headers.includes('status')
  )
}

function hasLegacyPeriodColumns(rows: Row[]): boolean {
  if (!rows.length) return false
  const headers = Object.keys(rows[0]).map(normalizeHeader)
  return headers.includes('manha') && headers.includes('tarde') && headers.includes('noite')
}

function placeIdForName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return `loc-${hash.toString(16).padStart(8, '0')}`
}

type BuiltRoteiro = {
  places: Place[]
  days: Day[]
}

function buildFromParadas(
  stopRows: Row[],
  dayRows: Row[],
  XLSX: XLSXModule,
): BuiltRoteiro {
  const placesByName = new Map<string, Place>()
  const stopsByDate = new Map<string, Stop[]>()
  const weekdayByDate = new Map<string, string>()

  for (const row of stopRows) {
    const seqRaw = pick(row, ['seq'])
    const seq = Number(seqRaw)
    if (!Number.isFinite(seq) || seq <= 0) continue

    const date = excelDateToIso(pick(row, ['data', 'date']), XLSX, 2026)
    if (!date) continue

    const name = clean(pick(row, ['local', 'nome', 'lugar']))
    if (!name) continue

    const category = normalizePlaceCategory(pick(row, ['categoria', 'category']))
    if (!category) {
      throw new Error(`Categoria inválida na seq ${seq}: ${String(pick(row, ['categoria']))}`)
    }

    const address = dashOrNull(pick(row, ['endereco', 'endereço', 'address']))
    const weekday = clean(pick(row, ['dia'])) || formatWeekdayShort(date)
    const orderInDay = Number(pick(row, ['ordem no dia', 'ordem'])) || 1
    const status = normalizeStopStatus(pick(row, ['status']))
    const note = dashOrNull(pick(row, ['observacao', 'observação', 'obs', 'nota']))

    weekdayByDate.set(date, weekday)

    const existing = placesByName.get(name)
    if (!existing) {
      placesByName.set(name, {
        id: placeIdForName(name),
        name,
        address,
        category,
        lat: null,
        lng: null,
      })
    } else {
      if (existing.category !== category) {
        throw new Error(`Local “${name}” com categorias conflitantes.`)
      }
      if (!existing.address && address) existing.address = address
    }

    const place = placesByName.get(name)!
    const list = stopsByDate.get(date) ?? []
    list.push({
      id: `stop-${String(seq).padStart(3, '0')}`,
      seq,
      orderInDay,
      placeId: place.id,
      status,
      note,
      done: false,
    })
    stopsByDate.set(date, list)
  }

  const dayMeta = new Map<
    string,
    {
      weekday: string
      dayType: string
      driveFromHotel: string | null
      kidNotes: string | null
      notes: string | null
    }
  >()

  for (const row of dayRows) {
    const date = excelDateToIso(pick(row, ['data', 'date']), XLSX, 2026)
    if (!date) continue
    const weekday =
      clean(pick(row, ['dia'])) || weekdayByDate.get(date) || formatWeekdayShort(date)
    const dayType =
      clean(pick(row, ['tipo do dia', 'tipo'])) || weekday
    const driveEntry = Object.entries(row).find(([k]) =>
      normalizeHeader(k).includes('carro'),
    )
    const kidEntry = Object.entries(row).find(([k]) =>
      normalizeHeader(k).includes('crianca'),
    )
    dayMeta.set(date, {
      weekday,
      dayType,
      driveFromHotel: dashOrNull(driveEntry?.[1]),
      kidNotes: dashOrNull(kidEntry?.[1]),
      notes: dashOrNull(
        pick(row, ['observacoes / horarios', 'observacoes', 'obs', 'notas']),
      ),
    })
  }

  const dates = [...new Set([...stopsByDate.keys(), ...dayMeta.keys()])].sort()
  const days: Day[] = dates.map((date) => {
    const meta = dayMeta.get(date)
    const stops = [...(stopsByDate.get(date) ?? [])].sort(
      (a, b) => a.orderInDay - b.orderInDay || a.seq - b.seq,
    )
    // Reindex ordem_no_dia without gaps
    stops.forEach((stop, index) => {
      stop.orderInDay = index + 1
    })
    return {
      id: `day-${date}`,
      date,
      weekday: meta?.weekday || weekdayByDate.get(date) || formatWeekdayShort(date),
      dayType: meta?.dayType || weekdayByDate.get(date) || formatWeekdayShort(date),
      driveFromHotel: meta?.driveFromHotel ?? null,
      kidNotes: meta?.kidNotes ?? null,
      notes: meta?.notes ?? null,
      stops,
    }
  })

  return {
    places: [...placesByName.values()].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR'),
    ),
    days,
  }
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
      const amountUsd = parseAmount(
        pick(row, ['valor', 'amount', 'preco', 'preço', 'custo']),
      )
      if (!date || !description || amountUsd <= 0) return null

      let dayId = dayByDate.get(date)
      if (!dayId) {
        const newDay: Day = {
          id: uid('day'),
          date,
          weekday: formatWeekdayShort(date),
          dayType: `Dia ${days.length + 1}`,
          stops: [],
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

function preserveDoneFlags(next: Trip, previous: Trip): Trip {
  const prevDone = new Map<string, boolean>()
  for (const day of previous.days) {
    for (const stop of day.stops) prevDone.set(stop.id, stop.done)
  }
  return {
    ...next,
    days: next.days.map((day) => ({
      ...day,
      stops: day.stops.map((stop) => ({
        ...stop,
        done: prevDone.get(stop.id) ?? stop.done,
      })),
    })),
  }
}

export type ImportResult = {
  trip: Trip
  stats: {
    days: number
    stops: number
    expenses: number
    tips: number
    places: number
    optionalStops: number
  }
  warnings: string[]
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
    sheetNames.find((n) => /roteiro completo/i.test(n)) ??
    sheetNames.find((n) => /roteiro|itinerario|programacao|agenda|plano/i.test(n))
  const diasName = sheetNames.find((n) => /^dias$/i.test(n))
  const gastosName = sheetNames.find((n) =>
    /gasto|despesa|expense|custo|financeiro/i.test(n),
  )
  const tipsName = sheetNames.find((n) => /dica|ressalva/i.test(n))
  const metaName = sheetNames.find((n) => /viagem|trip|info|geral/i.test(n))

  const roteiroSheet = roteiroName ? workbook.Sheets[roteiroName] : undefined
  const diasSheet = diasName ? workbook.Sheets[diasName] : undefined
  const gastosSheet = gastosName ? workbook.Sheets[gastosName] : undefined
  const tipsSheet = tipsName ? workbook.Sheets[tipsName] : undefined
  const metaSheet = metaName ? workbook.Sheets[metaName] : undefined

  const roteiroRows = roteiroSheet ? sheetToRows(XLSX, roteiroSheet) : []
  const warnings: string[] = []

  if (hasLegacyPeriodColumns(roteiroRows) && !hasParadasColumns(roteiroRows)) {
    throw new Error(
      'Esta planilha usa o formato antigo (Manhã / Tarde / Noite). Importe a planilha revisada com a aba “Roteiro completo” (Seq, Ordem no dia, Local, Categoria, Status).',
    )
  }

  if (!hasParadasColumns(roteiroRows)) {
    throw new Error(
      'Não encontrei o roteiro. Use a aba “Roteiro completo” com as colunas Seq, Data, Ordem no dia, Local, Categoria e Status.',
    )
  }

  const dayRows = diasSheet ? sheetToRows(XLSX, diasSheet) : []
  const { places, days } = buildFromParadas(roteiroRows, dayRows, XLSX)

  if (!days.length) {
    throw new Error('Nenhuma parada encontrada na aba “Roteiro completo”.')
  }

  const expenseRows = gastosSheet ? sheetToRows(XLSX, gastosSheet) : []
  const expenses = buildExpensesFromRows(expenseRows, days, XLSX)
  const tips = tipsSheet ? buildTips(sheetToRows(XLSX, tipsSheet)) : current.tips

  const metaRows = metaSheet ? sheetToRows(XLSX, metaSheet) : []
  const meta = metaRows[0] ?? {}

  const ulta = places.find((place) => /^ulta i-drive$/i.test(place.name))
  if (ulta?.address && /international blvd/i.test(ulta.address)) {
    warnings.push(
      'Ulta I-Drive está com “International Blvd” (as lojas vizinhas usam “International Dr”) — importado como está.',
    )
  }

  const draft: Trip = {
    name: clean(pick(meta, ['nome', 'name', 'viagem'])) || 'Orlando 2026',
    destination:
      clean(pick(meta, ['destino', 'destination', 'cidade'])) ||
      'Orlando, Flórida · família',
    startDate:
      excelDateToIso(pick(meta, ['inicio', 'início', 'start']), XLSX, 2026) ||
      days[0].date,
    endDate:
      excelDateToIso(pick(meta, ['fim', 'end']), XLSX, 2026) ||
      days[days.length - 1].date,
    currency: 'BRL',
    places,
    days,
    expenses,
    tips,
    hotel: resolveHotelFromMeta(meta as Record<string, unknown>, current.hotel),
    budgetLimits: current.budgetLimits ?? {
      marcos: 5000,
      dielen: 5000,
      helena: 5000,
      alimentacao: 5000,
      outros: 5000,
    },
  }

  const trip = preserveDoneFlags(applyCanonicalHotel(draft), current)
  const optionalStops = trip.days.reduce(
    (sum, day) => sum + day.stops.filter((stop) => stop.status === 'opcional').length,
    0,
  )

  return {
    trip,
    stats: {
      days: trip.days.length,
      stops: trip.days.reduce((sum, day) => sum + day.stops.length, 0),
      expenses: expenses.length,
      tips: tips?.length ?? 0,
      places: trip.places.length,
      optionalStops,
    },
    warnings,
  }
}

export function buildExportSheets(trip: Trip): Record<string, (string | number)[][]> {
  const canonical = applyCanonicalHotel(trip)
  const hotel = canonical.hotel ?? CANONICAL_HOTEL
  const hotelHeader = `Carro a partir do hotel — ${hotel.address}`

  const roteiro: (string | number)[][] = [
    [
      'Seq',
      'Data',
      'Dia',
      'Ordem no dia',
      'Local',
      'Endereço',
      'Categoria',
      'Status',
      'Observação',
    ],
    ...canonical.days.flatMap((day) =>
      [...day.stops]
        .sort((a, b) => a.orderInDay - b.orderInDay || a.seq - b.seq)
        .map((stop) => {
          const place = canonical.places.find((item) => item.id === stop.placeId)
          return [
            stop.seq,
            day.date,
            day.weekday,
            stop.orderInDay,
            place?.name ?? '',
            place?.address ?? '',
            place?.category ?? '',
            stop.status === 'opcional' ? 'Opcional' : 'Fixo',
            stop.note ?? '',
          ]
        }),
    ),
  ]

  const dias: (string | number)[][] = [
    [
      'Data',
      'Dia',
      'Tipo do dia',
      hotelHeader,
      'Criança (soneca, carrinho, comida)',
      'Observações / horários',
    ],
    ...canonical.days.map((day) => [
      day.date,
      day.weekday,
      day.dayType,
      day.driveFromHotel ?? '—',
      day.kidNotes ?? '—',
      day.notes ?? '—',
    ]),
  ]

  const locais: (string | number)[][] = [
    ['Categoria', 'Nome', 'Endereço'],
    ...[...canonical.places]
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .map((place) => [
        PLACE_CATEGORY_LABELS[place.category as PlaceCategory] ?? place.category,
        place.name,
        place.address ?? '',
      ]),
  ]

  const gastos: (string | number)[][] = [
    ['Data', 'Descrição', 'Valor', 'Orçamento'],
    ...canonical.expenses.map((expense) => {
      const day = canonical.days.find((item) => item.id === expense.dayId)
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
    ...(canonical.tips ?? []).map((tip) => [tip.tema, tip.texto]),
  ]

  const viagem: (string | number)[][] = [
    ['Nome', 'Destino', 'Início', 'Fim', 'Hotel', 'Endereço do hotel'],
    [
      canonical.name,
      canonical.destination,
      canonical.startDate,
      canonical.endDate,
      hotel.name,
      hotel.address,
    ],
  ]

  return {
    Viagem: viagem,
    'Roteiro completo': roteiro,
    Dias: dias,
    Locais: locais,
    Gastos: gastos,
    'Dicas e ressalvas': dicas,
  }
}

function downloadWorkbook(
  XLSX: XLSXModule,
  sheets: Record<string, (string | number)[][]>,
  filename: string,
) {
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
