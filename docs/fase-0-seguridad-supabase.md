# Fase 0 — seguridad de Supabase

Actualizado: 14 de septiembre de 2026. Proyecto de prueba: `rzgedcknhcoprcpdtrki`.
El usuario confirmó que los datos son desechables y autorizó continuar sin backup.
No se hizo reset ni se borraron datos como parte del despliegue.

## Aplicado

Cuatro migraciones aplicadas con `supabase db push` y registradas en remoto:

- `20260908090000`: permisos mínimos, RLS de las cinco tablas centrales y vista con `security_invoker`.
- `20260908091000`: tablas de documentación y bucket privado `lead-documentation`, máximo 15 MB por archivo, PDF/JPEG/PNG/WebP.
- `20260908100000`: protección de catálogos, secuencias e historial antiguo; retirada del acceso a helpers heredados.
- `20260908101000`: RPC de borrado lógico e historial en una transacción. El frontend de Leads usa esta RPC.

Antes, una sesión anónima podía leer 3316 filas de la vista, 4785 oportunidades,
54 contactos, 11 visitas y 14 perfiles. Después, las 14 relaciones comprobadas
por la sonda API responden con denegación de permisos `42501`.

## Verificado

- `npm run security:supabase:anon`: PASS, acceso anónimo bloqueado en las 14 relaciones.
- `npx supabase@2.117.0 db query --linked --file supabase/tests/role-access.sql`: PASS.
  Se simularon las identidades de los 9 perfiles habilitados vinculados a Auth,
  comprobando visibilidad de la vista, bloqueo de edición ajena y de escalada
  de comerciales. Para perfiles con oportunidades editables se probó escritura
  documental y borrado lógico. Todas las escrituras de prueba se revirtieron.
- `npx tsc --noEmit`: PASS.
- `npm run build`: PASS con Next.js 16.3.4 y comprobación de TypeScript activa.
- `npm audit --omit=dev`: PASS, 0 vulnerabilidades conocidas en dependencias de producción.
- `npm run lint`: PASS sin errores. Quedan 43 avisos de deuda técnica de React/Next.
- Petición HTTP sin sesión a `/leads`: redirección `307` a `/login`; `/login` responde `200`.
- Sesión existente de Facu (Coordinador): `/leads` carga correctamente después
  del cambio de proxy y devuelve los 3316 leads activos.
- No hay archivos `.env`, claves privadas `.key` ni `.pem` versionados por Git.

El control de sesión del servidor está en `proxy.ts` y valida el token mediante
`supabase.auth.getUser()`. Se retiró el antiguo `middleware.ts`, que utilizaba
`getSession()` y sólo confiaba en la cookie local. El build ya no ignora errores
de TypeScript.

El esquema remoto actual se capturó de forma declarativa en `supabase/schemas/`
con tablas, vistas, funciones, secuencias, privilegios, extensiones y políticas
de `public` y `storage`. Esto permite conservar como código la base histórica
sobre la que se aplican las migraciones de esta fase.

Las pruebas pgTAP de `supabase/tests/database` están preparadas, pero NO ejecutadas.
Prueba de navegador realizada con la sesión existente Facu (Coordinador):
- Carga de `crm-documentacion-prueba.png` (imagen ficticia de 2×2, sin datos personales)
  en «Prueba 16-06», requisito DNI/pasaporte, autorizada por el usuario.
- El requisito pasa de Falta a Completo y muestra nombre de archivo y autor.
- Tras recargar y volver a abrir el lead, el archivo y su estado persisten.
- Abrir archivo obtiene una URL firmada de Storage; la imagen se descarga y
  renderiza correctamente (`complete=true`, dimensiones naturales 2×2).
- El adjunto ficticio queda en el lead de prueba. No valida un DNI real.
- No se probó guardar una copia local con el navegador, eliminar el adjunto,
  ni el recorrido de archivos con otros roles. La sesión ya estaba iniciada;
  esto no constituye una prueba de login desde cero.

## Matriz aplicada

| Perfil | Lectura | Escritura |
|---|---|---|
| Admin / Coordinador | CRM activo | CRM activo y gestión de perfiles/catálogos |
| Comercial | Oportunidades asignadas por nombre | Sus oportunidades |
| Comercial con `can_manage_visits` | Sólo Visitas y datos mínimos del inmueble | Crear y editar Visitas |
| Deshabilitado / sin perfil | Sin datos operativos | Sin escritura operativa |
| Anónimo | Sin acceso | Sin acceso |

El perfil propio puede consultarse para resolver el estado de la sesión.
La identificación del gestor de visitas ya usa un permiso explícito en el perfil.
El rol de Gonzalo continúa siendo `Comercial`, pero no puede leer Oportunidades ni
los flujos comerciales. La base de datos sólo permite crear una visita nueva si
la oportunidad está activa y en fase Encargo; conocer otro ID no permite saltar
esa regla.
Cinco perfiles aún no están vinculados a una cuenta Auth.

## Pendiente antes de declarar producción

1. Probar en navegador login y operaciones con cada rol, especialmente visitas,
   documentos, reasignación y borrado. Las pruebas SQL no sustituyen el recorrido UI.
2. Ensayar la reconstrucción del esquema declarativo y las migraciones sobre una
   base limpia. La captura existe, pero no se pudo reproducir localmente porque
   Docker no está instalado.
3. Ejecutar la suite pgTAP y ampliar pruebas de archivos, usuarios deshabilitados
   y accesos cruzados. Revisar permiso de Coordinador para administrar perfiles.
4. Completar los casos ambiguos de asignación. El permiso explícito de gestión de
   visitas ya está aplicado; las coincidencias únicas y las nuevas escrituras usan
   IDs. Ver `fase-1-integridad-datos.md`.
5. Revisar configuración Auth remota (registro, contraseñas, URLs); los valores
   de `config.toml` no se aplican a Auth remoto mediante `db push`.
6. Resolver progresivamente los 43 avisos actuales de lint, además de completar
   validaciones funcionales y observabilidad. No se declara apto para producción aún.
7. Para la futura base real: entorno de pruebas separado y estrategia de copias
   de base de datos y Storage. No es requisito para conservar estos datos de prueba.

No se hizo commit, push de Git ni despliegue del frontend en este paso.
