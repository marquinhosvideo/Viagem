import assert from 'node:assert/strict'
import { sampleTrip } from '../data/sampleTrip'
import { dayHeaderNotes, dayPlaces } from './dayMeta'

{
  const day = sampleTrip.days.find((item) => item.date === '2026-11-29')
  assert.ok(day)
  const notes = dayHeaderNotes(day)
  assert.ok(notes.some((note) => note.label === 'Deslocamento'))
  assert.ok(notes.some((note) => note.label === 'Com a criança'))
  assert.equal(
    notes.some((note) => /\|/.test(note.text) && note.label === 'Onde'),
    false,
  )
}

{
  const day = sampleTrip.days.find((item) => item.date === '2026-12-01')
  assert.ok(day)
  const places = dayPlaces(sampleTrip, day)
  assert.equal(places[0]?.name, 'Hotel')
  assert.ok(places.some((place) => place.name === 'Ross I-Drive'))
  assert.ok(places.every((place) => !place.copyText.includes(' | ')))
}

console.log('dayMeta.test.ts ok')
