/**
 * AiChatView — Reusable chat view for the AI assistant
 * 
 * Can be used in a full-page layout or embedded in a modal.
 * Supports auto-rendering of charts from markdown tables.
 */
import { useState, useRef, useEffect, useMemo, type FormEvent, type KeyboardEvent } from "react";
import {
    Send,
    Trash2,
    MessageSquarePlus,
    Bot,
    User,
    Sparkles,
    Loader2,
    AlertTriangle,
    BarChart3,
    PieChart as PieChartIcon,
    Table2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/hooks/useAiChat";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
} from "recharts";

interface AiChatViewProps {
    messages: ChatMessage[];
    isLoading: boolean;
    error: string | null;
    onSendMessage: (text: string) => void;
    onClearHistory: () => void;
    onNewConversation: () => void;
    className?: string;
}

// ─── Chart Colors ───
const CHART_COLORS = [
    "#3B82F6", // blue-500
    "#10B981", // emerald-500
    "#F59E0B", // amber-500
    "#EF4444", // red-500
    "#8B5CF6", // violet-500
    "#EC4899", // pink-500
    "#06B6D4", // cyan-500
    "#F97316", // orange-500
    "#14B8A6", // teal-500
    "#6366F1", // indigo-500
];

// ─── Parse markdown table into structured data ───
interface TableData {
    headers: string[];
    rows: string[][];
    numericColumnIndex: number | null; // Which column has the main numeric data
    labelColumnIndex: number;
    percentageColumnIndex: number | null;
}

function parseMarkdownTable(tableLines: string[]): TableData | null {
    if (tableLines.length < 3) return null; // Need header, separator, at least one row

    const parseLine = (line: string) =>
        line.split("|").map(cell => cell.trim()).filter(cell => cell.length > 0);

    const headers = parseLine(tableLines[0]);
    if (headers.length < 2) return null;

    // Skip separator line (line with dashes)
    const rows = tableLines.slice(2)
        .filter(line => line.trim().startsWith("|") && !line.includes("---"))
        .map(parseLine)
        .filter(row => row.length >= 2);

    if (rows.length === 0) return null;

    // Find columns with numeric/currency data
    let numericColumnIndex: number | null = null;
    let percentageColumnIndex: number | null = null;
    const labelColumnIndex = 0; // First column is usually the label

    for (let col = 1; col < headers.length; col++) {
        const sampleValues = rows.map(r => r[col] || "");
        const hasCurrency = sampleValues.some(v => /\$[\d.,]+/.test(v));
        const hasPercentage = sampleValues.some(v => /[\d.,]+%/.test(v));

        if (hasCurrency && numericColumnIndex === null) {
            numericColumnIndex = col;
        } else if (hasPercentage && percentageColumnIndex === null) {
            percentageColumnIndex = col;
        } else if (numericColumnIndex === null) {
            // Check for plain numbers
            const hasNumbers = sampleValues.some(v => /^[\d.,]+$/.test(v.replace(/\s/g, "")));
            if (hasNumbers) numericColumnIndex = col;
        }
    }

    return { headers, rows, numericColumnIndex, labelColumnIndex, percentageColumnIndex };
}

// ─── Extract numeric value from formatted string ───
function extractNumber(str: string): number {
    // Remove currency symbols, dots as thousands separators, replace comma with dot for decimals
    const cleaned = str.replace(/[^0-9.,-]/g, "").replace(/\./g, "").replace(",", ".");
    return parseFloat(cleaned) || 0;
}

// ─── Format number for tooltips ───
function formatCLP(value: number): string {
    return new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
        minimumFractionDigits: 0,
    }).format(value);
}

// ─── Custom Tooltip ───
function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl px-4 py-3 text-sm">
            <p className="font-bold text-gray-900 dark:text-white mb-1">{label}</p>
            {payload.map((p: any, i: number) => (
                <p key={i} className="text-gray-600 dark:text-gray-300">
                    <span className="font-semibold" style={{ color: p.color }}>{p.name}:</span>{" "}
                    {typeof p.value === "number" ? formatCLP(p.value) : p.value}
                </p>
            ))}
        </div>
    );
}

// ─── Chart View Component ───
type ChartViewMode = "bar" | "pie" | "table";

function SmartChart({ tableData }: { tableData: TableData }) {
    // Default to table mode if headers suggest a list (e.g. Código, Producto, Nombre)
    const isList = useMemo(() => {
        const listKeywords = ["código", "codigo", "producto", "nombre", "item", "sku"];
        return tableData.headers.some(h => listKeywords.includes(h.toLowerCase()));
    }, [tableData.headers]);

    const [viewMode, setViewMode] = useState<ChartViewMode>(isList ? "table" : "bar");

    const chartData = useMemo(() => {
        if (!tableData.numericColumnIndex) return [];
        return tableData.rows
            .map(row => {
                const label = row[tableData.labelColumnIndex] || "";
                const value = extractNumber(row[tableData.numericColumnIndex!] || "0");
                const percentage = tableData.percentageColumnIndex
                    ? row[tableData.percentageColumnIndex]
                    : undefined;
                // Skip "Total" rows
                if (label.toLowerCase().includes("total")) return null;
                return { name: label, value, percentage };
            })
            .filter(Boolean) as Array<{ name: string; value: number; percentage?: string }>;
    }, [tableData]);

    if (chartData.length === 0) return null;

    const maxLabelLen = Math.max(...chartData.map(d => d.name.length));

    return (
        <div className="my-4 bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-800/50 dark:to-blue-900/10 rounded-2xl border border-gray-100 dark:border-gray-700/50 overflow-hidden shadow-sm">
            {/* Chart toolbar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700/50">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
                    Visualización de datos
                </div>
                <div className="flex items-center gap-1 bg-white dark:bg-slate-700/50 rounded-lg p-0.5 border border-gray-200 dark:border-gray-600">
                    <button
                        onClick={() => setViewMode("bar")}
                        className={`p-1.5 rounded-md transition-all ${viewMode === "bar" ? "bg-blue-500 text-white shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
                        title="Gráfico de barras"
                    >
                        <BarChart3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setViewMode("pie")}
                        className={`p-1.5 rounded-md transition-all ${viewMode === "pie" ? "bg-blue-500 text-white shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
                        title="Gráfico de torta"
                    >
                        <PieChartIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setViewMode("table")}
                        className={`p-1.5 rounded-md transition-all ${viewMode === "table" ? "bg-blue-500 text-white shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
                        title="Tabla"
                    >
                        <Table2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            <div className="p-5">
                {viewMode === "bar" && (
                    <ResponsiveContainer width="100%" height={Math.max(250, chartData.length * 45)}>
                        <BarChart
                            data={chartData}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: Math.min(maxLabelLen * 7, 160), bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                            <XAxis
                                type="number"
                                tickFormatter={(v) => formatCLP(v)}
                                tick={{ fontSize: 11, fill: "#6b7280" }}
                                axisLine={{ stroke: "#d1d5db" }}
                            />
                            <YAxis
                                dataKey="name"
                                type="category"
                                width={Math.min(maxLabelLen * 7, 160)}
                                tick={{ fontSize: 12, fill: "#374151", fontWeight: 600 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="value" name="Ventas" radius={[0, 8, 8, 0]} barSize={28}>
                                {chartData.map((_, index) => (
                                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}

                {viewMode === "pie" && (
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={chartData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={110}
                                innerRadius={55}
                                strokeWidth={3}
                                stroke="#fff"
                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(1)}%)`}
                                labelLine={{ stroke: "#94a3b8", strokeWidth: 1 }}
                            >
                                {chartData.map((_, index) => (
                                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                verticalAlign="bottom"
                                iconType="circle"
                                iconSize={8}
                                wrapperStyle={{ fontSize: 11, fontWeight: 600 }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                )}

                {viewMode === "table" && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b-2 border-gray-200 dark:border-gray-600">
                                    {tableData.headers.map((h, i) => (
                                        <th
                                            key={i}
                                            className={`py-3 px-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 ${i === 0 ? "text-left" : "text-right"}`}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {tableData.rows.map((row, ri) => {
                                    const isTotal = (row[0] || "").toLowerCase().includes("total");
                                    return (
                                        <tr
                                            key={ri}
                                            className={`border-b border-gray-100 dark:border-gray-700/50 transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-900/10 ${isTotal ? "bg-blue-50 dark:bg-blue-900/20 font-bold" : ""}`}
                                        >
                                            {row.map((cell, ci) => (
                                                <td
                                                    key={ci}
                                                    className={`py-3 px-4 ${ci === 0 ? "text-left font-semibold text-gray-900 dark:text-white" : "text-right text-gray-600 dark:text-gray-300 font-mono"}`}
                                                >
                                                    <div className="flex items-center gap-2" style={ci === 0 ? {} : { justifyContent: "flex-end" }}>
                                                        {ci === 0 && !isTotal && (
                                                            <span
                                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                                style={{ backgroundColor: CHART_COLORS[ri % CHART_COLORS.length] }}
                                                            />
                                                        )}
                                                        {cell}
                                                    </div>
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Smart markdown-ish renderer with chart detection ───
function renderContent(text: string) {
    if (!text) return null;

    // Split by code blocks first
    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, i) => {
        // Code block
        if (part.startsWith("```")) {
            const code = part.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
            return (
                <pre
                    key={i}
                    className="bg-gray-900 text-gray-100 text-xs rounded-lg p-4 my-3 overflow-x-auto whitespace-pre-wrap shadow-inner"
                >
                    <code className="font-mono">{code}</code>
                </pre>
            );
        }

        // Process inline markdown — detect tables and render as charts
        const lines = part.split("\n");
        const elements: JSX.Element[] = [];
        let tableBuffer: string[] = [];

        const flushTable = (key: string) => {
            if (tableBuffer.length >= 3) {
                const tableData = parseMarkdownTable(tableBuffer);
                if (tableData && tableData.numericColumnIndex !== null) {
                    elements.push(<SmartChart key={key} tableData={tableData} />);
                } else if (tableData) {
                    // Render as styled table without chart
                    elements.push(
                        <SmartChart key={key} tableData={{ ...tableData, numericColumnIndex: null }} />
                    );
                }
            } else {
                // Too few lines for a table, render as-is
                tableBuffer.forEach((line, idx) => {
                    elements.push(
                        <div key={`${key}-${idx}`} className="text-xs font-mono overflow-x-auto my-1 p-1 bg-gray-50 dark:bg-slate-700/50 rounded">
                            {line}
                        </div>
                    );
                });
            }
            tableBuffer = [];
        };

        lines.forEach((line, j) => {
            // Detect table lines (start and end with |)
            if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
                tableBuffer.push(line);
                return;
            }

            // Separator-only line (part of a table)
            if (line.trim().match(/^[-|:\s]+$/) && tableBuffer.length > 0) {
                tableBuffer.push(line);
                return;
            }

            // If we were accumulating a table and hit a non-table line, flush it
            if (tableBuffer.length > 0) {
                flushTable(`table-${i}-${j}`);
            }

            // Headers
            if (line.startsWith("### ")) {
                elements.push(
                    <h4 key={`${i}-${j}`} className="font-bold text-base mt-4 mb-2 text-gray-900 dark:text-white">
                        {line.replace("### ", "")}
                    </h4>
                );
                return;
            }
            if (line.startsWith("## ")) {
                elements.push(
                    <h3 key={`${i}-${j}`} className="font-extrabold text-lg mt-5 mb-3 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-1">
                        {line.replace("## ", "")}
                    </h3>
                );
                return;
            }

            // Bullet lists
            if (line.trim().startsWith("- ") || line.trim().startsWith("• ")) {
                elements.push(
                    <div key={`${i}-${j}`} className="flex gap-2.5 ml-3 my-1">
                        <span className="text-blue-500 font-bold">•</span>
                        <span
                            className="flex-1"
                            dangerouslySetInnerHTML={{
                                __html: line
                                    .trim()
                                    .replace(/^[-•]\s/, "")
                                    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                                    .replace(/`(.*?)`/g, '<code class="bg-gray-200/50 dark:bg-slate-700 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>'),
                            }}
                        />
                    </div>
                );
                return;
            }

            // Empty line = paragraph break
            if (line.trim() === "") {
                elements.push(<div key={`${i}-${j}`} className="h-2" />);
                return;
            }

            // Regular text with bold, inline code, and links
            elements.push(
                <p
                    key={`${i}-${j}`}
                    className="my-1 text-gray-700 dark:text-gray-300"
                    dangerouslySetInnerHTML={{
                        __html: line
                            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                            .replace(/`(.*?)`/g, '<code class="bg-gray-200/50 dark:bg-slate-700 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>')
                            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-blue-600 hover:text-blue-700 underline font-medium">$1</a>')
                            .replace(
                                /(\/api\/quotes\/[a-zA-Z0-9-]+\/pdf)/g,
                                '<a href="$1" target="_blank" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold no-underline transition-colors shadow-sm mt-1">📄 Ver / Imprimir PDF</a>'
                            ),
                    }}
                />
            );
        });

        // Flush any remaining table at end of text
        if (tableBuffer.length > 0) {
            flushTable(`table-${i}-end`);
        }

        return <div key={i}>{elements}</div>;
    });
}

export default function AiChatView({
    messages,
    isLoading,
    error,
    onSendMessage,
    onClearHistory,
    onNewConversation,
    className = "",
}: AiChatViewProps) {
    const [input, setInput] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading) {
            onSendMessage(input.trim());
            setInput("");
            // Reset height
            if (inputRef.current) {
                inputRef.current.style.height = "auto";
            }
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e as any);
        }
    };

    return (
        <div className={`flex flex-col h-full bg-white dark:bg-slate-900 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-10 transition-all">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-4 ring-blue-500/5">
                        <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-gray-900 dark:text-white leading-tight tracking-tight">
                            Panorámica AI
                        </h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Inteligencia Comercial Activa
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onNewConversation}
                        className="h-10 rounded-xl gap-2 text-gray-700 bg-white hover:bg-gray-50 border-gray-200 shadow-sm transition-all"
                    >
                        <MessageSquarePlus className="w-4 h-4" />
                        <span className="font-semibold px-1">Nuevo Chat</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearHistory}
                        className="h-10 w-10 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="Limpiar historial"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 space-y-8 scroll-smooth">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-3xl mx-auto px-6 animate-in fade-in zoom-in duration-500">
                        <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 flex items-center justify-center mb-8 relative">
                            <Bot className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-slate-900">
                                <Sparkles className="w-3 h-3 text-white" />
                            </div>
                        </div>
                        <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">
                            ¿En qué puedo ayudarte hoy?
                        </h3>
                        <p className="text-lg text-gray-500 dark:text-gray-400 mb-10 max-w-xl leading-relaxed">
                            Consulto tus <span className="text-blue-600 font-bold">ventas</span>,
                            <span className="text-blue-600 font-bold"> clientes</span>,
                            <span className="text-blue-600 font-bold"> productos</span> y
                            <span className="text-blue-600 font-bold"> presupuestos</span> en tiempo real.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                            {[
                                "¿Cuáles son mis ventas de este mes?",
                                "Busca el cliente Ferretería López",
                                "Busca esmalte al agua y hazme una cotización",
                                "¿Cuánto ha comprado el cliente Juan este mes?",
                                "Busca productos de la línea Élite",
                                "¿Cómo va mi meta de ventas?",
                            ].map((suggestion, i) => (
                                <button
                                    key={i}
                                    onClick={() => onSendMessage(suggestion)}
                                    className="text-left text-sm px-5 py-4 rounded-2xl border border-gray-200 dark:border-gray-700/50 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 hover:border-blue-400 hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-0.5 transition-all text-gray-700 dark:text-gray-300 font-semibold group flex items-center justify-between"
                                >
                                    <span>{suggestion}</span>
                                    <Sparkles className="w-3.5 h-3.5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="max-w-5xl mx-auto w-full space-y-8">
                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            className={`flex gap-5 ${msg.role === "user" ? "flex-row-reverse" : "animate-in slide-in-from-left duration-300"}`}
                        >
                            {/* Avatar */}
                            <div
                                className={`w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-lg transition-transform hover:scale-105 ${msg.role === "user"
                                    ? "bg-slate-100 dark:bg-slate-800"
                                    : "bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/20"
                                    }`}
                            >
                                {msg.role === "user" ? (
                                    <User className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                                ) : (
                                    <Sparkles className="w-5 h-5 text-white" />
                                )}
                            </div>

                            {/* Bubble */}
                            <div
                                className={`group relative ${msg.role === "user" ? "max-w-[85%]" : "max-w-[90%]"} rounded-3xl px-6 py-4.5 text-sm leading-relaxed shadow-sm transition-all ${msg.role === "user"
                                    ? "bg-blue-600 text-white rounded-tr-sm hover:shadow-xl hover:shadow-blue-600/10"
                                    : "bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 rounded-tl-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl hover:shadow-black/5"
                                    }`}
                            >
                                {msg.isLoading ? (
                                    <div className="flex items-center gap-4 py-1.5">
                                        <div className="flex gap-1.5">
                                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
                                        </div>
                                        <span className="text-xs font-bold text-blue-500 uppercase tracking-widest">Procesando consulta...</span>
                                    </div>
                                ) : msg.role === "user" ? (
                                    <p className="whitespace-pre-wrap text-[15px] font-medium leading-relaxed">{msg.content}</p>
                                ) : (
                                    <div className="prose prose-blue prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-headings:mb-3 prose-p:text-[15px] prose-strong:text-blue-600 dark:prose-strong:text-blue-400">
                                        {renderContent(msg.content)}
                                    </div>
                                )}

                                <div className={`absolute top-full mt-1.5 text-[10px] font-bold text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-tighter ${msg.role === "user" ? "right-0" : "left-0"}`}>
                                    {msg.createdAt && new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Error Container */}
            {error && (
                <div className="max-w-5xl mx-auto w-full px-8 mb-4">
                    <div className="px-5 py-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-[13px] text-red-600 dark:text-red-400 flex items-center gap-3 font-semibold shadow-sm animate-in shake-in">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <span className="flex-1">{error}</span>
                    </div>
                </div>
            )}

            {/* Input Overlay / Footer */}
            <div className="border-t border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 sm:px-8 py-8 transition-all duration-300">
                <form
                    onSubmit={handleSubmit}
                    className="max-w-5xl mx-auto w-full relative"
                >
                    <div className="relative flex items-end gap-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700/50 rounded-[1.5rem] p-2.5 shadow-2xl shadow-slate-200/50 dark:shadow-none focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-500/50 transition-all group">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Pregúntame cualquier cosa sobre el negocio..."
                            className="flex-1 resize-none bg-transparent px-4 py-3.5 text-[15px] font-medium focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-600 max-h-60 min-h-[48px]"
                            style={{
                                height: "auto",
                                minHeight: "48px",
                                maxHeight: "240px",
                            }}
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = "auto";
                                target.style.height = Math.min(target.scrollHeight, 240) + "px";
                            }}
                            disabled={isLoading}
                        />
                        <Button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className={`h-12 w-12 rounded-2xl shadow-xl flex-shrink-0 transition-all duration-500 ${input.trim() && !isLoading
                                ? "bg-gradient-to-r from-blue-600 to-indigo-600 opacity-100 scale-100"
                                : "bg-slate-200 dark:bg-slate-700 opacity-40 scale-95"
                                }`}
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Send className="w-5 h-5 text-white" />
                            )}
                        </Button>
                    </div>
                    <div className="flex justify-between items-center mt-4 px-2">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-3 h-3 text-blue-500" />
                            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-tight">
                                Panorámica Intelligence Engine v1.0
                            </p>
                        </div>
                        <div className="flex gap-5">
                            <span className="text-[11px] text-gray-400 font-medium">Shift + Enter para salto de línea</span>
                            <span className="text-[11px] text-gray-400 font-medium">Enter para enviar</span>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
