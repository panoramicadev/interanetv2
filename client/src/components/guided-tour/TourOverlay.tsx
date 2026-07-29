/**
 * TourOverlay — Marca en pantalla dónde hacer clic
 *
 * Dibuja un recuadro luminoso sobre el elemento del paso actual, oscurece el
 * resto y muestra la instrucción al lado. El overlay NO bloquea clics: la app
 * queda usable y el usuario hace el clic real sobre lo que está marcado.
 * Cuando lo hace, el tour avanza solo.
 *
 * Resolución del objetivo en cascada: selector CSS → data-testid → texto
 * visible. Si nada calza, el paso se muestra como tarjeta centrada con la
 * instrucción escrita, en vez de marcar un elemento equivocado.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, MousePointerClick, Sparkles, X } from "lucide-react";
import type { TourTarget } from "@shared/module-map";
import { useTour } from "./TourContext";

// El sidebar de la app usa z-[60] y tapa los modales z-50: el tour vive arriba.
const Z = 100;
const PAD = 6;

interface Rect {
    top: number;
    left: number;
    width: number;
    height: number;
}

function normalize(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function isVisible(el: Element): boolean {
    const node = el as HTMLElement;
    if (node.closest("[data-tour-overlay]")) return false;
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = window.getComputedStyle(node);
    return style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
}

function candidatesFor(as: TourTarget["as"]): string {
    switch (as) {
        case "tab":
            return '[role="tab"], [data-state][role="tab"]';
        case "button":
            return 'button, [role="button"], a[href]';
        case "link":
            return "a[href]";
        case "field":
            return "input, textarea, select";
        default:
            return 'button, [role="button"], [role="tab"], a[href], label, summary, h1, h2, h3';
    }
}

/** Texto visible de un control, incluyendo aria-label / placeholder para campos. */
function labelOf(el: Element): string {
    const node = el as HTMLElement;
    const aria = node.getAttribute("aria-label");
    const placeholder = node.getAttribute("placeholder");
    return normalize([node.innerText || node.textContent || "", aria || "", placeholder || ""].join(" "));
}

/** Cómo se resolvió el objetivo: el ítem exacto, o el grupo que lo contiene. */
type Resolution = { el: HTMLElement; kind: "direct" | "group" };

/**
 * Ubica el acceso a un módulo en el menú lateral por su ruta.
 * Si el módulo está dentro de un grupo cerrado, su enlace no existe todavía en
 * el DOM: en ese caso devuelve el botón del grupo, para marcarlo primero.
 */
function resolveNav(href: string): Resolution | null {
    const direct = Array.from(document.querySelectorAll(`a[href="${href}"]`)).find(
        (el) => isVisible(el) && !!el.closest("nav, aside, [data-testid='sidebar']"),
    );
    if (direct) {
        // El área clickeable real es el botón interno, si lo hay.
        const inner = (direct as HTMLElement).querySelector("button");
        return { el: (inner || direct) as HTMLElement, kind: "direct" };
    }

    const group = Array.from(document.querySelectorAll("[data-tour-children]")).find((el) => {
        const children = (el.getAttribute("data-tour-children") || "").split(/\s+/);
        return children.includes(href) && isVisible(el);
    });
    if (group) return { el: group as HTMLElement, kind: "group" };

    return null;
}

function resolveTarget(target?: TourTarget): Resolution | null {
    if (!target) return null;

    if (target.navHref) {
        const nav = resolveNav(target.navHref);
        if (nav) return nav;
    }

    if (target.selector) {
        const found = Array.from(document.querySelectorAll(target.selector)).find(isVisible);
        if (found) return { el: found as HTMLElement, kind: "direct" };
    }

    if (target.testid) {
        const found = Array.from(
            document.querySelectorAll(`[data-testid="${target.testid}"]`),
        ).find(isVisible);
        if (found) return { el: found as HTMLElement, kind: "direct" };
    }

    if (target.text) {
        const wanted = normalize(target.text);
        const nodes = Array.from(document.querySelectorAll(candidatesFor(target.as))).filter(isVisible);
        // Coincidencia exacta primero: evita que "Productos" del menú gane
        // sobre la pestaña "Productos" que realmente buscamos, y al revés.
        const exact = nodes.find((n) => labelOf(n) === wanted);
        if (exact) return { el: exact as HTMLElement, kind: "direct" };
        const partial = nodes
            .filter((n) => labelOf(n).includes(wanted))
            // El más específico: el de menos texto alrededor.
            .sort((a, b) => labelOf(a).length - labelOf(b).length)[0];
        if (partial) return { el: partial as HTMLElement, kind: "direct" };
    }

    return null;
}

export default function TourOverlay() {
    const { tour, next, prev, stop, isLast } = useTour();
    const [rect, setRect] = useState<Rect | null>(null);
    const [searching, setSearching] = useState(false);
    const [kind, setKind] = useState<Resolution["kind"] | null>(null);
    const elementRef = useRef<HTMLElement | null>(null);
    const kindRef = useRef<Resolution["kind"] | null>(null);
    const step = tour ? tour.steps[tour.index] : null;

    const measure = useCallback(() => {
        const el = elementRef.current;
        if (!el || !document.body.contains(el)) {
            setRect(null);
            return;
        }
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }, []);

    // Buscar el elemento del paso. Se reintenta un rato porque la pantalla
    // puede estar todavía cargando datos o abriendo un submenú.
    useLayoutEffect(() => {
        const reset = () => {
            elementRef.current = null;
            kindRef.current = null;
            setKind(null);
            setRect(null);
        };

        if (!step) {
            reset();
            return;
        }
        reset();

        if (!step.target) {
            setSearching(false);
            return;
        }

        setSearching(true);
        let cancelled = false;
        let attempts = 0;

        const adopt = (found: Resolution) => {
            elementRef.current = found.el;
            kindRef.current = found.kind;
            setKind(found.kind);
            setSearching(false);
            found.el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
            // Deja terminar el scroll antes de medir.
            window.setTimeout(measure, 320);
        };

        const tick = () => {
            if (cancelled) return;
            const found = resolveTarget(step.target);

            if (found) {
                const changed = found.el !== elementRef.current;
                if (changed) adopt(found);
                // Mientras estemos marcando un grupo del menú, seguimos mirando:
                // cuando el usuario lo abre, el ítem real aparece y el marcado
                // salta solo hacia él.
                if (found.kind === "group") {
                    window.setTimeout(tick, 250);
                }
                return;
            }

            attempts += 1;
            if (attempts > 20) {
                // ~5s: el elemento no está en esta pantalla. El paso se muestra
                // como tarjeta con la instrucción escrita.
                setSearching(false);
                return;
            }
            window.setTimeout(tick, 250);
        };
        tick();

        return () => {
            cancelled = true;
        };
    }, [step, tour?.index, measure]);

    // Mantener el recuadro pegado al elemento mientras la página se mueve.
    useEffect(() => {
        if (!tour) return;
        const onChange = () => measure();
        window.addEventListener("scroll", onChange, true);
        window.addEventListener("resize", onChange);
        const interval = window.setInterval(onChange, 500);
        return () => {
            window.removeEventListener("scroll", onChange, true);
            window.removeEventListener("resize", onChange);
            window.clearInterval(interval);
        };
    }, [tour, measure]);

    // Avanzar cuando el usuario hace el clic real sobre lo marcado.
    useEffect(() => {
        if (!tour || !step) return;
        const onClick = (e: MouseEvent) => {
            const el = elementRef.current;
            if (!el) return;
            const targetNode = e.target as Node | null;
            if (!targetNode || !el.contains(targetNode)) return;
            // Si lo marcado es el grupo del menú que contiene al módulo, este
            // clic solo lo despliega: el paso sigue siendo el mismo y el
            // marcado se mueve al ítem real.
            if (kindRef.current === "group") return;
            // Deja que la app procese el clic (abrir submenú, navegar, abrir
            // modal) antes de pasar al paso siguiente.
            window.setTimeout(() => next(), 450);
        };
        document.addEventListener("click", onClick, true);
        return () => document.removeEventListener("click", onClick, true);
    }, [tour, step, next]);

    if (!tour || !step) return null;

    const total = tour.steps.length;
    const position = tour.index + 1;

    const spot = rect
        ? {
            top: Math.max(rect.top - PAD, 0),
            left: Math.max(rect.left - PAD, 0),
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
        }
        : null;

    // Posición de la tarjeta. Prioridad al costado cuando el elemento marcado
    // es angosto y está pegado a un borde (el caso del menú lateral): si la
    // tarjeta se pusiera debajo, taparía justo los ítems del menú que el
    // usuario tiene que ver a continuación.
    const cardWidth = 360;
    const cardHeight = 240; // alto aproximado, solo para decidir el lado
    const GAP = 14;
    const M = 12;
    let cardStyle: React.CSSProperties;

    if (spot) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const clampTop = (t: number) => Math.min(Math.max(t, M), Math.max(vh - cardHeight - M, M));
        const clampLeft = (l: number) => Math.min(Math.max(l, M), Math.max(vw - cardWidth - M, M));

        const roomRight = vw - (spot.left + spot.width) - GAP;
        const roomLeft = spot.left - GAP;
        const roomBelow = vh - (spot.top + spot.height) - GAP;
        const isNarrow = spot.width < vw / 3;

        if (isNarrow && roomRight >= cardWidth + M) {
            // Al costado derecho, alineada con el elemento.
            cardStyle = { top: clampTop(spot.top), left: spot.left + spot.width + GAP, width: cardWidth };
        } else if (isNarrow && roomLeft >= cardWidth + M) {
            cardStyle = { top: clampTop(spot.top), left: spot.left - GAP - cardWidth, width: cardWidth };
        } else if (roomBelow >= cardHeight) {
            cardStyle = {
                top: spot.top + spot.height + GAP,
                left: clampLeft(spot.left + spot.width / 2 - cardWidth / 2),
                width: cardWidth,
            };
        } else {
            cardStyle = {
                top: Math.max(spot.top - GAP, M),
                left: clampLeft(spot.left + spot.width / 2 - cardWidth / 2),
                width: cardWidth,
                transform: "translateY(-100%)",
            };
        }
    } else {
        cardStyle = {
            top: "50%",
            left: "50%",
            width: cardWidth,
            transform: "translate(-50%, -50%)",
        };
    }

    return (
        <div data-tour-overlay className="fixed inset-0 pointer-events-none" style={{ zIndex: Z }}>
            {/* Oscurecido: cuatro paneles alrededor del elemento, para que el
          elemento marcado quede a plena luz y siga clickeable. */}
            {spot ? (
                <>
                    <div className="absolute bg-slate-950/55 transition-all duration-200" style={{ top: 0, left: 0, right: 0, height: spot.top }} />
                    <div className="absolute bg-slate-950/55 transition-all duration-200" style={{ top: spot.top + spot.height, left: 0, right: 0, bottom: 0 }} />
                    <div className="absolute bg-slate-950/55 transition-all duration-200" style={{ top: spot.top, left: 0, width: spot.left, height: spot.height }} />
                    <div className="absolute bg-slate-950/55 transition-all duration-200" style={{ top: spot.top, left: spot.left + spot.width, right: 0, height: spot.height }} />

                    {/* Recuadro luminoso + pulso */}
                    <div
                        className="absolute rounded-xl ring-4 ring-[#fd6301] shadow-[0_0_0_4px_rgba(253,99,1,0.25),0_0_30px_rgba(253,99,1,0.55)] transition-all duration-200"
                        style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
                    />
                    <div
                        className="absolute rounded-xl ring-2 ring-[#fd6301]/60 animate-ping"
                        style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
                    />
                </>
            ) : (
                <div className="absolute inset-0 bg-slate-950/55" />
            )}

            {/* Tarjeta de instrucción */}
            <div
                className="absolute pointer-events-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                style={cardStyle}
            >
                <div className="flex items-center justify-between gap-3 px-5 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
                    <div className="flex items-center gap-2 min-w-0">
                        <Sparkles className="w-4 h-4 text-[#fd6301] flex-shrink-0" />
                        <span className="text-xs font-bold uppercase tracking-wider truncate">
                            {tour.moduleLabel}
                        </span>
                    </div>
                    <button
                        onClick={stop}
                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
                        title="Salir de la guía (Esc)"
                        data-testid="tour-close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="px-5 pt-4 pb-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Paso {position} de {total} · {tour.title}
                    </p>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                        {step.title}
                    </h4>
                    {step.detail && (
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            {step.detail}
                        </p>
                    )}

                    {spot && (
                        <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#fd6301]">
                            <MousePointerClick className="w-3.5 h-3.5" />
                            {kind === "group"
                                ? "Abre este grupo del menú y te marco el módulo"
                                : "Haz clic en lo que está marcado y sigo yo"}
                        </p>
                    )}
                    {!spot && searching && (
                        <p className="mt-3 text-xs font-semibold text-slate-400">Buscándolo en la pantalla…</p>
                    )}
                    {!spot && !searching && step.target && (
                        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                            No lo encuentro en esta pantalla. Búscalo por su nombre
                            {step.target.text ? `: "${step.target.text}"` : ""} y sigue con "Siguiente".
                        </p>
                    )}
                </div>

                {/* Progreso */}
                <div className="px-5">
                    <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                            className="h-full bg-[#fd6301] transition-all duration-300"
                            style={{ width: `${(position / total) * 100}%` }}
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between gap-2 px-5 py-3">
                    <button
                        onClick={prev}
                        disabled={tour.index === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                        data-testid="tour-prev"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Atrás
                    </button>
                    <button
                        onClick={next}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white bg-[#fd6301] hover:brightness-110 shadow-md shadow-[#fd6301]/30 transition-all"
                        data-testid="tour-next"
                    >
                        {isLast ? (
                            <>
                                Listo
                                <Check className="w-4 h-4" />
                            </>
                        ) : (
                            <>
                                Siguiente
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
