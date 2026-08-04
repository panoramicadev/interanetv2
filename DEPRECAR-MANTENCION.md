# Mantención (CMMS) — oculto del sidebar, pendiente de eliminación

**Estado: oculto, NO borrado.** El módulo completo de Mantención (CMMS) salió del
menú lateral de todos los roles. El código, las rutas, los permisos y las tablas
siguen intactos.

La idea es la de siempre en este repo (mismo camino que se usó con CRM, Visitas
Técnicas y Campañas Mailing): primero se saca el acceso, se deja correr un tiempo,
y recién cuando nadie lo reclama se borra el código. Así, si mañana aparece alguien
de planta diciendo "yo cargaba las OT ahí", volver atrás es revertir un commit y no
recuperar 10.000 líneas del historial.

---

## 1. Qué se cambió para ocultarlo

### `client/src/config/sidebar-config.ts`

Se sacó el ítem "Mantención" (y todo su desplegable) de los 8 roles que lo tenían:

| Rol | Qué tenía | Cómo queda |
|---|---|---|
| `admin` | grupo con 9 sub-ítems | sin el grupo |
| `supervisor` | grupo con 9 sub-ítems | sin el grupo |
| `jefe_planta` | grupo con 9 sub-ítems | sin el grupo |
| `mantencion` | grupo con 5 sub-ítems, **era su único módulo** | queda `[]` (ver §3) |
| `produccion` | Órdenes de Trabajo + Calendario | sin el grupo |
| `logistica_bodega` | Órdenes de Trabajo + Calendario | sin el grupo |
| `planificacion` | Órdenes de Trabajo + Calendario | sin el grupo |
| `bodega_materias_primas` | Órdenes de Trabajo + Calendario | sin el grupo |

### `client/src/lib/sidebar-permissions.ts`

Se comentó el grupo `Mantención` de `EXTRA_GROUPS`. **Esto no es opcional:** el
sidebar final se arma como "base del rol filtrado por permisos + extras que el rol
tiene por permiso y el base no muestra". Si el grupo quedaba en `EXTRA_GROUPS`,
cualquier rol con permisos `cmms.*` se lo veía reaparecer al final del menú, que es
exactamente lo que se quería esconder.

### `shared/module-map.ts`

Los 9 módulos CMMS pasaron a `nav: null`. Ese mapa es lo que le enseña la intranet
al asistente de IA y lo que usa el tour guiado para marcar en pantalla dónde hacer
clic. Sin este cambio el asistente seguiría diciendo "andá a Mantención en el menú"
y el tour marcaría un ítem que ya no existe. Con `nav: null` el asistente pasa a
decir la ruta directa, que es lo que corresponde mientras el módulo siga vivo.

---

## 2. Qué NO se tocó (y sigue funcionando)

- **Las rutas.** `/mantenciones` y `/cmms/*` siguen registradas en `client/src/App.tsx`
  (líneas ~322-331). Quien tenga el link guardado entra igual.
- **Los permisos.** Las 9 claves `cmms.*` siguen en `shared/permissions.ts`, siguen
  gobernando el acceso a cada ruta y siguen apareciendo en Configuración → Roles y
  Permisos. Un admin puede seguir dando y quitando el acceso; simplemente no genera
  ítem de menú.
- **La API.** Los 72 endpoints (`/api/mantenciones/*` y `/api/cmms/*`) siguen arriba.
- **Los datos.** Ninguna tabla se tocó.
- **La navegación interna del módulo.** `CmmsNavigation` / `CmmsLayout` siguen
  armando el menú propio de las pantallas CMMS, para quien entre por URL.

---

## 3. Efectos secundarios a mirar antes de dar esto por cerrado

1. **El rol `mantencion` se queda sin menú.** Su sidebar era solo el CMMS; ahora le
   queda únicamente "Rendición de Gastos" (que se agrega automáticamente a todos los
   roles al final de `sidebar-config.ts`). **Sigue pudiendo trabajar**: en
   `App.tsx` la ruta `/` renderiza `MantencionesPage` para `mantencion` y
   `jefe_planta`, o sea que al entrar aterriza directo en Órdenes de Trabajo. Lo que
   perdió es poder navegar a las otras pantallas del módulo desde el menú.
   **Decisión pendiente:** si el módulo se elimina de verdad, hay que definir qué
   pasa con ese rol (¿se borra?, ¿aterriza en Reclamos como el resto de planta?).
2. **`jefe_planta` también aterriza en `/mantenciones`** por la misma razón, aunque
   ese rol sí conserva menú (Reclamos, Productos, Tintometría).
3. **Las notificaciones siguen apuntando ahí.** `server/notifications-helper.ts`
   (`notifyMantencionCreada`, `notifyMantencionResuelta`) manda avisos con
   `actionUrl: "/mantenciones"`. El link funciona, pero lleva a una pantalla sin
   acceso en el menú.

---

## 4. Inventario de lo que hay que borrar cuando se confirme la baja

Nada de esto está borrado. Es la lista para el día que se apruebe la eliminación.

### 4.1 Frontend — páginas (≈9.400 líneas)

```
client/src/pages/mantenciones.tsx                     2411
client/src/pages/cmms-equipos.tsx                     1422
client/src/pages/cmms-gastos-materiales.tsx           1144
client/src/pages/cmms-mantenciones-planificadas.tsx    892
client/src/pages/cmms-planes-preventivos.tsx           888
client/src/pages/cmms-dashboard.tsx                    670
client/src/pages/cmms-proveedores.tsx                  661
client/src/pages/cmms-presupuesto.tsx                  649
client/src/pages/cmms-calendario.tsx                   536
```

### 4.2 Frontend — soporte

```
client/src/components/layout/CmmsNavigation.tsx        105
client/src/components/layout/CmmsLayout.tsx             44
client/src/lib/cmmsPermissions.ts                      140
```

- `client/src/App.tsx`: los 9 imports (líneas ~58-70) y las 10 rutas (~322-331).
- `client/src/components/layout/dashboard-layout.tsx`: las dos excepciones
  `c.href !== "/mantenciones"` en el cálculo del ítem activo (líneas 172 y 260)
  existen solo por este módulo (su padre y un hijo comparten href).
- `client/src/config/sidebar-config.ts` y `client/src/lib/sidebar-permissions.ts`:
  los comentarios que dejó este cambio, el bloque `mantencion: []` y el import
  `Wrench` si queda sin uso.

### 4.3 Backend

- `server/routes.ts`: 21 endpoints `/api/mantenciones/*` + 51 endpoints
  `/api/cmms/*` (a partir de la línea ~26056).
- `server/auth.ts`: los middlewares `requireCMMSFullAccess`, `requireCMMSMaintenance`
  y `requireCMMSPlantStaff` (línea ~463), que no los usa nadie más.
- `server/storage.ts`: ~378 líneas con métodos CMMS.
- `server/routes-external.ts`: ~15 menciones (revisar si algún integrador externo
  las consume antes de tocarlas).
- `server/notifications-helper.ts`: `notifyMantencionCreada` y
  `notifyMantencionResuelta` (líneas 191-220) y el tipo de correo
  `mantencion_preventiva`.
- `server/ai-agent.ts`: 1 mención.

### 4.4 Permisos y roles

- `shared/permissions.ts`: el módulo `mantencion` (línea 45), las 9 claves `cmms.*`
  (líneas ~261-325), la lista de permisos por rol (~497-505), la constante
  `CMMS_BASICO` (~507) y las asignaciones por rol (~541, ~605-609).
- `shared/permissions.ts` / `client/src/pages/users.tsx`: el rol `mantencion` en
  `ROLE_LABELS` y en los `<SelectItem>` del alta de usuarios (líneas 1097 y 1508).
  **Antes de sacarlo hay que ver qué usuarios lo tienen asignado hoy.**

### 4.5 Capacitación

- `shared/module-map.ts`: los 9 `ModuleDef` del grupo "Mantención (CMMS)"
  (líneas ~1296-1480), con sus guías (`crear-orden-trabajo`,
  `ejecutar-orden-trabajo`).
- `API.md` (6 menciones) y `replit.md` (3 menciones).

### 4.6 Base de datos — **lo último, y solo con respaldo**

```
equipos_criticos
proveedores_mantencion
presupuesto_mantencion
gastos_materiales_mantencion
mantenciones_planificadas
solicitudes_mantencion
mantencion_photos
mantencion_resolucion_photos
mantencion_historial
```

Definidas en `shared/schema.ts` (líneas ~4717-4985). Antes de un `drop`: contar
filas de cada una, exportar las que tengan historial real y confirmar que ninguna
tiene FK desde tablas que se quedan. Las fotos además viven en object storage.

---

## 5. Cómo revertir

Revertir el commit que ocultó el módulo alcanza: no hubo migraciones, ni borrado de
datos, ni cambios de permisos. El menú vuelve tal cual estaba para los 8 roles.

## 6. Antes de borrar de verdad

1. Confirmar con planta / jefe de planta que el CMMS ya no se usa.
2. Mirar la última fecha de actividad en `solicitudes_mantencion` y
   `mantencion_historial` (si hay OT de este mes, el módulo está vivo).
3. Definir el destino del rol `mantencion` y de los usuarios que lo tengan.
4. Sacar `mantencion_preventiva` de las notificaciones por correo.
5. Recién ahí borrar código, y en un commit aparte las tablas.
