Solana On-Chain Reputation Verifier (x402 Nanoservice)

This project is a dedicated **Pay-Per-Use API Nanoservice** that calculates an on-chain reputation score for any Solana wallet address. It is powered by a Daydreams AI agent and implements the x402 payment protocol for automatic micropayments in Base Sepolia ETH.

## Features

1. **x402 Powered API:** Charges a small micropayment (0.00001 ETH, approximately $0.03 USD) in Base Sepolia ETH for **every API request**.

2. **Daydreams Agent Core:** The core logic is powered by a Daydreams Context to easily manage the scoring algorithm and Solana blockchain interactions.

3. **Reputation Metrics:** The score is calculated based on four key metrics derived from on-chain data:

    * **Wallet Age:** Calculated from the oldest transaction.
    * **SOL Balance:** The current native SOL holdings.
    * **Transaction History:** Total transaction count (up to 1000+).
    * **Token Diversity:** Count of different SPL and Token-2022 accounts owned.

4 **Robust Payment Verification:** Uses a custom middleware with the Viem client to perform on-chain verification of the transaction and implements a **critical anti-replay check** to ensure transaction hashes are not reused.

5 **Simple Web UI:** Includes a clean `index.html` to connect a MetaMask/OKX wallet and demonstrate the paid API service end-to-end.

6 **Hono Server:** A fast, lightweight server hosts both the API and the front-end.

## ⚙️ How It Works (The x402 Flow)

This nanoservice follows the x402 standard to ensure payments are made automatically and securely per call.


### Technical Implementation

The Daydreams Agent action, `reputation.getReputationScore`, uses the `@solana/web3.js` library to connect to the Solana Mainnet-beta and fetch the required data for scoring.

## Getting Started

### Prerequisites

1.  **Node.js / npm:** Required to run the project.
2.  **Ethereum Wallet:** You need a wallet with a small amount of **Base Sepolia ETH** for testing payments.
3.  **MetaMask/ OKX:** For testing the Web UI (`index.html`).

 1\. Project Setup

Create a `.env` file in the root directory with your Ethereum wallet address:

```env
# Your receiving wallet address (must have Base Sepolia ETH)
ADDRESS=0xYourWalletAddressHere
# Optional: Port the server runs on
PORT=3001 
```

> **Note:** The server enforces this `ADDRESS` variable and will crash if it's missing or set to the placeholder `YourWallet`.

### 2\. Start the Server

Run the single command specified in the `package.json`:

```bash
npm run dev:server
```

This command will:

  1 Start the Daydreams Agent.

  2 Start the Hono API server and serve the website on **`http://localhost:3001`**.

  3 Log the payment address and price.

### 3\. Test the Website

Open your browser and navigate to:

```
http://localhost:3001
```

1.  Connect your EVM wallet (ensure it's on **Base Sepolia**).
2.  Paste a Solana address (the example is pre-filled: `EtD76A2kJXxvRSh2SGGYJcT95zEPTMnDB7ERAdBFPHtN`).
3.  Click **"Check Reputation ($0.03)"**.
4.  Approve the required transaction in MetaMask/ OKX.
5.  View the reputation report on screen\!

### 4\. Test the CLI Client

A command-line client is included for automated testing with a private key. You will need to add your private key to your `.env` file for this test:

```env
# ... other variables
PRIVATE_KEY=0xYourPrivateKeyHere
```

Then run the client:

```bash
npm run client
```

The client will automatically handle the payment flow using `x402-fetch` and display the final reputation report.

## 📂 File Structure

![x402 Payment Flow Screenshot](IMAGES/Screenshot (370).png)
1. `server.ts` ; The main Hono server. Contains the **custom x402 payment middleware** and API routes. 

2. `reputation.context.ts`; The "brain" of the project. A Daydreams Context defining the `getReputationScore` action and all Solana logic. 

3.`index.html`; he user-facing website with client-side logic for connecting MetaMask /OKX wallet and handling the x402 payment flow.

4. `client.ts`; A command-line script for testing the API directly using `x402-fetch`

### Developed for the Daydreams AI x402 Bounty