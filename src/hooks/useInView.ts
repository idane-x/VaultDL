import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseInViewResult<T extends Element> {
  /** Ref callback to attach to the element that should be observed. */
  ref: (node: T | null) => void;
  /** True once the element has intersected the viewport at least once (then stays true). */
  inView: boolean;
}

/**
 * Tracks whether an element has scrolled into view, via IntersectionObserver. Latches to
 * `true` the first time it intersects and disconnects — used to gate lazy data fetches
 * (e.g. per-row metadata) without re-fetching every time the element scrolls in and out.
 */
export function useInView<T extends Element>(options?: IntersectionObserverInit): UseInViewResult<T> {
  const [inView, setInView] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback(
    (node: T | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;

      if (!node || inView) return;

      const observer = new IntersectionObserver(([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      }, options);
      observer.observe(node);
      observerRef.current = observer;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inView],
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return { ref, inView };
}
