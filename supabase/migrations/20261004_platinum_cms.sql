-- Isolated website CMS. Does not change the existing shifts table or its policies.
begin;

create table if not exists public.platinum_admins (
  store_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (store_id,user_id)
);
create table if not exists public.platinum_drafts (
  store_id uuid primary key,
  payload jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
create table if not exists public.platinum_public (
  store_id uuid primary key,
  payload jsonb not null,
  revision bigint not null,
  published_at timestamptz not null default now()
);

alter table public.platinum_admins enable row level security;
alter table public.platinum_drafts enable row level security;
alter table public.platinum_public enable row level security;
revoke all on public.platinum_admins,public.platinum_drafts,public.platinum_public from public,anon,authenticated;
grant select on public.platinum_admins,public.platinum_drafts to authenticated;
grant select on public.platinum_public to anon,authenticated;

drop policy if exists "Read own membership" on public.platinum_admins;
create policy "Read own membership" on public.platinum_admins for select to authenticated
using (user_id=(select auth.uid()));
drop policy if exists "Members read drafts" on public.platinum_drafts;
create policy "Members read drafts" on public.platinum_drafts for select to authenticated
using (exists(select 1 from public.platinum_admins a where a.store_id=platinum_drafts.store_id and a.user_id=(select auth.uid())));
drop policy if exists "Visitors read published site" on public.platinum_public;
create policy "Visitors read published site" on public.platinum_public for select to anon,authenticated using (true);

create or replace function public.platinum_save_draft(p_store uuid,p_payload jsonb,p_expected bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare current_revision bigint;
begin
  if auth.uid() is null or not exists(select 1 from public.platinum_admins where store_id=p_store and user_id=auth.uid()) then
    raise exception 'この店舗の管理権限がありません。' using errcode='42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) is distinct from 'object'
    or jsonb_typeof(p_payload->'therapists') is distinct from 'array'
    or jsonb_typeof(p_payload->'news') is distinct from 'array'
    or jsonb_typeof(p_payload->'shifts') is distinct from 'array'
    or jsonb_typeof(p_payload->'courses') is distinct from 'array'
    or jsonb_typeof(p_payload->'shop') is distinct from 'object'
    or octet_length(p_payload::text)>8000000 then
    raise exception 'データ形式またはサイズが正しくありません。';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_store::text,0));
  select revision into current_revision from public.platinum_drafts where store_id=p_store;
  current_revision:=coalesce(current_revision,0);
  if p_expected is distinct from current_revision then
    raise exception '別の画面から更新されています。変更を控えてから再ログインし、最新の下書きを読み込んでください。' using errcode='40001';
  end if;
  insert into public.platinum_drafts(store_id,payload,revision,updated_at)
  values(p_store,p_payload-'password',current_revision+1,now())
  on conflict(store_id) do update set payload=excluded.payload,revision=excluded.revision,updated_at=now();
  return current_revision+1;
end;
$$;

create or replace function public.platinum_publish(p_store uuid,p_expected bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare doc jsonb; rev bigint; people jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.platinum_admins where store_id=p_store and user_id=auth.uid()) then
    raise exception 'この店舗の管理権限がありません。' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_store::text,0));
  select payload,revision into doc,rev from public.platinum_drafts where store_id=p_store;
  if doc is null then raise exception '先に下書きを保存してください。'; end if;
  if rev is distinct from p_expected then raise exception '公開前に別の画面から更新されています。最新の下書きを確認してください。' using errcode='40001'; end if;
  select coalesce(jsonb_agg(t),'[]'::jsonb) into people from jsonb_array_elements(doc->'therapists') t where t->>'active'='true';
  doc:=jsonb_set(doc,'{therapists}',people);
  doc:=jsonb_set(doc,'{news}',(select coalesce(jsonb_agg(n),'[]'::jsonb) from jsonb_array_elements(doc->'news') n where coalesce(n->>'published','true')='true'));
  doc:=jsonb_set(doc,'{shifts}',(select coalesce(jsonb_agg(s),'[]'::jsonb) from jsonb_array_elements(doc->'shifts') s
    where coalesce(s->>'published','true')='true' and exists(select 1 from jsonb_array_elements(people) p where p->>'id'=s->>'therapistId')));
  -- Only website fields belong in the anonymous-readable document.
  doc:=jsonb_build_object('version',1,'shop',doc->'shop','therapists',doc->'therapists','news',doc->'news',
    'shifts',doc->'shifts','courses',doc->'courses','pricing',doc->'pricing','banner',doc->'banner',
    'ranking',coalesce(doc->'ranking','[]'::jsonb),'links',coalesce(doc->'links','[]'::jsonb),'notices',coalesce(doc->'notices','[]'::jsonb),
    'reception',doc->'reception','shiftSource',doc->'shiftSource');
  insert into public.platinum_public(store_id,payload,revision,published_at) values(p_store,doc,rev,now())
  on conflict(store_id) do update set payload=excluded.payload,revision=excluded.revision,published_at=now();
  return rev;
end;
$$;
revoke all on function public.platinum_save_draft(uuid,jsonb,bigint),public.platinum_publish(uuid,bigint) from public,anon,authenticated;
grant execute on function public.platinum_save_draft(uuid,jsonb,bigint),public.platinum_publish(uuid,bigint) to authenticated;
commit;

-- One-time membership registration after creating a confirmed Auth user in the dashboard:
-- insert into public.platinum_admins(store_id,user_id)
-- values ('33333333-0000-0000-0000-000000000003','YOUR_AUTH_USER_UUID');
