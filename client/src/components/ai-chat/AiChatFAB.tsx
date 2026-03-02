/**
 * AiChatFAB — Floating action button to open the AI chat
 * 
 * Positioned at the bottom-right corner with a pulse animation.
 */
import { Sparkles } from "lucide-react";

interface AiChatFABProps {
    onClick: () => void;
    isOpen: boolean;
}

export default function AiChatFAB({ onClick, isOpen }: AiChatFABProps) {
    if (isOpen) return null; // Hide when chat is open

    return (
        <button
            onClick={onClick}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center group"
            title="Abrir Panorámica AI"
            data-testid="button-ai-fab"
        >
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-2xl bg-blue-400 animate-ping opacity-20 group-hover:opacity-0" />
            <Sparkles className="w-6 h-6 relative z-10" />
        </button>
    );
}
