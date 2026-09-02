import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadTwitterWidgets, WIDGETS_SRC, _resetForTests } from "../twitterWidgets.js";

describe("loadTwitterWidgets", () => {
  beforeEach(() => {
    _resetForTests();
    delete window.twttr;
    document.querySelectorAll(`script[src="${WIDGETS_SRC}"]`).forEach((el) => el.remove());
  });

  afterEach(() => {
    _resetForTests();
    delete window.twttr;
    document.querySelectorAll(`script[src="${WIDGETS_SRC}"]`).forEach((el) => el.remove());
  });

  it("resolves immediately if window.twttr.widgets already exists", async () => {
    window.twttr = { widgets: {} };
    await expect(loadTwitterWidgets()).resolves.toBe(window.twttr);
  });

  it("injects exactly one script tag even across concurrent calls", async () => {
    const p1 = loadTwitterWidgets();
    const p2 = loadTwitterWidgets();
    expect(document.querySelectorAll(`script[src="${WIDGETS_SRC}"]`)).toHaveLength(1);

    const script = document.querySelector(`script[src="${WIDGETS_SRC}"]`);
    window.twttr = { widgets: {} };
    script.onload();

    await expect(p1).resolves.toBe(window.twttr);
    await expect(p2).resolves.toBe(window.twttr);
  });

  it("rejects when the script fails to load", async () => {
    const promise = loadTwitterWidgets();
    const script = document.querySelector(`script[src="${WIDGETS_SRC}"]`);
    script.onerror(new Event("error"));
    await expect(promise).rejects.toThrow(/failed to load/);
  });

  it("allows a retry after a failed load instead of caching the rejection forever", async () => {
    const first = loadTwitterWidgets();
    const script = document.querySelector(`script[src="${WIDGETS_SRC}"]`);
    script.onerror(new Event("error"));
    await expect(first).rejects.toThrow();

    // A fresh attempt should inject a new script rather than reuse the failed promise.
    document.querySelectorAll(`script[src="${WIDGETS_SRC}"]`).forEach((el) => el.remove());
    const second = loadTwitterWidgets();
    window.twttr = { widgets: {} };
    document.querySelector(`script[src="${WIDGETS_SRC}"]`).onload();
    await expect(second).resolves.toBe(window.twttr);
  });

  it("does not fabricate a widgets object — resolves with whatever window.twttr actually is", async () => {
    const promise = loadTwitterWidgets();
    const script = document.querySelector(`script[src="${WIDGETS_SRC}"]`);
    window.twttr = { widgets: { load: vi.fn() } };
    script.onload();
    const twttr = await promise;
    expect(twttr).toBe(window.twttr);
    expect(typeof twttr.widgets.load).toBe("function");
  });
});
