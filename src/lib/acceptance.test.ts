import assert from 'node:assert/strict'
import { sampleTrip } from '../data/sampleTrip'

/** Critérios de aceite da orientação (seção 7). */
{
  assert.equal(sampleTrip.name, 'Orlando 2026')
  assert.equal(sampleTrip.startDate, '2026-11-27')
  assert.equal(sampleTrip.endDate, '2026-12-14')
  assert.equal(sampleTrip.days.length, 18)
  assert.equal(sampleTrip.places.length, 46)

  const stops = sampleTrip.days.flatMap((day) => day.stops)
  assert.equal(stops.length, 79)
  assert.deepEqual(
    stops.map((s) => s.seq).sort((a, b) => a - b),
    Array.from({ length: 79 }, (_, i) => i + 1),
  )

  for (const day of sampleTrip.days) {
    assert.ok(!('activities' in day))
    assert.ok(!('dayNotes' in day))
    assert.ok(!('label' in day))
    assert.ok(Array.isArray(day.stops))
  }

  // Lugares não são mais uma string única com " | " — cada parada aponta a um local.
  for (const day of sampleTrip.days) {
    for (const stop of day.stops) {
      assert.equal(typeof stop.placeId, 'string')
      assert.ok(sampleTrip.places.some((place) => place.id === stop.placeId))
    }
  }
}

console.log('acceptance.test.ts ok')
