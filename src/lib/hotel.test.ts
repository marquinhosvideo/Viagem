import assert from 'node:assert/strict'
import {
  applyCanonicalHotel,
  CANONICAL_HOTEL,
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
    places: [
      {
        id: 'loc-hotel',
        name: 'Hotel',
        address: '8600 International Dr, Orlando, FL 32819',
        category: 'hotel',
      },
      {
        id: 'loc-old',
        name: 'Loja antiga',
        address: '7389 Universal Boulevard, Orlando, FL 32819',
        category: 'compras',
      },
    ],
    days: [
      {
        id: 'day-1',
        date: '2026-11-28',
        weekday: 'Sáb',
        dayType: 'Chegada',
        driveFromHotel: 'Perto do hotel em 8600 International Dr',
        stops: [
          {
            id: 'stop-1',
            seq: 1,
            orderInDay: 1,
            placeId: 'loc-hotel',
            status: 'fixo',
            done: false,
          },
        ],
      },
    ],
    expenses: [],
  }

  const next = applyCanonicalHotel(trip)
  assert.equal(next.hotel?.address, CANONICAL_HOTEL.address)
  assert.equal(next.places[0].address, CANONICAL_HOTEL.address)
  assert.match(next.places[1].address ?? '', /10330 Turkey Lake Road/)
  assert.match(next.days[0].driveFromHotel ?? '', /10330 Turkey Lake Road/)
  assert.ok(!/8600|7389/.test(JSON.stringify(next)))
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
