-- 랭킹에는 Player(이름)마다, 원반 수마다 가장 좋은 기록 하나만 남긴다.
-- 좋은 기록: 이동이 적을수록, 같으면 시간이 짧을수록, 그것도 같으면 먼저 낸 것

-- 1) 이미 쌓인 중복 정리. 앞뒤 공백만 다른 이름도 같은 사람으로 본다
delete from public.scores s
using (
  select id,
         row_number() over (partition by discs, btrim(name) order by moves, ms, created_at, id) as rn
  from public.scores
) d
where s.id = d.id
  and d.rn > 1;

update public.scores set name = btrim(name) where name <> btrim(name);

-- 2) 같은 이름·원반 수로는 한 줄만
create unique index scores_discs_name_key on public.scores (discs, name);

-- 3) 기록은 이 함수로만 올린다. 처음이면 넣고, 더 좋으면 바꾸고, 아니면 그대로 둔다
create or replace function public.submit_score(p_name text, p_discs integer, p_moves integer, p_ms integer)
returns table (score_id bigint, outcome text, best_moves integer, best_ms integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(p_name);
  v_row public.scores%rowtype;
begin
  select * into v_row
  from public.scores s
  where s.discs = p_discs and s.name = v_name
  for update;

  if not found then
    insert into public.scores (name, discs, moves, ms)
    values (v_name, p_discs, p_moves, p_ms)
    returning * into v_row;
    return query select v_row.id, 'new'::text, v_row.moves, v_row.ms;
  elsif p_moves < v_row.moves or (p_moves = v_row.moves and p_ms < v_row.ms) then
    update public.scores s
    set moves = p_moves, ms = p_ms, created_at = now()
    where s.id = v_row.id
    returning * into v_row;
    return query select v_row.id, 'better'::text, v_row.moves, v_row.ms;
  else
    return query select v_row.id, 'kept'::text, v_row.moves, v_row.ms;
  end if;
end;
$$;

revoke all on function public.submit_score(text, integer, integer, integer) from public;
grant execute on function public.submit_score(text, integer, integer, integer) to anon, authenticated;

-- 4) 표에 바로 넣는 길은 닫는다. 함수를 거치지 않으면 중복이 다시 생길 수 있다
drop policy if exists "anyone can add a score" on public.scores;
revoke insert on public.scores from anon, authenticated;
