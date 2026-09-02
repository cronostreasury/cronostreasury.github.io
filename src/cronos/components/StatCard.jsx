import AnimatedNumber from "./AnimatedNumber.jsx";
import DataQualityBadge from "./DataQualityBadge.jsx";
import Shimmer from "./Shimmer.jsx";

// A single metric card: label, big animated value, optional change row /
// quality badge / footnote / chart, all as children. `loading` swaps the
// value for a shimmer skeleton instead of showing a stale/zero number.
export default function StatCard({ label, value, format, quality, footnote, loading, small, children }) {
  return (
    <div className="cronos-card">
      <div className="cronos-card-head">
        <span className="cronos-card-label">{label}</span>
        {quality && <DataQualityBadge status={quality} />}
      </div>
      {loading ? (
        <Shimmer height={small ? 24 : 40} width="70%" style={{ margin: "6px 0 12px" }} />
      ) : (
        <div className={`cronos-card-value${small ? " cronos-card-value--sm" : ""}`}>
          <AnimatedNumber value={value} format={format} />
        </div>
      )}
      {children}
      {footnote && <div className="cronos-card-footnote">{footnote}</div>}
    </div>
  );
}
