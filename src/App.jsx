import { useState, useEffect, useRef } from "react";

const WALLET = "0x96a6cd06338efe754f200aba9ff07788c16e5f20";
const CRONOS_RPC = "https://evm.cronos.org";

const TOKENS = [
  { symbol: "CDCBTC", name: "CDC Bitcoin",  address: "0x2e53c5586e12a99d4CAE366E9Fc5C14fE9c6495d", decimals: 8,  color: "#F7931A" },
  { symbol: "CDCETH", name: "CDC Ethereum", address: "0x7a7c9db510aB29A2FC362a4c34260BEcB5cE3446", decimals: 18, color: "#627EEA" },
  { symbol: "LCRO",   name: "Liquid CRO",  address: "0x9Fae23A2700FEeCd5b93e43fDBc03c76AA7C08A6", decimals: 18, color: "#4A90D9" },
  { symbol: "USDC",   name: "USD Coin",    address: "0xc21223249CA28397B4B6541dfFaEcC539BfF0c59", decimals: 6,  color: "#2775CA" },
  { symbol: "PACK",   name: "Pack Token",  address: "0x0d0b4a6FC6e7f5635C2FF38dE75AF2e96D6D6804", decimals: 18, color: "#E94040" },
  { symbol: "CTR",    name: "CTR Token",   address: "0xF3672F0cF2E45B28AC4a1D50FD8aC2eB555c21FC", decimals: 18, color: "#64ffda" },
];

const MOCK_CTR = {
  totalSupply: 1_000_000_000,
  totalBurned: 0,
};



const fmt = (n, dec = 2) => n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtCompact = (n) => n >= 1e6 ? `${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : n.toFixed(0);
const fmtPrice = (p) => p < 0.001 ? p.toFixed(7) : p < 0.01 ? p.toFixed(6) : p < 1 ? p.toFixed(5) : p.toFixed(2);
const truncHash = (h) => `${h.slice(0,6)}…${h.slice(-4)}`;
const timeAgo = (ts) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
};

// ERC20 balanceOf via eth_call
async function getTokenBalance(tokenAddress, walletAddress, decimals) {
  const data = "0x70a08231" + walletAddress.slice(2).padStart(64, "0");
  const res = await fetch(CRONOS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to: tokenAddress, data }, "latest"], id: 1 }),
  });
  const json = await res.json();
  const raw = BigInt(json.result || "0x0");
  return Number(raw) / Math.pow(10, decimals);
}

function PieChart({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
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
  const [events, setEvents] = useState([]);
  const [newIds, setNewIds] = useState(new Set());
  const [livePrice, setLivePrice] = useState(null);
  const [priceChange24h, setPriceChange24h] = useState(null);
  const [liveMarketCap, setLiveMarketCap] = useState(null);
  const [vaultTokens, setVaultTokens] = useState(TOKENS.map(t => ({ ...t, amount: 0, usdPrice: 0 })));
  const [vaultLoading, setVaultLoading] = useState(true);
  const [treasuryHistory, setTreasuryHistory] = useState([]);
  const ctr = MOCK_CTR;

  const vaultTotal = vaultTokens.reduce((s, t) => s + t.amount * t.usdPrice, 0);
  const animVault = useCounter(vaultTotal);
  const pieData = vaultTokens.filter(t => t.amount * t.usdPrice > 0).map(t => ({ symbol: t.symbol, value: t.amount * t.usdPrice, color: t.color }));

  // Fetch CTR price from DexScreener
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch("https://api.dexscreener.com/latest/dex/pairs/cronos/0xf118aa245b0627b4752607620d0048b492a5f4fb");
        const data = await res.json();
        const price = parseFloat(data.pair?.priceUsd);
        const change = parseFloat(data.pair?.priceChange?.h24);
        const fdv = parseFloat(data.pair?.fdv);
        if (!isNaN(price)) setLivePrice(price);
        if (!isNaN(change)) setPriceChange24h(change);
        if (!isNaN(fdv) && fdv > 0) setLiveMarketCap(fdv);
      } catch (e) {}
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch wallet balances + prices
  useEffect(() => {
    const fetchVault = async () => {
      try {
        // Get all token balances via RPC
        const balances = await Promise.all(
          TOKENS.map(t => getTokenBalance(t.address, WALLET, t.decimals))
        );

        // Get all prices from DexScreener (most accurate for Cronos tokens)
        const dexRes = await fetch("https://api.dexscreener.com/latest/dex/tokens/0x2e53c5586e12a99d4CAE366E9Fc5C14fE9c6495d,0x7a7c9db510aB29A2FC362a4c34260BEcB5cE3446,0x9Fae23A2700FEeCd5b93e43fDBc03c76AA7C08A6,0x0d0b4a6FC6e7f5635C2FF38dE75AF2e96D6D6804,0xF3672F0cF2E45B28AC4a1D50FD8aC2eB555c21FC");
        const dexData = await dexRes.json();

        // Build price map from DexScreener — pick highest liquidity pair per token
        const priceMap = {};
        (dexData.pairs || []).forEach(pair => {
          const addr = pair.baseToken?.address?.toLowerCase();
          const price = parseFloat(pair.priceUsd);
          const liq = parseFloat(pair.liquidity?.usd || 0);
          if (addr && !isNaN(price) && (!priceMap[addr] || liq > priceMap[addr].liq)) {
            priceMap[addr] = { price, liq };
          }
        });

        const updated = TOKENS.map((t, i) => {
          let usdPrice = 0;
          const key = t.address.toLowerCase();
          if (t.symbol === "USDC") {
            usdPrice = 1.0;
          } else if (priceMap[key]) {
            usdPrice = priceMap[key].price;
          }
          return { ...t, amount: balances[i], usdPrice };
        });

        setVaultTokens(updated);
        setVaultLoading(false);
      } catch (e) {
        console.log("Vault fetch error:", e);
        setVaultLoading(false);
      }
    };

    fetchVault();
    const interval = setInterval(fetchVault, 60000);
    return () => clearInterval(interval);
  }, []);



  const displayChange = priceChange24h !== null ? priceChange24h : 0;
  const changeColor = displayChange >= 0 ? "#64ffda" : "#ff6b6b";
  const changePrefix = displayChange >= 0 ? "+" : "";

  return (
    <div style={{ minHeight: "100vh", background: "#050812", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow-x: hidden; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes slideIn { from{transform:translateY(-8px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .live-dot { animation: pulse 2s infinite; }
        .new-row { animation: slideIn .4s ease; }
        .spinner { animation: spin 1s linear infinite; }
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
            <img src="/Logo1.jpg" alt="CTR Logo" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
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
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, color: "#64ffda", fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>
                {livePrice !== null ? `$${fmtPrice(livePrice)}` : "Loading..."}
              </div>
              {priceChange24h !== null && (
                <div style={{ fontSize: 10, color: changeColor, fontFamily: "'DM Mono',monospace" }}>
                  {changePrefix}{displayChange.toFixed(2)}% (24h)
                </div>
              )}
            </div>
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
            { label: "CTR Price", value: livePrice !== null ? `$${fmtPrice(livePrice)}` : "...", sub: priceChange24h !== null ? `${changePrefix}${displayChange.toFixed(2)}% (24h)` : "Loading...", c: changeColor },
            { label: "Market Cap", value: liveMarketCap !== null ? `$${fmtCompact(liveMarketCap)}` : "...", sub: "Live · DexScreener", c: "#7c3aed" },
            { label: "Total Value", value: (liveMarketCap !== null && !vaultLoading) ? `$${fmtCompact(liveMarketCap + vaultTotal)}` : "...", sub: "Market Cap + Treasury", c: "#a78bfa" },
            { label: "Total Supply", value: "1,000.00M", sub: "Fixed supply", c: "#f59e0b" },
            { label: "Total Burned", value: "0 CTR", sub: "Burn program starting soon", c: "#ff6b6b" },
            { label: "Vault TVL", value: vaultLoading ? "Loading..." : `$${fmtCompact(animVault)}`, sub: "Live · Cronos RPC", c: "#64ffda" },
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
          <div className="section-card">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16 }}>Vault Composition</div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                  <a href={`https://explorer.cronos.org/address/${WALLET}`} target="_blank" rel="noopener noreferrer" style={{ color: "#475569", textDecoration: "none" }}>
                    {WALLET.slice(0,6)}…{WALLET.slice(-4)} ↗
                  </a>
                </div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#64ffda", fontFamily: "'DM Mono',monospace" }}>
                {vaultLoading ? "..." : `$${fmtCompact(vaultTotal)}`}
              </div>
            </div>
            <div style={{ padding: 20 }}>
              {vaultLoading ? (
                <div style={{ textAlign: "center", padding: 40, color: "#475569", fontSize: 12 }}>
                  <div style={{ width: 24, height: 24, border: "2px solid #1e293b", borderTop: "2px solid #64ffda", borderRadius: "50%", margin: "0 auto 12px", display: "inline-block" }} className="spinner" />
                  <div>Loading wallet data...</div>
                </div>
              ) : (
                <>
                  <PieChart data={pieData} />
                  <div style={{ marginTop: 16 }}>
                    {vaultTokens.map(t => {
                      const val = t.amount * t.usdPrice;
                      const pct = vaultTotal > 0 ? (val / vaultTotal * 100).toFixed(1) : "0.0";
                      return (
                        <div key={t.symbol} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.color, flexShrink: 0 }} />
                          <div style={{ flex: 1, fontSize: 13, color: "#cbd5e1" }}>{t.symbol}</div>
                          <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Mono',monospace" }}>{t.amount < 0.01 ? t.amount.toFixed(4) : fmtCompact(t.amount)}</div>
                          <div style={{ fontSize: 12, color: "#64ffda", fontFamily: "'DM Mono',monospace", width: 70, textAlign: "right" }}>${fmtCompact(val)}</div>
                          <div style={{ fontSize: 11, color: "#475569", width: 36, textAlign: "right" }}>{pct}%</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="section-card">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b" }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16 }}>Burn Analytics</div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>Cumulative supply reduction</div>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <div style={{ width: 140, height: 140, borderRadius: "50%", background: "conic-gradient(#ff6b6b 0deg, #1e293b 0deg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 104, height: 104, borderRadius: "50%", background: "#0d1226", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Syne',sans-serif", color: "#ff6b6b" }}>0%</div>
                    <div style={{ fontSize: 9, color: "#475569", letterSpacing: ".1em" }}>BURNED</div>
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Total Burned", val: "0 CTR", c: "#ff6b6b" },
                  { label: "Total Supply", val: "1,000.00M CTR", c: "#64ffda" },
                  { label: "Burn Rate", val: "Starting soon", c: "#f59e0b" },
                  { label: "Est. Deflation", val: "TBD", c: "#7c3aed" },
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
            <div style={{ fontSize: 11, color: "#475569", fontFamily: "'DM Mono',monospace" }}>
              {vaultLoading ? "Loading..." : `Updated ${new Date().toLocaleTimeString()}`}
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="holdings-table">
              <thead>
                <tr>
                  <th>Asset</th><th>Balance</th><th>Price</th><th>USD Value</th><th>Allocation</th>
                </tr>
              </thead>
              <tbody>
                {vaultTokens.map(t => {
                  const val = t.amount * t.usdPrice;
                  const pct = vaultTotal > 0 ? (val / vaultTotal * 100).toFixed(1) : "0.0";
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
                      <td style={{ fontFamily: "'DM Mono',monospace", color: "#e2e8f0" }}>
                        {vaultLoading ? "..." : (t.amount < 0.01 ? t.amount.toFixed(4) : fmtCompact(t.amount))}
                      </td>
                      <td style={{ fontFamily: "'DM Mono',monospace", color: "#94a3b8" }}>
                        {t.usdPrice > 0 ? `$${fmtPrice(t.usdPrice)}` : "—"}
                      </td>
                      <td style={{ fontFamily: "'DM Mono',monospace", color: "#64ffda", fontWeight: 600 }}>
                        {vaultLoading ? "..." : `$${fmtCompact(val)}`}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 60, background: "#1e293b", borderRadius: 99, height: 4, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: t.color, borderRadius: 99 }} />
                          </div>
                          <span style={{ fontSize: 11, color: "#64748b" }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Treasury Growth Chart */}
        <div className="section-card">
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16 }}>Treasury Growth</div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>Daily TVL snapshot · auto-updated</div>
            </div>
            {treasuryHistory.length > 0 && (
              <div style={{ fontSize: 11, color: "#64ffda", fontFamily: "'DM Mono',monospace", background: "#0d2419", border: "1px solid #64ffda33", borderRadius: 8, padding: "4px 10px" }}>
                {treasuryHistory.length}d of data
              </div>
            )}
          </div>
          <div style={{ padding: 24 }}>
            {treasuryHistory.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>📈</div>
                <div style={{ color: "#64748b", fontFamily: "'DM Mono',monospace", fontSize: 13 }}>No history yet</div>
                <div style={{ fontSize: 11, color: "#334155", marginTop: 6 }}>Daily snapshots will appear here starting tomorrow</div>
              </div>
            ) : (() => {
              const W = 800, H = 200, PAD = { top: 16, right: 16, bottom: 32, left: 56 };
              const vals = treasuryHistory.map(d => d.tvl);
              const minV = Math.min(...vals) * 0.95;
              const maxV = Math.max(...vals) * 1.05;
              const n = treasuryHistory.length;
              const xScale = i => PAD.left + (i / Math.max(n - 1, 1)) * (W - PAD.left - PAD.right);
              const yScale = v => PAD.top + (1 - (v - minV) / (maxV - minV)) * (H - PAD.top - PAD.bottom);
              const points = treasuryHistory.map((d, i) => `${xScale(i)},${yScale(d.tvl)}`).join(" ");
              const areaPoints = `${xScale(0)},${H - PAD.bottom} ` + points + ` ${xScale(n-1)},${H - PAD.bottom}`;
              const latest = treasuryHistory[n - 1];
              const first = treasuryHistory[0];
              const change = ((latest.tvl - first.tvl) / first.tvl * 100);
              const changeColor = change >= 0 ? "#64ffda" : "#ff6b6b";
              // Y axis ticks
              const yTicks = [0, 0.25, 0.5, 0.75, 1].map(p => ({
                v: minV + p * (maxV - minV),
                y: PAD.top + (1 - p) * (H - PAD.top - PAD.bottom)
              }));
              // X axis ticks — show every ~7 days
              const step = Math.max(1, Math.floor(n / 6));
              const xTicks = treasuryHistory.filter((_, i) => i % step === 0 || i === n - 1);
              return (
                <div>
                  <div style={{ display: "flex", gap: 24, marginBottom: 20 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#64748b", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>Current TVL</div>
                      <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Syne',sans-serif", color: "#64ffda" }}>${fmtCompact(latest.tvl)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#64748b", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>All-time change</div>
                      <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Syne',sans-serif", color: changeColor }}>
                        {change >= 0 ? "+" : ""}{change.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#64748b", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>Since</div>
                      <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Syne',sans-serif", color: "#94a3b8" }}>{first.date}</div>
                    </div>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 300, display: "block" }}>
                      {/* Grid lines */}
                      {yTicks.map((t, i) => (
                        <g key={i}>
                          <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y} stroke="#1e293b" strokeWidth="1" />
                          <text x={PAD.left - 6} y={t.y + 4} textAnchor="end" fill="#475569" fontSize="9" fontFamily="monospace">
                            ${fmtCompact(t.v)}
                          </text>
                        </g>
                      ))}
                      {/* Area fill */}
                      <polygon points={areaPoints} fill="url(#tvlGrad)" opacity="0.3" />
                      {/* Line */}
                      <polyline points={points} fill="none" stroke="#64ffda" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                      {/* Gradient def */}
                      <defs>
                        <linearGradient id="tvlGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#64ffda" stopOpacity="0.6" />
                          <stop offset="100%" stopColor="#64ffda" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {/* Latest point dot */}
                      <circle cx={xScale(n-1)} cy={yScale(latest.tvl)} r="4" fill="#64ffda" />
                      {/* X axis labels */}
                      {xTicks.map((d, i) => {
                        const idx = treasuryHistory.indexOf(d);
                        return (
                          <text key={i} x={xScale(idx)} y={H - 6} textAnchor="middle" fill="#475569" fontSize="8" fontFamily="monospace">
                            {d.date.slice(5)}
                          </text>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              );
            })()}
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
            {events.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#475569", fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>🔥</div>
                <div style={{ color: "#64748b", fontFamily: "'DM Mono',monospace" }}>No buyback events yet</div>
                <div style={{ fontSize: 11, color: "#334155", marginTop: 6 }}>Events will appear here once the buyback program launches</div>
              </div>
            ) : events.map(e => (
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

        <div style={{ textAlign: "center", padding: "16px 0", borderTop: "1px solid #1e293b" }}>
          <div style={{ fontSize: 11, color: "#334155", fontFamily: "'DM Mono',monospace" }}>
            CTR · Cronos Treasury Reserve ·{" "}
            <a href="https://explorer.cronos.org" target="_blank" rel="noopener noreferrer" style={{ color: "#475569", textDecoration: "none" }}>Cronos Explorer ↗</a>
            {" · "}
            <a href="https://dexscreener.com/cronos/0xf118aa245b0627b4752607620d0048b492a5f4fb" target="_blank" rel="noopener noreferrer" style={{ color: "#475569", textDecoration: "none" }}>DexScreener ↗</a>
          </div>
        </div>
      </div>
    </div>
  );
}
