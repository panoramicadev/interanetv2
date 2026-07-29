/**
 * AI Modules — Capacitación del asistente sobre la propia intranet
 *
 * Traduce shared/module-map.ts a lo que necesita el agente:
 * - un índice de módulos filtrado por los permisos del usuario, que se inyecta
 *   en el system prompt (para que sepa qué existe y qué NO puede ofrecerle);
 * - las herramientas list_modules / search_help / get_module_guide, que
 *   devuelven las guías paso a paso.
 *
 * Regla de oro: nunca capacitar en un módulo que el usuario no puede abrir.
 * El filtro por permisos se aplica en TODAS las respuestas de estas tools.
 */
import {
    MODULE_MAP,
    getAccessibleModules,
    getModule,
    guidesOf,
    resolveGuide,
    searchGuides,
    fullStepsOf,
    qualifiedGuideId,
    type GuideStep,
    type ModuleDef,
} from "../shared/module-map";

export interface AiModuleContext {
    role: string;
    permissions?: Record<string, boolean> | null;
}

function accessible(ctx: AiModuleContext): ModuleDef[] {
    // El rol "public" es un visitante del catálogo del vendedor: no entra a la
    // intranet, así que no hay nada en qué capacitarlo.
    if (ctx.role === "public") return [];
    return getAccessibleModules(ctx.permissions, ctx.role);
}

function truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    return text.slice(0, max - 1).trimEnd() + "…";
}

// ─────────────────────────────────────────────────────────────────
// Índice para el system prompt
// ─────────────────────────────────────────────────────────────────

/**
 * Índice compacto de los módulos que el usuario puede abrir, agrupado.
 * Se inyecta en el system prompt: es lo que le permite al asistente
 * responder "dónde está X" sin llamar herramientas.
 */
export function buildModulesPromptSection(ctx: AiModuleContext): string {
    const mods = accessible(ctx);
    if (mods.length === 0) {
        return `## Módulos del usuario
Este usuario no tiene módulos habilitados. Si pide ayuda para usar el sistema, dile que hable con el administrador para que le habilite accesos en Configuración → Roles y Permisos.`;
    }

    const byGroup = new Map<string, ModuleDef[]>();
    for (const mod of mods) {
        const list = byGroup.get(mod.group) || [];
        list.push(mod);
        byGroup.set(mod.group, list);
    }

    let out = `## Módulos que ESTE usuario puede abrir (${mods.length})
Solo puedes capacitar en estos. Si pregunta por otro módulo, dile que no lo tiene habilitado y que lo pida al administrador.\n`;

    for (const [group, items] of Array.from(byGroup.entries())) {
        out += `\n### ${group}\n`;
        for (const mod of items) {
            const where = mod.nav
                ? mod.nav.parentLabel
                    ? `menú: ${mod.nav.parentLabel} → ${mod.nav.label}`
                    : `menú: ${mod.nav.label}`
                : "sin ítem en el menú";
            out += `- **${mod.label}** (${mod.href} · ${where}) — ${truncate(mod.purpose, 170)}\n`;
        }
    }

    const hidden = mods.filter((m) => !m.nav);
    if (hidden.length > 0) {
        out += `\n### Módulos sin acceso en el menú lateral
Si el usuario los busca en el menú, no los va a encontrar. Explícale dónde están de verdad:\n`;
        for (const mod of hidden) {
            const via = mod.gotchas?.[0] || `Se entra por la ruta ${mod.href}.`;
            out += `- **${mod.label}**: ${via}\n`;
        }
    }

    return out;
}

/** Reglas de capacitación: cómo debe enseñar el asistente. */
export const AI_TRAINING_RULES = `## Capacitación (enseñar a usar el sistema)
Además de responder datos, eres el capacitador de la intranet. Cuando el usuario pregunte CÓMO hacer algo, DÓNDE está algo, o diga que no encuentra o no puede algo:

1. Llama a search_help con las palabras del usuario tal como las dijo. Si hay una guía, llama a get_module_guide con ese guideId.
2. COPIA TEXTUALMENTE el campo "message" que devuelve get_module_guide, incluido el bloque \`\`\`guia\`\`\` del final. Ese bloque es lo que le muestra al usuario el botón "Mostrarme en pantalla", que le va marcando dónde hacer clic. Si lo omites o lo reformulas, el usuario pierde la guía visual.
3. No inventes pasos, botones ni rutas. Si no hay guía para lo que pide, usa list_modules para ubicar el módulo correcto, di dónde está en el menú y ofrece recorrerlo.
4. Nunca capacites en un módulo que el usuario no tiene habilitado. Si lo pide, dile que no lo tiene y que lo solicite al administrador (Configuración → Roles y Permisos).
5. Adapta el tono al rol: a un vendedor háblale de clientes y pedidos; a alguien de planta, de reclamos y órdenes de trabajo. Nada de jerga técnica del sistema.
6. Un paso = una acción. Si la tarea es larga, entrega los pasos y deja que la guía visual haga el resto en vez de escribir un texto enorme.`;

// ─────────────────────────────────────────────────────────────────
// Herramientas
// ─────────────────────────────────────────────────────────────────

/** TOOL: list_modules — qué módulos tiene habilitados el usuario. */
export async function tool_listModules(
    args: { group?: string; query?: string },
    userContext: AiModuleContext,
) {
    let mods = accessible(userContext);

    if (args.group) {
        const wanted = args.group.toLowerCase();
        mods = mods.filter((m) => m.group.toLowerCase().includes(wanted));
    }
    if (args.query) {
        const q = args.query.toLowerCase();
        mods = mods.filter(
            (m) =>
                m.label.toLowerCase().includes(q) ||
                m.purpose.toLowerCase().includes(q) ||
                m.id.toLowerCase().includes(q),
        );
    }

    return {
        role: userContext.role,
        count: mods.length,
        modules: mods.map((m) => ({
            moduleId: m.id,
            label: m.label,
            route: m.href,
            group: m.group,
            purpose: m.purpose,
            whoUses: m.whoUses,
            menuPath: m.nav
                ? m.nav.parentLabel
                    ? `${m.nav.parentLabel} → ${m.nav.label}`
                    : m.nav.label
                : null,
            guides: guidesOf(m).map((g) => ({ guideId: g.id, title: g.title })),
        })),
    };
}

/** TOOL: search_help — encuentra la guía que calza con lo que pidió el usuario. */
export async function tool_searchHelp(
    args: { query: string; limit?: number },
    userContext: AiModuleContext,
) {
    const mods = accessible(userContext);
    const matches = searchGuides(args.query || "", mods, args.limit || 5);

    if (matches.length === 0) {
        // Sin guía exacta: al menos ubicar el módulo más parecido.
        const q = (args.query || "").toLowerCase();
        const nearby = mods
            .filter((m) => m.label.toLowerCase().includes(q) || m.purpose.toLowerCase().includes(q))
            .slice(0, 3);
        return {
            found: false,
            query: args.query,
            suggestion:
                nearby.length > 0
                    ? "No hay una guía específica, pero estos módulos están relacionados. Ubica al usuario en el menú y ofrécele recorrer el módulo."
                    : "No hay guía ni módulo relacionado. No inventes pasos: pregúntale al usuario qué quiere lograr.",
            relatedModules: nearby.map((m) => ({
                moduleId: m.id,
                label: m.label,
                route: m.href,
                purpose: m.purpose,
                orientationGuideId: `${m.id}::orientacion`,
            })),
        };
    }

    return {
        found: true,
        query: args.query,
        next: "Llama a get_module_guide con el guideId del primer resultado (o el que mejor calce) y copia textualmente su campo message.",
        matches,
    };
}

function stepLine(step: GuideStep, index: number): string {
    const marca = step.target?.text
        ? ` *(te lo marco en pantalla: "${step.target.text}")*`
        : step.target
            ? " *(te lo marco en pantalla)*"
            : "";
    const detail = step.detail ? `\n   ${step.detail}` : "";
    return `${index + 1}. **${step.title}**${marca}${detail}`;
}

/**
 * TOOL: get_module_guide — pasos de una guía, o del módulo completo.
 * Devuelve `message` ya escrito para que el modelo lo copie tal cual, con el
 * bloque ```guia``` que activa la guía visual en el chat.
 */
export async function tool_getModuleGuide(
    args: { guideId?: string; moduleId?: string },
    userContext: AiModuleContext,
) {
    const mods = accessible(userContext);
    const allowed = new Set(mods.map((m) => m.id));

    let moduleDef: ModuleDef | undefined;
    let guideId = args.guideId;

    if (guideId) {
        const resolved = resolveGuide(guideId);
        if (!resolved) {
            return {
                error: `No existe la guía "${guideId}". Usa search_help para encontrar el id correcto. No inventes pasos.`,
            };
        }
        moduleDef = resolved.module;
        guideId = qualifiedGuideId(resolved.module, resolved.guide);
    } else if (args.moduleId) {
        moduleDef = getModule(args.moduleId);
        if (!moduleDef) {
            const known = MODULE_MAP.map((m) => m.id).join(", ");
            return { error: `No existe el módulo "${args.moduleId}". Ids válidos: ${known}` };
        }
        guideId = `${moduleDef.id}::orientacion`;
    } else {
        return { error: "Debes indicar guideId o moduleId." };
    }

    if (!allowed.has(moduleDef.id)) {
        return {
            error: `El usuario no tiene habilitado el módulo "${moduleDef.label}".`,
            message: `No tienes habilitado el módulo **${moduleDef.label}**, así que no puedo guiarte ahí. Pídele a un administrador que te lo habilite en Configuración → Roles y Permisos.`,
        };
    }

    const resolved = resolveGuide(guideId);
    if (!resolved) return { error: `No se pudo resolver la guía "${guideId}".` };

    const steps = fullStepsOf(resolved.module, resolved.guide);
    const guideBlock = ["```guia", JSON.stringify({ guideId, title: resolved.guide.title }), "```"].join("\n");

    const parts: string[] = [];
    parts.push(`**${resolved.guide.title}** — módulo ${moduleDef.label}`);
    parts.push("");
    parts.push(steps.map((s, i) => stepLine(s, i)).join("\n"));
    if (moduleDef.gotchas && moduleDef.gotchas.length > 0) {
        parts.push("");
        parts.push(`⚠️ Ojo: ${moduleDef.gotchas[0]}`);
    }
    parts.push("");
    parts.push(guideBlock);

    return {
        moduleId: moduleDef.id,
        moduleLabel: moduleDef.label,
        route: moduleDef.href,
        purpose: moduleDef.purpose,
        whoUses: moduleDef.whoUses,
        guideId,
        title: resolved.guide.title,
        stepCount: steps.length,
        steps: steps.map((s, i) => ({
            n: i + 1,
            title: s.title,
            detail: s.detail,
            route: s.route,
            marks: s.target?.text || (s.target ? "elemento en pantalla" : null),
        })),
        sections: moduleDef.sections,
        keyTerms: moduleDef.keyTerms,
        gotchas: moduleDef.gotchas,
        message: parts.join("\n"),
    };
}

/** Bloque ```guia``` de una guía, para inyectarlo si el modelo lo omitió. */
export function guideBlockFor(guideId: string): string | null {
    const resolved = resolveGuide(guideId);
    if (!resolved) return null;
    return [
        "```guia",
        JSON.stringify({
            guideId: qualifiedGuideId(resolved.module, resolved.guide),
            title: resolved.guide.title,
        }),
        "```",
    ].join("\n");
}
