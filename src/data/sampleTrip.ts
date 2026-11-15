import type { Trip } from '../types'
import { normalizeTips } from '../lib/tips'
import orlandoTrip from './orlandoTrip.json'

const raw = orlandoTrip as unknown as Trip

/** Roteiro padrão: Orlando 2026 (importado da planilha da família) */
export const sampleTrip: Trip = {
  ...raw,
  tips: normalizeTips(raw.tips),
}
