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
  assert.match(hotelOf(sampleTrip).address, /10330 Turkey Lake Road/)
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
  assert.match(url, /10330/)
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
  assert.match(plaza[0].label, /\+2|Five Below|Ulta/)
  assert.ok(googleMapsDirUrl(stops).includes('waypoints='))
}

{
  const millenia = sampleTrip.days.find((day) => day.date === '2026-12-08')
  assert.ok(millenia)
  const stops = buildDayMapStops(sampleTrip, millenia)
  assert.equal(stops[0]?.kind, 'hotel')
  assert.ok(stops.length >= 3)
  assert.ok(stops.length < 10, 'plaza stores should not each become a pin')
  // Best Buy Millenia is optional — must not enter the main route
  assert.ok(!stops.some((stop) => /best buy/i.test(stop.label)))
}

{
  assert.equal(
    stopKey('Ross I-Drive', '5295 International Dr, Orlando, FL 32819'),
    stopKey('Five Below I-Drive', '5295 International Dr, Ste 660, Orlando, FL 32819'),
  )
  assert.match(mapsQuery('Hotel', DEFAULT_HOTEL.address), /10330 Turkey Lake Road/)
}

console.log('dayMap.test.ts ok')
