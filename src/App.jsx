import { useState, useEffect, useRef } from "react";

const MOCK_VAULT = [
  { symbol: "BTC",  name: "Bitcoin",    amount: 1.42,   price: 83200,  color: "#F7931A" },
  { symbol: "ETH",  name: "Ethereum",   amount: 14.7,   price: 2180,   color: "#627EEA" },
  { symbol: "LCRO", name: "Liquid CRO", amount: 88400,  price: 0.094,  color: "#4A90D9" },
  { symbol: "USDC", name: "USD Coin",   amount: 24800,  price: 1.0,    color: "#2775CA" },
  { symbol: "PACK", name: "Pack Token", amount: 312000, price: 0.0072, color: "#E94040" },
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
  const now = Date.now();
  for (let i = 19; i >= 0; i--) {
    const bought = Math.floor(Math.random() * 900_000 + 100_000);
    const burned = Math.floor(bought * (0.85 + Math.random() * 0.1));
    events.push({
      id: i,
      ts: new Date(now - i * 7_200_000 - Math.random() * 3_600_000),
      bought, burned,
      txHash: "0x" + [...Array(64)].map(() => Math.floor(Math.random()*16).toString(16)).join(""),
    });
  }
  return events.reverse();
};

const fmt = (n, dec = 2) => n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtCompact = (n) => n >= 1e6 ? `${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : n.toFixed(0);
const truncHash = (h) => `${h.slice(0,6)}…${h.slice(-4)}`;
const timeAgo = (ts) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
};

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
    <svg viewBox="0 0 100 100" style={{ width: "100%", maxWidth: 180, display: "block", margin: "0 auto" }}>
      {slices.map((s, i) => (
        <path key={i} d={s.d} fill={s.color} stroke="#0a0e1a" strokeWidth="1.5" />
      ))}
      <circle cx="50" cy="50" r="28" fill="#0a0e1a" />
      <text x="50" y="47" textAnchor="middle" fill="#e2e8f0" fontSize="6" fontFamily="monospace" fontWeight="bold">VAULT</text>
      <text x="50" y="55" textAnchor="middle" fill="#64ffda" fontSize="5" fontFamily="monospace">TVL</text>
    </svg>
  );
}

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

export default function CTRDashboard() {
  const [events, setEvents] = useState(() => generateBuybackEvents());
  const [newIds, setNewIds] = useState(new Set());
  const vaultData = MOCK_VAULT;
  const ctr = MOCK_CTR;
  const vaultTotal = vaultData.reduce((s, t) => s + t.amount * t.price, 0);
  const animVault = useCounter(vaultTotal);
  const burnPct = (ctr.totalBurned / ctr.totalSupply) * 100;
  const pieData = vaultData.map(t => ({ symbol: t.symbol, value: t.amount * t.price, color: t.color }));

  useEffect(() => {
    const interval = setInterval(() => {
      const bought = Math.floor(Math.random() * 900_000 + 100_000);
      const burned = Math.floor(bought * 0.9);
      const newEvent = {
        id: Date.now(),
        ts: new Date(),
        bought, burned,
        txHash: "0x" + [...Array(64)].map(() => Math.floor(Math.random()*16).toString(16)).join(""),
      };
      setEvents(prev => [newEvent, ...prev.slice(0, 19)]);
      setNewIds(s => { const n = new Set(s); n.add(newEvent.id); return n; });
      setTimeout(() => setNewIds(s => { const n = new Set(s); n.delete(newEvent.id); return n; }), 4000);
    }, 25000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#050812", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow-x: hidden; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes slideIn { from{transform:translateY(-8px);opacity:0} to{transform:translateY(0);opacity:1} }
        .live-dot { animation: pulse 2s infinite; }
        .new-row { animation: slideIn .4s ease; }
        .stat-card { background: linear-gradient(135deg,#0d1226,#111827); border: 1px solid #1e293b; border-radius: 12px; padding: 16px 20px; }
        .section-card { background: #0d1226; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; margin-bottom: 16px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 700px) { .grid-2 { grid-template-columns: 1fr; } }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 16px; }
        .how-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
        .holdings-table { width: 100%; border-collapse: collapse; }
        .holdings-table th { padding: 10px 16px; font-size: 10px; color: #475569; text-align: left; letter-spacing: .1em; text-transform: uppercase; background: #111827; font-weight: 500; }
        .holdings-table td { padding: 12px 16px; border-bottom: 1px solid #1e293b; font-size: 13px; }
        .holdings-table tr:last-child td { border-bottom: none; }
        .feed-row { display: grid; grid-template-columns: 1fr 1fr 1fr 1.2fr; gap: 8px; padding: 12px 16px; border-bottom: 1px solid #1e293b; align-items: center; font-size: 12px; }
        @media (max-width: 500px) { .feed-row { grid-template-columns: 1fr 1fr; } .feed-row .tx-col { display: none; } }
        ::-webkit-scrollbar { width: 4px; background: #0a0e1a; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <header style={{ borderBottom: "1px solid #1e293b", background: "#0a0e1a", padding: "0 16px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <img src="/cronostreasury.github.io/Logo1.jpg" alt="CTR Logo" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Cronos Treasury Reserve</div>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: ".08em" }}>CTR · CRONOS EVM</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <a href="https://x.com/CronosTreasury" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 99, padding: "4px 10px", textDecoration: "none" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#e2e8f0"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.741l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              <span style={{ fontSize: 10, color: "#e2e8f0", fontFamily: "'DM Mono',monospace", letterSpacing: ".08em" }}>@CronosTreasury</span>
            </a>
            <span style={{ fontSize: 12, color: "#64ffda", fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap" }}>${fmt(ctr.price, 5)}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 99, padding: "4px 10px" }}>
              <span className="live-dot" style={{ width: 6, height: 6, background: "#64ffda", borderRadius: "50%", display: "inline-block" }} />
              <span style={{ fontSize: 10, color: "#64ffda", fontFamily: "'DM Mono',monospace", letterSpacing: ".08em" }}>LIVE</span>
            </div>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 60px" }}>

        {/* Stats */}
        <div className="stats-grid">
          {[
            { label: "CTR Price", value: `$${fmt(ctr.price, 5)}`, sub: "+4.2% (24h)", c: "#64ffda" },
            { label: "Market Cap", value: `$${fmtCompact(ctr.marketCap)}`, sub: "FDV: $4.18M", c: "#7c3aed" },
            { label: "Circulating", value: fmtCompact(ctr.circulatingSupply), sub: `of ${fmtCompact(ctr.totalSupply)}`, c: "#f59e0b" },
            { label: "Total Burned", value: fmtCompact(ctr.totalBurned), sub: `${burnPct.toFixed(2)}% of supply`, c: "#ff6b6b" },
            { label: "Vault TVL", value: `$${fmtCompact(animVault)}`, sub: "↑ 2.1% this week", c: "#64ffda" },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div style={{ fontSize: 10, color: "#64748b", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", fontFamily: "'Syne',sans-serif" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: s.c, marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Vault + Burn */}
        <div className="grid-2">
          {/* Vault Composition */}
          <div className="section-card">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16 }}>Vault Composition</div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>Treasury assets</div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#64ffda", fontFamily: "'DM Mono',monospace" }}>${fmtCompact(vaultTotal)}</div>
            </div>
            <div style={{ padding: 20 }}>
              <PieChart data={pieData} />
              <div style={{ marginTop: 16 }}>
                {vaultData.map(t => {
                  const val = t.amount * t.price;
                  const pct = (val / vaultTotal * 100).toFixed(1);
                  return (
                    <div key={t.symbol} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 13, color: "#cbd5e1" }}>{t.symbol}</div>
                      <div style={{ fontSize: 12, color: "#64ffda", fontFamily: "'DM Mono',monospace" }}>${fmtCompact(val)}</div>
                      <div style={{ fontSize: 11, color: "#475569", width: 36, textAlign: "right" }}>{pct}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Burn Analytics */}
          <div className="section-card">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b" }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16 }}>Burn Analytics</div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>Cumulative supply reduction</div>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <div style={{ width: 140, height: 140, borderRadius: "50%", background: `conic-gradient(#ff6b6b 0deg, #ff9a3c ${burnPct * 3.6}deg, #1e293b ${burnPct * 3.6}deg)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 104, height: 104, borderRadius: "50%", background: "#0d1226", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Syne',sans-serif", color: "#ff6b6b" }}>{burnPct.toFixed(1)}%</div>
                    <div style={{ fontSize: 9, color: "#475569", letterSpacing: ".1em" }}>BURNED</div>
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Total Burned", val: fmtCompact(ctr.totalBurned) + " CTR", c: "#ff6b6b" },
                  { label: "Remaining", val: fmtCompact(ctr.circulatingSupply - ctr.totalBurned) + " CTR", c: "#64ffda" },
                  { label: "Burn Rate (7d)", val: "~2.1M CTR/week", c: "#f59e0b" },
                  { label: "Est. Deflation", val: "−4.8% /month", c: "#7c3aed" },
                ].map(s => (
                  <div key={s.label} style={{ background: "#111827", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: s.c, fontFamily: "'DM Mono',monospace" }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Holdings Table */}
        <div className="section-card">
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16 }}>Treasury Holdings</div>
            <div style={{ fontSize: 11, color: "#475569", fontFamily: "'DM Mono',monospace" }}>{new Date().toLocaleTimeString()}</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="holdings-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Balance</th>
                  <th>Price</th>
                  <th>USD Value</th>
                  <th>Allocation</th>
                  <th>24h</th>
                </tr>
              </thead>
              <tbody>
                {vaultData.map(t => {
                  const val = t.amount * t.price;
                  const pct = (val / vaultTotal * 100).toFixed(1);
                  const change = (Math.random() * 8 - 4).toFixed(2);
                  return (
                    <tr key={t.symbol}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: t.color + "22", border: `2px solid ${t.color}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: t.color, flexShrink: 0 }}>{t.symbol[0]}</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                            <div style={{ fontSize: 10, color: "#475569" }}>{t.symbol}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: "'DM Mono',monospace", color: "#e2e8f0" }}>{fmtCompact(t.amount)}</td>
                      <td style={{ fontFamily: "'DM Mono',monospace", color: "#94a3b8" }}>${fmt(t.price, t.price < 1 ? 4 : 2)}</td>
                      <td style={{ fontFamily: "'DM Mono',monospace", color: "#64ffda", fontWeight: 600 }}>${fmtCompact(val)}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 60, background: "#1e293b", borderRadius: 99, height: 4, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: t.color, borderRadius: 99 }} />
                          </div>
                          <span style={{ fontSize: 11, color: "#64748b" }}>{pct}%</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: "'DM Mono',monospace", color: +change > 0 ? "#64ffda" : "#ff6b6b", fontSize: 12 }}>
                        {+change > 0 ? "▲" : "▼"} {Math.abs(change)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Buyback Feed */}
        <div className="section-card">
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16 }}>Buyback & Burn Activity</div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>Real-time on-chain events</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#ff6b6b12", border: "1px solid #ff6b6b33", borderRadius: 99, padding: "4px 12px" }}>
              <span style={{ fontSize: 12 }}>🔥</span>
              <span style={{ fontSize: 11, color: "#ff6b6b" }}>Streaming</span>
            </div>
          </div>
          <div style={{ padding: "0 0 8px" }}>
            <div className="feed-row" style={{ borderBottom: "1px solid #1e293b" }}>
              {["Time", "Bought", "Burned", "Tx Hash"].map(h => (
                <div key={h} style={{ fontSize: 10, color: "#475569", letterSpacing: ".1em", textTransform: "uppercase" }}>{h}</div>
              ))}
            </div>
            {events.map(e => (
              <div key={e.id} className={`feed-row${newIds.has(e.id) ? " new-row" : ""}`} style={{ background: newIds.has(e.id) ? "#64ffda08" : "transparent" }}>
                <div>
                  <div style={{ color: "#94a3b8", fontFamily: "'DM Mono',monospace" }}>{timeAgo(e.ts)}</div>
                  <div style={{ fontSize: 10, color: "#334155" }}>{e.ts.toLocaleTimeString()}</div>
                </div>
                <div style={{ color: "#64ffda", fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>+{fmtCompact(e.bought)} CTR</div>
                <div style={{ color: "#ff6b6b", fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>🔥 {fmtCompact(e.burned)}</div>
                <a href={`https://explorer.cronos.org/tx/${e.txHash}`} target="_blank" rel="noopener noreferrer"
                  style={{ color: "#7c3aed", fontFamily: "'DM Mono',monospace", textDecoration: "none", fontSize: 11 }}
                  className="tx-col">
                  {truncHash(e.txHash)} ↗
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="section-card">
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b" }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16 }}>How CTR Works</div>
          </div>
          <div style={{ padding: 20 }}>
            <div className="how-grid">
              {[
                { icon: "💰", title: "Treasury Growth", color: "#64ffda", text: "Protocol fees and vault yield continuously compound the treasury, increasing backing per CTR over time." },
                { icon: "🔄", title: "Buyback Mechanism", color: "#7c3aed", text: "A portion of treasury yield buys CTR on the open market, creating consistent buy pressure." },
                { icon: "🔥", title: "Burn & Deflation", color: "#ff6b6b", text: "Bought-back CTR is permanently burned, reducing supply. Fewer tokens + growing treasury = higher backing." },
                { icon: "📊", title: "Transparency", color: "#f59e0b", text: "All transactions are on-chain on Cronos EVM and verifiable on the block explorer in real time." },
              ].map(s => (
                <div key={s.title} style={{ background: "#111827", borderRadius: 12, padding: 16, borderLeft: `3px solid ${s.color}` }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 6, color: s.color }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>{s.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "16px 0", borderTop: "1px solid #1e293b" }}>
          <div style={{ fontSize: 11, color: "#334155", fontFamily: "'DM Mono',monospace" }}>
            CTR · Cronos Treasury Reserve ·{" "}
            <a href="https://explorer.cronos.org" target="_blank" rel="noopener noreferrer" style={{ color: "#475569", textDecoration: "none" }}>Cronos Explorer ↗</a>
          </div>
        </div>
      </div>
    </div>
  );
}
