// This is the client to test the x402-powered API
import 'dotenv/config';
import { wrapFetchWithPayment, decodeXPaymentResponse } from 'x402-fetch';
import { privateKeyToAccount } from 'viem/accounts';


// default wallet to check
const SOLANA_WALLET_TO_CHECK = 'EtD76A2kJXxvRSh2SGGYJcT95zEPTMnDB7ERAdBFPHtN';

type XPaymentResponse = {
  amount: string | number; // Use string | number to be safe
  tokenSymbol?: string;
  transactionHash?: string;
  [k: string]: any;
};

//Get's private key from .env
const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;

if (!privateKey) {
  console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.error('ERROR: PRIVATE_KEY is not defined in your .env file!');
  console.error('Please add it to your .env file and restart.');
  console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  process.exit(1);
}

// Create the viem account
const account = privateKeyToAccount(privateKey);

// This 'fetchWithPayment' will automatically handle 402 errors
const fetchWithPayment = wrapFetchWithPayment(fetch, account);

// The API endpoint and payload
const apiUrl = 'http://localhost:3001/api/check-reputation';
const payload = {
  walletAddress: SOLANA_WALLET_TO_CHECK,
};

//Run test
async function testApi() {
  console.log(`[Test Client] 🚀 Calling API to check wallet: ${SOLANA_WALLET_TO_CHECK}`);
  console.log(`[Test Client] 💰 Using wallet: ${account.address}`);
  console.log('...');

  try {
    const response: Response = await fetchWithPayment(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    console.log(`[Test Client] ✅ API responded with status: ${response.status}`);

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    // Log the payment info from the x-payment-response header
    const paymentHeader = response.headers.get('x-payment-response');
    
    if (paymentHeader) {
      console.log('\n[Test Client] 💳 Payment Details:');
      
      // I used 'any' to stop TypeScript errors and inspect the object
      const paymentInfo: any = decodeXPaymentResponse(paymentHeader);

      console.log(`[Test Client]   - Raw Header: ${paymentHeader}`);
      console.log(`[Test Client]   - Decoded Info:`, paymentInfo);
      console.log(`[Test Client]   - Amount: ${paymentInfo?.amount}`);
      console.log(`[Test Client]   - Tx Hash: ${paymentInfo?.transactionHash}`);
    }

    // Log the actual API response data
    const data = await response.json();
    console.log('\n[Test Client] 📊 Reputation Report:');
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('\n[Test Client] ❌ ERROR:');
    console.error(error);
  }
}

testApi();