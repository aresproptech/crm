# Fase 2 — fiabilidad funcional

Actualizado: 11 de septiembre de 2026. Proyecto de prueba: `rzgedcknhcoprcpdtrki`.

## Objetivo

Evitar que una acción parezca guardada cuando Supabase la rechazó, conservar los
datos del formulario ante un fallo y hacer visibles los errores operativos.

## Bloques aplicados

### Creación de leads

- El formulario espera ahora la respuesta real de Supabase.
- Mientras guarda, bloquea el cierre y los envíos duplicados.
- Si la creación falla, conserva todos los campos, mantiene abierto el diálogo y
  muestra el error dentro del propio formulario.
- Sólo limpia y cierra después de una inserción correcta.

### Importación CSV

- Los tres botones capaces de confirmar la importación comparten un único estado
  de ejecución y no pueden disparar importaciones simultáneas.
- El diálogo espera a que finalice la inserción, no se puede cerrar durante el
  proceso y permanece abierto con el CSV intacto si Supabase devuelve un error.
- El resultado de la persistencia se devuelve explícitamente al diálogo en lugar
  de depender de un error que sólo aparecía en la consola.
- La importación completa se ejecuta ahora con
  `crm_import_leads_with_activity`: si falla una sola fila, PostgreSQL revierte
  todo el archivo, incluidos los eventos de historial ya creados.
- Las fechas de contacto, valoración y hora del CSV se conservan en la nueva
  operación; antes se validaban en el frontend pero no se enviaban a la tabla.

### Leads e historial atómicos

- El alta manual usa `crm_create_lead_with_activity` y confirma el lead junto
  con el evento `lead_created` en una sola transacción.
- La edición general usa `crm_update_lead_with_activity`; guarda el cambio y un
  único evento `lead_updated` con el detalle legible y los estados completos
  `before` y `after` en `metadata`.
- Una edición sin diferencias no genera ruido en el historial.
- Las tres RPC usan los permisos RLS del usuario autenticado. Comerciales sólo
  pueden crear o editar sus oportunidades; visitadores y perfiles sin permiso
  quedan bloqueados.
- `opportunities.fase_id` tiene ahora una clave foránea real a `phases.id`. La
  auditoría previa confirmó que las 3316 oportunidades existentes eran válidas.

### Configuración documental

- La configuración ya no se cierra cuando falla el `upsert` del expediente.
- El error se muestra dentro del asistente y el botón indica `Guardando...`.
- Se bloquea el cierre mientras la escritura está en curso.

### Visitas

- Los fallos de carga de visitas o inmuebles aparecen en la pantalla.
- Los fallos al crear o editar una visita aparecen en el diálogo correspondiente.
- El formulario se conserva y el diálogo permanece abierto cuando la escritura
  falla.

### Operaciones transaccionales

- Crear y editar una visita guarda ahora la visita y su historial mediante una
  única RPC de PostgreSQL: `crm_save_visit_with_activity`.
- Crear y editar un encargo, tanto desde la pestaña Encargos como desde el panel
  del lead, usa `crm_save_order_with_activity`.
- Mover un lead de fase usa `crm_change_lead_phase_with_activity`.
- Las tres funciones validan la sesión y los permisos dentro de la base, obtienen
  el nombre del autor desde el perfil autenticado y bloquean la fila afectada
  durante la operación.
- Si falla la escritura principal o el historial, PostgreSQL revierte todo. Ya no
  puede quedar guardada una visita, un encargo o una fase sin su auditoría.

### Actividades estructuradas

- `opportunity_contacts` continúa siendo la fuente única, pero ahora incluye
  `event_type`, `actor_profile_id`, `effective_at`, `metadata`,
  `parent_event_id` y `updated_at`.
- Los registros existentes se clasificaron sin modificar ni eliminar su `memo`.
  Los textos libres antiguos permanecen como `legacy` y siguen apareciendo como
  observaciones.
- Valoraciones, R.G., Planning, Dashboard y la salud de Encargos consultan ahora
  `event_type`; ya no clasifican registros leyendo prefijos de texto.
- Las nuevas notas, llamadas y actividades se crean con
  `crm_add_contact_activity`. El autor se obtiene de la sesión dentro de la base.
- Crear o editar Valoraciones y R.G. usa RPC transaccionales. Las ediciones
  conservan `before`, `after` y la referencia al registro original.
- Los eventos de auditoría son inmutables. Un trigger mantiene compatibilidad con
  clientes antiguos que todavía escriban los prefijos conocidos.
- Los prefijos se conservan únicamente como representación legible y mecanismo
  temporal de compatibilidad.

## Comportamientos que ya estaban protegidos

- La edición general de un lead lanza el error al formulario y no lo cierra si la
  actualización o la lectura de comprobación fallan.
- El borrado lógico de leads y su historial se ejecuta mediante la RPC atómica
  `crm_soft_delete_leads`.
- Encargos, valoraciones, R.G. y observaciones muestran errores de escritura y no
  cierran sus formularios cuando falla su registro principal.
- La carga documental compensa una inserción de metadatos fallida eliminando el
  objeto que acababa de subir a Storage.

## Riesgos todavía abiertos

### 1. Eliminación documental en dos sistemas

Eliminar un documento requiere borrar el objeto de Storage y luego su fila de
metadatos. No existe una transacción única entre ambos servicios. Si el segundo
paso falla puede quedar una referencia a un archivo ya eliminado. Hace falta un
flujo de borrado recuperable o una tarea de conciliación.

### 2. Usuarios no conectados

La pestaña Usuarios es todavía una maqueta local. Muestra un usuario fijo y el
botón `Invitar usuario` sólo agrega una fila al estado de React; al recargar se
pierde y no crea una cuenta en Supabase Auth ni un perfil real. Es un bloqueo de
producción y deberá resolverse desde un endpoint de servidor protegido para
administradores, nunca exponiendo una `service_role` en el navegador. El usuario
decidió dejar este bloque para la última fase.

### 3. Pruebas funcionales pendientes

Faltan pruebas automatizadas de navegador que provoquen respuestas fallidas y
comprueben que los formularios conservan los datos. También sigue pendiente el
recorrido manual completo con cada rol indicado en la Fase 0.

## Verificación de este bloque

- `npx tsc --noEmit`: PASS.
- `npm run lint -- --quiet`: PASS, cero errores.
- Migración `20260910100000_atomic_business_mutations.sql`: aplicada en el
  proyecto Supabase de prueba.
- Migración `20260910120000_structure_opportunity_contacts.sql`: aplicada;
  conserva los memos y clasifica las actividades existentes.
- Migración `20260911110000_atomic_lead_mutations.sql`: aplicada; crea las RPC
  transaccionales para alta, importación y edición de leads.
- Migración `20260911113000_enforce_opportunity_phase_fk.sql`: aplicada después
  de confirmar que no existían fases huérfanas.
- `supabase/tests/atomic-lead-mutations.sql`: PASS para todos los perfiles Auth;
  comprobó alta, edición, importación, autor, permisos y rollback total ante una
  fila inválida. Todas las escrituras terminaron con `ROLLBACK`.
- `supabase/tests/structured-opportunity-contacts.sql`: PASS; comprobó tipos,
  metadatos, actor, fecha efectiva, compatibilidad, auditoría e inmutabilidad y
  terminó con `ROLLBACK`.
- `supabase/tests/atomic-business-mutations.sql`: PASS para todos los perfiles
  habilitados; comprobó creación/edición e historial y terminó con `ROLLBACK`.
- `supabase/tests/role-access.sql`: PASS; se mantienen el aislamiento y las reglas
  de escritura por rol.
- `npm run security:supabase:anon`: PASS; una sesión anónima sigue sin poder leer
  ninguna tabla protegida.
- `npx next build --webpack`: PASS con las 13 rutas. Turbopack no pudo abrir su
  proceso local dentro del entorno restringido, por lo que se verificó con el
  compilador webpack soportado por Next.js.
- Navegador local con Facu/Coordinador: Leads carga 3316 registros; los diálogos
  de Nuevo lead, Importar CSV y Agregar visita abren correctamente después de los
  cambios. No se escribieron datos durante esta comprobación.

## Próximo bloque recomendado

Completar los recorridos funcionales de navegador por rol, especialmente alta,
edición e importación de leads con datos de prueba. La eliminación documental
recuperable continúa pendiente y la gestión real de usuarios con Supabase Auth
queda pospuesta para la última fase.

El CRM todavía no se declara apto para producción.
