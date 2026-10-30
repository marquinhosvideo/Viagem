import assert from 'node:assert/strict'
import {
  activityTitleFromBlock,
  locationForActivityText,
  repairDayActivities,
  splitActivityBlocks,
  stripPeriodTitlePrefix,
} from './activityLocation'
import type { Day } from '../types'
import { toDayPlace } from './dayMeta'

{
  assert.equal(stripPeriodTitlePrefix('Manhã — Magic Kingdom'), 'Magic Kingdom')
  assert.equal(activityTitleFromBlock('🎢 PARQUE — ⭐ Magic Kingdom'), 'PARQUE — ⭐ Magic Kingdom')
}

{
  const blocks = splitActivityBlocks(
    [
      '😴 DESCANSO/SONECA — Soneca no hotel.',
      '🎢 PARQUE — ~15h30, Disney Springs: retirar os ingressos no Disney Ticket Center.',
      '🛍️ COMPRAS — World of Disney e lojas de Disney Springs.',
    ].join('\n'),
  )
  assert.equal(blocks.length, 3)
  assert.match(blocks[0], /Soneca no hotel/)
  assert.match(blocks[1], /Disney Ticket Center/)
  assert.match(blocks[2], /World of Disney/)
}

{
  const places = [
    toDayPlace('Disney Springs', 'Lake Buena Vista, FL 32830')!,
    toDayPlace('Disney Ticket Center', 'Town Center de Disney Springs')!,
    toDayPlace('Hotel', '7389 Universal Boulevard, Orlando, FL 32819')!,
  ]
  assert.equal(
    locationForActivityText('Soneca no hotel.', places),
    'Hotel – 7389 Universal Boulevard, Orlando, FL 32819',
  )
  assert.equal(
    locationForActivityText(
      'Retirar ingressos no Disney Ticket Center (Town Center)',
      places,
    ),
    'Disney Ticket Center – Town Center de Disney Springs',
  )
  assert.equal(
    locationForActivityText('Compras leves em Disney Springs', places),
    'Disney Springs – Lake Buena Vista, FL 32830',
  )
  assert.equal(
    locationForActivityText('Jantar perto do hotel e dormir cedo.', places),
    'Hotel – 7389 Universal Boulevard, Orlando, FL 32819',
  )
  // Must not keep an unrelated place (e.g. airport) just because it is on the day list.
  assert.equal(
    locationForActivityText(
      'Jantar perto do hotel.',
      [
        toDayPlace('Miami International Airport (MIA)', 'Miami, FL')!,
        toDayPlace('Hotel', '7389 Universal Boulevard, Orlando, FL 32819')!,
      ],
    ),
    'Hotel – 7389 Universal Boulevard, Orlando, FL 32819',
  )
}

{
  const day: Day = {
    id: 'day-2026-11-29',
    date: '2026-11-29',
    label: 'Disney Springs',
    dayNotes:
      '📍 Disney Springs – Lake Buena Vista, FL 32830 | Disney Ticket Center – Town Center de Disney Springs',
    activities: [
      {
        id: 'act-2026-11-29-tarde',
        title: 'Manhã — DESCANSO/SONECA — Soneca no hotel.',
        location: 'Hotel — 7389 Universal Boulevard, Orlando, FL 32819',
        notes: [
          '😴 DESCANSO/SONECA — Soneca no hotel.',
          '🎢 PARQUE — ~15h30, Disney Springs: retirar os ingressos de 3 dias no Disney Ticket Center (Town Center).',
          '🛍️ COMPRAS — Compras leves no mesmo passeio: World of Disney e lojas de Disney Springs.',
        ].join('\n'),
        done: false,
      },
    ],
  }

  const repaired = repairDayActivities(day, {
    name: 'Hotel',
    address: '7389 Universal Boulevard, Orlando, FL 32819',
  })
  assert.equal(repaired.activities.length, 3)
  assert.match(repaired.activities[0].title, /Soneca no hotel/i)
  assert.match(repaired.activities[0].location ?? '', /7389 Universal Boulevard/)
  assert.match(
    repaired.activities[1].location ?? '',
    /Disney Ticket Center|Disney Springs/,
  )
  assert.match(repaired.activities[1].notes ?? '', /Ticket Center/)
  assert.equal(
    locationForActivityText(repaired.activities[1].notes ?? '', [
      toDayPlace('Disney Springs', 'Lake Buena Vista, FL 32830')!,
      toDayPlace('Disney Ticket Center', 'Town Center de Disney Springs')!,
    ]),
    'Disney Ticket Center – Town Center de Disney Springs',
  )
  assert.match(repaired.activities[2].location ?? '', /Disney Springs/)
  assert.ok(
    !repaired.activities.some((activity) =>
      /Hotel — 7389/.test(activity.location ?? '') && /Ticket Center|World of Disney/.test(activity.notes ?? ''),
    ),
  )
}

{
  const day: Day = {
    id: 'day-2026-11-28',
    date: '2026-11-28',
    label: 'Chegada',
    dayNotes: '📍 Walmart Supercenter Turkey Lake – 8990 Turkey Lake Rd, Orlando, FL 32819',
    activities: [
      {
        id: 'act-2026-11-28-tarde',
        title: 'Chegada',
        location: 'Miami International Airport (MIA)',
        notes: [
          '✈️ VIAGEM — Chegada em Orlando. Check-in (pedir early check-in).',
          '🛒 MERCADO — Parada rápida no Walmart Supercenter Turkey Lake.',
        ].join('\n'),
        done: false,
      },
      {
        id: 'act-2026-11-28-noite',
        title: 'Jantar',
        location: 'Miami International Airport (MIA)',
        notes: '😴 DESCANSO/SONECA — Jantar perto do hotel e dormir cedo.',
        done: false,
      },
    ],
  }
  const repaired = repairDayActivities(day, {
    name: 'Hotel',
    address: '7389 Universal Boulevard, Orlando, FL 32819',
  })
  assert.equal(repaired.activities.length, 3)
  assert.match(repaired.activities[0].notes ?? '', /Chegada em Orlando/)
  assert.match(repaired.activities[0].location ?? '', /Hotel|7389/)
  assert.match(repaired.activities[1].location ?? '', /Walmart/)
  assert.match(repaired.activities[2].location ?? '', /7389 Universal Boulevard/)
  assert.ok(
    !repaired.activities.some((activity) => /Miami International/i.test(activity.location ?? '')),
  )
}

console.log('activityLocation.test.ts ok')
