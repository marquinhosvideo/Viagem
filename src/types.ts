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

export type Activity = {
  id: string
  time?: string
  title: string
  location?: string
  notes?: string
  done: boolean
}

export type Day = {
  id: string
  date: string
  label: string
  dayNotes?: string
  activities: Activity[]
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

export type SavedPlace = {
  name: string
  address: string
  category: string
}

export type Trip = {
  name: string
  destination: string
  startDate: string
  endDate: string
  currency: string
  days: Day[]
  expenses: Expense[]
  tips?: Tip[]
  /** Locais importados da planilha; dados antigos são derivados do roteiro. */
  locations?: SavedPlace[]
  /** Overrides opcionais dos tetos (R$) — senão usa BUDGETS */
  budgetLimits?: Partial<Record<BudgetId, number>>
}

export type TabId = 'hoje' | 'roteiro' | 'gastos' | 'locais' | 'parques' | 'importar'

/** Compat: labels antigos de categoria → orçamento */
export const CATEGORY_LABELS = BUDGET_LABELS
export const CATEGORY_ORDER = BUDGET_ORDER
