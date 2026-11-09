-- Roteiro Orlando — rode isto no SQL Editor do Supabase (uma vez)
-- Schema normalizado (viagem/local/dia/parada): supabase/roteiro_paradas.sql
-- O app sincroniza o JSON do roteiro em trip_document; checks usam id da parada.

create table if not exists public.activity_checks (
  activity_id text primary key,
  done boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id text primary key,
  day_id text not null,
  budget_id text not null,
  description text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists expenses_day_id_idx on public.expenses (day_id);
create index if not exists expenses_budget_id_idx on public.expenses (budget_id);

-- Roteiro atual compartilhado entre dispositivos + histórico (até 5 versões)
create table if not exists public.trip_document (
  id text primary key default 'current' check (id = 'current'),
  trip jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_versions (
  id text primary key,
  created_at timestamptz not null default now(),
  reason text not null check (reason in ('import', 'reset', 'manual')),
  file_name text,
  label text not null,
  days_count integer not null default 0,
  activities_count integer not null default 0,
  tips_count integer not null default 0,
  expenses_count integer not null default 0,
  trip jsonb not null
);

create index if not exists trip_versions_created_at_idx
  on public.trip_versions (created_at desc);

alter table public.activity_checks enable row level security;
alter table public.expenses enable row level security;
alter table public.trip_document enable row level security;
alter table public.trip_versions enable row level security;

-- Qualquer pessoa logada na família lê e escreve (contas compartilhadas ou individuais)
drop policy if exists "checks_select_auth" on public.activity_checks;
drop policy if exists "checks_write_auth" on public.activity_checks;
drop policy if exists "expenses_select_auth" on public.expenses;
drop policy if exists "expenses_write_auth" on public.expenses;
drop policy if exists "trip_document_select_auth" on public.trip_document;
drop policy if exists "trip_document_write_auth" on public.trip_document;
drop policy if exists "trip_versions_select_auth" on public.trip_versions;
drop policy if exists "trip_versions_write_auth" on public.trip_versions;

create policy "checks_select_auth" on public.activity_checks
  for select to authenticated using (true);

create policy "checks_write_auth" on public.activity_checks
  for all to authenticated using (true) with check (true);

create policy "expenses_select_auth" on public.expenses
  for select to authenticated using (true);

create policy "expenses_write_auth" on public.expenses
  for all to authenticated using (true) with check (true);

create policy "trip_document_select_auth" on public.trip_document
  for select to authenticated using (true);

create policy "trip_document_write_auth" on public.trip_document
  for all to authenticated using (true) with check (true);

create policy "trip_versions_select_auth" on public.trip_versions
  for select to authenticated using (true);

create policy "trip_versions_write_auth" on public.trip_versions
  for all to authenticated using (true) with check (true);

-- Realtime (ignore erro se a tabela já estiver na publication)
do $$
begin
  begin
    alter publication supabase_realtime add table public.activity_checks;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.expenses;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.trip_document;
  exception when duplicate_object then null;
  end;
end $$;
