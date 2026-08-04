# Inventario de lo deprecable — tarea 18

**Nada de esto se borró.** Es la lista de candidatos con su evidencia, para que
la apruebes (o descartes) ítem por ítem antes de tocar nada. La tarea decía
"elimina/deprecar todo lo comercial que ya no se usa tras la migración", pero sin
definir qué entra en "lo comercial", y borrar por interpretación propia es
exactamente lo que no corresponde acá.

Cómo leer cada ítem: **qué es** → **evidencia de que no se usa** → **riesgo de
borrarlo**.

---

## A. Muerto de verdad (borrado seguro)

### A1. `client/src/pages/salesperson-dashboard.tsx`

- **Evidencia:** ningún archivo lo importa y `/salesperson-dashboard` no existe
  como ruta en `App.tsx`.
- **Además es un bug hoy:** [salesperson-detail.tsx:191](client/src/pages/salesperson-detail.tsx:191)
  hace `setLocation('/salesperson-dashboard')`, o sea navega a una ruta que no
  existe → el usuario cae en la pantalla de 404.
- **Riesgo:** ninguno. Al borrar la página hay que arreglar ese redirect (debería
  ir a `/` o a `/mis-vendedores`).

### A2. Archivos `.backup` versionados

```
client/src/pages/date-selector-demo.tsx.backup
server/etl-incremental.ts.backup
server/etl-nvv.ts.backup
server/storage.ts.backup_1762560202
shared/schema.ts.backup
```

- **Evidencia:** no los compila ni los importa nada; son copias manuales que
  quedaron commiteadas. `shared/schema.ts.backup` y `server/storage.ts.backup_*`
  pesan lo mismo que los originales y confunden las búsquedas del repo.
- **Riesgo:** ninguno — el historial de git ya es el respaldo.

### A3. Sesiones y cookies de prueba en la raíz (17 archivos `.txt`)

```
admin_cookies.txt  admin_session.txt  auth_session.txt  cookies.txt
fresh_admin_session.txt  fresh_session.txt  supervisor_session.txt
test_cookies.txt  test_session.txt  test_logout_session.txt
logout_test_session.txt  final_test_session.txt  j.txt
Sin título 2.txt  db-migration-responses.txt  respaldo-17marzo.txt
documentos para el haras.txt
```

- **Evidencia:** son volcados de `curl -c/-b` de sesiones de debug.
- **Riesgo de NO borrarlos:** algunos son cookies de sesión reales de admin y
  supervisor. Aunque estén expiradas, no deberían estar versionadas.
- **Sugerencia:** borrarlos y agregar `*_session.txt`, `*cookies*.txt` al
  `.gitignore`.

### A4. Scripts sueltos de diagnóstico en la raíz (22 archivos `.ts`/`.js`)

`check_db.ts`, `check_users.ts`, `check-wh.ts`, `query_febrero.ts`,
`test-api.ts`, `test_totals.js`, `fix_storage.js`, `fix_marketing_v5.js`,
`add_creatividades_routes.js`, `etl-diagnose.ts`, `test_ytd_script.ts`… entre
otros.

- **Evidencia:** ninguno se importa desde `server/` ni está en `package.json`.
- **Riesgo:** bajo, pero conviene revisarlos de a uno: algunos pueden ser
  runbooks de ETL que alguien todavía corre a mano. **Propuesta:** moverlos a
  `scripts/diagnostico/` en vez de borrarlos.

---

## B. Vivo pero sin puerta de entrada (decisión tuya)

Estas rutas existen y funcionan, pero no tienen ningún enlace en la aplicación:
solo se llega escribiendo la URL. Puede ser deliberado (acceso directo para
alguien) o puede ser una pantalla olvidada.

| Ruta | Enlaces internos | Comentario |
|---|---|---|
| `/rutas-comerciales` | 0 | Vive como pestaña del Panel de Trabajo; la ruta suelta quedó huérfana |
| `/logistica` | 0 | Convive con `/logistica-rutas`, que sí está en el menú |
| `/logistica-tms` | 0 | Sin enlaces ni sidebar |
| `/date-selector-demo` | 0 | Demo de desarrollo, con su propio `.backup` al lado |
| `/tomador-pedidos` | 0 | El menú apunta a `/tomador-pedidos-v2`; el clásico se dejó a propósito como respaldo |

**Ojo con las últimas dos filas:** el tomador clásico está documentado en el
código como respaldo deliberado ("para que los vendedores tengan respaldo si algo
falla en el nuevo"). No lo tocaría sin que lo confirmes.

Además hay tres módulos **ocultos del sidebar a propósito**, con el comentario en
el código explicándolo — estos NO son candidatos, los listo para que no aparezcan
como falsos positivos en una limpieza futura:

- `/seguimiento-clientes` (CRM)
- `/cotizaciones-b2c`
- `/visitas-tecnicas` (vive como pestaña del Panel de Trabajo)

---

## C. Lo que NO toqué y necesita tu definición

**"Lo comercial que ya no se usa tras la migración"** puede significar dos cosas
distintas y no da lo mismo:

1. **El formato viejo de rendición de gastos** (los gastos sueltos, fuera de un
   informe). Es lo que sugiere el contexto de la tarea 17. En este PR se marcó
   como formato anterior en la UI y se dejó Informes como entrada por defecto,
   pero **no se eliminó**: hay gastos productivos cargados así y sacarlos de
   pantalla sin migrarlos los haría desaparecer para quien los cargó.

2. **Módulos comerciales legacy** (promesas de compra, rutas comerciales,
   proyecciones). Todos tienen datos y pantallas activas; ninguno cumple
   "ya no se usa" solo por no estar en el menú.

Decime cuál de las dos era y lo ejecuto.
