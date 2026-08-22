create table if not exists public.ranking_players (
  id uuid primary key default gen_random_uuid(),
  device_key_hash text not null unique,
  nickname text not null check (char_length(nickname) between 2 and 16),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.solo_daily_scores (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.ranking_players(id) on delete cascade,
  played_on date not null,
  best_score integer not null check (best_score between 0 and 1000),
  difference_ms integer not null check (difference_ms >= 0),
  target_ms integer not null check (target_ms between 3000 and 10000),
  elapsed_ms integer not null check (elapsed_ms >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, played_on)
);

create index if not exists solo_daily_scores_day_rank_idx
  on public.solo_daily_scores (played_on, best_score desc, difference_ms asc);

create index if not exists solo_daily_scores_player_day_idx
  on public.solo_daily_scores (player_id, played_on desc);

create or replace function public.submit_solo_daily_best(
  p_device_key_hash text,
  p_nickname text,
  p_played_on date,
  p_score integer,
  p_difference_ms integer,
  p_target_ms integer,
  p_elapsed_ms integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player_id uuid;
begin
  if char_length(trim(p_nickname)) not between 2 and 16 then
    raise exception 'invalid nickname';
  end if;
  if p_score not between 0 and 1000 or p_difference_ms < 0 then
    raise exception 'invalid score';
  end if;

  insert into public.ranking_players (device_key_hash, nickname)
  values (p_device_key_hash, trim(p_nickname))
  on conflict (device_key_hash) do update
    set nickname = excluded.nickname, updated_at = now()
  returning id into v_player_id;

  insert into public.solo_daily_scores (
    player_id,
    played_on,
    best_score,
    difference_ms,
    target_ms,
    elapsed_ms
  )
  values (
    v_player_id,
    p_played_on,
    p_score,
    p_difference_ms,
    p_target_ms,
    p_elapsed_ms
  )
  on conflict (player_id, played_on) do update
    set best_score = excluded.best_score,
        difference_ms = excluded.difference_ms,
        target_ms = excluded.target_ms,
        elapsed_ms = excluded.elapsed_ms,
        updated_at = now()
  where excluded.best_score > public.solo_daily_scores.best_score
     or (
       excluded.best_score = public.solo_daily_scores.best_score
       and excluded.difference_ms < public.solo_daily_scores.difference_ms
     );

  return v_player_id;
end;
$$;

revoke all on function public.submit_solo_daily_best(
  text, text, date, integer, integer, integer, integer
) from public;

create or replace view public.ranking_daily
with (security_invoker = true)
as
select
  s.played_on as period_start,
  p.id as player_id,
  p.nickname,
  s.best_score as total_score,
  s.difference_ms as best_difference_ms,
  1::bigint as days_played,
  dense_rank() over (
    partition by s.played_on
    order by s.best_score desc, s.difference_ms asc
  ) as position
from public.solo_daily_scores s
join public.ranking_players p on p.id = s.player_id;

create or replace view public.ranking_weekly
with (security_invoker = true)
as
select
  date_trunc('week', s.played_on::timestamp)::date as period_start,
  p.id as player_id,
  p.nickname,
  sum(s.best_score)::bigint as total_score,
  min(s.difference_ms) as best_difference_ms,
  count(*)::bigint as days_played,
  dense_rank() over (
    partition by date_trunc('week', s.played_on::timestamp)::date
    order by sum(s.best_score) desc, min(s.difference_ms) asc
  ) as position
from public.solo_daily_scores s
join public.ranking_players p on p.id = s.player_id
group by period_start, p.id, p.nickname;

create or replace view public.ranking_monthly
with (security_invoker = true)
as
select
  date_trunc('month', s.played_on::timestamp)::date as period_start,
  p.id as player_id,
  p.nickname,
  sum(s.best_score)::bigint as total_score,
  min(s.difference_ms) as best_difference_ms,
  count(*)::bigint as days_played,
  dense_rank() over (
    partition by date_trunc('month', s.played_on::timestamp)::date
    order by sum(s.best_score) desc, min(s.difference_ms) asc
  ) as position
from public.solo_daily_scores s
join public.ranking_players p on p.id = s.player_id
group by period_start, p.id, p.nickname;
