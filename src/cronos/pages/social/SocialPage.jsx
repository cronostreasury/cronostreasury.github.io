import { useState } from "react";
import Layout from "../../components/Layout.jsx";
import TwitterTimelineEmbed from "../../components/TwitterTimelineEmbed.jsx";
import SocialAccountCard from "../../components/SocialAccountCard.jsx";
import { SOCIAL_ACCOUNTS, FEATURED_ACCOUNT, isConfigured } from "../../lib/socialAccounts.js";

export default function SocialPage() {
  const [featured, setFeatured] = useState(FEATURED_ACCOUNT);
  const configuredAccounts = SOCIAL_ACCOUNTS.filter(isConfigured);

  return (
    <Layout
      active="social"
      title="Cronos Social Pulse"
      subtitle="Live X (Twitter) timelines for the Cronos ecosystem, embedded directly via X's official widgets.js — no API, no scraping, nothing simulated. If X blocks the embed in your browser, you'll see a direct link instead of fake content."
    >
      <section className="cronos-section">
        <div className="cronos-toolbar">
          <span className="cronos-toolbar-live">Featured:</span>
          {configuredAccounts.map((account) => (
            <button
              key={account.id}
              type="button"
              className="cronos-chip"
              aria-pressed={featured.id === account.id}
              onClick={() => setFeatured(account)}
            >
              {account.label}
            </button>
          ))}
        </div>

        <div className="cronos-card cronos-x-featured">
          <div className="cronos-card-head">
            <div>
              <span className="cronos-card-label">{featured.label}</span>
              <div className="cronos-x-handle">@{featured.handle}</div>
            </div>
            <a className="cronos-back" style={{ margin: 0 }} href={featured.url} target="_blank" rel="noopener noreferrer">
              Open on X ↗
            </a>
          </div>
          <p className="cronos-x-desc">{featured.description}</p>
          <TwitterTimelineEmbed key={featured.id} handle={featured.handle} url={featured.url} height={640} />
        </div>
      </section>

      <section className="cronos-section">
        <h2>All accounts</h2>
        <p className="cronos-section-desc">
          {configuredAccounts.length} live, verified account{configuredAccounts.length === 1 ? "" : "s"} · {SOCIAL_ACCOUNTS.length - configuredAccounts.length} not
          yet configured
        </p>
        <div className="cronos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          {SOCIAL_ACCOUNTS.map((account) => (
            <SocialAccountCard
              key={account.id}
              account={account}
              height={360}
              active={featured.id === account.id}
              onFeature={setFeatured}
            />
          ))}
        </div>
      </section>
    </Layout>
  );
}
