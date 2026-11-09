import assert from 'node:assert/strict'
import { sampleTrip } from '../data/sampleTrip'
import { collectLocatedPlaces, groupTripLocations } from './locations'

{
  const places = collectLocatedPlaces(sampleTrip)
  assert.equal(places.length, 46)
  assert.equal(new Set(places.map((place) => place.name)).size, 46)
  assert.ok(places.every((place) => place.id && place.category))
}

{
  const groups = groupTripLocations(sampleTrip)
  const labels = groups.map((group) => group.category)
  assert.deepEqual(
    labels.sort(),
    ['alimentacao', 'compras', 'hotel', 'lazer', 'transporte'].sort(),
  )
  const hotel = groups.find((group) => group.category === 'hotel')
  assert.equal(hotel?.places.length, 1)
  assert.equal(hotel?.places[0]?.name, 'Hotel')
}

{
  const noAddr = collectLocatedPlaces(sampleTrip).filter((place) => !place.address)
  assert.equal(noAddr.length, 7)
}

console.log('locations.test.ts ok')
