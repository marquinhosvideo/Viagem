import assert from 'node:assert/strict'
import { parseDayMeta, replaceDayPlaces, toDayPlace } from './dayMeta'

{
  const original =
    '📍 Disney Springs – Lake Buena Vista, FL 32830 | Ross – 5295 International Dr\n\n🚗 ~20 min\n\n📝 Ir cedo'
  const { places, notes } = parseDayMeta(original)
  assert.equal(places.length, 2)
  assert.equal(places[0].name, 'Disney Springs')
  assert.equal(places[1].name, 'Ross')
  assert.equal(places[1].addr, '5295 International Dr')
  assert.ok(notes.some((note) => note.label === 'Deslocamento'))

  const reordered = [places[1], places[0]]
  const next = replaceDayPlaces(original, reordered)
  const parsed = parseDayMeta(next)
  assert.equal(parsed.places[0].name, 'Ross')
  assert.equal(parsed.places[1].name, 'Disney Springs')
  assert.ok(parsed.notes.some((note) => /20 min/.test(note.text)))
}

{
  const place = toDayPlace('Walmart', '8990 Turkey Lake Rd')
  assert.equal(place?.copyText, 'Walmart – 8990 Turkey Lake Rd')
  const added = replaceDayPlaces(undefined, [place!])
  assert.equal(parseDayMeta(added).places[0].name, 'Walmart')
}

console.log('dayMeta.test.ts ok')
