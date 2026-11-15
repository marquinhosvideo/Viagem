import assert from 'node:assert/strict'
import { normalizeTip, normalizeTips } from './tips.ts'

{
  const tips = normalizeTips([
    { tema: 'Cupons', texto: 'Cadastre no VIP Simon.' },
    { tema: 'Imposto', texto: 'Preço sem tax.' },
  ])
  assert.equal(tips.length, 2)
  assert.ok(tips[0].id.startsWith('tip-'))
  assert.equal(tips[0].tema, 'Cupons')
  assert.equal(tips[1].texto, 'Preço sem tax.')
}

{
  const tip = normalizeTip({
    id: 'tip-abc',
    tema: 'Ralph Lauren',
    texto: 'Cadastro dá 25% extra.',
    photoUrl: 'https://example.com/rl.jpg',
    link: 'https://example.com/store',
  })
  assert.ok(tip)
  assert.equal(tip.photoUrl, 'https://example.com/rl.jpg')
  assert.equal(tip.link, 'https://example.com/store')
}

{
  const tip = normalizeTip({
    tema: 'X',
    texto: 'Y',
    photoUrl: 'javascript:alert(1)',
    link: 'ftp://bad',
  })
  assert.ok(tip)
  assert.equal(tip.photoUrl, null)
  assert.equal(tip.link, null)
}
