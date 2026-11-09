import type { Place } from '../types'

/**
 * Filiais extras fora do roteiro atual — não entram no catálogo canônico.
 * O catálogo `trip.places` vem só das paradas da planilha revisada.
 */
export const EXTRA_CHAIN_STORES: Place[] = []
