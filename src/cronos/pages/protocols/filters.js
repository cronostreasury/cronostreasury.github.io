export function applyProtocolFilters(protocols, { search, category, mover }) {
  let list = protocols;
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(q));
  }
  if (category && category !== "all") {
    list = list.filter((p) => p.category === category);
  }
  if (mover === "gainers") {
    list = list.filter((p) => typeof p.change1d === "number" && p.change1d > 0);
  } else if (mover === "losers") {
    list = list.filter((p) => typeof p.change1d === "number" && p.change1d < 0);
  }
  return list;
}

export function sortProtocols(protocols, sort, volumeMap) {
  if (!sort) return protocols;
  const { key, dir } = sort;
  const valueOf = (p) => {
    if (key === "volume24h") {
      const v = volumeMap?.get(p.slug)?.total24h;
      return typeof v === "number" ? v : null;
    }
    return typeof p[key] === "number" ? p[key] : null;
  };
  const withValue = protocols.filter((p) => valueOf(p) != null);
  const withoutValue = protocols.filter((p) => valueOf(p) == null);
  withValue.sort((a, b) => (dir === "desc" ? valueOf(b) - valueOf(a) : valueOf(a) - valueOf(b)));
  return [...withValue, ...withoutValue];
}
