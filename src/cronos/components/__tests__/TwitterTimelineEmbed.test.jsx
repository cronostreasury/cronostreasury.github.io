import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import TwitterTimelineEmbed from "../TwitterTimelineEmbed.jsx";
import { loadTwitterWidgets } from "../../lib/twitterWidgets.js";

vi.mock("../../lib/twitterWidgets.js", () => ({
  loadTwitterWidgets: vi.fn(),
}));

describe("TwitterTimelineEmbed", () => {
  beforeEach(() => {
    vi.useRealTimers();
    loadTwitterWidgets.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows an unconfigured state and never calls the loader when there is no handle", () => {
    render(<TwitterTimelineEmbed handle={null} url={null} />);
    expect(screen.getByText(/not configured/i)).toBeInTheDocument();
    expect(loadTwitterWidgets).not.toHaveBeenCalled();
  });

  it("renders the real twitter-timeline anchor with the account's href (the official embed shape)", () => {
    loadTwitterWidgets.mockReturnValue(new Promise(() => {})); // never resolves
    render(<TwitterTimelineEmbed handle="CronosTreasury" url="https://x.com/CronosTreasury" />);
    const anchor = document.querySelector("a.twitter-timeline");
    expect(anchor).toBeTruthy();
    expect(anchor.getAttribute("href")).toContain("https://x.com/CronosTreasury");
  });

  it("transitions to loaded once widgets.load resolves with a real widget", async () => {
    const widgetsLoad = vi.fn().mockResolvedValue([{ id: "fake-iframe" }]);
    loadTwitterWidgets.mockResolvedValue({ widgets: { load: widgetsLoad } });

    render(<TwitterTimelineEmbed handle="CronosTreasury" url="https://x.com/CronosTreasury" />);

    await waitFor(() => expect(document.querySelector('[data-status="loaded"]')).toBeInTheDocument());
    expect(widgetsLoad).toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the honest fallback link (not fake content) when widgets.load produces nothing", async () => {
    const widgetsLoad = vi.fn().mockResolvedValue([]);
    loadTwitterWidgets.mockResolvedValue({ widgets: { load: widgetsLoad } });

    render(<TwitterTimelineEmbed handle="CronosTreasury" url="https://x.com/CronosTreasury" />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/didn't load in time/i);
    expect(screen.getByRole("link", { name: /open @CronosTreasury on X/i })).toHaveAttribute(
      "href",
      "https://x.com/CronosTreasury"
    );
  });

  it("shows the fallback link when the script itself fails to load", async () => {
    loadTwitterWidgets.mockRejectedValue(new Error("blocked"));

    render(<TwitterTimelineEmbed handle="DefiLlama" url="https://x.com/DefiLlama" />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/failed to load/i);
    expect(screen.getByRole("link", { name: /open @DefiLlama on X/i })).toBeInTheDocument();
  });

  it("times out into the fallback state if nothing resolves in time", async () => {
    vi.useFakeTimers();
    loadTwitterWidgets.mockReturnValue(new Promise(() => {})); // hangs forever (e.g. request blocked silently)

    render(<TwitterTimelineEmbed handle="CronosChain" url="https://x.com/CronosChain" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10001);
    });

    expect(document.querySelector('[data-status="timeout"]')).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/didn't load in time/i);
  });
});
