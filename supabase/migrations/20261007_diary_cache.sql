-- Private snapshot of this shop's publicly visible Estama diary. No auth or shift changes.
begin;
create table if not exists public.platinum_diary_cache (
 store_id uuid primary key,
 entries jsonb not null check(jsonb_typeof(entries)='array'),
 updated_at timestamptz not null
);
alter table public.platinum_diary_cache enable row level security;
revoke all on public.platinum_diary_cache from public,anon,authenticated;
grant select,insert,update on public.platinum_diary_cache to service_role;
create or replace function public.platinum_write_diary_cache(p_attempted timestamptz,p_entries jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_attempted is null or p_attempted>now()+interval '1 minute'
 or jsonb_typeof(p_entries) is distinct from 'array' or octet_length(p_entries::text)>3000000 then
 raise exception 'Invalid diary snapshot'; end if;
 insert into public.platinum_diary_cache(store_id,entries,updated_at)
 values('33333333-0000-0000-0000-000000000003',p_entries,p_attempted)
 on conflict(store_id) do update set entries=excluded.entries,updated_at=excluded.updated_at
 where platinum_diary_cache.updated_at<excluded.updated_at;
end;
$$;
revoke all on function public.platinum_write_diary_cache(timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.platinum_write_diary_cache(timestamptz,jsonb) to service_role;
commit;
