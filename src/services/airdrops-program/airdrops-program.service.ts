import { ComputeBudgetProgram, Transaction } from "@solana/web3.js";
import { getSolanaPriorityFee } from "@helpers/solana/solana.helpers";
import { ENV } from "@config/env/env";
import { getRewardTokenMint } from "@helpers/solana/solana.helpers";
import { getKeyPairFromUnit8Array } from "@helpers/solana/solana.helpers";
import { AirdropsSystemManager } from "@services/solana/contracts/airdrop-system.manager";
import { getSolanaConnection } from "@services/solana/solana.connection";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { convertToTokenAmount } from "@services/solana/solana.service";


export const prepareTransactionToClaimLostTokens = async (userWallet: PublicKey, nonce: number): Promise<string | null> => {
    try {
         // get program 
         const program = await AirdropsSystemManager.getInstance();
         const adminKeypair = getKeyPairFromUnit8Array(Uint8Array.from(JSON.parse(ENV.ADMIN_REWARD_SYSTEM_PRIVATE_KEY as string)));
         const user = new PublicKey(userWallet); // owner of the NFT
         const connection = getSolanaConnection();
         const rewardTokenMint = await getRewardTokenMint();
         // Add priority fee
         const priorityFeeInSol = await getSolanaPriorityFee();
         const microLamportsPerComputeUnit = Math.floor(priorityFeeInSol * 1_000_000);
         // the lost tokens always are 5,000
         const amountToClaim = 5000;
 
         // amount to claim
         const amount = new BN(convertToTokenAmount(amountToClaim));
         const ix = await program.methods
             .claimTokens(amount, new BN(new Date().getTime()))
             .accounts({
                 userAdmin: adminKeypair.publicKey,
                 user: user,
                 tokenMint: new PublicKey(rewardTokenMint),
             })
             .instruction();
 
         const tx = new Transaction();
         tx.add(
             ComputeBudgetProgram.setComputeUnitPrice({
                 microLamports: microLamportsPerComputeUnit,
             }),
             ix
         );
         tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
         tx.feePayer = user;
         tx.partialSign(adminKeypair);
 
         // serialize tx
         const serializedTx = tx.serialize({
             requireAllSignatures: false,
             verifySignatures: false,
         });
         const txBase64 = serializedTx.toString("base64");
         return txBase64;
    } catch (error) {
        console.error('Error preparing transaction to claim lost tokens:', error);
        return null;
    }
}