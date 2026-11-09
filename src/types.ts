/** Orçamentos acompanhados no topo — valores provisórios de R$ 5.000 */
export type BudgetId = 'marcos' | 'dielen' | 'helena' | 'alimentacao' | 'outros'

export type Budget = {
  id: BudgetId
  label: string
  /** Teto em BRL — ajuste depois com os valores reais */
  limit: number
}

export const BUDGETS: Budget[] = [
  { id: 'marcos', label: 'Marcos', limit: 5000 },
  { id: 'dielen', label: 'Dielen', limit: 5000 },
  { id: 'helena', label: 'Helena', limit: 5000 },
  { id: 'alimentacao', label: 'Alimentação', limit: 5000 },
  { id: 'outros', label: 'Outros', limit: 5000 },
]

export const BUDGET_LABELS: Record<BudgetId, string> = {
  marcos: 'Marcos',
  dielen: 'Dielen',
  helena: 'Helena',
  alimentacao: 'Alimentação',
  outros: 'Outros',
}

export const BUDGET_ORDER: BudgetId[] = BUDGETS.map((b) => b.id)

/** @deprecated use BudgetId — mantido para leitura de dados antigos */
export type ExpenseCategory = BudgetId

/** Slug sem acento; a UI exibe o rótulo com acento. */
export type PlaceCategory =
  | 'hotel'
  | 'alimentacao'
  | 'compras'
  | 'lazer'
  | 'transporte'

export type StopStatus = 'fixo' | 'opcional'

/** Local físico único (sem duplicatas). */
export type Place = {
  id: string
  name: string
  /** null quando o endereço ainda não foi preenchido */
  address?: string | null
  category: PlaceCategory
  lat?: number | null
  lng?: number | null
}

/** Parada ordenada do dia — aponta para um local. */
export type Stop = {
  id: string
  /** Sequência global na viagem (1..n) */
  seq: number
  /** Ordem dentro do dia (1..n) */
  orderInDay: number
  placeId: string
  status: StopStatus
  note?: string | null
  done: boolean
}

export type Day = {
  id: string
  date: string
  weekday: string
  /** Tipo do dia (ex.: Parque, Compras) */
  dayType: string
  driveFromHotel?: string | null
  kidNotes?: string | null
  notes?: string | null
  stops: Stop[]
}

export type Expense = {
  id: string
  dayId: string
  /** Em qual orçamento o gasto conta */
  budgetId: BudgetId
  description: string
  /**
   * Valor canônico em BRL (convertido do USD digitado / lido da nota
   * com a taxa fixa em `src/lib/currency.ts`).
   */
  amount: number
  createdAt: string
}

export type Tip = {
  tema: string
  texto: string
}

export type Hotel = {
  name: string
  address: string
}

export type Trip = {
  name: string
  destination: string
  startDate: string
  endDate: string
  currency: string
  /** Catálogo único de locais da viagem */
  places: Place[]
  days: Day[]
  expenses: Expense[]
  tips?: Tip[]
  /** Ponto de partida dos deslocamentos do dia. */
  hotel?: Hotel
  /** Overrides opcionais dos tetos (R$) — senão usa BUDGETS */
  budgetLimits?: Partial<Record<BudgetId, number>>
}

export type TabId = 'hoje' | 'roteiro' | 'gastos' | 'locais' | 'parques' | 'importar'

/** Compat: labels antigos de categoria → orçamento */
export const CATEGORY_LABELS = BUDGET_LABELS
export const CATEGORY_ORDER = BUDGET_ORDER

export const PLACE_CATEGORY_LABELS: Record<PlaceCategory, string> = {
  hotel: 'Hotel',
  alimentacao: 'Alimentação',
  compras: 'Compras',
  lazer: 'Lazer',
  transporte: 'Transporte',
}

export const PLACE_CATEGORY_ORDER: PlaceCategory[] = [
  'hotel',
  'alimentacao',
  'compras',
  'lazer',
  'transporte',
]
