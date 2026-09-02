import { describe, it, expect } from "vitest";
import { applyProtocolFilters, sortProtocols } from "../filters.js";

const protocols = [
  { name: "Tectonic", slug: "tectonic", category: "Lending", tvl: 100, change1d: -1 },
  { name: "VVS Standard", slug: "vvs-standard", category: "Dexs", tvl: 300, change1d: 5 },
  { name: "Veno Finance", slug: "veno-finance", category: "Liquid Staking", tvl: 50, change1d: null },
];

describe("applyProtocolFilters", () => {
  it("filters by case-insensitive name search", () => {
    expect(applyProtocolFilters(protocols, { search: "vvs" }).map((p) => p.name)).toEqual(["VVS Standard"]);
  });

  it("filters by category", () => {
    expect(applyProtocolFilters(protocols, { category: "Lending" }).map((p) => p.name)).toEqual(["Tectonic"]);
  });

  it("'all' category is a no-op", () => {
    expect(applyProtocolFilters(protocols, { category: "all" })).toHaveLength(3);
  });

  it("filters to gainers or losers by 24h change", () => {
    expect(applyProtocolFilters(protocols, { mover: "gainers" }).map((p) => p.name)).toEqual(["VVS Standard"]);
    expect(applyProtocolFilters(protocols, { mover: "losers" }).map((p) => p.name)).toEqual(["Tectonic"]);
  });

  it("combines search, category and mover filters", () => {
    expect(applyProtocolFilters(protocols, { search: "tectonic", category: "Lending", mover: "losers" })).toHaveLength(1);
    expect(applyProtocolFilters(protocols, { search: "tectonic", category: "Dexs", mover: "losers" })).toHaveLength(0);
  });
});

describe("sortProtocols", () => {
  it("sorts by TVL descending by default direction", () => {
    const sorted = sortProtocols(protocols, { key: "tvl", dir: "desc" });
    expect(sorted.map((p) => p.name)).toEqual(["VVS Standard", "Tectonic", "Veno Finance"]);
  });

  it("sorts ascending when requested", () => {
    const sorted = sortProtocols(protocols, { key: "tvl", dir: "asc" });
    expect(sorted.map((p) => p.name)).toEqual(["Veno Finance", "Tectonic", "VVS Standard"]);
  });

  it("pushes protocols missing the sort metric to the end", () => {
    const sorted = sortProtocols(protocols, { key: "change1d", dir: "desc" });
    expect(sorted[sorted.length - 1].name).toBe("Veno Finance");
  });

  it("sorts by a volume lookup map when key is volume24h", () => {
    const volumeMap = new Map([
      ["tectonic", { total24h: 10 }],
      ["vvs-standard", { total24h: 1000 }],
    ]);
    const sorted = sortProtocols(protocols, { key: "volume24h", dir: "desc" }, volumeMap);
    expect(sorted[0].name).toBe("VVS Standard");
    // Veno Finance has no volume entry at all -> pushed to the end.
    expect(sorted[sorted.length - 1].name).toBe("Veno Finance");
  });
});
