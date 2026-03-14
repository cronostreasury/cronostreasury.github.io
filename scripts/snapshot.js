// scripts/snapshot.js — ES Module (compatible with "type": "module" in package.json)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WALLET = "0x96a6cd06338efe754f200aba9ff07788c16e5f20";
const CRONOS_RPC = "https://evm.cronos.org";
const HISTORY_FILE = path.join(__dirname, "../public/treasury-history.json");

const TOKENS = [
  { symbol: "CDCBTC", address: "0x2e53c5586e12a99d4CAE366E9Fc5C14fE9c6495d", decimals: 8 },
  { symbol: "CDCETH", address: "0x7a7c9db510aB29A2FC362a4c34260BEcB5cE3446", decimals: 18 },
  { symbol: "LCRO",   address: "0x9Fae23A2700FEeCd5b93e43fDBc03c76AA7C08A6", decimals: 18 },
  { symbol: "USDC",   address: "0xc21223249CA28397B4B6541dfFaEcC539BfF0c59", decimals: 6 },
  { symbol: "PACK",   address: "0x0d0b4a6FC6e7f5635C2FF38dE75AF2e96D6D6804", decimals: 18 },
  { symbol: "CTR",    address: "0xF3672F0cF2E45B28AC4a1D50FD8aC2eB555c21FC", decimals: 18 },
];

async function rpcCall(body) {
  const res = await fetch(CRONOS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function getTokenBalance(tokenAddress, decimals) {
  const data = "0x70a08231" + WALLET.slice(2).padStart(64, "0");
  const json = await rpcCall({
    jsonrpc: "2.0", method: "eth_call",
    params: [{ to: tokenAddress, data }, "latest"], id: 1,
  });
  const raw = BigInt(json.result || "0x0");
  return Number(raw) / Math.pow(10, decimals);
}

async function getPrices() {
  const addrs = TOKENS.filter(t => t.symbol !== "USDC").map(t => t.address).join(",");
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addrs}`);
  const data = await res.json();
  const priceMap = { USDC: 1.0 };
  (data.pairs || []).forEach(pair => {
    const addr = pair.baseToken?.address?.toLowerCase();
    const price = parseFloat(pair.priceUsd);
    const liq = parseFloat(pair.liquidity?.usd || 0);
    const sym = TOKENS.find(t => t.address.toLowerCase() === addr)?.symbol;
    if (sym && !isNaN(price) && (!priceMap[sym] || liq > (priceMap[sym + "_liq"] || 0))) {
      priceMap[sym] = price;
      priceMap[sym + "_liq"] = liq;
    }
  });
  return priceMap;
}

const STAKED_PACK_AMOUNT = 1393025; // manually tracked – update when staking changes

async function main() {
  console.log("📸 Taking treasury snapshot...");

  const [balances, prices] = await Promise.all([
    Promise.all(TOKENS.map(t => getTokenBalance(t.address, t.decimals))),
    getPrices(),
  ]);

  const holdings = {};
  let tvl = 0;
  TOKENS.forEach((t, i) => {
    const price = prices[t.symbol] || 0;
    const value = balances[i] * price;
    holdings[t.symbol] = { amount: balances[i], price, value };
    tvl += value;
  });

  // Add staked PACK (Wolfswap Vault – not in wallet)
  const packPrice = prices["PACK"] || 0;
  const stakedPackValue = STAKED_PACK_AMOUNT * packPrice;
  holdings["PACK_STAKED"] = { amount: STAKED_PACK_AMOUNT, price: packPrice, value: stakedPackValue };
  tvl += stakedPackValue;
  console.log(`🔒 Staked PACK: ${STAKED_PACK_AMOUNT} × $${packPrice} = $${stakedPackValue.toFixed(2)}`);

  const snapshot = {
    date: new Date().toISOString().split("T")[0],
    tvl: parseFloat(tvl.toFixed(2)),
    holdings,
  };

  console.log(`✅ TVL: $${tvl.toFixed(2)}`);

  let history = [];
  if (fs.existsSync(HISTORY_FILE)) {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
  }

  const todayIdx = history.findIndex(e => e.date === snapshot.date);
  if (todayIdx >= 0) {
    history[todayIdx] = snapshot;
    console.log("📝 Updated existing entry for today");
  } else {
    history.push(snapshot);
    console.log("➕ Added new entry");
  }

  if (history.length > 365) history = history.slice(-365);

  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  console.log(`💾 Saved ${history.length} entries to treasury-history.json`);
}

main().catch(e => { console.error(e); process.exit(1); });
