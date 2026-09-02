import { useEffect, useRef, useState } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// Animates a numeric value counting up (or down) from its previous value
// (0 on first mount) to `value`, always via a requestAnimationFrame loop —
// state is only ever updated inside that async callback, never
// synchronously in the effect body. Renders "—" while `value` is not a
// real loaded number, and renders the value immediately (no animation,
// no state churn) when the viewer prefers reduced motion.
export default function AnimatedNumber({ value, format, durationMs = 900, className }) {
  const isValid = typeof value === "number" && Number.isFinite(value);
  const skipAnimation = !isValid || prefersReducedMotion();

  const [display, setDisplay] = useState(0);
  const prevValueRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!isValid || prefersReducedMotion()) {
      prevValueRef.current = isValid ? value : null;
      return undefined;
    }

    const from = typeof prevValueRef.current === "number" ? prevValueRef.current : 0;
    const to = value;
    prevValueRef.current = value;
    if (from === to) return undefined;

    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      const eased = easeOutCubic(t);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(to);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, isValid, durationMs]);

  const formatted = !isValid ? "—" : skipAnimation ? format(value) : format(display);
  return <span className={className}>{formatted}</span>;
}
