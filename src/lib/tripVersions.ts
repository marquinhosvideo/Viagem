import type { Trip } from '../types'
import { supabase } from './supabase'

export const MAX_TRIP_VERSIONS = 5

export type TripVersionReason = 'import' | 'reset' | 'manual'

export type TripVersion = {
  id: string
  createdAt: string
  reason: TripVersionReason
  /** Nome do arquivo Excel, quando a versão foi salva antes de uma importação */
  fileName?: string
  label: string
  stats: {
    days: number
    activities: number
    stops: number
    tips: number
    expenses: number
  }
  trip: Trip
}

type TripVersionRow = {
  id: string
  created_at: string
  reason: TripVersionReason
  file_name: string | null
  label: string
  days_count: number
  activities_count: number
  tips_count: number
  expenses_count: number
  trip: Trip
}

function tripStats(trip: Trip): TripVersion['stats'] {
  const stops = trip.days.reduce((sum, d) => sum + d.stops.length, 0)
  return {
    days: trip.days.length,
    activities: stops,
    stops,
    tips: trip.tips?.length ?? 0,
    expenses: trip.expenses?.length ?? 0,
  }
}

function buildLabel(reason: TripVersionReason, fileName?: string): string {
  if (reason === 'import') {
    return fileName
      ? `Antes de importar “${fileName}”`
      : 'Antes de importar Excel'
  }
  if (reason === 'reset') return 'Antes de restaurar o roteiro Orlando'
  return 'Cópia manual do roteiro'
}

function rowToVersion(row: TripVersionRow): TripVersion | null {
  if (!row?.id || !row.trip?.days?.length) return null
  return {
    id: row.id,
    createdAt: row.created_at,
    reason: row.reason,
    fileName: row.file_name ?? undefined,
    label: row.label,
    stats: {
      days: row.days_count,
      activities: row.activities_count,
      stops: row.activities_count,
      tips: row.tips_count,
      expenses: row.expenses_count,
    },
    trip: row.trip,
  }
}

function requireVersionsTableError(error: { message: string }): Error {
  if (/trip_versions|schema cache|does not exist/i.test(error.message)) {
    return new Error(
      'Falta criar as tabelas de versão no Supabase. Rode supabase/trip_versions.sql (ou o schema.sql completo) no SQL Editor.',
    )
  }
  return new Error(error.message)
}

/**
 * Lista as versões históricas no Supabase (mais recentes primeiro, máx. 5).
 */
export async function listTripVersions(): Promise<TripVersion[]> {
  if (!supabase) {
    throw new Error(
      'O histórico de versões fica no banco (Supabase). Configure o sync da família para usar este recurso.',
    )
  }

  const { data, error } = await supabase
    .from('trip_versions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(MAX_TRIP_VERSIONS)

  if (error) throw requireVersionsTableError(error)

  return ((data ?? []) as TripVersionRow[])
    .map(rowToVersion)
    .filter((v): v is TripVersion => v != null)
}

async function pruneOldVersions(): Promise<void> {
  if (!supabase) return

  const { data, error } = await supabase
    .from('trip_versions')
    .select('id')
    .order('created_at', { ascending: false })

  if (error) throw error

  const excess = ((data ?? []) as { id: string }[]).slice(MAX_TRIP_VERSIONS)
  if (!excess.length) return

  const { error: deleteError } = await supabase
    .from('trip_versions')
    .delete()
    .in(
      'id',
      excess.map((row) => row.id),
    )

  if (deleteError) throw deleteError
}

/**
 * Salva o estado atual do roteiro como versão histórica no banco.
 * Mantém no máximo {@link MAX_TRIP_VERSIONS} (as mais recentes).
 */
export async function pushTripVersion(
  trip: Trip,
  options: { reason: TripVersionReason; fileName?: string } = { reason: 'manual' },
): Promise<TripVersion> {
  if (!supabase) {
    throw new Error(
      'O histórico de versões fica no banco (Supabase). Configure o sync da família para usar este recurso.',
    )
  }

  const stats = tripStats(trip)
  const version: TripVersion = {
    id: `ver-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
    reason: options.reason,
    fileName: options.fileName,
    label: buildLabel(options.reason, options.fileName),
    stats,
    trip: structuredClone(trip),
  }

  const { error } = await supabase.from('trip_versions').insert({
    id: version.id,
    created_at: version.createdAt,
    reason: version.reason,
    file_name: version.fileName ?? null,
    label: version.label,
    days_count: stats.days,
    activities_count: stats.activities,
    tips_count: stats.tips,
    expenses_count: stats.expenses,
    trip: version.trip,
  })

  if (error) throw requireVersionsTableError(error)
  await pruneOldVersions()
  return version
}

export async function getTripVersion(id: string): Promise<TripVersion | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('trip_versions')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw requireVersionsTableError(error)
  if (!data) return null
  return rowToVersion(data as TripVersionRow)
}

/** Retorna uma cópia do trip da versão, ou null se não existir. */
export async function loadTripVersion(id: string): Promise<Trip | null> {
  const version = await getTripVersion(id)
  if (!version) return null
  return structuredClone(version.trip)
}
