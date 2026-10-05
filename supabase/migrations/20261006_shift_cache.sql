-- Server-only durable public shift snapshot for Vercel Cron.
begin;
create table if not exists public.platinum_shift_cache (
  store_id uuid primary key check(store_id='33333333-0000-0000-0000-000000000003'::uuid),
  from_date date not null,
  to_date date not null,
  attempted_at timestamptz not null,
  shifts jsonb not null default '[]'::jsonb,
  failed boolean not null default true
);
alter table public.platinum_shift_cache enable row level security;
revoke all on public.platinum_shift_cache from public,anon,authenticated;
grant select on public.platinum_shift_cache to service_role;

create or replace function public.platinum_write_shift_cache(p_from date,p_to date,p_attempted timestamptz,p_rows jsonb,p_error boolean)
returns void language plpgsql security definer set search_path='' as $$
declare safe_rows jsonb;
begin
  if p_from is null or p_to is null or p_attempted is null or p_error is null
    or p_to<p_from or p_to-p_from>30 or jsonb_typeof(p_rows) is distinct from 'array'
    or octet_length(p_rows::text)>2000000 then raise exception 'Invalid snapshot'; end if;
  -- Rebuild the allowlist in the database as well; never retain arbitrary extra fields.
  select coalesce(jsonb_agg(jsonb_build_object('date',r->'date','therapist_id',r->'therapist_id',
    'therapist_name',r->'therapist_name','start_time',r->'start_time','end_time',r->'end_time')),'[]'::jsonb)
    into safe_rows from jsonb_array_elements(p_rows) r;
  insert into public.platinum_shift_cache(store_id,from_date,to_date,attempted_at,shifts,failed)
    values('33333333-0000-0000-0000-000000000003',p_from,p_to,p_attempted,case when p_error then '[]'::jsonb else safe_rows end,p_error)
    on conflict(store_id) do update set from_date=excluded.from_date,to_date=excluded.to_date,
      attempted_at=excluded.attempted_at,shifts=excluded.shifts,failed=excluded.failed
    where excluded.attempted_at>=platinum_shift_cache.attempted_at;
end;
$$;
revoke all on function public.platinum_write_shift_cache(date,date,timestamptz,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.platinum_write_shift_cache(date,date,timestamptz,jsonb,boolean) to service_role;
commit;
