import { describe, it, expect, vi } from "vitest";
import fixture from "./fixtures/defillama-cronos.json";
import {
  fetchChainOverview,
  fetchChainTvlHistory,
  fetchTopProtocols,
  rankProtocolsByCronosTvl,
  computeHistoryChangePct,
  buildSparklineSeries,
  sparklinePath,
  formatUsdCompact,
  formatPct,
  CHAIN_NAME,
} from "../defillama.js";

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
    expect(history[0]).toHaveProperty("date");
    expect(history[0]).toHaveProperty("tvl");
  });
});

describe("fetchTopProtocols", () => {
  it("ranks and limits protocols by Cronos TVL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(fixture.protocolsResponse));
    const top = await fetchTopProtocols(fetchImpl, 5);
    expect(top.length).toBe(5);
    for (let i = 1; i < top.length; i++) {
      expect(top[i - 1].tvl).toBeGreaterThanOrEqual(top[i].tvl);
    }
  });
});

describe("rankProtocolsByCronosTvl", () => {
  it("drops protocols with no Cronos allocation and sorts descending", () => {
    const input = [
      { name: "A", chainTvls: { Cronos: 10 } },
      { name: "B", chainTvls: { Ethereum: 500 } },
      { name: "C", chainTvls: { Cronos: 100 } },
    ];
    const ranked = rankProtocolsByCronosTvl(input);
    expect(ranked.map((p) => p.name)).toEqual(["C", "A"]);
  });

  it("carries through real protocol fields from the fixture", () => {
    const ranked = rankProtocolsByCronosTvl(fixture.protocolsResponse);
    expect(ranked[0]).toMatchObject({
      name: expect.any(String),
      category: expect.any(String),
      tvl: expect.any(Number),
    });
  });
});

describe("computeHistoryChangePct", () => {
  it("computes percent change over N days", () => {
    const history = [
      { date: 0, tvl: 100 },
      { date: 86400, tvl: 110 },
      { date: 172800, tvl: 121 },
    ];
    // From day 0 (100) to day 2 (121) => +21%
    expect(computeHistoryChangePct(history, 2)).toBeCloseTo(21, 5);
  });

  it("returns null for insufficient data", () => {
    expect(computeHistoryChangePct([{ date: 0, tvl: 100 }], 7)).toBeNull();
    expect(computeHistoryChangePct([], 7)).toBeNull();
  });

  it("computes a real 7d change from the fixture without throwing", () => {
    const pct = computeHistoryChangePct(fixture.historyResponse, 7);
    expect(typeof pct).toBe("number");
    expect(Number.isFinite(pct)).toBe(true);
  });
});

describe("buildSparklineSeries", () => {
  it("caps to the requested window and reports min/max", () => {
    const history = Array.from({ length: 200 }, (_, i) => ({ date: i * 86400, tvl: i }));
    const series = buildSparklineSeries(history, 90);
    expect(series.points.length).toBe(90);
    expect(series.min).toBe(110);
    expect(series.max).toBe(199);
  });

  it("handles empty history", () => {
    expect(buildSparklineSeries([], 90)).toEqual({ points: [], min: 0, max: 0 });
  });
});

describe("sparklinePath", () => {
  it("produces one coordinate pair per point", () => {
    const series = { points: [{ tvl: 1 }, { tvl: 2 }, { tvl: 3 }], min: 1, max: 3 };
    const path = sparklinePath(series, 100, 50);
    expect(path.split(" ")).toHaveLength(3);
  });

  it("returns empty string for fewer than 2 points", () => {
    expect(sparklinePath({ points: [{ tvl: 1 }], min: 1, max: 1 })).toBe("");
  });
});

describe("formatUsdCompact", () => {
  it("formats billions, millions, thousands", () => {
    expect(formatUsdCompact(2_500_000_000)).toBe("$2.50B");
    expect(formatUsdCompact(258_763_396)).toBe("$258.76M");
    expect(formatUsdCompact(1_500)).toBe("$1.5K");
    expect(formatUsdCompact(12)).toBe("$12.00");
  });

  it("returns an em dash for non-numbers", () => {
    expect(formatUsdCompact(NaN)).toBe("—");
    expect(formatUsdCompact(undefined)).toBe("—");
  });
});

describe("formatPct", () => {
  it("adds a sign for positive values", () => {
    expect(formatPct(3.456)).toBe("+3.46%");
    expect(formatPct(-1.2)).toBe("-1.20%");
    expect(formatPct(0)).toBe("0.00%");
  });
});
