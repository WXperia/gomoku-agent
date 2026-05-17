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
  auth_user_id uuid,
  browser_fingerprint text,
  created_at   timestamptz not null default now()
);

alter table public.users add column if not exists auth_user_id uuid;
alter table public.users add column if not exists browser_fingerprint text;
create index if not exists users_auth_user_id_idx on public.users (auth_user_id);
create index if not exists users_browser_fingerprint_idx on public.users (browser_fingerprint);

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

-- Games table (one row per game, created when the match starts)
create table if not exists public.games (
  id          bigint primary key generated always as identity,
  user_id     uuid references public.users(id) on delete set null,
  auth_user_id uuid,
  model_id    text not null,
  game_kind   text not null default 'gomoku',
  status      text not null default 'playing',
  result      text,
  move_count  integer not null default 0,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  duration_ms integer,
  played_at   timestamptz not null default now()
);

alter table public.games add column if not exists status text not null default 'playing';
alter table public.games add column if not exists auth_user_id uuid;
alter table public.games add column if not exists game_kind text not null default 'gomoku';
alter table public.games add column if not exists started_at timestamptz not null default now();
alter table public.games add column if not exists ended_at timestamptz;
alter table public.games add column if not exists duration_ms integer;
alter table public.games alter column result drop not null;
alter table public.games drop constraint if exists games_result_check;
alter table public.games drop constraint if exists games_status_check;
alter table public.games drop constraint if exists games_game_kind_check;
alter table public.games add constraint games_result_check check (result is null or result in ('won','lost','draw'));
alter table public.games add constraint games_status_check check (status in ('playing','finished'));
alter table public.games add constraint games_game_kind_check check (game_kind in ('gomoku','xiangqi'));
update public.games
set status = case when result is null then 'playing' else 'finished' end
where status is null or status = 'playing';
create index if not exists games_auth_user_id_idx on public.games (auth_user_id);

-- Move log table (one row per move)
create table if not exists public.game_moves (
  id             bigint primary key generated always as identity,
  game_id        bigint not null references public.games(id) on delete cascade,
  move_number    integer not null,
  player         integer not null check (player in (1, 2)),
  from_x         integer check (from_x is null or from_x between 0 and 14),
  from_y         integer check (from_y is null or from_y between 0 and 14),
  x              integer not null check (x between 0 and 14),
  y              integer not null check (y between 0 and 14),
  piece          text,
  captured       text,
  duration_ms    integer not null default 0,
  board_snapshot jsonb,
  ai_reasoning   text,
  ai_taunt       text,
  ai_confidence  text check (ai_confidence is null or ai_confidence in ('high','medium','low')),
  thinking_steps jsonb,
  created_at     timestamptz not null default now(),
  unique (game_id, move_number)
);

alter table public.game_moves add column if not exists from_x integer;
alter table public.game_moves add column if not exists from_y integer;
alter table public.game_moves add column if not exists piece text;
alter table public.game_moves add column if not exists captured text;
alter table public.game_moves add column if not exists board_snapshot jsonb;
alter table public.game_moves add column if not exists ai_reasoning text;
alter table public.game_moves add column if not exists ai_taunt text;
alter table public.game_moves add column if not exists ai_confidence text;
alter table public.game_moves add column if not exists thinking_steps jsonb;
alter table public.game_moves drop constraint if exists game_moves_from_x_check;
alter table public.game_moves drop constraint if exists game_moves_from_y_check;
alter table public.game_moves drop constraint if exists game_moves_ai_confidence_check;
alter table public.game_moves add constraint game_moves_from_x_check check (from_x is null or from_x between 0 and 14);
alter table public.game_moves add constraint game_moves_from_y_check check (from_y is null or from_y between 0 and 14);
alter table public.game_moves add constraint game_moves_ai_confidence_check check (ai_confidence is null or ai_confidence in ('high','medium','low'));
notify pgrst, 'reload schema';

-- ── Row Level Security ──────────────────────────────────────
-- Allow anon to read leaderboard data
alter table public.users    enable row level security;
alter table public.ai_stats enable row level security;
alter table public.games    enable row level security;
alter table public.game_moves enable row level security;

drop policy if exists "public read users" on public.users;
create policy "public read users"
  on public.users for select to anon, authenticated using (true);

drop policy if exists "public read ai_stats" on public.ai_stats;
create policy "public read ai_stats"
  on public.ai_stats for select to anon, authenticated using (true);

drop policy if exists "public read games" on public.games;
create policy "public read games"
  on public.games for select to anon, authenticated using (true);

drop policy if exists "public read game_moves" on public.game_moves;
create policy "public read game_moves"
  on public.game_moves for select to anon, authenticated using (true);

-- Allow anon to insert/update their own user row
drop policy if exists "insert own user" on public.users;
create policy "insert own user"
  on public.users for insert to anon, authenticated with check (true);

drop policy if exists "update own user" on public.users;
create policy "update own user"
  on public.users for update to anon, authenticated using (true);

-- Allow anon to insert games and update ai_stats
drop policy if exists "insert games" on public.games;
create policy "insert games"
  on public.games for insert to anon, authenticated with check (true);

drop policy if exists "update games" on public.games;
create policy "update games"
  on public.games for update to anon, authenticated using (true);

drop policy if exists "insert game_moves" on public.game_moves;
create policy "insert game_moves"
  on public.game_moves for insert to anon, authenticated with check (true);

drop policy if exists "upsert ai_stats" on public.ai_stats;
create policy "upsert ai_stats"
  on public.ai_stats for update to anon, authenticated using (true);
