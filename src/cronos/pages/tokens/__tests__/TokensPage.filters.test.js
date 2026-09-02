import { describe, it, expect } from "vitest";
import { applyTokenFilters } from "../filters.js";

const tokens = [
  { token: "USDC", isStablecoin: true, totalTvlUsd: 100 },
  { token: "CRO", isStablecoin: false, totalTvlUsd: 50 },
  { token: "USDT", isStablecoin: true, totalTvlUsd: 30 },
];

describe("applyTokenFilters", () => {
  it("filters by case-insensitive token search", () => {
    expect(applyTokenFilters(tokens, { search: "usd" }).map((t) => t.token)).toEqual(["USDC", "USDT"]);
  });

  it("filters to stablecoins only", () => {
    expect(applyTokenFilters(tokens, { stablecoinOnly: true }).map((t) => t.token)).toEqual(["USDC", "USDT"]);
  });

  it("combines search and stablecoin filters", () => {
    expect(applyTokenFilters(tokens, { search: "cro", stablecoinOnly: true })).toEqual([]);
  });

  it("returns everything when no filters are active", () => {
    expect(applyTokenFilters(tokens, {})).toHaveLength(3);
  });
});
