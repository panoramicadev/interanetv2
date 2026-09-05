/**
 * Asistente IA del Panel de Trabajo — un integrante más del chat.
 *
 * El chat de una ficha del panel (la columna "Bitácora / Chat" del detalle) es
 * una conversación de equipo. Cuando alguien nombra al asistente con @IA, este
 * módulo arma el contexto de esa ficha —la tarea, el cliente en seguimiento,
 * sus actividades pendientes, sus hitos y lo último que se habló— y publica la
 * respuesta como un mensaje más del hilo, firmado por "Panorámica AI".
 *
 * La respuesta se guarda en task_comments igual que cualquier otro mensaje: la
 * ve todo el equipo y queda en la bitácora (que no se borra). El asistente NO
 * contesta solo: únicamente cuando lo nombran, para no ensuciar el hilo.
 *
 * Arranca en Seguimiento, donde el contexto del cliente es el que más aporta;
 * el resto de las pestañas del panel comparten el mismo hilo y reciben el
 * contexto genérico de la tarea.
 */
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import {
  crmSeguimientoClientes,
  crmSeguimientoHitos,
  pedidoBitacora,
  taskActividades,
  users,
  type TaskComment,
} from "@shared/schema";
import { IA_AUTHOR_ID, IA_AUTHOR_NAME, esMensajeDeIA, limpiarMencionIA } from "@shared/ai-mention";
import { processAgentMessage, type AiMessage, type AiUserContext } from "./ai-agent";

/** Cuántos mensajes del hilo se le pasan al modelo como conversación previa. */
const HISTORIAL_MAX = 20;

const fmtFecha = (d: Date | string | null | undefined): string => {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
};

const fmtCLP = (n: unknown): string => {
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return "—";
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format(v);
};

/**
 * Ficha del cliente en seguimiento asociada a la tarea. El vínculo es flojo a
 * propósito: la tarea guarda el código ERP del cliente (clienteId) y su nombre,
 * y el CRM puede tener la ficha vinculada por cualquiera de los dos.
 */
async function buscarSeguimientoCrm(clienteId?: string | null, clienteNombre?: string | null) {
  const condiciones = [] as any[];
  if (clienteId) condiciones.push(eq(crmSeguimientoClientes.clienteId, clienteId));
  if (clienteNombre) condiciones.push(eq(crmSeguimientoClientes.nombre, clienteNombre));
  if (condiciones.length === 0) return null;

  const [ficha] = await db
    .select()
    .from(crmSeguimientoClientes)
    .where(and(eq(crmSeguimientoClientes.active, true), or(...condiciones)!))
    .orderBy(desc(crmSeguimientoClientes.updatedAt))
    .limit(1);
  return ficha || null;
}

/**
 * Todo lo que el asistente tiene que saber de esta ficha antes de contestar,
 * en texto plano. Va como mensaje `system` del historial: el prompt base del
 * agente (rol, permisos, tono) se arma solo en processAgentMessage.
 */
export async function construirContextoFicha(task: any): Promise<string> {
  const kind = task?.payload?.kind;
  const esSeguimiento = kind === "seguimiento_cliente";

  const lineas: string[] = [];
  lineas.push(
    "## Dónde estás",
    `Estás participando como un integrante más del chat de equipo de una ficha del Panel de Trabajo${esSeguimiento ? " (pestaña Seguimiento)" : ""}.`,
    "Los demás mensajes del hilo los escriben personas del equipo; cada uno viene con el nombre de quien lo escribió.",
    "",
    "## La ficha",
    `- Título: ${task.title}`,
    `- Tipo: ${esSeguimiento ? "seguimiento de cliente" : kind === "proyecto" ? "proyecto" : "tarea"}`,
    `- Estado: ${task.status || "pendiente"} | Prioridad: ${task.priority || "media"}`,
    `- Área: ${task.segmento || "—"}`,
    `- Vence: ${fmtFecha(task.dueDate)}`,
  );
  if (task.clienteNombre) lineas.push(`- Cliente: ${task.clienteNombre}${task.clienteId ? ` (código ${task.clienteId})` : ""}`);
  if (task.description) lineas.push(`- Descripción: ${task.description}`);

  // Las asignaciones guardan solo el id del usuario: sin resolverlo, al modelo le
  // llegaría un UUID en vez de un nombre.
  const asigneeIds = (task.assignments || []).map((a: any) => a.assigneeId).filter(Boolean);
  if (asigneeIds.length) {
    try {
      const personas = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
        .from(users)
        .where(inArray(users.id, asigneeIds));
      const responsables = personas
        .map((p) => [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || p.email)
        .filter(Boolean);
      if (responsables.length) lineas.push(`- A cargo: ${responsables.join(", ")}`);
    } catch (err: any) {
      console.error("[IA-PANEL] Error resolviendo los responsables:", err?.message || err);
    }
  }

  // ── Actividades internas de la ficha (llamadas, visitas, cotizaciones…) ──
  try {
    const actividades = await db
      .select()
      .from(taskActividades)
      .where(eq(taskActividades.taskId, task.id))
      .orderBy(desc(taskActividades.createdAt))
      .limit(15);
    if (actividades.length) {
      const pendientes = actividades.filter((a) => a.estado !== "completada");
      lineas.push("", "## Actividades de la ficha");
      lineas.push(`Pendientes: ${pendientes.length} de ${actividades.length} listadas.`);
      for (const a of actividades) {
        lineas.push(
          `- [${a.estado === "completada" ? "hecha" : "pendiente"}] ${a.tipo}: ${a.descripcion || "sin detalle"}` +
            `${a.fecha ? ` — ${fmtFecha(a.fecha)}` : ""}${a.responsableNombre ? ` (${a.responsableNombre})` : ""}`,
        );
      }
    }
  } catch (err: any) {
    console.error("[IA-PANEL] Error leyendo actividades:", err?.message || err);
  }

  // ── Ficha del CRM del cliente + sus hitos y bitácora ──
  if (task.clienteId || task.clienteNombre) {
    try {
      const crm = await buscarSeguimientoCrm(task.clienteId, task.clienteNombre);
      if (crm) {
        lineas.push(
          "",
          "## Cliente en el CRM de Seguimiento",
          `- Nombre: ${crm.nombre}${crm.empresa ? ` — ${crm.empresa}` : ""}`,
          `- Etapa: ${crm.estado} | Prioridad: ${crm.prioridad}`,
          `- Vendedor: ${crm.vendedorNombre}`,
          `- RUT: ${crm.rut || "—"} | Segmento: ${crm.segmento || "—"} | Condición de pago: ${crm.condicionPago || "—"}`,
          `- Contacto: ${crm.contactoEncargado || "—"} | ${crm.telefono || "sin teléfono"} | ${crm.email || "sin correo"}`,
          `- Último contacto: ${fmtFecha(crm.ultimoContacto)} | Próximo agendado: ${fmtFecha(crm.proximoContacto)}`,
          `- Monto estimado: ${fmtCLP(crm.montoEstimado)}`,
        );
        if (crm.notas) lineas.push(`- Notas: ${crm.notas}`);

        const hitos = await db
          .select()
          .from(crmSeguimientoHitos)
          .where(eq(crmSeguimientoHitos.seguimientoId, crm.id))
          .orderBy(desc(crmSeguimientoHitos.createdAt))
          .limit(10);
        if (hitos.length) {
          lineas.push("", "### Últimos hitos del seguimiento (más reciente primero)");
          for (const h of hitos) {
            lineas.push(`- ${fmtFecha(h.createdAt)} · ${h.tipo}: ${h.descripcion} (${h.autorNombre})`);
          }
        }

        const docIds = [crm.clienteId, crm.id].filter(Boolean) as string[];
        if (docIds.length) {
          const entradas = await db
            .select()
            .from(pedidoBitacora)
            .where(
              and(
                eq(pedidoBitacora.documentoTipo, "cliente"),
                or(...docIds.map((id) => eq(pedidoBitacora.documentoId, id)))!,
              ),
            )
            .orderBy(desc(pedidoBitacora.createdAt))
            .limit(10);
          if (entradas.length) {
            lineas.push("", "### Últimas entradas de la bitácora del cliente");
            for (const e of entradas) {
              lineas.push(`- ${fmtFecha(e.createdAt)} · ${e.tipo}: ${e.nota} (${e.autorNombre})`);
            }
          }
        }
      } else {
        lineas.push("", "## Cliente en el CRM de Seguimiento", "No hay ficha de CRM vinculada a esta tarea.");
      }
    } catch (err: any) {
      console.error("[IA-PANEL] Error leyendo el CRM del cliente:", err?.message || err);
    }
  }

  lineas.push(
    "",
    "## Cómo participar en este chat",
    "- Te nombran con @IA. Responde SOLO lo que te preguntan, en español chileno, breve y concreto.",
    "- Apóyate primero en el contexto de arriba; usa tus herramientas (ventas, clientes, productos, NVV, cotizaciones) cuando falte el dato.",
    "- Tu mensaje lo lee todo el equipo en la bitácora del cliente: nada de saludos largos ni de repetir la pregunta.",
    "- Si te piden algo que no puedes saber con los datos disponibles, dilo en una línea y propone qué mirar.",
    "- No inventes montos, fechas ni compromisos con el cliente.",
  );

  return lineas.join("\n");
}

/**
 * Traduce el hilo del chat a la conversación que entiende el modelo: lo que
 * escribió el asistente va como `assistant` y lo del equipo como `user`, con el
 * nombre adelante para que sepa quién dijo qué (es una conversación de varios).
 */
export function historialDesdeComentarios(comentarios: TaskComment[]): AiMessage[] {
  return comentarios.slice(-HISTORIAL_MAX).map((c) => (
    esMensajeDeIA(c.authorId)
      ? { role: "assistant" as const, content: c.content }
      : { role: "user" as const, content: `${c.authorName}: ${c.content}` }
  ));
}

export interface RespuestaIaChat {
  comment: TaskComment;
  toolsUsed: string[];
}

/**
 * Contesta la mención y deja la respuesta publicada en el hilo.
 * `pregunta` es el mensaje tal cual lo escribió la persona (con el @IA).
 */
export async function responderEnChatDeTarea(opts: {
  task: any;
  pregunta: string;
  user: { id: string; role?: string; salespersonName?: string | null; firstName?: string; lastName?: string };
  permissions?: Record<string, boolean> | null;
  knowledgeBase?: Array<{ title: string; content: string; fileType?: string }>;
}): Promise<RespuestaIaChat> {
  const { task, pregunta, user, permissions, knowledgeBase } = opts;

  const contexto = await construirContextoFicha(task);
  const previos = await storage.getTaskCommentsByTask(task.id);
  // El último mensaje del hilo es la propia pregunta (el cliente la guarda antes
  // de llamar acá): se saca del historial para no mandarla dos veces.
  const historial = historialDesdeComentarios(previos.slice(0, -1));

  const userContext: AiUserContext = {
    userId: user.id,
    role: user.role || "salesperson",
    salespersonName: user.salespersonName || undefined,
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    permissions: permissions ?? null,
  };

  const consulta = limpiarMencionIA(pregunta) || pregunta;
  const result = await processAgentMessage(
    consulta,
    [{ role: "system", content: contexto }, ...historial],
    userContext,
    knowledgeBase,
  );

  // El asistente publica como un integrante más: se ancla a la misma asignación
  // que usan los mensajes del equipo (el FK exige una asignación válida).
  const asignacion = task.assignments?.[0];
  if (!asignacion) throw new Error("La tarea no tiene asignaciones");

  const comment = await storage.addTaskComment({
    assignmentId: asignacion.id,
    authorId: IA_AUTHOR_ID,
    authorName: IA_AUTHOR_NAME,
    content: result.response,
  });

  return { comment, toolsUsed: result.toolsUsed };
}
