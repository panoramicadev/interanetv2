import { useEffect, useRef } from 'react';

/**
 * Marca el elemento con `cz-visible` la primera vez que entra en pantalla, para la
 * animación `.cz-revelar` de index.css. Sin IntersectionObserver queda visible de una.
 */
export function useAparecer<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('cz-visible');
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add('cz-visible');
          obs.disconnect();
        }
      },
      { rootMargin: '0px 0px -40px 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return ref;
}
