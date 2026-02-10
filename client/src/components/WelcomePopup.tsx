import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { X, Sparkles } from "lucide-react";

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Buenos días";
    if (hour >= 12 && hour < 19) return "Buenas tardes";
    return "Buenas noches";
}

function getDisplayName(user: any): string {
    if (user.fullName && user.fullName.trim()) {
        return user.fullName.split(" ")[0]; // First name only
    }
    if (user.username) {
        if (user.username.includes("@")) {
            const namePart = user.username.split("@")[0];
            return namePart.charAt(0).toUpperCase() + namePart.slice(1);
        }
        return user.username;
    }
    if (user.email) {
        const namePart = user.email.split("@")[0];
        return namePart.charAt(0).toUpperCase() + namePart.slice(1);
    }
    return "Usuario";
}

function getMotivationalMessage(): string {
    const messages = [
        "¡Que tengas un excelente día de trabajo! 💪",
        "¡Listo para conquistar el día! 🚀",
        "¡Hoy es un gran día para lograr cosas increíbles! ✨",
        "¡Tu esfuerzo hace la diferencia! 🌟",
        "¡Vamos con toda la energía! ⚡",
    ];
    return messages[Math.floor(Math.random() * messages.length)];
}

export function WelcomePopup() {
    const { user } = useAuth();
    const [visible, setVisible] = useState(false);
    const [closing, setClosing] = useState(false);

    useEffect(() => {
        if (!user) return;

        // Only show once per session
        const sessionKey = `welcome_shown_${user.id || "default"}`;
        if (sessionStorage.getItem(sessionKey)) return;

        sessionStorage.setItem(sessionKey, "true");
        // Small delay so layout settles first
        const timer = setTimeout(() => setVisible(true), 600);
        return () => clearTimeout(timer);
    }, [user]);

    // Auto-close after 5 seconds
    useEffect(() => {
        if (!visible) return;
        const timer = setTimeout(() => handleClose(), 5000);
        return () => clearTimeout(timer);
    }, [visible]);

    const handleClose = () => {
        setClosing(true);
        setTimeout(() => setVisible(false), 400);
    };

    if (!visible || !user) return null;

    const greeting = getGreeting();
    const name = getDisplayName(user);
    const message = getMotivationalMessage();

    return (
        <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center transition-all duration-400 ${closing ? "opacity-0" : "opacity-100"}`}
            style={{ backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
            onClick={handleClose}
        >
            <div
                className={`relative mx-4 w-full max-w-md transform transition-all duration-500 ${closing ? "scale-90 opacity-0 translate-y-4" : "scale-100 opacity-100 translate-y-0"}`}
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: "linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e1b4b 100%)",
                    borderRadius: "1.25rem",
                    border: "1px solid rgba(148, 163, 184, 0.15)",
                    boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 80px rgba(99, 102, 241, 0.15)",
                }}
            >
                {/* Decorative glow */}
                <div
                    style={{
                        position: "absolute",
                        top: "-1px",
                        left: "10%",
                        right: "10%",
                        height: "2px",
                        background: "linear-gradient(90deg, transparent, #818cf8, #a78bfa, #818cf8, transparent)",
                        borderRadius: "1px",
                    }}
                />

                {/* Close button */}
                <button
                    onClick={handleClose}
                    className="absolute top-3 right-3 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                    <X size={18} />
                </button>

                <div className="p-8 text-center">
                    {/* Icon */}
                    <div
                        className="mx-auto mb-5 flex items-center justify-center"
                        style={{
                            width: "64px",
                            height: "64px",
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                            boxShadow: "0 8px 30px rgba(99, 102, 241, 0.4)",
                        }}
                    >
                        <Sparkles size={30} className="text-white" />
                    </div>

                    {/* Greeting */}
                    <h2
                        className="text-2xl font-bold mb-1"
                        style={{
                            background: "linear-gradient(135deg, #e2e8f0, #ffffff)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                        }}
                    >
                        {greeting}, {name}!
                    </h2>

                    <p className="text-slate-400 text-sm mt-3 leading-relaxed">{message}</p>

                    {/* Progress bar auto-close indicator */}
                    <div className="mt-6 mx-auto w-3/4 h-1 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(148, 163, 184, 0.15)" }}>
                        <div
                            className="h-full rounded-full"
                            style={{
                                background: "linear-gradient(90deg, #6366f1, #a78bfa)",
                                animation: "welcomeProgress 5s linear forwards",
                            }}
                        />
                    </div>
                </div>

                <style>{`
          @keyframes welcomeProgress {
            from { width: 100%; }
            to { width: 0%; }
          }
        `}</style>
            </div>
        </div>
    );
}
