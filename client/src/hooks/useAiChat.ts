/**
 * useAiChat — Hook for the AI chat assistant
 * 
 * Manages conversation state, message sending, and history persistence.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "./useAuth";

export interface ChatMessage {
    id?: string;
    role: "user" | "assistant" | "system";
    content: string;
    toolCalls?: string[];
    createdAt?: string;
    isLoading?: boolean;
}

interface ChatResponse {
    response: string;
    sessionId: string;
    toolsUsed: string[];
    tokensUsed?: number;
}

interface ChatHistoryResponse {
    messages: Array<{
        id: string;
        role: string;
        content: string;
        toolCalls: string[] | null;
        sessionId: string;
        createdAt: string;
    }>;
    sessionId: string | null;
}

export function useAiChat() {
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Load history when opening for the first time
    const loadHistory = useCallback(async (sid?: string) => {
        try {
            const url = sid
                ? `/api/chat/history?sessionId=${encodeURIComponent(sid)}&limit=50`
                : "/api/chat/history?limit=50";

            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) return;

            const data: ChatHistoryResponse = await res.json();

            if (data.messages.length > 0) {
                setMessages(
                    data.messages
                        .filter((m) => m.role === "user" || m.role === "assistant")
                        .map((m) => ({
                            id: m.id,
                            role: m.role as "user" | "assistant",
                            content: m.content || "",
                            toolCalls: m.toolCalls || undefined,
                            createdAt: m.createdAt,
                        }))
                );

                // Use the session from the most recent message
                if (!sid && data.messages.length > 0) {
                    setSessionId(data.messages[data.messages.length - 1].sessionId);
                }
            }
        } catch (err) {
            console.error("[useAiChat] Error loading history:", err);
        }
    }, []);

    // Send a message to the AI
    const sendMessage = useCallback(
        async (text: string) => {
            if (!text.trim() || isLoading) return;

            setError(null);

            // Add user message immediately
            const userMessage: ChatMessage = {
                role: "user",
                content: text.trim(),
                createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, userMessage]);

            // Add loading placeholder
            const loadingMessage: ChatMessage = {
                role: "assistant",
                content: "",
                isLoading: true,
            };
            setMessages((prev) => [...prev, loadingMessage]);

            setIsLoading(true);

            try {
                abortControllerRef.current = new AbortController();

                const res = await fetch("/api/chat/message", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        message: text.trim(),
                        sessionId,
                    }),
                    signal: abortControllerRef.current.signal,
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({ error: "Error desconocido" }));
                    throw new Error(errData.error || `Error ${res.status}`);
                }

                const data: ChatResponse = await res.json();

                // Update session ID if this is the first message
                if (!sessionId) {
                    setSessionId(data.sessionId);
                }

                // Replace loading message with actual response
                setMessages((prev) =>
                    prev.map((m, i) =>
                        i === prev.length - 1 && m.isLoading
                            ? {
                                role: "assistant" as const,
                                content: data.response,
                                toolCalls: data.toolsUsed,
                                createdAt: new Date().toISOString(),
                            }
                            : m
                    )
                );
            } catch (err: any) {
                if (err.name === "AbortError") return;

                const errorMsg = err.message || "Error al enviar mensaje";
                setError(errorMsg);

                // Replace loading message with error
                setMessages((prev) =>
                    prev.map((m, i) =>
                        i === prev.length - 1 && m.isLoading
                            ? {
                                role: "assistant" as const,
                                content: `⚠️ ${errorMsg}`,
                                createdAt: new Date().toISOString(),
                            }
                            : m
                    )
                );
            } finally {
                setIsLoading(false);
                abortControllerRef.current = null;
            }
        },
        [isLoading, sessionId]
    );

    // Clear conversation
    const clearHistory = useCallback(async () => {
        try {
            const url = sessionId
                ? `/api/chat/history?sessionId=${encodeURIComponent(sessionId)}`
                : "/api/chat/history";

            await fetch(url, {
                method: "DELETE",
                credentials: "include",
            });

            setMessages([]);
            setSessionId(null);
            setError(null);
        } catch (err) {
            console.error("[useAiChat] Error clearing history:", err);
        }
    }, [sessionId]);

    // New conversation
    const newConversation = useCallback(() => {
        setMessages([]);
        setSessionId(null);
        setError(null);
    }, []);

    // Open/close toggle
    const toggleOpen = useCallback(() => {
        setIsOpen((prev) => {
            const next = !prev;
            if (next && messages.length === 0) {
                loadHistory();
            }
            return next;
        });
    }, [messages.length, loadHistory]);

    return {
        messages,
        isLoading,
        error,
        sessionId,
        isOpen,
        sendMessage,
        clearHistory,
        newConversation,
        toggleOpen,
        setIsOpen,
    };
}
