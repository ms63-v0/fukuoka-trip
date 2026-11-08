-- 후쿠오카 여행 노트 · 기기 간 동기화 (Supabase SQL Editor에 붙여넣고 Run)
--
-- 동작 방식
--   - 로그인 없이 "동기화 코드"(앱이 만드는 26자리 무작위 코드)로 내 데이터를 찾아요.
--   - 테이블에는 코드 자체가 아니라 SHA-256 해시만 저장해요.
--   - 공개 키(anon/publishable)로는 테이블을 직접 읽거나 쓸 수 없고,
--     아래 두 함수(trip_pull, trip_push)만 호출할 수 있어요. 함수는 코드가 맞는 행만 다뤄요.
--   - version 으로 동시 수정 충돌을 감지해요 (다른 기기가 먼저 저장했으면 저장을 거절).

create table if not exists public.trip_sync (
  code_hash  text primary key,
  data       jsonb       not null,
  version    bigint      not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.trip_sync enable row level security;
-- 정책을 하나도 만들지 않아서 anon/authenticated 역할은 테이블에 직접 접근할 수 없어요.
revoke all on table public.trip_sync from anon, authenticated;

create or replace function public.trip_pull(p_code text)
returns table (out_data jsonb, out_version bigint, out_updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select t.data, t.version, t.updated_at
  from public.trip_sync t
  where length(p_code) >= 20
    and t.code_hash = encode(sha256(convert_to(p_code, 'UTF8')), 'hex');
$$;

create or replace function public.trip_push(p_code text, p_data jsonb, p_base_version bigint)
returns table (out_ok boolean, out_version bigint, out_updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  h   text := encode(sha256(convert_to(p_code, 'UTF8')), 'hex');
  cur bigint;
  ts  timestamptz;
begin
  if p_code is null or length(p_code) < 20 then
    raise exception 'sync code too short';
  end if;
  if pg_column_size(p_data) > 8000000 then
    raise exception 'data too large';
  end if;

  select t.version, t.updated_at into cur, ts
  from public.trip_sync t
  where t.code_hash = h
  for update;

  if not found then
    insert into public.trip_sync (code_hash, data, version, updated_at)
    values (h, p_data, 1, now());
    return query select true, 1::bigint, now();
  elsif p_base_version is null or p_base_version = cur then
    -- p_base_version 이 null 이면 "이 기기 내용으로 덮어쓰기"
    update public.trip_sync
    set data = p_data, version = cur + 1, updated_at = now()
    where code_hash = h;
    return query select true, cur + 1, now();
  else
    return query select false, cur, ts;
  end if;
end;
$$;

revoke all on function public.trip_pull(text) from public;
revoke all on function public.trip_push(text, jsonb, bigint) from public;
grant execute on function public.trip_pull(text) to anon, authenticated;
grant execute on function public.trip_push(text, jsonb, bigint) to anon, authenticated;
