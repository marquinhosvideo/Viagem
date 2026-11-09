import type { Hotel, Place, Trip } from '../types'

/** Canonical hotel for this family trip — single source of truth. */
export const CANONICAL_HOTEL: Hotel = {
  name: 'Hotel',
  address: '10330 Turkey Lake Road, Orlando, FL 32819',
}

const OLD_HOTEL_STREET =
  /8600\s+international\s+dr(?:ive)?|7389\s+universal\s+boulevard/i

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR')
    .trim()
}

export function hotelLabel(hotel: Hotel = CANONICAL_HOTEL): string {
  return `${hotel.name} – ${hotel.address}`
}

export function isCanonicalHotelAddress(address?: string | null): boolean {
  if (!address?.trim()) return false
  return fold(address).includes('10330 turkey lake')
}

function rewriteHotelText(value: string): string {
  let next = value.replace(
    /8600\s+international\s+dr(?:ive)?|7389\s+universal\s+boulevard/gi,
    '10330 Turkey Lake Road',
  )
  next = next.replace(/Hotel\s*[–—-]\s*[^|\n]+/gi, hotelLabel())
  return next
}

function rewritePlace(place: Place): Place {
  if (/^hotel\b/i.test(place.name) || OLD_HOTEL_STREET.test(place.address ?? '')) {
    return {
      ...place,
      name: place.name.trim() || CANONICAL_HOTEL.name,
      address: CANONICAL_HOTEL.address,
      category: 'hotel',
    }
  }
  if (!place.address) return place
  return {
    ...place,
    address: place.address.replace(
      /8600\s+international\s+dr(?:ive)?|7389\s+universal\s+boulevard/gi,
      '10330 Turkey Lake Road',
    ),
  }
}

/**
 * Forces the trip hotel and every Hotel / old-street reference to the
 * canonical Turkey Lake address.
 */
export function applyCanonicalHotel(trip: Trip): Trip {
  return {
    ...trip,
    hotel: {
      name: trip.hotel?.name?.trim() || CANONICAL_HOTEL.name,
      address: CANONICAL_HOTEL.address,
    },
    places: (trip.places ?? []).map(rewritePlace),
    days: trip.days.map((day) => ({
      ...day,
      driveFromHotel: day.driveFromHotel
        ? rewriteHotelText(day.driveFromHotel)
        : day.driveFromHotel,
      kidNotes: day.kidNotes ? rewriteHotelText(day.kidNotes) : day.kidNotes,
      notes: day.notes ? rewriteHotelText(day.notes) : day.notes,
    })),
  }
}

export function resolveHotelFromMeta(
  meta: Record<string, unknown>,
  fallback?: Hotel | null,
): Hotel {
  const entries = Object.entries(meta)
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const want = fold(key).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
      const found = entries.find(
        ([k]) => fold(k).replace(/[^\p{L}\p{N}]+/gu, ' ').trim() === want,
      )
      if (found && String(found[1] ?? '').trim()) return String(found[1]).trim()
    }
    return ''
  }

  const name =
    pick('hotel', 'hospedagem', 'nome do hotel') ||
    fallback?.name ||
    CANONICAL_HOTEL.name

  return {
    name: name || CANONICAL_HOTEL.name,
    address: CANONICAL_HOTEL.address,
  }
}
