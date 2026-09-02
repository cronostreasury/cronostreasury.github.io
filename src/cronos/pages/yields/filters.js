export function applyPoolFilters(pools, { search, stablecoinOnly, minTvl }) {
  let list = pools;
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter((p) => p.symbol.toLowerCase().includes(q) || p.project.toLowerCase().includes(q));
  }
  if (stablecoinOnly) {
    list = list.filter((p) => p.stablecoin);
  }
  if (minTvl > 0) {
    list = list.filter((p) => p.tvlUsd >= minTvl);
  }
  return list;
}

export function sortPools(pools, sort) {
  const { key, dir } = sort;
  return [...pools].sort((a, b) => (dir === "desc" ? b[key] - a[key] : a[key] - b[key]));
}
