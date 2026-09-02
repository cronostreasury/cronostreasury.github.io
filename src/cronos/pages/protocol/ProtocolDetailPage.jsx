import { useEffect, useState } from "react";
import Layout from "../../components/Layout.jsx";
import StatCard from "../../components/StatCard.jsx";
import Sparkline from "../../components/Sparkline.jsx";
import ChangeBadge from "../../components/ChangeBadge.jsx";
import DataQualityBadge from "../../components/DataQualityBadge.jsx";
import BarList from "../../components/BarList.jsx";
import LiveIndicator from "../../components/LiveIndicator.jsx";
import {
  fetchProtocolDetail,
  fetchChainOverview,
  fetchDexProtocolSummary,
  fetchFeesProtocolSummary,
} from "../../lib/defillamaApi.js";
import {
  normalizeTvlSeries,
  normalizeVolumeSeries,
  computeHistoryChangePct,
  computeChainExposure,
  computeVolumeToTvlRatio,
  classifyMomentum,
  dataQualityLabel,
  summarizeDataQuality,
  CHAIN_NAME,
} from "../../lib/transforms.js";
import { formatUsdCompact, formatPct } from "../../lib/format.js";

export default function ProtocolDetailPage({ slug }) {
  const [detail, setDetail] = useState(null);
  const [chain, setChain] = useState(null);
  const [dexSummary, setDexSummary] = useState(null);
  const [feesSummary, setFeesSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError("No protocol specified.");
      return undefined;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [detailRes, chainRes, dexRes, feesRes] = await Promise.all([
          fetchProtocolDetail(slug),
          fetchChainOverview().catch(() => null),
          fetchDexProtocolSummary(slug),
          fetchFeesProtocolSummary(slug),
        ]);
        if (cancelled) return;
        setDetail(detailRes);
        setChain(chainRes);
        setDexSummary(dexRes);
        setFeesSummary(feesRes);
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
  }, [slug]);

  if (!loading && (error || !detail)) {
    return (
      <Layout active="protocols" title="Protocol not found">
        <div className="cronos-status cronos-status--error" role="alert">
          {error || "This protocol could not be loaded from DeFiLlama."}
        </div>
        <p style={{ textAlign: "center" }}>
          <a className="cronos-back" href="/cronos/protocols/">
            ← Back to Protocols
          </a>
        </p>
      </Layout>
    );
  }

  if (loading || !detail) {
    return (
      <Layout active="protocols" title="Loading protocol…">
        <div className="cronos-status" role="status">
          Loading live DeFiLlama data…
        </div>
      </Layout>
    );
  }

  const cronosTvlHistory = normalizeTvlSeries(detail.chainTvls?.[CHAIN_NAME]?.tvl);
  const currentCronosTvl =
    typeof detail.currentChainTvls?.[CHAIN_NAME] === "number"
      ? detail.currentChainTvls[CHAIN_NAME]
      : cronosTvlHistory.length
      ? cronosTvlHistory[cronosTvlHistory.length - 1].tvl
      : null;

  const change1d = computeHistoryChangePct(cronosTvlHistory, 1);
  const change7d = computeHistoryChangePct(cronosTvlHistory, 7);
  const change30d = computeHistoryChangePct(cronosTvlHistory, 30);

  const chainSharePct =
    typeof currentCronosTvl === "number" && typeof chain?.tvl === "number" && chain.tvl > 0
      ? (currentCronosTvl / chain.tvl) * 100
      : null;

  const chainExposure = computeChainExposure(detail);

  const volume24h = typeof dexSummary?.total24h === "number" ? dexSummary.total24h : null;
  const volume7d = typeof dexSummary?.total7d === "number" ? dexSummary.total7d : null;
  const volumeHistory = normalizeVolumeSeries(dexSummary?.totalDataChart);
  const volumeToTvl = computeVolumeToTvlRatio(volume24h, currentCronosTvl);

  const fees24h = typeof feesSummary?.total24h === "number" ? feesSummary.total24h : null;
  const fees7d = typeof feesSummary?.total7d === "number" ? feesSummary.total7d : null;

  const momentum = classifyMomentum(change1d, change7d);
  const overallQuality = summarizeDataQuality({ volume24h, fees24h, chainSharePct });

  return (
    <Layout
      active="protocols"
      title={detail.name}
      subtitle={detail.description || `${detail.category || "Protocol"} on ${(detail.chains || []).join(", ") || CHAIN_NAME}.`}
      headExtra={<LiveIndicator lastUpdated={lastUpdated} />}
    >
      <div className="cronos-detail-head" style={{ marginBottom: 20 }}>
        {detail.logo && <img className="cronos-detail-logo" src={detail.logo} alt="" />}
        <div>
          <div className="cronos-detail-meta">
            <span className="cronos-badge">{detail.category || "Uncategorized"}</span>
            <span className="cronos-badge">Momentum: {momentum}</span>
            <DataQualityBadge status={overallQuality} />
            {detail.url && (
              <a className="cronos-back" style={{ margin: 0 }} href={detail.url} target="_blank" rel="noopener noreferrer">
                Website ↗
              </a>
            )}
          </div>
        </div>
      </div>

      <section className="cronos-grid">
        <StatCard label={`${CHAIN_NAME} TVL`} value={currentCronosTvl} format={formatUsdCompact} quality={dataQualityLabel(currentCronosTvl)}>
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
          {cronosTvlHistory.length > 1 && <Sparkline history={cronosTvlHistory} days={180} label={`${detail.name} Cronos TVL, last 180 days`} />}
          <div className="cronos-card-footnote">api.llama.fi/protocol/{slug}</div>
        </StatCard>

        <StatCard
          label="Share of Cronos Chain TVL"
          value={chainSharePct}
          format={(n) => formatPct(n, { withSign: false })}
          quality={dataQualityLabel(chainSharePct)}
          small
          footnote="Protocol Cronos TVL ÷ total Cronos chain TVL"
        />

        <StatCard
          label="DEX Volume 24h"
          value={volume24h}
          format={formatUsdCompact}
          quality={dataQualityLabel(volume24h)}
          footnote={dexSummary ? "api.llama.fi/summary/dexs" : "Not volume-tracked by DeFiLlama"}
        >
          <div className="cronos-change-row">
            <span>7d {volume7d != null ? formatUsdCompact(volume7d) : "Unavailable"}</span>
          </div>
          {volumeHistory.length > 1 && <Sparkline history={volumeHistory} days={90} color="#7dd3fc" area={false} label="Volume, last 90 days" />}
        </StatCard>

        <StatCard
          label="Fees/Revenue 24h"
          value={fees24h}
          format={formatUsdCompact}
          quality={dataQualityLabel(fees24h)}
          footnote={feesSummary ? "api.llama.fi/summary/fees" : "Not fee-tracked by DeFiLlama"}
        >
          <div className="cronos-change-row">
            <span>7d {fees7d != null ? formatUsdCompact(fees7d) : "Unavailable"}</span>
          </div>
        </StatCard>

        <StatCard
          label="Volume / TVL (24h)"
          value={volumeToTvl}
          format={(n) => n.toFixed(3)}
          quality={dataQualityLabel(volumeToTvl)}
          small
          footnote="Daily volume as a fraction of Cronos TVL — a rough capital-efficiency signal"
        />
      </section>

      {chainExposure.length > 0 && (
        <section className="cronos-section">
          <h2>Chain Exposure</h2>
          <p className="cronos-section-desc">
            How this protocol's total TVL is spread across every chain it operates on, not just Cronos.
          </p>
          <div className="cronos-card">
            <BarList items={chainExposure} labelKey="chain" />
          </div>
        </section>
      )}
    </Layout>
  );
}
