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

Funciona, pero a futuro puede volverse dificil de mantener porque una misma tabla representa varios tipos de informacion.

La mejora ideal seria separar o tipificar mejor los eventos, por ejemplo con un campo claro de tipo:

- `note`
- `valuation`
- `rg`
- `audit_event`
- `call`

### 3. Historial de acciones

El historial ya muestra acciones, pero conviene asegurar que todas las acciones importantes se registren de forma consistente:

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

### 4. Campos descriptivos e IDs

Hay campos que parecen guardar textos descriptivos, por ejemplo dominios, owners, planners u origenes.

Esto puede estar bien para mostrar datos rapido, pero conviene revisar si tambien existe el ID real relacionado. Si solo se guarda texto, luego es mas dificil filtrar, agrupar o corregir nombres.

### 5. Borrado logico

Algunas operaciones pueden usar `deleted_at` en lugar de borrar fisicamente.

Eso esta bien, pero hay que confirmar que:

- Las vistas no muestren registros eliminados.
- Las metricas no cuenten registros eliminados.
- El usuario pueda recuperar informacion si corresponde.

### 6. Dashboard sin snapshot historico

El dashboard calcula metricas desde datos actuales.

Eso esta bien para ver el estado vivo del negocio, pero si se quiere comparar exactamente "como estabamos ayer" aunque luego cambien datos, conviene guardar snapshots diarios.

Sin snapshots, el dashboard puede recalcular datos historicos con informacion actualizada.

## Recomendaciones priorizadas

1. Revisar reglas de Supabase y permisos por rol.
2. Confirmar que `crm_leads_view` excluye correctamente registros eliminados o no visibles.
3. Estandarizar el historial de acciones para que siempre guarde usuario, fecha, accion y cambios.
4. Revisar si `opportunity_contacts` deberia tener tipos mas claros o una estructura separada para auditoria.
5. Evaluar snapshots diarios para metricas historicas del dashboard.
6. Normalizar campos de comerciales, planners, dominios y origenes con IDs cuando sea necesario.

## Conclusion

El CRM tiene una base de persistencia correcta para empezar a operar: leads, visitas, valoraciones, R.G., encargos, observaciones e historial tienen conexion con Supabase.

Lo mas importante a mejorar no es el front, sino la trazabilidad fina y la seguridad de datos:

- confirmar permisos,
- ordenar mejor los eventos,
- y decidir si el dashboard debe ser calculado en vivo o guardar cortes historicos diarios.

