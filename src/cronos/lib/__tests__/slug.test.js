import { describe, it, expect, vi } from "vitest";
import { readProtocolSlugFromLocation, protocolDetailHref, restorePrettyProtocolUrl } from "../slug.js";

describe("readProtocolSlugFromLocation", () => {
  it("reads the slug from the ?slug= query param (the 404.html redirect shape)", () => {
    const loc = { pathname: "/cronos/protocol/index.html", search: "?slug=tectonic&redirect=1" };
    expect(readProtocolSlugFromLocation(loc)).toBe("tectonic");
  });

  it("decodes an encoded slug from the query param", () => {
    const loc = { pathname: "/cronos/protocol/index.html", search: "?slug=vvs%2Dstandard" };
    expect(readProtocolSlugFromLocation(loc)).toBe("vvs-standard");
  });

  it("falls back to parsing the pretty path when there is no query param", () => {
    const loc = { pathname: "/cronos/protocol/tectonic/", search: "" };
    expect(readProtocolSlugFromLocation(loc)).toBe("tectonic");
  });

  it("falls back to a pretty path without a trailing slash", () => {
    const loc = { pathname: "/cronos/protocol/tectonic", search: "" };
    expect(readProtocolSlugFromLocation(loc)).toBe("tectonic");
  });

  it("returns null for the bare index (no slug given anywhere)", () => {
    const loc = { pathname: "/cronos/protocol/index.html", search: "" };
    expect(readProtocolSlugFromLocation(loc)).toBeNull();
    const loc2 = { pathname: "/cronos/protocol/", search: "" };
    expect(readProtocolSlugFromLocation(loc2)).toBeNull();
  });
});

describe("protocolDetailHref", () => {
  it("builds the pretty URL and encodes the slug", () => {
    expect(protocolDetailHref("tectonic")).toBe("/cronos/protocol/tectonic/");
    expect(protocolDetailHref("a/b")).toBe("/cronos/protocol/a%2Fb/");
  });
});

describe("restorePrettyProtocolUrl", () => {
  it("replaces the address bar URL with the pretty form", () => {
    const loc = { pathname: "/cronos/protocol/index.html" };
    const historyImpl = { replaceState: vi.fn() };
    restorePrettyProtocolUrl("tectonic", loc, historyImpl);
    expect(historyImpl.replaceState).toHaveBeenCalledWith(null, "", "/cronos/protocol/tectonic/");
  });

  it("does nothing if the URL is already pretty", () => {
    const loc = { pathname: "/cronos/protocol/tectonic/" };
    const historyImpl = { replaceState: vi.fn() };
    restorePrettyProtocolUrl("tectonic", loc, historyImpl);
    expect(historyImpl.replaceState).not.toHaveBeenCalled();
  });
});
