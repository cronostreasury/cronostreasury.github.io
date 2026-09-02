import TwitterTimelineEmbed from "./TwitterTimelineEmbed.jsx";
import DataQualityBadge from "./DataQualityBadge.jsx";
import { isConfigured } from "../lib/socialAccounts.js";

// One account slot: label/description + either a live X embed or an
// honest "not configured" state. Never renders placeholder tweet content.
export default function SocialAccountCard({ account, height = 360, active, onFeature }) {
  const configured = isConfigured(account);
  return (
    <div className={`cronos-card cronos-x-card${active ? " cronos-x-card--active" : ""}`}>
      <div className="cronos-card-head">
        <div>
          <span className="cronos-card-label">{account.label}</span>
          {configured && <div className="cronos-x-handle">@{account.handle}</div>}
        </div>
        <DataQualityBadge status={configured ? "live" : "unavailable"} />
      </div>
      <p className="cronos-x-desc">{account.description}</p>
      <TwitterTimelineEmbed handle={account.handle} url={account.url} height={height} />
      {configured && onFeature && (
        <button type="button" className="cronos-chip cronos-x-feature-btn" aria-pressed={active} onClick={() => onFeature(account)}>
          {active ? "★ Featured above" : "Feature this account"}
        </button>
      )}
    </div>
  );
}
