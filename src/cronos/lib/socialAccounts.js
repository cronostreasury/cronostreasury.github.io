// Central, hand-curated list of X (Twitter) accounts embedded on
// /cronos/social/ and the Overview's Social Pulse section.
//
// Every `handle` below was verified through X's own official public oEmbed
// endpoint — the same lookup the official embed-code generator uses, and
// the sanctioned way to confirm an account is embeddable without the X API
// or scraping:
//
//   curl "https://publish.twitter.com/oembed?url=https://twitter.com/<handle>"
//
// A handle only goes in this list if that call returned a valid oEmbed
// JSON payload (verified 2026-09-02). Handles we could NOT verify this way
// are deliberately left out — see the `cronos-community` entry below for
// how an unverified slot is represented instead of guessing.
export const SOCIAL_ACCOUNTS = [
  {
    id: "cronos-treasury",
    handle: "CronosTreasury",
    url: "https://x.com/CronosTreasury",
    label: "Cronos Treasury Reserve",
    description: "This project's own account — treasury updates, burns and announcements.",
    featured: true,
  },
  {
    id: "cronos-chain",
    handle: "CronosChain",
    url: "https://x.com/CronosChain",
    label: "Cronos",
    description: "Official account for the Cronos blockchain.",
  },
  {
    id: "crypto-com",
    handle: "cryptocom",
    url: "https://x.com/cryptocom",
    label: "Crypto.com",
    description: "Crypto.com, the exchange behind the Cronos chain.",
  },
  {
    id: "defillama",
    handle: "DefiLlama",
    url: "https://x.com/DefiLlama",
    label: "DeFiLlama",
    description: "Source of every live TVL and protocol figure shown across this dashboard.",
  },
  {
    id: "cronos-community",
    handle: null,
    label: "Cronos (community)",
    description:
      "No officially verifiable handle found for this slot — tried cronos_org, cronos_chain and CDC_Cronos, none resolved via the oEmbed check. Set `handle` here once a real one is confirmed the same way.",
  },
];

export const FEATURED_ACCOUNT = SOCIAL_ACCOUNTS.find((a) => a.featured) || SOCIAL_ACCOUNTS[0];

export function isConfigured(account) {
  return typeof account?.handle === "string" && account.handle.length > 0;
}
