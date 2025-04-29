import { LAMPORTS_PER_SOL, PublicKey, VersionedTransaction, TransactionMessage } from "@solana/web3.js";
import { BN } from "bn.js";
import { convertToTokenAmount, getUserNFTTokenAccount, getAdminKeypair } from "../solana/solana.service";
import { ENV } from "@config/env/env";
import { getKeyPairFromUnit8Array } from "@helpers/solana/solana.helpers";
import { } from "@interfaces/request-transaction/request-transaction.interface";
import { SIMULATE_REQUEST_TX_CODES } from "@errors/request-transaction/request-transaction";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getRewardTokenMint } from "@helpers/solana/solana.helpers";
import { SystemProgram } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { SimulateInitNfnodeParams, SimulationResult } from "@interfaces/request-transaction/simulate-request-tx.interfaces";
import { getNFNodeTypeRecord } from "@helpers/request-transaction/request-transaction.helper";
import { getSolanaConnection } from "@services/solana/solana.connection";
import { RewardSystemManager } from "@services/solana/contracts/reward-system.manager";
import { AirdropsSystemManager } from "@services/solana/contracts/airdrop-system.manager";
import { simulationCache } from '../simulation-cache/simulation-cache.service';

export const simulateClaimWCreditsTransaction = async (
    walletAddress: string,
): Promise<SimulationResult> => {
    // alway use simulation cache
    return simulationCache.getOrExecute(
        { type: 'claim_w_credits', walletAddress },
        async () => {
            try {
                const program = await AirdropsSystemManager.getInstance();
                const connection = getSolanaConnection();
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
                const amount = new BN(convertToTokenAmount(1));
                const nonce = new BN(Date.now());

                // Use the same account structure as the function that works
                const rewardTokenMint = await getRewardTokenMint();
                const ix = await program.methods
                    .claimTokens(amount, nonce)
                    .accounts({
                        userAdmin: adminKeypair.publicKey,
                        user: user,
                        tokenMint: new PublicKey(rewardTokenMint),
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
                const tokenMint = await getRewardTokenMint();
                const userTokenAccount = await getAssociatedTokenAddress(
                    new PublicKey(tokenMint),
                    user
                );
                const userTokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
                const userTokenAccountRent = !userTokenAccountInfo
                    ? await connection.getMinimumBalanceForRentExemption(165)
                    : 0;

                // calculate the total required balance
                const requiredBalance = feeInLamports + // transaction fee
                    rentExemptClaimEntry + // rent for claim entry
                    userTokenAccountRent; // rent for token account if necessary

                const hasEnoughBalance = userBalance >= requiredBalance;

                if (!hasEnoughBalance) {
                    return {
                        feeInLamports,
                        feeInSol: requiredBalance / LAMPORTS_PER_SOL,
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
                                userTokenAccountRent: userTokenAccountRent / LAMPORTS_PER_SOL
                            }
                        }
                    };
                }

                // simulate transaction using the new method
                const simulation = await connection.simulateTransaction(transaction, {
                    commitment: 'confirmed',
                    sigVerify: false,
                    replaceRecentBlockhash: true
                });

                if (simulation.value.err) {
                    console.log('simulation logs:', simulation.value.logs);
                    return {
                        feeInLamports,
                        feeInSol: requiredBalance / LAMPORTS_PER_SOL,
                        success: false,
                        error: JSON.stringify(simulation.value.err),
                        code: SIMULATE_REQUEST_TX_CODES.SIMULATION_FAILED,
                        details: {
                            hasEnoughBalance,
                            userBalance: userBalance / LAMPORTS_PER_SOL,
                            requiredBalance: requiredBalance / LAMPORTS_PER_SOL,
                            rentExemptBalance: rentExemptClaimEntry / LAMPORTS_PER_SOL,
                            breakdown: {
                                transactionFee: feeInLamports / LAMPORTS_PER_SOL,
                                claimEntryRent: rentExemptClaimEntry / LAMPORTS_PER_SOL,
                                userTokenAccountRent: userTokenAccountRent / LAMPORTS_PER_SOL
                            }
                        }
                    };
                }

                return {
                    feeInLamports,
                    feeInSol: requiredBalance / LAMPORTS_PER_SOL,
                    success: true,
                    code: SIMULATE_REQUEST_TX_CODES.SUCCESS,
                    details: {
                        hasEnoughBalance,
                        userBalance: userBalance / LAMPORTS_PER_SOL,
                        requiredBalance: requiredBalance / LAMPORTS_PER_SOL,
                        rentExemptBalance: rentExemptClaimEntry / LAMPORTS_PER_SOL,
                        breakdown: {
                            transactionFee: feeInLamports / LAMPORTS_PER_SOL,
                            claimEntryRent: rentExemptClaimEntry / LAMPORTS_PER_SOL,
                            userTokenAccountRent: userTokenAccountRent / LAMPORTS_PER_SOL
                        }
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
        }
    );
};

export const simulateInitializeNfnodeTransaction = async (
    { walletAddress,
        nftMintAddress,
        nfnodeType
    }: SimulateInitNfnodeParams): Promise<SimulationResult> => {
    return simulationCache.getOrExecute(
        { 
            type: 'initialize_nfnode', 
            walletAddress, 
            nftMintAddress, 
            nfnodeType 
        },
        async () => {
            try {
                const program = await RewardSystemManager.getInstance();
                const connection = getSolanaConnection();
                const tokenMint = await getRewardTokenMint();

                // Initialize public keys
                const user = new PublicKey(walletAddress);
                const nftMint = new PublicKey(nftMintAddress);
                const host = new PublicKey('8QMK1JHzjydq7qHgTo1RwK3ateLm4zVQF7V7BkriNkeD');
                const manufacturer = new PublicKey('FCap4kWAPMMTvAqUgEX3oFmMmSzg7g3ytxknYD21hpzm');
                const adminKeypair = getAdminKeypair();

                // Get PDAs and accounts
                const userNftTokenAccount = await getUserNFTTokenAccount(nftMint, user);
                const [nfnodeEntryPDA] = PublicKey.findProgramAddressSync(
                    [Buffer.from("nfnode_entry"), nftMint.toBuffer()],
                    program.programId
                );
                const [adminAccountPDA] = PublicKey.findProgramAddressSync(
                    [Buffer.from("admin_account")],
                    program.programId
                );
                const [tokenStorageAuthority] = PublicKey.findProgramAddressSync(
                    [Buffer.from("token_storage"), nftMint.toBuffer()],
                    program.programId
                );

                // Get ATAs
                const userTokenAccount = await getAssociatedTokenAddress(
                    new PublicKey(tokenMint),
                    user
                );
                const tokenStorageAccount = await getAssociatedTokenAddress(
                    new PublicKey(tokenMint),
                    tokenStorageAuthority,
                    true
                );

                // Check if the userTokenAccount exists
                const userTokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
                const userTokenAccountRent = !userTokenAccountInfo
                    ? await connection.getMinimumBalanceForRentExemption(165)
                    : 0;

                // Check if the tokenStorageAccount exists
                const tokenStorageAccountInfo = await connection.getAccountInfo(tokenStorageAccount);
                const tokenStorageAccountRent = !tokenStorageAccountInfo
                    ? await connection.getMinimumBalanceForRentExemption(165)
                    : 0;

                // Add initialize nfnode instruction
                const accounts = {
                    userAdmin: adminKeypair.publicKey,
                    user,
                    nftMintAddress: nftMint,
                    userNftTokenAccount,
                    host,
                    manufacturer,
                    tokenMint: new PublicKey(tokenMint),
                    nfnodeEntry: nfnodeEntryPDA,
                    adminAccount: adminAccountPDA,
                    tokenStorageAuthority,
                    tokenStorageAccount,
                    userTokenAccount,
                    tokenProgram2022: TOKEN_2022_PROGRAM_ID,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId
                } as const;

                const initializeNfnodeIx = await program.methods
                    .initializeNfnode(new BN(0), getNFNodeTypeRecord(nfnodeType))
                    .accounts(accounts)
                    .instruction();

                // Get latest blockhash
                const latestBlockhash = await connection.getLatestBlockhash();

                // Create TransactionMessage
                const messageV0 = new TransactionMessage({
                    payerKey: user,
                    recentBlockhash: latestBlockhash.blockhash,
                    instructions: [initializeNfnodeIx]
                }).compileToV0Message();

                // Create VersionedTransaction
                const transaction = new VersionedTransaction(messageV0);

                // Get user's current balance
                const userBalance = await connection.getBalance(user);
                
                // Calculate rent exempt for nfnode entry
                const nfnodeEntryRent = await connection.getMinimumBalanceForRentExemption(165);

                // Get transaction fee
                const transactionFee = await connection.getFeeForMessage(messageV0);
                if (transactionFee.value === null) {
                    throw new Error('Failed to get fee for message');
                }
                const feeInLamports = transactionFee.value || 0;

                // Sum all required lamports
                const totalRequired =
                    nfnodeEntryRent +
                    userTokenAccountRent +
                    tokenStorageAccountRent +
                    feeInLamports;

                // Simulate transaction
                const simulation = await connection.simulateTransaction(transaction);

                if (simulation.value.err) {
                    console.log('simulation logs:', simulation.value.logs);
                    return {
                        success: false,
                        feeInLamports: feeInLamports,
                        feeInSol: totalRequired / LAMPORTS_PER_SOL,
                        error: JSON.stringify(simulation.value.err),
                        details: {
                            hasEnoughBalance: userBalance >= totalRequired,
                            userBalance: userBalance / LAMPORTS_PER_SOL,
                            requiredBalance: totalRequired / LAMPORTS_PER_SOL,
                            rentExemptBalance: nfnodeEntryRent / LAMPORTS_PER_SOL,
                            breakdown: {
                                transactionFee: transactionFee.value / LAMPORTS_PER_SOL,
                                nfnodeEntryRent: nfnodeEntryRent / LAMPORTS_PER_SOL,
                                userTokenAccountRent: userTokenAccountRent / LAMPORTS_PER_SOL,
                                tokenStorageAccountRent: tokenStorageAccountRent / LAMPORTS_PER_SOL,
                            }
                        }
                    };
                }

                return {
                    success: true,
                    feeInLamports: feeInLamports,
                    feeInSol: totalRequired / LAMPORTS_PER_SOL,
                    details: {
                        hasEnoughBalance: userBalance >= totalRequired,
                        userBalance: userBalance / LAMPORTS_PER_SOL,
                        requiredBalance: totalRequired / LAMPORTS_PER_SOL,
                        rentExemptBalance: nfnodeEntryRent / LAMPORTS_PER_SOL,
                        breakdown: {
                            transactionFee: transactionFee.value / LAMPORTS_PER_SOL,
                            nfnodeEntryRent: nfnodeEntryRent / LAMPORTS_PER_SOL,
                            userTokenAccountRent: userTokenAccountRent / LAMPORTS_PER_SOL,
                            tokenStorageAccountRent: tokenStorageAccountRent / LAMPORTS_PER_SOL,
                        }
                    }
                };

            } catch (error) {
                console.error('Error in simulateInitializeNfnodeTransaction:', error);
                return {
                    feeInLamports: 0,
                    feeInSol: 0,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    code: SIMULATE_REQUEST_TX_CODES.UNKNOWN_ERROR
                };
            }
        }
    );
};