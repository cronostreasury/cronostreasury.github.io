// Data access + pure transforms for the Cronos DeFi dashboard.
// All figures shown on the page come from these live DeFiLlama endpoints —
// nothing here is hardcoded or fabricated.

export const DEFILLAMA_CHAINS_URL = "https://api.llama.fi/v2/chains";
export const DEFILLAMA_CHAIN_TVL_HISTORY_URL = "https://api.llama.fi/v2/historicalChainTvl/Cronos";
export const DEFILLAMA_PROTOCOLS_URL = "https://api.llama.fi/protocols";
export const CHAIN_NAME = "Cronos";

export async function fetchChainOverview(fetchImpl = fetch) {
  const res = await fetchImpl(DEFILLAMA_CHAINS_URL);
  if (!res.ok) throw new Error(`DeFiLlama /v2/chains HTTP ${res.status}`);
  const chains = await res.json();
  const chain = Array.isArray(chains) ? chains.find((c) => c.name === CHAIN_NAME) : null;
  if (!chain) throw new Error("Cronos chain not found in DeFiLlama /v2/chains response");
  return chain;
}

export async function fetchChainTvlHistory(fetchImpl = fetch) {
  const res = await fetchImpl(DEFILLAMA_CHAIN_TVL_HISTORY_URL);
  if (!res.ok) throw new Error(`DeFiLlama historicalChainTvl HTTP ${res.status}`);
  const history = await res.json();
  if (!Array.isArray(history)) throw new Error("Unexpected historicalChainTvl response shape");
  return history;
}

export async function fetchTopProtocols(fetchImpl = fetch, limit = 10) {
  const res = await fetchImpl(DEFILLAMA_PROTOCOLS_URL);
  if (!res.ok) throw new Error(`DeFiLlama /protocols HTTP ${res.status}`);
  const protocols = await res.json();
  if (!Array.isArray(protocols)) throw new Error("Unexpected protocols response shape");
  return rankProtocolsByCronosTvl(protocols).slice(0, limit);
}

// Pure: filter to protocols with a Cronos allocation and sort by it, desc.
export function rankProtocolsByCronosTvl(protocols) {
  return protocols
    .filter((p) => typeof p?.chainTvls?.[CHAIN_NAME] === "number" && p.chainTvls[CHAIN_NAME] > 0)
    .map((p) => ({
      name: p.name,
      category: p.category || "Other",
      tvl: p.chainTvls[CHAIN_NAME],
      change1d: typeof p.change_1d === "number" ? p.change_1d : null,
      change7d: typeof p.change_7d === "number" ? p.change_7d : null,
      url: p.url || null,
      logo: p.logo || null,
      slug: p.slug || null,
    }))
    .sort((a, b) => b.tvl - a.tvl);
}

// Pure: percent change between the TVL `daysBack` days ago and the latest point.
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

// Pure: reduce a full history array down to evenly-spaced points an SVG
// sparkline can plot, plus the min/max needed to scale it.
export function buildSparklineSeries(history, days = 90) {
  if (!Array.isArray(history) || history.length === 0) {
    return { points: [], min: 0, max: 0 };
  }
  const points = history.slice(-days);
  const values = points.map((p) => p.tvl);
  return { points, min: Math.min(...values), max: Math.max(...values) };
}

// Pure: build an SVG polyline `points` attribute string scaled to a viewBox.
export function sparklinePath(series, width = 300, height = 80) {
  const { points, min, max } = series;
  if (points.length < 2) return "";
  const range = max - min || 1;
  return points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((p.tvl - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function formatUsdCompact(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export function formatPct(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
