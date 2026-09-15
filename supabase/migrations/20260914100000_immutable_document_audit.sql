-- Conserva documentos y leads sin borrado físico y audita la documentación.

begin;

alter table public.opportunity_contacts
  drop constraint if exists opportunity_contacts_event_type_check,
  add constraint opportunity_contacts_event_type_check check (
    event_type in (
      'legacy',
      'activity',
      'note',
      'call',
      'valuation',
      'valuation_updated',
      'rg',
      'rg_updated',
      'lead_created',
      'lead_imported',
      'lead_updated',
      'lead_deleted',
      'phase_changed',
      'visit_created',
      'visit_updated',
      'order_created',
      'order_updated',
      'document_uploaded',
      'document_viewed'
    )
  );

create or replace function public.crm_register_document_upload(
  p_opportunity_id bigint,
  p_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_file public.opportunity_documentation_files%rowtype;
  actor_id bigint := public.crm_current_profile_id();
  actor_name text := coalesce(nullif(public.crm_current_name(), ''), 'Usuario');
  requirement_key text;
  file_name text;
  storage_path text;
  mime_type text;
  file_size bigint;
  activity_text text;
begin
  if auth.uid() is null or public.crm_current_role() is null then
    raise exception 'Sesión no válida' using errcode = '42501';
  end if;

  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'Los datos del documento no son válidos' using errcode = '22023';
  end if;

  requirement_key := nullif(btrim(p_data ->> 'requirement_key'), '');
  file_name := nullif(btrim(p_data ->> 'file_name'), '');
  storage_path := nullif(btrim(p_data ->> 'storage_path'), '');
  mime_type := nullif(btrim(p_data ->> 'mime_type'), '');
  file_size := nullif(p_data ->> 'file_size', '')::bigint;

  if requirement_key is null or file_name is null or storage_path is null then
    raise exception 'Faltan datos obligatorios del documento' using errcode = '23502';
  end if;

  if mime_type not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp') then
    raise exception 'Formato de archivo no permitido' using errcode = '22023';
  end if;

  if file_size is null or file_size <= 0 or file_size > 15728640 then
    raise exception 'El tamaño del archivo no es válido' using errcode = '22023';
  end if;

  if public.crm_document_opportunity_id(storage_path) is distinct from p_opportunity_id then
    raise exception 'La ruta del documento no corresponde al lead' using errcode = '22023';
  end if;

  perform 1
  from public.opportunities
  where id = p_opportunity_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'El lead no existe o está eliminado' using errcode = 'P0002';
  end if;

  if not public.crm_can_write_opportunity(p_opportunity_id) then
    raise exception 'No tenés permiso para adjuntar documentación' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'lead-documentation'
      and name = storage_path
  ) then
    raise exception 'El archivo no existe en Storage' using errcode = 'P0002';
  end if;

  insert into public.opportunity_documentation_files (
    opportunity_id,
    requirement_key,
    file_name,
    storage_path,
    mime_type,
    file_size,
    uploaded_by
  )
  values (
    p_opportunity_id,
    requirement_key,
    file_name,
    storage_path,
    mime_type,
    file_size,
    actor_name
  )
  returning * into saved_file;

  activity_text := 'Subió el documento «' || file_name || '»';

  insert into public.opportunity_contacts (
    opportunity_id,
    fecha,
    memo,
    resultado,
    event_type,
    actor_profile_id,
    effective_at,
    metadata
  )
  values (
    p_opportunity_id,
    current_date,
    '[HISTORIAL] ' || actor_name || ': ' || activity_text,
    true,
    'document_uploaded',
    actor_id,
    now(),
    jsonb_build_object(
      'actor_name', actor_name,
      'text', activity_text,
      'document_id', saved_file.id,
      'requirement_key', requirement_key,
      'file_name', file_name,
      'storage_path', storage_path,
      'mime_type', mime_type,
      'file_size', file_size
    )
  );

  return to_jsonb(saved_file);
end
$$;

create or replace function public.crm_record_document_view(
  p_file_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_file public.opportunity_documentation_files%rowtype;
  actor_id bigint := public.crm_current_profile_id();
  actor_name text := coalesce(nullif(public.crm_current_name(), ''), 'Usuario');
  activity_text text;
begin
  if auth.uid() is null or public.crm_current_role() is null then
    raise exception 'Sesión no válida' using errcode = '42501';
  end if;

  select *
  into target_file
  from public.opportunity_documentation_files
  where id = p_file_id;

  if not found then
    raise exception 'El documento no existe' using errcode = 'P0002';
  end if;

  if not public.crm_can_read_opportunity(target_file.opportunity_id) then
    raise exception 'No tenés permiso para abrir este documento' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'lead-documentation'
      and name = target_file.storage_path
  ) then
    raise exception 'El archivo no existe en Storage' using errcode = 'P0002';
  end if;

  activity_text := 'Abrió el documento «' || target_file.file_name || '»';

  insert into public.opportunity_contacts (
    opportunity_id,
    fecha,
    memo,
    resultado,
    event_type,
    actor_profile_id,
    effective_at,
    metadata
  )
  values (
    target_file.opportunity_id,
    current_date,
    '[HISTORIAL] ' || actor_name || ': ' || activity_text,
    true,
    'document_viewed',
    actor_id,
    now(),
    jsonb_build_object(
      'actor_name', actor_name,
      'text', activity_text,
      'document_id', target_file.id,
      'requirement_key', target_file.requirement_key,
      'file_name', target_file.file_name,
      'storage_path', target_file.storage_path
    )
  );

  return target_file.storage_path;
end
$$;

revoke all on function public.crm_register_document_upload(bigint, jsonb) from public, anon;
revoke all on function public.crm_record_document_view(uuid) from public, anon;
grant execute on function public.crm_register_document_upload(bigint, jsonb) to authenticated, service_role;
grant execute on function public.crm_record_document_view(uuid) to authenticated, service_role;

-- Ningún usuario normal puede borrar físicamente leads, expedientes, archivos
-- ni eventos de auditoría. Las eliminaciones visibles de leads siguen usando
-- deleted_at mediante crm_soft_delete_leads.
drop policy if exists opportunities_delete_by_role on public.opportunities;
drop policy if exists contacts_delete_by_opportunity on public.opportunity_contacts;
drop policy if exists documentation_cases_delete on public.opportunity_documentation_cases;
drop policy if exists documentation_files_delete on public.opportunity_documentation_files;

revoke delete on public.opportunities from authenticated, appsheet_user;
revoke delete on public.opportunity_contacts from authenticated, appsheet_user;
revoke delete on public.opportunity_documentation_cases from authenticated, appsheet_user;
revoke delete on public.opportunity_documentation_files from authenticated, appsheet_user;

-- Storage queda inmutable para usuarios autenticados: pueden subir y abrir,
-- pero no reemplazar ni borrar objetos del bucket documental.
drop policy if exists lead_documentation_storage_update on storage.objects;
drop policy if exists lead_documentation_storage_delete on storage.objects;

commit;
