const LABELS = {
  live: "Live",
  partial: "Partial",
  unavailable: "Unavailable",
};

// Renders the "live" / "partial" / "unavailable" data-quality label used
// throughout the dashboard whenever a metric may be missing for a given
// protocol or pool (DeFiLlama doesn't track every metric for everything).
export default function DataQualityBadge({ status }) {
  const key = LABELS[status] ? status : "unavailable";
  return (
    <span className={`cronos-badge cronos-badge--${key}`}>
      <span className="cronos-badge-dot" />
      {LABELS[key]}
    </span>
  );
}
