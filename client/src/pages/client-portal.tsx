import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAiChat } from "@/hooks/useAiChat";
import AiChatView from "@/components/ai-chat/AiChatView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Package, Bot, Search, Loader2 } from "lucide-react";

interface ProductItem {
    productSku: string;
    productName: string | null;
    branchCode: string;
    warehouseCode: string;
    warehouseName: string | null;
    stock1: number;
    stock2: number;
    unit1?: string;
    unit2?: string;
    availableQuantity: number;
    reservedQuantity: number;
}

const CLIENT_AI_SUGGESTIONS = [
    "¿Qué pinturas tienen para exterior?",
    "¿Qué esmaltes al agua tienen?",
    "Quiero cotizar productos para una obra",
    "¿Tienen barniz marino?",
    "¿Qué productos recomiendan para humedad?",
    "Necesito pintura para metal",
];

function ProductosTab() {
    const [searchTerm, setSearchTerm] = useState("");

    const { data: inventory = [], isLoading } = useQuery<ProductItem[]>({
        queryKey: ["/api/inventory", searchTerm],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (searchTerm) params.append("search", searchTerm);
            const response = await fetch(`/api/inventory?${params}`, {
                credentials: "include",
            });
            if (!response.ok) {
                if (response.status === 404) return [];
                throw new Error("Error al cargar productos");
            }
            return response.json();
        },
    });

    // Group and deduplicate by product SKU (show unique products)
    const uniqueProducts = (() => {
        const map = new Map<string, ProductItem>();
        for (const item of inventory) {
            const existing = map.get(item.productSku);
            if (!existing || item.availableQuantity > existing.availableQuantity) {
                map.set(item.productSku, item);
            }
        }
        return Array.from(map.values()).filter(
            (p) => p.availableQuantity > 0 && !p.productSku?.toUpperCase().startsWith("ZZ")
        );
    })();

    return (
        <div className="space-y-4 p-4 md:p-6">
            {/* Search */}
            <div className="relative max-w-xl">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar producto por nombre o código..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-11 rounded-xl border-gray-200 focus:border-blue-400"
                    data-testid="input-client-search"
                />
            </div>

            {/* Results */}
            {isLoading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
            ) : uniqueProducts.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
                    <p className="text-lg font-medium">No se encontraron productos</p>
                    <p className="text-sm mt-1">Intenta buscar con otro término</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {uniqueProducts.map((product) => (
                        <Card
                            key={product.productSku}
                            className="rounded-2xl border border-gray-100 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                            data-testid={`card-product-${product.productSku}`}
                        >
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <Badge
                                        variant="outline"
                                        className="text-[10px] font-mono bg-gray-50 text-gray-600 shrink-0"
                                    >
                                        {product.productSku}
                                    </Badge>
                                    <Badge
                                        className={`text-[10px] shrink-0 ${product.availableQuantity > 10
                                            ? "bg-green-100 text-green-700 hover:bg-green-100"
                                            : "bg-orange-100 text-orange-700 hover:bg-orange-100"
                                            }`}
                                    >
                                        {product.availableQuantity > 10 ? "Disponible" : "Stock limitado"}
                                    </Badge>
                                </div>
                                <h3 className="font-semibold text-sm text-gray-900 leading-snug mb-3">
                                    {product.productName || product.productSku}
                                </h3>
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                    {product.stock1 > 0 && (
                                        <span>
                                            <span className="font-medium text-gray-700">
                                                {product.stock1.toLocaleString("es-CL", { maximumFractionDigits: 0 })}
                                            </span>{" "}
                                            {product.unit1 || "ud"}
                                        </span>
                                    )}
                                    {product.stock2 > 0 && (
                                        <span>
                                            <span className="font-medium text-gray-700">
                                                {product.stock2.toLocaleString("es-CL", { maximumFractionDigits: 0 })}
                                            </span>{" "}
                                            {product.unit2 || "ud"}
                                        </span>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {!isLoading && uniqueProducts.length > 0 && (
                <p className="text-center text-xs text-muted-foreground pt-2">
                    Mostrando {uniqueProducts.length} productos con stock disponible
                </p>
            )}
        </div>
    );
}

export default function ClientPortal() {
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const initialTab = urlParams?.get('tab') === 'ai' ? 'ai' : 'productos';
    const [activeTab, setActiveTab] = useState<"productos" | "ai">(initialTab as "productos" | "ai");
    const aiChat = useAiChat();

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-50">
            {/* Tab bar */}
            <div className="flex items-center gap-2 px-4 md:px-6 py-3 bg-white border-b border-gray-100 shadow-sm">
                <button
                    onClick={() => setActiveTab("productos")}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "productos"
                        ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                    data-testid="tab-productos"
                >
                    <Package className="w-4 h-4" />
                    Productos
                </button>
                <button
                    onClick={() => setActiveTab("ai")}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "ai"
                        ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                    data-testid="tab-ai"
                >
                    <Bot className="w-4 h-4" />
                    Asistente IA
                </button>
            </div>

            {/* Content */}
            <main className="flex-1 flex flex-col min-h-0 bg-white shadow-sm border-x border-gray-100 mx-auto w-full max-w-[1600px] overflow-y-auto">
                {activeTab === "productos" ? (
                    <ProductosTab />
                ) : (
                    <AiChatView
                        messages={aiChat.messages}
                        isLoading={aiChat.isLoading}
                        error={aiChat.error}
                        onSendMessage={aiChat.sendMessage}
                        onClearHistory={aiChat.clearHistory}
                        onNewConversation={aiChat.newConversation}
                        suggestions={CLIENT_AI_SUGGESTIONS}
                        welcomeTitle="Asistente Panorámica"
                        welcomeSubtitle="¿En qué puedo ayudarte hoy? Pregunta sobre productos, disponibilidad o recomendaciones."
                    />
                )}
            </main>
        </div>
    );
}
