-- Catálogo mínimo de perfiles para desplegables de asignación.
-- Evita abrir la tabla profiles completa a usuarios no gestores.

begin;

create or replace function public.crm_profile_assignment_options()
returns table(id bigint, name text, rol text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.rol
  from public.profiles p
  where coalesce(p.enabled, true)
    and public.crm_current_role() is not null
    and nullif(btrim(p.name), '') is not null
  order by p.name
$$;

revoke all on function public.crm_profile_assignment_options() from public, anon;
grant execute on function public.crm_profile_assignment_options() to authenticated;

commit;
