/**
 * AI Chat Assistant — Agent Orchestrator
 * 
 * Core logic: receives user message → builds conversation context → 
 * calls OpenAI with function calling → executes tools → returns response.
 * 
 * This service is transport-agnostic: works for the web modal today
 * and can be reused for WhatsApp in the future.
 */
import OpenAI from "openai";
import { toolImplementations } from "./ai-tools";
import { AI_SYSTEM_RULES } from "./ai-system-rules";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

// ─── OpenAI Client (lazy init) ───
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
    if (!openaiClient) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("OPENAI_API_KEY no está configurada. Agrega la variable de entorno.");
        }
        openaiClient = new OpenAI({ apiKey });
    }
    return openaiClient;
}

// ─── System Prompt ───
function buildSystemPrompt(
    user: { role: string; salespersonName?: string; firstName?: string; lastName?: string },
    knowledgeBase?: Array<{ title: string; content: string; fileType?: string }>
): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString("es-CL", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const systemInstructions = knowledgeBase?.filter(k => k.fileType === 'instruction') || [];
    const knowledgeDocs = knowledgeBase?.filter(k => k.fileType !== 'instruction') || [];

    const isPublic = user.role === "public";
    const isSalesperson = user.role === "salesperson";
    const userName = `${user.firstName || ""} ${user.lastName || ""}`.trim();

    let prompt = `Eres **Panorámica AI**, asistente inteligente de Pinturas Panorámica (empresa chilena, +30 años).
${isPublic ? `Actúas como tomador de pedidos digital de ${user.salespersonName}.` : ""}

## Contexto
- Usuario: ${userName} | Rol: ${user.role}${user.salespersonName ? ` | Vendedor: ${user.salespersonName}` : ""}
- Fecha: ${dateStr} | Período: ${currentPeriod}

## Cómo responder
1. Responde en español chileno, profesional y DIRECTO. Sin rodeos ni frases genéricas ("¡Claro!", "Con gusto...").
2. RAZONA: analiza datos, compara períodos, identifica tendencias, sugiere acciones. No repitas números sin interpretarlos.
3. Respuesta principal en 1-2 líneas, luego detalles si aplica. Usa tablas solo con 3+ items.
4. Montos en CLP formato chileno ($1.234.567). Si no hay datos, dilo directo.

## Herramientas disponibles
${isPublic ? `Productos (buscar, precios, fichas técnicas), cotizaciones (crear con PDF), inventario.
NO tienes acceso a datos internos (metas, facturación, otros clientes).` :
            `Ventas (resumen, metas, clientes top, NVV/GDV), productos (buscar, precios, inventario), clientes (buscar, crédito, historial compras), cotizaciones (crear/listar con PDF).`}
${isSalesperson ? `⚠️ Solo datos de ${user.salespersonName}.` : ""}

${isPublic ? `## Flujo pedidos: Entender necesidad → Buscar productos → Preguntar color/formato/cantidad → Resumir → Cotizar si acepta` : ""}

## Reglas críticas
- Cuando una herramienta devuelve "message", cópialo TEXTUALMENTE incluyendo links/URLs.
- Antes de cotizar: busca productos con search_products para códigos y precios.
- Datos de cliente se auto-completan; solo pide nombre, productos, cantidades y tier de precio.`;

    prompt += `\n\n${AI_SYSTEM_RULES}`;

    if (systemInstructions.length > 0) {
        prompt += `\n\n## Instrucciones del administrador`;
        for (const inst of systemInstructions) {
            prompt += `\n### ${inst.title}\n${inst.content}`;
        }
    }

    if (knowledgeDocs.length > 0) {
        prompt += `\n\n## Base de conocimiento`;
        for (const doc of knowledgeDocs) {
            prompt += `\n\n### ${doc.title}\n${doc.content}`;
        }
    }

    return prompt;
}

// ─── Tool Definitions for OpenAI ───
const toolDefinitions: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "get_sales_summary",
            description: "Obtiene un resumen de ventas por período. Puede filtrar por vendedor o segmento. Retorna ventas totales, clientes, transacciones, ticket promedio.",
            parameters: {
                type: "object",
                properties: {
                    period: { type: "string", description: "Período en formato YYYY-MM (ej: 2026-02). Si no se especifica, usa el mes actual." },
                    salesperson: { type: "string", description: "Nombre del vendedor para filtrar. Solo disponible si el usuario es admin/supervisor." },
                    segment: { type: "string", description: "Nombre del segmento para filtrar (ej: FERRETERIAS, MCT)." },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_goals_progress",
            description: "Consulta el progreso de metas de ventas. Muestra meta objetivo, ventas actuales y porcentaje de cumplimiento.",
            parameters: {
                type: "object",
                properties: {
                    period: { type: "string", description: "Período en formato YYYY-MM." },
                    type: { type: "string", enum: ["global", "segment", "salesperson"], description: "Tipo de meta a consultar." },
                    target: { type: "string", description: "Nombre específico del target (vendedor o segmento)." },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_top_clients",
            description: "Obtiene ranking de clientes con mayores ventas en un período.",
            parameters: {
                type: "object",
                properties: {
                    period: { type: "string", description: "Período en formato YYYY-MM." },
                    salesperson: { type: "string", description: "Filtrar por vendedor." },
                    segment: { type: "string", description: "Filtrar por segmento." },
                    limit: { type: "number", description: "Cantidad de clientes a retornar (default: 10)." },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_nvv_pending",
            description: "Consulta las notas de venta (NVV) pendientes de facturación. Muestra montos y cantidad por vendedor.",
            parameters: {
                type: "object",
                properties: {
                    salesperson: { type: "string", description: "Filtrar por vendedor específico." },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_gdv_pending",
            description: "Consulta las guías de despacho (GDV) pendientes. Muestra montos y cantidad por vendedor.",
            parameters: {
                type: "object",
                properties: {
                    salesperson: { type: "string", description: "Filtrar por vendedor específico." },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "search_products",
            description: "Busca productos en la lista de precios por nombre, código o descripción. Usa esta herramienta antes de crear cotizaciones para encontrar los códigos y precios correctos. SIEMPRE usa limit de al menos 15 para capturar todas las variantes de color/presentación.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Texto de búsqueda (nombre, código SKU, o descripción del producto)." },
                    limit: { type: "number", description: "Cantidad máxima de resultados (default: 15). Usar al menos 15 para capturar variantes." },
                },
                required: ["query"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "create_quote",
            description: "Crea una nueva cotización/presupuesto para un cliente con los productos especificados. IMPORTANTE: antes de usar esta herramienta, busca los productos con search_products para obtener precios y códigos correctos.",
            parameters: {
                type: "object",
                properties: {
                    clientName: { type: "string", description: "Nombre del cliente." },
                    clientRut: { type: "string", description: "RUT del cliente (opcional)." },
                    clientEmail: { type: "string", description: "Email del cliente (opcional)." },
                    clientPhone: { type: "string", description: "Teléfono del cliente (opcional)." },
                    clientAddress: { type: "string", description: "Dirección del cliente (opcional)." },
                    notes: { type: "string", description: "Notas adicionales para la cotización." },
                    items: {
                        type: "array",
                        description: "Lista de productos a cotizar.",
                        items: {
                            type: "object",
                            properties: {
                                productCode: { type: "string", description: "Código del producto de la lista de precios." },
                                productName: { type: "string", description: "Nombre o descripción del producto." },
                                productUnit: { type: "string", description: "Unidad (UN, KG, LT, GL, etc.)." },
                                quantity: { type: "number", description: "Cantidad." },
                                unitPrice: { type: "number", description: "Precio unitario en CLP." },
                            },
                            required: ["productName", "quantity", "unitPrice"],
                        },
                    },
                    discount: { type: "number", description: "Monto de descuento global en CLP (default: 0)." },
                    taxRate: { type: "number", description: "Tasa de IVA en porcentaje (default: 19)." },
                },
                required: ["clientName", "items"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_my_quotes",
            description: "Lista las cotizaciones creadas. Admin/supervisor ven todas; vendedores ven solo las propias.",
            parameters: {
                type: "object",
                properties: {
                    status: { type: "string", enum: ["draft", "sent", "accepted", "rejected", "converted"], description: "Filtrar por estado." },
                    limit: { type: "number", description: "Cantidad máxima de resultados (default: 10)." },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_inventory_summary",
            description: "Consulta productos disponibles en el inventario con precios.",
            parameters: {
                type: "object",
                properties: {
                    search: { type: "string", description: "Búsqueda por nombre o código de producto." },
                    limit: { type: "number", description: "Cantidad máxima de resultados (default: 10)." },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "log_product_question",
            description: "Registra una pregunta sobre un producto específico que no pudiste resolver completamente porque falta información en la ficha técnica. Usa esta herramienta cuando un usuario pregunte sobre caracterísicas técnicas de un producto (rendimiento, dilución, tiempo de secado, usos, etc.) y no encuentres esa información al buscar el producto. Esto permite que los administradores completen la ficha y el asistente pueda responder mejor en el futuro.",
            parameters: {
                type: "object",
                properties: {
                    codigo: { type: "string", description: "Código SKU del producto sobre el que se hace la pregunta." },
                    pregunta: { type: "string", description: "La pregunta exacta del usuario sobre el producto." },
                    contexto: { type: "string", description: "Contexto adicional sobre por qué no pudiste resolverla completamente (ej: 'No hay ficha técnica cargada para este producto')." },
                },
                required: ["codigo", "pregunta"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "search_clients",
            description: "Busca clientes por nombre, RUT o código. Retorna datos de contacto, segmento, crédito disponible, deuda, teléfono, dirección y email. Usa esta herramienta cuando el usuario pregunte por un cliente específico o quiera crear una cotización.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Nombre, RUT o código del cliente a buscar." },
                    segment: { type: "string", description: "Filtrar por segmento (opcional)." },
                    limit: { type: "number", description: "Cantidad máxima de resultados (default: 10)." },
                },
                required: ["query"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_client_purchase_history",
            description: "Consulta el historial de compras de un cliente en un período. Muestra total de ventas y número de transacciones. Útil para saber cuánto ha comprado un cliente.",
            parameters: {
                type: "object",
                properties: {
                    clientName: { type: "string", description: "Nombre del cliente (búsqueda parcial)." },
                    period: { type: "string", description: "Período en formato YYYY-MM (default: mes actual)." },
                    limit: { type: "number", description: "Cantidad máxima de resultados (default: 10)." },
                },
                required: ["clientName"],
            },
        },
    },
];

// ─── User Context Type ───
export interface AiUserContext {
    userId: string;
    role: string;
    salespersonName?: string;
    firstName?: string;
    lastName?: string;
}

// ─── Message Type ───
export interface AiMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

// ─── Main Agent Function ───
export async function processAgentMessage(
    userMessage: string,
    conversationHistory: AiMessage[],
    userContext: AiUserContext,
    knowledgeBase?: Array<{ title: string; content: string; fileType?: string }>
): Promise<{ response: string; toolsUsed: string[]; tokensUsed?: number }> {
    const openai = getOpenAI();
    const toolsUsed: string[] = [];

    // Build messages array
    const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: buildSystemPrompt(userContext, knowledgeBase) },
        ...conversationHistory.map((m) => ({
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
        })),
        { role: "user", content: userMessage },
    ];

    try {
        // First LLM call — may include tool calls
        let completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages,
            tools: toolDefinitions,
            tool_choice: "auto",
            temperature: 0.3,
            max_tokens: 2000,
        });

        let responseMessage = completion.choices[0].message;
        let totalTokens = completion.usage?.total_tokens || 0;

        // Tool call loop (max 5 iterations to prevent infinite loops)
        let iterations = 0;
        while (responseMessage.tool_calls && responseMessage.tool_calls.length > 0 && iterations < 5) {
            iterations++;

            // Add assistant message with tool calls to conversation
            messages.push(responseMessage as any);

            // Execute ALL tool calls in parallel for speed
            const toolResults = await Promise.all(
                responseMessage.tool_calls.map(async (toolCall: any) => {
                    const toolName = toolCall.function.name;
                    const toolArgs = JSON.parse(toolCall.function.arguments);

                    toolsUsed.push(toolName);
                    console.log(`[AI Agent] Executing tool: ${toolName}`, toolArgs);

                    let toolResult: any;
                    if ((toolImplementations as any)[toolName]) {
                        toolResult = await (toolImplementations as any)[toolName](toolArgs, userContext);
                    } else {
                        toolResult = { error: `Herramienta '${toolName}' no disponible.` };
                    }

                    return { toolCallId: toolCall.id, result: toolResult };
                })
            );

            // Add all tool results to conversation
            for (const { toolCallId, result } of toolResults) {
                messages.push({
                    role: "tool",
                    tool_call_id: toolCallId,
                    content: JSON.stringify(result),
                } as any);
            }

            // Filter tools based on user role for subsequent calls
            const publicAllowedTools = [
                "search_products",
                "create_quote",
                "get_inventory_summary",
                "log_product_question"
            ];

            const filteredToolDefs = toolDefinitions.filter(t =>
                userContext.role !== "public" || publicAllowedTools.includes((t as any).function.name)
            );

            completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages,
                tools: filteredToolDefs,
                tool_choice: "auto",
                temperature: 0.3,
                max_tokens: 1500,
            });

            responseMessage = completion.choices[0].message;
            totalTokens += completion.usage?.total_tokens || 0;
        }

        const finalContent = responseMessage.content || "No pude generar una respuesta. Por favor intenta de nuevo.";

        // ── POST-PROCESSING: Inject PDF link if create_quote was called ──
        // GPT-4o-mini often ignores instructions to include URLs, so we force it
        let processedContent = finalContent;
        if (toolsUsed.includes('create_quote')) {
            // Find the create_quote tool result from messages
            for (const msg of messages) {
                if ((msg as any).role === 'tool' && (msg as any).content) {
                    try {
                        const toolResult = JSON.parse((msg as any).content);
                        if (toolResult.pdfUrl && toolResult.quoteNumber) {
                            // Check if the PDF link is already in the response
                            if (!processedContent.includes('/api/quotes/') && !processedContent.includes(toolResult.pdfUrl)) {
                                processedContent += `\n\n📄 **Descargar PDF de la cotización:** ${toolResult.pdfUrl}`;
                            }
                        }
                    } catch (_) { /* not JSON, skip */ }
                }
            }
        }

        return {
            response: processedContent,
            toolsUsed,
            tokensUsed: totalTokens,
        };
    } catch (error: any) {
        console.error("[AI Agent] Error:", error);

        if (error.message?.includes("OPENAI_API_KEY")) {
            throw error; // Re-throw config errors
        }

        return {
            response: `Lo siento, ocurrió un error al procesar tu consulta: ${error.message}. Por favor intenta de nuevo.`,
            toolsUsed,
        };
    }
}
