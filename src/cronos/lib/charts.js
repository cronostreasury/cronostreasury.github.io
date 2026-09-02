// Pure SVG chart math shared by every sparkline / line chart on the
// Cronos dashboard. Works on a generic {date, tvl}[] series (see
// transforms.js normalize* helpers for adapting other series shapes into
// this one) so a single chart component covers TVL, volume, and fees.

export function buildSparklineSeries(history, days = 90) {
  if (!Array.isArray(history) || history.length === 0) {
    return { points: [], min: 0, max: 0 };
  }
  const points = days ? history.slice(-days) : history;
  const values = points.map((p) => p.tvl);
  return { points, min: Math.min(...values), max: Math.max(...values) };
}

// Build an SVG polyline `points` attribute string scaled to a viewBox.
export function sparklinePath(series, width = 300, height = 80) {
  const { points, min, max } = series;
  if (points.length < 2) return "";
  const range = max - min || 1;
  return points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((p.tvl - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

// Same coordinates as sparklinePath, but as a closed polygon (adds a
// baseline) so the caller can render a filled area under the line.
export function sparklineAreaPath(series, width = 300, height = 80) {
  const { points, min, max } = series;
  if (points.length < 2) return "";
  const range = max - min || 1;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p.tvl - min) / range) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return `0,${height} ${coords.join(" ")} ${width},${height}`;
}
