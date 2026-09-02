import { useMemo, useRef } from "react";
import { buildSparklineSeries, sparklinePath, sparklineAreaPath } from "../lib/charts.js";

// Generic line/area chart for any {date, tvl}[] series (TVL, volume or
// fees — see transforms.js normalize* helpers). Animates a stroke "draw"
// on mount via stroke-dasharray/offset; prefers-reduced-motion disables
// that in CSS (dashboard.css), so this component doesn't need its own
// media-query branch.
export default function Sparkline({
  history,
  days = 90,
  width = 600,
  height = 140,
  color = "#64ffda",
  area = true,
  label,
}) {
  const pathRef = useRef(null);
  const series = useMemo(() => buildSparklineSeries(history, days), [history, days]);
  const linePoints = useMemo(() => sparklinePath(series, width, height), [series, width, height]);
  const areaPoints = useMemo(() => (area ? sparklineAreaPath(series, width, height) : ""), [area, series, width, height]);

  if (!linePoints) return null;

  // Rough path length estimate for the dash animation (perimeter of the
  // bounding box is more than enough to fully cover any polyline in it).
  const dashLen = 2 * (width + height);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="cronos-sparkline"
      role="img"
      aria-label={label}
    >
      {area && areaPoints && (
        <polygon className="cronos-sparkline-area" points={areaPoints} fill={color} fillOpacity={0.12} />
      )}
      <polyline
        ref={pathRef}
        className="cronos-sparkline-line"
        points={linePoints}
        stroke={color}
        data-animate="true"
        style={{ strokeDasharray: dashLen, "--cr-dash-len": dashLen }}
      />
    </svg>
  );
}
