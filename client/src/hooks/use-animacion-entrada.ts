import { RefObject, useEffect, useRef, useState } from "react";

/** El equipo pide reducir animaciones: todo aparece directo en su valor. */
export const sinMovimiento = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * true mientras el elemento está a la vista. Vuelve a false al salir, así la
 * animación se repite cada vez que uno pasa por la tarjeta (pedido del usuario, oct-2026).
 */
export function useEnPantalla(ref: RefObject<Element>, umbral = 0.3): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (sinMovimiento() || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entrada]) => setVisible(entrada.isIntersecting),
      { threshold: umbral },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, umbral]);
  return visible;
}

/**
 * Cifra que avanza hasta `valor` cuando `activo` pasa a true (y vuelve a 0 al apagarse).
 * Si el valor cambia estando activo, avanza desde la cifra que se ve hasta la nueva.
 */
export function useContador(valor: number, activo: boolean, duracionMs = 1200): number {
  const objetivo = Number.isFinite(valor) ? valor : 0;
  const [mostrado, setMostrado] = useState(0);
  const actual = useRef(0);

  useEffect(() => {
    if (!activo) {
      actual.current = 0;
      setMostrado(0);
      return;
    }
    if (sinMovimiento()) {
      actual.current = objetivo;
      setMostrado(objetivo);
      return;
    }
    const desde = actual.current;
    const inicio = performance.now();
    let frame = 0;
    const paso = (ahora: number) => {
      const t = Math.min((ahora - inicio) / duracionMs, 1);
      const suave = 1 - Math.pow(1 - t, 3); // arranca rápido y frena al llegar
      const v = desde + (objetivo - desde) * suave;
      actual.current = v;
      setMostrado(v);
      if (t < 1) frame = requestAnimationFrame(paso);
    };
    frame = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(frame);
  }, [objetivo, activo, duracionMs]);

  return mostrado;
}
