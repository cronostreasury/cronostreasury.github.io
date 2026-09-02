import { NAV_ITEMS } from "../lib/navItems.js";

// Visible top navigation shared by every /cronos/* page. `active` is the
// current page's key (passed explicitly by each page's entry point) so
// the right link gets aria-current — no pathname sniffing required.
export default function Nav({ active }) {
  return (
    <nav className="cronos-nav" aria-label="Cronos dashboard sections">
      <div className="cronos-nav-inner">
        <a href="/" className="cronos-nav-brand">
          ← Cronos Treasury Reserve
        </a>
        <div className="cronos-nav-links">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.key}
              href={item.href}
              className="cronos-nav-link"
              aria-current={active === item.key ? "page" : undefined}
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
