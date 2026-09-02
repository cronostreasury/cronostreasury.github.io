import { useEffect, useRef, useState } from "react";
import { loadTwitterWidgets } from "../lib/twitterWidgets.js";
import Shimmer from "./Shimmer.jsx";

const LOAD_TIMEOUT_MS = 10000;

// Renders X's official `twitter-timeline` embed (blockquote/anchor +
// widgets.js) for one account. Never fetches or fabricates tweet content
// itself — everything shown comes from X's own iframe. If the script
// fails, times out, or produces no widget (e.g. blocked by a tracker/ad
// blocker), a clear error state with a direct link to the profile is
// shown instead of any placeholder tweet content.
export default function TwitterTimelineEmbed({ handle, url, height = 480, tweetLimit }) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | loaded | error | timeout

  useEffect(() => {
    if (!handle || !url) return undefined;
    let cancelled = false;
    // Status starts at "loading" from useState above; callers that swap
    // which account a mounted embed points to should pass a new `key` so
    // this effect's [handle, url] change comes with a fresh mount instead
    // of reusing stale status/DOM (see SocialPage's featured panel).

    const timeoutId = setTimeout(() => {
      if (!cancelled) setStatus((s) => (s === "loading" ? "timeout" : s));
    }, LOAD_TIMEOUT_MS);

    loadTwitterWidgets()
      .then((twttr) => {
        if (cancelled || !containerRef.current || !twttr?.widgets) return null;
        return twttr.widgets.load(containerRef.current);
      })
      .then((widgets) => {
        if (cancelled) return;
        if (Array.isArray(widgets) && widgets.length > 0) {
          setStatus("loaded");
        } else if (widgets === null) {
          // component unmounted / container gone before widgets.js ran
        } else {
          // widgets.js ran but created nothing — invalid handle or blocked.
          setStatus("timeout");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [handle, url]);

  if (!handle || !url) {
    return (
      <div className="cronos-x-embed cronos-x-embed--unconfigured">
        <p className="cronos-x-embed-configure">Account not configured — see src/cronos/lib/socialAccounts.js.</p>
      </div>
    );
  }

  const showFallback = status === "error" || status === "timeout";

  return (
    <div className="cronos-x-embed" data-status={status}>
      {status === "loading" && (
        <div className="cronos-x-embed-shimmer" style={{ height }}>
          <Shimmer height="100%" />
        </div>
      )}
      <div
        ref={containerRef}
        className="cronos-x-embed-frame"
        style={{ display: status === "loaded" ? "block" : "none" }}
      >
        <a
          className="twitter-timeline"
          data-theme="dark"
          data-chrome="noheader nofooter noborders transparent"
          data-height={height}
          {...(tweetLimit ? { "data-tweet-limit": tweetLimit } : {})}
          href={`${url}?ref_src=twsrc%5Etfw`}
        >
          Posts by @{handle}
        </a>
      </div>
      {showFallback && (
        <div className="cronos-x-embed-fallback" role="alert">
          <p>
            Live embed from X {status === "timeout" ? "didn't load in time" : "failed to load"} — it may be blocked by a
            browser privacy or tracker setting.
          </p>
          <a href={url} target="_blank" rel="noopener noreferrer">
            Open @{handle} on X ↗
          </a>
        </div>
      )}
    </div>
  );
}
