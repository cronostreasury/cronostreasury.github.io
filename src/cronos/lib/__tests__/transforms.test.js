import { describe, it, expect } from "vitest";
import fixture from "../../__tests__/fixtures/defillama-cronos.json";
import {
  rankProtocolsByCronosTvl,
  computeHistoryChangePct,
  computeTvlShare,
  computeConcentrationIndex,
  concentrationLabel,
  computeTopMovers,
  computeGainersAndLosers,
  classifyMomentum,
  computeVolumeToTvlRatio,
  indexChainOverviewProtocols,
  computeCategoryExposure,
  computeChainExposure,
  normalizeTvlSeries,
  normalizeVolumeSeries,
  dataQualityLabel,
  summarizeDataQuality,
  aggregateTokensFromPools,
} from "../transforms.js";

describe("rankProtocolsByCronosTvl", () => {
  it("drops protocols with no Cronos allocation and sorts descending", () => {
    const input = [
      { name: "A", chainTvls: { Cronos: 10 } },
      { name: "B", chainTvls: { Ethereum: 500 } },
      { name: "C", chainTvls: { Cronos: 100 } },
    ];
    expect(rankProtocolsByCronosTvl(input).map((p) => p.name)).toEqual(["C", "A"]);
  });

  it("carries through real protocol fields from the fixture", () => {
    const ranked = rankProtocolsByCronosTvl(fixture.protocolsResponse);
    expect(ranked[0]).toMatchObject({ name: expect.any(String), category: expect.any(String), tvl: expect.any(Number) });
  });

  it("returns an empty array for non-array input", () => {
    expect(rankProtocolsByCronosTvl(null)).toEqual([]);
    expect(rankProtocolsByCronosTvl(undefined)).toEqual([]);
  });
});

describe("computeHistoryChangePct", () => {
  it("computes percent change over N days", () => {
    const history = [
      { date: 0, tvl: 100 },
      { date: 86400, tvl: 110 },
      { date: 172800, tvl: 121 },
    ];
    expect(computeHistoryChangePct(history, 2)).toBeCloseTo(21, 5);
  });

  it("returns null for insufficient data", () => {
    expect(computeHistoryChangePct([{ date: 0, tvl: 100 }], 7)).toBeNull();
    expect(computeHistoryChangePct([], 7)).toBeNull();
  });
});

describe("computeTvlShare / computeConcentrationIndex", () => {
  const ranked = [
    { name: "A", tvl: 60 },
    { name: "B", tvl: 40 },
  ];

  it("computes share percentages that sum to 100", () => {
    const withShare = computeTvlShare(ranked);
    expect(withShare[0].sharePct).toBeCloseTo(60, 5);
    expect(withShare[1].sharePct).toBeCloseTo(40, 5);
  });

  it("computes HHI: two equal protocols -> 5000, one dominant -> near 10000", () => {
    expect(computeConcentrationIndex([{ tvl: 50 }, { tvl: 50 }])).toBe(5000);
    expect(computeConcentrationIndex([{ tvl: 99 }, { tvl: 1 }])).toBeGreaterThan(9000);
  });

  it("returns null when there is no TVL to share", () => {
    expect(computeConcentrationIndex([])).toBeNull();
  });

  it("labels concentration bands", () => {
    expect(concentrationLabel(9000)).toBe("Highly concentrated");
    expect(concentrationLabel(2000)).toBe("Moderately concentrated");
    expect(concentrationLabel(500)).toBe("Diversified");
    expect(concentrationLabel(null)).toBe("Unavailable");
  });
});

describe("computeTopMovers / computeGainersAndLosers", () => {
  const ranked = [
    { name: "Up big", change1d: 20 },
    { name: "Up small", change1d: 2 },
    { name: "Down small", change1d: -3 },
    { name: "Down big", change1d: -25 },
    { name: "Missing", change1d: null },
  ];

  it("ranks descending by default and excludes missing metrics", () => {
    const top = computeTopMovers(ranked, { metric: "change1d", limit: 2 });
    expect(top.map((p) => p.name)).toEqual(["Up big", "Up small"]);
  });

  it("splits gainers and losers, excluding flat/missing", () => {
    const { gainers, losers } = computeGainersAndLosers(ranked, { limit: 5 });
    expect(gainers.map((p) => p.name)).toEqual(["Up big", "Up small"]);
    expect(losers.map((p) => p.name)).toEqual(["Down big", "Down small"]);
  });
});

describe("classifyMomentum", () => {
  it("classifies accelerating and reversing trends", () => {
    expect(classifyMomentum(10, 7)).toBe("Accelerating up");
    expect(classifyMomentum(-10, -7)).toBe("Accelerating down");
    expect(classifyMomentum(5, -7)).toBe("Reversing up");
    expect(classifyMomentum(-5, 7)).toBe("Reversing down");
    expect(classifyMomentum(0.1, 0.2)).toBe("Flat");
  });

  it("returns Unavailable when data is missing", () => {
    expect(classifyMomentum(null, 1)).toBe("Unavailable");
    expect(classifyMomentum(1, undefined)).toBe("Unavailable");
  });
});

describe("computeVolumeToTvlRatio", () => {
  it("divides volume by TVL", () => {
    expect(computeVolumeToTvlRatio(50, 200)).toBe(0.25);
  });
  it("returns null for missing or non-positive inputs", () => {
    expect(computeVolumeToTvlRatio(null, 200)).toBeNull();
    expect(computeVolumeToTvlRatio(50, 0)).toBeNull();
  });
});

describe("indexChainOverviewProtocols", () => {
  it("indexes protocols by slug", () => {
    const map = indexChainOverviewProtocols({ protocols: [{ slug: "vvs-standard", total24h: 100 }] });
    expect(map.get("vvs-standard")).toMatchObject({ total24h: 100 });
  });
  it("returns an empty map when overview is null", () => {
    expect(indexChainOverviewProtocols(null).size).toBe(0);
  });
});

describe("computeCategoryExposure", () => {
  it("sums TVL per category and computes share", () => {
    const ranked = [
      { category: "Lending", tvl: 30 },
      { category: "Dexs", tvl: 50 },
      { category: "Dexs", tvl: 20 },
    ];
    const exposure = computeCategoryExposure(ranked);
    expect(exposure[0]).toMatchObject({ category: "Dexs", tvl: 70, sharePct: 70 });
    expect(exposure[1]).toMatchObject({ category: "Lending", tvl: 30, sharePct: 30 });
  });
});

describe("computeChainExposure", () => {
  it("filters synthetic breakdown keys and sorts descending", () => {
    const detail = { currentChainTvls: { Cronos: 80, "Cronos-borrowed": 5, Ethereum: 20, borrowed: 5 } };
    const exposure = computeChainExposure(detail);
    expect(exposure.map((e) => e.chain)).toEqual(["Cronos", "Ethereum"]);
    expect(exposure[0].sharePct).toBeCloseTo(80, 5);
  });

  it("returns an empty array when currentChainTvls is missing", () => {
    expect(computeChainExposure({})).toEqual([]);
  });
});

describe("normalizeTvlSeries / normalizeVolumeSeries", () => {
  it("normalizes DeFiLlama protocol tvl history points", () => {
    const raw = [{ date: 1, totalLiquidityUSD: 100 }, { date: "bad" }];
    expect(normalizeTvlSeries(raw)).toEqual([{ date: 1, tvl: 100 }]);
  });

  it("normalizes dexs/fees totalDataChart tuples", () => {
    const raw = [[1, 100], [2, 200], "bad"];
    expect(normalizeVolumeSeries(raw)).toEqual([{ date: 1, tvl: 100 }, { date: 2, tvl: 200 }]);
  });
});

describe("dataQualityLabel / summarizeDataQuality", () => {
  it("labels a real finite number as live, anything else unavailable", () => {
    expect(dataQualityLabel(42)).toBe("live");
    expect(dataQualityLabel(null)).toBe("unavailable");
    expect(dataQualityLabel(NaN)).toBe("unavailable");
  });

  it("summarizes mixed fields as partial", () => {
    expect(summarizeDataQuality({ a: 1, b: null })).toBe("partial");
    expect(summarizeDataQuality({ a: 1, b: 2 })).toBe("live");
    expect(summarizeDataQuality({ a: null, b: null })).toBe("unavailable");
  });
});

describe("aggregateTokensFromPools", () => {
  it("splits pair symbols and aggregates TVL-weighted APY per token", () => {
    const pools = [
      { symbol: "USDC-USDT", tvlUsd: 100, apy: 10, stablecoin: true, project: "vvs", pool: "p1" },
      { symbol: "USDC", tvlUsd: 300, apy: 5, stablecoin: true, project: "tectonic", pool: "p2" },
    ];
    const tokens = aggregateTokensFromPools(pools);
    const usdc = tokens.find((t) => t.token === "USDC");
    expect(usdc.poolCount).toBe(2);
    expect(usdc.totalTvlUsd).toBe(400);
    // weighted avg = (100*10 + 300*5) / 400 = 6.25
    expect(usdc.avgApy).toBeCloseTo(6.25, 5);
    expect(usdc.isStablecoin).toBe(true);

    const usdt = tokens.find((t) => t.token === "USDT");
    expect(usdt.poolCount).toBe(1);
  });

  it("skips pools without a usable symbol or TVL", () => {
    expect(aggregateTokensFromPools([{ symbol: null, tvlUsd: 100 }])).toEqual([]);
    expect(aggregateTokensFromPools([])).toEqual([]);
  });
});
