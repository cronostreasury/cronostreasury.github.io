import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AnimatedNumber from "../AnimatedNumber.jsx";

const usd = (n) => `$${n.toFixed(2)}`;

describe("AnimatedNumber", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders an em dash while there is no real loaded value", () => {
    render(<AnimatedNumber value={null} format={usd} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders an em dash for a non-finite value", () => {
    render(<AnimatedNumber value={NaN} format={usd} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  describe("with prefers-reduced-motion: reduce", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn().mockReturnValue({ matches: true })
      );
    });

    it("jumps straight to the formatted final value with no easing", () => {
      render(<AnimatedNumber value={1234.5} format={usd} />);
      expect(screen.getByText("$1234.50")).toBeInTheDocument();
    });
  });

  describe("without prefers-reduced-motion (animated count-up)", () => {
    beforeEach(() => {
      vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
      // Resolve the animation in a single frame so the test stays deterministic.
      vi.stubGlobal("requestAnimationFrame", (cb) => {
        cb(performance.now() + 10_000);
        return 1;
      });
      vi.stubGlobal("cancelAnimationFrame", () => {});
    });

    it("ends on the correct formatted value once the animation resolves", () => {
      render(<AnimatedNumber value={500} format={usd} durationMs={100} />);
      expect(screen.getByText("$500.00")).toBeInTheDocument();
    });
  });
});
