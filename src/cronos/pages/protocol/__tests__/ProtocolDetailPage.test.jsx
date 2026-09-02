import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import fixture from "../../../__tests__/fixtures/defillama-cronos.json";
import ProtocolDetailPage from "../ProtocolDetailPage.jsx";

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

const protocolDetail = {
  name: "Tectonic",
  category: "Lending",
  description: "A money market on Cronos.",
  url: "https://tectonic.finance/",
  logo: "https://icons.llamao.fi/icons/protocols/tectonic",
  chains: ["Cronos"],
  currentChainTvls: { Cronos: 120_000_000, "Cronos-borrowed": 176_000 },
  chainTvls: {
    Cronos: {
      tvl: [
        { date: 1, totalLiquidityUSD: 118_000_000 },
        { date: 86401, totalLiquidityUSD: 120_000_000 },
      ],
    },
  },
};

function mockFetchFor({ dexOk = false, feesOk = false } = {}) {
  return vi.fn((url) => {
    if (url.includes("/protocol/tectonic")) return Promise.resolve(jsonResponse(protocolDetail));
    if (url.includes("/v2/chains")) return Promise.resolve(jsonResponse(fixture.chainsResponse));
    if (url.includes("/summary/dexs/")) {
      return dexOk
        ? Promise.resolve(jsonResponse({ total24h: 1000, total7d: 7000, totalDataChart: [[1, 100], [2, 200]] }))
        : Promise.resolve(jsonResponse(null, false, 400));
    }
    if (url.includes("/summary/fees/")) {
      return feesOk
        ? Promise.resolve(jsonResponse({ total24h: 50, total7d: 350 }))
        : Promise.resolve(jsonResponse(null, false, 400));
    }
    return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
  });
}

describe("ProtocolDetailPage", () => {
  beforeEach(() => {
    // AnimatedNumber's own tests cover count-up timing; here we only care
    // that the right final values render, so force it to resolve instantly.
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows a not-found state when no slug is given", async () => {
    render(<ProtocolDetailPage slug={null} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/no protocol specified/i);
    expect(screen.getByRole("link", { name: /back to protocols/i })).toHaveAttribute("href", "/cronos/protocols/");
  });

  it("renders protocol TVL and marks untracked volume/fees as Unavailable", async () => {
    globalThis.fetch = mockFetchFor({ dexOk: false, feesOk: false });
    render(<ProtocolDetailPage slug="tectonic" />);

    expect(await screen.findByText("Tectonic")).toBeInTheDocument();
    expect(screen.getByText("$120.00M")).toBeInTheDocument();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
  });

  it("renders volume/fees when DeFiLlama tracks them for this protocol", async () => {
    globalThis.fetch = mockFetchFor({ dexOk: true, feesOk: true });
    render(<ProtocolDetailPage slug="tectonic" />);

    await waitFor(() => expect(screen.getByText("Tectonic")).toBeInTheDocument());
    expect(screen.getByText("$1.0K")).toBeInTheDocument(); // volume 24h
    expect(screen.getByText("$50.00")).toBeInTheDocument(); // fees 24h
  });

  it("shows an error state when the protocol slug doesn't exist", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(null, false, 404));
    render(<ProtocolDetailPage slug="does-not-exist" />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});
