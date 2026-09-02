import { describe, it, expect } from "vitest";
import { applyPoolFilters, sortPools } from "../filters.js";

const pools = [
  { pool: "p1", symbol: "USDC", project: "tectonic", tvlUsd: 500_000, apy: 5, stablecoin: true },
  { pool: "p2", symbol: "CRO-USDC", project: "vvs-standard", tvlUsd: 2_000_000, apy: 40, stablecoin: false },
  { pool: "p3", symbol: "USDT", project: "ferro", tvlUsd: 5_000, apy: 3, stablecoin: true },
];

describe("applyPoolFilters", () => {
  it("filters by symbol or project search", () => {
    expect(applyPoolFilters(pools, { search: "vvs" }).map((p) => p.pool)).toEqual(["p2"]);
    expect(applyPoolFilters(pools, { search: "usdc" }).map((p) => p.pool)).toEqual(["p1", "p2"]);
  });

  it("filters to stablecoin pools only", () => {
    expect(applyPoolFilters(pools, { stablecoinOnly: true }).map((p) => p.pool)).toEqual(["p1", "p3"]);
  });

  it("filters by minimum TVL", () => {
    expect(applyPoolFilters(pools, { minTvl: 100_000 }).map((p) => p.pool)).toEqual(["p1", "p2"]);
  });

  it("combines all filters", () => {
    expect(applyPoolFilters(pools, { search: "usd", stablecoinOnly: true, minTvl: 100_000 }).map((p) => p.pool)).toEqual(["p1"]);
  });
});

describe("sortPools", () => {
  it("sorts by tvlUsd descending", () => {
    expect(sortPools(pools, { key: "tvlUsd", dir: "desc" }).map((p) => p.pool)).toEqual(["p2", "p1", "p3"]);
  });

  it("sorts by apy ascending", () => {
    expect(sortPools(pools, { key: "apy", dir: "asc" }).map((p) => p.pool)).toEqual(["p3", "p1", "p2"]);
  });
});
