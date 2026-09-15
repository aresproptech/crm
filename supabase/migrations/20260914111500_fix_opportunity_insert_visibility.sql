-- La policy SELECT evalúa la fila directamente para que INSERT ... RETURNING
-- pueda ver una oportunidad recién creada dentro de la misma sentencia.

begin;

drop policy if exists opportunities_select_by_role on public.opportunities;
create policy opportunities_select_by_role
on public.opportunities for select to authenticated
using (
  deleted_at is null
  and (
    public.crm_current_role() in ('admin', 'coordinador')
    or (
      public.crm_current_role() = 'comercial'
      and not public.crm_can_manage_visits()
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

commit;
