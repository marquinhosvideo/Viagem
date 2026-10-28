import assert from 'node:assert/strict'
import { sampleTrip } from '../data/sampleTrip'
import {
  buildDayMapStops,
  DEFAULT_HOTEL,
  googleMapsDirUrl,
  hotelOf,
  mapsQuery,
  stopKey,
} from './dayMap'

{
  assert.equal(hotelOf({}).address, DEFAULT_HOTEL.address)
  assert.match(hotelOf(sampleTrip).address, /8600 International Dr/)
}

{
  const gig = sampleTrip.days.find((day) => day.date === '2026-11-27')
  assert.ok(gig)
  assert.equal(buildDayMapStops(sampleTrip, gig).length, 0)
}

{
  const arrival = sampleTrip.days.find((day) => day.date === '2026-11-28')
  assert.ok(arrival)
  const stops = buildDayMapStops(sampleTrip, arrival)
  assert.equal(stops[0]?.kind, 'hotel')
  assert.equal(stops[0]?.label, 'Hotel')
  assert.ok(stops.some((stop) => /walmart/i.test(stop.label)))
  const url = googleMapsDirUrl(stops)
  assert.match(url, /^https:\/\/www\.google\.com\/maps\/dir\/\?/)
  assert.match(url, /origin=/)
  assert.match(url, /8600/)
  assert.match(url, /travelmode=driving/)
}

{
  const outlets = sampleTrip.days.find((day) => day.date === '2026-12-01')
  assert.ok(outlets)
  const stops = buildDayMapStops(sampleTrip, outlets)
  assert.equal(stops[0]?.kind, 'hotel')
  assert.ok(stops.length >= 3)
  const plaza = stops.filter((stop) => /5295 international dr\b/i.test(stop.query))
  assert.equal(plaza.length, 1, 'same plaza should collapse into one pin')
  assert.match(plaza[0].label, /Ross/)
  assert.match(plaza[0].label, /Five Below/)
  assert.ok(googleMapsDirUrl(stops).includes('waypoints='))
}

{
  const millenia = sampleTrip.days.find((day) => day.date === '2026-12-08')
  assert.ok(millenia)
  const stops = buildDayMapStops(sampleTrip, millenia)
  assert.equal(stops[0]?.kind, 'hotel')
  assert.ok(stops.length >= 3)
  assert.ok(stops.length < 10, 'plaza stores should not each become a pin')
}

{
  assert.equal(
    stopKey('Ross I-Drive', '5295 International Dr, Suite 500, Orlando, FL 32819'),
    stopKey('Five Below', '5295 International Dr, Ste 660, Orlando, FL 32819'),
  )
  assert.match(mapsQuery('Target Millenia', '4750 Millenia Plaza Way, Orlando, FL 32839'), /4750/)
}

{
  const departure = sampleTrip.days.find((day) => day.date === '2026-12-13')
  assert.ok(departure)
  const stops = buildDayMapStops(sampleTrip, departure)
  assert.equal(stops[0]?.kind, 'hotel')
  assert.ok(stops.some((stop) => /miami|mia/i.test(stop.label)))
}

console.log('dayMap.test.ts ok')
