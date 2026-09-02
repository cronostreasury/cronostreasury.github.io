import { useEffect, useMemo, useState } from "react";
import Layout from "../../components/Layout.jsx";
import Sparkline from "../../components/Sparkline.jsx";
import BarList from "../../components/BarList.jsx";
import MoversList from "../../components/MoversList.jsx";
import LiveIndicator from "../../components/LiveIndicator.jsx";
import DataQualityBadge from "../../components/DataQualityBadge.jsx";
import {
  fetchChainTvlHistory,
  fetchAllProtocols,
  fetchDexChainOverview,
  fetchFeesChainOverview,
} from "../../lib/defillamaApi.js";
import {
  rankProtocolsByCronosTvl,
  computeCategoryExposure,
  computeGainersAndLosers,
  computeConcentrationIndex,
  concentrationLabel,
  normalizeVolumeSeries,
  dataQualityLabel,
} from "../../lib/transforms.js";
const RANGE_OPTIONS = [
  { key: "30d", days: 30, label: "30D" },
  { key: "90d", days: 90, label: "90D" },
  { key: "365d", days: 365, label: "1Y" },
  { key: "all", days: 0, label: "All" },
];

export default function AnalyticsPage() {
  const [history, setHistory] = useState([]);
  const [protocols, setProtocols] = useState([]);
  const [dexOverview, setDexOverview] = useState(null);
  const [feesOverview, setFeesOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [range, setRange] = useState("90d");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [historyRes, protocolsRes, dexRes, feesRes] = await Promise.all([
          fetchChainTvlHistory(),
          fetchAllProtocols(),
          fetchDexChainOverview(),
          fetchFeesChainOverview(),
        ]);
        if (cancelled) return;
        setHistory(historyRes);
        setProtocols(protocolsRes);
        setDexOverview(dexRes);
        setFeesOverview(feesRes);
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

  const ranked = useMemo(() => rankProtocolsByCronosTvl(protocols), [protocols]);
  const categories = useMemo(() => computeCategoryExposure(ranked), [ranked]);
  const { gainers, losers } = useMemo(() => computeGainersAndLosers(ranked, { limit: 6 }), [ranked]);
  const hhi = computeConcentrationIndex(ranked);
  const volumeHistory = useMemo(() => normalizeVolumeSeries(dexOverview?.totalDataChart), [dexOverview]);
  const feesHistory = useMemo(() => normalizeVolumeSeries(feesOverview?.totalDataChart), [feesOverview]);

  const rangeDays = RANGE_OPTIONS.find((r) => r.key === range)?.days ?? 90;

  return (
    <Layout
      active="analytics"
      title="Cronos Chain Analytics"
      subtitle="Chain-wide TVL, volume and fee history, momentum leaderboard and TVL concentration across every Cronos protocol DeFiLlama tracks."
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
          <section className="cronos-section">
            <div className="cronos-toolbar">
              <h2 style={{ margin: 0 }}>Cronos TVL History</h2>
              <span className="cronos-toolbar-count" style={{ marginLeft: 0 }} />
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                {RANGE_OPTIONS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    className="cronos-chip"
                    aria-pressed={range === r.key}
                    onClick={() => setRange(r.key)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="cronos-card">
              <Sparkline history={history} days={rangeDays || undefined} height={220} label="Cronos TVL history" />
            </div>
          </section>

          <section className="cronos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <div className="cronos-card">
              <div className="cronos-card-head">
                <span className="cronos-card-label">Chain DEX Volume History</span>
                <DataQualityBadge status={dataQualityLabel(dexOverview?.total24h)} />
              </div>
              {volumeHistory.length > 1 ? (
                <Sparkline history={volumeHistory} days={rangeDays || undefined} color="#7dd3fc" area={false} label="Chain volume history" />
              ) : (
                <div className="cronos-card-footnote">Unavailable.</div>
              )}
              <div className="cronos-card-footnote">api.llama.fi/overview/dexs/Cronos</div>
            </div>
            <div className="cronos-card">
              <div className="cronos-card-head">
                <span className="cronos-card-label">Chain Fees History</span>
                <DataQualityBadge status={dataQualityLabel(feesOverview?.total24h)} />
              </div>
              {feesHistory.length > 1 ? (
                <Sparkline history={feesHistory} days={rangeDays || undefined} color="#facc15" area={false} label="Chain fees history" />
              ) : (
                <div className="cronos-card-footnote">Unavailable.</div>
              )}
              <div className="cronos-card-footnote">api.llama.fi/overview/fees/Cronos</div>
            </div>
          </section>

          <section className="cronos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <div className="cronos-card">
              <div className="cronos-card-label">TVL by Category</div>
              <div style={{ marginTop: 12 }}>
                <BarList items={categories} labelKey="category" />
              </div>
            </div>
            <div className="cronos-card">
              <div className="cronos-card-label">TVL Concentration</div>
              <div className="cronos-card-value cronos-card-value--sm">{hhi ?? "—"}</div>
              <div className="cronos-card-footnote">HHI across {ranked.length} protocols · {concentrationLabel(hhi)}</div>
            </div>
          </section>

          <section className="cronos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <div className="cronos-card">
              <div className="cronos-card-label">Momentum — Top Gainers (24h)</div>
              <div style={{ marginTop: 12 }}>
                <MoversList items={gainers} emptyLabel="No gainers in the last 24h." />
              </div>
            </div>
            <div className="cronos-card">
              <div className="cronos-card-label">Momentum — Top Losers (24h)</div>
              <div style={{ marginTop: 12 }}>
                <MoversList items={losers} emptyLabel="No losers in the last 24h." />
              </div>
            </div>
          </section>
        </>
      )}
    </Layout>
  );
}
