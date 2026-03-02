/**
 * AI Chat Assistant — Tool Implementations
 * 
 * Each tool is a function that the AI agent can invoke via OpenAI function calling.
 * Tools query the database directly via the storage layer (no HTTP round-trips).
 */
import { storage } from "./storage";

// ─── Helper: format currency for AI responses ───
const fmtCLP = (n: number) =>
    new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format(n);

const fmtNum = (n: number) => new Intl.NumberFormat("es-CL").format(n);

// ─── Helper: get current period string (YYYY-MM) ───
function getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Helper: build date range from period string ───
function dateRangeFromPeriod(period?: string): { startDate: string; endDate: string } {
    const p = period || getCurrentPeriod();
    const [year, month] = p.split("-").map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0); // last day of month
    return {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
    };
}

// ═══════════════════════════════════════════════════════════════════
// TOOL: get_sales_summary
// ═══════════════════════════════════════════════════════════════════
export async function tool_getSalesSummary(args: {
    period?: string;
    salesperson?: string;
    segment?: string;
}, userContext: { role: string; salespersonName?: string }) {
    const period = args.period || getCurrentPeriod();
    const { startDate, endDate } = dateRangeFromPeriod(period);

    // If user is a salesperson, force their own name
    const salesperson = userContext.role === "salesperson"
        ? userContext.salespersonName
        : args.salesperson;

    try {
        if (salesperson) {
            // IMPORTANT: getSalespersonDetails expects (name, period, filterType)
            // NOT (name, startDate, endDate) — the method was overwritten
            const details = await storage.getSalespersonDetails(salesperson, period, 'month');
            if (!details || Number(details.totalSales) === 0) {
                return {
                    type: "salesperson_summary",
                    salesperson,
                    period,
                    totalSales: 0,
                    totalSalesFormatted: fmtCLP(0),
                    message: `No se encontraron ventas para ${salesperson} en el período ${period}.`,
                };
            }
            return {
                type: "salesperson_summary",
                salesperson,
                period,
                totalSales: details.totalSales,
                totalSalesFormatted: fmtCLP(details.totalSales),
                totalClients: details.totalClients,
                totalTransactions: details.transactionCount,
                averageTicket: fmtCLP(details.averageTicket),
            };
        }

        // General summary — get data from segments (uses factVentas.monto like the dashboard)
        const segmentData = await storage.getSegmentAnalysis(startDate, endDate, undefined, args.segment);
        const totalSales = segmentData.reduce((s: number, seg: any) => s + (Number(seg.totalSales) || 0), 0);

        return {
            type: "general_summary",
            period,
            totalSales,
            totalSalesFormatted: fmtCLP(totalSales),
            segments: segmentData.slice(0, 10).map((seg: any) => ({
                name: seg.segment,
                sales: fmtCLP(Number(seg.totalSales) || 0),
                percentage: `${(Number(seg.percentage) || 0).toFixed(1)}%`,
            })),
        };
    } catch (error: any) {
        console.error('[AI Tool] get_sales_summary error:', error);
        return { error: `Error al consultar ventas: ${error.message}` };
    }
}

// ═══════════════════════════════════════════════════════════════════
// TOOL: get_goals_progress
// ═══════════════════════════════════════════════════════════════════
export async function tool_getGoalsProgress(args: {
    period?: string;
    type?: string; // 'global' | 'segment' | 'salesperson'
    target?: string;
}, userContext: { role: string; salespersonName?: string }) {
    try {
        const period = args.period || getCurrentPeriod();
        let goals = await storage.getGoals();

        // Filter by period
        goals = goals.filter((g: any) => g.period === period);

        // If salesperson, only show their goals
        if (userContext.role === "salesperson" && userContext.salespersonName) {
            const normalize = (s: string) => s?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() || "";
            goals = goals.filter((g: any) =>
                g.type === "salesperson" && normalize(g.target) === normalize(userContext.salespersonName!)
            );
        } else if (args.type) {
            goals = goals.filter((g: any) => g.type === args.type);
        }

        if (args.target) {
            const normalize = (s: string) => s?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() || "";
            goals = goals.filter((g: any) => normalize(g.target) === normalize(args.target!));
        }

        return {
            period,
            goals: goals.map((g: any) => ({
                type: g.type,
                target: g.target,
                targetAmount: fmtCLP(Number(g.targetAmount)),
                currentSales: fmtCLP(Number(g.currentSales)),
                percentage: ((Number(g.currentSales) / Number(g.targetAmount)) * 100).toFixed(1) + "%",
            })),
            count: goals.length,
        };
    } catch (error: any) {
        return { error: `Error al consultar metas: ${error.message}` };
    }
}

// ═══════════════════════════════════════════════════════════════════
// TOOL: get_top_clients
// ═══════════════════════════════════════════════════════════════════
export async function tool_getTopClients(args: {
    period?: string;
    salesperson?: string;
    segment?: string;
    limit?: number;
}, userContext: { role: string; salespersonName?: string }) {
    try {
        const { startDate, endDate } = dateRangeFromPeriod(args.period);
        const salesperson = userContext.role === "salesperson"
            ? userContext.salespersonName
            : args.salesperson;
        const limit = args.limit || 10;

        if (salesperson) {
            const result = await storage.getSalespersonClients(salesperson, args.period || getCurrentPeriod(), "month", args.segment, limit);
            const clientList = result?.items || [];
            return {
                salesperson,
                period: args.period || getCurrentPeriod(),
                clients: clientList.map((c: any) => ({
                    name: c.clientName,
                    sales: fmtCLP(Number(c.totalSales) || 0),
                    transactions: c.transactionCount,
                })),
                count: clientList.length,
            };
        }

        const segmentData = await storage.getSegmentAnalysis(startDate, endDate);
        return {
            period: args.period || getCurrentPeriod(),
            segments: segmentData.slice(0, limit).map((s: any) => ({
                name: s.segment,
                sales: fmtCLP(Number(s.totalSales) || 0),
                percentage: `${(Number(s.percentage) || 0).toFixed(1)}%`,
            })),
        };
    } catch (error: any) {
        return { error: `Error al consultar clientes: ${error.message}` };
    }
}

// ═══════════════════════════════════════════════════════════════════
// TOOL: get_nvv_pending
// ═══════════════════════════════════════════════════════════════════
export async function tool_getNvvPending(args: {
    salesperson?: string;
}, userContext: { role: string; salespersonName?: string }) {
    try {
        const salesperson = userContext.role === "salesperson"
            ? userContext.salespersonName
            : args.salesperson;

        const allNvv = await storage.getNvvAllBySalespeople();
        const normalize = (s: string) => s?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim() || "";

        const filtered = salesperson
            ? allNvv.filter((sp: any) => normalize(sp.salespersonName) === normalize(salesperson))
            : allNvv;

        const totalAmount = filtered.reduce((s: number, sp: any) => s + sp.totalAmount, 0);
        const totalOrders = filtered.reduce((s: number, sp: any) => s + sp.totalOrders, 0);

        return {
            type: "nvv_pending",
            totalAmount: fmtCLP(totalAmount),
            totalOrders,
            totalSalespeople: filtered.length,
            salesperson: salesperson || "todos",
            bySalesperson: filtered.slice(0, 5).map((sp: any) => ({
                name: sp.salespersonName,
                amount: fmtCLP(sp.totalAmount),
                orders: sp.totalOrders,
            })),
        };
    } catch (error: any) {
        return { error: `Error al consultar NVV: ${error.message}` };
    }
}

// ═══════════════════════════════════════════════════════════════════
// TOOL: get_gdv_pending
// ═══════════════════════════════════════════════════════════════════
export async function tool_getGdvPending(args: {
    salesperson?: string;
}, userContext: { role: string; salespersonName?: string }) {
    try {
        const salesperson = userContext.role === "salesperson"
            ? userContext.salespersonName
            : args.salesperson;

        const allGdv = await storage.getGdvAllBySalespeople();
        const normalize = (s: string) => s?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim() || "";

        const filtered = salesperson
            ? allGdv.filter((sp: any) => normalize(sp.salespersonName) === normalize(salesperson))
            : allGdv;

        const totalAmount = filtered.reduce((s: number, sp: any) => s + sp.totalAmount, 0);
        const totalGuias = filtered.reduce((s: number, sp: any) => s + sp.totalGuias, 0);

        return {
            type: "gdv_pending",
            totalAmount: fmtCLP(totalAmount),
            totalGuias,
            totalSalespeople: filtered.length,
            salesperson: salesperson || "todos",
        };
    } catch (error: any) {
        return { error: `Error al consultar GDV: ${error.message}` };
    }
}

// ═══════════════════════════════════════════════════════════════════
// TOOL: search_products
// ═══════════════════════════════════════════════════════════════════
export async function tool_searchProducts(args: {
    query: string;
    limit?: number;
}) {
    try {
        const results = await storage.getPriceList({
            search: args.query,
            limit: args.limit || 15,
            offset: 0,
        });

        if (!results || results.length === 0) {
            return {
                query: args.query,
                results: [],
                count: 0,
                message: `No se encontraron productos para "${args.query}". Intenta con otro término.`,
            };
        }

        // Enrich results with product content (knowledge base per product)
        const enriched = await Promise.all(results.map(async (p: any) => {
            let content: any = null;
            try {
                content = await storage.getProductContent(p.codigo);
            } catch (_) { /* no content yet is fine */ }

            const base = {
                code: p.codigo,
                name: p.producto,
                unit: p.unidad,
                color: p.color || null,
                listPrice: fmtCLP(Number(p.lista) || 0),
                listPriceRaw: Number(p.lista) || 0,
                desc10: p.desc10 ? fmtCLP(Number(p.desc10)) : null,
                desc10Raw: Number(p.desc10) || 0,
                desc10_5: p.desc10_5 ? fmtCLP(Number(p.desc10_5)) : null,
                desc10_5Raw: Number(p.desc10_5) || 0,
                desc10_5_3: p.desc10_5_3 ? fmtCLP(Number(p.desc10_5_3)) : null,
                desc10_5_3Raw: Number(p.desc10_5_3) || 0,
                minPrice: p.minimo ? fmtCLP(Number(p.minimo)) : null,
                minPriceRaw: Number(p.minimo) || 0,
                canalDigital: p.canalDigital ? fmtCLP(Number(p.canalDigital)) : null,
                canalDigitalRaw: Number(p.canalDigital) || 0,
            };

            if (content) {
                return {
                    ...base,
                    descripcion: content.descripcion || null,
                    usos: content.usos || null,
                    presentacion: content.presentacion || null,
                    rendimiento: content.rendimiento || null,
                    modoAplicacion: content.modoAplicacion || null,
                    tiempoSecado: content.tiempoSecado || null,
                    dilucion: content.dilucion || null,
                    capas: content.capas || null,
                    preparacionSuperficie: content.preparacionSuperficie || null,
                    observaciones: content.observaciones || null,
                    hasKnowledgeBase: true,
                };
            }

            return { ...base, hasKnowledgeBase: false };
        }));

        return {
            query: args.query,
            results: enriched,
            count: enriched.length,
        };
    } catch (error: any) {
        console.error('[AI Tool] search_products error:', error);
        return { error: `Error al buscar productos: ${error.message}` };
    }
}

// ═══════════════════════════════════════════════════════════════════
// TOOL: create_quote
// ═══════════════════════════════════════════════════════════════════
export async function tool_createQuote(args: {
    clientName: string;
    clientRut?: string;
    clientEmail?: string;
    clientPhone?: string;
    clientAddress?: string;
    notes?: string;
    items: Array<{
        productCode?: string;
        productName: string;
        productUnit?: string;
        quantity: number;
        unitPrice: number;
    }>;
    discount?: number;
    taxRate?: number;
}, userContext: { userId: string }) {
    try {
        // ── AUTO-LOOKUP CLIENT DATA ──
        // If we have a client name but missing details, search the clients DB
        let clientRut = args.clientRut || null;
        let clientEmail = args.clientEmail || null;
        let clientPhone = args.clientPhone || null;
        let clientAddress = args.clientAddress || null;
        let clientLookupInfo = '';

        if (args.clientName && (!clientRut || !clientPhone)) {
            try {
                const clients = await storage.getClients({
                    search: args.clientName.trim(),
                    limit: 3,
                    offset: 0,
                });
                if (clients && clients.length > 0) {
                    const match = clients[0]; // Best match
                    clientRut = clientRut || (match as any).rten || null;
                    clientEmail = clientEmail || (match as any).email || null;
                    clientPhone = clientPhone || (match as any).foen || null;
                    const addr = `${(match as any).dien || ''} ${(match as any).comuna || ''}`.trim();
                    clientAddress = clientAddress || addr || null;
                    clientLookupInfo = `\nDatos del cliente auto-completados desde la base de datos (${(match as any).nokoen}).`;
                }
            } catch (e) {
                // Client lookup failed, continue with what we have
                console.warn('[AI Tool] Client auto-lookup failed:', e);
            }
        }

        // Calculate totals
        const subtotal = args.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
        const discount = args.discount || 0;
        const taxRate = args.taxRate ?? 19;
        const taxableAmount = subtotal - discount;
        const taxAmount = taxableAmount * (taxRate / 100);
        const total = taxableAmount + taxAmount;

        // Create the quote
        const quote = await storage.createQuote({
            clientName: args.clientName,
            clientRut: clientRut,
            clientEmail: clientEmail,
            clientPhone: clientPhone,
            clientAddress: clientAddress,
            createdBy: userContext.userId,
            status: "draft",
            notes: args.notes || null,
            subtotal: subtotal.toString(),
            discount: discount.toString(),
            taxRate: taxRate.toString(),
            taxAmount: taxAmount.toString(),
            total: total.toString(),
        });

        // Add items
        for (const item of args.items) {
            await storage.createQuoteItem({
                quoteId: quote.id,
                type: item.productCode ? "standard" : "custom",
                productCode: item.productCode || null,
                productName: item.productName,
                productUnit: item.productUnit || "UN",
                quantity: item.quantity.toString(),
                unitPrice: item.unitPrice.toString(),
            } as any);
        }

        // Build items summary for the message
        const itemsSummary = args.items.map(item =>
            `- ${item.quantity}x ${item.productName} @ ${fmtCLP(item.unitPrice)} = ${fmtCLP(item.quantity * item.unitPrice)}`
        ).join('\n');

        const pdfLink = `/api/quotes/${quote.id}/pdf`;

        return {
            success: true,
            quoteId: quote.id,
            quoteNumber: quote.quoteNumber,
            clientName: args.clientName,
            clientRut: clientRut,
            itemCount: args.items.length,
            subtotal: fmtCLP(subtotal),
            discount: fmtCLP(discount),
            taxAmount: fmtCLP(taxAmount),
            total: fmtCLP(total),
            status: "draft",
            pdfUrl: pdfLink,
            // IMPORTANT: This message must be included VERBATIM in the AI response
            // The pdfLink will be auto-rendered as a download button in the chat UI
            message: `✅ Cotización **#${quote.quoteNumber}** creada exitosamente.${clientLookupInfo}

**Cliente:** ${args.clientName}${clientRut ? ` | RUT: ${clientRut}` : ''}
**Productos:**
${itemsSummary}

**Subtotal:** ${fmtCLP(subtotal)}
**IVA (19%):** ${fmtCLP(taxAmount)}
**Total:** ${fmtCLP(total)}

📄 **Descargar PDF:** ${pdfLink}`,
        };
    } catch (error: any) {
        return { error: `Error al crear cotización: ${error.message}` };
    }
}

// ═══════════════════════════════════════════════════════════════════
// TOOL: get_my_quotes
// ═══════════════════════════════════════════════════════════════════
export async function tool_getMyQuotes(args: {
    status?: string;
    limit?: number;
}, userContext: { userId: string; role: string }) {
    try {
        const filters: any = {
            limit: args.limit || 10,
            offset: 0,
        };
        if (args.status) filters.status = args.status;
        // Non-admin users see only their own quotes
        if (userContext.role !== "admin" && userContext.role !== "supervisor") {
            filters.createdBy = userContext.userId;
        }

        const quotes = await storage.getQuotes(filters);

        return {
            quotes: quotes.map((q: any) => ({
                id: q.id,
                number: q.quoteNumber,
                client: q.clientName,
                total: fmtCLP(Number(q.total) || 0),
                status: q.status,
                createdAt: q.createdAt,
                pdfUrl: `/api/quotes/${q.id}/pdf`,
            })),
            count: quotes.length,
        };
    } catch (error: any) {
        return { error: `Error al consultar cotizaciones: ${error.message}` };
    }
}

// ═══════════════════════════════════════════════════════════════════
// TOOL: get_inventory_summary
// ═══════════════════════════════════════════════════════════════════
export async function tool_getInventorySummary(args: {
    search?: string;
    limit?: number;
}) {
    try {
        const products = await storage.getPriceList({
            search: args.search || "",
            limit: args.limit || 10,
            offset: 0,
        });

        return {
            products: products.map((p: any) => ({
                code: p.codigo,
                name: p.producto,
                unit: p.unidad,
                listPrice: fmtCLP(Number(p.lista) || 0),
                desc10: p.desc10 ? fmtCLP(Number(p.desc10)) : null,
                minPrice: p.minimo ? fmtCLP(Number(p.minimo)) : null,
            })),
            count: products.length,
        };
    } catch (error: any) {
        return { error: `Error al consultar inventario: ${error.message}` };
    }
}

// ═══════════════════════════════════════════════════════════════════
// TOOL: log_product_question
// ═══════════════════════════════════════════════════════════════════
export async function tool_logProductQuestion(args: {
    codigo: string;
    pregunta: string;
    contexto?: string;
}) {
    try {
        if (!args.codigo || !args.pregunta) {
            return { error: "Se requiere el código del producto y la pregunta" };
        }
        const q = await storage.logProductQuestion({
            codigo: args.codigo,
            pregunta: args.pregunta,
            contexto: args.contexto,
        });
        return {
            success: true,
            id: q.id,
            message: `Pregunta registrada para el producto ${args.codigo}. Un administrador la revisará y completará la ficha técnica.`,
        };
    } catch (error: any) {
        return { error: `Error al registrar pregunta: ${error.message}` };
    }
}

// ═══════════════════════════════════════════════════════════════════
// TOOL: search_clients
// ═══════════════════════════════════════════════════════════════════
export async function tool_searchClients(args: {
    query: string;
    segment?: string;
    limit?: number;
}) {
    try {
        if (!args.query || args.query.trim().length < 2) {
            return { error: "El término de búsqueda debe tener al menos 2 caracteres." };
        }

        const results = await storage.getClients({
            search: args.query.trim(),
            segment: args.segment,
            limit: args.limit || 10,
            offset: 0,
        });

        if (!results || results.length === 0) {
            return {
                query: args.query,
                results: [],
                count: 0,
                message: `No se encontraron clientes para "${args.query}".`,
            };
        }

        return {
            query: args.query,
            results: results.map((c: any) => ({
                code: c.koen,
                name: c.nokoen,
                rut: c.rten || null,
                phone: c.foen || null,
                address: c.dien || null,
                city: c.ciudad || null,
                commune: c.comuna || null,
                segment: c.ruen || null,
                email: c.email || null,
                creditLimit: c.crlt ? fmtCLP(Number(c.crlt)) : null,
                creditAvailable: c.cren ? fmtCLP(Number(c.cren)) : null,
                debtBalance: c.crsd ? fmtCLP(Number(c.crsd)) : null,
                businessType: c.gien || null,
                entityType: c.tien || null,
                salesperson: c.nokofu || null,
            })),
            count: results.length,
        };
    } catch (error: any) {
        console.error('[AI Tool] search_clients error:', error);
        return { error: `Error al buscar clientes: ${error.message}` };
    }
}

// ═══════════════════════════════════════════════════════════════════
// TOOL: get_client_purchase_history
// ═══════════════════════════════════════════════════════════════════
export async function tool_getClientPurchaseHistory(args: {
    clientName: string;
    period?: string;
    limit?: number;
}, userContext: { role: string; salespersonName?: string }) {
    try {
        const period = args.period || getCurrentPeriod();
        const { startDate, endDate } = dateRangeFromPeriod(period);

        // Search client sales in factVentas
        const results = await storage.searchClients(
            args.clientName,
            startDate,
            endDate,
            userContext.role === "salesperson" ? userContext.salespersonName : undefined
        );

        if (!results || results.length === 0) {
            return {
                clientName: args.clientName,
                period,
                results: [],
                count: 0,
                message: `No se encontraron compras para "${args.clientName}" en ${period}.`,
            };
        }

        return {
            clientName: args.clientName,
            period,
            results: results.slice(0, args.limit || 10).map((c: any) => ({
                name: c.name,
                totalSales: fmtCLP(Number(c.totalSales) || 0),
                totalSalesRaw: Number(c.totalSales) || 0,
                transactions: c.transactionCount,
            })),
            count: results.length,
        };
    } catch (error: any) {
        console.error('[AI Tool] get_client_purchase_history error:', error);
        return { error: `Error al consultar historial de compras: ${error.message}` };
    }
}

// ═══════════════════════════════════════════════════════════════════
// TOOL REGISTRY — Maps tool names to implementations
// ═══════════════════════════════════════════════════════════════════
export const toolImplementations: Record<string, (args: any, userContext: any) => Promise<any>> = {
    get_sales_summary: tool_getSalesSummary,
    get_goals_progress: tool_getGoalsProgress,
    get_top_clients: tool_getTopClients,
    get_nvv_pending: tool_getNvvPending,
    get_gdv_pending: tool_getGdvPending,
    search_products: tool_searchProducts,
    create_quote: tool_createQuote,
    get_my_quotes: tool_getMyQuotes,
    get_inventory_summary: tool_getInventorySummary,
    log_product_question: tool_logProductQuestion,
    search_clients: tool_searchClients,
    get_client_purchase_history: tool_getClientPurchaseHistory,
};

