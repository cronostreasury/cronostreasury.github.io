import { useState, useEffect, useRef } from "react";

// ── Simulated live data (replace with real RPC/API calls) ──────────────────
const MOCK_VAULT = [
  { symbol: "BTC",  name: "Bitcoin",        amount: 1.42,     price: 83200,   color: "#F7931A" },
  { symbol: "ETH",  name: "Ethereum",       amount: 14.7,     price: 2180,    color: "#627EEA" },
  { symbol: "LCRO", name: "Liquid CRO",     amount: 88400,    price: 0.094,   color: "#002D74" },
  { symbol: "USDC", name: "USD Coin",       amount: 24800,    price: 1.0,     color: "#2775CA" },
  { symbol: "PACK", name: "Pack Token",     amount: 312000,   price: 0.0072,  color: "#E94040" },
];

const MOCK_CTR = {
  price: 0.00418,
  marketCap: 2_190_000,
  totalSupply: 1_000_000_000,
  circulatingSupply: 524_000_000,
  totalBurned: 47_800_000,
};

const generateBuybackEvents = () => {
  const events = [];
  let cumBurned = 0;
  const now = Date.now();
  for (let i = 19; i >= 0; i--) {
    const bought = Math.floor(Math.random() * 900_000 + 100_000);
    const burned = Math.floor(bought * (0.85 + Math.random() * 0.1));
    cumBurned += burned;
    events.push({
      id: i,
      ts: new Date(now - i * 7_200_000 - Math.random() * 3_600_000),
      bought,
      burned,
      txHash: "0x" + [...Array(64)].map(() => Math.floor(Math.random()*16).toString(16)).join(""),
      cumBurned,
    });
  }
  return events.reverse();
};

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n, dec = 2) => n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtCompact = (n) => n >= 1e6 ? `${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : n.toFixed(0);
const truncHash = (h) => `${h.slice(0,8)}…${h.slice(-6)}`;
const timeAgo = (ts) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
};

// ── Mini Pie Chart (pure SVG) ──────────────────────────────────────────────
function PieChart({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  let angle = -Math.PI / 2;
  const slices = data.map(d => {
    const sweep = (d.value / total) * 2 * Math.PI;
    const x1 = 50 + 44 * Math.cos(angle);
    const y1 = 50 + 44 * Math.sin(angle);
    angle += sweep;
    const x2 = 50 + 44 * Math.cos(angle);
    const y2 = 50 + 44 * Math.sin(angle);
    const lg = sweep > Math.PI ? 1 : 0;
    return { ...d, d: `M50,50 L${x1},${y1} A44,44 0 ${lg},1 ${x2},${y2} Z` };
  });
  return (
    <svg viewBox="0 0 100 100" style={{ width: "100%", maxWidth: 240 }}>
      {slices.map((s, i) => (
        <path key={i} d={s.d} fill={s.color} stroke="#0a0e1a" strokeWidth="1.5">
          <title>{s.symbol}: ${fmt(s.value)}</title>
        </path>
      ))}
      <circle cx="50" cy="50" r="26" fill="#0a0e1a" />
      <text x="50" y="47" textAnchor="middle" fill="#e2e8f0" fontSize="6" fontFamily="'DM Mono', monospace" fontWeight="bold">VAULT</text>
      <text x="50" y="55" textAnchor="middle" fill="#64ffda" fontSize="5" fontFamily="'DM Mono', monospace">TVL</text>
    </svg>
  );
}

// ── Animated counter hook ──────────────────────────────────────────────────
function useCounter(target, duration = 1200) {
  const [val, setVal] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current;
    const diff = target - start;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(start + diff * ease);
      if (p < 1) requestAnimationFrame(tick);
      else prev.current = target;
    };
    requestAnimationFrame(tick);
  }, [target]);
  return val;
}

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent = "#64ffda", icon }) {
  return (
    <div style={{
      background: "linear-gradient(135deg,#0d1226 0%,#111827 100%)",
      border: `1px solid ${accent}22`,
      borderRadius: 12,
      padding: "20px 24px",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, right: 0, width: 80, height: 80,
        background: `radial-gradient(circle at top right, ${accent}18, transparent 70%)`,
      }} />
      <div style={{ fontSize: 11, letterSpacing: "0.12em", color: "#64748b", textTransform: "uppercase", marginBottom: 6, fontFamily: "'DM Mono', monospace" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: "#f1f5f9", fontFamily: "'Syne', sans-serif", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: accent, marginTop: 4, fontFamily: "'DM Mono', monospace" }}>{sub}</div>}
    </div>
  );
}

// ── Burn progress bar ──────────────────────────────────────────────────────
function BurnBar({ pct }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", fontFamily: "'DM Mono', monospace", marginBottom: 4 }}>
        <span>Burned</span><span style={{ color: "#ff6b6b" }}>{pct.toFixed(2)}%</span>
      </div>
      <div style={{ background: "#1e293b", borderRadius: 99, height: 6, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: "linear-gradient(90deg,#ff6b6b,#ff9a3c)", borderRadius: 99, transition: "width 1s ease" }} />
      </div>
    </div>
  );
}

// ── Buyback Event Row ──────────────────────────────────────────────────────
function BuybackRow({ e, isNew }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1.2fr 1.2fr 1.4fr",
      gap: 8,
      padding: "14px 20px",
      borderBottom: "1px solid #1e293b",
      alignItems: "center",
      background: isNew ? "#64ffda0a" : "transparent",
      transition: "background 2s ease",
    }}>
      <div>
        <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>{timeAgo(e.ts)}</div>
        <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{e.ts.toLocaleTimeString()}</div>
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace" }}>
        <div style={{ fontSize: 13, color: "#64ffda", fontWeight: 600 }}>+{fmtCompact(e.bought)}</div>
        <div style={{ fontSize: 10, color: "#475569" }}>CTR bought</div>
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace" }}>
        <div style={{ fontSize: 13, color: "#ff6b6b", fontWeight: 600 }}>🔥 {fmtCompact(e.burned)}</div>
        <div style={{ fontSize: 10, color: "#475569" }}>CTR burned</div>
      </div>
      <a
        href={`https://explorer.cronos.org/tx/${e.txHash}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: 11, color: "#7c3aed", fontFamily: "'DM Mono', monospace", textDecoration: "none", wordBreak: "break-all" }}
        title={e.txHash}
      >
        {truncHash(e.txHash)} ↗
      </a>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function CTRDashboard() {
  const [events, setEvents] = useState(() => generateBuybackEvents());
  const [newIds, setNewIds] = useState(new Set());
  const [vaultData] = useState(MOCK_VAULT);
  const [ctr] = useState(MOCK_CTR);
  const [tick, setTick] = useState(0);

  const vaultTotal = vaultData.reduce((s, t) => s + t.amount * t.price, 0);
  const animVault = useCounter(vaultTotal);
  const burnPct = (ctr.totalBurned / ctr.totalSupply) * 100;

  // Simulate new buyback events every 25s
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
      const bought = Math.floor(Math.random() * 900_000 + 100_000);
      const burned = Math.floor(bought * 0.9);
      const newEvent = {
        id: Date.now(),
        ts: new Date(),
        bought, burned,
        txHash: "0x" + [...Array(64)].map(() => Math.floor(Math.random()*16).toString(16)).join(""),
        cumBurned: 0,
      };
      setEvents(prev => [newEvent, ...prev.slice(0, 19)]);
      setNewIds(s => { const n = new Set(s); n.add(newEvent.id); return n; });
      setTimeout(() => setNewIds(s => { const n = new Set(s); n.delete(newEvent.id); return n; }), 4000);
    }, 25000);
    return () => clearInterval(interval);
  }, []);

  const pieData = vaultData.map(t => ({ symbol: t.symbol, value: t.amount * t.price, color: t.color }));

  return (
    <div style={{
      minHeight: "100vh",
      background: "#050812",
      color: "#e2e8f0",
      fontFamily: "'DM Sans', sans-serif",
      padding: "0 0 60px",
    }}>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; background: #0a0e1a; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes slideIn { from{transform:translateY(-12px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes glow { 0%,100%{box-shadow:0 0 8px #64ffda44} 50%{box-shadow:0 0 22px #64ffda88} }
        .live-dot { animation: pulse 2s infinite; }
        .new-event { animation: slideIn .4s ease; }
        .glow-card { animation: glow 3s infinite; }
      `}</style>

      {/* ── Header ── */}
      <header style={{
        borderBottom: "1px solid #1e293b",
        background: "linear-gradient(180deg,#0a0e1a 0%,#050812 100%)",
        padding: "0 16px 60px",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 38, height: 38, borderRadius: "50%",
              background: "linear-gradient(135deg,#64ffda,#7c3aed)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 800, color: "#0a0e1a", fontFamily: "'Syne',sans-serif",
            }}>CTR</div>
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 17, letterSpacing: "0.02em" }}>
                Cronos Treasury Reserve
              </div>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase" }}>CTR · Cronos EVM</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Mono',monospace" }}>
              <span style={{ color: "#64ffda" }}>${fmt(ctr.price, 5)}</span> CTR
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 99, padding: "5px 12px" }}>
              <span className="live-dot" style={{ width: 7, height: 7, background: "#64ffda", borderRadius: "50%", display: "inline-block" }} />
              <span style={{ fontSize: 11, color: "#64ffda", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em" }}>LIVE</span>
            </div>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "36px 16px 0" }}>

        {/* ── Top stats row ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 36 }}>
          <StatCard label="CTR Price" value={`$${fmt(ctr.price, 5)}`} sub="+4.2% (24h)" accent="#64ffda" />
          <StatCard label="Market Cap" value={`$${fmtCompact(ctr.marketCap)}`} sub="Fully diluted: $4.18M" accent="#7c3aed" />
          <StatCard label="Circulating Supply" value={fmtCompact(ctr.circulatingSupply)} sub={`of ${fmtCompact(ctr.totalSupply)} total`} accent="#f59e0b" />
          <StatCard label="Total CTR Burned" value={fmtCompact(ctr.totalBurned)} sub={<BurnBar pct={burnPct} />} accent="#ff6b6b" />
          <StatCard label="Vault TVL" value={`$${fmtCompact(animVault)}`} sub="↑ 2.1% this week" accent="#64ffda" />
        </div>

        {/* ── Main grid ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>

          {/* Vault Composition */}
          <div style={{ background: "#0d1226", border: "1px solid #1e293b", borderRadius: 16, padding: 28, gridRow: "span 1" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18 }}>Vault Composition</h2>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>Treasury asset allocation</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#64ffda", fontFamily: "'DM Mono',monospace" }}>
                ${fmtCompact(vaultTotal)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
              <div style={{ flex: "0 0 160px" }}><PieChart data={pieData} /></div>
              <div style={{ flex: 1 }}>
                {vaultData.map(t => {
                  const val = t.amount * t.price;
                  const pct = (val / vaultTotal * 100).toFixed(1);
                  return (
                    <div key={t.symbol} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 13, color: "#cbd5e1" }}>{t.symbol}</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Mono',monospace", marginRight: 8 }}>{fmtCompact(t.amount)}</div>
                      <div style={{ fontSize: 12, color: "#64ffda", fontFamily: "'DM Mono',monospace", width: 60, textAlign: "right" }}>${fmtCompact(val)}</div>
                      <div style={{ fontSize: 10, color: "#475569", width: 36, textAlign: "right" }}>{pct}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Burn Stats */}
          <div style={{ background: "#0d1226", border: "1px solid #1e293b", borderRadius: 16, padding: 28 }}>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 6 }}>Burn Analytics</h2>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 24 }}>Cumulative supply reduction</div>

            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{
                width: 160, height: 160, borderRadius: "50%", margin: "0 auto",
                background: `conic-gradient(#ff6b6b 0deg, #ff9a3c ${burnPct * 3.6}deg, #1e293b ${burnPct * 3.6}deg)`,
                display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
              }}>
                <div style={{ width: 120, height: 120, borderRadius: "50%", background: "#0d1226", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Syne',sans-serif", color: "#ff6b6b" }}>{burnPct.toFixed(1)}%</div>
                  <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em" }}>BURNED</div>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
              {[
                { label: "Total Burned", val: fmtCompact(ctr.totalBurned) + " CTR", c: "#ff6b6b" },
                { label: "Remaining Supply", val: fmtCompact(ctr.circulatingSupply - ctr.totalBurned) + " CTR", c: "#64ffda" },
                { label: "Burn Rate (7d avg)", val: "~2.1M CTR/week", c: "#f59e0b" },
                { label: "Est. Deflation", val: "−4.8% /month", c: "#7c3aed" },
              ].map(s => (
                <div key={s.label} style={{ background: "#111827", borderRadius: 10, padding: "12px 16px" }}>
                  <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: s.c, fontFamily: "'DM Mono',monospace" }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Vault Table ── */}
        <div style={{ background: "#0d1226", border: "1px solid #1e293b", borderRadius: 16, marginBottom: 24, overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18 }}>Treasury Holdings</h2>
            <div style={{ fontSize: 11, color: "#475569", fontFamily: "'DM Mono',monospace" }}>Updated: {new Date().toLocaleTimeString()}</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#111827" }}>
                  {["Asset","Token","Balance","Price","USD Value","Allocation","Change (24h)"].map(h => (
                    <th key={h} style={{ padding: "12px 20px", fontSize: 10, color: "#475569", textAlign: "left", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vaultData.map((t, i) => {
                  const val = t.amount * t.price;
                  const pct = (val / vaultTotal * 100).toFixed(1);
                  const change = (Math.random() * 8 - 4).toFixed(2);
                  return (
                    <tr key={t.symbol} style={{ borderBottom: "1px solid #1e293b", transition: "background .2s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#111827"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: t.color + "22", border: `2px solid ${t.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: t.color }}>{t.symbol[0]}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                          <div style={{ fontSize: 11, color: "#475569" }}>{t.symbol}</div>
                        </div>
                      </td>
                      <td style={{ padding: "14px 20px", fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#7c3aed" }}>{t.symbol}</td>
                      <td style={{ padding: "14px 20px", fontFamily: "'DM Mono',monospace", fontSize: 13, color: "#e2e8f0" }}>{fmtCompact(t.amount)}</td>
                      <td style={{ padding: "14px 20px", fontFamily: "'DM Mono',monospace", fontSize: 13, color: "#94a3b8" }}>${fmt(t.price, t.price < 1 ? 4 : 2)}</td>
                      <td style={{ padding: "14px 20px", fontFamily: "'DM Mono',monospace", fontSize: 13, color: "#64ffda", fontWeight: 600 }}>${fmtCompact(val)}</td>
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, background: "#1e293b", borderRadius: 99, height: 5, overflow: "hidden", minWidth: 80 }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: t.color, borderRadius: 99 }} />
                          </div>
                          <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Mono',monospace" }}>{pct}%</span>
                        </div>
                      </td>
                      <td style={{ padding: "14px 20px", fontFamily: "'DM Mono',monospace", fontSize: 13, color: +change > 0 ? "#64ffda" : "#ff6b6b" }}>
                        {+change > 0 ? "▲" : "▼"} {Math.abs(change)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Buyback & Burn Feed ── */}
        <div style={{ background: "#0d1226", border: "1px solid #1e293b", borderRadius: 16, marginBottom: 24, overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18 }}>Buyback & Burn Activity</h2>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>Real-time on-chain events · Cronos EVM</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#ff6b6b12", border: "1px solid #ff6b6b33", borderRadius: 99, padding: "5px 14px" }}>
              <span style={{ fontSize: 14 }}>🔥</span>
              <span style={{ fontSize: 12, color: "#ff6b6b", fontFamily: "'DM Mono',monospace" }}>Streaming live</span>
            </div>
          </div>
          <div style={{ padding: "0 20px 8px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1.2fr 1.4fr", gap: 8, padding: "10px 0", borderBottom: "1px solid #1e293b" }}>
              {["Time","Bought Back","Burned","Tx Hash"].map(h => (
                <div key={h} style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono',monospace" }}>{h}</div>
              ))}
            </div>
            {events.map(e => (
              <div key={e.id} className={newIds.has(e.id) ? "new-event" : ""}>
                <BuybackRow e={e} isNew={newIds.has(e.id)} />
              </div>
            ))}
          </div>
        </div>

        {/* ── How It Works ── */}
        <div style={{ background: "#0d1226", border: "1px solid #1e293b", borderRadius: 16, padding: 32, marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 8 }}>How the CTR Protocol Works</h2>
          <p style={{ color: "#64748b", fontSize: 13, marginBottom: 32, maxWidth: 600 }}>A transparent, deflationary treasury protocol on Cronos EVM designed to reward long-term holders.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 20 }}>
            {[
              { icon: "💰", title: "Treasury Growth", color: "#64ffda", text: "Protocol fees and yield from vault assets continuously compound the treasury, increasing the backing per CTR token over time." },
              { icon: "🔄", title: "Buyback Mechanism", color: "#7c3aed", text: "A portion of treasury yield is used to buy CTR on the open market. This creates consistent buy pressure, supporting the token price." },
              { icon: "🔥", title: "Burn & Deflation", color: "#ff6b6b", text: "Bought-back CTR is permanently burned, reducing circulating supply. Fewer tokens + same or growing treasury = higher backing per token." },
              { icon: "📊", title: "Transparency", color: "#f59e0b", text: "All buyback and burn transactions are on-chain on Cronos EVM and verifiable on the block explorer in real time." },
            ].map(s => (
              <div key={s.title} style={{ background: "#111827", borderRadius: 12, padding: 20, borderLeft: `3px solid ${s.color}` }}>
                <div style={{ fontSize: 24, marginBottom: 10 }}>{s.icon}</div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 8, color: s.color }}>{s.title}</div>
                <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>{s.text}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ textAlign: "center", padding: "20px 0", borderTop: "1px solid #1e293b" }}>
          <div style={{ fontSize: 11, color: "#334155", fontFamily: "'DM Mono',monospace" }}>
            CTR · Cronos Treasury Reserve · All data is on-chain and publicly verifiable ·{" "}
            <a href="https://explorer.cronos.org" target="_blank" rel="noopener noreferrer" style={{ color: "#475569", textDecoration: "none" }}>Cronos Explorer ↗</a>
          </div>
        </div>
      </div>
    </div>
  );
}
