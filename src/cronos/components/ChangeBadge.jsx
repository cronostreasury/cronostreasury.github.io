import { formatPct } from "../lib/format.js";

export default function ChangeBadge({ pct }) {
  if (typeof pct !== "number" || !Number.isFinite(pct)) {
    return <span className="cronos-change cronos-change--flat">—</span>;
  }
  const cls = pct > 0 ? "cronos-change--up" : pct < 0 ? "cronos-change--down" : "cronos-change--flat";
  return <span className={`cronos-change ${cls}`}>{formatPct(pct)}</span>;
}
