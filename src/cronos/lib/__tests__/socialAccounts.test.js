import { describe, it, expect } from "vitest";
import { SOCIAL_ACCOUNTS, FEATURED_ACCOUNT, isConfigured } from "../socialAccounts.js";

describe("SOCIAL_ACCOUNTS", () => {
  it("every entry has a stable id, label and description", () => {
    for (const account of SOCIAL_ACCOUNTS) {
      expect(typeof account.id).toBe("string");
      expect(account.id.length).toBeGreaterThan(0);
      expect(typeof account.label).toBe("string");
      expect(typeof account.description).toBe("string");
    }
  });

  it("ids are unique", () => {
    const ids = SOCIAL_ACCOUNTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("configured entries have a matching x.com url for their handle", () => {
    for (const account of SOCIAL_ACCOUNTS.filter(isConfigured)) {
      expect(account.url).toBe(`https://x.com/${account.handle}`);
    }
  });

  it("unconfigured entries have handle: null and never a url", () => {
    for (const account of SOCIAL_ACCOUNTS.filter((a) => !isConfigured(a))) {
      expect(account.handle).toBeNull();
      expect(account.url).toBeUndefined();
    }
  });

  it("has exactly one featured account, and it is configured", () => {
    const featured = SOCIAL_ACCOUNTS.filter((a) => a.featured);
    expect(featured).toHaveLength(1);
    expect(isConfigured(featured[0])).toBe(true);
  });
});

describe("FEATURED_ACCOUNT", () => {
  it("matches the entry flagged featured: true", () => {
    expect(FEATURED_ACCOUNT.featured).toBe(true);
  });
});

describe("isConfigured", () => {
  it("is true only for a non-empty string handle", () => {
    expect(isConfigured({ handle: "abc" })).toBe(true);
    expect(isConfigured({ handle: null })).toBe(false);
    expect(isConfigured({ handle: "" })).toBe(false);
    expect(isConfigured({})).toBe(false);
    expect(isConfigured(null)).toBe(false);
  });
});
