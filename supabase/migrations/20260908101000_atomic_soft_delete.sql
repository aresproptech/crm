begin;
-- Mantiene el historial del borrado sin permitir escribir en leads ya eliminados.
create or replace function public.crm_soft_delete_leads(lead_ids bigint[])
returns void language plpgsql security definer set search_path = '' as $$
declare target_id bigint;
begin
  if lead_ids is null or cardinality(lead_ids)=0 then return; end if;
  -- Bloqueo ordenado: comprobar permisos antes de tocar cualquier fila.
  perform 1 from public.opportunities where id=any(lead_ids) order by id for update;
  foreach target_id in array lead_ids loop
    if not public.crm_can_write_opportunity(target_id) then
      raise exception 'No tienes permiso para eliminar uno de los leads' using errcode='42501';
    end if;
  end loop;
  update public.opportunities set deleted_at=now() where id=any(lead_ids);
  insert into public.opportunity_contacts(opportunity_id,fecha,memo)
    select distinct id,current_date,'[HISTORIAL] ' || public.crm_current_name() || ': Eliminó el lead'
    from unnest(lead_ids) id;
end $$;
revoke all on function public.crm_soft_delete_leads(bigint[]) from public,anon;
grant execute on function public.crm_soft_delete_leads(bigint[]) to authenticated;
commit;
