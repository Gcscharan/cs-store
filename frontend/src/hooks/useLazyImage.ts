import { useState, useEffect } from 'react';

interface UseLazyImageOptions {
  threshold?: number;
  rootMargin?: string;
  priority?: boolean;
}

export function useLazyImage(
  elementRef: React.RefObject<Element>,
  options: UseLazyImageOptions = {}
) {
  const { threshold = 0.1, rootMargin = '200px', priority = false } = options;
  const [isVisible, setIsVisible] = useState(priority);
  const [shouldLoad, setShouldLoad] = useState(priority);

  useEffect(() => {
    if (priority) {
      setShouldLoad(true);
      setIsVisible(true);
      return;
    }

    const element = elementRef.current;
    if (!element) return;

    // Fallback for browsers without IntersectionObserver
    if (!('IntersectionObserver' in window)) {
      setIsVisible(true);
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            setShouldLoad(true);
            observer.unobserve(element);
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [elementRef, threshold, rootMargin, priority]);

  return { isVisible, shouldLoad };
}
