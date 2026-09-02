import { useEffect, useMemo, useState } from "react";
import Layout from "../../components/Layout.jsx";
import LiveIndicator from "../../components/LiveIndicator.jsx";
import { fetchCronosYieldPools } from "../../lib/defillamaApi.js";
import { aggregateTokensFromPools } from "../../lib/transforms.js";
import { formatUsdCompact, formatApyPct } from "../../lib/format.js";
import { applyTokenFilters } from "./filters.js";

export default function TokensPage() {
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState("");
  const [stablecoinOnly, setStablecoinOnly] = useState(false);

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

  const tokens = useMemo(() => aggregateTokensFromPools(pools), [pools]);
  const filtered = useMemo(() => applyTokenFilters(tokens, { search, stablecoinOnly }), [tokens, search, stablecoinOnly]);

  return (
    <Layout
      active="tokens"
      title="Cronos Token Screener"
      subtitle="Token exposure derived from every Cronos yield pool DeFiLlama tracks: how many pools hold a token, combined TVL, and TVL-weighted average APY. Not a price feed — DeFiLlama has no per-chain token price list, only pool-level exposure."
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
              placeholder="Search tokens…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search tokens"
            />
            <button
              type="button"
              className="cronos-chip"
              aria-pressed={stablecoinOnly}
              onClick={() => setStablecoinOnly((v) => !v)}
            >
              Stablecoins only
            </button>
            <span className="cronos-toolbar-count">
              {filtered.length} of {tokens.length} tokens
            </span>
          </div>

          <div className="cronos-table" role="table">
            <div className="cronos-row cronos-row--head cronos-row--tokens" role="row">
              <span role="columnheader">Token</span>
              <span role="columnheader">Pools</span>
              <span role="columnheader">TVL Exposure</span>
              <span role="columnheader">Avg APY</span>
              <span role="columnheader">Top Pool</span>
            </div>
            {filtered.map((t) => (
              <div className="cronos-row cronos-row--tokens" role="row" key={t.token}>
                <span className="cronos-cell-name" role="cell" data-label="Token">
                  {t.token}
                  {t.isStablecoin && <span className="cronos-badge cronos-badge--live">Stable</span>}
                </span>
                <span className="cronos-cell-muted" role="cell" data-label="Pools">
                  {t.poolCount}
                </span>
                <span role="cell" data-label="TVL Exposure">
                  {formatUsdCompact(t.totalTvlUsd)}
                </span>
                <span role="cell" data-label="Avg APY">
                  {t.avgApy != null ? formatApyPct(t.avgApy) : "Unavailable"}
                </span>
                <span className="cronos-cell-muted" role="cell" data-label="Top Pool">
                  {t.topPool ? `${t.topPool.project} · ${t.topPool.symbol}` : "Unavailable"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
