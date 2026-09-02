import { useEffect, useState } from "react";
import {
  fetchChainOverview,
  fetchChainTvlHistory,
  fetchTopProtocols,
  computeHistoryChangePct,
  buildSparklineSeries,
  sparklinePath,
  formatUsdCompact,
  formatPct,
} from "./defillama.js";

const SPARKLINE_DAYS = 90;
const TOP_PROTOCOL_LIMIT = 10;

function Sparkline({ history }) {
  const series = buildSparklineSeries(history, SPARKLINE_DAYS);
  const path = sparklinePath(series, 600, 140);
  if (!path) return null;
  return (
    <svg viewBox="0 0 600 140" preserveAspectRatio="none" className="cronos-sparkline" role="img" aria-label={`Cronos TVL over the last ${SPARKLINE_DAYS} days`}>
      <polyline points={path} fill="none" stroke="#64ffda" strokeWidth="2" />
    </svg>
  );
}

function ChangeBadge({ pct }) {
  if (typeof pct !== "number" || !Number.isFinite(pct)) {
    return <span className="cronos-change cronos-change--flat">—</span>;
  }
  const cls = pct > 0 ? "cronos-change--up" : pct < 0 ? "cronos-change--down" : "cronos-change--flat";
  return <span className={`cronos-change ${cls}`}>{formatPct(pct)}</span>;
}

export default function CronosDashboard() {
  const [chain, setChain] = useState(null);
  const [history, setHistory] = useState([]);
  const [protocols, setProtocols] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [chainRes, historyRes, protocolsRes] = await Promise.all([
          fetchChainOverview(),
          fetchChainTvlHistory(),
          fetchTopProtocols(fetch, TOP_PROTOCOL_LIMIT),
        ]);
        if (cancelled) return;
        setChain(chainRes);
        setHistory(historyRes);
        setProtocols(protocolsRes);
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

  const change1d = computeHistoryChangePct(history, 1);
  const change7d = computeHistoryChangePct(history, 7);
  const change30d = computeHistoryChangePct(history, 30);

  return (
    <div className="cronos-page">
      <header className="cronos-header">
        <div className="cronos-header-inner">
          <a href="/" className="cronos-back">← Cronos Treasury Reserve</a>
          <h1>Cronos DeFi Dashboard</h1>
          <p className="cronos-subtitle">Live TVL and protocol data for the Cronos chain, sourced directly from the public DeFiLlama API.</p>
        </div>
      </header>

      <main className="cronos-main">
        {loading && (
          <div className="cronos-status" role="status">Loading live DeFiLlama data…</div>
        )}

        {error && !loading && (
          <div className="cronos-status cronos-status--error" role="alert">
            Could not load DeFiLlama data: {error}
          </div>
        )}

        {!loading && !error && chain && (
          <>
            <section className="cronos-grid">
              <div className="cronos-card cronos-card--tvl">
                <div className="cronos-card-label">Cronos Total Value Locked</div>
                <div className="cronos-tvl-value">{formatUsdCompact(chain.tvl)}</div>
                <div className="cronos-change-row">
                  <span>24h <ChangeBadge pct={change1d} /></span>
                  <span>7d <ChangeBadge pct={change7d} /></span>
                  <span>30d <ChangeBadge pct={change30d} /></span>
                </div>
                <Sparkline history={history} />
                <div className="cronos-card-footnote">Last {SPARKLINE_DAYS} days · source: api.llama.fi/v2/historicalChainTvl/Cronos</div>
              </div>
            </section>

            <section className="cronos-protocols">
              <h2>Top Protocols on Cronos by TVL</h2>
              <div className="cronos-protocol-table" role="table">
                <div className="cronos-protocol-row cronos-protocol-row--head" role="row">
                  <span role="columnheader">Protocol</span>
                  <span role="columnheader">Category</span>
                  <span role="columnheader">TVL</span>
                  <span role="columnheader">24h</span>
                  <span role="columnheader">7d</span>
                </div>
                {protocols.map((p) => (
                  <div className="cronos-protocol-row" role="row" key={p.slug || p.name}>
                    <span className="cronos-protocol-name" role="cell" data-label="Protocol">
                      {p.url ? (
                        <a href={p.url} target="_blank" rel="noopener noreferrer">{p.name}</a>
                      ) : (
                        p.name
                      )}
                    </span>
                    <span role="cell" data-label="Category">{p.category}</span>
                    <span role="cell" data-label="TVL">{formatUsdCompact(p.tvl)}</span>
                    <span role="cell" data-label="24h"><ChangeBadge pct={p.change1d} /></span>
                    <span role="cell" data-label="7d"><ChangeBadge pct={p.change7d} /></span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <footer className="cronos-footer">
          <p>
            Data: <a href="https://defillama.com/chain/Cronos" target="_blank" rel="noopener noreferrer">DeFiLlama</a> public API.
            {lastUpdated && ` Last updated ${lastUpdated.toLocaleTimeString()}.`}
          </p>
        </footer>
      </main>
    </div>
  );
}
