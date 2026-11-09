# Roteiro — Orlando 2026

App web mobile-first para a viagem em família a Orlando: lista ordenada de paradas por dia, checks, gastos por orçamento e sync na nuvem.

## Modelo

Cada dia tem paradas ordenadas; cada parada aponta para um **local** único (com categoria: hotel, alimentação, compras, lazer, transporte). Não há mais campos Manhã / Tarde / Noite.

Fonte da verdade: planilha revisada (`scripts/Orlando-2026_revisado.xlsx`). Schema SQL de referência: `supabase/roteiro_paradas.sql`.

## Como usar

```bash
npm install
cp .env.example .env   # opcional: ligar sync compartilhado
npm run dev
```

### Sync da família (recomendado)

Sem `.env`, o app funciona **só neste aparelho**.  
Com Supabase configurado, checks e gastos ficam no banco com login — qualquer um da família no site vê a mesma atualização em tempo real.

Passo a passo: **[SYNC.md](./SYNC.md)** (também compara Excel/OneDrive vs Supabase).

### Abas

- **Hoje** — dia ativo + widgets de orçamento
- **Roteiro** — todos os dias com paradas e checks
- **Gastos** — Marcos / Dielen / Helena / Alimentação / Outros
- **Locais** — catálogo único por categoria
- **Parques** — filas ao vivo
- **Excel** — baixar/reimportar o roteiro (formato Seq / Ordem no dia / Local / Status)

### Orçamentos (topo)

Teto provisório **R$ 5.000** cada — depois ajustamos os valores reais.

### Moeda

Notas e lançamentos entram em **US$** e são convertidos para **R$** com taxa fixa **R$ 5,15**. Em toda a interface o valor aparece em reais e, ao lado, o equivalente em dólar.

## Scripts

- `npm run dev` — desenvolvimento
- `npm run build` — build de produção
- `npm run preview` — preview do build
