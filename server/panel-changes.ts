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
 */
import type { Express } from "express";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { panelChangeLog, panelChangeSeen, salespeopleUsers, users } from "@shared/schema";
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
// El change-log solo guarda el AUTOR del cambio (userId), así que el alcance
// se define por autor:
//   admin                      → ve todos los cambios
//   supervisor / encargado_area→ los suyos + los de los vendedores a su cargo
//   resto (vendedor, marketing)→ solo los suyos
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
    if (!ROLES_CON_EQUIPO.includes(rol)) return propios;
    const equipo = await db
      .select({ id: salespeopleUsers.id })
      .from(salespeopleUsers)
      .where(inArray(salespeopleUsers.supervisorId, propios));
    return await expandirIdsDeUsuario([...propios, ...equipo.map((v) => v.id)]);
  } catch (error: any) {
    console.error("⚠️ [panel-changes] No se pudo calcular la visibilidad:", error?.message);
    return [user?.id].filter(Boolean) as string[];
  }
}

/**
 * Espejo de autoresVisiblesParaUsuario para el push: dado el autor de un
 * cambio, quiénes pueden verlo (los admins, el propio autor y su supervisor).
 * `null` = no se pudo calcular; el llamador entonces no acota.
 */
async function destinatariosDelCambio(user: any): Promise<string[] | null> {
  try {
    const propios = await expandirIdsDeUsuario([user?.id]);
    const filas = propios.length
      ? await db
          .select({ supervisorId: salespeopleUsers.supervisorId })
          .from(salespeopleUsers)
          .where(inArray(salespeopleUsers.id, propios))
      : [];
    const supervisores = filas.map((f) => f.supervisorId).filter(Boolean) as string[];
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
    return await expandirIdsDeUsuario([...propios, ...supervisores, ...admins.map((a) => a.id)]);
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
      // Cada quien ve solo lo que le compete: admin todo, supervisor lo suyo y
      // lo de sus vendedores, vendedor solo lo suyo.
      const autoresVisibles = await autoresVisiblesParaUsuario(req.user);
      const filtroAutor =
        autoresVisibles === null
          ? undefined
          : autoresVisibles.length > 0
            ? inArray(panelChangeLog.userId, autoresVisibles)
            : sql`false`;
      const [changes, markers] = await Promise.all([
        db
          .select()
          .from(panelChangeLog)
          .where(and(gte(panelChangeLog.createdAt, since), filtroAutor))
          .orderBy(desc(panelChangeLog.createdAt))
          .limit(SUMMARY_LIMIT),
        db.select().from(panelChangeSeen).where(eq(panelChangeSeen.userId, userId)),
      ]);
      const seenMap = new Map(markers.map((m) => [`${m.section}|${m.segmento}`, m.lastSeenAt]));
      const items = changes.filter((c) => {
        const bucket = c.segmento ?? "__all";
        const seenAt = seenMap.get(`${c.section}|${bucket}`);
        return !seenAt || (c.createdAt !== null && c.createdAt > seenAt);
      });
      res.json({ items });
    } catch (error: any) {
      console.error("Error obteniendo cambios del panel:", error);
      res.status(500).json({ message: "Error obteniendo cambios del panel" });
    }
  });

  // Marca como vistos los cambios de una sección (o de todas, con {all:true})
  // para el usuario actual, en el área que está mirando.
  app.post("/api/panel-changes/seen", requireAuth, async (req: any, res) => {
    try {
      const { section, segmento, all } = (req.body ?? {}) as {
        section?: string;
        segmento?: string;
        all?: boolean;
      };
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
      res.json({ ok: true });
    } catch (error: any) {
      console.error("Error marcando cambios como vistos:", error);
      res.status(500).json({ message: "Error marcando cambios como vistos" });
    }
  });
}
