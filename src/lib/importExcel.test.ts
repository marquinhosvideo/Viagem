import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sampleTrip } from '../data/sampleTrip'
import { buildExportSheets, importTripFromFile } from './importExcel'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const excelPath = join(root, 'scripts/Orlando-2026_revisado.xlsx')

{
  const expected = {
    '2026-11-27': 1,
    '2026-11-28': 3,
    '2026-11-29': 4,
    '2026-11-30': 3,
    '2026-12-01': 7,
    '2026-12-02': 3,
    '2026-12-03': 3,
    '2026-12-04': 5,
    '2026-12-05': 7,
    '2026-12-06': 3,
    '2026-12-07': 6,
    '2026-12-08': 9,
    '2026-12-09': 3,
    '2026-12-10': 3,
    '2026-12-11': 7,
    '2026-12-12': 9,
    '2026-12-13': 2,
    '2026-12-14': 1,
  }

  assert.equal(sampleTrip.days.length, 18)
  assert.equal(sampleTrip.places.length, 46)
  const stops = sampleTrip.days.flatMap((day) => day.stops)
  assert.equal(stops.length, 79)
  assert.deepEqual(
    stops.map((stop) => stop.seq),
    Array.from({ length: 79 }, (_, i) => i + 1),
  )
  for (const day of sampleTrip.days) {
    assert.equal(day.stops.length, expected[day.date as keyof typeof expected])
    assert.deepEqual(
      day.stops.map((stop) => stop.orderInDay),
      Array.from({ length: day.stops.length }, (_, i) => i + 1),
    )
  }

  const byCat = Object.fromEntries(
    ['hotel', 'compras', 'lazer', 'transporte', 'alimentacao'].map((cat) => [
      cat,
      stops.filter(
        (stop) =>
          sampleTrip.places.find((place) => place.id === stop.placeId)?.category === cat,
      ).length,
    ]),
  )
  assert.deepEqual(byCat, {
    hotel: 30,
    compras: 31,
    lazer: 13,
    transporte: 4,
    alimentacao: 1,
  })
  assert.equal(stops.filter((stop) => stop.status === 'opcional').length, 11)
  assert.equal(sampleTrip.places.filter((place) => !place.address).length, 7)
}

{
  const blob = new Blob([readFileSync(excelPath)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const file = new File([blob], 'Orlando-2026_revisado.xlsx')
  const first = await importTripFromFile(file, sampleTrip)
  const second = await importTripFromFile(file, first.trip)

  assert.equal(first.stats.days, 18)
  assert.equal(first.stats.stops, 79)
  assert.equal(first.stats.places, 46)
  assert.equal(first.stats.optionalStops, 11)
  assert.equal(second.stats.stops, 79)
  assert.equal(second.stats.places, 46)
  assert.ok(first.warnings.some((warning) => /Ulta I-Drive/i.test(warning)))

  const sheets = buildExportSheets(first.trip)
  assert.ok(sheets['Roteiro completo'])
  assert.equal(sheets['Roteiro completo'][0]?.[0], 'Seq')
  assert.ok(!sheets['Roteiro completo'][0]?.includes('Manhã'))
  assert.ok(!sheets['Roteiro completo'][0]?.includes('Tarde'))
  assert.ok(!sheets['Roteiro completo'][0]?.includes('Noite'))
  assert.equal(sheets.Dias?.length, 19)
}

console.log('importExcel.test.ts ok')
