create table if not exists public.daily_entries (
  id text primary key,
  date date not null unique,
  diet jsonb not null default '[]'::jsonb,
  mood jsonb,
  sleep jsonb,
  period jsonb,
  exercise jsonb,
  gratitude text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.daily_entries enable row level security;

drop policy if exists "Allow public read daily entries" on public.daily_entries;
create policy "Allow public read daily entries"
on public.daily_entries
for select
to anon, authenticated
using (true);

drop policy if exists "Allow public insert daily entries" on public.daily_entries;
create policy "Allow public insert daily entries"
on public.daily_entries
for insert
to anon, authenticated
with check (true);

drop policy if exists "Allow public update daily entries" on public.daily_entries;
create policy "Allow public update daily entries"
on public.daily_entries
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Allow public delete daily entries" on public.daily_entries;
create policy "Allow public delete daily entries"
on public.daily_entries
for delete
to anon, authenticated
using (true);
