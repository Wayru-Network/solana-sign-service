import { LAMPORTS_PER_SOL, PublicKey, Transaction, VersionedTransaction, TransactionMessage } from "@solana/web3.js";
import { BN } from "bn.js";
import { getAirdropsProgram, getSolanaConnection, convertToTokenAmount } from "../solana/solana.service";
import { ENV } from "@config/env/env";
import { getKeyPairFromUnit8Array } from "@helpers/solana/solana.helpers";
import { SimulationResult } from "@interfaces/request-transaction/request-transaction.interface";
import { SIMULATE_REQUEST_TX_CODES } from "@errors/request-transaction/request-transaction";
import { getAssociatedTokenAddress } from "@solana/spl-token";

export const simulateClaimWCreditsTransaction = async (
    walletAddress: string,
): Promise<SimulationResult> => {
    try {
        const program = await getAirdropsProgram();
        const connection = await getSolanaConnection();
        const adminKeypair = getKeyPairFromUnit8Array(Uint8Array.from(JSON.parse(ENV.ADMIN_REWARD_SYSTEM_PRIVATE_KEY as string)));
        
        // validate wallet address
        try {
            new PublicKey(walletAddress); // Ensure the address is valid
        } catch (error) {
            return {
                feeInLamports: 0,
                feeInSol: 0,
                success: false,
                error: 'Invalid wallet address format',
                code: SIMULATE_REQUEST_TX_CODES.INVALID_WALLET_ADDRESS
            }
        }

        const user = new PublicKey(walletAddress);
        
        // get user balance
        const userBalance = await connection.getBalance(user);
        
        // create instruction
        const amount = new BN(convertToTokenAmount(52));
        const nonce = new BN(Date.now());

        // Usar la misma estructura de cuentas que la función que funciona
        const ix = await program.methods
            .claimTokens(amount, nonce)
            .accounts({
                userAdmin: adminKeypair.publicKey,
                user: user,
                tokenMint: new PublicKey(ENV.REWARD_TOKEN_MINT),
            })
            .instruction();

        // get last blockhash
        const { blockhash } = await connection.getLatestBlockhash();

        // create transaction message
        const messageV0 = new TransactionMessage({
            payerKey: user,
            recentBlockhash: blockhash,
            instructions: [ix],
        }).compileToV0Message();

        // create versioned transaction
        const transaction = new VersionedTransaction(messageV0);
        transaction.sign([adminKeypair]);

        // simulate and get fee
        const fees = await connection.getFeeForMessage(messageV0);
        const feeInLamports = fees.value || 0;

        // calculate the space needed for the claim entry account
        const CLAIM_ENTRY_SIZE = 8 + 8 + 8; // discriminator + lastClaimedNonce + totalClaimed

        // get rent exempt for the claim entry account
        const rentExemptClaimEntry = await connection.getMinimumBalanceForRentExemption(CLAIM_ENTRY_SIZE);

        // get rent exempt for the token account if it doesn't exist
        const userTokenAccount = await getAssociatedTokenAddress(
            new PublicKey(ENV.REWARD_TOKEN_MINT),
            user
        );
        const userTokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
        const tokenAccountRent = !userTokenAccountInfo ? 
            await connection.getMinimumBalanceForRentExemption(165) : // standar size of the token account
            0;

        // calculate the total required balance
        const requiredBalance = feeInLamports + // transaction fee
            rentExemptClaimEntry + // rent for claim entry
            tokenAccountRent; // rent for token account if necessary

        const hasEnoughBalance = userBalance >= requiredBalance;

        if (!hasEnoughBalance) {
            return {
                feeInLamports,
                feeInSol: feeInLamports / LAMPORTS_PER_SOL,
                success: false,
                error: "Insufficient balance for transaction and account creation",
                code: SIMULATE_REQUEST_TX_CODES.INSUFFICIENT_BALANCE,
                details: {
                    hasEnoughBalance,
                    userBalance: userBalance / LAMPORTS_PER_SOL,
                    requiredBalance: requiredBalance / LAMPORTS_PER_SOL,
                    breakdown: {
                        transactionFee: feeInLamports / LAMPORTS_PER_SOL,
                        claimEntryRent: rentExemptClaimEntry / LAMPORTS_PER_SOL,
                        tokenAccountRent: tokenAccountRent / LAMPORTS_PER_SOL
                    }
                }
            };
        }

        // simulate transaction using the new method
        const simulation = await connection.simulateTransaction(transaction);
        
        if (simulation.value.err) {
            console.log('simulation failed', simulation.value.err);
            return {
                feeInLamports,
                feeInSol: feeInLamports / LAMPORTS_PER_SOL,
                success: false,
                error: `Simulation failed: ${simulation.value.err.toString()}`,
                code: SIMULATE_REQUEST_TX_CODES.SIMULATION_FAILED,
                details: {
                    hasEnoughBalance,
                    userBalance: userBalance / LAMPORTS_PER_SOL,
                    requiredBalance: requiredBalance / LAMPORTS_PER_SOL,
                    rentExemptBalance: rentExemptClaimEntry / LAMPORTS_PER_SOL
                }
            };
        }
        
        return {
            feeInLamports,
            feeInSol: feeInLamports / LAMPORTS_PER_SOL,
            success: true,
            code: SIMULATE_REQUEST_TX_CODES.SUCCESS,
            details: {
                hasEnoughBalance,
                userBalance: userBalance / LAMPORTS_PER_SOL,
                requiredBalance: requiredBalance / LAMPORTS_PER_SOL,
                rentExemptBalance: rentExemptClaimEntry / LAMPORTS_PER_SOL
            }
        };

    } catch (error) {
        console.error('Error simulate claim w credits transaction:', error);
        return {
            feeInLamports: 0,
            feeInSol: 0,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            code: SIMULATE_REQUEST_TX_CODES.UNKNOWN_ERROR
        };
    }
};
