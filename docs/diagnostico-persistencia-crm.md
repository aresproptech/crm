# Diagnostico de persistencia del CRM

## Objetivo

Este documento explica el mapa entre lo que el usuario ve o acciona en el front y donde se guarda o se calcula en el backend.

El Excel relacionado esta en:

`outputs/crm-persistence-map/mapa-front-back-crm.xlsx`

## Como leer el Excel

La hoja `Mapa front-back` muestra cada bloque funcional del CRM.

- `Accion en front`: lo que hace el usuario en pantalla.
- `Ubicacion front`: archivo o componente donde vive esa accion.
- `Ubicacion backend`: tabla, vista o API que recibe o entrega los datos.
- `Operacion`: lectura, creacion, edicion, borrado logico o calculo.
- `Columnas backend`: campos principales que se usan.
- `Persiste`: indica si queda guardado en Supabase o si solo afecta la pantalla.
- `Estado`: clasificacion rapida del punto.

La hoja `Resumen` agrupa el estado general.

La hoja `Riesgos y mejoras` lista los puntos que conviene revisar antes de considerar cerrado el circuito de persistencia.

## Que esta bien

Las acciones principales del negocio si tienen respaldo en backend:

- Los leads se leen desde `crm_leads_view` y se actualizan en `opportunities`.
- Las observaciones se guardan en `opportunity_contacts`.
- El historial visible del panel se apoya en registros guardados, principalmente dentro de `opportunity_contacts`.
- Las valoraciones se guardan como contactos tipo valoracion en `opportunity_contacts`.
- Las R.G. se guardan como contactos tipo R.G. en `opportunity_contacts`.
- Los encargos se guardan en `opportunity_orders`.
- Las visitas se guardan en `visitas`.
- El dashboard calcula metricas desde datos reales de `opportunities`, `opportunity_contacts`, `opportunity_orders` y `visitas`.

En resumen: las acciones operativas importantes no quedan solo en el front. La mayoria se escriben o se leen desde Supabase.

## Que no se guarda, y esta bien que no se guarde

Hay acciones que son solo de uso visual o de navegacion. No necesitan persistencia:

- Cambiar entre tabla y kanban.
- Abrir o cerrar paneles.
- Seleccionar filtros temporales en pantalla.
- Copiar telefonos.
- Abrir WhatsApp desde un telefono.
- Ver ratios, porcentajes o proyecciones del dashboard.

Estos puntos no son un problema mientras el objetivo sea usarlos como ayudas de trabajo en la sesion actual.

## Que conviene revisar

### 1. Reglas de seguridad en Supabase

Desde el codigo se ve que el front usa Supabase, pero no alcanza para confirmar todas las reglas de permisos.

Hay que revisar en Supabase:

- Que cada comercial solo pueda ver y editar lo que corresponda.
- Que coordinadores o admins puedan ver metricas globales.
- Que no haya escrituras abiertas por error.
- Que las tablas criticas tengan Row Level Security bien configurado.

### 2. Uso mixto de `opportunity_contacts`

La tabla `opportunity_contacts` guarda varias cosas distintas:

- Observaciones.
- Historial.
- Valoraciones.
- R.G.
- Eventos generados por acciones.

Estado: revisado y corregido sin crear tablas ni modificar registros existentes.

Revision de los 36 registros existentes:

- 2 observaciones con prefijo `[NOTA]`.
- 4 valoraciones con prefijo `[VALORACION]`.
- 3 R.G. con prefijo `[R.G.]`.
- 27 observaciones antiguas en texto libre.
- Todos tienen lead asociado, fecha funcional y fecha/hora de creacion.

Reglas vigentes:

- `[NOTA]` se muestra en Observaciones.
- `[HISTORIAL]` se muestra en Historial.
- `[VALORACION]` alimenta Valoraciones, Historial, Planning y metricas.
- `[R.G.]` alimenta R.G., Historial, Planning y metricas.
- Los textos libres antiguos se mantienen como observaciones heredadas.

Correcciones realizadas:

- Valoraciones y R.G. interpretan tanto el formato antiguo sin autor como el formato nuevo con autor.
- Planning lee valoraciones, R.G. y visitas realmente persistidas, en lugar de inferirlas desde la fase actual del lead.
- Se mantiene un parser compartido para evitar diferencias entre pantallas.

Conclusion: el uso mixto es consistente mientras todos los nuevos registros mantengan estos prefijos. No es necesario crear otra tabla para el funcionamiento actual.

### 3. Historial de acciones

Estado: revisado, con correcciones pendientes.

El historial ya muestra acciones y persiste en `opportunity_contacts`, pero no todas se registran con el mismo nivel de detalle.

Revision del comportamiento actual:

- El panel del lead registra llamadas con usuario real y fecha/hora de creacion.
- Las observaciones guardan el usuario real y se mantienen separadas del historial.
- Las valoraciones y R.G. guardan autor, fecha programada, hora, medio y resultado cuando corresponde.
- Las ediciones realizadas desde el panel detallan los valores anteriores y nuevos de los campos controlados.
- Los encargos editados desde el panel detallan fechas, importes, comisiones y memo anteriores/nuevos.
- Corregido: las visitas y los encargos editados desde sus pantallas generales registran cada campo modificado con su valor anterior y nuevo.
- Corregido: crear, importar, cambiar de fase o eliminar desde Oportunidades registra el nombre real del usuario autenticado.
- Corregido: la edicion general del lead audita propietario, telefono, domicilio, ubicacion, CP, origen, fechas, asignacion, fase, estado, valor y notas.
- No hay acciones de eliminacion para valoraciones, R.G., encargos o visitas en las pantallas revisadas.

Acciones que deben mantenerse cubiertas:

- Crear.
- Editar.
- Eliminar.
- Cambiar fase.
- Cambiar estado.
- Registrar llamada.
- Crear valoracion.
- Crear R.G.
- Crear encargo.
- Crear visita.

Tambien conviene guardar siempre:

- Usuario real.
- Fecha y hora.
- Accion realizada.
- Valor anterior.
- Valor nuevo.

Conclusion: el historial es util y persistente, pero antes de considerarlo una auditoria completa hay que unificar el autor real y ampliar el detalle de las ediciones realizadas fuera del panel.

### 4. Campos descriptivos e IDs

La aplicacion guarda y consume principalmente textos descriptivos para comerciales, planners y origenes. La vista `crm_leads_view` los expone correctamente aunque el ID relacionado este vacio.

Revision realizada sobre los 3316 leads activos:

- 3034 muestran un comercial real, pero no tienen `comercial_user_id`.
- 2999 muestran un planner/contacto real, pero no tienen `contact_user_id`.
- 3310 muestran un origen real, pero no tienen `source_id`.
- Cuando no existe un nombre, la vista devuelve textos de sustitucion como `Sin comercial` o `Sin contacto`.

El front actual funciona porque lee `comercial_name`, `contact_name` y `source_name`. Tambien crea e importa leads guardando `comercial_user_desc`, `contact_user_desc` y `source_desc`, dejando sus IDs en `null`.

Conclusion: los datos persisten y se muestran, pero la relacion no esta normalizada. Los filtros y metricas por comercial dependen de coincidencias exactas de texto, por lo que un cambio de nombre, una variante ortografica o un duplicado puede dividir resultados. No es un bloqueo para operar, pero si un riesgo de consistencia para reportes y permisos futuros.

### 5. Borrado logico

Algunas operaciones pueden usar `deleted_at` en lugar de borrar fisicamente.

Revision realizada:

- `opportunities` contiene registros con `deleted_at`.
- `crm_leads_view` expone el campo `deleted_at`.
- `crm_leads_view` no devuelve registros con `deleted_at` informado.

Conclusion: las pantallas que leen desde `crm_leads_view` no deberian mostrar ni contar leads eliminados.

### 6. Dashboard sin snapshot historico

El dashboard calcula metricas desde datos actuales.

Eso esta bien para ver el estado vivo del negocio, pero si se quiere comparar exactamente "como estabamos ayer" aunque luego cambien datos, conviene guardar snapshots diarios.

Sin snapshots, el dashboard puede recalcular datos historicos con informacion actualizada.

## Recomendaciones priorizadas

1. Pendiente: revisar reglas de Supabase y permisos por rol.
2. Estandarizar el historial de acciones para que siempre guarde usuario, fecha, accion y cambios.
3. Mantener los prefijos estandarizados de `opportunity_contacts` en todos los nuevos flujos.
4. Evaluar snapshots diarios para metricas historicas del dashboard.
5. Normalizar progresivamente comerciales, planners y origenes con sus IDs, manteniendo los textos actuales para compatibilidad.

## Conclusion

El CRM tiene una base de persistencia correcta para empezar a operar: leads, visitas, valoraciones, R.G., encargos, observaciones e historial tienen conexion con Supabase.

Lo mas importante a mejorar no es el front, sino la trazabilidad fina y la seguridad de datos:

- confirmar permisos,
- ordenar mejor los eventos,
- y decidir si el dashboard debe ser calculado en vivo o guardar cortes historicos diarios.
