begin;

select plan(26);

select ok(relrowsecurity, relname || ' tiene RLS activo')
from pg_catalog.pg_class
where oid = any (array[
  'public.opportunity_documentation_cases'::regclass,
  'public.opportunity_documentation_files'::regclass
]);

select ok(
  not has_table_privilege('anon', relation_name, privilege_name),
  'anon no tiene ' || privilege_name || ' sobre ' || relation_name
)
from unnest(array[
  'public.opportunity_documentation_cases',
  'public.opportunity_documentation_files'
]) relation_name
cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) privilege_name;

select ok(
  has_table_privilege('authenticated', relation_name, privilege_name),
  'authenticated tiene ' || privilege_name || ' sobre ' || relation_name
)
from unnest(array[
  'public.opportunity_documentation_cases',
  'public.opportunity_documentation_files'
]) relation_name
cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) privilege_name;

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'opportunity_documentation_cases',
        'opportunity_documentation_files'
      ])
  ),
  8,
  'existen las ocho policies de documentación'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'opportunity_documentation_cases',
        'opportunity_documentation_files'
      ])
      and ('anon' = any (roles) or 'public' = any (roles))
  ),
  0,
  'ninguna policy de documentación se aplica a anon o public'
);

select ok(
  exists (
    select 1 from storage.buckets where id = 'lead-documentation'
  ),
  'existe el bucket privado de documentación'
);

select ok(
  not (select public from storage.buckets where id = 'lead-documentation'),
  'el bucket de documentación no es público'
);

select is(
  (select file_size_limit from storage.buckets where id = 'lead-documentation'),
  15728640::bigint,
  'el límite por archivo es de 15 MB'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'lead_documentation_storage_%'
  ),
  4,
  'existen cuatro policies de Storage para documentación'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'lead_documentation_storage_%'
      and ('anon' = any (roles) or 'public' = any (roles))
  ),
  0,
  'las policies de Storage no se aplican a anon o public'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.crm_document_opportunity_id(text)',
    'EXECUTE'
  ),
  'anon no puede ejecutar el helper de rutas de documentos'
);

select * from finish();
rollback;
