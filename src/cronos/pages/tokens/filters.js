export function applyTokenFilters(tokens, { search, stablecoinOnly }) {
  let list = tokens;
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter((t) => t.token.toLowerCase().includes(q));
  }
  if (stablecoinOnly) {
    list = list.filter((t) => t.isStablecoin);
  }
  return list;
}
