import assert from 'node:assert/strict'
import { sampleTrip } from '../data/sampleTrip'
import { dayPlaces } from './dayMeta'
import {
  buildDayMapStops,
  coordsForStop,
  DEFAULT_HOTEL,
  googleMapsDirUrl,
  hotelOf,
  mapsQuery,
  spreadOverlappingCoords,
  stopKey,
} from './dayMap'

{
  assert.equal(hotelOf({}).address, DEFAULT_HOTEL.address)
  assert.match(hotelOf(sampleTrip).address, /10330 Turkey Lake Road/)
}

function assertMapMatchesFooter(date: string) {
  const day = sampleTrip.days.find((item) => item.date === date)
  assert.ok(day, date)
  const stops = buildDayMapStops(sampleTrip, day)
  const footer = dayPlaces(sampleTrip, day)
  assert.equal(stops.length, footer.length, `${date}: map vs footer length`)
  assert.deepEqual(
    stops.map((stop) => stop.label),
    footer.map((place) => place.name),
    `${date}: map labels must match footer sequence`,
  )
  assert.deepEqual(
    stops.map((stop) => stop.orderInDay),
    footer.map((_, index) => index + 1),
  )
}

{
  // Todos os dias: mapa = sequência do rodapé de endereços
  for (const day of sampleTrip.days) {
    assertMapMatchesFooter(day.date)
  }
}

{
  const gig = sampleTrip.days.find((day) => day.date === '2026-11-27')
  assert.ok(gig)
  const stops = buildDayMapStops(sampleTrip, gig)
  assert.equal(stops.length, 1)
  assert.match(stops[0].label, /Galeão|GIG/i)
}

{
  const arrival = sampleTrip.days.find((day) => day.date === '2026-11-28')
  assert.ok(arrival)
  const stops = buildDayMapStops(sampleTrip, arrival)
  assert.deepEqual(
    stops.map((stop) => stop.label),
    ['Miami International Airport (MIA)', 'Hotel', 'Walmart Supercenter Kirkman'],
  )
  const url = googleMapsDirUrl(stops)
  assert.match(url, /^https:\/\/www\.google\.com\/maps\/dir\/\?/)
  assert.match(url, /origin=/)
  assert.match(url, /travelmode=driving/)
}

{
  const outlets = sampleTrip.days.find((day) => day.date === '2026-12-01')
  assert.ok(outlets)
  const stops = buildDayMapStops(sampleTrip, outlets)
  // Não colapsar lojas do mesmo prédio — uma parada = um ponto
  assert.equal(stops.filter((stop) => /5295 international/i.test(stop.query)).length, 4)
  assert.ok(stops.some((stop) => stop.label === 'Ross I-Drive'))
  assert.ok(stops.some((stop) => stop.label === 'Five Below I-Drive'))
  assert.ok(stops.some((stop) => stop.label === 'Ulta I-Drive'))
  assert.equal(stops[0].label, 'Hotel')
  assert.equal(stops.at(-1)?.label, 'Hotel')
}

{
  const millenia = sampleTrip.days.find((day) => day.date === '2026-12-08')
  assert.ok(millenia)
  const stops = buildDayMapStops(sampleTrip, millenia)
  // Opcionais do rodapé entram no mapa, na mesma ordem
  assert.ok(stops.some((stop) => /best buy/i.test(stop.label) && stop.optional))
  assert.equal(stops.length, millenia.stops.length)
}

{
  assert.equal(
    stopKey('Ross I-Drive', '5295 International Dr, Orlando, FL 32819'),
    stopKey('Five Below I-Drive', '5295 International Dr, Ste 660, Orlando, FL 32819'),
  )
  assert.match(mapsQuery('Hotel', DEFAULT_HOTEL.address), /10330 Turkey Lake Road/)
}

{
  const outlets = sampleTrip.days.find((day) => day.date === '2026-12-01')
  assert.ok(outlets)
  const stops = buildDayMapStops(sampleTrip, outlets)
  const resolved = stops.flatMap((stop) => {
    const point = coordsForStop(stop)
    return point ? [{ id: stop.id, point }] : []
  })
  assert.ok(resolved.length >= 6, 'most Dec 1 stops should resolve coords')
  const spread = spreadOverlappingCoords(resolved)
  const unique = new Set(
    Object.values(spread).map((point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`),
  )
  assert.equal(unique.size, resolved.length, 'overlapping plaza pins must be spread apart')
  assert.equal(Object.keys(spread).length, resolved.length)
}

console.log('dayMap.test.ts ok')
