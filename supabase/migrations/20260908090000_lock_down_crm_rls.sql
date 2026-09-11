-- Hotfix de seguridad para el esquema CRM ya existente.
-- Aplicación autorizada en la base de prueba, sin backup de sus datos desechables.

begin;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'public.profiles',
    'public.opportunities',
    'public.opportunity_contacts',
    'public.opportunity_orders',
    'public.visitas',
    'public.crm_leads_view'
  ]
  loop
    if to_regclass(relation_name) is null then
      raise exception 'Falta la relación requerida: %', relation_name;
    end if;
  end loop;
end
$$;

create or replace function public.crm_current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(btrim(p.rol))
  from public.profiles p
  where p.auth_id = auth.uid()
    and coalesce(p.enabled, true)
  limit 1
$$;

create or replace function public.crm_current_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select btrim(p.name)
  from public.profiles p
  where p.auth_id = auth.uid()
    and coalesce(p.enabled, true)
  limit 1
$$;

create or replace function public.crm_is_visitador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.crm_current_role() = 'comercial'
    and lower(btrim(coalesce(public.crm_current_name(), ''))) in ('gonza', 'gonzalo')
$$;

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
          and lower(btrim(coalesce(o.comercial_user_desc, ''))) =
              lower(btrim(coalesce(public.crm_current_name(), '')))
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
          and lower(btrim(coalesce(o.comercial_user_desc, ''))) =
              lower(btrim(coalesce(public.crm_current_name(), '')))
        )
      )
  )
$$;

revoke all on function public.crm_current_role() from public, anon;
revoke all on function public.crm_current_name() from public, anon;
revoke all on function public.crm_is_visitador() from public, anon;
revoke all on function public.crm_can_read_opportunity(bigint) from public, anon;
revoke all on function public.crm_can_write_opportunity(bigint) from public, anon;

grant execute on function public.crm_current_role() to authenticated;
grant execute on function public.crm_current_name() to authenticated;
grant execute on function public.crm_is_visitador() to authenticated;
grant execute on function public.crm_can_read_opportunity(bigint) to authenticated;
grant execute on function public.crm_can_write_opportunity(bigint) to authenticated;

alter table public.profiles enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_contacts enable row level security;
alter table public.opportunity_orders enable row level security;
alter table public.visitas enable row level security;

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.opportunities from public, anon, authenticated;
revoke all on table public.opportunity_contacts from public, anon, authenticated;
revoke all on table public.opportunity_orders from public, anon, authenticated;
revoke all on table public.visitas from public, anon, authenticated;
revoke all on table public.crm_leads_view from public, anon, authenticated;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.opportunities to authenticated;
grant select, insert, update, delete on table public.opportunity_contacts to authenticated;
grant select, insert, update, delete on table public.opportunity_orders to authenticated;
grant select, insert, update, delete on table public.visitas to authenticated;
grant select on table public.crm_leads_view to authenticated;

-- Las policies permisivas se combinan con OR; se reemplazan de forma transaccional.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select tablename, policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'profiles',
        'opportunities',
        'opportunity_contacts',
        'opportunity_orders',
        'visitas'
      ])
  loop
    execute format(
      'drop policy %I on public.%I',
      policy_row.policyname,
      policy_row.tablename
    );
  end loop;
end
$$;

create policy "profiles_select_by_role"
on public.profiles for select to authenticated
using (
  auth_id = auth.uid()
  or public.crm_current_role() in ('admin', 'coordinador')
);

create policy "profiles_insert_by_manager"
on public.profiles for insert to authenticated
with check (public.crm_current_role() in ('admin', 'coordinador'));

create policy "profiles_update_by_manager"
on public.profiles for update to authenticated
using (public.crm_current_role() in ('admin', 'coordinador'))
with check (public.crm_current_role() in ('admin', 'coordinador'));

create policy "profiles_delete_by_manager"
on public.profiles for delete to authenticated
using (public.crm_current_role() in ('admin', 'coordinador'));

create policy "opportunities_select_by_role"
on public.opportunities for select to authenticated
using (
  deleted_at is null
  and (
    public.crm_current_role() in ('admin', 'coordinador')
    or public.crm_is_visitador()
    or (
      public.crm_current_role() = 'comercial'
      and lower(btrim(coalesce(comercial_user_desc, ''))) =
          lower(btrim(coalesce(public.crm_current_name(), '')))
    )
  )
);

create policy "opportunities_insert_by_role"
on public.opportunities for insert to authenticated
with check (
  public.crm_current_role() in ('admin', 'coordinador')
  or (
    public.crm_current_role() = 'comercial'
    and not public.crm_is_visitador()
    and lower(btrim(coalesce(comercial_user_desc, ''))) =
        lower(btrim(coalesce(public.crm_current_name(), '')))
  )
);

create policy "opportunities_update_by_role"
on public.opportunities for update to authenticated
using (public.crm_can_write_opportunity(id))
with check (
  public.crm_current_role() in ('admin', 'coordinador')
  or (
    public.crm_current_role() = 'comercial'
    and not public.crm_is_visitador()
    and lower(btrim(coalesce(comercial_user_desc, ''))) =
        lower(btrim(coalesce(public.crm_current_name(), '')))
  )
);

create policy "opportunities_delete_by_role"
on public.opportunities for delete to authenticated
using (public.crm_can_write_opportunity(id));

create policy "contacts_select_by_opportunity"
on public.opportunity_contacts for select to authenticated
using (public.crm_can_read_opportunity(opportunity_id));

create policy "contacts_insert_by_opportunity"
on public.opportunity_contacts for insert to authenticated
with check (
  public.crm_can_write_opportunity(opportunity_id)
  or (
    public.crm_is_visitador()
    and public.crm_can_read_opportunity(opportunity_id)
    and memo ilike '[HISTORIAL]%visita%'
  )
);

create policy "contacts_update_by_opportunity"
on public.opportunity_contacts for update to authenticated
using (public.crm_can_write_opportunity(opportunity_id))
with check (public.crm_can_write_opportunity(opportunity_id));

create policy "contacts_delete_by_opportunity"
on public.opportunity_contacts for delete to authenticated
using (public.crm_can_write_opportunity(opportunity_id));

create policy "orders_select_by_opportunity"
on public.opportunity_orders for select to authenticated
using (public.crm_can_read_opportunity(opportunity_id));

create policy "orders_insert_by_opportunity"
on public.opportunity_orders for insert to authenticated
with check (public.crm_can_write_opportunity(opportunity_id));

create policy "orders_update_by_opportunity"
on public.opportunity_orders for update to authenticated
using (public.crm_can_write_opportunity(opportunity_id))
with check (public.crm_can_write_opportunity(opportunity_id));

create policy "orders_delete_by_opportunity"
on public.opportunity_orders for delete to authenticated
using (public.crm_can_write_opportunity(opportunity_id));

create policy "visitas_select_by_role"
on public.visitas for select to authenticated
using (public.crm_can_read_opportunity(opportunity_id));

create policy "visitas_insert_by_role"
on public.visitas for insert to authenticated
with check (
  public.crm_is_visitador()
  or public.crm_can_write_opportunity(opportunity_id)
);

create policy "visitas_update_by_role"
on public.visitas for update to authenticated
using (
  public.crm_is_visitador()
  or public.crm_can_write_opportunity(opportunity_id)
)
with check (
  public.crm_is_visitador()
  or public.crm_can_write_opportunity(opportunity_id)
);

create policy "visitas_delete_by_role"
on public.visitas for delete to authenticated
using (
  public.crm_is_visitador()
  or public.crm_can_write_opportunity(opportunity_id)
);

alter view public.crm_leads_view set (security_invoker = true);

commit;
