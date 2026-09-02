import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import fixture from "../../../__tests__/fixtures/defillama-cronos.json";
import OverviewPage from "../OverviewPage.jsx";

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

function mockFetchWithFixture() {
  return vi.fn((url) => {
    if (url.includes("/v2/chains")) return Promise.resolve(jsonResponse(fixture.chainsResponse));
    if (url.includes("/v2/historicalChainTvl")) return Promise.resolve(jsonResponse(fixture.historyResponse));
    if (url.includes("/protocols")) return Promise.resolve(jsonResponse(fixture.protocolsResponse));
    if (url.includes("/overview/dexs")) return Promise.resolve(jsonResponse(null, false, 404));
    if (url.includes("/overview/fees")) return Promise.resolve(jsonResponse(null, false, 404));
    return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
  });
}

describe("OverviewPage", () => {
  beforeEach(() => {
    // AnimatedNumber's own tests cover count-up timing; here we only care
    // that the right final values render, so force it to resolve instantly.
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows a loading state before data arrives", async () => {
    globalThis.fetch = mockFetchWithFixture();
    render(<OverviewPage />);
    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("renders the real Cronos TVL and top protocols once loaded", async () => {
    globalThis.fetch = mockFetchWithFixture();
    render(<OverviewPage />);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());

    expect(screen.getByText("$258.76M")).toBeInTheDocument();
    const topProtocol = fixture.protocolsResponse.slice().sort((a, b) => b.chainTvls.Cronos - a.chainTvls.Cronos)[0];
    expect(screen.getAllByText(topProtocol.name).length).toBeGreaterThan(0);
  });

  it("labels chain volume/fees as Unavailable when DeFiLlama doesn't return them", async () => {
    globalThis.fetch = mockFetchWithFixture();
    render(<OverviewPage />);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());

    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
  });

  it("shows an error state when a required endpoint fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(null, false, 500));
    render(<OverviewPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent(/could not load/i);
  });
});
