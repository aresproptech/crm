-- Evita que una oportunidad quede vinculada a una fase inexistente.
-- La auditoría previa confirmó que no hay filas históricas inválidas.

begin;

alter table public.opportunities
  add constraint opportunities_fase_id_fkey
  foreign key (fase_id)
  references public.phases(id)
  not valid;

alter table public.opportunities
  validate constraint opportunities_fase_id_fkey;

commit;
