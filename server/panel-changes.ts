/**
 * Panel de Trabajo — registro de cambios por sección y marcadores de "visto".
 *
 * Cada mutación del panel (tareas, seguimiento, estimación de ventas, marketing,
 * CRM, rutas comerciales) llama a logPanelChange() para dejar una fila en
 * panel_change_log. El cliente consulta /api/panel-changes/summary (polling)
 * para pintar los badges de las pestañas y de la campana junto al selector de
 * Área, y marca lo visto con /api/panel-changes/seen al entrar a una sección;
 * los ids de las filas no vistas se usan para destacar los ítems cambiados.
 *
 * El "visto" se guarda por (usuario, sección, segmento) para que un cambio en
 * otra área no se dé por visto al revisar la propia. Los cambios sin segmento
 * viven en el bucket '__all'.
 *
 * Excepción — visto POR FICHA: los cambios sobre una tarea o un seguimiento de
 * cliente no se dan por vistos al entrar a la pestaña, sino al abrir esa ficha
 * (panel_change_entity_seen). Con decenas de clientes en seguimiento, entrar a
 * la pestaña borraba todos los avisos de una vez y había que revisarlos uno a
 * uno para saber cuál tenía novedades (pedido del usuario, oct-2026).
 */
import type { Express } from "express";
import { and, desc, eq, gte, inArray, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import {
  panelChangeEntitySeen,
  panelChangeLog,
  panelChangeSeen,
  salespeopleUsers,
  taskAssignments,
  tasks,
  users,
} from "@shared/schema";
import { requireAuth } from "./auth";
import { sendPushToPanelUsers } from "./push";

export type PanelSection =
  | "tareas"
  | "seguimiento"
  | "estimacion"
  | "marketing"
  | "crm"
  | "rutas";

export const PANEL_SECTIONS: PanelSection[] = [
  "tareas",
  "seguimiento",
  "estimacion",
  "marketing",
  "crm",
  "rutas",
];

// Buckets de área para los marcadores de visto ('__all' = cambios sin segmento).
const SEGMENTO_BUCKETS = ["ferreterias", "construccion", "digital", "marketing", "__all"];

const RETENTION_DAYS = 14;
const SUMMARY_LIMIT = 300;

// Secciones cuyas tarjetas son fichas que se abren (tarea / seguimiento de
// cliente) y tipos de cambio que apuntan a una de ellas: en ambos el entityId
// es el id de la tarea.
const SECCIONES_POR_FICHA = ["seguimiento", "tareas"];
const TIPOS_DE_FICHA = ["task", "actividad"];

/**
 * ¿Este cambio se da por visto al abrir su ficha (y no al entrar a la pestaña)?
 * Los borrados quedan fuera: la ficha ya no existe y no habría cómo abrirla.
 */
export function esCambioPorFicha(c: {
  section: string;
  entityType: string;
  entityId?: string | null;
  action: string;
}): boolean {
  return (
    !!c.entityId &&
    c.action !== "deleted" &&
    SECCIONES_POR_FICHA.includes(c.section) &&
    TIPOS_DE_FICHA.includes(c.entityType)
  );
}

export function panelUserName(user: any): string {
  if (!user) return "";
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return full || user.salespersonName || user.username || user.email || "";
}

/**
 * A qué sección del panel pertenece una tarea: los seguimientos de cliente van
 * a "Seguimiento", los formularios de compras potenciales a "Estimación", las
 * tareas del área marketing sin cliente a la pestaña "Marketing" y el resto a
 * "Tareas" (mismo criterio de separación que usa filteredTasks en tareas.tsx).
 */
export function panelSectionForTask(task: {
  type?: string | null;
  segmento?: string | null;
  clienteId?: string | null;
  clienteNombre?: string | null;
  payload?: unknown;
}): PanelSection {
  const payload = (task?.payload ?? {}) as Record<string, unknown>;
  if (payload?.kind === "seguimiento_cliente") return "seguimiento";
  if (task?.type === "formulario" && payload?.formKey === "compras_potenciales") return "estimacion";
  if (task?.segmento === "marketing" && !task?.clienteId && !task?.clienteNombre) return "marketing";
  return "tareas";
}

/**
 * Normaliza un segmento libre (ej. "FERRETERIAS" del CRM, "Industrial") al
 * valor canónico del panel; si no calza con ninguno devuelve null (bucket
 * '__all', visible en todas las áreas).
 */
export function normalizePanelSegmento(segmento?: string | null): string | null {
  if (!segmento) return null;
  const s = segmento.toLowerCase().trim();
  if (s.includes("ferreter")) return "ferreterias";
  if (s.includes("construc")) return "construccion";
  if (s.includes("digital") || s.includes("industrial")) return "digital";
  if (s.includes("marketing")) return "marketing";
  return null;
}

const TASK_ACTION_FEM: Record<string, string> = {
  created: "creada",
  updated: "actualizada",
  completed: "completada",
  reopened: "reabierta",
  deleted: "eliminada",
  commented: "comentada",
};
const TASK_ACTION_MASC: Record<string, string> = {
  created: "creado",
  updated: "actualizado",
  completed: "completado",
  reopened: "reabierto",
  deleted: "eliminado",
  commented: "comentado",
};

/** Título humano para un cambio sobre una tarea, según su sección. */
export function panelTaskTitle(
  task: { title?: string | null; clienteNombre?: string | null; payload?: unknown; type?: string | null; segmento?: string | null; clienteId?: string | null },
  action: string,
): string {
  const section = panelSectionForTask(task);
  if (section === "seguimiento") {
    const who = task.clienteNombre || task.title || "cliente";
    return `Seguimiento de ${who} ${TASK_ACTION_MASC[action] ?? action}`;
  }
  return `Tarea "${task.title ?? ""}" ${TASK_ACTION_FEM[action] ?? action}`;
}

// ==================================================
// Visibilidad: quién ve qué cambio
// --------------------------------------------------
// Nadie ve sus propios cambios: avisarle a alguien de lo que acaba de escribir
// es ruido y tapa lo que hicieron los demás.
//
// Además del alcance por autor de abajo, cada quien ve los cambios hechos por
// CUALQUIERA sobre las fichas que tiene a la vista (ver filtroFichasDelUsuario):
// quien comenta el seguimiento de un cliente puede ser de otra área (cobranza,
// recepción) y no estar en el equipo del responsable.
//
// El change-log solo guarda el AUTOR del cambio (userId), así que el alcance
// se define por autor:
//   admin                      → ve todos los cambios
//   supervisor / encargado_area→ los suyos + los de los vendedores a su cargo
//   vendedor (con supervisor)  → lo MISMO que ve su supervisor: lo suyo, lo de
//                                su supervisor y lo de sus compañeros de equipo
//   resto (sin supervisor)     → solo los suyos
// El vendedor ve el equipo completo porque en el panel se trabaja por área: si
// solo veía lo propio, los badges le quedaban casi siempre vacíos y se perdía
// lo que pasaba en su área (pedido del usuario, sep-2026).
// Mismo criterio de equipo que usa getTasks en storage.ts (salespeople_users.
// supervisor_id apuntando al supervisor).
// ==================================================

const ROLES_VEN_TODO = ["admin"];
const ROLES_CON_EQUIPO = ["supervisor", "encargado_area"];

/**
 * Una misma persona puede tener fila en `users` y en `salespeople_users` con
 * ids distintos (según cómo se creó la cuenta), y el change-log guarda el id
 * con el que inició sesión. Esto devuelve TODOS los ids que representan a esas
 * personas, cruzando por email en ambas tablas, para que el filtro no se caiga
 * por un id que no calza.
 */
async function expandirIdsDeUsuario(ids: string[]): Promise<string[]> {
  const base = Array.from(new Set(ids.filter(Boolean)));
  if (base.length === 0) return [];
  const todos = new Set(base);
  const [enUsers, enSp] = await Promise.all([
    db.select({ email: users.email }).from(users).where(inArray(users.id, base)),
    db.select({ email: salespeopleUsers.email }).from(salespeopleUsers).where(inArray(salespeopleUsers.id, base)),
  ]);
  const emails = Array.from(
    new Set([...enUsers, ...enSp].map((r) => r.email?.toLowerCase()).filter(Boolean) as string[]),
  );
  if (emails.length > 0) {
    const lista = sql.join(emails.map((e) => sql`${e}`), sql`, `);
    const [u2, s2] = await Promise.all([
      db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) IN (${lista})`),
      db.select({ id: salespeopleUsers.id }).from(salespeopleUsers).where(sql`lower(${salespeopleUsers.email}) IN (${lista})`),
    ]);
    [...u2, ...s2].forEach((r) => todos.add(r.id));
  }
  return Array.from(todos);
}

/**
 * Supervisores de un conjunto de ids de persona (expandidos), sin repetir.
 * Devuelve [] si ninguna de esas fichas tiene supervisor cargado.
 */
async function idsDeSupervisores(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const filas = await db
    .select({ supervisorId: salespeopleUsers.supervisorId })
    .from(salespeopleUsers)
    .where(inArray(salespeopleUsers.id, ids));
  return Array.from(new Set(filas.map((f) => f.supervisorId).filter(Boolean) as string[]));
}

/**
 * Ids de autor cuyos cambios puede ver este usuario.
 * `null` = sin filtro (ve todo). Ante cualquier error se cierra al mínimo
 * (solo lo propio): es preferible mostrar de menos que filtrar información
 * de otros equipos.
 */
export async function autoresVisiblesParaUsuario(user: any): Promise<string[] | null> {
  const rol = String(user?.role ?? "");
  if (ROLES_VEN_TODO.includes(rol)) return null;
  try {
    const propios = await expandirIdsDeUsuario([user?.id]);
    // Supervisor/encargado: lo suyo + lo de los vendedores a su cargo.
    if (ROLES_CON_EQUIPO.includes(rol)) {
      const equipo = await db
        .select({ id: salespeopleUsers.id })
        .from(salespeopleUsers)
        .where(inArray(salespeopleUsers.supervisorId, propios));
      return await expandirIdsDeUsuario([...propios, ...equipo.map((v) => v.id)]);
    }
    // Vendedor: se le da la MISMA vista que a su supervisor, o sea el equipo
    // completo (el supervisor + todos sus vendedores, él incluido). Sin
    // supervisor en la ficha no hay equipo que mostrar y queda solo lo propio.
    const supervisores = await idsDeSupervisores(propios);
    if (supervisores.length === 0) return propios;
    const equipo = await db
      .select({ id: salespeopleUsers.id })
      .from(salespeopleUsers)
      .where(inArray(salespeopleUsers.supervisorId, supervisores));
    return await expandirIdsDeUsuario([...propios, ...supervisores, ...equipo.map((v) => v.id)]);
  } catch (error: any) {
    console.error("⚠️ [panel-changes] No se pudo calcular la visibilidad:", error?.message);
    return [user?.id].filter(Boolean) as string[];
  }
}

/**
 * Cambios sobre las fichas (tareas / seguimientos) que el usuario tiene a la
 * vista en el panel, sin importar quién los hizo. Mismo criterio que
 * getTasksWithAssignmentsOptimized en storage.ts: las que creó, las que tiene
 * asignadas y, si es supervisor o encargado, las asignadas a su equipo. El
 * vendedor solo ve las asignadas. Ante un error se cierra (no suma nada).
 */
async function filtroFichasDelUsuario(user: any, propios: string[]): Promise<SQL> {
  try {
    if (propios.length === 0) return sql`false`;
    const rol = String(user?.role ?? "");
    let asignados = propios;
    if (ROLES_CON_EQUIPO.includes(rol)) {
      const equipo = await db
        .select({ id: salespeopleUsers.id })
        .from(salespeopleUsers)
        .where(inArray(salespeopleUsers.supervisorId, propios));
      asignados = Array.from(new Set([...propios, ...equipo.map((v) => v.id)]));
    }
    const lista = (ids: string[]) => sql.join(ids.map((id) => sql`${id}`), sql`, `);
    const creadaPorMi =
      rol === "salesperson" ? sql`false` : sql`${tasks.createdByUserId} IN (${lista(propios)})`;
    return sql`(
      ${panelChangeLog.entityType} IN (${lista(TIPOS_DE_FICHA)})
      AND ${panelChangeLog.entityId} IN (
        SELECT ${tasks.id} FROM ${tasks}
        WHERE ${creadaPorMi}
          OR EXISTS (
            SELECT 1 FROM ${taskAssignments}
            WHERE ${taskAssignments.taskId} = ${tasks.id}
              AND ${taskAssignments.assigneeId} IN (${lista(asignados)})
          )
      )
    )`;
  } catch (error: any) {
    console.error("⚠️ [panel-changes] No se pudieron calcular las fichas visibles:", error?.message);
    return sql`false`;
  }
}

/**
 * Espejo de autoresVisiblesParaUsuario para el push: dado el autor de un
 * cambio, quiénes pueden verlo (los admins, el propio autor, su supervisor y
 * sus compañeros de equipo, que desde sep-2026 ven lo mismo que el supervisor).
 * `null` = no se pudo calcular; el llamador entonces no acota.
 */
async function destinatariosDelCambio(user: any): Promise<string[] | null> {
  try {
    const propios = await expandirIdsDeUsuario([user?.id]);
    // Si el autor ES un supervisor, su "equipo" son sus propios vendedores;
    // si es vendedor, son los vendedores de su supervisor. Las dos consultas
    // juntas cubren los dos casos sin mirar el rol.
    const supervisores = await idsDeSupervisores(propios);
    const jefes = [...propios, ...supervisores];
    const equipo = jefes.length
      ? await db
          .select({ id: salespeopleUsers.id })
          .from(salespeopleUsers)
          .where(inArray(salespeopleUsers.supervisorId, jefes))
      : [];
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
    return await expandirIdsDeUsuario([
      ...propios,
      ...supervisores,
      ...equipo.map((v) => v.id),
      ...admins.map((a) => a.id),
    ]);
  } catch (error: any) {
    console.error("⚠️ [panel-changes] No se pudo calcular la audiencia del push:", error?.message);
    return null;
  }
}

export interface PanelChangeEntry {
  section: PanelSection;
  action: "created" | "updated" | "completed" | "reopened" | "deleted" | "commented" | "estado" | string;
  entityType: string;
  title: string;
  entityId?: string | null;
  segmento?: string | null;
}

const SECTION_LABELS: Record<string, string> = {
  tareas: "Tareas",
  seguimiento: "Seguimiento",
  estimacion: "Estimación",
  marketing: "Marketing",
  crm: "CRM",
  rutas: "Rutas",
};

/**
 * Registra un cambio del panel. Fire-and-forget: nunca frena ni hace fallar la
 * mutación principal (si la tabla no existe todavía o la BD rechaza, solo loguea).
 * Además envía un push a los usuarios del panel (menos el autor del cambio y
 * los ids en opts.skipPushUserIds, p. ej. asignados que ya reciben push personal).
 */
export async function logPanelChange(
  user: any,
  entry: PanelChangeEntry,
  opts?: { skipPushUserIds?: string[] },
): Promise<void> {
  // Web Push a quienes trabajan en el panel. El tag por sección hace que varios
  // cambios seguidos de la misma pestaña colapsen en una sola notificación.
  const actorName = panelUserName(user);
  const skip = [user?.id, ...(opts?.skipPushUserIds ?? [])].filter(Boolean) as string[];
  destinatariosDelCambio(user)
    .then((audiencia) =>
      sendPushToPanelUsers(
        {
          title: `Panel de Trabajo · ${SECTION_LABELS[entry.section] ?? entry.section}`,
          body: actorName ? `${entry.title} — ${actorName}` : entry.title,
          url: "/tareas",
          tag: `panel-${entry.section}`,
          priority: "media",
        },
        skip,
        audiencia,
      ),
    )
    .catch((error: any) => console.error("[push] Error enviando push del panel:", error?.message));

  try {
    await db.insert(panelChangeLog).values({
      section: entry.section,
      segmento: entry.segmento ?? null,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      action: entry.action,
      title: entry.title,
      userId: user?.id ?? "system",
      userName: panelUserName(user) || null,
    });
  } catch (error: any) {
    console.error("⚠️ [panel-changes] No se pudo registrar el cambio:", error?.message);
  }
}

export function registerPanelChangesRoutes(app: Express): void {
  // Cambios recientes NO vistos por el usuario actual (para badges y destacado).
  app.get("/api/panel-changes/summary", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const since = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
      // Cada quien ve lo que le compete (ver "Visibilidad" arriba): los cambios
      // de su equipo y los de cualquiera sobre sus fichas, nunca los propios.
      const [propios, autoresVisibles] = await Promise.all([
        expandirIdsDeUsuario([userId]).catch(() => [userId] as string[]),
        autoresVisiblesParaUsuario(req.user),
      ]);
      let filtroVisible: SQL | undefined;
      if (autoresVisibles !== null) {
        const porAutor =
          autoresVisibles.length > 0 ? inArray(panelChangeLog.userId, autoresVisibles) : sql`false`;
        filtroVisible = or(porAutor, await filtroFichasDelUsuario(req.user, propios));
      }
      const noPropios = propios.length > 0 ? notInArray(panelChangeLog.userId, propios) : undefined;
      const [changes, markers, fichasVistas] = await Promise.all([
        db
          .select()
          .from(panelChangeLog)
          .where(and(gte(panelChangeLog.createdAt, since), noPropios, filtroVisible))
          .orderBy(desc(panelChangeLog.createdAt))
          .limit(SUMMARY_LIMIT),
        db.select().from(panelChangeSeen).where(eq(panelChangeSeen.userId, userId)),
        db.select().from(panelChangeEntitySeen).where(eq(panelChangeEntitySeen.userId, userId)),
      ]);
      const seenMap = new Map(markers.map((m) => [`${m.section}|${m.segmento}`, m.lastSeenAt]));
      const fichaVistaMap = new Map(fichasVistas.map((m) => [m.entityId, m.lastSeenAt]));
      const items = changes
        .map((c) => ({ ...c, porFicha: esCambioPorFicha(c) }))
        .filter((c) => {
          // Por ficha: sigue pendiente hasta que se abre ESA ficha.
          const seenAt = c.porFicha
            ? fichaVistaMap.get(c.entityId as string)
            : seenMap.get(`${c.section}|${c.segmento ?? "__all"}`);
          return !seenAt || (c.createdAt !== null && c.createdAt > seenAt);
        });
      res.json({ items });
    } catch (error: any) {
      console.error("Error obteniendo cambios del panel:", error);
      res.status(500).json({ message: "Error obteniendo cambios del panel" });
    }
  });

  // Marca como vistos los cambios de una sección (o de todas, con {all:true})
  // para el usuario actual, en el área que está mirando. Con {entityId} marca
  // vista una sola ficha (al abrirla). Entrar a una sección NO da por vistas
  // sus fichas; "marcar todo" ({all:true}) sí.
  app.post("/api/panel-changes/seen", requireAuth, async (req: any, res) => {
    try {
      const { section, segmento, all, entityId } = (req.body ?? {}) as {
        section?: string;
        segmento?: string;
        all?: boolean;
        entityId?: string;
      };
      if (typeof entityId === "string" && entityId.trim()) {
        await db
          .insert(panelChangeEntitySeen)
          .values({ userId: req.user.id, entityId: entityId.trim(), lastSeenAt: sql`now()` as any })
          .onConflictDoUpdate({
            target: [panelChangeEntitySeen.userId, panelChangeEntitySeen.entityId],
            set: { lastSeenAt: sql`now()` as any },
          });
        return res.json({ ok: true });
      }
      const sections: PanelSection[] = all
        ? PANEL_SECTIONS
        : PANEL_SECTIONS.includes(section as PanelSection)
          ? [section as PanelSection]
          : [];
      if (sections.length === 0) {
        return res.status(400).json({ message: "Sección inválida" });
      }
      // Mirando un área específica se marca esa + '__all' (cambios sin segmento,
      // visibles en cualquier área); mirando "all" se marcan todos los buckets.
      const buckets =
        !all && segmento && segmento !== "all" && SEGMENTO_BUCKETS.includes(segmento)
          ? [segmento, "__all"]
          : SEGMENTO_BUCKETS;
      // IMPORTANTE: usar now() de Postgres, igual que created_at del change-log.
      // Con new Date() de JS el marcador queda en hora UTC mientras created_at
      // queda en hora local del servidor (columnas sin zona horaria) y todos
      // los cambios aparecen como "vistos" por horas.
      const dbNow = sql`now()`;
      const values = sections.flatMap((s) =>
        buckets.map((b) => ({ userId: req.user.id, section: s, segmento: b, lastSeenAt: dbNow as any }))
      );
      await db
        .insert(panelChangeSeen)
        .values(values)
        .onConflictDoUpdate({
          target: [panelChangeSeen.userId, panelChangeSeen.section, panelChangeSeen.segmento],
          set: { lastSeenAt: dbNow as any },
        });
      if (all) {
        const lista = (valores: string[]) => sql.join(valores.map((v) => sql`${v}`), sql`, `);
        await db.execute(sql`
          INSERT INTO panel_change_entity_seen (user_id, entity_id, last_seen_at)
          SELECT ${String(req.user.id)}::varchar, l.entity_id, now()
          FROM panel_change_log l
          WHERE l.created_at >= now() - make_interval(days => ${RETENTION_DAYS})
            AND l.entity_id IS NOT NULL
            AND l.section IN (${lista(SECCIONES_POR_FICHA)})
            AND l.entity_type IN (${lista(TIPOS_DE_FICHA)})
          GROUP BY l.entity_id
          ON CONFLICT (user_id, entity_id) DO UPDATE SET last_seen_at = now()
        `);
      }
      res.json({ ok: true });
    } catch (error: any) {
      console.error("Error marcando cambios como vistos:", error);
      res.status(500).json({ message: "Error marcando cambios como vistos" });
    }
  });
}
