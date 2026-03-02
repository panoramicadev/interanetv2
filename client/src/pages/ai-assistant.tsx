import { useState } from "react";
import { useAiChat } from "@/hooks/useAiChat";
import AiChatView from "@/components/ai-chat/AiChatView";
import AiKnowledgeBase from "@/components/ai-chat/AiKnowledgeBase";
import { MessageSquare, Brain } from "lucide-react";

export default function AiAssistantPage() {
    const aiChat = useAiChat();
    const [activeView, setActiveView] = useState<"chat" | "knowledge">("chat");

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-50 dark:bg-slate-950">
            {/* Top tab bar */}
            <div className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-gray-800 shadow-sm">
                <button
                    onClick={() => setActiveView("chat")}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeView === "chat"
                            ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                            : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700"
                        }`}
                >
                    <MessageSquare className="w-4 h-4" />
                    Chat
                </button>
                <button
                    onClick={() => setActiveView("knowledge")}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeView === "knowledge"
                            ? "bg-purple-500 text-white shadow-lg shadow-purple-500/20"
                            : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700"
                        }`}
                >
                    <Brain className="w-4 h-4" />
                    Base de Conocimiento
                </button>
            </div>

            {/* Content */}
            <main className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-900 shadow-sm border-x border-gray-100 dark:border-gray-800 mx-auto w-full max-w-[1600px]">
                {activeView === "chat" ? (
                    <AiChatView
                        messages={aiChat.messages}
                        isLoading={aiChat.isLoading}
                        error={aiChat.error}
                        onSendMessage={aiChat.sendMessage}
                        onClearHistory={aiChat.clearHistory}
                        onNewConversation={aiChat.newConversation}
                    />
                ) : (
                    <AiKnowledgeBase />
                )}
            </main>
        </div>
    );
}
