# Fase 1 — integridad y relaciones de datos

Actualizado: 9 de septiembre de 2026. Proyecto de prueba: `rzgedcknhcoprcpdtrki`.

## Diagnóstico inicial

Los 3316 leads activos utilizaban descripciones de texto para comercial, planner
y origen. Ninguno tenía informados `comercial_user_id`, `contact_user_id` o
`source_id`, aunque las claves foráneas ya existían.

La auditoría reproducible está en `supabase/tests/data-integrity-audit.sql`.
También confirmó que no existen contactos, visitas ni documentos sin lead.

## Aplicado

La migración `20260909100000_normalize_opportunity_assignments.sql`:

- Completó únicamente coincidencias únicas, sin inferir valores ambiguos.
- Vinculó 2922 leads activos con su comercial.
- Vinculó 2961 leads activos con su planner.
- Vinculó 2835 leads activos con su origen.
- Conservó los textos heredados como respaldo y no eliminó registros.
- Actualizó RLS para autorizar comerciales por `comercial_user_id`, usando el
  texto sólo como compatibilidad cuando el ID todavía es nulo.
- Añadió índices parciales para las tres relaciones.

La migración `20260909103000_profile_assignment_options.sql` añadió una función
segura que devuelve sólo ID, nombre y rol de los perfiles habilitados. Así, los
desplegables no necesitan abrir la tabla completa `profiles` a los comerciales.

El frontend ahora:

- Guarda IDs reales al crear, importar y editar leads cuando existe catálogo.
- Obtiene Owners, Planners y Orígenes desde Supabase, no de listas antiguas.
- Limita el Owner de un Comercial a su propio perfil; Admin y Coordinador pueden
  seleccionar cualquiera. El catálogo de Planner sigue disponible para todos.
- Mantiene visible un valor histórico aunque todavía no exista en el catálogo.

## Verificado

- Auditoría posterior: ninguna coincidencia automática quedó pendiente y no
  aparecieron pares ID/texto inconsistentes.
- Prueba SQL con los nueve perfiles Auth: PASS para vista por ID, catálogo mínimo,
  aislamiento, bloqueo de escalada, documentación y borrado atómico. Se ejecutó
  dentro de una transacción revertida.
- Acceso anónimo: las 14 relaciones continúan bloqueadas.
- `npx tsc --noEmit`: PASS.
- `npm run lint -- --quiet`: PASS, 0 errores.
- `npx next build --webpack`: PASS con TypeScript y las 13 rutas.
- Navegador con Facu/Coordinador: carga de 3316 leads; el formulario muestra los
  14 perfiles habilitados y los 12 orígenes reales del catálogo.

## Casos pendientes de decisión

No se modificaron los siguientes valores porque no tienen una equivalencia única:

- Comercial: 117 leads (`PropTech`/`Proptech`, `Diana` y `Sin comercial`).
- Planner: 40 leads (`Juan Carlos`, `Diana`, `Oficina`, `Proptech` y `Sin contacto`).
- Origen: 475 leads, principalmente `Seguimiento`, `Recomendación`, `Chamartín`
  y `Google`, además de variantes antiguas.
- Cinco de los 14 perfiles habilitados todavía no están vinculados a Supabase Auth.

Antes de normalizar estos casos hace falta decidir si cada nombre corresponde a
un perfil/origen existente, si debe crearse un nuevo catálogo o si realmente
significa «sin asignar». Hasta entonces continúan funcionando mediante el texto
heredado, pero no se ofrecerán como opciones nuevas si no existen en el catálogo.

No se hizo commit, push de Git ni despliegue del frontend en esta fase.
