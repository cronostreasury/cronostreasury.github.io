import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Nav from "../Nav.jsx";
import { NAV_ITEMS } from "../../lib/navItems.js";

describe("Nav", () => {
  it("renders a link for every section", () => {
    render(<Nav active="overview" />);
    for (const item of NAV_ITEMS) {
      expect(screen.getByRole("link", { name: item.label })).toHaveAttribute("href", item.href);
    }
  });

  it("marks the active page with aria-current, and only that one", () => {
    render(<Nav active="protocols" />);
    expect(screen.getByRole("link", { name: "Protocols" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Yields" })).not.toHaveAttribute("aria-current");
  });

  it("marks nothing as active when active doesn't match any section (e.g. protocol detail drill-down)", () => {
    render(<Nav active="protocols" />);
    const current = screen.queryAllByRole("link").filter((el) => el.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
  });
});
