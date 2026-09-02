import { useEffect, useMemo, useState } from "react";
import Layout from "../../components/Layout.jsx";
import ProtocolTable from "../../components/ProtocolTable.jsx";
import LiveIndicator from "../../components/LiveIndicator.jsx";
import { fetchAllProtocols, fetchDexChainOverview } from "../../lib/defillamaApi.js";
import {
  rankProtocolsByCronosTvl,
  computeTvlShare,
  computeConcentrationIndex,
  concentrationLabel,
  indexChainOverviewProtocols,
} from "../../lib/transforms.js";
import { applyProtocolFilters, sortProtocols } from "./filters.js";

const MOVER_FILTERS = [
  { key: "all", label: "All" },
  { key: "gainers", label: "Gainers (24h)" },
  { key: "losers", label: "Losers (24h)" },
];

export default function ProtocolsPage() {
  const [protocols, setProtocols] = useState([]);
  const [dexOverview, setDexOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [mover, setMover] = useState("all");
  const [sort, setSort] = useState({ key: "tvl", dir: "desc" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [protocolsRes, dexRes] = await Promise.all([fetchAllProtocols(), fetchDexChainOverview()]);
        if (cancelled) return;
        setProtocols(protocolsRes);
        setDexOverview(dexRes);
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

  const ranked = useMemo(() => computeTvlShare(rankProtocolsByCronosTvl(protocols)), [protocols]);
  const volumeMap = useMemo(() => indexChainOverviewProtocols(dexOverview), [dexOverview]);
  const categories = useMemo(() => ["all", ...new Set(ranked.map((p) => p.category))].sort((a, b) => (a === "all" ? -1 : a.localeCompare(b))), [ranked]);
  const hhi = computeConcentrationIndex(ranked);

  const filtered = useMemo(() => applyProtocolFilters(ranked, { search, category, mover }), [ranked, search, category, mover]);
  const sorted = useMemo(() => sortProtocols(filtered, sort, volumeMap), [filtered, sort, volumeMap]);

  function handleSort(key) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
  }

  return (
    <Layout
      active="protocols"
      title="Cronos Protocols"
      subtitle="Every protocol DeFiLlama tracks with a Cronos allocation, ranked by TVL. Filter, sort, and drill into a protocol for full insights."
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
              placeholder="Search protocols…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search protocols"
            />
            <select
              className="cronos-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by category"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "All categories" : c}
                </option>
              ))}
            </select>
            {MOVER_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className="cronos-chip"
                aria-pressed={mover === f.key}
                onClick={() => setMover(f.key)}
              >
                {f.label}
              </button>
            ))}
            <span className="cronos-toolbar-count">
              {sorted.length} of {ranked.length} · HHI {hhi ?? "—"} ({concentrationLabel(hhi)})
            </span>
          </div>

          <ProtocolTable protocols={sorted} volumeMap={volumeMap} showVolume showShare sort={sort} onSort={handleSort} />
        </>
      )}
    </Layout>
  );
}
