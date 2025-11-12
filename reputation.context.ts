// This is the core logic for the reputation engine.
import { context, action } from '@daydreamsai/core';
import { z } from 'zod';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

// Create and exports the Daydreams Context
export const reputationContext = context({
  type: 'reputation',
})
// Chain ".setActions()" to define the action
.setActions([
  // Defines the one and only action inside the array
  action({
    name: 'reputation.getReputationScore',
    description: 'Gets the on-chain reputation score for a Solana wallet.',
    schema: z.object({
      walletAddress: z.string().describe('The Solana wallet address to check'),
    }) as any,
    
    // The main logic handler
    handler: async ({ walletAddress }: { walletAddress: string }) => {
      
      try {
        console.log(`[Reputation Engine] Checking wallet: ${walletAddress}`);
        const connection = new Connection('https://api.mainnet-beta.solana.com');
        const pubKey = new PublicKey(walletAddress);

        // Get Wallet Age (Oldest Transaction)
        const signatures = await connection.getSignaturesForAddress(pubKey, {
          limit: 1000, // Get the max allowed
        });
        
        let walletAgeInDays = 0;
        if (signatures.length > 0) {
          const oldestSignature = signatures[signatures.length - 1];
          if (oldestSignature && oldestSignature.blockTime) {
            const oldestTxDate = new Date(oldestSignature.blockTime * 1000);
            const today = new Date();
            const diffTime = Math.abs(today.getTime() - oldestTxDate.getTime());
            walletAgeInDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }
        }

        // Get Other Metrics (in parallel)
        const balancePromise = connection.getBalance(pubKey);
        const tokenAccountsPromise = connection.getTokenAccountsByOwner(pubKey, { programId: TOKEN_PROGRAM_ID });
        const token2022AccountsPromise = connection.getTokenAccountsByOwner(pubKey, { programId: TOKEN_2022_PROGRAM_ID });

        const [lamports, tokenAccounts, token2022Accounts] = await Promise.all([
          balancePromise,
          tokenAccountsPromise,
          token2022AccountsPromise
        ]);

        // Calculate All Metrics
        const transactionCount = signatures.length;
        const solBalance = lamports / LAMPORTS_PER_SOL;
        const tokenDiversityCount = tokenAccounts.value.length + token2022Accounts.value.length;

        // Calculate The Final Reputation Score
        let score = 0;
        let reputation = "Low (New Wallet)";
        let txCountDisplay = transactionCount.toString();

        // Score for Wallet Age (Max 20 pts)
        if (walletAgeInDays > 120) score += 10;  // > 1 month
        if (walletAgeInDays > 365) score += 10; // > 1 year

        // Score for SOL balance (Max 40 pts)
        if (solBalance > 0.1) score += 20;
        if (solBalance > 1.0) score += 20;

        // Score for transaction count (Max 20 pts)
        if (transactionCount > 25) score += 5;
        if (transactionCount > 100) score += 5;
        if (transactionCount === 1000) {
          score += 10; // "1000+" is a power user.
          txCountDisplay = "1000+";
        }

        // Score for token diversity (Max 20 pts)
        if (tokenDiversityCount > 3) score += 10; // Holds a few tokens
        if (tokenDiversityCount > 10) score += 10; // Holds many tokens (OG User)

        // Determine the final reputation string
        if (score >= 80) {
          reputation = "High (OG Wallet)";
        } else if (score >= 40) {
          reputation = "Medium (Established)";
        }

        // Return a Clean JSON Object
        return {
          success: true,
          wallet: walletAddress,
          reputation: reputation,
          score: score,
          metrics: {
            walletAgeInDays: walletAgeInDays,
            solBalance: solBalance.toFixed(4),
            txCount: txCountDisplay,
            tokenDiversity: tokenDiversityCount
          }
        };

      } catch (error: any) {
        console.error(`[Reputation Engine] Error for ${walletAddress}:`, error.message);
        let errorMessage = "An unknown error occurred";
        if (error instanceof Error) {
          // Handle the common "Invalid public key" error
          if (error.message.includes('Invalid public key')) {
            errorMessage = "Invalid Solana wallet address provided.";
          } else {
            errorMessage = error.message;
          }
        }
        
        return {
          success: false,
          wallet: walletAddress,
          error: errorMessage
        };
      }
    },
  })
]);