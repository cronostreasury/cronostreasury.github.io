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

const STAKED_PACK = {
  symbol: "PACK",
  name: "Pack Token (Staked)",
  label: "PACK (Staked)",
  amount: 7915263,
  address: "0x0d0b4a6FC6e7f5635C2FF38dE75AF2e96D6D6804",
  decimals: 18,
  color: "#E94040",
  staked: true,
  apy: 38,
  platform: "Wolfswap Vault",
  stakedLabel: "Wolfswap Vault · 38% APY",
  stakingStartDate: "2026-03-26",
};

// VVS Finance CTR/PACK LP — donated by community member Bill
const LP_POSITION = {
  pairAddress: "0x81B3807137d0e7872Bb73Cc080C5452cf1beDAEB",
  name: "CTR/PACK LP",
  platform: "VVS Finance",
  donor: "Bill",
  color: "#00d2ff",
  decimals: 18,
};

// Wolfie NFTs — 10 held, floor price 1200 CRO each
const WOLFIE_NFTS = {
  name: "Wolfie NFTs",
  symbol: "WOLFIE",
  count: 10,
  floorPriceCRO: 1200,
  color: "#f59e0b",
};

const TOTAL_SUPPLY = 1_000_000_000;
const BURN_WALLET = "0x000000000000000000000000000000000000dEaD";
const CTR_ADDRESS = "0xF3672F0cF2E45B28AC4a1D50FD8aC2eB555c21FC";

// ERC-20 Transfer event topic
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
// Dead wallet as topic (padded, lowercase — required for Cronos RPC)
const DEAD_TOPIC = "0x000000000000000000000000000000000000000000000000000000000000dead";

const fmt = (n, dec = 2) => n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtCompact = (n) => n >= 1e6 ? `${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : n.toFixed(0);
const fmtPrice = (p) => p < 0.001 ? p.toFixed(7) : p < 0.01 ? p.toFixed(6) : p < 1 ? p.toFixed(5) : p.toFixed(2);
const truncHash = (h) => `${h.slice(0,6)}…${h.slice(-4)}`;
const truncAddr = (a) => `${a.slice(0,6)}…${a.slice(-4)}`;
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

// Generic eth_call helper (returns raw hex result)
async function ethCall(to, data) {
  const res = await fetch(CRONOS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to, data }, "latest"], id: 1 }),
  });
  const json = await res.json();
  return json.result || "0x0";
}

// Fetch LP position data: balance, reserves, totalSupply, token0
async function fetchLPData(pairAddress, walletAddress) {
  try {
    const [balanceHex, reservesHex, totalSupplyHex, token0Hex] = await Promise.all([
      ethCall(pairAddress, "0x70a08231" + walletAddress.slice(2).padStart(64, "0")),  // balanceOf
      ethCall(pairAddress, "0x0902f1ac"),  // getReserves
      ethCall(pairAddress, "0x18160ddd"),  // totalSupply
      ethCall(pairAddress, "0x0dfe1681"),  // token0
    ]);

    const lpBalance = Number(BigInt(balanceHex)) / 1e18;
    const lpTotalSupply = Number(BigInt(totalSupplyHex)) / 1e18;

    // getReserves returns: uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast
    // reserve0 = bytes 0-31 (offset 2+0 to 2+64), reserve1 = bytes 32-63
    const cleanReserves = reservesHex.slice(2); // remove 0x
    const reserve0Raw = BigInt("0x" + cleanReserves.slice(0, 64));
    const reserve1Raw = BigInt("0x" + cleanReserves.slice(64, 128));

    // token0 returns an address (last 20 bytes of 32-byte word)
    const token0Address = "0x" + token0Hex.slice(26).toLowerCase();

    const isCTRToken0 = token0Address === CTR_ADDRESS.toLowerCase();

    // Both CTR and PACK are 18 decimals
    const reserve0 = Number(reserve0Raw) / 1e18;
    const reserve1 = Number(reserve1Raw) / 1e18;

    const reserveCTR = isCTRToken0 ? reserve0 : reserve1;
    const reservePACK = isCTRToken0 ? reserve1 : reserve0;

    const shareOfPool = lpTotalSupply > 0 ? lpBalance / lpTotalSupply : 0;

    console.log(`[LP] Balance: ${lpBalance.toFixed(4)} LP tokens`);
    console.log(`[LP] Total Supply: ${lpTotalSupply.toFixed(4)}`);
    console.log(`[LP] Share: ${(shareOfPool * 100).toFixed(4)}%`);
    console.log(`[LP] Token0: ${token0Address} (${isCTRToken0 ? "CTR" : "PACK"})`);
    console.log(`[LP] Reserves: ${reserveCTR.toFixed(2)} CTR / ${reservePACK.toFixed(2)} PACK`);

    return {
      lpBalance,
      lpTotalSupply,
      shareOfPool,
      reserveCTR,
      reservePACK,
      treasuryCTR: reserveCTR * shareOfPool,
      treasuryPACK: reservePACK * shareOfPool,
    };
  } catch (e) {
    console.log("[LP] Fetch error:", e.message);
    return null;
  }
}

// Fetch block timestamp
async function getBlockTimestamp(blockHex) {
  const res = await fetch(CRONOS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBlockByNumber", params: [blockHex, false], id: 1 }),
  });
  const json = await res.json();
  if (json.result && json.result.timestamp) {
    return Number(BigInt(json.result.timestamp)) * 1000;
  }
  return Date.now();
}

// Get current block number
async function getCurrentBlockNumber() {
  const res = await fetch(CRONOS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
  });
  const json = await res.json();
  return parseInt(json.result, 16);
}

// ==========================================
// DUAL-STRATEGY BURN TRANSFER FETCHING
// Primary:  cronos.org/explorer/api (Blockscout v1 / Etherscan-compatible)
// Fallback: Chunked eth_getLogs (500k blocks)
// ==========================================

async function fetchBurnTransfersExplorer() {
  console.log("[Burn Feed] Trying Cronos Explorer API (primary)...");

  const url = `https://cronos.org/explorer/api?module=account&action=tokentx&contractaddress=${CTR_ADDRESS}&address=${BURN_WALLET}&sort=desc&limit=500`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`[Burn Feed] Explorer API HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    console.log("[Burn Feed] Explorer API response status:", data.status, "count:", data.result?.length);

    if (data.status === "1" && Array.isArray(data.result) && data.result.length > 0) {
      const logs = data.result
        .filter(tx => tx.to?.toLowerCase() === BURN_WALLET.toLowerCase())
        .map(tx => ({
          txHash: tx.hash,
          blockNumber: parseInt(tx.blockNumber) || 0,
          from: (tx.from || "").toLowerCase(),
          amount: Number(BigInt(tx.value || "0")) / 1e18,
          ts: tx.timeStamp ? parseInt(tx.timeStamp) * 1000 : Date.now(),
          logIndex: parseInt(tx.logIndex) || 0,
        }))
        .filter(l => l.amount > 0);

      if (logs.length > 0) {
        console.log(`[Burn Feed] ✅ Explorer API returned ${logs.length} burns`);
        return logs;
      }
    }

    if (data.status === "0") {
      console.log("[Burn Feed] Explorer API: no transactions found (status 0)");
      return [];
    }
  } catch (e) {
    console.log("[Burn Feed] Explorer API exception:", e.message);
  }

  return null;
}

async function fetchBurnTransfersChunked() {
  console.log("[Burn Feed] Using chunked eth_getLogs (fallback)...");
  const currentBlock = await getCurrentBlockNumber();
  const CHUNK_SIZE = 500_000;
  const allLogs = [];

  for (let from = 1; from <= currentBlock; from += CHUNK_SIZE) {
    const to = Math.min(from + CHUNK_SIZE - 1, currentBlock);
    const fromHex = "0x" + from.toString(16);
    const toHex = "0x" + to.toString(16);

    try {
      const res = await fetch(CRONOS_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getLogs",
          params: [{
            fromBlock: fromHex,
            toBlock: toHex,
            address: CTR_ADDRESS,
            topics: [
              TRANSFER_TOPIC,
              null,
              DEAD_TOPIC,
            ],
          }],
          id: 1,
        }),
      });
      const json = await res.json();
      if (json.result && Array.isArray(json.result)) {
        allLogs.push(...json.result);
        if (json.result.length > 0) {
          console.log(`[Burn Feed] Chunk ${fromHex}-${toHex}: found ${json.result.length} burns`);
        }
      }
    } catch (e) {
      console.log(`[Burn Feed] Chunk ${fromHex}-${toHex} failed:`, e.message);
    }
  }

  console.log(`[Burn Feed] eth_getLogs total: ${allLogs.length} burn events`);

  const logs = allLogs.map(log => {
    const from = "0x" + log.topics[1].slice(26);
    const rawAmount = BigInt(log.data);
    const amount = Number(rawAmount) / 1e18;
    return {
      txHash: log.transactionHash,
      blockNumber: parseInt(log.blockNumber, 16),
      blockHex: log.blockNumber,
      from: from.toLowerCase(),
      amount,
      logIndex: parseInt(log.logIndex, 16),
    };
  });

  return logs;
}

async function fetchBurnTransfers() {
  const explorerResult = await fetchBurnTransfersExplorer();

  if (explorerResult !== null) {
    console.log(`[Burn Feed] ✅ Using Explorer API — ${explorerResult.length} burn events`);
    return { logs: explorerResult, strategy: "Explorer API" };
  }

  console.log("[Burn Feed] Explorer unreachable, falling back to chunked eth_getLogs...");
  const rpcResult = await fetchBurnTransfersChunked();
  console.log(`[Burn Feed] ✅ Using chunked RPC — ${rpcResult.length} burn events`);
  return { logs: rpcResult, strategy: "RPC (chunked)" };
}

function PieChart({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  let angle = -Math.PI / 2;
  const CX = 140, CY = 140, R = 80, INNER = 48;
  const slices = data.map(d => {
    const sweep = (d.value / total) * 2 * Math.PI;
    const midAngle = angle + sweep / 2;
    const x1 = CX + R * Math.cos(angle);
    const y1 = CY + R * Math.sin(angle);
    angle += sweep;
    const x2 = CX + R * Math.cos(angle);
    const y2 = CY + R * Math.sin(angle);
    const lg = sweep > Math.PI ? 1 : 0;
    const labelR = 110;
    const lx = CX + labelR * Math.cos(midAngle);
    const ly = CY + labelR * Math.sin(midAngle);
    const pct = (d.value / total * 100).toFixed(1);
    return { ...d, path: `M${CX},${CY} L${x1},${y1} A${R},${R} 0 ${lg},1 ${x2},${y2} Z`, midAngle, lx, ly, pct, sweep };
  });
  return (
    <svg viewBox="0 0 280 280" style={{ width: "100%", maxWidth: 300, display: "block", margin: "0 auto" }}>
      {slices.map((s, i) => (
        <path key={i} d={s.path} fill={s.color} stroke="#06090f" strokeWidth="1.5" />
      ))}
      <circle cx={CX} cy={CY} r={INNER} fill="#111827" />
      <text x={CX} y={CY - 6} textAnchor="middle" fill="#e2e8f0" fontSize="10" fontFamily="monospace" fontWeight="bold">VAULT</text>
      <text x={CX} y={CY + 8} textAnchor="middle" fill="#64ffda" fontSize="8" fontFamily="monospace">TVL</text>
      {slices.map((s, i) => {
        if (s.sweep < 0.18) return null;
        const lineStart = 83;
        const lineEnd = 98;
        return (
          <g key={"label-" + i}>
            <line
              x1={CX + lineStart * Math.cos(s.midAngle)}
              y1={CY + lineStart * Math.sin(s.midAngle)}
              x2={CX + lineEnd * Math.cos(s.midAngle)}
              y2={CY + lineEnd * Math.sin(s.midAngle)}
              stroke={s.color} strokeWidth="1" opacity="0.8"
            />
            <text x={s.lx} y={s.ly - 3} textAnchor="middle" fill={s.color} fontSize="8" fontFamily="monospace" fontWeight="bold">{s.symbol}</text>
            <text x={s.lx} y={s.ly + 7} textAnchor="middle" fill="#cbd5e1" fontSize="7.5" fontFamily="monospace">{s.pct}%</text>
          </g>
        );
      })}
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

function BackgroundCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    let w, h;
    const GRID = 60;

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles = Array.from({ length: 70 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 2 + 0.6,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.6 + 0.2,
    }));

    const pulses = [];
    const spawnPulse = () => {
      const horiz = Math.random() > 0.5;
      if (horiz) {
        const row = Math.floor(Math.random() * Math.ceil(h / GRID)) * GRID;
        pulses.push({ horiz: true, pos: -GRID, fixed: row, speed: 2 + Math.random() * 3, len: 40 + Math.random() * 80, alpha: 0.5 + Math.random() * 0.3, color: "220,240,255" });
      } else {
        const col = Math.floor(Math.random() * Math.ceil(w / GRID)) * GRID;
        pulses.push({ horiz: false, pos: -GRID, fixed: col, speed: 2 + Math.random() * 3, len: 40 + Math.random() * 80, alpha: 0.5 + Math.random() * 0.3, color: "220,240,255" });
      }
    };

    let spawnTimer = 0;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      ctx.lineWidth = 1;
      const cols = Math.ceil(w / GRID);
      const rows = Math.ceil(h / GRID);
      for (let i = 0; i <= cols; i++) {
        ctx.strokeStyle = "rgba(100, 255, 218, 0.06)";
        ctx.beginPath(); ctx.moveTo(i * GRID, 0); ctx.lineTo(i * GRID, h); ctx.stroke();
      }
      for (let j = 0; j <= rows; j++) {
        ctx.strokeStyle = "rgba(100, 255, 218, 0.06)";
        ctx.beginPath(); ctx.moveTo(0, j * GRID); ctx.lineTo(w, j * GRID); ctx.stroke();
      }

      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.pos += p.speed;

        if (p.horiz) {
          const grad = ctx.createLinearGradient(p.pos - p.len, p.fixed, p.pos, p.fixed);
          grad.addColorStop(0, `rgba(${p.color}, 0)`);
          grad.addColorStop(0.4, `rgba(${p.color}, ${p.alpha * 0.4})`);
          grad.addColorStop(0.8, `rgba(${p.color}, ${p.alpha})`);
          grad.addColorStop(1, `rgba(${p.color}, 0.1)`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(Math.max(0, p.pos - p.len), p.fixed);
          ctx.lineTo(p.pos, p.fixed);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(p.pos, p.fixed, 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
          ctx.fill();
          const glow = ctx.createRadialGradient(p.pos, p.fixed, 0, p.pos, p.fixed, 8);
          glow.addColorStop(0, `rgba(${p.color}, 0.3)`);
          glow.addColorStop(1, `rgba(${p.color}, 0)`);
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(p.pos, p.fixed, 8, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const grad = ctx.createLinearGradient(p.fixed, p.pos - p.len, p.fixed, p.pos);
          grad.addColorStop(0, `rgba(${p.color}, 0)`);
          grad.addColorStop(0.4, `rgba(${p.color}, ${p.alpha * 0.4})`);
          grad.addColorStop(0.8, `rgba(${p.color}, ${p.alpha})`);
          grad.addColorStop(1, `rgba(${p.color}, 0.1)`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p.fixed, Math.max(0, p.pos - p.len));
          ctx.lineTo(p.fixed, p.pos);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(p.fixed, p.pos, 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
          ctx.fill();
          const glow = ctx.createRadialGradient(p.fixed, p.pos, 0, p.fixed, p.pos, 8);
          glow.addColorStop(0, `rgba(${p.color}, 0.3)`);
          glow.addColorStop(1, `rgba(${p.color}, 0)`);
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(p.fixed, p.pos, 8, 0, Math.PI * 2);
          ctx.fill();
        }

        if (p.pos > (p.horiz ? w + p.len : h + p.len)) pulses.splice(i, 1);
      }

      spawnTimer++;
      if (spawnTimer > 90) { spawnPulse(); spawnTimer = 0; }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const dx = p.x - particles[j].x;
          const dy = p.y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 160) {
            ctx.strokeStyle = `rgba(100, 255, 218, ${0.15 * (1 - dist / 160)})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100, 255, 218, ${p.alpha})`;
        ctx.fill();
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed", top: 0, left: 0,
        width: "100%", height: "100%",
        pointerEvents: "none", zIndex: 0,
      }}
    />
  );
}

export default function CTRDashboard() {
  const [burnEvents, setBurnEvents] = useState([]);
  const [burnEventsLoading, setBurnEventsLoading] = useState(true);
  const [burnFetchStrategy, setBurnFetchStrategy] = useState("");
  const [livePrice, setLivePrice] = useState(null);
  const [priceChange24h, setPriceChange24h] = useState(null);
  const [liveMarketCap, setLiveMarketCap] = useState(null);
  const [vaultTokens, setVaultTokens] = useState(TOKENS.map(t => ({ ...t, amount: 0, usdPrice: 0 })));
  const [vaultLoading, setVaultLoading] = useState(true);
  const [treasuryHistory, setTreasuryHistory] = useState([]);
  const [burnedAmount, setBurnedAmount] = useState(0);
  const [burnLoading, setBurnLoading] = useState(true);
  const [croPrice, setCroPrice] = useState(0);
  const [lpData, setLpData] = useState(null); // LP position data

  const packToken = vaultTokens.find(t => t.symbol === "PACK");
  const packUsdPrice = packToken ? packToken.usdPrice : 0;
  const stakedPackUsdValue = STAKED_PACK.amount * packUsdPrice;

  // CTR price for LP valuation (from live price or vault tokens)
  const ctrToken = vaultTokens.find(t => t.symbol === "CTR");
  const ctrUsdPrice = livePrice || (ctrToken ? ctrToken.usdPrice : 0);

  // LP USD value
  const lpUsdValue = lpData
    ? (lpData.treasuryCTR * ctrUsdPrice) + (lpData.treasuryPACK * packUsdPrice)
    : 0;

  // Wolfie NFT USD value based on live CRO price
  const wolfieUsdValue = WOLFIE_NFTS.count * WOLFIE_NFTS.floorPriceCRO * croPrice;

  // Calculate accrued PACK yield since staking started
  const stakingStart = new Date(STAKED_PACK.stakingStartDate + "T00:00:00Z").getTime();
  const msElapsed = Math.max(0, Date.now() - stakingStart);
  const daysElapsed = msElapsed / (1000 * 60 * 60 * 24);
  const dailyRate = STAKED_PACK.apy / 100 / 365;
  const accruedPack = STAKED_PACK.amount * dailyRate * daysElapsed;
  const accruedPackUsd = accruedPack * packUsdPrice;
  const fullDaysElapsed = Math.floor(daysElapsed);

  const vaultTotal = vaultTokens.reduce((s, t) => s + t.amount * t.usdPrice, 0) + stakedPackUsdValue + wolfieUsdValue + lpUsdValue;
  const animVault = useCounter(vaultTotal);

  const pieData = [
    ...vaultTokens.filter(t => t.symbol !== "CTR" && t.amount * t.usdPrice > 0).map(t => ({ symbol: t.symbol, value: t.amount * t.usdPrice, color: t.color })),
    ...(stakedPackUsdValue > 0 ? [{ symbol: "PACK*", value: stakedPackUsdValue, color: "#ff4444" }] : []),
    ...(lpUsdValue > 0 ? [{ symbol: "LP", value: lpUsdValue, color: LP_POSITION.color }] : []),
    ...(wolfieUsdValue > 0 ? [{ symbol: "WOLFIE", value: wolfieUsdValue, color: WOLFIE_NFTS.color }] : []),
  ];

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

  // Fetch wallet balances + prices + LP data
  useEffect(() => {
    const fetchVault = async () => {
      try {
        // Fetch token balances and LP data in parallel
        const [balances, lpResult] = await Promise.all([
          Promise.all(TOKENS.map(t => getTokenBalance(t.address, WALLET, t.decimals))),
          fetchLPData(LP_POSITION.pairAddress, WALLET),
        ]);

        if (lpResult) {
          setLpData(lpResult);
          console.log(`[LP] ✅ USD value components: ${lpResult.treasuryCTR.toFixed(2)} CTR + ${lpResult.treasuryPACK.toFixed(2)} PACK`);
        }

        const dexRes = await fetch("https://api.dexscreener.com/latest/dex/tokens/0x2e53c5586e12a99d4CAE366E9Fc5C14fE9c6495d,0x7a7c9db510aB29A2FC362a4c34260BEcB5cE3446,0x9Fae23A2700FEeCd5b93e43fDBc03c76AA7C08A6,0x0d0b4a6FC6e7f5635C2FF38dE75AF2e96D6D6804,0xF3672F0cF2E45B28AC4a1D50FD8aC2eB555c21FC");
        const dexData = await dexRes.json();

        const priceMap = {};
        (dexData.pairs || []).forEach(pair => {
          const addr = pair.baseToken?.address?.toLowerCase();
          const price = parseFloat(pair.priceUsd);
          const liq = parseFloat(pair.liquidity?.usd || 0);
          if (addr && !isNaN(price) && (!priceMap[addr] || liq > priceMap[addr].liq)) {
            priceMap[addr] = {
              price, liq,
              change24h: parseFloat(pair.priceChange?.h24) || 0,
              change7d: parseFloat(pair.priceChange?.h24 * 7) || 0,
              changeW1: parseFloat(pair.priceChange?.w1) || null,
            };
          }
        });

        // Fetch CRO price via WCRO token on DexScreener
        try {
          const WCRO = "0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23";
          const croRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${WCRO}`);
          const croData = await croRes.json();
          let bestCroPrice = 0;
          let bestLiq = 0;
          (croData.pairs || []).forEach(pair => {
            const p = parseFloat(pair.priceUsd);
            const liq = parseFloat(pair.liquidity?.usd || 0);
            if (!isNaN(p) && p > 0 && liq > bestLiq) {
              bestCroPrice = p;
              bestLiq = liq;
            }
          });
          if (bestCroPrice > 0) {
            setCroPrice(bestCroPrice);
            console.log(`[CRO Price] WCRO → $${bestCroPrice}`);
          } else {
            const lcroAddr = "0x9fae23a2700feecd5b93e43fdbc03c76aa7c08a6";
            if (priceMap[lcroAddr]) setCroPrice(priceMap[lcroAddr].price);
          }
        } catch {
          const lcroAddr = "0x9fae23a2700feecd5b93e43fdbc03c76aa7c08a6";
          if (priceMap[lcroAddr]) setCroPrice(priceMap[lcroAddr].price);
        }

        const updated = TOKENS.map((t, i) => {
          let usdPrice = 0;
          const key = t.address.toLowerCase();
          if (t.symbol === "USDC") {
            usdPrice = 1.0;
          } else if (priceMap[key]) {
            usdPrice = priceMap[key].price;
          }
          const changeData = priceMap[key] || {};
          return { ...t, amount: balances[i], usdPrice, change24h: changeData.change24h || 0, change7d: changeData.changeW1 !== null ? changeData.changeW1 : changeData.change7d || 0 };
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

  // Fetch treasury history for chart
  useEffect(() => {
    fetch("/treasury-history.json")
      .then(r => r.json())
      .then(data => setTreasuryHistory(Array.isArray(data) ? data : []))
      .catch(() => setTreasuryHistory([]));
  }, []);

  // Fetch burned CTR from dead wallet
  useEffect(() => {
    const fetchBurned = async () => {
      try {
        const burned = await getTokenBalance(CTR_ADDRESS, BURN_WALLET, 18);
        setBurnedAmount(burned);
        setBurnLoading(false);
      } catch (e) {
        setBurnLoading(false);
      }
    };
    fetchBurned();
    const interval = setInterval(fetchBurned, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch ALL burn transfer events via dual strategy
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setBurnEventsLoading(true);
        const { logs, strategy } = await fetchBurnTransfers();
        setBurnFetchStrategy(strategy);

        if (!logs || logs.length === 0) {
          console.log("[Burn Feed] No burn events found from any source");
          setBurnEvents([]);
          setBurnEventsLoading(false);
          return;
        }

        const hasTimestamps = logs.every(l => l.ts && l.ts > 0);

        if (hasTimestamps) {
          const events = logs.map((l, i) => ({
            id: `${l.txHash}-${l.logIndex || i}`,
            txHash: l.txHash,
            from: l.from,
            amount: l.amount,
            blockNumber: l.blockNumber,
            ts: l.ts,
          })).sort((a, b) => b.ts - a.ts);

          setBurnEvents(events);
          setBurnEventsLoading(false);
        } else {
          const uniqueBlocks = [...new Set(logs.map(l => l.blockHex))];
          const blockTimestamps = {};
          const BATCH = 10;
          for (let i = 0; i < uniqueBlocks.length; i += BATCH) {
            const batch = uniqueBlocks.slice(i, i + BATCH);
            const results = await Promise.all(batch.map(bh => getBlockTimestamp(bh)));
            batch.forEach((bh, idx) => { blockTimestamps[bh] = results[idx]; });
          }

          const events = logs.map(l => ({
            id: `${l.txHash}-${l.logIndex}`,
            txHash: l.txHash,
            from: l.from,
            amount: l.amount,
            blockNumber: l.blockNumber,
            ts: blockTimestamps[l.blockHex] || Date.now(),
          })).sort((a, b) => b.ts - a.ts);

          setBurnEvents(events);
          setBurnEventsLoading(false);
        }
      } catch (e) {
        console.log("Burn events fetch error:", e);
        setBurnEventsLoading(false);
        setBurnFetchStrategy("Error");
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 120000);
    return () => clearInterval(interval);
  }, []);

  const displayChange = priceChange24h !== null ? priceChange24h : 0;
  const changeColor = displayChange >= 0 ? "#64ffda" : "#ff6b6b";
  const changePrefix = displayChange >= 0 ? "+" : "";

  const totalBurnedFromEvents = burnEvents.reduce((s, e) => s + e.amount, 0);

  return (
    <div style={{ minHeight: "100vh", background: "#020408", color: "#e2e8f0", fontFamily: "system-ui, sans-serif", position: "relative" }}>
      <BackgroundCanvas />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow-x: hidden; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes slideIn { from{transform:translateY(-8px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes firesalePulse { 0%,100%{box-shadow:0 0 8px #ff3d0000} 50%{box-shadow:0 0 14px #ff3d0033} }
        .live-dot { animation: pulse 2s infinite; }
        .new-row { animation: slideIn .4s ease; }
        .spinner { animation: spin 1s linear infinite; }
        .stat-card { background: linear-gradient(135deg,#141d35,#1a2440); border: 1px solid #1e293b; border-radius: 12px; padding: 16px 20px; transition: border-color 0.3s, box-shadow 0.3s; } .stat-card:hover { border-color: rgba(100,255,218,0.25); box-shadow: 0 0 24px rgba(100,255,218,0.12), 0 4px 24px rgba(0,0,0,0.4); }
        .section-card { background: #111827; border: 1px solid #1e2940; border-radius: 16px; overflow: hidden; margin-bottom: 16px; transition: border-color 0.3s, box-shadow 0.3s; box-shadow: 0 0 0px rgba(100,255,218,0); } .section-card:hover { border-color: rgba(100,255,218,0.15); box-shadow: 0 0 32px rgba(100,255,218,0.10), 0 8px 32px rgba(0,0,0,0.5); }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 700px) { .grid-2 { grid-template-columns: 1fr; } }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 16px; }
        .how-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
        .holdings-table { width: 100%; border-collapse: collapse; }
        .holdings-table th { padding: 10px 16px; font-size: 10px; color: #475569; text-align: left; letter-spacing: .1em; text-transform: uppercase; background: #111827; font-weight: 500; }
        .holdings-table td { padding: 12px 16px; border-bottom: 1px solid #243152; font-size: 13px; }
        .holdings-table tr:last-child td { border-bottom: none; }
        .burn-feed-row { display: grid; grid-template-columns: 1.2fr 1fr 1.2fr 1fr; gap: 8px; padding: 12px 16px; border-bottom: 1px solid #243152; align-items: center; font-size: 12px; transition: background 0.2s; }
        .burn-feed-row:hover { background: #1a243888; }
        @media (max-width: 600px) { .burn-feed-row { grid-template-columns: 1fr 1fr; } .burn-feed-row .from-col { display: none; } .burn-feed-row .tx-col { display: none; } }
        ::-webkit-scrollbar { width: 4px; background: #0a0e1a; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <header style={{ borderBottom: "1px solid #243152", padding: "0 16px", position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(12px)", background: "rgba(5, 8, 18, 0.92)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <img src="/Logo1.jpg" alt="CTR Logo" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Cronos Treasury Reserve</div>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: ".08em" }}>CTR · CRONOS EVM</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <a href="/firesale/" style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, #ff3d0018, #ff6d0010)", border: "1px solid #ff3d0044", borderRadius: 99, padding: "4px 12px", textDecoration: "none", animation: "firesalePulse 2s ease-in-out infinite" }}>
              <span style={{ fontSize: 12 }}>🔥</span>
              <span style={{ fontSize: 10, color: "#ff6d00", fontFamily: "'DM Mono',monospace", fontWeight: 700, letterSpacing: ".08em" }}>Firesale</span>
            </a>
            <a href="https://debank.com/profile/0x96a6cd06338efe754f200aba9ff07788c16e5f20" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, background: "#0f172a", border: "1px solid #243152", borderRadius: 99, padding: "4px 10px", textDecoration: "none" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#ff7c1f"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
              <span style={{ fontSize: 10, color: "#ff7c1f", fontFamily: "'DM Mono',monospace", letterSpacing: ".08em" }}>DeBank</span>
            </a>
            <a href="https://discord.gg/EHUdCuSDAj" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, background: "#0f172a", border: "1px solid #243152", borderRadius: 99, padding: "4px 10px", textDecoration: "none" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#7289da"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.031.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
              <span style={{ fontSize: 10, color: "#7289da", fontFamily: "'DM Mono',monospace", letterSpacing: ".08em" }}>Discord</span>
            </a>
            <a href="https://x.com/CronosTreasury" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, background: "#0f172a", border: "1px solid #243152", borderRadius: 99, padding: "4px 10px", textDecoration: "none" }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#0f172a", border: "1px solid #243152", borderRadius: 99, padding: "4px 10px" }}>
              <span className="live-dot" style={{ width: 6, height: 6, background: "#64ffda", borderRadius: "50%", display: "inline-block" }} />
              <span style={{ fontSize: 10, color: "#64ffda", fontFamily: "'DM Mono',monospace", letterSpacing: ".08em" }}>LIVE</span>
            </div>
          </div>
        </div>
      </header>

      {/* Buy CTR Banner */}
      <div style={{ position: "relative", zIndex: 2, borderBottom: "1px solid #1a2f1a" }}>
        <a
          href="https://obsidian.finance/?outputCurrency=0xF3672F0cF2E45B28AC4a1D50FD8aC2eB555c21FC"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none", display: "block" }}
        >
          <div style={{
            background: "linear-gradient(90deg, #0a1a0a 0%, #0d2e18 40%, #0a1a0a 100%)",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            cursor: "pointer",
            position: "relative",
            overflow: "hidden",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "linear-gradient(90deg, #0d2010 0%, #123d20 40%, #0d2010 100%)"}
          onMouseLeave={e => e.currentTarget.style.background = "linear-gradient(90deg, #0a1a0a 0%, #0d2e18 40%, #0a1a0a 100%)"}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, #64ffda, transparent)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>🏛️</span>
              <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15, color: "#64ffda", letterSpacing: ".05em" }}>Buy CTR</span>
            </div>
            <div style={{ width: "1px", height: 20, background: "#1e3a2a" }} />
            <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Mono',monospace" }}>Trade on Obsidian Finance</span>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 11, color: "#64ffda", fontFamily: "'DM Mono',monospace" }}>obsidian.finance</span>
              <span style={{ fontSize: 12, color: "#64ffda" }}>↗</span>
            </div>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, #64ffda44, transparent)" }} />
          </div>
        </a>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 60px", position: "relative", zIndex: 1 }}>

        {/* Stats */}
        <div className="stats-grid">
          {[
            { label: "CTR Price", value: livePrice !== null ? `$${fmtPrice(livePrice)}` : "...", sub: priceChange24h !== null ? `${changePrefix}${displayChange.toFixed(2)}% (24h)` : "Loading...", c: changeColor },
            { label: "Market Cap", value: liveMarketCap !== null ? `$${fmtCompact(liveMarketCap)}` : "...", sub: "Live · DexScreener", c: "#7c3aed" },
            { label: "Total Value", value: (liveMarketCap !== null && !vaultLoading) ? `$${fmtCompact(liveMarketCap + vaultTotal)}` : "...", sub: "Market Cap + Treasury", c: "#a78bfa" },
            { label: "Total Supply", value: "1,000.00M", sub: "Fixed supply", c: "#f59e0b" },
            { label: "Total Burned", value: burnLoading ? "..." : `${fmtCompact(burnedAmount)} CTR`, sub: burnedAmount > 0 ? `${(burnedAmount / TOTAL_SUPPLY * 100).toFixed(4)}% of supply` : "Live · Dead Wallet", c: "#ff6b6b" },
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
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #243152", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                    {[...vaultTokens].sort((a, b) => (b.amount * b.usdPrice) - (a.amount * a.usdPrice)).map(t => {
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
                    {/* Staked PACK */}
                    {stakedPackUsdValue > 0 && (() => {
                      const val = stakedPackUsdValue;
                      const pct = vaultTotal > 0 ? (val / vaultTotal * 100).toFixed(1) : "0.0";
                      return (
                        <div style={{ background: "#1a1030", borderRadius: 8, padding: "6px 8px", border: "1px solid #3d1a6e55", marginBottom: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: STAKED_PACK.color, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, color: "#cbd5e1" }}>PACK <span style={{ fontSize: 10, color: "#a78bfa", background: "#3d1a6e55", borderRadius: 4, padding: "1px 5px", marginLeft: 4 }}>Staked</span></div>
                              <div style={{ fontSize: 10, color: "#6b4fa0", fontFamily: "'DM Mono',monospace" }}>🔒 {STAKED_PACK.stakedLabel}</div>
                            </div>
                            <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Mono',monospace" }}>{fmtCompact(STAKED_PACK.amount)}</div>
                            <div style={{ fontSize: 12, color: "#64ffda", fontFamily: "'DM Mono',monospace", width: 70, textAlign: "right" }}>${fmtCompact(val)}</div>
                            <div style={{ fontSize: 11, color: "#475569", width: 36, textAlign: "right" }}>{pct}%</div>
                          </div>
                          {accruedPack > 0 && (
                            <div style={{ marginTop: 6, marginLeft: 16, padding: "5px 10px", background: "#0d1a0d", borderRadius: 6, border: "1px solid #1a3a1a", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span style={{ fontSize: 11 }}>🌱</span>
                                <span style={{ fontSize: 10, color: "#475569" }}>Yield ({fullDaysElapsed}d):</span>
                              </div>
                              <span style={{ fontSize: 12, color: "#64ffda", fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>
                                +{fmtCompact(accruedPack)} PACK
                              </span>
                              {accruedPackUsd > 0 && (
                                <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Mono',monospace" }}>
                                  ≈ ${fmtCompact(accruedPackUsd)}
                                </span>
                              )}
                              <span style={{ fontSize: 10, color: "#475569", fontFamily: "'DM Mono',monospace" }}>
                                (~{fmtCompact(STAKED_PACK.amount * dailyRate)}/day)
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {/* CTR/PACK LP Position */}
                    {lpData && lpUsdValue > 0 && (() => {
                      const pct = vaultTotal > 0 ? (lpUsdValue / vaultTotal * 100).toFixed(1) : "0.0";
                      return (
                        <div style={{ background: "#0a1a2a", borderRadius: 8, padding: "6px 8px", border: "1px solid #00d2ff33", marginBottom: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: LP_POSITION.color, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, color: "#cbd5e1" }}>CTR/PACK <span style={{ fontSize: 10, color: "#00d2ff", background: "#00d2ff22", borderRadius: 4, padding: "1px 5px", marginLeft: 4 }}>LP</span></div>
                              <div style={{ fontSize: 10, color: "#4a9ec0", fontFamily: "'DM Mono',monospace" }}>🤝 {LP_POSITION.platform} · Donated by {LP_POSITION.donor}</div>
                            </div>
                            <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Mono',monospace" }}>{(lpData.shareOfPool * 100).toFixed(2)}%</div>
                            <div style={{ fontSize: 12, color: "#64ffda", fontFamily: "'DM Mono',monospace", width: 70, textAlign: "right" }}>${fmtCompact(lpUsdValue)}</div>
                            <div style={{ fontSize: 11, color: "#475569", width: 36, textAlign: "right" }}>{pct}%</div>
                          </div>
                          <div style={{ marginTop: 6, marginLeft: 16, padding: "5px 10px", background: "#0a1520", borderRadius: 6, border: "1px solid #1a2a3a", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ fontSize: 11 }}>💧</span>
                              <span style={{ fontSize: 10, color: "#475569" }}>Pool share:</span>
                            </div>
                            <span style={{ fontSize: 11, color: "#64ffda", fontFamily: "'DM Mono',monospace" }}>
                              {fmtCompact(lpData.treasuryCTR)} CTR
                            </span>
                            <span style={{ fontSize: 11, color: "#475569" }}>+</span>
                            <span style={{ fontSize: 11, color: "#E94040", fontFamily: "'DM Mono',monospace" }}>
                              {fmtCompact(lpData.treasuryPACK)} PACK
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                    {/* Wolfie NFTs */}
                    {wolfieUsdValue > 0 && (() => {
                      const pct = vaultTotal > 0 ? (wolfieUsdValue / vaultTotal * 100).toFixed(1) : "0.0";
                      return (
                        <div style={{ background: "#1a1500", borderRadius: 8, padding: "6px 8px", border: "1px solid #f59e0b33", marginBottom: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: WOLFIE_NFTS.color, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, color: "#cbd5e1" }}>Wolfie NFTs <span style={{ fontSize: 10, color: "#f59e0b", background: "#f59e0b22", borderRadius: 4, padding: "1px 5px", marginLeft: 4 }}>NFT</span></div>
                              <div style={{ fontSize: 10, color: "#b07d1a", fontFamily: "'DM Mono',monospace" }}>🐺 {WOLFIE_NFTS.count}× · Floor {fmtCompact(WOLFIE_NFTS.floorPriceCRO)} CRO each</div>
                            </div>
                            <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Mono',monospace" }}>{WOLFIE_NFTS.count} NFTs</div>
                            <div style={{ fontSize: 12, color: "#64ffda", fontFamily: "'DM Mono',monospace", width: 70, textAlign: "right" }}>${fmtCompact(wolfieUsdValue)}</div>
                            <div style={{ fontSize: 11, color: "#475569", width: 36, textAlign: "right" }}>{pct}%</div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="section-card">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #243152" }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16 }}>Burn Analytics</div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>Cumulative supply reduction</div>
            </div>
            <div style={{ padding: 20 }}>
              {(() => {
                const burnPct = burnedAmount / TOTAL_SUPPLY * 100;
                const deg = Math.min(burnPct / 100 * 360, 360);
                return (
                  <>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                      <div style={{ width: 140, height: 140, borderRadius: "50%", background: `conic-gradient(#ff6b6b ${deg}deg, #1e293b ${deg}deg)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: 104, height: 104, borderRadius: "50%", background: "#0d1226", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Syne',sans-serif", color: "#ff6b6b" }}>
                            {burnLoading ? "..." : `${burnPct < 0.001 ? burnPct.toFixed(5) : burnPct.toFixed(3)}%`}
                          </div>
                          <div style={{ fontSize: 9, color: "#475569", letterSpacing: ".1em" }}>BURNED</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {[
                        { label: "Total Burned", val: burnLoading ? "..." : `${fmtCompact(burnedAmount)} CTR`, c: "#ff6b6b" },
                        { label: "Total Supply", val: "1,000.00M CTR", c: "#64ffda" },
                        { label: "Circulating Supply", val: burnLoading ? "..." : `${fmtCompact(TOTAL_SUPPLY - burnedAmount)} CTR`, c: "#94a3b8" },
                        { label: "Burn Wallet", val: `${BURN_WALLET.slice(0,6)}…${BURN_WALLET.slice(-4)}`, c: "#7c3aed" },
                      ].map(s => (
                        <div key={s.label} style={{ background: "#1a2440", borderRadius: 10, padding: "10px 14px" }}>
                          <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>{s.label}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: s.c, fontFamily: "'DM Mono',monospace" }}>{s.val}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 10, background: "#1a2440", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#475569", marginBottom: 2 }}>Dead Wallet</div>
                        <a href={`https://explorer.cronos.org/address/${BURN_WALLET}`} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, color: "#ff6b6b", fontFamily: "'DM Mono',monospace", textDecoration: "none" }}>
                          {BURN_WALLET.slice(0,10)}…{BURN_WALLET.slice(-4)} ↗
                        </a>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#ff6b6b12", border: "1px solid #ff6b6b33", borderRadius: 99, padding: "4px 10px" }}>
                        <span style={{ fontSize: 11 }}>🔥</span>
                        <span style={{ fontSize: 11, color: "#ff6b6b", fontFamily: "'DM Mono',monospace" }}>Live · Cronos RPC</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Holdings Table */}
        <div className="section-card">
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #243152", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16 }}>Treasury Holdings</div>
            <div style={{ fontSize: 11, color: "#475569", fontFamily: "'DM Mono',monospace" }}>
              {vaultLoading ? "Loading..." : `Updated ${new Date().toLocaleTimeString()}`}
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="holdings-table">
              <thead>
                <tr>
                  <th>Asset</th><th>Balance</th><th>Price</th><th>USD Value</th><th>Allocation</th><th>24h</th><th>7d</th>
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
                      <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: t.change24h >= 0 ? "#64ffda" : "#ff6b6b" }}>
                        {t.symbol === "USDC" ? "—" : `${t.change24h >= 0 ? "+" : ""}${t.change24h?.toFixed(2)}%`}
                      </td>
                      <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: t.change7d >= 0 ? "#64ffda" : "#ff6b6b" }}>
                        {t.symbol === "USDC" ? "—" : `${t.change7d >= 0 ? "+" : ""}${t.change7d?.toFixed(2)}%`}
                      </td>
                    </tr>
                  );
                })}
                {/* Staked PACK row */}
                {stakedPackUsdValue > 0 && (() => {
                  const pct = vaultTotal > 0 ? (stakedPackUsdValue / vaultTotal * 100).toFixed(1) : "0.0";
                  return (
                    <>
                    <tr style={{ background: "#1a1030" }}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#E9404022", border: "2px solid #E9404055", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#E94040", flexShrink: 0 }}>P</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>Pack Token <span style={{ fontSize: 10, color: "#a78bfa", background: "#3d1a6e55", borderRadius: 4, padding: "1px 5px", marginLeft: 4 }}>Staked</span></div>
                            <div style={{ fontSize: 10, color: "#6b4fa0" }}>🔒 {STAKED_PACK.stakedLabel}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: "'DM Mono',monospace", color: "#e2e8f0" }}>{fmtCompact(STAKED_PACK.amount)}</td>
                      <td style={{ fontFamily: "'DM Mono',monospace", color: "#94a3b8" }}>{packUsdPrice > 0 ? `$${fmtPrice(packUsdPrice)}` : "—"}</td>
                      <td style={{ fontFamily: "'DM Mono',monospace", color: "#64ffda", fontWeight: 600 }}>${fmtCompact(stakedPackUsdValue)}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 60, background: "#1e293b", borderRadius: 99, height: 4, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: "#E94040", borderRadius: 99 }} />
                          </div>
                          <span style={{ fontSize: 11, color: "#64748b" }}>{pct}%</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#a78bfa" }}>38% APY</td>
                      <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#475569" }}>—</td>
                    </tr>
                    {accruedPack > 0 && (
                      <tr style={{ background: "#0d1a0d" }}>
                        <td colSpan={7} style={{ padding: "8px 16px", borderBottom: "1px solid #1a3a1a" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <span style={{ fontSize: 12 }}>🌱</span>
                              <span style={{ fontSize: 11, color: "#64748b" }}>Accrued yield ({fullDaysElapsed} days):</span>
                            </div>
                            <span style={{ fontSize: 13, color: "#64ffda", fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>
                              +{fmtCompact(accruedPack)} PACK
                            </span>
                            {accruedPackUsd > 0 && (
                              <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Mono',monospace" }}>
                                ≈ ${fmtCompact(accruedPackUsd)}
                              </span>
                            )}
                            <span style={{ fontSize: 10, color: "#475569", fontFamily: "'DM Mono',monospace" }}>
                              ~{fmtCompact(STAKED_PACK.amount * dailyRate)} PACK/day
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    </>
                  );
                })()}
                {/* CTR/PACK LP row */}
                {lpData && lpUsdValue > 0 && (() => {
                  const pct = vaultTotal > 0 ? (lpUsdValue / vaultTotal * 100).toFixed(1) : "0.0";
                  return (
                    <>
                    <tr style={{ background: "#0a1a2a" }}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#00d2ff22", border: "2px solid #00d2ff55", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>💧</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>CTR / PACK <span style={{ fontSize: 10, color: "#00d2ff", background: "#00d2ff22", borderRadius: 4, padding: "1px 5px", marginLeft: 4 }}>LP</span></div>
                            <div style={{ fontSize: 10, color: "#4a9ec0" }}>🤝 {LP_POSITION.platform} · Donated by {LP_POSITION.donor}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: "'DM Mono',monospace", color: "#e2e8f0" }}>
                        <div>{fmtCompact(lpData.lpBalance)} LP</div>
                        <div style={{ fontSize: 10, color: "#475569" }}>{(lpData.shareOfPool * 100).toFixed(2)}% of pool</div>
                      </td>
                      <td style={{ fontFamily: "'DM Mono',monospace", color: "#94a3b8", fontSize: 11 }}>
                        <div>{fmtCompact(lpData.treasuryCTR)} CTR</div>
                        <div>{fmtCompact(lpData.treasuryPACK)} PACK</div>
                      </td>
                      <td style={{ fontFamily: "'DM Mono',monospace", color: "#64ffda", fontWeight: 600 }}>${fmtCompact(lpUsdValue)}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 60, background: "#1e293b", borderRadius: 99, height: 4, overflow: "hidden" }}>
                            <div style={{ width: `${Math.min(parseFloat(pct), 100)}%`, height: "100%", background: "#00d2ff", borderRadius: 99 }} />
                          </div>
                          <span style={{ fontSize: 11, color: "#64748b" }}>{pct}%</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#00d2ff" }}>LP fees</td>
                      <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#475569" }}>—</td>
                    </tr>
                    </>
                  );
                })()}
                {/* Wolfie NFT row */}
                {(() => {
                  const pct = vaultTotal > 0 ? (wolfieUsdValue / vaultTotal * 100).toFixed(1) : "0.0";
                  return (
                    <tr style={{ background: "#1a1500" }}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f59e0b22", border: "2px solid #f59e0b55", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>🐺</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>Wolfie NFTs <span style={{ fontSize: 10, color: "#f59e0b", background: "#f59e0b22", borderRadius: 4, padding: "1px 5px", marginLeft: 4 }}>NFT</span></div>
                            <div style={{ fontSize: 10, color: "#b07d1a" }}>Floor {fmtCompact(WOLFIE_NFTS.floorPriceCRO)} CRO · {WOLFIE_NFTS.count} held</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: "'DM Mono',monospace", color: "#e2e8f0" }}>{WOLFIE_NFTS.count} NFTs</td>
                      <td style={{ fontFamily: "'DM Mono',monospace", color: "#94a3b8" }}>
                        {croPrice > 0 ? `${fmtCompact(WOLFIE_NFTS.floorPriceCRO)} CRO` : "—"}
                        {croPrice > 0 && <div style={{ fontSize: 10, color: "#475569" }}>(≈ ${fmtPrice(WOLFIE_NFTS.floorPriceCRO * croPrice)})</div>}
                      </td>
                      <td style={{ fontFamily: "'DM Mono',monospace", color: "#64ffda", fontWeight: 600 }}>
                        {croPrice > 0 ? `$${fmtCompact(wolfieUsdValue)}` : `${fmtCompact(WOLFIE_NFTS.count * WOLFIE_NFTS.floorPriceCRO)} CRO`}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 60, background: "#1e293b", borderRadius: 99, height: 4, overflow: "hidden" }}>
                            <div style={{ width: `${Math.min(parseFloat(pct), 100)}%`, height: "100%", background: "#f59e0b", borderRadius: 99 }} />
                          </div>
                          <span style={{ fontSize: 11, color: "#64748b" }}>{pct}%</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#f59e0b" }}>Floor price</td>
                      <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#475569" }}>—</td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Treasury Growth Chart */}
        <div className="section-card">
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #243152", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
              const yTicks = [0, 0.25, 0.5, 0.75, 1].map(p => ({
                v: minV + p * (maxV - minV),
                y: PAD.top + (1 - p) * (H - PAD.top - PAD.bottom)
              }));
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
                      {yTicks.map((t, i) => (
                        <g key={i}>
                          <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y} stroke="#1e293b" strokeWidth="1" />
                          <text x={PAD.left - 6} y={t.y + 4} textAnchor="end" fill="#475569" fontSize="9" fontFamily="monospace">
                            ${fmtCompact(t.v)}
                          </text>
                        </g>
                      ))}
                      <polygon points={areaPoints} fill="url(#tvlGrad)" opacity="0.3" />
                      <polyline points={points} fill="none" stroke="#64ffda" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                      <defs>
                        <linearGradient id="tvlGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#64ffda" stopOpacity="0.6" />
                          <stop offset="100%" stopColor="#64ffda" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <circle cx={xScale(n-1)} cy={yScale(latest.tvl)} r="4" fill="#64ffda" />
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

        {/* BURN TRANSFER FEED */}
        <div className="section-card">
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #243152", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16 }}>Burn Transactions</div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>All CTR transfers to dead wallet · on-chain verified</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {burnEvents.length > 0 && (
                <div style={{ fontSize: 11, color: "#ff6b6b", fontFamily: "'DM Mono',monospace", background: "#ff6b6b12", border: "1px solid #ff6b6b33", borderRadius: 8, padding: "4px 10px" }}>
                  {burnEvents.length} burn{burnEvents.length !== 1 ? "s" : ""}
                </div>
              )}
              {burnFetchStrategy && (
                <div style={{ fontSize: 10, color: "#475569", fontFamily: "'DM Mono',monospace", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: "3px 8px" }}>
                  via {burnFetchStrategy}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#ff6b6b12", border: "1px solid #ff6b6b33", borderRadius: 99, padding: "4px 12px" }}>
                <span className="live-dot" style={{ width: 6, height: 6, background: "#ff6b6b", borderRadius: "50%", display: "inline-block" }} />
                <span style={{ fontSize: 11, color: "#ff6b6b" }}>Live</span>
              </div>
            </div>
          </div>
          <div style={{ padding: "0 0 8px" }}>
            <div className="burn-feed-row" style={{ borderBottom: "1px solid #243152" }}>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: ".1em", textTransform: "uppercase" }}>Time</div>
              <div className="from-col" style={{ fontSize: 10, color: "#475569", letterSpacing: ".1em", textTransform: "uppercase" }}>From</div>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: ".1em", textTransform: "uppercase" }}>Amount Burned</div>
              <div className="tx-col" style={{ fontSize: 10, color: "#475569", letterSpacing: ".1em", textTransform: "uppercase" }}>Tx Hash</div>
            </div>

            {burnEventsLoading ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#475569", fontSize: 12 }}>
                <div style={{ width: 24, height: 24, border: "2px solid #1e293b", borderTop: "2px solid #ff6b6b", borderRadius: "50%", margin: "0 auto 12px", display: "inline-block" }} className="spinner" />
                <div style={{ fontFamily: "'DM Mono',monospace" }}>Scanning blockchain for burn events...</div>
              </div>
            ) : burnEvents.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#475569", fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>🔥</div>
                <div style={{ color: "#64748b", fontFamily: "'DM Mono',monospace" }}>No burn transactions found yet</div>
                <div style={{ fontSize: 11, color: "#334155", marginTop: 6 }}>CTR transfers to the dead wallet will appear here automatically</div>
              </div>
            ) : (
              <>
                <div style={{ padding: "10px 16px", background: "#1a0a0a", borderBottom: "1px solid #3d1515", display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <span style={{ fontSize: 10, color: "#475569", marginRight: 6 }}>TOTAL BURNED:</span>
                    <span style={{ fontSize: 13, color: "#ff6b6b", fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>🔥 {fmtCompact(totalBurnedFromEvents)} CTR</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 10, color: "#475569", marginRight: 6 }}>TRANSACTIONS:</span>
                    <span style={{ fontSize: 13, color: "#94a3b8", fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>{burnEvents.length}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 10, color: "#475569", marginRight: 6 }}>LATEST:</span>
                    <span style={{ fontSize: 13, color: "#94a3b8", fontFamily: "'DM Mono',monospace" }}>{timeAgo(burnEvents[0].ts)}</span>
                  </div>
                </div>
                <div style={{ maxHeight: 400, overflowY: "auto" }}>
                  {burnEvents.map(e => (
                    <div key={e.id} className="burn-feed-row">
                      <div>
                        <div style={{ color: "#94a3b8", fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{timeAgo(e.ts)}</div>
                        <div style={{ fontSize: 10, color: "#334155" }}>{new Date(e.ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                      </div>
                      <div className="from-col">
                        <a href={`https://explorer.cronos.org/address/${e.from}`} target="_blank" rel="noopener noreferrer"
                          style={{ color: "#7c3aed", fontFamily: "'DM Mono',monospace", textDecoration: "none", fontSize: 12 }}>
                          {truncAddr(e.from)} ↗
                        </a>
                      </div>
                      <div>
                        <span style={{ color: "#ff6b6b", fontFamily: "'DM Mono',monospace", fontWeight: 600, fontSize: 13 }}>
                          🔥 {e.amount >= 1000 ? fmtCompact(e.amount) : fmt(e.amount, 2)} CTR
                        </span>
                      </div>
                      <div className="tx-col">
                        <a href={`https://explorer.cronos.org/tx/${e.txHash}`} target="_blank" rel="noopener noreferrer"
                          style={{ color: "#64ffda", fontFamily: "'DM Mono',monospace", textDecoration: "none", fontSize: 11 }}>
                          {truncHash(e.txHash)} ↗
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* How It Works */}
        <div className="section-card">
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #243152" }}>
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
                <div key={s.title} style={{ background: "#1a2440", borderRadius: 12, padding: 16, borderLeft: `3px solid ${s.color}` }}>
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
