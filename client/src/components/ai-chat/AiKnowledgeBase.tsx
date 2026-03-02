/**
 * AiKnowledgeBase — Knowledge Base & Configuration panel for the AI assistant
 * 
 * Allows admins to:
 * 1. Add custom instructions for how the AI should behave
 * 2. Add knowledge documents the AI can reference
 * 3. View and manage all knowledge base items
 */
import { useState, useEffect } from "react";
import {
    BookOpen,
    Sparkles,
    Plus,
    Trash2,
    Save,
    FileText,
    Settings,
    Loader2,
    AlertTriangle,
    CheckCircle2,
    Brain,
    MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface KnowledgeItem {
    id: string;
    title: string;
    content: string;
    fileType: string;
    createdAt: string;
    userId: string;
}

interface AiKnowledgeBaseProps {
    className?: string;
}

export default function AiKnowledgeBase({ className = "" }: AiKnowledgeBaseProps) {
    const [items, setItems] = useState<KnowledgeItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Form state
    const [activeTab, setActiveTab] = useState<"instructions" | "knowledge">("instructions");
    const [newTitle, setNewTitle] = useState("");
    const [newContent, setNewContent] = useState("");

    // Load items
    useEffect(() => {
        loadItems();
    }, []);

    // Auto-clear success message
    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [success]);

    const loadItems = async () => {
        try {
            setIsLoading(true);
            const res = await fetch("/api/ai-knowledge", { credentials: "include" });
            if (!res.ok) throw new Error("Error al cargar la base de conocimiento");
            const data = await res.json();
            setItems(data.items || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!newTitle.trim() || !newContent.trim()) {
            setError("Se requiere título y contenido.");
            return;
        }

        try {
            setIsSaving(true);
            setError(null);
            const res = await fetch("/api/ai-knowledge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    title: newTitle.trim(),
                    content: newContent.trim(),
                    fileType: activeTab === "instructions" ? "instruction" : "text",
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Error al guardar");
            }

            setNewTitle("");
            setNewContent("");
            setSuccess(activeTab === "instructions" ? "Instrucción guardada exitosamente" : "Documento guardado exitosamente");
            await loadItems();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar este elemento?")) return;

        try {
            const res = await fetch(`/api/ai-knowledge/${id}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (!res.ok) throw new Error("Error al eliminar");
            setSuccess("Elemento eliminado");
            await loadItems();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const instructionItems = items.filter(i => i.fileType === "instruction");
    const knowledgeItems = items.filter(i => i.fileType !== "instruction");

    return (
        <div className={`flex flex-col h-full bg-white dark:bg-slate-900 ${className}`}>
            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20 ring-4 ring-purple-500/5">
                        <Brain className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-gray-900 dark:text-white leading-tight tracking-tight">
                            Base de Conocimiento
                        </h2>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-0.5">
                            Configura el comportamiento y conocimiento del AI
                        </p>
                    </div>
                </div>

                {/* Inner tabs */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab("instructions")}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "instructions"
                                ? "bg-purple-500 text-white shadow-lg shadow-purple-500/20"
                                : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                            }`}
                    >
                        <Settings className="w-4 h-4" />
                        Instrucciones
                    </button>
                    <button
                        onClick={() => setActiveTab("knowledge")}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "knowledge"
                                ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                                : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                            }`}
                    >
                        <BookOpen className="w-4 h-4" />
                        Documentos
                    </button>
                </div>
            </div>

            {/* Alerts */}
            {error && (
                <div className="mx-8 mt-4 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl text-sm text-red-600 dark:text-red-400 flex items-center gap-3 font-medium">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">×</button>
                </div>
            )}
            {success && (
                <div className="mx-8 mt-4 px-4 py-3 bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30 rounded-xl text-sm text-green-600 dark:text-green-400 flex items-center gap-3 font-medium animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    {success}
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
                {/* Explanation card */}
                <div className={`p-5 rounded-2xl border ${activeTab === "instructions"
                        ? "bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/10 dark:to-indigo-900/10 border-purple-100 dark:border-purple-800/30"
                        : "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/10 dark:to-cyan-900/10 border-blue-100 dark:border-blue-800/30"
                    }`}>
                    <div className="flex items-start gap-3">
                        {activeTab === "instructions" ? (
                            <Settings className="w-5 h-5 text-purple-500 mt-0.5" />
                        ) : (
                            <BookOpen className="w-5 h-5 text-blue-500 mt-0.5" />
                        )}
                        <div>
                            <h3 className={`font-bold text-sm ${activeTab === "instructions" ? "text-purple-900 dark:text-purple-300" : "text-blue-900 dark:text-blue-300"}`}>
                                {activeTab === "instructions"
                                    ? "¿Qué son las instrucciones?"
                                    : "¿Qué son los documentos de conocimiento?"}
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                                {activeTab === "instructions"
                                    ? "Las instrucciones definen CÓMO debe comportarse el asistente: su tono, reglas de negocio, restricciones, y directrices de comunicación. Ejemplo: \"Siempre ofrece un descuento del 10% en pedidos mayores a $500.000\"."
                                    : "Los documentos son información que el AI puede consultar para dar mejores respuestas: fichas técnicas, procedimientos internos, catálogos, políticas de la empresa, etc."}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Add new item form */}
                <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Plus className="w-4 h-4 text-blue-500" />
                        {activeTab === "instructions" ? "Agregar nueva instrucción" : "Agregar nuevo documento"}
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                Título
                            </label>
                            <input
                                type="text"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                placeholder={activeTab === "instructions"
                                    ? "Ej: Reglas de descuentos y precios"
                                    : "Ej: Ficha técnica Pintura Élite Interior"}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                Contenido
                            </label>
                            <textarea
                                value={newContent}
                                onChange={(e) => setNewContent(e.target.value)}
                                placeholder={activeTab === "instructions"
                                    ? "Escribe las instrucciones que el AI debe seguir..."
                                    : "Pega aquí el contenido del documento..."}
                                rows={8}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y min-h-[120px] transition-all"
                            />
                        </div>

                        <Button
                            onClick={handleAdd}
                            disabled={isSaving || !newTitle.trim() || !newContent.trim()}
                            className={`w-full h-12 rounded-xl font-bold text-sm shadow-lg transition-all ${activeTab === "instructions"
                                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-500/20"
                                    : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/20"
                                }`}
                        >
                            {isSaving ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                                <Save className="w-4 h-4 mr-2" />
                            )}
                            {isSaving ? "Guardando..." : "Guardar"}
                        </Button>
                    </div>
                </div>

                {/* Existing items list */}
                <div>
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        {activeTab === "instructions" ? (
                            <><Settings className="w-4 h-4 text-purple-500" /> Instrucciones activas ({instructionItems.length})</>
                        ) : (
                            <><FileText className="w-4 h-4 text-blue-500" /> Documentos en la base ({knowledgeItems.length})</>
                        )}
                    </h3>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                        </div>
                    ) : (activeTab === "instructions" ? instructionItems : knowledgeItems).length === 0 ? (
                        <div className="text-center py-12 px-6">
                            <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${activeTab === "instructions"
                                    ? "bg-purple-50 dark:bg-purple-900/10"
                                    : "bg-blue-50 dark:bg-blue-900/10"
                                }`}>
                                {activeTab === "instructions"
                                    ? <MessageSquare className="w-8 h-8 text-purple-400" />
                                    : <BookOpen className="w-8 h-8 text-blue-400" />
                                }
                            </div>
                            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                                {activeTab === "instructions"
                                    ? "No hay instrucciones personalizadas"
                                    : "No hay documentos en la base de conocimiento"}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                {activeTab === "instructions"
                                    ? "Agrega instrucciones para personalizar el comportamiento del AI"
                                    : "Agrega documentos para que el AI pueda consultar información específica"}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {(activeTab === "instructions" ? instructionItems : knowledgeItems).map((item) => (
                                <div
                                    key={item.id}
                                    className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 group hover:shadow-md transition-all"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                {item.fileType === "instruction" ? (
                                                    <Settings className="w-4 h-4 text-purple-500 flex-shrink-0" />
                                                ) : (
                                                    <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                                )}
                                                <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                                                    {item.title}
                                                </h4>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed">
                                                {item.content}
                                            </p>
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-wider font-bold">
                                                Creado: {new Date(item.createdAt).toLocaleDateString("es-CL")}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(item.id)}
                                            className="h-9 w-9 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
