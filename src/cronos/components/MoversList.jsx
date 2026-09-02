import { protocolDetailHref } from "../lib/slug.js";
import ChangeBadge from "./ChangeBadge.jsx";

export default function MoversList({ items, emptyLabel }) {
  if (!items.length) {
    return <div className="cronos-card-footnote">{emptyLabel || "No data."}</div>;
  }
  return (
    <div className="cronos-movers">
      {items.map((p) => (
        <a key={p.slug || p.name} className="cronos-mover" href={p.slug ? protocolDetailHref(p.slug) : p.url || "#"}>
          <span>{p.name}</span>
          <ChangeBadge pct={p.change1d} />
        </a>
      ))}
    </div>
  );
}
