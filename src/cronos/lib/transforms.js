// Pure data transforms shared across all Cronos dashboard pages.
// Nothing here fetches anything — every function takes already-fetched
// DeFiLlama JSON (or a slice of it) and derives display-ready values.
// Fields DeFiLlama doesn't provide for a given protocol/pool come through
// as `null`, which the UI renders as "Unavailable" — never a guess.

export const CHAIN_NAME = "Cronos";

// --- Protocol ranking -------------------------------------------------

// Filter the full /protocols list down to ones with a Cronos allocation,
// sorted by that allocation descending.
export function rankProtocolsByCronosTvl(protocols) {
  if (!Array.isArray(protocols)) return [];
  return protocols
    .filter((p) => typeof p?.chainTvls?.[CHAIN_NAME] === "number" && p.chainTvls[CHAIN_NAME] > 0)
    .map((p) => ({
      name: p.name,
      category: p.category || "Other",
      tvl: p.chainTvls[CHAIN_NAME],
      change1d: typeof p.change_1d === "number" ? p.change_1d : null,
      change7d: typeof p.change_7d === "number" ? p.change_7d : null,
      change1m: typeof p.change_1m === "number" ? p.change_1m : null,
      url: p.url || null,
      logo: p.logo || null,
      slug: p.slug || null,
      chains: Array.isArray(p.chains) ? p.chains : [],
    }))
    .sort((a, b) => b.tvl - a.tvl);
}

// Percent change between the TVL `daysBack` days ago and the latest point
// in a {date, tvl}[] history series.
export function computeHistoryChangePct(history, daysBack) {
  if (!Array.isArray(history) || history.length < 2) return null;
  const latest = history[history.length - 1];
  const targetTs = latest.date - daysBack * 86400;
  let reference = history[0];
  for (const point of history) {
    if (point.date <= targetTs) reference = point;
    else break;
  }
  if (!reference || reference.tvl <= 0) return null;
  return ((latest.tvl - reference.tvl) / reference.tvl) * 100;
}

// --- TVL share / concentration -----------------------------------------

// Attach each protocol's share of total ranked TVL (0-100).
export function computeTvlShare(rankedProtocols) {
  const total = rankedProtocols.reduce((sum, p) => sum + p.tvl, 0);
  if (total <= 0) return rankedProtocols.map((p) => ({ ...p, sharePct: null }));
  return rankedProtocols.map((p) => ({ ...p, sharePct: (p.tvl / total) * 100 }));
}

// Herfindahl-Hirschman Index over TVL shares (0-10000). Higher = more
// concentrated in a few protocols. Uses shares as percentages (0-100),
// so a single protocol holding 100% yields 10000; N equal protocols
// yield 10000/N.
export function computeConcentrationIndex(rankedProtocols) {
  const withShare = computeTvlShare(rankedProtocols);
  if (withShare.length === 0 || withShare.some((p) => p.sharePct == null)) return null;
  const hhi = withShare.reduce((sum, p) => sum + p.sharePct * p.sharePct, 0);
  return Math.round(hhi);
}

export function concentrationLabel(hhi) {
  if (typeof hhi !== "number") return "Unavailable";
  if (hhi >= 2500) return "Highly concentrated";
  if (hhi >= 1500) return "Moderately concentrated";
  return "Diversified";
}

// --- Gainers / losers / momentum ----------------------------------------

// Top N protocols by a change metric, ascending or descending, excluding
// protocols where that metric is missing.
export function computeTopMovers(rankedProtocols, { metric = "change1d", limit = 5, direction = "desc" } = {}) {
  const withMetric = rankedProtocols.filter((p) => typeof p[metric] === "number" && Number.isFinite(p[metric]));
  const sorted = [...withMetric].sort((a, b) => (direction === "desc" ? b[metric] - a[metric] : a[metric] - b[metric]));
  return sorted.slice(0, limit);
}

export function computeGainersAndLosers(rankedProtocols, { metric = "change1d", limit = 5 } = {}) {
  return {
    gainers: computeTopMovers(rankedProtocols, { metric, limit, direction: "desc" }).filter((p) => p[metric] > 0),
    losers: computeTopMovers(rankedProtocols, { metric, limit, direction: "asc" }).filter((p) => p[metric] < 0),
  };
}

// Simple, deterministic momentum classification from 1d/7d change: both
// legs pointed the same direction and accelerating vs. decelerating.
export function classifyMomentum(change1d, change7d) {
  if (typeof change1d !== "number" || typeof change7d !== "number") return "Unavailable";
  const avg7d = change7d / 7;
  if (Math.abs(change1d) < 0.5 && Math.abs(avg7d) < 0.5) return "Flat";
  if (change1d > 0 && avg7d > 0 && change1d > avg7d * 1.5) return "Accelerating up";
  if (change1d < 0 && avg7d < 0 && change1d < avg7d * 1.5) return "Accelerating down";
  if (change1d > 0 && avg7d < 0) return "Reversing up";
  if (change1d < 0 && avg7d > 0) return "Reversing down";
  return change1d >= 0 ? "Trending up" : "Trending down";
}

// --- Volume / fees -------------------------------------------------------

export function computeVolumeToTvlRatio(volume24h, tvl) {
  if (typeof volume24h !== "number" || typeof tvl !== "number" || tvl <= 0) return null;
  return volume24h / tvl;
}

// Build a slug -> {total24h, total48hto24h, totalAllTime} lookup from a
// chain-level dexs/fees overview response's `.protocols[]` breakdown, so
// ranking pages can show per-protocol volume/fees without N extra fetches.
export function indexChainOverviewProtocols(chainOverview) {
  const map = new Map();
  const list = chainOverview?.protocols;
  if (!Array.isArray(list)) return map;
  for (const p of list) {
    if (p?.slug) map.set(p.slug, p);
  }
  return map;
}

// --- Category / chain exposure -------------------------------------------

export function computeCategoryExposure(rankedProtocols) {
  const totals = new Map();
  let grandTotal = 0;
  for (const p of rankedProtocols) {
    totals.set(p.category, (totals.get(p.category) || 0) + p.tvl);
    grandTotal += p.tvl;
  }
  return [...totals.entries()]
    .map(([category, tvl]) => ({ category, tvl, sharePct: grandTotal > 0 ? (tvl / grandTotal) * 100 : null }))
    .sort((a, b) => b.tvl - a.tvl);
}

// How concentrated a single protocol's TVL is on Cronos vs. its other
// chains, from /protocol/{slug} `currentChainTvls`.
export function computeChainExposure(protocolDetail) {
  const currentChainTvls = protocolDetail?.currentChainTvls;
  if (!currentChainTvls || typeof currentChainTvls !== "object") return [];
  const entries = Object.entries(currentChainTvls)
    // Drop synthetic breakdown keys DeFiLlama adds, e.g. "Cronos-borrowed".
    .filter(([key]) => !key.includes("-") && key !== "borrowed" && key !== "staking" && key !== "pool2");
  const total = entries.reduce((sum, [, v]) => sum + (typeof v === "number" ? v : 0), 0);
  return entries
    .map(([chain, tvl]) => ({ chain, tvl, sharePct: total > 0 ? (tvl / total) * 100 : null }))
    .sort((a, b) => b.tvl - a.tvl);
}

// --- Historical TVL series (protocol detail) ------------------------------

// Normalize a /protocol/{slug} chainTvls.<chain>.tvl series (or the
// top-level `.tvl` series) into the {date, tvl}[] shape charts.js expects.
export function normalizeTvlSeries(rawSeries) {
  if (!Array.isArray(rawSeries)) return [];
  return rawSeries
    .filter((p) => typeof p?.date === "number" && typeof p?.totalLiquidityUSD === "number")
    .map((p) => ({ date: p.date, tvl: p.totalLiquidityUSD }));
}

// Normalize a dexs/fees summary `.totalDataChart` ([timestamp, value][])
// into the {date, tvl}[] shape charts.js expects (reusing "tvl" as the
// generic value key keeps one chart component for every series type).
export function normalizeVolumeSeries(totalDataChart) {
  if (!Array.isArray(totalDataChart)) return [];
  return totalDataChart
    .filter((point) => Array.isArray(point) && typeof point[0] === "number" && typeof point[1] === "number")
    .map(([date, tvl]) => ({ date, tvl }));
}

// --- Data quality ----------------------------------------------------------

// Label for a single data point: whether we have it, or DeFiLlama simply
// doesn't track it for this protocol/pool. Never label something "live"
// unless it is a real fetched number.
export function dataQualityLabel(value) {
  return typeof value === "number" && Number.isFinite(value) ? "live" : "unavailable";
}

// Overall quality across several named fields, for a summary badge.
export function summarizeDataQuality(fields) {
  const entries = Object.entries(fields);
  const total = entries.length;
  const live = entries.filter(([, v]) => dataQualityLabel(v) === "live").length;
  if (total === 0) return "unavailable";
  if (live === total) return "live";
  if (live === 0) return "unavailable";
  return "partial";
}

// --- Token screener (derived from yield pool symbols) ---------------------

// DeFiLlama has no direct "tokens on chain X" endpoint. We derive token
// exposure from the yields/pools list: a pool's `symbol` (e.g. "USDC-USDT")
// names every token it holds. We split on common separators and aggregate
// per token: how many pools it appears in, total TVL it's exposed to, and
// a TVL-weighted average APY across those pools.
const SYMBOL_SPLIT_RE = /[-/]/;

export function aggregateTokensFromPools(pools) {
  const byToken = new Map();
  for (const pool of pools || []) {
    if (typeof pool?.symbol !== "string" || typeof pool?.tvlUsd !== "number") continue;
    const tokens = [...new Set(pool.symbol.split(SYMBOL_SPLIT_RE).map((s) => s.trim()).filter(Boolean))];
    for (const token of tokens) {
      const entry = byToken.get(token) || {
        token,
        poolCount: 0,
        totalTvlUsd: 0,
        weightedApySum: 0,
        stablecoinPools: 0,
        topPool: null,
      };
      entry.poolCount += 1;
      entry.totalTvlUsd += pool.tvlUsd;
      if (typeof pool.apy === "number") entry.weightedApySum += pool.apy * pool.tvlUsd;
      if (pool.stablecoin) entry.stablecoinPools += 1;
      if (!entry.topPool || pool.tvlUsd > entry.topPool.tvlUsd) {
        entry.topPool = { project: pool.project, symbol: pool.symbol, tvlUsd: pool.tvlUsd, apy: pool.apy ?? null };
      }
      byToken.set(token, entry);
    }
  }
  return [...byToken.values()]
    .map((entry) => ({
      token: entry.token,
      poolCount: entry.poolCount,
      totalTvlUsd: entry.totalTvlUsd,
      avgApy: entry.totalTvlUsd > 0 ? entry.weightedApySum / entry.totalTvlUsd : null,
      isStablecoin: entry.stablecoinPools === entry.poolCount && entry.poolCount > 0,
      topPool: entry.topPool,
    }))
    .sort((a, b) => b.totalTvlUsd - a.totalTvlUsd);
}
