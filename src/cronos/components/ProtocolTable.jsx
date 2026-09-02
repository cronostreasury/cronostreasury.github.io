import { formatUsdCompact, formatPct } from "../lib/format.js";
import { protocolDetailHref } from "../lib/slug.js";
import ChangeBadge from "./ChangeBadge.jsx";

// Shared protocol ranking table. Used both as a compact top-5 preview
// (Overview) and the full sortable/filterable list (Protocols page).
// `volumeMap` is an optional slug -> {total24h} lookup (from the chain
// dexs overview) to show a Volume column; protocols DeFiLlama doesn't
// volume-track render "Unavailable" rather than being skipped.
const SORT_COLUMNS = [
  { key: "tvl", label: "TVL" },
  { key: "change1d", label: "24h" },
  { key: "change7d", label: "7d" },
  { key: "volume24h", label: "Vol 24h", needsVolume: true },
];

export default function ProtocolTable({ protocols, volumeMap, showVolume = false, showShare = false, sort, onSort }) {
  return (
    <div className="cronos-table" role="table">
      <div className={`cronos-row cronos-row--head ${showVolume ? "cronos-row--protocols-ext" : "cronos-row--protocols"}`} role="row">
        <span role="columnheader">Protocol</span>
        <span role="columnheader">Category</span>
        {["tvl", "change1d", "change7d", "volume24h"]
          .filter((key) => key !== "volume24h" || showVolume)
          .map((key) => {
            const col = SORT_COLUMNS.find((c) => c.key === key);
            const label = key === "tvl" && showShare ? "TVL / Share" : col.label;
            if (!onSort) return <span role="columnheader" key={key}>{label}</span>;
            return (
              <span role="columnheader" key={key}>
                <button type="button" onClick={() => onSort(key)} aria-label={`Sort by ${col.label}`}>
                  {label}
                  {sort?.key === key ? (sort.dir === "desc" ? " ↓" : " ↑") : ""}
                </button>
              </span>
            );
          })}
      </div>
      {protocols.map((p) => {
        const vol = volumeMap?.get(p.slug);
        const volume24h = typeof vol?.total24h === "number" ? vol.total24h : null;
        return (
          <a
            key={p.slug || p.name}
            className={`cronos-row ${showVolume ? "cronos-row--protocols-ext" : "cronos-row--protocols"}`}
            role="row"
            href={p.slug ? protocolDetailHref(p.slug) : p.url || "#"}
          >
            <span className="cronos-cell-name" role="cell" data-label="Protocol">
              {p.logo && <img className="cronos-cell-logo" src={p.logo} alt="" loading="lazy" />}
              {p.name}
            </span>
            <span className="cronos-cell-muted" role="cell" data-label="Category">
              {p.category}
            </span>
            <span role="cell" data-label="TVL">
              {formatUsdCompact(p.tvl)}
              {showShare && typeof p.sharePct === "number" && (
                <span className="cronos-cell-muted"> · {formatPct(p.sharePct, { withSign: false })}</span>
              )}
            </span>
            <span role="cell" data-label="24h">
              <ChangeBadge pct={p.change1d} />
            </span>
            <span role="cell" data-label="7d">
              <ChangeBadge pct={p.change7d} />
            </span>
            {showVolume && (
              <span className="cronos-cell-muted" role="cell" data-label="Vol 24h">
                {volume24h != null ? formatUsdCompact(volume24h) : "Unavailable"}
              </span>
            )}
          </a>
        );
      })}
    </div>
  );
}
