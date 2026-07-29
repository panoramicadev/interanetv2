/**
 * TourContext — Estado del tour guiado
 *
 * Un "tour" es una guía de shared/module-map.ts ejecutándose en pantalla:
 * navega al módulo, marca el elemento de cada paso y avanza.
 *
 * El estado vive en sessionStorage porque algunas rutas de la app se
 * recargan con window.location.replace: sin persistir, el tour se cortaría
 * justo al cambiar de módulo.
 */
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { useLocation } from "wouter";
import { resolveGuide, type GuideStep } from "@shared/module-map";

const STORAGE_KEY = "panoramica.tour.v1";

export interface ActiveTour {
    guideId: string;
    title: string;
    moduleLabel: string;
    steps: GuideStep[];
    index: number;
}

interface TourContextValue {
    tour: ActiveTour | null;
    /** Arranca una guía por su id (`moduloId::guiaId` o solo `guiaId`). */
    startTour: (guideId: string) => boolean;
    next: () => void;
    prev: () => void;
    goTo: (index: number) => void;
    stop: () => void;
    isLast: boolean;
}

const TourContext = createContext<TourContextValue | null>(null);

function readStored(): ActiveTour | null {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.guideId || !Array.isArray(parsed.steps) || parsed.steps.length === 0) return null;
        return parsed as ActiveTour;
    } catch {
        return null;
    }
}

export function TourProvider({ children }: { children: ReactNode }) {
    const [tour, setTour] = useState<ActiveTour | null>(() =>
        typeof window === "undefined" ? null : readStored(),
    );
    const [location, navigate] = useLocation();
    // Evita re-navegar en loop cuando el usuario ya está en la ruta del paso.
    const lastNavigated = useRef<string | null>(null);

    // Persistir para sobrevivir recargas de página en medio del tour.
    useEffect(() => {
        try {
            if (tour) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tour));
            else sessionStorage.removeItem(STORAGE_KEY);
        } catch {
            /* sessionStorage lleno o bloqueado: el tour sigue funcionando en memoria */
        }
    }, [tour]);

    // Llevar al usuario a la ruta que pide el paso actual.
    useEffect(() => {
        if (!tour) {
            lastNavigated.current = null;
            return;
        }
        const step = tour.steps[tour.index];
        const target = step?.route;
        if (!target || target === location) return;
        // Los pasos `manual` marcan el menú y esperan el clic del usuario: ahí
        // navegar solo lo teletransportaría y le quitaría lo que se le está
        // enseñando. Si igual aprieta "Siguiente", el paso siguiente sí navega.
        if (step.manual) return;
        // Una navegación por paso: si el usuario se va a otra ruta a mitad del
        // paso, no lo arrastramos de vuelta.
        const stamp = `${tour.guideId}:${tour.index}`;
        if (lastNavigated.current === stamp) return;
        lastNavigated.current = stamp;
        navigate(target);
    }, [tour, location, navigate]);

    const startTour = useCallback((guideId: string) => {
        const resolved = resolveGuide(guideId);
        if (!resolved) {
            console.warn("[Tour] Guía no encontrada:", guideId);
            return false;
        }
        lastNavigated.current = null;
        setTour({
            guideId,
            title: resolved.guide.title,
            moduleLabel: resolved.module.label,
            steps: resolved.steps,
            index: 0,
        });
        return true;
    }, []);

    const next = useCallback(() => {
        setTour((prev) => {
            if (!prev) return prev;
            if (prev.index >= prev.steps.length - 1) return null; // último paso → cierra
            return { ...prev, index: prev.index + 1 };
        });
    }, []);

    const prev = useCallback(() => {
        setTour((current) => {
            if (!current) return current;
            return { ...current, index: Math.max(0, current.index - 1) };
        });
    }, []);

    const goTo = useCallback((index: number) => {
        setTour((current) => {
            if (!current) return current;
            const clamped = Math.min(Math.max(0, index), current.steps.length - 1);
            return { ...current, index: clamped };
        });
    }, []);

    const stop = useCallback(() => setTour(null), []);

    // Escape corta el tour: es la salida que la gente busca por instinto.
    useEffect(() => {
        if (!tour) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") stop();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [tour, stop]);

    const value = useMemo<TourContextValue>(
        () => ({
            tour,
            startTour,
            next,
            prev,
            goTo,
            stop,
            isLast: !!tour && tour.index === tour.steps.length - 1,
        }),
        [tour, startTour, next, prev, goTo, stop],
    );

    return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
    const ctx = useContext(TourContext);
    if (!ctx) {
        // Sin provider (por ejemplo en el catálogo público) el tour queda inerte
        // en lugar de romper la página.
        return {
            tour: null,
            startTour: () => false,
            next: () => { },
            prev: () => { },
            goTo: () => { },
            stop: () => { },
            isLast: false,
        };
    }
    return ctx;
}
