import {
  LAMPORTS_PER_SOL,
  PublicKey,
  VersionedTransaction,
  TransactionMessage,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { BN } from "bn.js";
import {
  convertToTokenAmount,
  getUserNFTTokenAccount,
  getSolanaWalletBalance,
  getAdminKeypair,
} from "../solana/solana.service";
import { ENV } from "@config/env/env";
import {
  getKeyPairFromUnit8Array,
  getSolanaPriorityFee,
  getWayruFeeTransaction,
} from "@helpers/solana/solana.helpers";
import { } from "@interfaces/request-transaction/request-transaction.interface";
import { SIMULATE_REQUEST_TX_CODES } from "@errors/request-transaction/request-transaction";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getRewardTokenMint } from "@helpers/solana/solana.helpers";
import { SystemProgram } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import {
  SimulateInitNfnodeParams,
  SimulateInitStakeParams,
  SimulateUnstakeParams,
  SimulationResult,
  SimulationResultV2,
} from "@interfaces/request-transaction/simulate-request-tx.interfaces";
import { getSolanaConnection } from "@services/solana/solana.connection";
import { RewardSystemManager } from "@services/solana/contracts/reward-system.manager";
import { AirdropsSystemManager } from "@services/solana/contracts/airdrop-system.manager";
import { simulationCache } from "../simulation-cache/simulation-cache.service";
import {
  getNFNodeTypeRecord,
  prepareAccountsToClaimReward,
} from "@helpers/request-transaction/request-transaction.helper";
import * as anchor from "@coral-xyz/anchor";
import { StakeSystemManager } from "@services/solana/contracts/stake-system.manager";
import { getMinimumRemainingSolanaBalance } from "@services/solana/solana.service";
import { createTransactionToInitializeNfnode } from "./create-request-transaction.service";

export const simulateUpdateContractTransactions = async ({
  walletAddress,
  nftMintAddress,
  nfnodeType,
}: SimulateInitNfnodeParams): Promise<SimulationResult> => {
  return simulationCache.getOrExecute(
    {
      type: "update_contract",
      walletAddress,
      nftMintAddress,
      nfnodeType,
    },
    async () => {
      const result1 = await simulateClaimWCreditsTransaction(walletAddress);
      const result2 = await simulateInitializeNfnodeTransaction({
        walletAddress,
        nftMintAddress,
        nfnodeType,
      });
      const user = new PublicKey(walletAddress);
      const connection = getSolanaConnection();
      // get user balance
      const userBalance = await connection.getBalance(user);
      const userBalanceInSol = userBalance / LAMPORTS_PER_SOL;
      const allRequiredBalance =
        Number(result1.details?.requiredBalance ?? 0) +
        Number(result2.details?.requiredBalance ?? 0);

      const allRequiredBalanceFormatted = Number(allRequiredBalance.toFixed(9));
      const hasEnoughBalance = userBalanceInSol >= allRequiredBalanceFormatted;
      const allTxFee =
        (result1.details?.breakdown?.transactionFee ?? 0) +
        (result2.details?.breakdown?.transactionFee ?? 0);
      const MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS =
        await getMinimumRemainingSolanaBalance();

      return {
        feeInLamports: result1.feeInLamports + result2.feeInLamports,
        feeInSol: result1.feeInSol + result2.feeInSol,
        success: result1.success && result2.success,
        error: result1.error || result2.error,
        code: result1.code || result2.code,
        details: {
          hasEnoughBalance,
          userBalance: userBalanceInSol,
          requiredBalance: allRequiredBalanceFormatted,
          minimumRequired:
            MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS / LAMPORTS_PER_SOL,
          breakdown: {
            transactionFee: allTxFee,
            claimEntryRent:
              result1.details?.breakdown?.claimEntryRent ||
              result2.details?.breakdown?.claimEntryRent,
            userTokenAccountRent:
              result1.details?.breakdown?.userTokenAccountRent ||
              result2.details?.breakdown?.userTokenAccountRent,
          },
        },
      };
    }
  );
};

export const simulateClaimWCreditsTransaction = async (
  walletAddress: string
): Promise<SimulationResult> => {
  // alway use simulation cache
  return simulationCache.getOrExecute(
    { type: "claim_w_credits", walletAddress },
    async () => {
      try {
        const program = await AirdropsSystemManager.getInstance();
        const connection = getSolanaConnection();
        const adminKeypair = getKeyPairFromUnit8Array(
          Uint8Array.from(
            JSON.parse(ENV.ADMIN_REWARD_SYSTEM_PRIVATE_KEY as string)
          )
        );
        const priorityFeeInSol = await getSolanaPriorityFee();

        // validate wallet address
        try {
          new PublicKey(walletAddress); // Ensure the address is valid
        } catch (error) {
          return {
            feeInLamports: 0,
            feeInSol: 0,
            success: false,
            error: "Invalid wallet address format",
            code: SIMULATE_REQUEST_TX_CODES.INVALID_WALLET_ADDRESS,
          };
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

        // Convert SOL to microLamports per compute unit
        const microLamportsPerComputeUnit = Math.floor(
          priorityFeeInSol * 1_000_000
        );

        // create transaction message
        const messageV0 = new TransactionMessage({
          payerKey: user,
          recentBlockhash: blockhash,
          instructions: [
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: microLamportsPerComputeUnit,
            }),
            ix,
          ],
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
        const rentExemptClaimEntry =
          await connection.getMinimumBalanceForRentExemption(CLAIM_ENTRY_SIZE);

        // get rent exempt for the token account if it doesn't exist
        const tokenMint = await getRewardTokenMint();
        const userTokenAccount = await getAssociatedTokenAddress(
          new PublicKey(tokenMint),
          user
        );
        const userTokenAccountInfo = await connection.getAccountInfo(
          userTokenAccount
        );
        const userTokenAccountRent = !userTokenAccountInfo
          ? await connection.getMinimumBalanceForRentExemption(165)
          : 0;
        const MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS =
          await getMinimumRemainingSolanaBalance();

        // calculate the total required balance
        const requiredBalance =
          feeInLamports +
          rentExemptClaimEntry +
          userTokenAccountRent +
          MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS;
        const userBalanceInSol = userBalance / LAMPORTS_PER_SOL;
        const requiredBalanceInSol = requiredBalance / LAMPORTS_PER_SOL;

        const hasEnoughBalance = userBalanceInSol >= requiredBalanceInSol;

        if (!hasEnoughBalance) {
          return {
            feeInLamports,
            feeInSol: requiredBalanceInSol,
            success: false,
            error: `User must have at least ${MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS / LAMPORTS_PER_SOL
              } SOL left after the transaction.`,
            code: SIMULATE_REQUEST_TX_CODES.INSUFFICIENT_BALANCE,
            details: {
              hasEnoughBalance,
              userBalance: userBalanceInSol,
              requiredBalance: requiredBalanceInSol,
              minimumRequired:
                MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS / LAMPORTS_PER_SOL,
              breakdown: {
                transactionFee: feeInLamports / LAMPORTS_PER_SOL,
                claimEntryRent: rentExemptClaimEntry / LAMPORTS_PER_SOL,
                userTokenAccountRent: userTokenAccountRent / LAMPORTS_PER_SOL,
              },
            },
          };
        }

        // simulate transaction using the new method
        const simulation = await connection.simulateTransaction(transaction, {
          commitment: "confirmed",
          sigVerify: false,
          replaceRecentBlockhash: true,
        });

        if (simulation.value.err) {
          console.log("simulation logs:", simulation.value.logs);
          return {
            feeInLamports,
            feeInSol: requiredBalance / LAMPORTS_PER_SOL,
            success: false,
            error: JSON.stringify(simulation.value.err),
            code: SIMULATE_REQUEST_TX_CODES.SIMULATION_FAILED,
            details: {
              hasEnoughBalance,
              userBalance: userBalanceInSol,
              requiredBalance: requiredBalanceInSol,
              rentExemptBalance: rentExemptClaimEntry / LAMPORTS_PER_SOL,
              breakdown: {
                transactionFee: feeInLamports / LAMPORTS_PER_SOL,
                claimEntryRent: rentExemptClaimEntry / LAMPORTS_PER_SOL,
                userTokenAccountRent: userTokenAccountRent / LAMPORTS_PER_SOL,
              },
            },
          };
        }

        return {
          feeInLamports,
          feeInSol: requiredBalanceInSol,
          success: true,
          code: SIMULATE_REQUEST_TX_CODES.SUCCESS,
          details: {
            hasEnoughBalance,
            userBalance: userBalance / LAMPORTS_PER_SOL,
            requiredBalance: requiredBalanceInSol,
            rentExemptBalance: rentExemptClaimEntry / LAMPORTS_PER_SOL,
            breakdown: {
              transactionFee: feeInLamports / LAMPORTS_PER_SOL,
              claimEntryRent: rentExemptClaimEntry / LAMPORTS_PER_SOL,
              userTokenAccountRent: userTokenAccountRent / LAMPORTS_PER_SOL,
            },
          },
        };
      } catch (error) {
        console.error("Error simulate claim w credits transaction:", error);
        return {
          feeInLamports: 0,
          feeInSol: 0,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          code: SIMULATE_REQUEST_TX_CODES.UNKNOWN_ERROR,
        };
      }
    }
  );
};

export const simulateStakeTransaction = async ({
  walletAddress,
  nftMintAddress,
  amount,
}: SimulateInitStakeParams): Promise<SimulationResult> => {
  // alway use simulation cache
  return simulationCache.getOrExecute(
    { type: "stake-deposit", walletAddress },
    async () => {
      try {
        const program = await StakeSystemManager.getInstance();
        const connection = getSolanaConnection();
        const priorityFeeInSol = await getSolanaPriorityFee();

        // validate wallet address
        try {
          new PublicKey(walletAddress); // Ensure the address is valid
        } catch (error) {
          return {
            feeInLamports: 0,
            feeInSol: 0,
            success: false,
            error: "Invalid wallet address format",
            code: SIMULATE_REQUEST_TX_CODES.INVALID_WALLET_ADDRESS,
          };
        }

        const user = new PublicKey(walletAddress);

        // get user balance
        const userBalance = await connection.getBalance(user);
        const userBalanceInSol = userBalance / LAMPORTS_PER_SOL;

        // create instruction
        const amountBN = new BN(convertToTokenAmount(amount));
        const nftMint = new PublicKey(nftMintAddress);

        const userNftTokenAccount = await getUserNFTTokenAccount(nftMint, user);

        // Use the same account structure as the function that works
        const rewardTokenMint = await getRewardTokenMint();
        const ix = await program.methods
          .depositTokens(amountBN)
          .accounts({
            user: user,
            tokenMint: new PublicKey(rewardTokenMint),
            nftMintAddress,
            userNftTokenAccount,
            tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          })
          .instruction();

        // get last blockhash
        const { blockhash } = await connection.getLatestBlockhash();

        // Convert SOL to microLamports per compute unit
        const microLamportsPerComputeUnit = Math.floor(
          priorityFeeInSol * 1_000_000
        );

        // create transaction message
        const messageV0 = new TransactionMessage({
          payerKey: user,
          recentBlockhash: blockhash,
          instructions: [
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: microLamportsPerComputeUnit,
            }),
            ix,
          ],
        }).compileToV0Message();

        // create versioned transaction
        const transaction = new VersionedTransaction(messageV0);
        // simulate and get fee
        const fees = await connection.getFeeForMessage(messageV0);
        const feeInLamports = fees.value || 0;

        // calculate the space needed for the claim entry account
        const CLAIM_ENTRY_SIZE = 8 + 8 + 8; // discriminator + lastClaimedNonce + totalClaimed

        // get rent exempt for the claim entry account
        const rentExemptClaimEntry =
          await connection.getMinimumBalanceForRentExemption(CLAIM_ENTRY_SIZE);

        // get rent exempt for the token account if it doesn't exist
        const tokenMint = await getRewardTokenMint();
        const userTokenAccount = await getAssociatedTokenAddress(
          new PublicKey(tokenMint),
          user
        );
        const userTokenAccountInfo = await connection.getAccountInfo(
          userTokenAccount
        );
        const userTokenAccountRent = !userTokenAccountInfo
          ? await connection.getMinimumBalanceForRentExemption(165)
          : 0;
        const MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS =
          await getMinimumRemainingSolanaBalance();

        // calculate the total required balance
        const requiredBalance =
          feeInLamports +
          rentExemptClaimEntry +
          userTokenAccountRent +
          MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS;
        const requiredBalanceInSol = requiredBalance / LAMPORTS_PER_SOL;
        const formattedRequiredBalanceInSol = Number(
          requiredBalanceInSol.toFixed(9)
        );

        const hasEnoughBalance =
          userBalanceInSol >= formattedRequiredBalanceInSol;

        if (!hasEnoughBalance) {
          return {
            feeInLamports,
            feeInSol: requiredBalanceInSol,
            success: false,
            error: `User must have at least ${MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS / LAMPORTS_PER_SOL
              } SOL left after the transaction.`,
            code: SIMULATE_REQUEST_TX_CODES.INSUFFICIENT_BALANCE,
            details: {
              hasEnoughBalance,
              userBalance: userBalanceInSol,
              requiredBalance: formattedRequiredBalanceInSol,
              minimumRequired:
                MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS / LAMPORTS_PER_SOL,
              breakdown: {
                transactionFee: feeInLamports / LAMPORTS_PER_SOL,
                claimEntryRent: rentExemptClaimEntry / LAMPORTS_PER_SOL,
                userTokenAccountRent: userTokenAccountRent / LAMPORTS_PER_SOL,
              },
            },
          };
        }

        // simulate transaction using the new method
        const simulation = await connection.simulateTransaction(transaction, {
          commitment: "confirmed",
          sigVerify: false,
          replaceRecentBlockhash: true,
        });

        if (simulation.value.err) {
          console.log("simulation logs:", simulation.value.logs);
          return {
            feeInLamports,
            feeInSol: requiredBalance / LAMPORTS_PER_SOL,
            success: false,
            error: JSON.stringify(simulation.value.err),
            code: SIMULATE_REQUEST_TX_CODES.SIMULATION_FAILED,
            details: {
              hasEnoughBalance,
              userBalance: userBalanceInSol,
              requiredBalance: formattedRequiredBalanceInSol,
              rentExemptBalance: rentExemptClaimEntry / LAMPORTS_PER_SOL,
              breakdown: {
                transactionFee: feeInLamports / LAMPORTS_PER_SOL,
                claimEntryRent: rentExemptClaimEntry / LAMPORTS_PER_SOL,
                userTokenAccountRent: userTokenAccountRent / LAMPORTS_PER_SOL,
              },
            },
          };
        }

        return {
          feeInLamports,
          feeInSol: requiredBalance / LAMPORTS_PER_SOL,
          success: true,
          code: SIMULATE_REQUEST_TX_CODES.SUCCESS,
          details: {
            hasEnoughBalance,
            userBalance: userBalanceInSol,
            requiredBalance: formattedRequiredBalanceInSol,
            rentExemptBalance: rentExemptClaimEntry / LAMPORTS_PER_SOL,
            breakdown: {
              transactionFee: feeInLamports / LAMPORTS_PER_SOL,
              claimEntryRent: rentExemptClaimEntry / LAMPORTS_PER_SOL,
              userTokenAccountRent: userTokenAccountRent / LAMPORTS_PER_SOL,
            },
          },
        };
      } catch (error) {
        console.error("Error simulate claim w credits transaction:", error);
        return {
          feeInLamports: 0,
          feeInSol: 0,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          code: SIMULATE_REQUEST_TX_CODES.UNKNOWN_ERROR,
        };
      }
    }
  );
};

export const simulateUnstakeTransaction = async ({
  walletAddress,
  nftMintAddress,
}: SimulateUnstakeParams): Promise<SimulationResult> => {
  // alway use simulation cache
  return simulationCache.getOrExecute(
    { type: "unstake-deposit", walletAddress },
    async () => {
      try {
        const program = await StakeSystemManager.getInstance();
        const connection = getSolanaConnection();
        const priorityFeeInSol = await getSolanaPriorityFee();

        // validate wallet address
        try {
          new PublicKey(walletAddress); // Ensure the address is valid
        } catch (error) {
          return {
            feeInLamports: 0,
            feeInSol: 0,
            success: false,
            error: "Invalid wallet address format",
            code: SIMULATE_REQUEST_TX_CODES.INVALID_WALLET_ADDRESS,
          };
        }

        const user = new PublicKey(walletAddress);

        // get user balance
        const userBalance = await connection.getBalance(user);
        const userBalanceInSol = userBalance / LAMPORTS_PER_SOL;

        // create instruction
        const nftMint = new PublicKey(nftMintAddress);

        const userNftTokenAccount = await getUserNFTTokenAccount(nftMint, user);

        // Use the same account structure as the function that works
        const rewardTokenMint = await getRewardTokenMint();
        const ix = await program.methods
          .withdrawTokens()
          .accounts({
            user: user,
            tokenMint: new PublicKey(rewardTokenMint),
            nftMintAddress,
            userNftTokenAccount,
            tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          })
          .instruction();

        // get last blockhash
        const { blockhash } = await connection.getLatestBlockhash();

        // Convert SOL to microLamports per compute unit
        const microLamportsPerComputeUnit = Math.floor(
          priorityFeeInSol * 1_000_000
        );

        // create transaction message
        const messageV0 = new TransactionMessage({
          payerKey: user,
          recentBlockhash: blockhash,
          instructions: [
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: microLamportsPerComputeUnit,
            }),
            ix,
          ],
        }).compileToV0Message();

        // create versioned transaction
        const transaction = new VersionedTransaction(messageV0);

        // simulate and get fee
        const fees = await connection.getFeeForMessage(messageV0);
        const feeInLamports = fees.value || 0;

        // calculate the space needed for the claim entry account
        const CLAIM_ENTRY_SIZE = 8 + 8 + 8; // discriminator + lastClaimedNonce + totalClaimed

        // get rent exempt for the claim entry account
        const rentExemptClaimEntry =
          await connection.getMinimumBalanceForRentExemption(CLAIM_ENTRY_SIZE);

        // get rent exempt for the token account if it doesn't exist
        const tokenMint = await getRewardTokenMint();
        const userTokenAccount = await getAssociatedTokenAddress(
          new PublicKey(tokenMint),
          user
        );
        const userTokenAccountInfo = await connection.getAccountInfo(
          userTokenAccount
        );
        const userTokenAccountRent = !userTokenAccountInfo
          ? await connection.getMinimumBalanceForRentExemption(165)
          : 0;
        const MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS =
          await getMinimumRemainingSolanaBalance();

        // calculate the total required balance
        const requiredBalance =
          feeInLamports +
          rentExemptClaimEntry +
          userTokenAccountRent +
          MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS;
        const requiredBalanceInSol = requiredBalance / LAMPORTS_PER_SOL;
        const formattedRequiredBalanceInSol = Number(
          requiredBalanceInSol.toFixed(9)
        );

        const hasEnoughBalance =
          userBalanceInSol >= formattedRequiredBalanceInSol;

        if (!hasEnoughBalance) {
          return {
            feeInLamports,
            feeInSol: formattedRequiredBalanceInSol,
            success: false,
            error: `User must have at least ${MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS / LAMPORTS_PER_SOL
              } SOL left after the transaction.`,
            code: SIMULATE_REQUEST_TX_CODES.INSUFFICIENT_BALANCE,
            details: {
              hasEnoughBalance,
              userBalance: userBalanceInSol,
              requiredBalance: formattedRequiredBalanceInSol,
              minimumRequired:
                MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS / LAMPORTS_PER_SOL,
              breakdown: {
                transactionFee: feeInLamports / LAMPORTS_PER_SOL,
                claimEntryRent: rentExemptClaimEntry / LAMPORTS_PER_SOL,
                userTokenAccountRent: userTokenAccountRent / LAMPORTS_PER_SOL,
              },
            },
          };
        }

        // simulate transaction using the new method
        const simulation = await connection.simulateTransaction(transaction, {
          commitment: "confirmed",
          sigVerify: false,
          replaceRecentBlockhash: true,
        });

        if (simulation.value.err) {
          console.log("simulation logs:", simulation.value.logs);
          return {
            feeInLamports,
            feeInSol: formattedRequiredBalanceInSol,
            success: false,
            error: JSON.stringify(simulation.value.err),
            code: SIMULATE_REQUEST_TX_CODES.SIMULATION_FAILED,
            details: {
              hasEnoughBalance,
              userBalance: userBalanceInSol,
              requiredBalance: formattedRequiredBalanceInSol,
              rentExemptBalance: rentExemptClaimEntry / LAMPORTS_PER_SOL,
              breakdown: {
                transactionFee: feeInLamports / LAMPORTS_PER_SOL,
                claimEntryRent: rentExemptClaimEntry / LAMPORTS_PER_SOL,
                userTokenAccountRent: userTokenAccountRent / LAMPORTS_PER_SOL,
              },
            },
          };
        }

        return {
          feeInLamports,
          feeInSol: formattedRequiredBalanceInSol,
          success: true,
          code: SIMULATE_REQUEST_TX_CODES.SUCCESS,
          details: {
            hasEnoughBalance,
            userBalance: userBalanceInSol,
            requiredBalance: formattedRequiredBalanceInSol,
            rentExemptBalance: rentExemptClaimEntry / LAMPORTS_PER_SOL,
            breakdown: {
              transactionFee: feeInLamports / LAMPORTS_PER_SOL,
              claimEntryRent: rentExemptClaimEntry / LAMPORTS_PER_SOL,
              userTokenAccountRent: userTokenAccountRent / LAMPORTS_PER_SOL,
            },
          },
        };
      } catch (error) {
        console.error("Error simulate claim w credits transaction:", error);
        return {
          feeInLamports: 0,
          feeInSol: 0,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          code: SIMULATE_REQUEST_TX_CODES.UNKNOWN_ERROR,
        };
      }
    }
  );
};

export const simulateInitializeNfnodeTransaction = async ({
  walletAddress,
  nftMintAddress,
  nfnodeType,
}: SimulateInitNfnodeParams): Promise<SimulationResult> => {
  return simulationCache.getOrExecute(
    {
      type: "initialize_nfnode",
      walletAddress,
      nftMintAddress,
      nfnodeType,
    },
    async () => {
      try {
        const program = await RewardSystemManager.getInstance();
        const connection = getSolanaConnection();
        const tokenMint = await getRewardTokenMint();
        const priorityFeeInSol = await getSolanaPriorityFee();

        // Initialize public keys
        const user = new PublicKey(walletAddress);
        const nftMint = new PublicKey(nftMintAddress);
        const host = new PublicKey(
          "8QMK1JHzjydq7qHgTo1RwK3ateLm4zVQF7V7BkriNkeD"
        );
        const manufacturer = new PublicKey(
          "FCap4kWAPMMTvAqUgEX3oFmMmSzg7g3ytxknYD21hpzm"
        );
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
        const userTokenAccountInfo = await connection.getAccountInfo(
          userTokenAccount
        );
        const userTokenAccountRent = !userTokenAccountInfo
          ? await connection.getMinimumBalanceForRentExemption(165)
          : 0;

        // Check if the tokenStorageAccount exists
        const tokenStorageAccountInfo = await connection.getAccountInfo(
          tokenStorageAccount
        );
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
          systemProgram: SystemProgram.programId,
        } as const;

        const initializeNfnodeIx = await program.methods
          .initializeNfnode(new BN(0), getNFNodeTypeRecord(nfnodeType))
          .accounts(accounts)
          .instruction();

        // Get latest blockhash
        const latestBlockhash = await connection.getLatestBlockhash();

        // Convert SOL to microLamports per compute unit
        const microLamportsPerComputeUnit = Math.floor(
          priorityFeeInSol * 1_000_000
        );

        // Create TransactionMessage
        const messageV0 = new TransactionMessage({
          payerKey: user,
          recentBlockhash: latestBlockhash.blockhash,
          instructions: [
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: microLamportsPerComputeUnit,
            }),
            initializeNfnodeIx,
          ],
        }).compileToV0Message();

        // Create VersionedTransaction
        const transaction = new VersionedTransaction(messageV0);

        // Get user's current balance
        const userBalance = await connection.getBalance(user);
        const userBalanceInSol = userBalance / LAMPORTS_PER_SOL;

        // Calculate rent exempt for nfnode entry
        const nfnodeEntryRent =
          await connection.getMinimumBalanceForRentExemption(165);

        // Get transaction fee
        const transactionFee = await connection.getFeeForMessage(messageV0);
        if (transactionFee.value === null) {
          throw new Error("Failed to get fee for message");
        }
        const feeInLamports = transactionFee.value || 0;
        const MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS =
          await getMinimumRemainingSolanaBalance();

        // Sum all required lamports
        const totalRequired =
          nfnodeEntryRent +
          userTokenAccountRent +
          tokenStorageAccountRent +
          feeInLamports +
          MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS;
        const totalRequiredInSol = totalRequired / LAMPORTS_PER_SOL;
        const formattedTotalRequiredInSol = Number(
          totalRequiredInSol.toFixed(9)
        );
        const hasEnoughBalance =
          userBalanceInSol >= formattedTotalRequiredInSol;

        // Simulate transaction
        const simulation = await connection.simulateTransaction(transaction);

        if (simulation.value.err) {
          console.log("simulation logs:", simulation.value.logs);
          return {
            success: false,
            feeInLamports: feeInLamports,
            feeInSol: formattedTotalRequiredInSol,
            error: JSON.stringify(simulation.value.err),
            details: {
              hasEnoughBalance,
              userBalance: userBalanceInSol,
              requiredBalance: formattedTotalRequiredInSol,
              rentExemptBalance: nfnodeEntryRent / LAMPORTS_PER_SOL,
              minimumRequired:
                MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS / LAMPORTS_PER_SOL,
              breakdown: {
                transactionFee: transactionFee.value / LAMPORTS_PER_SOL,
                nfnodeEntryRent: nfnodeEntryRent / LAMPORTS_PER_SOL,
                userTokenAccountRent: userTokenAccountRent / LAMPORTS_PER_SOL,
                tokenStorageAccountRent:
                  tokenStorageAccountRent / LAMPORTS_PER_SOL,
              },
            },
          };
        }

        return {
          success: true,
          feeInLamports: feeInLamports,
          feeInSol: formattedTotalRequiredInSol,
          details: {
            hasEnoughBalance,
            userBalance: userBalanceInSol,
            requiredBalance: formattedTotalRequiredInSol,
            rentExemptBalance: nfnodeEntryRent / LAMPORTS_PER_SOL,
            minimumRequired:
              MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS / LAMPORTS_PER_SOL,
            breakdown: {
              transactionFee: transactionFee.value / LAMPORTS_PER_SOL,
              nfnodeEntryRent: nfnodeEntryRent / LAMPORTS_PER_SOL,
              userTokenAccountRent: userTokenAccountRent / LAMPORTS_PER_SOL,
              tokenStorageAccountRent:
                tokenStorageAccountRent / LAMPORTS_PER_SOL,
            },
          },
        };
      } catch (error) {
        console.error("Error in simulateInitializeNfnodeTransaction:", error);
        return {
          feeInLamports: 0,
          feeInSol: 0,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          code: SIMULATE_REQUEST_TX_CODES.UNKNOWN_ERROR,
        };
      }
    }
  );
};

export const simulateInitializeNfnodeTransactionV2 = async ({
  walletAddress,
  nftMintAddress,
  nfnodeType,
}: SimulateInitNfnodeParams): Promise<SimulationResultV2> => {
  return simulationCache.getOrExecute(
    {
      type: "initialize_nfnode",
      walletAddress,
      nftMintAddress,
      nfnodeType,
    },
    async () => {
      try {
        const connection = getSolanaConnection();
        const wayruFeeTransaction = await getWayruFeeTransaction();
        const nfnodeTypeRecord = getNFNodeTypeRecord(nfnodeType);

        // prepare transaction to initialize nfnode
        const {
          transaction,
          transactionMessage,
          userTokenAccountRent,
          error,
          tokenStorageAccountRent,
        } = await createTransactionToInitializeNfnode({
          walletAddress,
          nftMintAddress,
          nfnodeType: nfnodeTypeRecord,
          forSimulation: true, // This is for simulation
        });

        // check if the transaction is created successfully
        if (
          error ||
          !transaction ||
          !transactionMessage ||
          userTokenAccountRent === null ||
          tokenStorageAccountRent === null
        ) {
          return {
            success: false,
            error: "Failed to create transaction",
            code: SIMULATE_REQUEST_TX_CODES.UNKNOWN_ERROR,
          };
        }

        // Get wallet current balance
        const { assets } = await getSolanaWalletBalance(walletAddress);
        const solAsset = assets.find((asset) => asset.name === "SOL");
        const wayruAsset = assets.find((asset) => asset.name === "WAYRU");
        const walletSolBalance = Number(solAsset?.balance ?? 0);
        const walletWayruBalance = Number(wayruAsset?.balance ?? 0);
        const depositAmount = nfnodeType === "don" ? 0 : 5000;

        // Calculate rent exempt for nfnode entry
        const nfnodeEntryRent =
          await connection.getMinimumBalanceForRentExemption(165);

        // Get transaction fee
        const transactionFee = await connection.getFeeForMessage(
          transactionMessage
        );
        if (transactionFee.value === null) {
          throw new Error("Failed to get fee for message");
        }
        const feeInLamports = transactionFee.value || 0;
        const MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS =
          await getMinimumRemainingSolanaBalance();

        // Sum all required lamports
        const totalRequiredSol =
          nfnodeEntryRent +
          userTokenAccountRent +
          tokenStorageAccountRent +
          feeInLamports +
          MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS;
        const totalRequiredInSol = totalRequiredSol / LAMPORTS_PER_SOL;
        const formattedTotalRequiredInSol = Number(
          totalRequiredInSol.toFixed(9)
        );
        const hasEnoughSolBalance = walletSolBalance >= formattedTotalRequiredInSol;
        const requiredBalanceWayru = wayruFeeTransaction + depositAmount;
        const hasEnoughWayruBalance = walletWayruBalance >= requiredBalanceWayru;

        // Simulate transaction
        const simulation = await connection.simulateTransaction(transaction);

        const response: SimulationResultV2 = {
          success: false,
          error: JSON.stringify(simulation.value.err),
          code: SIMULATE_REQUEST_TX_CODES.SIMULATION_FAILED,
          details: {
            networkFeeInSol: feeInLamports / LAMPORTS_PER_SOL,
            wayruFeeTransaction: wayruFeeTransaction,
            hasEnoughSolBalance,
            hasEnoughWayruBalance: hasEnoughWayruBalance,
            userBalanceInSol: walletSolBalance,
            userBalanceInWayru: walletWayruBalance,
            requiredBalanceInSol: formattedTotalRequiredInSol,
            requiredBalanceWayru: requiredBalanceWayru,
            txBase64: undefined,
            discountCodeError: undefined,
            breakdown: {
              totalTransferAmountInSol: formattedTotalRequiredInSol,
              totalTransferAmountInWayru: requiredBalanceWayru,
              treasuryPaymentInSol: 0,
              treasuryPaymentInWayru: wayruFeeTransaction,
              adminPaymentInSol: 0,
            },
          },
        };

        if (simulation.value.err) {
          console.log("simulation logs:", simulation.value.logs);
          return {
            ...response,
            success: false,
            error: JSON.stringify(simulation.value.err),
            code: SIMULATE_REQUEST_TX_CODES.SIMULATION_FAILED,
          } as SimulationResultV2;
        }

        return {
          success: true,
          error: JSON.stringify(simulation.value.err),
          code: SIMULATE_REQUEST_TX_CODES.SIMULATION_FAILED,
          details: {
            ...response.details,
          },
        } as SimulationResultV2;
      } catch (error) {
        console.error("Error in simulateInitializeNfnodeTransaction:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          code: SIMULATE_REQUEST_TX_CODES.UNKNOWN_ERROR,
        } as SimulationResultV2;
      }
    }
  );
};

export const simulateInitializeStakeTransaction = async ({
  walletAddress,
  nftMintAddress,
  amount,
}: SimulateInitStakeParams): Promise<SimulationResult> => {
  return simulationCache.getOrExecute(
    {
      type: "initialize_stake",
      walletAddress,
      nftMintAddress,
    },
    async () => {
      try {
        const program = await StakeSystemManager.getInstance();
        const connection = getSolanaConnection();
        const tokenMint = await getRewardTokenMint();
        const priorityFeeInSol = await getSolanaPriorityFee();

        // Initialize public keys
        const user = new PublicKey(walletAddress);
        const nftMint = new PublicKey(nftMintAddress);

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
        const userTokenAccountInfo = await connection.getAccountInfo(
          userTokenAccount
        );
        const userTokenAccountRent = !userTokenAccountInfo
          ? await connection.getMinimumBalanceForRentExemption(165)
          : 0;

        // Check if the tokenStorageAccount exists
        const tokenStorageAccountInfo = await connection.getAccountInfo(
          tokenStorageAccount
        );
        const tokenStorageAccountRent = !tokenStorageAccountInfo
          ? await connection.getMinimumBalanceForRentExemption(165)
          : 0;

        // Add initialize nfnode instruction
        const accounts = {
          user,
          nftMintAddress: nftMint,
          userNftTokenAccount,
          tokenMint: new PublicKey(tokenMint),
          nfnodeEntry: nfnodeEntryPDA,
          adminAccount: adminAccountPDA,
          tokenStorageAuthority,
          tokenStorageAccount,
          userTokenAccount,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as const;

        const initializeNfnodeIx = await program.methods
          .initializeNfnode(new BN(amount * 1000000))
          .accounts(accounts)
          .instruction();

        // Get latest blockhash
        const latestBlockhash = await connection.getLatestBlockhash();

        // Convert SOL to microLamports per compute unit
        const microLamportsPerComputeUnit = Math.floor(
          priorityFeeInSol * 1_000_000
        );
        const MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS =
          await getMinimumRemainingSolanaBalance();

        // Create TransactionMessage
        const messageV0 = new TransactionMessage({
          payerKey: user,
          recentBlockhash: latestBlockhash.blockhash,
          instructions: [
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: microLamportsPerComputeUnit,
            }),
            initializeNfnodeIx,
          ],
        }).compileToV0Message();

        // Create VersionedTransaction
        const transaction = new VersionedTransaction(messageV0);

        // Get user's current balance
        const userBalance = await connection.getBalance(user);
        const userBalanceInSol = userBalance / LAMPORTS_PER_SOL;

        // Calculate rent exempt for nfnode entry
        const nfnodeEntryRent =
          await connection.getMinimumBalanceForRentExemption(165);

        // Get transaction fee
        const transactionFee = await connection.getFeeForMessage(messageV0);
        if (transactionFee.value === null) {
          throw new Error("Failed to get fee for message");
        }
        const feeInLamports = transactionFee.value || 0;

        // Sum all required lamports
        const totalRequired =
          nfnodeEntryRent +
          userTokenAccountRent +
          tokenStorageAccountRent +
          feeInLamports +
          MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS;
        const totalRequiredInSol = totalRequired / LAMPORTS_PER_SOL;
        const hasEnoughBalance = userBalanceInSol >= totalRequiredInSol;

        // Simulate transaction
        const simulation = await connection.simulateTransaction(transaction);

        if (simulation.value.err) {
          console.log("simulation logs:", simulation.value.logs);
          return {
            success: false,
            feeInLamports: feeInLamports,
            feeInSol: totalRequired / LAMPORTS_PER_SOL,
            error: JSON.stringify(simulation.value.err),
            details: {
              hasEnoughBalance,
              userBalance: userBalanceInSol,
              requiredBalance: totalRequiredInSol,
              rentExemptBalance: nfnodeEntryRent / LAMPORTS_PER_SOL,
              minimumRequired:
                MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS / LAMPORTS_PER_SOL,
              breakdown: {
                transactionFee: transactionFee.value / LAMPORTS_PER_SOL,
                nfnodeEntryRent: nfnodeEntryRent / LAMPORTS_PER_SOL,
                userTokenAccountRent: userTokenAccountRent / LAMPORTS_PER_SOL,
                tokenStorageAccountRent:
                  tokenStorageAccountRent / LAMPORTS_PER_SOL,
              },
            },
          };
        }

        return {
          success: true,
          feeInLamports: feeInLamports,
          feeInSol: totalRequired / LAMPORTS_PER_SOL,
          details: {
            hasEnoughBalance,
            userBalance: userBalanceInSol,
            requiredBalance: totalRequiredInSol,
            rentExemptBalance: nfnodeEntryRent / LAMPORTS_PER_SOL,
            minimumRequired:
              MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS / LAMPORTS_PER_SOL,
            breakdown: {
              transactionFee: transactionFee.value / LAMPORTS_PER_SOL,
              nfnodeEntryRent: nfnodeEntryRent / LAMPORTS_PER_SOL,
              userTokenAccountRent: userTokenAccountRent / LAMPORTS_PER_SOL,
              tokenStorageAccountRent:
                tokenStorageAccountRent / LAMPORTS_PER_SOL,
            },
          },
        };
      } catch (error) {
        console.error("Error in simulateInitializeNfnodeTransaction:", error);
        return {
          feeInLamports: 0,
          feeInSol: 0,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          code: SIMULATE_REQUEST_TX_CODES.UNKNOWN_ERROR,
        };
      }
    }
  );
};

export const simulateClaimRewardTransaction = async (
  walletAddress: string,
  amountToClaim: number,
  nftMintAddress: string,
  claimerType: "owner" | "other"
): Promise<SimulationResult> => {
  return simulationCache.getOrExecute(
    {
      type: "claim_reward",
      walletAddress,
      amountToClaim,
      nftMintAddress,
      claimerType,
    },
    async () => {
      try {
        const program = await RewardSystemManager.getInstance();
        const connection = getSolanaConnection();
        const adminKeypair = getKeyPairFromUnit8Array(
          Uint8Array.from(
            JSON.parse(ENV.ADMIN_REWARD_SYSTEM_PRIVATE_KEY as string)
          )
        );
        const priorityFeeInSol = await getSolanaPriorityFee();

        // validate wallet address
        try {
          new PublicKey(walletAddress);
        } catch (error) {
          return {
            feeInLamports: 0,
            feeInSol: 0,
            success: false,
            error: "Invalid wallet address format",
            code: SIMULATE_REQUEST_TX_CODES.INVALID_WALLET_ADDRESS,
          };
        }

        const user = new PublicKey(walletAddress);
        const nftMint = new PublicKey(nftMintAddress);

        // get user balance
        const userBalance = await connection.getBalance(user);
        const userBalanceInSol = userBalance / LAMPORTS_PER_SOL;

        // prepare transaction parameters
        const rewardTokenMint = await getRewardTokenMint();
        const mint = new PublicKey(rewardTokenMint);
        const amount = new BN(convertToTokenAmount(amountToClaim));
        const nonce = new BN(Date.now());

        // prepare accounts
        const accounts = await prepareAccountsToClaimReward({
          program,
          mint,
          userWallet: user,
          nftMint,
          claimerType,
          adminKeypair,
        });

        if (!accounts) {
          return {
            feeInLamports: 0,
            feeInSol: 0,
            success: false,
            error: "Failed to prepare accounts",
            code: SIMULATE_REQUEST_TX_CODES.UNKNOWN_ERROR,
          };
        }

        // create instruction
        let ix: anchor.web3.TransactionInstruction;
        if (claimerType === "owner") {
          ix = await program.methods
            .ownerClaimRewards(amount, nonce)
            .accounts(accounts as unknown as any)
            .instruction();
        } else {
          ix = await program.methods
            .othersClaimRewards(amount, nonce)
            .accounts(accounts)
            .instruction();
        }

        // get last blockhash
        const { blockhash } = await connection.getLatestBlockhash();

        // Convert SOL to microLamports per compute unit
        const microLamportsPerComputeUnit = Math.floor(
          priorityFeeInSol * 1_000_000
        );

        // Now create the final transaction with the correct priority fee
        const finalMessageV0 = new TransactionMessage({
          payerKey: user,
          recentBlockhash: blockhash,
          instructions: [
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: microLamportsPerComputeUnit,
            }),
            ix,
          ],
        }).compileToV0Message();

        // create versioned transaction
        const transaction = new VersionedTransaction(finalMessageV0);
        transaction.sign([adminKeypair]);

        // simulate and get fee
        const fees = await connection.getFeeForMessage(finalMessageV0);
        const feeInLamports = fees.value || 0;

        // calculate the space needed for the reward entry account
        const REWARD_ENTRY_SIZE = 8 + 8 + 8; // discriminator + lastClaimedNonce + totalClaimed

        // get rent exempt for the reward entry account
        const rentExemptRewardEntry =
          await connection.getMinimumBalanceForRentExemption(REWARD_ENTRY_SIZE);

        // get rent exempt for the token account if it doesn't exist
        const userTokenAccount = await getAssociatedTokenAddress(
          new PublicKey(rewardTokenMint),
          user
        );
        const userTokenAccountInfo = await connection.getAccountInfo(
          userTokenAccount
        );
        const userTokenAccountRent = !userTokenAccountInfo
          ? await connection.getMinimumBalanceForRentExemption(165)
          : 0;
        const MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS =
          await getMinimumRemainingSolanaBalance();

        // calculate the total required balance
        const requiredBalanceInLamports =
          feeInLamports +
          rentExemptRewardEntry +
          userTokenAccountRent +
          MINIMUM_REMAINING_SOLANA_BALANCE_IN_LAMPORTS +
          priorityFeeInSol * LAMPORTS_PER_SOL;
        const requiredBalanceInSol =
          requiredBalanceInLamports / LAMPORTS_PER_SOL;

        const requiredBalanceFormatted = Number(
          requiredBalanceInSol.toFixed(9)
        );

        const hasEnoughBalance = userBalanceInSol >= requiredBalanceFormatted;

        // 1. Get the token storage account address (already in accounts.tokenStorageAccount)
        const tokenStorageAccount = accounts.tokenStorageAccount;

        // 2. Get the token balance
        const tokenStorageAccountInfo = await connection.getTokenAccountBalance(
          tokenStorageAccount
        );
        const tokenStorageBalance = Number(
          tokenStorageAccountInfo.value.amount
        ); // in smallest unit

        // 3. Compare with amountToClaim (also in smallest unit)
        const amountToClaimInSmallestUnit = convertToTokenAmount(amountToClaim);
        const hasEnoughProgramTokens =
          tokenStorageBalance >= amountToClaimInSmallestUnit;

        // 4. Add this info to the response
        if (!hasEnoughProgramTokens) {
          return {
            feeInLamports,
            feeInSol: requiredBalanceInSol,
            success: false,
            error:
              "Program does not have enough reward tokens to pay the claim.",
            code: SIMULATE_REQUEST_TX_CODES.PROGRAM_DOES_NOT_HAVE_ENOUGH_REWARD_TOKENS,
            details: {
              hasEnoughBalance,
              userBalance: userBalanceInSol,
              requiredBalance: requiredBalanceFormatted,
              programTokenBalance: tokenStorageBalance,
              amountToClaim: amountToClaimInSmallestUnit,
              breakdown: {
                transactionFee: feeInLamports / LAMPORTS_PER_SOL,
                priorityFee: priorityFeeInSol / LAMPORTS_PER_SOL,
                rewardEntryRent: rentExemptRewardEntry / LAMPORTS_PER_SOL,
                userTokenAccountRent: userTokenAccountRent / LAMPORTS_PER_SOL,
              },
            },
          };
        }

        // simulate transaction
        const simulationFinal = await connection.simulateTransaction(
          transaction,
          {
            commitment: "confirmed",
            sigVerify: false,
            replaceRecentBlockhash: true,
          }
        );

        if (simulationFinal.value.err) {
          console.log("simulation logs:", simulationFinal.value.logs);
          return {
            feeInLamports,
            feeInSol: requiredBalanceFormatted,
            success: false,
            error: JSON.stringify(simulationFinal.value.err),
            code: SIMULATE_REQUEST_TX_CODES.SIMULATION_FAILED,
            details: {
              hasEnoughBalance,
              userBalance: userBalanceInSol,
              requiredBalance: requiredBalanceFormatted,
              rentExemptBalance: rentExemptRewardEntry / LAMPORTS_PER_SOL,
              breakdown: {
                transactionFee: feeInLamports / LAMPORTS_PER_SOL,
                priorityFee: priorityFeeInSol,
                rewardEntryRent: rentExemptRewardEntry / LAMPORTS_PER_SOL,
                userTokenAccountRent: userTokenAccountRent / LAMPORTS_PER_SOL,
              },
            },
          };
        }

        return {
          feeInLamports,
          feeInSol: requiredBalanceInSol,
          success: hasEnoughBalance ? true : false,
          code: SIMULATE_REQUEST_TX_CODES.SUCCESS,
          details: {
            hasEnoughBalance,
            userBalance: userBalanceInSol,
            requiredBalance: requiredBalanceFormatted,
            rentExemptBalance: rentExemptRewardEntry / LAMPORTS_PER_SOL,
            breakdown: {
              transactionFee: feeInLamports / LAMPORTS_PER_SOL,
              priorityFee: priorityFeeInSol,
              rewardEntryRent: rentExemptRewardEntry / LAMPORTS_PER_SOL,
              userTokenAccountRent: userTokenAccountRent / LAMPORTS_PER_SOL,
            },
          },
        };
      } catch (error) {
        console.error("Error simulate claim reward transaction:", error);
        return {
          feeInLamports: 0,
          feeInSol: 0,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          code: SIMULATE_REQUEST_TX_CODES.UNKNOWN_ERROR,
        };
      }
    }
  );
};
