-- Modelo canônico do roteiro Orlando 2026 (viagem / local / dia / parada).
-- Rode no SQL Editor do Supabase. Idempotente.
-- O app continua sincronizando o JSON em trip_document; estas tabelas
-- documentam o schema e permitem consultas/relatórios normalizados.

do $$ begin
  create type public.categoria_local as enum (
    'hotel',
    'alimentacao',
    'compras',
    'lazer',
    'transporte'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.status_parada as enum ('fixo', 'opcional');
exception when duplicate_object then null;
end $$;

create table if not exists public.viagem (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  destino text,
  data_inicio date not null,
  data_fim date not null
);

create table if not exists public.local (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  endereco text,
  categoria public.categoria_local not null,
  lat double precision,
  lng double precision
);

create table if not exists public.dia (
  id uuid primary key default gen_random_uuid(),
  viagem_id uuid not null references public.viagem(id) on delete cascade,
  data date not null unique,
  dia_semana text not null,
  tipo_do_dia text,
  carro_a_partir_do_hotel text,
  crianca text,
  observacoes text
);

create table if not exists public.parada (
  id uuid primary key default gen_random_uuid(),
  seq integer not null unique,
  dia_id uuid not null references public.dia(id) on delete cascade,
  ordem_no_dia integer not null,
  local_id uuid not null references public.local(id),
  status public.status_parada not null default 'fixo',
  observacao text,
  unique (dia_id, ordem_no_dia)
);

create index if not exists dia_viagem_id_idx on public.dia (viagem_id);
create index if not exists parada_dia_id_idx on public.parada (dia_id);
create index if not exists parada_local_id_idx on public.parada (local_id);
create index if not exists local_categoria_idx on public.local (categoria);

alter table public.viagem enable row level security;
alter table public.local enable row level security;
alter table public.dia enable row level security;
alter table public.parada enable row level security;

drop policy if exists "viagem_select_auth" on public.viagem;
drop policy if exists "viagem_write_auth" on public.viagem;
drop policy if exists "local_select_auth" on public.local;
drop policy if exists "local_write_auth" on public.local;
drop policy if exists "dia_select_auth" on public.dia;
drop policy if exists "dia_write_auth" on public.dia;
drop policy if exists "parada_select_auth" on public.parada;
drop policy if exists "parada_write_auth" on public.parada;

create policy "viagem_select_auth" on public.viagem
  for select to authenticated using (true);
create policy "viagem_write_auth" on public.viagem
  for all to authenticated using (true) with check (true);

create policy "local_select_auth" on public.local
  for select to authenticated using (true);
create policy "local_write_auth" on public.local
  for all to authenticated using (true) with check (true);

create policy "dia_select_auth" on public.dia
  for select to authenticated using (true);
create policy "dia_write_auth" on public.dia
  for all to authenticated using (true) with check (true);

create policy "parada_select_auth" on public.parada
  for select to authenticated using (true);
create policy "parada_write_auth" on public.parada
  for all to authenticated using (true) with check (true);
