import 'dotenv/config';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { createDreams, LogLevel } from '@daydreamsai/core';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { reputationContext } from './reputation.context.ts';
import { createPublicClient, http, parseEther, formatEther } from 'viem';
import { baseSepolia } from 'viem/chains';

// CONFIGURATION
const payTo = (process.env.ADDRESS as `0x${string}`);
const SERVER_PORT = Number(process.env.PORT || 3001);

// ETH AMOUNT: 0.00001 ETH (approx $0.03 USD)
const REQUIRED_ETH_AMOUNT = "0.00001"; 
const REQUIRED_WEI = parseEther(REQUIRED_ETH_AMOUNT);

// In-memory store for consumed transaction hashes to prevent replay attacks.
const consumedTxHashes = new Set<string>();

// SAFETY CHECK
if (!payTo || payTo.includes("YourWallet")) {
  console.error("❌ CRITICAL: Set a REAL wallet address in .env (ADDRESS=...)");
  process.exit(1);
}

// SETUP VIEM CLIENT (For verifying payments on-chain)
const viemClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

console.log("--- SERVER STARTING ---");
console.log(`💰 Payment Address: ${payTo}`);
console.log(`🏷️  Price: ${REQUIRED_ETH_AMOUNT} ETH`);

// AGENT SETUp
const agent = createDreams({
  logLevel: LogLevel.INFO,
  contexts: [reputationContext],
});

// HONO App
const app = new Hono();

// MIDDLEWARE 1
app.use('*', cors({
  origin: '*',
  exposeHeaders: ['x-payment-required', 'x-payment-response', 'x-payment'],
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'x-payment', 'x-payment-response'],
  credentials: true
}));

// MIDDLEWARE 2: CUSTOM ETH PAYMENT VERIFICATION (With Anti-Replay)
// Used this to replaces the x402-hono library to fix the 402 loop and amount issue
app.use('/api/check-reputation', async (c, next) => {
  const paymentHeader = c.req.header('x-payment');

  // CASE A: No Payment Provided
  if (!paymentHeader) {
    console.log('[Payment] 🛑 No payment header. Requesting payment...');
    c.status(402);
    c.header('x-payment-required', JSON.stringify({
      address: payTo,
      amount: REQUIRED_ETH_AMOUNT, // Sends "0.00001"
      network: "base-sepolia",
      token: null 
    }));
    return c.json({ error: "Payment Required", amount: `${REQUIRED_ETH_AMOUNT} ETH` });
  }

  // CASE B: Payment Provided? Verify it on-chain
  try {
    console.log('[Payment] 🔍 Verifying transaction...');
    const paymentInfo = JSON.parse(paymentHeader);
    const txHash = paymentInfo.txHash;

    if (!txHash) throw new Error("Invalid payment header format");

    // Anti-Replay Check
    if (consumedTxHashes.has(txHash)) {
      console.error(`[Payment] ❌ Replay detected! TX: ${txHash}`);
      throw new Error("Transaction hash has already been used (Replay attack)");
    }
    
    // Fetch transaction from Base Sepolia
    const tx = await viemClient.getTransaction({ hash: txHash });

    // Check if it went to agent wallet
    if (tx.to?.toLowerCase() !== payTo.toLowerCase()) {
      console.error(`[Payment] ❌ Wrong recipient. Got: ${tx.to}, Expected: ${payTo}`);
      throw new Error("Payment sent to wrong address");
    }

    // Check if the amount is enough
    if (tx.value < REQUIRED_WEI) {
      console.error(`[Payment] ❌ Insufficient amount. Got: ${formatEther(tx.value)} ETH`);
      throw new Error("Insufficient ETH sent");
    }

    // Payment is valid? Record the hash and proceed.
    consumedTxHashes.add(txHash);
    console.log(`[Payment] ✅ Verified! TX: ${txHash}. Total used TXs: ${consumedTxHashes.size}`);
    
    await next();

  } catch (err: any) {
    console.error(`[Payment] ⚠️ Verification Failed: ${err.message}`);
    
    // verification fails? ask for payment again
    c.status(402);
    c.header('x-payment-required', JSON.stringify({
      address: payTo,
      amount: REQUIRED_ETH_AMOUNT,
      network: "base-sepolia"
    }));
    return c.json({ error: "Payment Verification Failed", details: err.message });
  }
});

app.post("/api/check-reputation", async (c) => {
  try {
    const body = await c.req.json();
    const walletAddress = body.walletAddress;

    if (!walletAddress) return c.json({ error: "walletAddress required" }, 400);

    // Run Daydreams Action
    const contextActions = (reputationContext as any).actions;
    const actionHandler = contextActions.find((a: any) => a.name === 'reputation.getReputationScore');

    if (!actionHandler) throw new Error("Reputation action not found");

    const result = await actionHandler.handler(
      { walletAddress },
      { memory: {}, args: {} }
    );

    return c.json(result);

  } catch (error: any) {
    console.error("❌ API Error:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Serve HTML
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const htmlFilePath = join(__dirname, 'index.html');
const htmlContent = readFileSync(htmlFilePath, 'utf-8');

app.get('/', (c) => c.html(htmlContent));

// START
(async () => {
  console.log('[Startup] Starting Agent...');
  await agent.start();
  serve({ fetch: app.fetch, port: SERVER_PORT }, () => {
    console.log(`\n✅ Server running: http://localhost:${SERVER_PORT}`);
    console.log(`💰 Price: ${REQUIRED_ETH_AMOUNT} ETH (Base Sepolia)`);
  });
})();