import { useEffect, useMemo, useState } from "react";
import Layout from "../../components/Layout.jsx";
import LiveIndicator from "../../components/LiveIndicator.jsx";
import { fetchCronosYieldPools } from "../../lib/defillamaApi.js";
import { formatUsdCompact, formatApyPct } from "../../lib/format.js";
import { applyPoolFilters, sortPools } from "./filters.js";

const MIN_TVL_OPTIONS = [
  { value: 0, label: "Any TVL" },
  { value: 10_000, label: "≥ $10K" },
  { value: 100_000, label: "≥ $100K" },
  { value: 1_000_000, label: "≥ $1M" },
];

export default function YieldsPage() {
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState("");
  const [stablecoinOnly, setStablecoinOnly] = useState(false);
  const [minTvl, setMinTvl] = useState(0);
  const [sort, setSort] = useState({ key: "tvlUsd", dir: "desc" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const poolsRes = await fetchCronosYieldPools();
        if (cancelled) return;
        setPools(poolsRes);
        setLastUpdated(new Date());
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load DeFiLlama data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => applyPoolFilters(pools, { search, stablecoinOnly, minTvl }), [pools, search, stablecoinOnly, minTvl]);
  const sorted = useMemo(() => sortPools(filtered, sort), [filtered, sort]);

  function handleSort(key) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
  }

  return (
    <Layout
      active="yields"
      title="Cronos Yields"
      subtitle="Every liquidity pool DeFiLlama tracks on Cronos: TVL, base/reward APY split, IL risk and exposure type."
      headExtra={<LiveIndicator lastUpdated={lastUpdated} />}
    >
      {loading && (
        <div className="cronos-status" role="status">
          Loading live DeFiLlama data…
        </div>
      )}
      {error && !loading && (
        <div className="cronos-status cronos-status--error" role="alert">
          Could not load DeFiLlama data: {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="cronos-toolbar">
            <input
              className="cronos-input"
              type="search"
              placeholder="Search pools or projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search pools"
            />
            <select
              className="cronos-select"
              value={minTvl}
              onChange={(e) => setMinTvl(Number(e.target.value))}
              aria-label="Minimum TVL"
            >
              {MIN_TVL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="cronos-chip"
              aria-pressed={stablecoinOnly}
              onClick={() => setStablecoinOnly((v) => !v)}
            >
              Stablecoins only
            </button>
            <span className="cronos-toolbar-count">
              {sorted.length} of {pools.length} pools
            </span>
          </div>

          <div className="cronos-table" role="table">
            <div className="cronos-row cronos-row--head cronos-row--pools" role="row">
              <span role="columnheader">Pool</span>
              <span role="columnheader">Project</span>
              <span role="columnheader">
                <button type="button" onClick={() => handleSort("tvlUsd")}>
                  TVL {sort.key === "tvlUsd" ? (sort.dir === "desc" ? "↓" : "↑") : ""}
                </button>
              </span>
              <span role="columnheader">
                <button type="button" onClick={() => handleSort("apy")}>
                  APY {sort.key === "apy" ? (sort.dir === "desc" ? "↓" : "↑") : ""}
                </button>
              </span>
              <span role="columnheader">IL Risk</span>
              <span role="columnheader">Exposure</span>
            </div>
            {sorted.map((p) => (
              <div className="cronos-row cronos-row--pools" role="row" key={p.pool}>
                <span className="cronos-cell-name" role="cell" data-label="Pool">
                  {p.symbol}
                  {p.stablecoin && <span className="cronos-badge cronos-badge--live">Stable</span>}
                </span>
                <span className="cronos-cell-muted" role="cell" data-label="Project">
                  {p.project}
                </span>
                <span role="cell" data-label="TVL">
                  {formatUsdCompact(p.tvlUsd)}
                </span>
                <span role="cell" data-label="APY">
                  {typeof p.apy === "number" ? formatApyPct(p.apy) : "Unavailable"}
                  {typeof p.apyBase === "number" && typeof p.apyReward === "number" && (
                    <span className="cronos-cell-muted"> ({formatApyPct(p.apyBase)} base + {formatApyPct(p.apyReward)} reward)</span>
                  )}
                </span>
                <span className="cronos-cell-muted" role="cell" data-label="IL Risk">
                  {p.ilRisk || "Unavailable"}
                </span>
                <span className="cronos-cell-muted" role="cell" data-label="Exposure">
                  {p.exposure || "Unavailable"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
