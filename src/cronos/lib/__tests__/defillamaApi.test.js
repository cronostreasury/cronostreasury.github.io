import { describe, it, expect, vi } from "vitest";
import fixture from "../../__tests__/fixtures/defillama-cronos.json";
import {
  fetchChainOverview,
  fetchChainTvlHistory,
  fetchAllProtocols,
  fetchProtocolDetail,
  fetchDexProtocolSummary,
  fetchFeesProtocolSummary,
  fetchDexChainOverview,
  fetchFeesChainOverview,
  fetchYieldPools,
  fetchCronosYieldPools,
  CHAIN_NAME,
} from "../defillamaApi.js";

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe("fetchChainOverview", () => {
  it("returns the Cronos entry from the live chains response shape", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(fixture.chainsResponse));
    const chain = await fetchChainOverview(fetchImpl);
    expect(chain.name).toBe(CHAIN_NAME);
    expect(chain.tvl).toBeGreaterThan(0);
  });

  it("throws when Cronos is missing from the response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([{ name: "Ethereum", tvl: 1 }]));
    await expect(fetchChainOverview(fetchImpl)).rejects.toThrow(/Cronos chain not found/);
  });

  it("throws on a non-ok HTTP response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(null, false, 503));
    await expect(fetchChainOverview(fetchImpl)).rejects.toThrow(/HTTP 503/);
  });
});

describe("fetchChainTvlHistory", () => {
  it("returns the historical TVL array", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(fixture.historyResponse));
    const history = await fetchChainTvlHistory(fetchImpl);
    expect(history.length).toBe(fixture.historyResponse.length);
  });
});

describe("fetchAllProtocols", () => {
  it("returns the full protocols array unfiltered", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(fixture.protocolsResponse));
    const protocols = await fetchAllProtocols(fetchImpl);
    expect(protocols.length).toBe(fixture.protocolsResponse.length);
  });

  it("throws on non-ok response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(null, false, 500));
    await expect(fetchAllProtocols(fetchImpl)).rejects.toThrow(/HTTP 500/);
  });
});

describe("fetchProtocolDetail", () => {
  it("returns the parsed protocol detail object", async () => {
    const body = { name: "Tectonic", chainTvls: { Cronos: { tvl: [] } } };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(body));
    const detail = await fetchProtocolDetail("tectonic", fetchImpl);
    expect(detail.name).toBe("Tectonic");
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("/protocol/tectonic"));
  });

  it("throws when the protocol is not found", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(null, false, 404));
    await expect(fetchProtocolDetail("does-not-exist", fetchImpl)).rejects.toThrow(/HTTP 404/);
  });
});

describe("graceful degradation for volume/fees endpoints", () => {
  it("fetchDexProtocolSummary returns null (not a throw) on a non-ok response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(null, false, 400));
    await expect(fetchDexProtocolSummary("tectonic", fetchImpl)).resolves.toBeNull();
  });

  it("fetchFeesProtocolSummary returns null on a non-ok response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(null, false, 400));
    await expect(fetchFeesProtocolSummary("tectonic", fetchImpl)).resolves.toBeNull();
  });

  it("fetchDexChainOverview returns null instead of throwing when unavailable", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(null, false, 500));
    await expect(fetchDexChainOverview(fetchImpl)).resolves.toBeNull();
  });

  it("fetchFeesChainOverview returns null instead of throwing when unavailable", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(null, false, 500));
    await expect(fetchFeesChainOverview(fetchImpl)).resolves.toBeNull();
  });

  it("fetchDexProtocolSummary returns the parsed body on success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ total24h: 123 }));
    await expect(fetchDexProtocolSummary("vvs-standard", fetchImpl)).resolves.toEqual({ total24h: 123 });
  });
});

describe("fetchYieldPools / fetchCronosYieldPools", () => {
  const body = {
    status: "success",
    data: [
      { chain: "Cronos", symbol: "USDC", tvlUsd: 1 },
      { chain: "Ethereum", symbol: "USDC", tvlUsd: 2 },
    ],
  };

  it("returns the raw data array", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(body));
    const pools = await fetchYieldPools(fetchImpl);
    expect(pools).toHaveLength(2);
  });

  it("filters to Cronos-chain pools only", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(body));
    const pools = await fetchCronosYieldPools(fetchImpl);
    expect(pools).toEqual([{ chain: "Cronos", symbol: "USDC", tvlUsd: 1 }]);
  });

  it("throws on an unexpected response shape", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ notData: true }));
    await expect(fetchYieldPools(fetchImpl)).rejects.toThrow(/Unexpected/);
  });
});
