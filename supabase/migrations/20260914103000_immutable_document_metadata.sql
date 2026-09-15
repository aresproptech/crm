-- Fuerza que todo archivo documental se registre mediante la RPC auditada.

begin;

drop policy if exists documentation_files_insert
  on public.opportunity_documentation_files;
drop policy if exists documentation_files_update
  on public.opportunity_documentation_files;

revoke insert, update
  on public.opportunity_documentation_files
  from authenticated, appsheet_user;

commit;
