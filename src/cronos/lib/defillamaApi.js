// Raw data access for the Cronos DeFi dashboard suite.
// Every function here talks directly to the public, unauthenticated DeFiLlama
// APIs. Nothing in this file fabricates or caches stale data — callers get
// either a live parsed response or a thrown/returned error signal so the UI
// can render "Unavailable" instead of guessing.

export const CHAIN_NAME = "Cronos";

export const DEFILLAMA_CHAINS_URL = "https://api.llama.fi/v2/chains";
export const DEFILLAMA_CHAIN_TVL_HISTORY_URL = "https://api.llama.fi/v2/historicalChainTvl/Cronos";
export const DEFILLAMA_PROTOCOLS_URL = "https://api.llama.fi/protocols";
export const DEFILLAMA_PROTOCOL_DETAIL_URL = (slug) => `https://api.llama.fi/protocol/${encodeURIComponent(slug)}`;
export const DEFILLAMA_DEX_CHAIN_OVERVIEW_URL =
  "https://api.llama.fi/overview/dexs/Cronos?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true";
export const DEFILLAMA_FEES_CHAIN_OVERVIEW_URL =
  "https://api.llama.fi/overview/fees/Cronos?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true";
export const DEFILLAMA_DEX_PROTOCOL_SUMMARY_URL = (slug) =>
  `https://api.llama.fi/summary/dexs/${encodeURIComponent(slug)}?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true`;
export const DEFILLAMA_FEES_PROTOCOL_SUMMARY_URL = (slug) =>
  `https://api.llama.fi/summary/fees/${encodeURIComponent(slug)}?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true`;
export const DEFILLAMA_YIELD_POOLS_URL = "https://yields.llama.fi/pools";

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

export async function fetchAllProtocols(fetchImpl = fetch) {
  const res = await fetchImpl(DEFILLAMA_PROTOCOLS_URL);
  if (!res.ok) throw new Error(`DeFiLlama /protocols HTTP ${res.status}`);
  const protocols = await res.json();
  if (!Array.isArray(protocols)) throw new Error("Unexpected protocols response shape");
  return protocols;
}

// Full detail for a single protocol, including per-chain historical TVL.
export async function fetchProtocolDetail(slug, fetchImpl = fetch) {
  const res = await fetchImpl(DEFILLAMA_PROTOCOL_DETAIL_URL(slug));
  if (!res.ok) throw new Error(`DeFiLlama /protocol/${slug} HTTP ${res.status}`);
  const detail = await res.json();
  if (!detail || typeof detail !== "object") throw new Error("Unexpected protocol detail response shape");
  return detail;
}

// Chain-wide dex volume overview. Also carries a `.protocols[]` breakdown
// (name/slug/total24h/total48hto24h/totalAllTime) that lets ranking pages
// show per-protocol volume without an extra fetch per protocol.
export async function fetchDexChainOverview(fetchImpl = fetch) {
  const res = await fetchImpl(DEFILLAMA_DEX_CHAIN_OVERVIEW_URL);
  if (!res.ok) return null; // Cronos dex tracking can be temporarily unavailable — degrade, don't throw.
  return res.json();
}

// Chain-wide fees/revenue overview, same shape and same graceful-degrade rule.
export async function fetchFeesChainOverview(fetchImpl = fetch) {
  const res = await fetchImpl(DEFILLAMA_FEES_CHAIN_OVERVIEW_URL);
  if (!res.ok) return null;
  return res.json();
}

// Per-protocol dex volume summary with a full time series. Many protocols
// (lending, liquid staking, ...) are not volume-tracked at all — DeFiLlama
// returns 4xx for those, which we treat as "no data", not an error.
export async function fetchDexProtocolSummary(slug, fetchImpl = fetch) {
  const res = await fetchImpl(DEFILLAMA_DEX_PROTOCOL_SUMMARY_URL(slug));
  if (!res.ok) return null;
  return res.json();
}

export async function fetchFeesProtocolSummary(slug, fetchImpl = fetch) {
  const res = await fetchImpl(DEFILLAMA_FEES_PROTOCOL_SUMMARY_URL(slug));
  if (!res.ok) return null;
  return res.json();
}

// All yield pools DeFiLlama tracks, across every chain. Callers filter to
// `chain === CHAIN_NAME` themselves (no server-side filter param exists).
export async function fetchYieldPools(fetchImpl = fetch) {
  const res = await fetchImpl(DEFILLAMA_YIELD_POOLS_URL);
  if (!res.ok) throw new Error(`DeFiLlama yields/pools HTTP ${res.status}`);
  const body = await res.json();
  if (!body || !Array.isArray(body.data)) throw new Error("Unexpected yields/pools response shape");
  return body.data;
}

export async function fetchCronosYieldPools(fetchImpl = fetch) {
  const pools = await fetchYieldPools(fetchImpl);
  return pools.filter((p) => p.chain === CHAIN_NAME);
}
