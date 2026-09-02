// Small pulsing dot + "last updated" timestamp shown once live data has
// loaded. The pulse itself is a pure-CSS animation (see .cronos-pulse-live)
// so it costs nothing in JS and is fully disabled by prefers-reduced-motion.
export default function LiveIndicator({ lastUpdated }) {
  if (!lastUpdated) return null;
  return (
    <span className="cronos-pulse-live">
      <span className="cronos-pulse-live-dot" />
      Live · updated {lastUpdated.toLocaleTimeString()}
    </span>
  );
}
