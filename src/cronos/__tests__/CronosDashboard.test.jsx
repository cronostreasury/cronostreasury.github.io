import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import fixture from "./fixtures/defillama-cronos.json";
import CronosDashboard from "../CronosDashboard.jsx";
import {
  DEFILLAMA_CHAINS_URL,
  DEFILLAMA_CHAIN_TVL_HISTORY_URL,
  DEFILLAMA_PROTOCOLS_URL,
} from "../defillama.js";

function jsonResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

function mockFetchWithFixture() {
  return vi.fn((url) => {
    if (url === DEFILLAMA_CHAINS_URL) return Promise.resolve(jsonResponse(fixture.chainsResponse));
    if (url === DEFILLAMA_CHAIN_TVL_HISTORY_URL) return Promise.resolve(jsonResponse(fixture.historyResponse));
    if (url === DEFILLAMA_PROTOCOLS_URL) return Promise.resolve(jsonResponse(fixture.protocolsResponse));
    return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
  });
}

describe("CronosDashboard", () => {
  beforeEach(() => {
    globalThis.fetch = mockFetchWithFixture();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading state before data arrives", async () => {
    render(<CronosDashboard />);
    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("renders the real Cronos TVL and top protocols once loaded", async () => {
    render(<CronosDashboard />);

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());

    expect(screen.getByText("$258.76M")).toBeInTheDocument();

    const topProtocol = fixture.protocolsResponse
      .slice()
      .sort((a, b) => b.chainTvls.Cronos - a.chainTvls.Cronos)[0];
    expect(screen.getAllByText(topProtocol.name).length).toBeGreaterThan(0);
  });

  it("shows an error state when the API call fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    render(<CronosDashboard />);

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent(/could not load/i);
  });
});
