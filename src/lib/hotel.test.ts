import assert from 'node:assert/strict'
import {
  applyCanonicalHotel,
  CANONICAL_HOTEL,
  hotelLabel,
  isCanonicalHotelAddress,
  resolveHotelFromMeta,
} from './hotel'
import type { Trip } from '../types'

{
  assert.ok(isCanonicalHotelAddress(CANONICAL_HOTEL.address))
  assert.ok(isCanonicalHotelAddress('10330 Turkey Lake Road, Orlando, FL 32819'))
  assert.equal(isCanonicalHotelAddress('8600 International Dr, Orlando, FL 32819'), false)
}

{
  const trip: Trip = {
    name: 'Test',
    destination: 'Orlando',
    startDate: '2026-11-28',
    endDate: '2026-11-28',
    currency: 'BRL',
    hotel: { name: 'Hotel', address: '8600 International Dr, Orlando, FL 32819' },
    days: [
      {
        id: 'day-1',
        date: '2026-11-28',
        label: 'Chegada',
        dayNotes: '📍 Hotel – 8600 International Dr, Orlando, FL 32819',
        activities: [
          {
            id: 'a1',
            title: 'Soneca',
            location: 'Hotel – 8600 International Dr, Orlando, FL 32819',
            notes: '😴 DESCANSO/SONECA — Soneca no hotel.',
            done: false,
          },
          {
            id: 'a2',
            title: 'Jantar',
            location: 'Hotel — 7389 Universal Boulevard, Orlando, FL 32819',
            notes: 'Jantar perto do hotel',
            done: false,
          },
        ],
      },
    ],
    expenses: [],
    locations: [
      {
        name: 'Hotel',
        address: '8600 International Dr, Orlando, FL 32819',
        category: 'Hospedagem',
      },
    ],
  }

  const next = applyCanonicalHotel(trip)
  assert.equal(next.hotel?.address, CANONICAL_HOTEL.address)
  assert.equal(next.days[0].activities[0].location, hotelLabel())
  assert.equal(next.days[0].activities[1].location, hotelLabel())
  assert.match(next.days[0].dayNotes ?? '', /10330 Turkey Lake Road/)
  assert.ok(!/8600|7389/.test(JSON.stringify(next)))
  assert.equal(next.locations?.[0].address, CANONICAL_HOTEL.address)
}

{
  const hotel = resolveHotelFromMeta({
    Nome: 'Orlando 2026',
    Hotel: 'Hotel',
    'Endereço do hotel': '10330 Turkey Lake Road, Orlando, FL 32819',
  })
  assert.equal(hotel.address, CANONICAL_HOTEL.address)
}

console.log('hotel.test.ts ok')
