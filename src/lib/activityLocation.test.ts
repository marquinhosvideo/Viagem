import assert from 'node:assert/strict'
import {
  locationForActivityText,
  repairDayActivities,
  stripPeriodTitlePrefix,
} from './activityLocation'
import type { Day } from '../types'

{
  assert.equal(stripPeriodTitlePrefix('Manhã — Magic Kingdom'), 'Magic Kingdom')
  assert.equal(stripPeriodTitlePrefix('Tarde — Soneca'), 'Soneca')
}

{
  const places = [
    {
      name: 'Disney Springs',
      addr: 'Lake Buena Vista, FL 32830',
      copyText: 'Disney Springs – Lake Buena Vista, FL 32830',
    },
    {
      name: 'Disney Ticket Center',
      addr: 'Town Center de Disney Springs',
      copyText: 'Disney Ticket Center – Town Center de Disney Springs',
    },
  ]
  assert.equal(
    locationForActivityText('Jantar cedo em Disney Springs', places),
    'Disney Springs – Lake Buena Vista, FL 32830',
  )
  assert.equal(
    locationForActivityText(
      'Retirar ingressos no Disney Ticket Center e compras em Disney Springs',
      places,
    ),
    undefined,
  )
  assert.equal(locationForActivityText('Soneca no hotel', places), undefined)
}

{
  const day: Day = {
    id: 'day-1',
    date: '2026-12-01',
    label: 'Compras',
    dayNotes:
      '📍 Orlando International Premium Outlets – 4951 International Dr | Ross – 5295 International Dr',
    activities: [
      {
        id: 'a1',
        title: 'Manhã — Outlets',
        location: 'Orlando International Premium Outlets – 4951 International Dr',
        notes: 'Orlando International Premium Outlets na abertura',
        done: false,
      },
      {
        id: 'a2',
        title: 'Tarde — Soneca',
        location: 'Orlando International Premium Outlets – 4951 International Dr',
        notes: 'Volta ao hotel',
        done: false,
      },
      {
        id: 'a3',
        title: 'Noite — Jantar',
        location: 'Orlando International Premium Outlets – 4951 International Dr',
        notes: 'Jantar na I-Drive',
        done: false,
      },
    ],
  }
  const repaired = repairDayActivities(day)
  assert.equal(repaired.activities[0].title, 'Outlets')
  assert.match(repaired.activities[0].location ?? '', /Premium Outlets/)
  assert.equal(repaired.activities[1].location, undefined)
  assert.equal(repaired.activities[2].location, undefined)
}

console.log('activityLocation.test.ts ok')
