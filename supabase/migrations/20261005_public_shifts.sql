-- Public read-only projection for Kamisu/Premium. Review and apply in the existing shifts project.
-- date is returned as stored; the HP server applies the explicitly configured date basis.
begin;
create or replace function public.platinum_public_shifts(p_from date,p_to date)
returns table(date date,therapist_id uuid,therapist_name text,start_time text,end_time text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_from is null or p_to is null or p_to < p_from or p_to-p_from > 31 then
    raise exception 'Invalid date range' using errcode='22023';
  end if;
  return query
  select s.date,s.therapist_id,s.therapist_name::text,s.start_time::text,s.end_time::text
  from public.shifts s
  where s.store_id='33333333-0000-0000-0000-000000000003'::uuid
    and s.date between p_from and p_to
    and s.status='approved'
    and coalesce(s.attendance_type,'normal')='normal'
    and coalesce(s.is_dayoff_request,false)=false
    and nullif(trim(s.therapist_name),'') is not null
    and trim(s.therapist_name) !~ '^\[(面接|特別)\]'
  order by s.date,s.start_time;
end;
$$;
revoke all on function public.platinum_public_shifts(date,date) from public;
grant execute on function public.platinum_public_shifts(date,date) to anon,authenticated;
comment on function public.platinum_public_shifts(date,date) is 'Fixed store public regular approved shifts only; no private columns.';
commit;
