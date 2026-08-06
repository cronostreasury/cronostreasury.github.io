// scripts/burn-index.js — builds/updates public/burn-events.json
//
// Every CTR Transfer whose destination is a dead wallet is a burn. Finding
// all of them means walking the token's whole history with eth_getLogs,
// which is thousands of calls against a rate-limited public RPC — far too
// much to redo in every visitor's browser (that is exactly why the site's
// burn feed kept showing only a fraction of the burns).
//
// So the walk happens here, once, in CI: the result is committed as
// public/burn-events.json and the site just loads it. Runs are incremental
// (only blocks after `scannedTo` are scanned) and checkpoint their progress,
// so a rate-limited or interrupted run still moves the index forward instead
// of losing everything — the next run picks up where this one stopped.
//
// Usage: node scripts/burn-index.js [--from <block>] [--full]
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CRONOS_RPC = process.env.CRONOS_RPC || "https://evm.cronos.org";
const CTR_ADDRESS = "0xF3672F0cF2E45B28AC4a1D50FD8aC2eB555c21FC";
const OUT_FILE = path.join(__dirname, "../public/burn-events.json");

// Keep in sync with BURN_ADDRESSES in src/App.jsx
const BURN_ADDRESSES = [
  "0x000000000000000000000000000000000000dEaD",
  "0x0000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000001",
];
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const BURN_TOPICS = BURN_ADDRESSES.map(a => "0x" + a.slice(2).toLowerCase().padStart(64, "0"));

// The public Cronos RPC (Ethermint) caps eth_getLogs at 10,000 blocks
const INITIAL_CHUNK = 10_000;
const PARALLEL = 4;
// Re-scan this many blocks behind the last checkpoint to survive reorgs
const REORG_SAFETY_BLOCKS = 200;
// Stop and checkpoint before the CI job's own timeout can kill us mid-scan
const TIME_BUDGET_MS = Number(process.env.BURN_INDEX_BUDGET_MS || 20 * 60 * 1000);
// A single range returning this many logs is suspicious — nodes silently cap
// result sets, so split the range instead of trusting it
const TRUNCATION_GUARD = 1000;

const args = process.argv.slice(2);
const argFrom = args.includes("--from") ? parseInt(args[args.indexOf("--from") + 1], 10) : null;
const forceFull = args.includes("--full");

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const startedAt = Date.now();
const outOfTime = () => Date.now() - startedAt > TIME_BUDGET_MS;

// Smallest block range the node has accepted so far — chunks shrink to fit
let chunkSize = INITIAL_CHUNK;

// A range-cap rejection needs a smaller range, a transient failure just needs
// another try. Everything unknown is treated as transient (bounded retries).
function classifyError(message) {
  const m = (message || "").toLowerCase();
  if (/429|rate.?limit|too many request|timeout|timed out|econn|socket|fetch failed|network|50[234]/.test(m)) return "transient";
  if (/exceed|maximum|max |too large|range|too many results|query returned more than|limit/.test(m)) return "range";
  return "transient";
}

// Pull a block-range cap out of an error like "maximum [from, to] blocks distance: 10000"
function parseRangeCapHint(message) {
  for (const s of (message || "").match(/\d{3,}/g) || []) {
    const n = parseInt(s, 10);
    if (n >= 1000 && n <= 1_000_000) return n;
  }
  return null;
}

async function rpc(method, params, { retries = 4 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(CRONOS_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
      return json.result;
    } catch (e) {
      lastErr = e;
      // A range cap will fail identically no matter how often we retry
      if (classifyError(e.message) === "range") throw e;
      if (attempt === retries) break;
      await sleep(500 * 2 ** attempt + Math.random() * 300);
    }
  }
  throw lastErr;
}

async function getLogs(fromBlock, toBlock) {
  const result = await rpc("eth_getLogs", [{
    fromBlock: "0x" + fromBlock.toString(16),
    toBlock: "0x" + toBlock.toString(16),
    address: CTR_ADDRESS,
    // Transfer(from, to, value) where `to` is any dead wallet — an array in a
    // topic position is OR-matched by the node
    topics: [TRANSFER_TOPIC, null, BURN_TOPICS],
  }]);
  if (!Array.isArray(result)) throw new Error("eth_getLogs returned no result");
  return result;
}

// getLogs for a range, splitting it whenever the node rejects the range or
// returns a suspiciously round number of logs (silent result-set capping).
async function getLogsSplitting(fromBlock, toBlock, depth = 0) {
  try {
    const logs = await getLogs(fromBlock, toBlock);
    if (logs.length >= TRUNCATION_GUARD && toBlock > fromBlock && depth < 16) {
      const mid = Math.floor((fromBlock + toBlock) / 2);
      const [a, b] = [await getLogsSplitting(fromBlock, mid, depth + 1), await getLogsSplitting(mid + 1, toBlock, depth + 1)];
      return [...a, ...b];
    }
    return logs;
  } catch (e) {
    if (classifyError(e.message) !== "range" || toBlock <= fromBlock || depth >= 16) throw e;
    const span = toBlock - fromBlock + 1;
    const hint = parseRangeCapHint(e.message);
    const size = Math.max(1, hint && hint < span ? hint : Math.floor(span / 2));
    if (size < chunkSize) {
      chunkSize = size;
      console.log(`⚙️  RPC rejected a ${span}-block range — chunk size is now ${size}`);
    }
    const out = [];
    for (let f = fromBlock; f <= toBlock; f += size) {
      out.push(...await getLogsSplitting(f, Math.min(f + size - 1, toBlock), depth + 1));
    }
    return out;
  }
}

function normalizeLog(log) {
  return {
    txHash: log.transactionHash,
    logIndex: parseInt(log.logIndex, 16),
    blockNumber: parseInt(log.blockNumber, 16),
    from: ("0x" + log.topics[1].slice(26)).toLowerCase(),
    to: ("0x" + log.topics[2].slice(26)).toLowerCase(),
    valueWei: BigInt(log.data || "0x0").toString(),
    ts: 0,
  };
}

// Scan [fromBlock, toBlock] in order, returning how far we got. Ranges are
// only ever reported as scanned once every batch before them succeeded, so
// the checkpoint never straddles a gap.
async function scan(fromBlock, toBlock) {
  const logs = [];
  let cursor = fromBlock;
  let scannedTo = fromBlock - 1;
  let error = null;

  while (cursor <= toBlock) {
    if (outOfTime()) {
      error = `time budget reached at block ${cursor}`;
      break;
    }
    const batch = [];
    for (let i = 0; i < PARALLEL && cursor <= toBlock; i++) {
      const end = Math.min(cursor + chunkSize - 1, toBlock);
      batch.push([cursor, end]);
      cursor = end + 1;
    }
    try {
      const results = await Promise.all(batch.map(([f, t]) => getLogsSplitting(f, t)));
      for (const r of results) logs.push(...r);
      scannedTo = batch[batch.length - 1][1];
    } catch (e) {
      // Checkpoint at the last fully scanned block; the next run resumes here
      error = `${e.message} (at block ${batch[0][0]})`;
      break;
    }
    const done = scannedTo - fromBlock + 1;
    const total = toBlock - fromBlock + 1;
    if (done % (chunkSize * PARALLEL * 25) < chunkSize * PARALLEL) {
      console.log(`   … block ${scannedTo} (${((done / total) * 100).toFixed(1)}%) · ${logs.length} burns`);
    }
    await sleep(60);
  }

  return { logs, scannedTo, error };
}

async function resolveTimestamps(events) {
  const pending = events.filter(e => !e.ts);
  if (pending.length === 0) return;
  const blocks = [...new Set(pending.map(e => e.blockNumber))];
  console.log(`🕒 Resolving timestamps for ${blocks.length} blocks...`);
  const tsByBlock = {};
  const BATCH = 10;
  for (let i = 0; i < blocks.length; i += BATCH) {
    const batch = blocks.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(async b => {
      try {
        const block = await rpc("eth_getBlockByNumber", ["0x" + b.toString(16), false]);
        return block?.timestamp ? Number(BigInt(block.timestamp)) * 1000 : 0;
      } catch { return 0; }
    }));
    batch.forEach((b, idx) => { tsByBlock[b] = results[idx]; });
  }
  for (const e of pending) e.ts = tsByBlock[e.blockNumber] || 0;
}

// Binary-search the block CTR was deployed in, so the first full scan does not
// start at genesis. Only trusted when the node actually serves historical
// state — a pruned node answers "0x" for every old block and would put the
// deploy block right at its pruning boundary, hiding every earlier burn.
async function findDeployBlock(currentBlock) {
  try {
    const atGenesis = await rpc("eth_getCode", [CTR_ADDRESS, "0x1"]);
    const atHead = await rpc("eth_getCode", [CTR_ADDRESS, "latest"]);
    if (!atHead || atHead === "0x") throw new Error("no code at head — wrong token address?");
    if (atGenesis && atGenesis !== "0x") throw new Error("node returns code at block 1 — history not reliable");

    let lo = 1, hi = currentBlock;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const code = await rpc("eth_getCode", [CTR_ADDRESS, "0x" + mid.toString(16)]);
      if (code && code !== "0x") hi = mid; else lo = mid + 1;
    }
    console.log(`📍 CTR deploy block: ${lo}`);
    return lo;
  } catch (e) {
    console.log(`⚠️  Deploy-block lookup failed (${e.message}) — scanning from genesis`);
    return 1;
  }
}

function loadExisting() {
  if (forceFull || !fs.existsSync(OUT_FILE)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(OUT_FILE, "utf8"));
    if (data?.token?.toLowerCase() !== CTR_ADDRESS.toLowerCase()) return null;
    if (!Array.isArray(data.events) || !Number.isFinite(data.scannedTo)) return null;
    return data;
  } catch {
    return null;
  }
}

async function main() {
  console.log("🔥 Building CTR burn index...");
  const currentBlock = Number(BigInt(await rpc("eth_blockNumber", [])));
  const existing = loadExisting();

  let startBlock;
  let events;
  if (existing && existing.scannedTo > 0) {
    startBlock = Number.isFinite(existing.startBlock) ? existing.startBlock : 1;
    events = existing.events.map(e => ({ ...e }));
    console.log(`📂 Existing index: ${events.length} burns, scanned ${startBlock} → ${existing.scannedTo}`);
  } else {
    startBlock = Number.isFinite(argFrom) ? argFrom : await findDeployBlock(currentBlock);
    events = [];
    console.log(`🆕 No usable index — full scan from block ${startBlock}`);
  }

  const scanFrom = existing && existing.scannedTo > 0
    ? Math.max(startBlock, existing.scannedTo + 1 - REORG_SAFETY_BLOCKS)
    : startBlock;

  let scannedTo = existing?.scannedTo ?? startBlock - 1;
  let error = null;

  if (scanFrom <= currentBlock) {
    console.log(`🔍 Scanning blocks ${scanFrom} → ${currentBlock} (${currentBlock - scanFrom + 1} blocks)`);
    const result = await scan(scanFrom, currentBlock);
    error = result.error;
    if (result.scannedTo >= scanFrom) scannedTo = Math.max(scannedTo, result.scannedTo);

    const seen = new Set(events.map(e => `${e.txHash.toLowerCase()}-${e.logIndex}`));
    let added = 0;
    for (const log of result.logs.map(normalizeLog)) {
      const key = `${log.txHash.toLowerCase()}-${log.logIndex}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push(log);
      added++;
    }
    console.log(`✅ Scan reached block ${scannedTo} · ${added} new burn events`);
    if (error) console.log(`⚠️  Scan stopped early: ${error} — will resume next run`);
  } else {
    console.log("✅ Index already up to date");
  }

  await resolveTimestamps(events);

  events.sort((a, b) => (b.blockNumber - a.blockNumber) || (b.logIndex - a.logIndex));

  const totalWei = events.reduce((s, e) => s + BigInt(e.valueWei), 0n);
  const out = {
    token: CTR_ADDRESS.toLowerCase(),
    burnAddresses: BURN_ADDRESSES.map(a => a.toLowerCase()),
    startBlock,
    scannedTo,
    complete: !error,
    updatedAt: new Date().toISOString(),
    eventCount: events.length,
    totalBurnedWei: totalWei.toString(),
    totalBurned: Number(totalWei) / 1e18,
    events,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 1));
  console.log(`💾 Saved ${events.length} burn events (${(Number(totalWei) / 1e18).toLocaleString("en-US")} CTR) to burn-events.json`);
}

main().catch(e => { console.error(e); process.exit(1); });
