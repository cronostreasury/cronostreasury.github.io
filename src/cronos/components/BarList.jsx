import { formatUsdCompact, formatPct } from "../lib/format.js";

// Horizontal bar list for TVL share by category / chain exposure.
export default function BarList({ items, labelKey = "category", valueKey = "tvl", shareKey = "sharePct" }) {
  return (
    <div className="cronos-barlist">
      {items.map((item) => (
        <div className="cronos-bar-row" key={item[labelKey]}>
          <span className="cronos-bar-label">{item[labelKey]}</span>
          <span className="cronos-bar-track">
            <span
              className="cronos-bar-fill"
              style={{ width: `${Math.min(100, item[shareKey] || 0)}%` }}
            />
          </span>
          <span className="cronos-bar-value">
            {formatUsdCompact(item[valueKey])}
            {typeof item[shareKey] === "number" ? ` · ${formatPct(item[shareKey], { withSign: false })}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
