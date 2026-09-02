import { useEffect, useState } from "react";
import Layout from "../../components/Layout.jsx";
import StatCard from "../../components/StatCard.jsx";
import Sparkline from "../../components/Sparkline.jsx";
import ChangeBadge from "../../components/ChangeBadge.jsx";
import ProtocolTable from "../../components/ProtocolTable.jsx";
import BarList from "../../components/BarList.jsx";
import MoversList from "../../components/MoversList.jsx";
import LiveIndicator from "../../components/LiveIndicator.jsx";
import Shimmer from "../../components/Shimmer.jsx";
import TwitterTimelineEmbed from "../../components/TwitterTimelineEmbed.jsx";
import { FEATURED_ACCOUNT } from "../../lib/socialAccounts.js";
import {
  fetchChainOverview,
  fetchChainTvlHistory,
  fetchAllProtocols,
  fetchDexChainOverview,
  fetchFeesChainOverview,
} from "../../lib/defillamaApi.js";
import {
  rankProtocolsByCronosTvl,
  computeHistoryChangePct,
  computeTvlShare,
  computeConcentrationIndex,
  concentrationLabel,
  computeCategoryExposure,
  computeGainersAndLosers,
  indexChainOverviewProtocols,
  dataQualityLabel,
} from "../../lib/transforms.js";
import { formatUsdCompact } from "../../lib/format.js";

const TOP_PROTOCOL_PREVIEW = 6;

export default function OverviewPage() {
  const [chain, setChain] = useState(null);
  const [history, setHistory] = useState([]);
  const [protocols, setProtocols] = useState([]);
  const [dexOverview, setDexOverview] = useState(null);
  const [feesOverview, setFeesOverview] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [chainRes, historyRes, protocolsRes, dexRes, feesRes] = await Promise.all([
          fetchChainOverview(),
          fetchChainTvlHistory(),
          fetchAllProtocols(),
          fetchDexChainOverview(),
          fetchFeesChainOverview(),
        ]);
        if (cancelled) return;
        setChain(chainRes);
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

  const change1d = computeHistoryChangePct(history, 1);
  const change7d = computeHistoryChangePct(history, 7);
  const change30d = computeHistoryChangePct(history, 30);

  const ranked = rankProtocolsByCronosTvl(protocols);
  const withShare = computeTvlShare(ranked);
  const hhi = computeConcentrationIndex(ranked);
  const categories = computeCategoryExposure(ranked).slice(0, 6);
  const { gainers, losers } = computeGainersAndLosers(ranked, { limit: 3 });
  const volumeMap = indexChainOverviewProtocols(dexOverview);

  const volume24h = typeof dexOverview?.total24h === "number" ? dexOverview.total24h : null;
  const fees24h = typeof feesOverview?.total24h === "number" ? feesOverview.total24h : null;

  return (
    <Layout
      active="overview"
      title="Cronos DeFi Dashboard"
      subtitle="Live TVL, protocol rankings, volume and fees for the Cronos chain, sourced directly from the public DeFiLlama API."
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

      {!loading && !error && chain && (
        <>
          <section className="cronos-grid">
            <StatCard label="Cronos Total Value Locked" value={chain.tvl} format={formatUsdCompact}>
              <div className="cronos-change-row">
                <span>
                  24h <ChangeBadge pct={change1d} />
                </span>
                <span>
                  7d <ChangeBadge pct={change7d} />
                </span>
                <span>
                  30d <ChangeBadge pct={change30d} />
                </span>
              </div>
              <Sparkline history={history} days={90} label="Cronos TVL over the last 90 days" />
              <div className="cronos-card-footnote">Last 90 days · api.llama.fi/v2/historicalChainTvl/Cronos</div>
            </StatCard>

            <StatCard
              label="Chain DEX Volume 24h"
              value={volume24h}
              format={formatUsdCompact}
              quality={dataQualityLabel(volume24h)}
              footnote="api.llama.fi/overview/dexs/Cronos"
            >
              <div className="cronos-change-row">
                <span>
                  7d <ChangeBadge pct={typeof dexOverview?.change_7d === "number" ? dexOverview.change_7d : null} />
                </span>
              </div>
            </StatCard>

            <StatCard
              label="Chain Fees/Revenue 24h"
              value={fees24h}
              format={formatUsdCompact}
              quality={dataQualityLabel(fees24h)}
              footnote="api.llama.fi/overview/fees/Cronos"
            >
              <div className="cronos-change-row">
                <span>
                  7d <ChangeBadge pct={typeof feesOverview?.change_7d === "number" ? feesOverview.change_7d : null} />
                </span>
              </div>
            </StatCard>

            <StatCard
              label="TVL Concentration (HHI)"
              value={hhi}
              format={(n) => Math.round(n).toLocaleString()}
              small
              footnote={concentrationLabel(hhi)}
            />
          </section>

          <section className="cronos-section">
            <h2>Top Protocols on Cronos by TVL</h2>
            <p className="cronos-section-desc">
              Showing {Math.min(TOP_PROTOCOL_PREVIEW, withShare.length)} of {withShare.length} tracked protocols ·{" "}
              <a className="cronos-back" href="/cronos/protocols/" style={{ margin: 0 }}>
                View full ranking →
              </a>
            </p>
            <ProtocolTable protocols={withShare.slice(0, TOP_PROTOCOL_PREVIEW)} volumeMap={volumeMap} showVolume showShare />
          </section>

          <section className="cronos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <div className="cronos-card">
              <div className="cronos-card-label">TVL by Category</div>
              <div style={{ marginTop: 12 }}>
                <BarList items={categories} labelKey="category" />
              </div>
            </div>
            <div className="cronos-card">
              <div className="cronos-card-label">Top Gainers (24h)</div>
              <div style={{ marginTop: 12 }}>
                <MoversList items={gainers} emptyLabel="No gainers in the last 24h." />
              </div>
            </div>
            <div className="cronos-card">
              <div className="cronos-card-label">Top Losers (24h)</div>
              <div style={{ marginTop: 12 }}>
                <MoversList items={losers} emptyLabel="No losers in the last 24h." />
              </div>
            </div>
          </section>
        </>
      )}

      {loading && (
        <section className="cronos-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="cronos-card" key={i}>
              <Shimmer height={12} width="50%" style={{ marginBottom: 12 }} />
              <Shimmer height={36} width="70%" style={{ marginBottom: 12 }} />
              <Shimmer height={80} />
            </div>
          ))}
        </section>
      )}

      <section className="cronos-section">
        <h2>Social Pulse</h2>
        <p className="cronos-section-desc">
          Live from X, embedded via X's official widgets.js — no API, no scraping ·{" "}
          <a className="cronos-back" href="/cronos/social/" style={{ margin: 0 }}>
            View all accounts →
          </a>
        </p>
        <div className="cronos-card">
          <div className="cronos-card-head">
            <div>
              <span className="cronos-card-label">{FEATURED_ACCOUNT.label}</span>
              <div className="cronos-x-handle">@{FEATURED_ACCOUNT.handle}</div>
            </div>
          </div>
          <TwitterTimelineEmbed handle={FEATURED_ACCOUNT.handle} url={FEATURED_ACCOUNT.url} height={300} />
        </div>
      </section>
    </Layout>
  );
}
