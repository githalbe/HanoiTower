-- 하노이탑 랭킹 기록
create table public.scores (
  id         bigint generated always as identity primary key,
  name       text        not null check (char_length(btrim(name)) between 1 and 16),
  discs      smallint    not null check (discs between 3 and 8),
  moves      integer     not null,
  ms         integer     not null check (ms between 1 and 86400000),
  created_at timestamptz not null default now(),
  -- 최소 이동 횟수(2^n - 1)보다 적은 기록은 받지 않음
  constraint scores_moves_valid check (moves >= (1 << discs) - 1 and moves <= 100000)
);

create index scores_rank_idx on public.scores (discs, moves, ms, created_at);

alter table public.scores enable row level security;

-- 누구나 랭킹을 보고 기록을 추가할 수 있지만, 수정·삭제는 불가
create policy "scores are readable by everyone"
  on public.scores for select to anon, authenticated using (true);

create policy "anyone can add a score"
  on public.scores for insert to anon, authenticated with check (true);

revoke all on public.scores from anon, authenticated;
grant select, insert on public.scores to anon, authenticated;
