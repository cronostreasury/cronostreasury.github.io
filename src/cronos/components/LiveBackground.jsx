import { useMemo } from "react";

// Subtle, cheap decorative background: two slow-drifting gradient blobs
// (pure CSS transform animation, GPU-friendly) plus a handful of pulsing
// "network" dots rendered once as static SVG. No animation loop, no
// external library. prefers-reduced-motion is handled purely in CSS
// (dashboard.css), so this component needs no JS-side motion check.
function seededDots(count, seed) {
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    cx: rand() * 100,
    cy: rand() * 100,
    r: 1 + rand() * 1.6,
    delay: rand() * 6,
  }));
}

export default function LiveBackground() {
  const dots = useMemo(() => seededDots(22, 7), []);

  return (
    <div className="cronos-bg" aria-hidden="true">
      <div className="cronos-bg-blob cronos-bg-blob--a" />
      <div className="cronos-bg-blob cronos-bg-blob--b" />
      <svg className="cronos-bg-dots" preserveAspectRatio="none" viewBox="0 0 100 100">
        {dots.map((d) => (
          <circle
            key={d.id}
            className="cronos-bg-dot"
            cx={d.cx}
            cy={d.cy}
            r={d.r}
            fill="#64ffda"
            style={{ animationDelay: `${d.delay}s` }}
          />
        ))}
      </svg>
    </div>
  );
}
