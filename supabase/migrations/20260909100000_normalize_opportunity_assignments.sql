-- Fase 1: normaliza relaciones de oportunidades sin perder los textos heredados.

begin;

create or replace function public.crm_current_profile_id()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where p.auth_id = auth.uid()
    and coalesce(p.enabled, true)
  limit 1
$$;

revoke all on function public.crm_current_profile_id() from public, anon;
grant execute on function public.crm_current_profile_id() to authenticated;

-- Sólo se completan coincidencias únicas, ignorando mayúsculas y espacios.
with unique_profiles as (
  select lower(btrim(name)) as normalized_name, min(id) as profile_id
  from public.profiles
  where nullif(btrim(name), '') is not null
  group by lower(btrim(name))
  having count(*) = 1
)
update public.opportunities o
set comercial_user_id = p.profile_id
from unique_profiles p
where o.comercial_user_id is null
  and lower(btrim(o.comercial_user_desc)) = p.normalized_name;

with unique_profiles as (
  select lower(btrim(name)) as normalized_name, min(id) as profile_id
  from public.profiles
  where nullif(btrim(name), '') is not null
  group by lower(btrim(name))
  having count(*) = 1
)
update public.opportunities o
set contact_user_id = p.profile_id
from unique_profiles p
where o.contact_user_id is null
  and lower(btrim(o.contact_user_desc)) = p.normalized_name;

with unique_sources as (
  select lower(btrim(code)) as normalized_code, min(id) as source_id
  from public.sources
  where nullif(btrim(code), '') is not null
  group by lower(btrim(code))
  having count(*) = 1
)
update public.opportunities o
set source_id = s.source_id
from unique_sources s
where o.source_id is null
  and lower(btrim(o.source_desc)) = s.normalized_code;

create index if not exists idx_opportunities_comercial_user_id
  on public.opportunities (comercial_user_id)
  where deleted_at is null;

create index if not exists idx_opportunities_contact_user_id
  on public.opportunities (contact_user_id)
  where deleted_at is null;

create index if not exists idx_opportunities_source_id
  on public.opportunities (source_id)
  where deleted_at is null;

create or replace function public.crm_can_read_opportunity(target_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.opportunities o
    where o.id = target_id
      and o.deleted_at is null
      and (
        public.crm_current_role() in ('admin', 'coordinador')
        or public.crm_is_visitador()
        or (
          public.crm_current_role() = 'comercial'
          and (
            (o.comercial_user_id is not null
              and o.comercial_user_id = public.crm_current_profile_id())
            or
            (o.comercial_user_id is null
              and lower(btrim(coalesce(o.comercial_user_desc, ''))) =
                  lower(btrim(coalesce(public.crm_current_name(), ''))))
          )
        )
      )
  )
$$;

create or replace function public.crm_can_write_opportunity(target_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.opportunities o
    where o.id = target_id
      and o.deleted_at is null
      and (
        public.crm_current_role() in ('admin', 'coordinador')
        or (
          public.crm_current_role() = 'comercial'
          and not public.crm_is_visitador()
          and (
            (o.comercial_user_id is not null
              and o.comercial_user_id = public.crm_current_profile_id())
            or
            (o.comercial_user_id is null
              and lower(btrim(coalesce(o.comercial_user_desc, ''))) =
                  lower(btrim(coalesce(public.crm_current_name(), ''))))
          )
        )
      )
  )
$$;

drop policy if exists opportunities_select_by_role on public.opportunities;
create policy opportunities_select_by_role
on public.opportunities for select to authenticated
using (
  deleted_at is null
  and (
    public.crm_current_role() in ('admin', 'coordinador')
    or public.crm_is_visitador()
    or (
      public.crm_current_role() = 'comercial'
      and (
        (comercial_user_id is not null
          and comercial_user_id = public.crm_current_profile_id())
        or
        (comercial_user_id is null
          and lower(btrim(coalesce(comercial_user_desc, ''))) =
              lower(btrim(coalesce(public.crm_current_name(), ''))))
      )
    )
  )
);

drop policy if exists opportunities_insert_by_role on public.opportunities;
create policy opportunities_insert_by_role
on public.opportunities for insert to authenticated
with check (
  public.crm_current_role() in ('admin', 'coordinador')
  or (
    public.crm_current_role() = 'comercial'
    and not public.crm_is_visitador()
    and (
      (comercial_user_id is not null
        and comercial_user_id = public.crm_current_profile_id())
      or
      (comercial_user_id is null
        and lower(btrim(coalesce(comercial_user_desc, ''))) =
            lower(btrim(coalesce(public.crm_current_name(), ''))))
    )
  )
);

drop policy if exists opportunities_update_by_role on public.opportunities;
create policy opportunities_update_by_role
on public.opportunities for update to authenticated
using (public.crm_can_write_opportunity(id))
with check (
  public.crm_current_role() in ('admin', 'coordinador')
  or (
    public.crm_current_role() = 'comercial'
    and not public.crm_is_visitador()
    and (
      (comercial_user_id is not null
        and comercial_user_id = public.crm_current_profile_id())
      or
      (comercial_user_id is null
        and lower(btrim(coalesce(comercial_user_desc, ''))) =
            lower(btrim(coalesce(public.crm_current_name(), ''))))
    )
  )
);

commit;
