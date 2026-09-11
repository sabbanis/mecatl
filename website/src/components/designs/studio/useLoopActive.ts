import {useEffect, useRef, useState, type RefObject} from 'react';

/**
 * Gate for every looping animation on the page: true only while the element is
 * on screen, the tab is visible and the user has not asked for reduced motion.
 * SSR-safe — nothing runs outside useEffect, and loops are off by default.
 */
export default function useLoopActive<T extends HTMLElement>(): {ref: RefObject<T | null>; active: boolean} {
  const ref = useRef<T | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    let inView = false;
    const update = () => setActive(inView && !mq.matches && document.visibilityState === 'visible');

    let io: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) => {
          inView = entries.some((e) => e.isIntersecting);
          update();
        },
        {threshold: 0.05},
      );
      io.observe(el);
    } else {
      inView = true;
      update();
    }
    document.addEventListener('visibilitychange', update);
    mq.addEventListener('change', update);
    return () => {
      if (io) io.disconnect();
      document.removeEventListener('visibilitychange', update);
      mq.removeEventListener('change', update);
    };
  }, []);

  return {ref, active};
}
