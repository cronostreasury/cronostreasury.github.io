export default function Shimmer({ width = "100%", height = 16, style, className = "" }) {
  return (
    <div
      className={`cronos-shimmer ${className}`}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
}
