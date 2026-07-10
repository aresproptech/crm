# Mapa de persistencia CRM

Documento auditado desde el front actual. Indica que acciones leen o escriben datos en Supabase y cuales son solo calculos/estado visual del navegador.

> Nota: este mapa confirma el uso desde el codigo frontend. No confirma politicas RLS, triggers, constraints ni permisos internos de Supabase.

## Resumen de tablas

| Tabla / vista | Uso principal | Escribe front | Lee front |
|---|---|---:|---:|
| `opportunities` | Registro base de oportunidades/leads | Si | Indirectamente via vista |
| `crm_leads_view` | Vista enriquecida de leads para tablas, paneles y metricas | No | Si |
| `opportunity_contacts` | Observaciones, historial, llamadas, valoraciones y R.G. | Si | Si |
| `opportunity_orders` | Encargos | Si | Si |
| `visitas` | Visitas y compradores | Si | Si |
| `phases` | Resolver IDs de fase | No | Si |
| `profiles` | Usuario CRM y rol | No | Si |
| `postal` | Lookup de codigo postal | No | Si |

## Oportunidades / Leads

| Accion en front | Tabla / vista | Operacion | Columnas usadas | Persistencia | Archivo |
|---|---|---|---|---|---|
| Listar leads | `crm_leads_view` | `select` | `*` | Solo lectura | `app/(crm)/leads/page.tsx` |
| Importar CSV | `opportunities` | `insert` | `propietario`, `domicilio`, `telefono`, `tasacion`, `estado`, `fecha`, `source_desc`, `comercial_user_desc`, `contact_user_desc`, `dominio_desc`, `postal_id`, `fase_id`, `created_at`, `memo`, `en_venta`, `medio`, `source_id`, `comercial_user_id`, `contact_user_id`, `team_id`, `deleted_at` | Guarda | `app/(crm)/leads/page.tsx` |
| Crear lead manual | `opportunities` | `insert` | `propietario`, `domicilio`, `telefono`, `tasacion`, `estado`, `fecha`, `fecha_contacto`, `fecha_valoracion`, `hora`, `source_desc`, `comercial_user_desc`, `contact_user_desc`, `dominio_desc`, `postal_id`, `fase_id`, `created_at`, `memo`, `en_venta`, `medio`, IDs relacionales null | Guarda | `app/(crm)/leads/page.tsx` |
| Editar lead | `opportunities` | `update` | `propietario`, `domicilio`, `telefono`, `tasacion`, `estado`, `fecha`, `fecha_contacto`, `fecha_valoracion`, `hora`, `source_desc`, `comercial_user_desc`, `contact_user_desc`, `dominio_desc`, `memo`, `medio`, `en_venta`, `fase_id`, `postal_id` | Guarda | `app/(crm)/leads/page.tsx` |
| Leer lead actualizado | `crm_leads_view` | `select` | `*` por `id` | Solo lectura | `app/(crm)/leads/page.tsx` |
| Mover en Kanban / cambiar fase | `opportunities` | `update` | `fase_id` | Guarda | `app/(crm)/leads/page.tsx` |
| Marcar favorito | `opportunities` | `update` | `is_favorite` | Guarda | `app/(crm)/leads/page.tsx` |
| Eliminar seleccionados | `opportunities` | `update` soft delete | `deleted_at` | Guarda | `app/(crm)/leads/page.tsx` |
| Resolver fase | `phases` | `select` | `id`, `name` | Solo lectura | `app/(crm)/leads/page.tsx` |
| Filtros, busqueda, orden, seleccion | Estado React local | N/A | No aplica | No guarda | `app/(crm)/leads/page.tsx` |

## Historial y observaciones

| Accion en front | Tabla | Operacion | Columnas usadas | Persistencia | Observacion |
|---|---|---|---|---|---|
| Registrar actividad general | `opportunity_contacts` | `insert` | `opportunity_id`, `fecha`, `memo`, `resultado` | Guarda | Memo con prefijo `[HISTORIAL] Nombre: texto` |
| Agregar observacion manual | `opportunity_contacts` | `insert` + `select` verificacion | `opportunity_id`, `fecha`, `memo`, `resultado` | Guarda | Memo con prefijo `[NOTA] Nombre: texto` |
| Cargar observaciones e historial | `opportunity_contacts` | `select` | `id`, `created_at`, `fecha`, `memo`, `resultado` | Solo lectura | Filtra por `opportunity_id` |
| Click en llamar | `opportunity_contacts` | `insert` | `opportunity_id`, `fecha`, `memo`, `resultado` | Guarda | Guarda `[HISTORIAL] Nombre: Llamo al lead` |
| Contador ultima llamada | `opportunity_contacts` | lectura/calculo | `created_at`, `memo` | No guarda contador | Se calcula desde historial |
| Cambios en campos del panel | `opportunities` + `opportunity_contacts` | `update` + `insert historial` | Campos del lead + memo historial | Guarda | Edicion real via `onSaveLead`; auditoria en historial |

## Valoraciones

| Accion en front | Tabla / vista | Operacion | Columnas usadas | Persistencia | Archivo |
|---|---|---|---|---|---|
| Agregar valoracion desde panel | `opportunity_contacts` | `insert` | `opportunity_id`, `fecha`, `memo`, `resultado` | Guarda | `components/crm/lead-detail-panel.tsx` |
| Editar valoracion desde panel | `opportunity_contacts` | `update` | `opportunity_id`, `fecha`, `memo`, `resultado` por `id` | Guarda | `components/crm/lead-detail-panel.tsx` |
| Listar historial de valoraciones en panel | `opportunity_contacts` | `select` | `id`, `created_at`, `fecha`, `memo`, `resultado` | Solo lectura | `components/crm/lead-detail-panel.tsx` |
| Listar pagina Valoraciones | `opportunity_contacts` | `select` | `id`, `opportunity_id`, `fecha`, `memo`, `created_at` con `memo ilike '[VALORACION]%'` | Solo lectura | `app/(crm)/valoraciones/page.tsx` |
| Enriquecer pagina Valoraciones | `crm_leads_view` | `select` | `*` | Solo lectura | `app/(crm)/valoraciones/page.tsx` |
| Impacto en dashboard comercial | `opportunity_contacts` | lectura/calculo | `memo`, `fecha`, `created_at`, `opportunity_id` | No guarda metrica | Cuenta memos `[VALORACION]` |

Formato actual de memo: `[VALORACION] Nombre: Medio: X | Hora: HH:mm`.

## R.G.

| Accion en front | Tabla / vista | Operacion | Columnas usadas | Persistencia | Archivo |
|---|---|---|---|---|---|
| Agregar R.G. desde panel | `opportunity_contacts` | `insert` | `opportunity_id`, `fecha`, `memo`, `resultado` | Guarda | `components/crm/lead-detail-panel.tsx` |
| Editar R.G. desde panel | `opportunity_contacts` | `update` | `opportunity_id`, `fecha`, `memo`, `resultado` por `id` | Guarda | `components/crm/lead-detail-panel.tsx` |
| Listar historial R.G. en panel | `opportunity_contacts` | `select` | `id`, `created_at`, `fecha`, `memo`, `resultado` | Solo lectura | `components/crm/lead-detail-panel.tsx` |
| Listar pagina R.G. | `opportunity_contacts` | `select` | `id`, `opportunity_id`, `fecha`, `memo`, `created_at` con `memo ilike '[R.G.]%'` | Solo lectura | `app/(crm)/rg/page.tsx` |
| Enriquecer pagina R.G. | `crm_leads_view` | `select` | `*` | Solo lectura | `app/(crm)/rg/page.tsx` |
| Impacto en dashboard comercial | `opportunity_contacts` | lectura/calculo | `memo`, `fecha`, `created_at`, `opportunity_id` | No guarda metrica | Cuenta memos `[R.G.]` |

Formato actual de memo: `[R.G.] Nombre: Medio: X | Resultado: Y | Hora: HH:mm`.

## Encargos

| Accion en front | Tabla / vista | Operacion | Columnas usadas | Persistencia | Archivo |
|---|---|---|---|---|---|
| Cargar encargos del panel | `opportunity_orders` | `select` | `*` por `opportunity_id` | Solo lectura | `components/crm/lead-detail-panel.tsx` |
| Agregar encargo desde panel | `opportunity_orders` | `insert` | `opportunity_id`, `fecha_inicio`, `fecha_fin`, `pvp_inicial`, `pvp_actual`, `pvp_estimado`, `com_vendedor`, `com_comprador`, `memo` | Guarda | `components/crm/lead-detail-panel.tsx` |
| Editar encargo desde panel | `opportunity_orders` | `update` | mismas columnas por `id` | Guarda | `components/crm/lead-detail-panel.tsx` |
| Registrar historial encargo | `opportunity_contacts` | `insert` | `opportunity_id`, `fecha`, `memo`, `resultado` | Guarda | `components/crm/lead-detail-panel.tsx` |
| Listar pagina Encargos | `crm_leads_view` + `opportunity_orders` | `select` | leads en fase Encargo + `opportunity_orders.*` | Solo lectura | `app/(crm)/encargos/page.tsx` |
| Crear/editar encargo desde pagina Encargos | `opportunity_orders` | `insert` / `update` | `opportunity_id`, fechas, PVPs, comisiones, `memo`, `rebajas` | Guarda | `app/(crm)/encargos/page.tsx` |
| Calcular rebajas | `opportunity_orders` | calculo antes de guardar | `pvp_actual`, `rebajas` | Guarda solo `rebajas` final | Incrementa si baja PVP actual |
| Health / actividad reciente | `opportunity_contacts`, `visitas` | `select` | R.G. ultimos 15 dias, visitas ultimos 30 dias | Solo lectura | `app/(crm)/encargos/page.tsx` |

## Visitas

| Accion en front | Tabla / vista | Operacion | Columnas usadas | Persistencia | Archivo |
|---|---|---|---|---|---|
| Listar visitas | `visitas` | `select` | `*` | Solo lectura | `app/(crm)/visitas/page.tsx` |
| Filtrar visitas para Comercial | `visitas` | `select` con filtro | `owner`, `planner` | Solo lectura | `app/(crm)/visitas/page.tsx` |
| Cargar inmuebles para visita | `crm_leads_view` | `select` | `id`, `propietario`, `domicilio`, `comercial_name`, `dominio_desc`, `telefono`, `estado` | Solo lectura | `app/(crm)/visitas/page.tsx` |
| Agregar visita | `visitas` | `insert` | `opportunity_id`, `estado`, `dominio`, `planner`, `owner`, `fecha_visita`, `hora`, `buyer`, `nombre_apellido`, `telefono`, `dni`, `vende`, `observaciones_visita`, `created_by` | Guarda | `app/(crm)/visitas/page.tsx` |
| Editar visita | `visitas` | `update` | `fecha_visita`, `hora`, `nombre_apellido`, `telefono`, `buyer`, `dni`, `vende`, `observaciones_visita` por `id` | Guarda | `app/(crm)/visitas/page.tsx` |
| Registrar historial de visita | `opportunity_contacts` | `insert` | `opportunity_id`, `fecha`, `memo`, `resultado` | Guarda | Texto: agrego/edito visita |
| Copiar telefonos seleccionados | Clipboard navegador | N/A | `telefono` | No guarda | Solo portapapeles |
| Click telefono / WhatsApp | Navegacion externa | N/A | `telefono` | No guarda | Abre WhatsApp/telefono segun implementacion |
| Impacto dashboard comercial | `visitas` | lectura/calculo | `opportunity_id`, `fecha_visita`, `created_at` | No guarda metrica | Cuenta visitas por fecha |

## Dashboard

| Bloque | Tabla / vista | Operacion | Columnas usadas | Guarda? | Comentario |
|---|---|---|---|---|---|
| Metricas generales | `crm_leads_view` | `select` | `*` | No | Calcula fases, estados, origen, comercial |
| Actividad comerciales | `crm_leads_view` | `select` | `id`, fechas, fase, estado, comercial, dominio, origen | No | Base para atribuir acciones |
| Valoraciones/R.G. dashboard | `opportunity_contacts` | `select` | `id`, `opportunity_id`, `fecha`, `memo`, `created_at` | No | Cuenta memos por prefijo |
| Encargos dashboard | `opportunity_orders` | `select` | `id`, `opportunity_id`, `created_at` | No | Cuenta por fecha de creacion |
| Visitas dashboard | `visitas` | `select` | `id`, `opportunity_id`, `fecha_visita`, `created_at` | No | Cuenta por fecha de visita/creacion |
| Periodos del dashboard | Estado React local | N/A | `period`, `customFrom`, `customTo` | No | Solo filtro visual |
| Promedio, proyectado, gap, ratios | Calculo frontend | N/A | Datos leidos | No | No persiste resultados |

## Planning

| Accion en front | Tabla / vista | Operacion | Columnas usadas | Persistencia |
|---|---|---|---|---|
| Cargar planning | `crm_leads_view` | `select` | `*` | Solo lectura |
| Agrupar por fechas | Calculo frontend | N/A | fechas del lead | No guarda |

## Usuarios y permisos visibles

| Accion / regla | Tabla | Operacion | Columnas usadas | Persistencia |
|---|---|---|---|---|
| Obtener usuario CRM | `profiles` | `select` | `*` filtrando `auth_id` | Solo lectura |
| Login | Supabase Auth | `signInWithPassword` | email/password | Sesion Auth |
| Logout | Supabase Auth | `signOut` | N/A | Cierra sesion |
| Ver todos los leads | Regla frontend | N/A | `rol` | No guarda |
| Editar leads | Regla frontend | N/A | `rol` | No guarda |

Reglas frontend actuales:

- `Admin` y `Coordinador` pueden ver todos los leads.
- `Comercial` ve sus propios leads en varias vistas.
- `Admin` y `Comercial` pueden editar leads segun helper `canEditLeads`.
- El sidebar limita algunas secciones por rol.

Pendiente de confirmar en backend:

- Politicas RLS por tabla.
- Si `crm_leads_view` aplica filtros por usuario desde Supabase o solo desde front.
- Si existen triggers que completen IDs relacionales desde campos `_desc`.
- Si `opportunities.deleted_at` excluye filas en todas las vistas relevantes.

## Cosas que se ven en front pero no persisten como registro propio

| Elemento | Donde se calcula | Fuente |
|---|---|---|
| Contador ultima llamada | Panel lead | `opportunity_contacts.memo` con `Llamo al lead` |
| Promedios/proyecciones/gaps | Dashboard | Leads/contactos/encargos/visitas |
| Seleccion de filas | Estado React | Navegador |
| Busquedas y filtros | Estado React | Navegador |
| Modo tabla/kanban | Estado React | Navegador |
| Copia de telefonos | Clipboard | Navegador |
| Apertura de WhatsApp | URL externa | Telefono de visita |

## Riesgos / puntos a revisar

| Riesgo | Motivo | Recomendacion |
|---|---|---|
| Auditoria de autor en registros antiguos | Algunos memos antiguos no guardaban nombre real | Migrar o aceptar fallback visual |
| Historial en `opportunity_contacts` mezcla notas, R.G., valoraciones y eventos | Se distingue por prefijos en `memo` | Mantener convencion estricta de prefijos |
| Dashboard no guarda snapshots | Todo se recalcula al abrir | Si se necesita historico fijo, crear tabla de snapshots |
| Seguridad depende de RLS | El front filtra, pero no alcanza como seguridad fuerte | Auditar policies Supabase |
| Campos `_desc` vs IDs relacionales | El front inserta muchos IDs como null y guarda descripciones | Confirmar triggers/vista o normalizar |
