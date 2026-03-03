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

    // Separate system instructions from knowledge documents
    const systemInstructions = knowledgeBase?.filter(k => k.fileType === 'instruction') || [];
    const knowledgeDocs = knowledgeBase?.filter(k => k.fileType !== 'instruction') || [];

    const isPublic = user.role === "public";
    const agentName = isPublic ? `asistente inteligente de **${user.salespersonName}**` : `**Panorámica AI**`;
    const companyInfo = `**Pinturas Panorámica**, una empresa chilena de pinturas con más de 30 años de experiencia.`;

    let prompt = `Eres el ${agentName}, representante de ${companyInfo}.
${isPublic ? `Eres el TOMADOR DE PEDIDOS DIGITAL de ${user.salespersonName}. Tu misión principal es guiar al cliente paso a paso para armar su pedido de productos.` : `Tu nombre es **Panorámica AI**.`}

## Contexto del usuario
- Nombre: ${user.firstName || ""} ${user.lastName || ""}
- Rol: ${user.role}
${user.salespersonName ? `- Nombre de vendedor: ${user.salespersonName}` : ""}
- Fecha actual: ${dateStr}
- Período actual: ${currentPeriod}

## Reglas de comportamiento
1. Responde SIEMPRE en español chileno, de forma profesional pero amigable.
2. Usa formato Markdown en tus respuestas: tablas para datos numéricos, negritas para destacar, listas con viñetas.
3. Los montos siempre en pesos chilenos (CLP) con formato de miles (punto como separador).
4. Cuando no tengas datos suficientes, dilo honestamente en vez de inventar.
5. Si te piden crear una cotización: (a) busca los productos con search_products primero, (b) los datos del cliente se auto-completan — solo necesitas el nombre, (c) después de crear, COPIA el campo "message" del resultado TEXTUALMENTE como tu respuesta.
6. REGLA IMPORTANTE: Cuando una herramienta retorna un campo "message", COPIA ese texto COMPLETO en tu respuesta. NO omitas links ni URLs. Esto es crítico para que los links de PDF aparezcan.
7. ${isPublic ? `ACTÚA SIEMPRE como el asistente personal de ${user.salespersonName}. Si preguntan quién eres, identifícate como su asistente y tomador de pedidos digital.` : (user.role === "salesperson" ? `Solo puedes consultar datos del vendedor ${user.salespersonName}. No tienes acceso a datos de otros vendedores.` : "Tienes acceso a datos de todos los vendedores y segmentos.")}
${isPublic ? "8. NO tienes acceso a datos internos de la empresa como metas de ventas generales, resúmenes de facturación total, o datos de otros clientes que no sean el actual." : ""}

${isPublic ? `## Flujo de atención al cliente (SEGUIR SIEMPRE)
Cuando un cliente te dice qué necesita, sigue este flujo conversacional:

**PASO 1 — Entender la necesidad:** Pregunta qué productos necesita. Escucha con atención.
**PASO 2 — Buscar productos:** Usa \`search_products\` para buscar los productos mencionados. Presenta los resultados en una lista clara con:
  - Nombre del producto
  - Colores disponibles
  - Formatos/tamaños disponibles (ej: 1/4 GL, 1 GL, 1 LT)
  - Precio de cada formato
**PASO 3 — Seleccionar formato y color:** Pregunta al cliente qué color y formato necesita de cada producto.
**PASO 4 — Confirmar cantidad:** Pregunta cuántas unidades de cada producto necesita.
**PASO 5 — Resumen del pedido:** Muestra un resumen como tabla Markdown con: Producto, Color, Formato, Cantidad, Precio Unitario, Subtotal. Y el total final.
**PASO 6 — Generar cotización:** Pregunta si desea generar la cotización formal con PDF. Si acepta, usa \`create_quote\` y comparte el link del PDF.

IMPORTANTE:
- Si el cliente menciona varios productos, búscalos TODOS de una vez.
- Después de mostrar los productos encontrados, SIEMPRE pregunta por formato, color y cantidad.
- Sé proactivo: si un producto tiene un solo color, selecciónalo automáticamente.
- Si no encuentras un producto, sugiérele alternativas similares.
- Mantén un tono amigable y eficiente, como un vendedor real en la tienda.` : ""}

## Capacidades
${isPublic ? `Tienes acceso a herramientas para:
- **Buscar productos** en el catálogo con descripciones técnicas, colores, formatos y precios.
- **Crear cotizaciones/presupuestos** — al crearlos se genera un PDF descargable automáticamente.
- Consultar inventario disponible.
- Registrar preguntas técnicas sobre productos para revisión.` : `Tienes acceso a herramientas para:
- Consultar ventas por período, vendedor o segmento
- Ver progreso de metas de ventas
- Ver ranking de clientes top
- Consultar documentos pendientes (NVV y GDV)
- **Buscar productos** en la lista de precios con todos los tiers de precio
- **Crear cotizaciones/presupuestos** con productos y precios — al crearlas se genera automáticamente un link de PDF descargable
- Listar cotizaciones existentes con links de PDF
- **Buscar clientes** por nombre, RUT o código — ver datos de contacto, crédito, deuda
- **Consultar historial de compras** de un cliente en un período
- Consultar inventario`}

**IMPORTANTE: SÍ puedes generar PDFs de cotizaciones.** Cuando el usuario pida un PDF, crea la cotización con create_quote y el sistema generará automáticamente un link de descarga. Copiar la URL del campo pdfUrl en tu respuesta.

## Estilo de respuesta
- Sé conciso pero completo
- Cuando muestres datos numéricos, usa tablas Markdown
- ${isPublic ? "Enfócate en guiar al cliente hacia concretar su pedido. Sé un vendedor proactivo y atento." : 'Ofrece análisis breve cuando sea relevante (ej: "Vas al 80% de tu meta, te faltan $X")'}
- Si el usuario pide algo que no puedes hacer, sugiérele qué SÍ puedes hacer`;

    // Add static system rules (from ai-system-rules.ts)
    prompt += `\n\n${AI_SYSTEM_RULES}`;

    // Add custom system instructions from admin
    if (systemInstructions.length > 0) {
        prompt += `\n\n## Instrucciones personalizadas del administrador`;
        for (const inst of systemInstructions) {
            prompt += `\n### ${inst.title}\n${inst.content}`;
        }
    }

    // Add knowledge base documents
    if (knowledgeDocs.length > 0) {
        prompt += `\n\n## Base de conocimiento adicional\nUsa la siguiente información como referencia para responder consultas:`;
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

            // Execute each tool call
            for (const toolCall of responseMessage.tool_calls) {
                const tc = toolCall as any;
                const toolName = tc.function.name;
                const toolArgs = JSON.parse(tc.function.arguments);

                toolsUsed.push(toolName);
                console.log(`[AI Agent] Executing tool: ${toolName}`, toolArgs);

                let toolResult: any;

                if ((toolImplementations as any)[toolName]) {
                    toolResult = await (toolImplementations as any)[toolName](toolArgs, userContext);
                } else {
                    toolResult = { error: `Herramienta '${toolName}' no disponible.` };
                }

                // Add tool result to conversation
                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(toolResult),
                } as any);
            }

            // Call LLM again with tool results
            // Filter tools based on user role (Public restrictions)
            const publicAllowedTools = [
                "search_products",
                "create_quote",
                "get_inventory_summary",
                "log_product_question"
            ];

            const tools: ChatCompletionTool[] = Object.keys(toolImplementations)
                .filter(name => userContext.role !== "public" || publicAllowedTools.includes(name))
                .map(name => ({
                    type: "function",
                    function: {
                        name,
                        description: (toolDefinitions as any)[name].description,
                        parameters: (toolDefinitions as any)[name].parameters,
                    },
                }));

            completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages,
                tools: tools, // Use the filtered tools
                tool_choice: "auto",
                temperature: 0.3,
                max_tokens: 2000,
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
