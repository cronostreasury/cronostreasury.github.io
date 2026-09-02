import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SocialPage from "../SocialPage.jsx";
import { loadTwitterWidgets } from "../../../lib/twitterWidgets.js";
import { SOCIAL_ACCOUNTS, FEATURED_ACCOUNT } from "../../../lib/socialAccounts.js";

vi.mock("../../../lib/twitterWidgets.js", () => ({
  loadTwitterWidgets: vi.fn(),
}));

describe("SocialPage", () => {
  beforeEach(() => {
    loadTwitterWidgets.mockReturnValue(new Promise(() => {}));
  });

  it("features the configured featured account by default", () => {
    render(<SocialPage />);
    expect(screen.getAllByText(`@${FEATURED_ACCOUNT.handle}`).length).toBeGreaterThan(0);
  });

  it("renders one card for every configured account plus the unconfigured slot", () => {
    render(<SocialPage />);
    for (const account of SOCIAL_ACCOUNTS) {
      expect(screen.getAllByText(account.label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/not configured/i)).toBeInTheDocument();
  });

  it("never renders a handle for the unconfigured account", () => {
    render(<SocialPage />);
    const unconfigured = SOCIAL_ACCOUNTS.find((a) => a.handle === null);
    expect(screen.queryByText(`@${unconfigured.handle}`)).not.toBeInTheDocument();
  });

  it("switching the featured chip updates the featured embed's handle", () => {
    render(<SocialPage />);

    const other = SOCIAL_ACCOUNTS.find((a) => a.handle && a.id !== FEATURED_ACCOUNT.id);
    const chip = screen.getByRole("button", { name: other.label, pressed: false });
    fireEvent.click(chip);

    expect(screen.getByRole("button", { name: other.label })).toHaveAttribute("aria-pressed", "true");
    // The large featured panel's handle line should now show the newly selected account.
    const handleEls = screen.getAllByText(`@${other.handle}`);
    expect(handleEls.length).toBeGreaterThan(0);
  });

  it("only configured accounts get a 'Feature this account' chip in the grid", () => {
    render(<SocialPage />);
    const buttons = screen.getAllByRole("button", { name: /feature this account|featured above/i });
    const configuredCount = SOCIAL_ACCOUNTS.filter((a) => a.handle).length;
    expect(buttons).toHaveLength(configuredCount);
  });
});
