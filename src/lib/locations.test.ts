import assert from 'node:assert/strict'
import { EXTRA_CHAIN_STORES } from '../data/chainStores'
import type { Trip } from '../types'
import { splitPlaceChunks } from './dayMeta'
import {
  collectLocatedPlaces,
  withBranchName,
} from './locations'

function tripWith(days: Trip['days'], locations: Trip['locations'] = []): Trip {
  return {
    name: 'Test',
    destination: 'Orlando',
    startDate: days[0]?.date ?? '2026-11-28',
    endDate: days.at(-1)?.date ?? '2026-11-28',
    currency: 'BRL',
    days,
    expenses: [],
    locations,
  }
}

{
  const chunks = splitPlaceChunks(
    'Walmart Supercenter – 8990 Turkey Lake Rd, Orlando, FL 32819 (alternativa: Target Millenia – 4750 Millenia Plaza Way, Orlando, FL 32839)',
  )
  assert.equal(chunks.length, 2)
  assert.match(chunks[0], /Walmart Supercenter/)
  assert.match(chunks[1], /Target Millenia/)
}

{
  assert.equal(
    withBranchName('Walmart', '8990 Turkey Lake Rd, Orlando, FL 32819'),
    'Walmart Turkey Lake',
  )
  assert.equal(
    withBranchName('Walmart Supercenter', '8101 S John Young Pkwy, Orlando, FL 32819'),
    'Walmart Supercenter John Young',
  )
  assert.equal(
    withBranchName('Target', '4750 Millenia Plaza Way, Orlando, FL 32839'),
    'Target Millenia',
  )
}

{
  const trip = tripWith(
    [
      {
        id: 'day-2026-11-28',
        date: '2026-11-28',
        label: 'Chegada',
        dayNotes: '📍 Walmart Supercenter – 8990 Turkey Lake Rd, Orlando, FL 32819',
        activities: [],
      },
      {
        id: 'day-2026-12-07',
        date: '2026-12-07',
        label: 'Descanso',
        dayNotes: '📍 Walmart – 8101 S John Young Pkwy, Orlando, FL 32819',
        activities: [],
      },
      {
        id: 'day-2026-12-11',
        date: '2026-12-11',
        label: 'Outlets',
        dayNotes: '📍 Walmart – 3250 Vineland Rd, Kissimmee, FL 34746',
        activities: [],
      },
    ],
    [
      { name: 'Walmart', address: '8990 Turkey Lake Rd, Orlando, FL 32819', category: 'Compras' },
      {
        name: 'Walmart Supercenter',
        address:
          '8990 Turkey Lake Rd, Orlando, FL 32819 (alternativa: Target Millenia – 4750 Millenia Plaza Way, Orlando, FL 32839)',
        category: 'Compras',
      },
    ],
  )

  const walmarts = collectLocatedPlaces(trip).filter((place) => /walmart/i.test(place.name))
  const addresses = new Set(walmarts.map((place) => place.address.replace(/\s*\(.*$/, '')))
  assert.ok(walmarts.length >= 3, `expected several Walmarts, got ${walmarts.map((p) => p.name).join(', ')}`)
  assert.ok(
    walmarts.some((place) => /turkey lake/i.test(place.name) && place.days.some((day) => day.date === '2026-11-28')),
  )
  assert.ok(
    walmarts.some((place) => /john young/i.test(place.name) && place.days.some((day) => day.date === '2026-12-07')),
  )
  assert.ok(
    walmarts.some(
      (place) => /lake buena vista|vineland/i.test(place.name) && place.days.some((day) => day.date === '2026-12-11'),
    ),
  )
  assert.equal(
    walmarts.filter((place) => /8990 turkey lake/i.test(place.address)).length,
    1,
    'duplicate Turkey Lake strings should merge into one card',
  )
  assert.ok(
    !walmarts.some((place) => /alternativa/i.test(place.address)),
    'alternative stores must not stay glued to the Walmart address',
  )
  assert.ok(addresses.size >= 3)
}

{
  const trip = tripWith(
    [
      {
        id: 'day-a',
        date: '2026-12-01',
        label: 'Outlets',
        dayNotes: '📍 Ross – 5295 International Dr',
        activities: [],
      },
      {
        id: 'day-b',
        date: '2026-12-04',
        label: 'Leve',
        dayNotes: '📍 Ross – 7603 Turkey Lake Rd, Orlando, FL 32819',
        activities: [],
      },
      {
        id: 'day-c',
        date: '2026-12-08',
        label: 'Millenia',
        dayNotes: '📍 Ross – 4661 Millenia Plaza Way',
        activities: [],
      },
    ],
    EXTRA_CHAIN_STORES,
  )
  const ross = collectLocatedPlaces(trip).filter((place) => /^Ross/.test(place.name))
  assert.equal(ross.length, 3, ross.map((place) => `${place.name} ${place.address}`).join(' | '))
  const targets = collectLocatedPlaces(trip).filter((place) => /^Target/.test(place.name))
  assert.ok(targets.length >= 4, `expected extra Target branches, got ${targets.map((p) => p.name).join(', ')}`)
}

console.log('locations.test.ts ok')
