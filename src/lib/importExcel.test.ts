import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { EXTRA_CHAIN_STORES } from '../data/chainStores'
import { sampleTrip } from '../data/sampleTrip'
import { buildExportSheets, importTripFromFile } from './importExcel'

{
  const sheets = buildExportSheets(sampleTrip)
  assert.ok(sheets['Roteiro completo']?.length === sampleTrip.days.length + 1)
  assert.deepEqual(sheets.Locais[0], ['Categoria', 'Nome / Local', 'Endereço'])
  assert.deepEqual(sheets.Gastos[0], ['Data', 'Descrição', 'Valor', 'Orçamento'])
  assert.deepEqual(sheets['Dicas e ressalvas'][0], ['Tema', 'Dica / ressalva'])
  assert.equal(sheets.Viagem[1][0], sampleTrip.name)

  const names = sheets.Locais.slice(1).map((row) => String(row[1]))
  for (const expected of [
    'Walmart Supercenter Turkey Lake',
    'Target Sand Lake',
    'Ross Florida Mall',
    'Ross Vineland',
    'Best Buy Kissimmee',
    'Burlington W Colonial',
    'T.J. Maxx Rolling Oaks',
    'Five Below Millenia',
    'Ulta Florida Mall',
  ]) {
    assert.ok(
      names.some((name) => name === expected || name.includes(expected)),
      `export Locais missing ${expected}: ${names.filter((name) => name.startsWith(expected.split(' ')[0])).join(', ')}`,
    )
  }

  const addresses = sheets.Locais.slice(1).map((row) => String(row[2]))
  for (const extra of EXTRA_CHAIN_STORES) {
    const street = extra.address.split(',')[0]
    assert.ok(
      addresses.some((address) => address.includes(street)),
      `export Locais missing extra ${extra.name} (${street})`,
    )
  }
}

{
  const wb = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries(buildExportSheets(sampleTrip))) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name.slice(0, 31))
  }
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array
  const file = new File([bytes], 'Orlando-2026.xlsx')
  const result = await importTripFromFile(file, sampleTrip)
  assert.ok(result.stats.days >= sampleTrip.days.length)
  assert.ok(result.stats.locations >= EXTRA_CHAIN_STORES.length)
  const names = (result.trip.locations ?? []).map((place) => place.name)
  assert.ok(names.some((name) => /Ross Florida Mall/.test(name)))
  assert.ok(names.some((name) => /Five Below Millenia/.test(name)))
  assert.ok(names.some((name) => /T\.J\. Maxx I-Drive/.test(name)))
}

console.log('importExcel.test.ts ok')
