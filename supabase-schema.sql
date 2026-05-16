-- ============================================================
-- Gomoku AI Battle — Supabase schema
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- Users table (one row per player, keyed by their UUID in localStorage)
create table if not exists public.users (
  id           uuid primary key default gen_random_uuid(),
  nickname     text not null,
  email        text,
  country      text not null default '',
  country_code text not null default '',
  flag         text not null default '',
  total_moves  integer not null default 0,
  games_played integer not null default 0,
  wins         integer not null default 0,
  created_at   timestamptz not null default now()
);

-- AI model stats table (one row per model id)
create table if not exists public.ai_stats (
  model_id text primary key,
  wins     integer not null default 0,
  games    integer not null default 0
);

-- Pre-populate with all model IDs so upsert works cleanly
insert into public.ai_stats (model_id) values
  ('gpt55'), ('gpt4o'), ('claude-opus'), ('claude-sonnet'),
  ('deepseek-pro'), ('deepseek-flash'), ('minimax'), ('local')
on conflict do nothing;

-- Games table (one row per finished game)
create table if not exists public.games (
  id          bigint primary key generated always as identity,
  user_id     uuid references public.users(id) on delete set null,
  model_id    text not null,
  result      text not null check (result in ('won','lost','draw')),
  move_count  integer not null default 0,
  played_at   timestamptz not null default now()
);

-- ── Row Level Security ──────────────────────────────────────
-- Allow anon to read leaderboard data
alter table public.users    enable row level security;
alter table public.ai_stats enable row level security;
alter table public.games    enable row level security;

create policy "public read users"
  on public.users for select to anon using (true);

create policy "public read ai_stats"
  on public.ai_stats for select to anon using (true);

create policy "public read games"
  on public.games for select to anon using (true);

-- Allow anon to insert/update their own user row
create policy "insert own user"
  on public.users for insert to anon with check (true);

create policy "update own user"
  on public.users for update to anon using (true);

-- Allow anon to insert games and update ai_stats
create policy "insert games"
  on public.games for insert to anon with check (true);

create policy "upsert ai_stats"
  on public.ai_stats for update to anon using (true);
