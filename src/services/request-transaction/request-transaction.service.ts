import {
  NFNodeTypeEnum,
  RequestTransactionResponse,
  RequestTransactionWithInitResponse,
} from "@interfaces/request-transaction/request-transaction.interface";
import { BN } from "bn.js";
import * as anchor from "@coral-xyz/anchor";
import {
  convertToTokenAmount,
  getUserNFTTokenAccount,
} from "../solana/solana.service";
import {
  getKeyPairFromUnit8Array,
  getSolanaPriorityFee,
  getWayruFeeTransaction,
} from "@helpers/solana/solana.helpers";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { REQUEST_TRANSACTION_ERROR_CODES } from "@errors/request-transaction/request-transaction";
import {
  prepareAccountsToClaimReward,
  verifyTransactionSignature,
  processMessageData,
  createTransactionHash,
} from "@helpers/request-transaction/request-transaction.helper";
import { getRewardTokenMint } from "@helpers/solana/solana.helpers";
import { validateAndUpdateSignatureStatus, verifyTxTrackerToClaimDepinStakerRewards } from "../transaction-tracker/transaction-tracker.service";
import { ENV } from "@config/env/env";
import {
  updateTransactionTrackerStatus,
  verifyTransactionTrackerToClaimRewards,
} from "../transaction-tracker/transaction-tracker.service";
import { getSolanaConnection } from "@services/solana/solana.connection";
import { RewardSystemManager } from "@services/solana/contracts/reward-system.manager";
import { AirdropsSystemManager } from "@services/solana/contracts/airdrop-system.manager";
import { prepareTransactionToClaimLostTokens } from "@services/airdrops-program/airdrops-program.service";
import { prepareTransactionToInitializeNFNode } from "@services/rewards-program/rewards-program.service";
import { StakeSystemManager } from "@services/solana/contracts/stake-system.manager";
import { createTransactionToInitializeNfnode, instructionToSendWayruToFoundationWallet } from "./create-request-transaction.service";

/**
 * Request a transaction to initialize a NFNode
 * @param {string} signature - The signature of the initialize nfnode message
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionToInitializeNfnode = async (
  signature: string
): RequestTransactionResponse => {
  try {
    // verify the signature
    const { isValid, message } = await verifyTransactionSignature(signature);
    if (!isValid || !message) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_INITIALIZE_NFNODE_INVALID_SIGNATURE_ERROR_CODE,
      };
    }

    const data = await processMessageData("initialize-nfnode", message);
    if (!data) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_INITIALIZE_NFNODE_INVALID_DATA_ERROR_CODE,
      };
    }
    const {
      walletOwnerAddress,
      hostAddress,
      manufacturerAddress,
      solanaAssetId,
      nfnodeType,
      nonce,
    } = data;

    // validate signature status
    const { isValid: isValidSignature, code: codeSignature } =
      await validateAndUpdateSignatureStatus(nonce, signature);
    if (!isValidSignature) {
      return {
        serializedTx: null,
        error: true,
        code: codeSignature,
      };
    }

    // prepare transaction parameters
    const hostShare = new BN(0); // host share of the NFT is 0
    const program = await RewardSystemManager.getInstance();
    const adminKeypair = getKeyPairFromUnit8Array(
      Uint8Array.from(JSON.parse(ENV.ADMIN_REWARD_SYSTEM_PRIVATE_KEY as string))
    );
    const user = new PublicKey(walletOwnerAddress); // owner of the NFT
    const host = new PublicKey(hostAddress); // host of the NFT
    const manufacturer = new PublicKey(manufacturerAddress); // manufacturer of the NFT
    const nftMintAddress = new PublicKey(solanaAssetId); // mint address of the NFT
    const userNFTTokenAccount = await getUserNFTTokenAccount(
      nftMintAddress,
      user
    );
    const [nfnodeEntryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("nfnode_entry"), nftMintAddress.toBuffer()],
      program.programId
    );
    const [adminAccountPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("admin_account")],
      program.programId
    );
    // Derive token storage authority PDA
    const [tokenStorageAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_storage"), nftMintAddress.toBuffer()],
      program.programId
    );
    // Obtain the user token account
    const rewardTokenMint = await getRewardTokenMint();
    const userTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(rewardTokenMint),
      user
    );

    // Obtain the token storage account
    const tokenStorageAccount = await getAssociatedTokenAddress(
      new PublicKey(rewardTokenMint),
      tokenStorageAuthority,
      true // allowOwnerOffCurve = true para PDAs
    );
    const tokenMint = new PublicKey(rewardTokenMint);
    // Add priority fee
    const priorityFeeInSol = await getSolanaPriorityFee();
    const microLamportsPerComputeUnit = Math.floor(
      priorityFeeInSol * 1_000_000
    );

    const accounts = {
      userAdmin: adminKeypair.publicKey,
      user: user,
      nftMintAddress: nftMintAddress,
      userNftTokenAccount: userNFTTokenAccount,
      host: host,
      manufacturer: manufacturer,
      tokenMint: tokenMint,
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

    // create a transaction
    const ix = await program.methods
      .initializeNfnode(hostShare, nfnodeType as Record<NFNodeTypeEnum, never>)
      .accounts(accounts)
      .transaction();

    // get the latest blockhash
    const connection = getSolanaConnection();
    let tx = new anchor.web3.Transaction();
    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: microLamportsPerComputeUnit,
      }),
      ix
    );
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = user; // set the fee payer

    // sign admin keypair
    tx.partialSign(adminKeypair);

    // serialize tx
    const serializedTx = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    // update tx status
    await updateTransactionTrackerStatus(nonce, "request_authorized_by_admin");

    return {
      serializedTx: serializedTx.toString("base64"),
      error: false,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_SUCCESS_CODE,
    };
  } catch (error) {
    console.error(`Error requesting transaction initialize nfnode:`, error);
    return {
      serializedTx: null,
      error: true,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_INITIALIZE_NFNODE_ERROR_CODE,
    };
  }
};

/**
 * Request a transaction to initialize a NFNode v2, wayru network fee is included
 * @param {string} signature - The signature of the initialize nfnode message
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionToInitializeNfnodeV2 = async (
  signature: string
): RequestTransactionResponse => {
  try {
    // verify the signature
    const { isValid, message } = await verifyTransactionSignature(signature);
    if (!isValid || !message) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_INITIALIZE_NFNODE_INVALID_SIGNATURE_ERROR_CODE,
      };
    }

    const data = await processMessageData("initialize-nfnode", message);
    if (!data) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_INITIALIZE_NFNODE_INVALID_DATA_ERROR_CODE,
      };
    }
    const {
      walletOwnerAddress,
      hostAddress,
      manufacturerAddress,
      solanaAssetId,
      nfnodeType,
      nonce,
    } = data;

    // validate signature status
    const { isValid: isValidSignature, code: codeSignature } =
      await validateAndUpdateSignatureStatus(nonce, signature);
    if (!isValidSignature) {
      return {
        serializedTx: null,
        error: true,
        code: codeSignature,
      };
    }

    // Create transaction using the unified function
    const { error: transactionError, serializedTransaction } = await createTransactionToInitializeNfnode({
      walletAddress: walletOwnerAddress,
      nftMintAddress: solanaAssetId,
      nfnodeType: nfnodeType, // Type assertion to handle the interface mismatch
      hostAddress,
      manufacturerAddress,
      forSimulation: false // This is for real transaction
    });

    if (transactionError || !serializedTransaction) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_INITIALIZE_NFNODE_ERROR_CODE,
      };
    }

    // update tx status
    await updateTransactionTrackerStatus(nonce, "request_authorized_by_admin");

    return {
      serializedTx: serializedTransaction,
      error: false,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_SUCCESS_CODE,
    };
  } catch (error) {
    console.error(`Error requesting transaction initialize nfnode:`, error);
    return {
      serializedTx: null,
      error: true,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_INITIALIZE_NFNODE_ERROR_CODE,
    };
  }
};

/**
 * Request a transaction to initialize a NFNode stake sntry
 * @param {string} signature - The signature of the initialize nfnode message
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionToInitializeStakeEntry = async (
  signature: string
): RequestTransactionResponse => {
  try {
    // verify the signature
    const { isValid, message } = await verifyTransactionSignature(signature);
    if (!isValid || !message) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_INITIALIZE_NFNODE_INVALID_SIGNATURE_ERROR_CODE,
      };
    }

    const data = await processMessageData("initialize-stake", message);
    if (!data) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_INITIALIZE_NFNODE_INVALID_DATA_ERROR_CODE,
      };
    }
    const { walletAddress, solanaAssetId, amount, nonce } = data;

    // validate signature status
    const { isValid: isValidSignature, code: codeSignature } =
      await validateAndUpdateSignatureStatus(nonce, signature);
    if (!isValidSignature) {
      return {
        serializedTx: null,
        error: true,
        code: codeSignature,
      };
    }

    // prepare transaction parameters
    const amountBN = new BN(amount * 1000000); // host share of the NFT is 0
    const program = await StakeSystemManager.getInstance();
    const user = new PublicKey(walletAddress); // owner of the NFT
    const nftMintAddress = new PublicKey(solanaAssetId); // mint address of the NFT
    const userNFTTokenAccount = await getUserNFTTokenAccount(
      nftMintAddress,
      user
    );
    const [nfnodeEntryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("nfnode_entry"), nftMintAddress.toBuffer()],
      program.programId
    );
    // Derive token storage authority PDA
    const [tokenStorageAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_storage"), nftMintAddress.toBuffer()],
      program.programId
    );
    // Obtain the user token account
    const rewardTokenMint = await getRewardTokenMint();
    const userTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(rewardTokenMint),
      user
    );

    // Obtain the token storage account
    const tokenStorageAccount = await getAssociatedTokenAddress(
      new PublicKey(rewardTokenMint),
      tokenStorageAuthority,
      true // allowOwnerOffCurve = true para PDAs
    );
    const tokenMint = new PublicKey(rewardTokenMint);
    // Add priority fee
    const priorityFeeInSol = await getSolanaPriorityFee();
    const microLamportsPerComputeUnit = Math.floor(
      priorityFeeInSol * 1_000_000
    );

    const accounts = {
      user: user,
      nftMintAddress: nftMintAddress,
      userNftTokenAccount: userNFTTokenAccount,
      tokenMint: tokenMint,
      nfnodeEntry: nfnodeEntryPDA,
      tokenStorageAuthority,
      tokenStorageAccount,
      userTokenAccount,
      tokenProgram2022: TOKEN_2022_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    } as const;

    // create a transaction
    const ix = await program.methods
      .initializeNfnode(amountBN)
      .accounts(accounts)
      .transaction();

    // get the latest blockhash
    const connection = getSolanaConnection();
    let tx = new anchor.web3.Transaction();
    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: microLamportsPerComputeUnit,
      }),
      ix
    );
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = user; // set the fee payer

    // serialize tx
    const serializedTx = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    // update tx status
    await updateTransactionTrackerStatus(nonce, "request_authorized_by_admin");

    return {
      serializedTx: serializedTx.toString("base64"),
      error: false,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_SUCCESS_CODE,
    };
  } catch (error) {
    console.error(`Error requesting transaction initialize nfnode:`, error);
    return {
      serializedTx: null,
      error: true,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_INITIALIZE_NFNODE_ERROR_CODE,
    };
  }
};

/**
 * Request a transaction to initialize a NFNode stake entry v2, wayru network fee is included
 * @param {string} signature - The signature of the initialize nfnode message
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionToInitializeStakeEntryV2 = async (
  signature: string
): RequestTransactionResponse => {
  try {
    // verify the signature
    const { isValid, message } = await verifyTransactionSignature(signature);
    if (!isValid || !message) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_INITIALIZE_NFNODE_INVALID_SIGNATURE_ERROR_CODE,
      };
    }

    const data = await processMessageData("initialize-stake", message);
    if (!data) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_INITIALIZE_NFNODE_INVALID_DATA_ERROR_CODE,
      };
    }
    const { walletAddress, solanaAssetId, amount, nonce } = data;

    // validate signature status
    const { isValid: isValidSignature, code: codeSignature } =
      await validateAndUpdateSignatureStatus(nonce, signature);
    if (!isValidSignature) {
      return {
        serializedTx: null,
        error: true,
        code: codeSignature,
      };
    }

    // prepare transaction parameters
    const amountBN = new BN(amount * 1000000); // host share of the NFT is 0
    const program = await StakeSystemManager.getInstance();
    const user = new PublicKey(walletAddress); // owner of the NFT
    const nftMintAddress = new PublicKey(solanaAssetId); // mint address of the NFT
    const userNFTTokenAccount = await getUserNFTTokenAccount(
      nftMintAddress,
      user
    );
    const [nfnodeEntryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("nfnode_entry"), nftMintAddress.toBuffer()],
      program.programId
    );
    // Derive token storage authority PDA
    const [tokenStorageAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_storage"), nftMintAddress.toBuffer()],
      program.programId
    );
    // Obtain the user token account
    const rewardTokenMint = await getRewardTokenMint();
    const userTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(rewardTokenMint),
      user
    );

    // Obtain the token storage account
    const tokenStorageAccount = await getAssociatedTokenAddress(
      new PublicKey(rewardTokenMint),
      tokenStorageAuthority,
      true // allowOwnerOffCurve = true para PDAs
    );
    const tokenMint = new PublicKey(rewardTokenMint);
    // Add priority fee
    const priorityFeeInSol = await getSolanaPriorityFee();
    const microLamportsPerComputeUnit = Math.floor(
      priorityFeeInSol * 1_000_000
    );
    const wayruFeeTransaction = await getWayruFeeTransaction();

    const accounts = {
      user: user,
      nftMintAddress: nftMintAddress,
      userNftTokenAccount: userNFTTokenAccount,
      tokenMint: tokenMint,
      nfnodeEntry: nfnodeEntryPDA,
      tokenStorageAuthority,
      tokenStorageAccount,
      userTokenAccount,
      tokenProgram2022: TOKEN_2022_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    } as const;

    // create a transaction
    const ix = await program.methods
      .initializeNfnode(amountBN)
      .accounts(accounts)
      .transaction();

    // get the latest blockhash
    const connection = getSolanaConnection();
    let tx = new anchor.web3.Transaction();

    // add instructions
    const ixToSendWayruToFoundationWallet = await instructionToSendWayruToFoundationWallet(
      user,
      wayruFeeTransaction
    );
    if (!ixToSendWayruToFoundationWallet) {
      throw new Error("Failed to create instruction to send wayru token to wayru foundation wallet");
    }

    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: microLamportsPerComputeUnit,
      }),
      ixToSendWayruToFoundationWallet,
      ix
    );
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = user; // set the fee payer

    // serialize tx
    const serializedTx = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    // update tx status
    await updateTransactionTrackerStatus(nonce, "request_authorized_by_admin");

    return {
      serializedTx: serializedTx.toString("base64"),
      error: false,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_SUCCESS_CODE,
    };
  } catch (error) {
    console.error(`Error requesting transaction initialize nfnode:`, error);
    return {
      serializedTx: null,
      error: true,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_INITIALIZE_NFNODE_ERROR_CODE,
    };
  }
};

/**
 * Request a transaction to claim reward
 * @param {string} signature - The signature of the reward claim message
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionToClaimReward = async (
  signature: string
): RequestTransactionResponse => {
  let nonceFDB: number | undefined;
  try {
    const { isValid, message } = await verifyTransactionSignature(signature);
    if (!isValid || !message) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_INVALID_SIGNATURE_ERROR_CODE,
      };
    }
    const data = await processMessageData("claim-rewards", message);
    if (!data) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_INVALID_DATA_ERROR_CODE,
      };
    }
    const {
      walletAddress,
      totalAmount,
      minerId,
      type: claimerType,
      solanaAssetId,
      nonce,
    } = data;

    // first verify the signature status
    const { isValidStatus, code } =
      await verifyTransactionTrackerToClaimRewards({
        signature,
        minerId,
        claimerType,
        nonce,
        amountToClaim: totalAmount,
      });
    if (!isValidStatus) {
      // update the status of the transaction
      await updateTransactionTrackerStatus(
        nonce,
        "request_unauthorized_by_admin"
      );
      return {
        serializedTx: null,
        error: true,
        code: code,
      };
    }
    nonceFDB = nonce;

    // prepare transaction parameters
    const rewardTokenMint = await getRewardTokenMint();
    const program = await RewardSystemManager.getInstance();
    const adminKeypair = getKeyPairFromUnit8Array(
      Uint8Array.from(JSON.parse(ENV.ADMIN_REWARD_SYSTEM_PRIVATE_KEY as string))
    );
    const user = new PublicKey(walletAddress);
    const mint = new PublicKey(rewardTokenMint);
    const nftMint = new PublicKey(solanaAssetId);
    const amountToClaim = new BN(convertToTokenAmount(totalAmount));
    const bnNonce = new BN(nonce);
    // Add priority fee
    const priorityFeeInSol = await getSolanaPriorityFee();
    const microLamportsPerComputeUnit = Math.floor(
      priorityFeeInSol * 1_000_000
    );

    // prepare params to claim reward
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
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_PREPARED_ACCOUNTS_ERROR_CODE,
      };
    }
    let ix: anchor.web3.TransactionInstruction | null = null;

    // create a transaction
    if (claimerType === "owner") {
      ix = await program.methods
        .ownerClaimRewards(amountToClaim, bnNonce)
        .accounts(accounts as unknown as any)
        .instruction();
    } else {
      ix = await program.methods
        .othersClaimRewards(amountToClaim, bnNonce)
        .accounts(accounts)
        .instruction();
    }

    // Modify the transaction creation
    const connection = getSolanaConnection();
    let tx = new anchor.web3.Transaction();
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

    // update the status of claim reward history because the admin has authorized the claim
    const updatedTransactionTracker = await updateTransactionTrackerStatus(
      nonce,
      "request_authorized_by_admin"
    );
    if (!updatedTransactionTracker) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_UPDATE_CLAIM_REWARD_HISTORY_ERROR_CODE,
      };
    }
    // return the transaction
    return {
      serializedTx: txBase64,
      error: false,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_SUCCESS_CODE,
    };
  } catch (error) {
    console.error(`Error requesting transaction to claim reward:`, error);
    if (nonceFDB !== undefined) {
      await updateTransactionTrackerStatus(
        nonceFDB,
        "request_unauthorized_by_admin"
      );
    }
    return {
      serializedTx: null,
      error: true,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_ERROR_CODE,
    };
  }
};


/**
 * Request a transaction to claim reward v2, pay wayru network fee is included
 * @param {string} signature - The signature of the reward claim message
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionToClaimRewardV2 = async (
  signature: string
): RequestTransactionResponse => {
  let nonceFDB: number | undefined;
  try {
    const { isValid, message } = await verifyTransactionSignature(signature);
    if (!isValid || !message) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_INVALID_SIGNATURE_ERROR_CODE,
      };
    }
    const data = await processMessageData("claim-rewards", message);
    if (!data) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_INVALID_DATA_ERROR_CODE,
      };
    }
    const {
      walletAddress,
      totalAmount,
      minerId,
      type: claimerType,
      solanaAssetId,
      nonce,
    } = data;

    // first verify the signature status
    const { isValidStatus, code } =
      await verifyTransactionTrackerToClaimRewards({
        signature,
        minerId,
        claimerType,
        nonce,
        amountToClaim: totalAmount,
      });
    if (!isValidStatus) {
      // update the status of the transaction
      await updateTransactionTrackerStatus(
        nonce,
        "request_unauthorized_by_admin"
      );
      return {
        serializedTx: null,
        error: true,
        code: code,
      };
    }
    nonceFDB = nonce;

    // prepare transaction parameters
    const rewardTokenMint = await getRewardTokenMint();
    const program = await RewardSystemManager.getInstance();
    const adminKeypair = getKeyPairFromUnit8Array(
      Uint8Array.from(JSON.parse(ENV.ADMIN_REWARD_SYSTEM_PRIVATE_KEY as string))
    );
    const user = new PublicKey(walletAddress);
    const mint = new PublicKey(rewardTokenMint);
    const nftMint = new PublicKey(solanaAssetId);
    const amountToClaim = new BN(convertToTokenAmount(totalAmount));
    const bnNonce = new BN(nonce);
    // Add priority fee
    const priorityFeeInSol = await getSolanaPriorityFee();
    const wayruFeeTransaction = await getWayruFeeTransaction();
    const microLamportsPerComputeUnit = Math.floor(
      priorityFeeInSol * 1_000_000
    );

    // prepare params to claim reward
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
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_PREPARED_ACCOUNTS_ERROR_CODE,
      };
    }
    let ix: anchor.web3.TransactionInstruction | null = null;

    // create instruction to send wayru token to wayru foundation wallet
    const ixToSendWayruToFoundationWallet =
      await instructionToSendWayruToFoundationWallet(
        user,
        wayruFeeTransaction
      );
    if (!ixToSendWayruToFoundationWallet) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_PREPARED_ACCOUNTS_ERROR_CODE,
      };
    }

    // create a transaction
    if (claimerType === "owner") {
      ix = await program.methods
        .ownerClaimRewards(amountToClaim, bnNonce)
        .accounts(accounts as unknown as any)
        .instruction();
    } else {
      ix = await program.methods
        .othersClaimRewards(amountToClaim, bnNonce)
        .accounts(accounts)
        .instruction();
    }

    // Modify the transaction creation
    const connection = getSolanaConnection();
    let tx = new anchor.web3.Transaction();
    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: microLamportsPerComputeUnit,
      }),
      ixToSendWayruToFoundationWallet,
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

    // update the status of claim reward history because the admin has authorized the claim
    const updatedTransactionTracker = await updateTransactionTrackerStatus(
      nonce,
      "request_authorized_by_admin"
    );
    if (!updatedTransactionTracker) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_UPDATE_CLAIM_REWARD_HISTORY_ERROR_CODE,
      };
    }
    // return the transaction
    return {
      serializedTx: txBase64,
      error: false,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_SUCCESS_CODE,
    };
  } catch (error) {
    console.error(`Error requesting transaction to claim reward:`, error);
    if (nonceFDB !== undefined) {
      await updateTransactionTrackerStatus(
        nonceFDB,
        "request_unauthorized_by_admin"
      );
    }
    return {
      serializedTx: null,
      error: true,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_ERROR_CODE,
    };
  }
};


/**
 * Request a transaction to claim reward v2, pay wayru network fee is included
 * Returns 2 transactions: one to initialize the NFT (nfnode) and one to claim rewards
 * @param {string} signature - The signature of the reward claim message
 * @returns {Promise<{ serializedTx: string | null, serializedInitTx: string | null, error: boolean, code: string }>} - serializedTx: claim rewards tx, serializedInitTx: initialize nfnode tx
 */
export const requestTransactionToClaimDepinStakerRewards = async (
  signature: string,
  includeInitTx: boolean,
  includeAdminAuthorization: boolean = true
): RequestTransactionWithInitResponse => {
  let nonceFDB: number | undefined;
  try {
    const { isValid, message } = await verifyTransactionSignature(signature);
    if (!isValid || !message) {
      return {
        serializedTx: null,
        serializedInitTx: null,
        nonce: 0,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_INVALID_SIGNATURE_ERROR_CODE,
      };
    }
    const data = await processMessageData("claim-rewards", message);
    if (!data) {
      return {
        serializedTx: null,
        serializedInitTx: null,
        nonce: 0,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_INVALID_DATA_ERROR_CODE,
      };
    }
    const {
      walletAddress,
      totalAmount,
      minerId,
      type: claimerType,
      solanaAssetId,
      nonce,
    } = data;

    // first verify the signature status
    const { isValidStatus, code } =
      await verifyTxTrackerToClaimDepinStakerRewards({
        signature,
        minerId,
        claimerType,
        nonce,
        amountToClaim: totalAmount,
      });
    if (!isValidStatus) {
      // update the status of the transaction
      await updateTransactionTrackerStatus(
        nonce,
        "request_unauthorized_by_admin"
      );
      return {
        serializedTx: null,
        serializedInitTx: null,
        nonce,
        error: true,
        code: code,
      };
    }
    nonceFDB = nonce;

    // Get nfnode initialization data from message or use defaults
    // Note: These fields should be added to the ClaimRewardsMessage interface if not present
    const nfnodeType = (data as any).nfnodeType || { don: {} }; // Default to 'don' type
    const hostAddress = (data as any).hostAddress || "8QMK1JHzjydq7qHgTo1RwK3ateLm4zVQF7V7BkriNkeD";
    const manufacturerAddress = (data as any).manufacturerAddress || "FCap4kWAPMMTvAqUgEX3oFmMmSzg7g3ytxknYD21hpzm";

    // Create transaction to initialize NFT (nfnode)
    let serializedInitTx = null;
    if (includeInitTx) {
      const { error: initTxError, serializedTransaction } = await createTransactionToInitializeNfnode({
        walletAddress: walletAddress,
        nftMintAddress: solanaAssetId,
        nfnodeType: nfnodeType,
        hostAddress: hostAddress,
        manufacturerAddress: manufacturerAddress,
        forSimulation: false // This is for real transaction
      });
      serializedInitTx = serializedTransaction
      if (initTxError || !serializedInitTx) {
        return {
          serializedTx: null,
          serializedInitTx: null,
          nonce,
          error: true,
          code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_INITIALIZE_NFNODE_ERROR_CODE,
        };
      }
    }

    // prepare transaction parameters for claim rewards
    const rewardTokenMint = await getRewardTokenMint();
    const program = await RewardSystemManager.getInstance();
    const adminKeypair = getKeyPairFromUnit8Array(
      Uint8Array.from(JSON.parse(ENV.ADMIN_REWARD_SYSTEM_PRIVATE_KEY as string))
    );
    const user = new PublicKey(walletAddress);
    const mint = new PublicKey(rewardTokenMint);
    const nftMint = new PublicKey(solanaAssetId);
    const amountToClaim = new BN(convertToTokenAmount(totalAmount));
    const bnNonce = new BN(nonce);
    // Add priority fee
    const priorityFeeInSol = await getSolanaPriorityFee();
    const wayruFeeTransaction = await getWayruFeeTransaction();
    const microLamportsPerComputeUnit = Math.floor(
      priorityFeeInSol * 1_000_000
    );

    // prepare params to claim reward
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
        serializedTx: null,
        serializedInitTx: null,
        nonce,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_PREPARED_ACCOUNTS_ERROR_CODE,
      };
    }

    // create instruction to send wayru token to wayru foundation wallet
    const ixToSendWayruToFoundationWallet =
      await instructionToSendWayruToFoundationWallet(
        user,
        wayruFeeTransaction
      );
    if (!ixToSendWayruToFoundationWallet) {
      return {
        serializedTx: null,
        serializedInitTx: null,
        nonce,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_PREPARED_ACCOUNTS_ERROR_CODE,
      };
    }


    const ix = await program.methods
      .ownerClaimRewards(amountToClaim, bnNonce)
      .accounts(accounts as unknown as any)
      .instruction();


    // Modify the transaction creation
    const connection = getSolanaConnection();
    let tx = new anchor.web3.Transaction();
    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: microLamportsPerComputeUnit,
      }),
      ixToSendWayruToFoundationWallet,
      ix
    );
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = user;

    // admin sign the transaction
    if (includeAdminAuthorization) {
      tx.partialSign(adminKeypair);
    }

    // serialize tx
    const serializedTx = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    const txBase64 = serializedTx.toString("base64");

    // create hash transaction to claim rewards
    const hashTransaction = createTransactionHash(tx);

    // update the status of claim reward history because the admin has authorized the claim
    const updatedTransactionTracker = await updateTransactionTrackerStatus(
      nonce,
      "request_authorized_by_admin",
      hashTransaction
    );
    if (!updatedTransactionTracker) {
      return {
        serializedTx: null,
        serializedInitTx: null,
        nonce,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_UPDATE_CLAIM_REWARD_HISTORY_ERROR_CODE,
      };
    }
    // return both transactions
    return {
      serializedTx: txBase64,
      serializedInitTx: serializedInitTx,
      nonce,
      error: false,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_SUCCESS_CODE,
    };
  } catch (error) {
    console.error(`Error requesting transaction to claim reward:`, error);
    if (nonceFDB !== undefined) {
      await updateTransactionTrackerStatus(
        nonceFDB,
        "request_unauthorized_by_admin"
      );
    }
    return {
      serializedTx: null,
      serializedInitTx: null,
      nonce: 0,
      error: true,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_ERROR_CODE,
    };
  }
};


/**
 * Request a transaction to update the host of a NFNode
 * @param {string} signature - The signature of the update host message
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionToUpdateHost = async (
  signature: string
): RequestTransactionResponse => {
  try {
    // verify the signature
    const { isValid, message } = await verifyTransactionSignature(signature);
    if (!isValid || !message) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_UPDATE_NFNODE_INVALID_SIGNATURE_ERROR_CODE,
      };
    }
    const data = await processMessageData("add-host-to-nfnode", message);
    if (!data) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_UPDATE_NFNODE_INVALID_DATA_ERROR_CODE,
      };
    }
    const {
      walletOwnerAddress,
      hostAddress,
      solanaAssetId,
      feeToUpdateMetadata,
      paymentToAddHostToNFnode,
      solanaWalletAddressAdmin,
      solanaTreasuryWalletAddress,
      solanaWayruFeeTransactionAddress,
      wayruFeeTransaction,
      nonce,
      hostShare,
    } = data;
    // validate signature status
    const { isValid: isValidSignature, code: codeSignature } =
      await validateAndUpdateSignatureStatus(nonce, signature);
    if (!isValidSignature) {
      return {
        serializedTx: null,
        error: true,
        code: codeSignature,
      };
    }

    // prepare transaction parameters
    const connection = getSolanaConnection();
    const program = await RewardSystemManager.getInstance();
    const ownerAddress = new PublicKey(walletOwnerAddress);
    const nftMint = new PublicKey(solanaAssetId);
    const adminKeypair = getKeyPairFromUnit8Array(
      Uint8Array.from(JSON.parse(ENV.ADMIN_REWARD_SYSTEM_PRIVATE_KEY as string))
    );
    const hostWalletAddress = new PublicKey(hostAddress);
    const bnHostShare = new BN(hostShare);
    const userNFTTokenAccount = await getAssociatedTokenAddress(
      nftMint,
      ownerAddress,
      false, // allowOwnerOffCurve
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const transaction = new Transaction();
    const WAYRU_MINT_ADDRESS = await getRewardTokenMint();

    // create instruction to pay wayru network fee
    const fromTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(WAYRU_MINT_ADDRESS),
      new PublicKey(walletOwnerAddress),
      false,
      TOKEN_PROGRAM_ID,
    )
    const WayruFeeWalletTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(WAYRU_MINT_ADDRESS),
      new PublicKey(solanaWayruFeeTransactionAddress),
      false,
      TOKEN_PROGRAM_ID,
    )
    const treasureWalletTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(WAYRU_MINT_ADDRESS),
      new PublicKey(solanaTreasuryWalletAddress),
      false,
      TOKEN_PROGRAM_ID,
    )


    // add transfer instruction
    // Add SOL transfers
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: ownerAddress,
        toPubkey: new PublicKey(solanaWalletAddressAdmin),
        lamports: Math.round(feeToUpdateMetadata * LAMPORTS_PER_SOL), // payment to admin for updating metadata
      }),
      createTransferInstruction(
        fromTokenAccount,
        treasureWalletTokenAccount,
        new PublicKey(walletOwnerAddress),
        Math.round(paymentToAddHostToNFnode * Math.pow(10, 6)) // payment to treasury wallet for adding host
      ),
      createTransferInstruction(
        fromTokenAccount,
        WayruFeeWalletTokenAccount,
        new PublicKey(walletOwnerAddress),
        Math.round(wayruFeeTransaction * Math.pow(10, 6)) // payment fee to wayru fee wallet to make the tx
      )
    );

    console.log('instructions to pay network fee')

    // create the tx for the user
    const updateNfnodeIx = await program.methods
      .updateNfnode(bnHostShare)
      .accounts({
        userAdmin: adminKeypair.publicKey,
        user: ownerAddress,
        host: hostWalletAddress,
        nftMintAddress: nftMint,
        userNftTokenAccount: userNFTTokenAccount,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
      })
      .instruction();

    transaction.add(updateNfnodeIx);
    transaction.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash;
    transaction.feePayer = ownerAddress;
    // admin sign the transaction
    transaction.partialSign(adminKeypair);

    // serialize tx
    const serializedTx = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    // update the status of the transaction
    await updateTransactionTrackerStatus(nonce, "request_authorized_by_admin");

    return {
      serializedTx: serializedTx.toString("base64"),
      error: false,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_SUCCESS_CODE,
    };
  } catch (error) {
    return {
      serializedTx: null,
      error: true,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_UPDATE_HOST_ERROR_CODE,
    };
  }
};
/**
 * Request a transaction to update the host of a NFNode
 * @param {string} signature - The signature of the update host message
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionToUpdateHostV2 = async (
  signature: string
): RequestTransactionResponse => {
  try {
    // verify the signature
    const { isValid, message } = await verifyTransactionSignature(signature);
    if (!isValid || !message) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_UPDATE_NFNODE_INVALID_SIGNATURE_ERROR_CODE,
      };
    }
    const data = await processMessageData("add-host-to-nfnode", message);
    if (!data) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_UPDATE_NFNODE_INVALID_DATA_ERROR_CODE,
      };
    }
    const {
      walletOwnerAddress,
      hostAddress,
      solanaAssetId,
      feeToUpdateMetadata,
      paymentToAddHostToNFnode,
      solanaWalletAddressAdmin,
      solanaTreasuryWalletAddress,
      solanaWayruFeeTransactionAddress,
      wayruFeeTransaction,
      nonce,
      hostShare,
    } = data;
    // validate signature status
    const { isValid: isValidSignature, code: codeSignature } =
      await validateAndUpdateSignatureStatus(nonce, signature);
    if (!isValidSignature) {
      return {
        serializedTx: null,
        error: true,
        code: codeSignature,
      };
    }

    // prepare transaction parameters
    const connection = getSolanaConnection();
    const program = await RewardSystemManager.getInstance();
    const ownerAddress = new PublicKey(walletOwnerAddress);
    const nftMint = new PublicKey(solanaAssetId);
    const adminKeypair = getKeyPairFromUnit8Array(
      Uint8Array.from(JSON.parse(ENV.ADMIN_REWARD_SYSTEM_PRIVATE_KEY as string))
    );
    const hostWalletAddress = new PublicKey(hostAddress);
    const bnHostShare = new BN(hostShare);
    const userNFTTokenAccount = await getAssociatedTokenAddress(
      nftMint,
      ownerAddress,
      false, // allowOwnerOffCurve
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const transaction = new Transaction();
    const WAYRU_MINT_ADDRESS = await getRewardTokenMint();
    // create instruction to pay wayru network fee
    const fromTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(WAYRU_MINT_ADDRESS),
      new PublicKey(walletOwnerAddress),
      false,
      TOKEN_PROGRAM_ID
    );
    const WayruFeeWalletTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(WAYRU_MINT_ADDRESS),
      new PublicKey(solanaWayruFeeTransactionAddress),
      false,
      TOKEN_PROGRAM_ID
    );
    const treasureWalletTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(WAYRU_MINT_ADDRESS),
      new PublicKey(solanaTreasuryWalletAddress),
      false,
      TOKEN_PROGRAM_ID
    );

    // add transfer instruction
    // Add SOL transfers
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: ownerAddress,
        toPubkey: new PublicKey(solanaWalletAddressAdmin),
        lamports: Math.round(feeToUpdateMetadata * LAMPORTS_PER_SOL), // payment to admin update metadata
      }),
      createTransferInstruction(
        fromTokenAccount,
        treasureWalletTokenAccount,
        new PublicKey(walletOwnerAddress),
        Math.round(paymentToAddHostToNFnode * Math.pow(10, 6)) // payment to treasury wallet for adding host
      ),
    );

    // if wayruFeeTransaction > 0, add instruction to send wayru token to wayru fee wallet
    if (wayruFeeTransaction > 0) {
      transaction.add(
        createTransferInstruction(
          fromTokenAccount,
          WayruFeeWalletTokenAccount,
          new PublicKey(walletOwnerAddress),
          Math.round(wayruFeeTransaction * Math.pow(10, 6)) // payment fee to wayru fee wallet to make the tx
        )
      );
    }

    // create the tx for the user
    const updateNfnodeIx = await program.methods
      .updateNfnode(bnHostShare)
      .accounts({
        userAdmin: adminKeypair.publicKey,
        user: ownerAddress,
        host: hostWalletAddress,
        nftMintAddress: nftMint,
        userNftTokenAccount: userNFTTokenAccount,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
      })
      .instruction();

    transaction.add(updateNfnodeIx);
    transaction.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash;
    transaction.feePayer = ownerAddress;
    // admin sign the transaction
    transaction.partialSign(adminKeypair);

    // serialize tx
    const serializedTx = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    // update the status of the transaction
    await updateTransactionTrackerStatus(nonce, "request_authorized_by_admin");

    return {
      serializedTx: serializedTx.toString("base64"),
      error: false,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_SUCCESS_CODE,
    };
  } catch (error) {
    return {
      serializedTx: null,
      error: true,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_UPDATE_HOST_ERROR_CODE,
    };
  }
};

/**
 * Request a transaction to withdraw tokens
 * @param signature - The signature of the withdraw tokens message
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionWithdrawTokens = async (
  signature: string
): Promise<RequestTransactionResponse> => {
  try {
    const { isValid, message } = await verifyTransactionSignature(signature);
    if (!isValid || !message) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_WITHDRAW_TOKENS_INVALID_SIGNATURE_ERROR_CODE,
      };
    }
    // decode the message
    const data = await processMessageData("withdraw-tokens", message);
    if (!data) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_WITHDRAW_TOKENS_INVALID_DATA_ERROR_CODE,
      };
    }
    const { walletAddress, solanaAssetId, nonce } = data;

    // validate signature status // validate signature status
    const { isValid: isValidSignature, code: codeSignature } =
      await validateAndUpdateSignatureStatus(nonce, signature);
    if (!isValidSignature) {
      return {
        serializedTx: null,
        error: true,
        code: codeSignature,
      };
    }

    const connection = getSolanaConnection();
    const program = await RewardSystemManager.getInstance();
    const user = new PublicKey(walletAddress);
    const nftMint = new PublicKey(solanaAssetId);
    // get the user nft token account
    const userNFTTokenAccount = await getAssociatedTokenAddress(
      nftMint,
      user,
      false, // allowOwnerOffCurve
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const _userNFTTokenAccount = new PublicKey(userNFTTokenAccount);
    const rewardTokenMint = await getRewardTokenMint();

    const _signature = await program.methods
      .withdrawTokens()
      .accounts({
        user: user,
        tokenMint: new PublicKey(rewardTokenMint),
        nftMintAddress: nftMint,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        userNftTokenAccount: _userNFTTokenAccount,
      })
      .instruction();

    const tx = new Transaction();
    tx.add(_signature);
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = user;

    // serialize tx
    const serializedTx = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    // update tx status
    await updateTransactionTrackerStatus(nonce, "request_authorized_by_admin");

    return {
      serializedTx: serializedTx.toString("base64"),
      error: false,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_SUCCESS_CODE,
    };
  } catch (error) {
    console.error(`Error requesting transaction to withdraw tokens:`, error);
    return {
      serializedTx: null,
      error: true,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_WITHDRAW_TOKENS_ERROR_CODE,
    };
  }
};

/**
 * Request a transaction to withdraw tokens v2, include wayru network fee
 * @param signature - The signature of the withdraw tokens message
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionWithdrawTokensV2 = async (
  signature: string
): Promise<RequestTransactionResponse> => {
  try {
    const { isValid, message } = await verifyTransactionSignature(signature);
    if (!isValid || !message) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_WITHDRAW_TOKENS_INVALID_SIGNATURE_ERROR_CODE,
      };
    }
    // decode the message
    const data = await processMessageData("withdraw-tokens", message);
    if (!data) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_WITHDRAW_TOKENS_INVALID_DATA_ERROR_CODE,
      };
    }
    const { walletAddress, solanaAssetId, nonce } = data;

    // validate signature status // validate signature status
    const { isValid: isValidSignature, code: codeSignature } =
      await validateAndUpdateSignatureStatus(nonce, signature);
    if (!isValidSignature) {
      return {
        serializedTx: null,
        error: true,
        code: codeSignature,
      };
    }

    const connection = getSolanaConnection();
    const program = await RewardSystemManager.getInstance();
    const user = new PublicKey(walletAddress);
    const nftMint = new PublicKey(solanaAssetId);
    // get the user nft token account
    const userNFTTokenAccount = await getAssociatedTokenAddress(
      nftMint,
      user,
      false, // allowOwnerOffCurve
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const _userNFTTokenAccount = new PublicKey(userNFTTokenAccount);
    const rewardTokenMint = await getRewardTokenMint();
    const wayruFeeTransaction = await getWayruFeeTransaction();

    const _signature = await program.methods
      .withdrawTokens()
      .accounts({
        user: user,
        tokenMint: new PublicKey(rewardTokenMint),
        nftMintAddress: nftMint,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        userNftTokenAccount: _userNFTTokenAccount,
      })
      .instruction();

    const tx = new Transaction();
    // add instruction to pay wayru network fee
    const ixToSendWayruToFoundationWallet = await instructionToSendWayruToFoundationWallet(
      user,
      wayruFeeTransaction
    );
    if (!ixToSendWayruToFoundationWallet) {
      throw new Error("Failed to create instruction to send wayru token to wayru foundation wallet");
    }

    // join instructions
    tx.add(ixToSendWayruToFoundationWallet, _signature);
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = user;

    // serialize tx
    const serializedTx = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    // update tx status
    await updateTransactionTrackerStatus(nonce, "request_authorized_by_admin");

    return {
      serializedTx: serializedTx.toString("base64"),
      error: false,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_SUCCESS_CODE,
    };
  } catch (error) {
    console.error(`Error requesting transaction to withdraw tokens:`, error);
    return {
      serializedTx: null,
      error: true,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_WITHDRAW_TOKENS_ERROR_CODE,
    };
  }
};

/**
 * Request a transaction to withdraw staked tokens
 * @param signature - The signature of the withdraw tokens message
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionWithdrawStakedTokens = async (
  signature: string
): Promise<RequestTransactionResponse> => {
  try {
    const { isValid, message } = await verifyTransactionSignature(signature);
    if (!isValid || !message) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_WITHDRAW_TOKENS_INVALID_SIGNATURE_ERROR_CODE,
      };
    }
    // decode the message
    const data = await processMessageData("withdraw-tokens", message);
    if (!data) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_WITHDRAW_TOKENS_INVALID_DATA_ERROR_CODE,
      };
    }
    const { walletAddress, solanaAssetId, nonce } = data;

    // validate signature status // validate signature status
    const { isValid: isValidSignature, code: codeSignature } =
      await validateAndUpdateSignatureStatus(nonce, signature);
    if (!isValidSignature) {
      return {
        serializedTx: null,
        error: true,
        code: codeSignature,
      };
    }

    const connection = getSolanaConnection();
    const program = await StakeSystemManager.getInstance();
    const user = new PublicKey(walletAddress);
    const nftMint = new PublicKey(solanaAssetId);
    // get the user nft token account
    const userNFTTokenAccount = await getAssociatedTokenAddress(
      nftMint,
      user,
      false, // allowOwnerOffCurve
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const _userNFTTokenAccount = new PublicKey(userNFTTokenAccount);
    const rewardTokenMint = await getRewardTokenMint();

    const ix = await program.methods
      .withdrawTokens()
      .accounts({
        user: user,
        tokenMint: new PublicKey(rewardTokenMint),
        nftMintAddress: nftMint,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        userNftTokenAccount: _userNFTTokenAccount,
      })
      .instruction();

    const tx = new Transaction();

    // add priority fee
    const priorityFeeInSol = await getSolanaPriorityFee();
    // Convert SOL to microLamports per compute unit
    const microLamportsPerComputeUnit = Math.floor(
      priorityFeeInSol * 1_000_000
    );

    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: microLamportsPerComputeUnit,
      }),
      ix
    );
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = user;

    // serialize tx
    const serializedTx = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    // update tx status
    await updateTransactionTrackerStatus(nonce, "request_authorized_by_admin");

    return {
      serializedTx: serializedTx.toString("base64"),
      error: false,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_SUCCESS_CODE,
    };
  } catch (error) {
    console.error(`Error requesting transaction to withdraw tokens:`, error);
    return {
      serializedTx: null,
      error: true,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_WITHDRAW_TOKENS_ERROR_CODE,
    };
  }
};

/**
 * Request a transaction to withdraw staked tokens v2, include wayru network fee
 * @param signature - The signature of the withdraw tokens message
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionWithdrawStakedTokensV2 = async (
  signature: string
): Promise<RequestTransactionResponse> => {
  try {
    const { isValid, message } = await verifyTransactionSignature(signature);
    if (!isValid || !message) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_WITHDRAW_TOKENS_INVALID_SIGNATURE_ERROR_CODE,
      };
    }
    // decode the message
    const data = await processMessageData("withdraw-tokens", message);
    if (!data) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_WITHDRAW_TOKENS_INVALID_DATA_ERROR_CODE,
      };
    }
    const { walletAddress, solanaAssetId, nonce } = data;

    // validate signature status // validate signature status
    const { isValid: isValidSignature, code: codeSignature } =
      await validateAndUpdateSignatureStatus(nonce, signature);
    if (!isValidSignature) {
      return {
        serializedTx: null,
        error: true,
        code: codeSignature,
      };
    }

    const connection = getSolanaConnection();
    const program = await StakeSystemManager.getInstance();
    const user = new PublicKey(walletAddress);
    const nftMint = new PublicKey(solanaAssetId);
    // get the user nft token account
    const userNFTTokenAccount = await getAssociatedTokenAddress(
      nftMint,
      user,
      false, // allowOwnerOffCurve
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const _userNFTTokenAccount = new PublicKey(userNFTTokenAccount);
    const rewardTokenMint = await getRewardTokenMint();
    const wayruFeeTransaction = await getWayruFeeTransaction();

    const ix = await program.methods
      .withdrawTokens()
      .accounts({
        user: user,
        tokenMint: new PublicKey(rewardTokenMint),
        nftMintAddress: nftMint,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        userNftTokenAccount: _userNFTTokenAccount,
      })
      .instruction();

    const tx = new Transaction();

    // add priority fee
    const priorityFeeInSol = await getSolanaPriorityFee();
    // Convert SOL to microLamports per compute unit
    const microLamportsPerComputeUnit = Math.floor(
      priorityFeeInSol * 1_000_000
    );

    // add instruction to pay wayru network fee
    const ixToSendWayruToFoundationWallet = await instructionToSendWayruToFoundationWallet(
      user,
      wayruFeeTransaction
    );
    if (!ixToSendWayruToFoundationWallet) {
      throw new Error("Failed to create instruction to send wayru token to wayru foundation wallet");
    }

    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: microLamportsPerComputeUnit,
      }),
      ixToSendWayruToFoundationWallet,
      ix
    );
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = user;

    // serialize tx
    const serializedTx = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    // update tx status
    await updateTransactionTrackerStatus(nonce, "request_authorized_by_admin");

    return {
      serializedTx: serializedTx.toString("base64"),
      error: false,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_SUCCESS_CODE,
    };
  } catch (error) {
    console.error(`Error requesting transaction to withdraw tokens:`, error);
    return {
      serializedTx: null,
      error: true,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_WITHDRAW_TOKENS_ERROR_CODE,
    };
  }
};


/**
 * Request a transaction to claim w credits
 * @param signature - The signature of the claim w credits message
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionToClaimWCredits = async (
  signature: string
): Promise<RequestTransactionResponse> => {
  try {
    // verify the signature
    const { isValid, message } = await verifyTransactionSignature(signature);
    if (!isValid || !message) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_INITIALIZE_NFNODE_INVALID_SIGNATURE_ERROR_CODE,
      };
    }
    // process message data
    const data = await processMessageData("claim-w-credits", message);
    if (!data) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_INITIALIZE_NFNODE_INVALID_DATA_ERROR_CODE,
      };
    }
    const { walletAddress, amountToClaim, nonce, trackerId } = data;
    // validate signature status
    const { isValid: isValidSignature, code: codeSignature } =
      await validateAndUpdateSignatureStatus(trackerId, signature);
    if (!isValidSignature) {
      return {
        serializedTx: null,
        error: true,
        code: codeSignature,
      };
    }

    // get program
    const program = await AirdropsSystemManager.getInstance();
    const adminKeypair = getKeyPairFromUnit8Array(
      Uint8Array.from(JSON.parse(ENV.ADMIN_REWARD_SYSTEM_PRIVATE_KEY as string))
    );
    const user = new PublicKey(walletAddress); // owner of the NFT
    const connection = getSolanaConnection();
    const rewardTokenMint = await getRewardTokenMint();
    // Add priority fee
    const priorityFeeInSol = await getSolanaPriorityFee();
    const microLamportsPerComputeUnit = Math.floor(
      priorityFeeInSol * 1_000_000
    );

    // amount to claim
    const amount = new BN(convertToTokenAmount(amountToClaim));
    const ix = await program.methods
      .claimTokens(amount, new BN(nonce))
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

    // update the status of the transaction
    await updateTransactionTrackerStatus(
      trackerId,
      "request_authorized_by_admin"
    );

    return {
      serializedTx: txBase64,
      error: false,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_SUCCESS_CODE,
    };
  } catch (error) {
    console.error(`Error requesting transaction to claim w credits:`, error);
    return {
      serializedTx: null,
      error: true,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_W_CREDITS_ERROR_CODE,
    };
  }
};

/**
 * Request a transaction to deposit tokens
 * @param signature - The signature of the deposit tokens message
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionDepositTokens = async (
  signature: string
): Promise<RequestTransactionResponse> => {
  try {
    const { isValid, message } = await verifyTransactionSignature(signature);
    if (!isValid || !message) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_DEPOSIT_TOKENS_INVALID_SIGNATURE_ERROR_CODE,
      };
    }
    const data = await processMessageData("deposit-tokens", message);
    if (!data) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_DEPOSIT_TOKENS_INVALID_DATA_ERROR_CODE,
      };
    }
    const { walletAddress, solanaAssetId, nonce } = data;
    // validate signature status
    const { isValid: isValidSignature, code: codeSignature } =
      await validateAndUpdateSignatureStatus(nonce, signature);
    if (!isValidSignature) {
      return {
        serializedTx: null,
        error: true,
        code: codeSignature,
      };
    }
    const connection = getSolanaConnection();
    const program = await RewardSystemManager.getInstance();
    const user = new PublicKey(walletAddress);
    const nftMint = new PublicKey(solanaAssetId);
    const userNFTTokenAccount = await getAssociatedTokenAddress(
      nftMint,
      user,
      false, // allowOwnerOffCurve
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const rewardTokenMint = await getRewardTokenMint();

    const ix = await program.methods
      .depositTokens()
      .accounts({
        user: user,
        tokenMint: new PublicKey(rewardTokenMint),
        nftMintAddress: nftMint,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        userNftTokenAccount: userNFTTokenAccount,
      })
      .instruction();

    const tx = new Transaction();
    // add ix to tx
    tx.add(ix);
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = user;

    // serialize tx
    const serializedTx = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    // update the status of the transaction
    await updateTransactionTrackerStatus(nonce, "request_authorized_by_admin");

    return {
      serializedTx: serializedTx.toString("base64"),
      error: false,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_SUCCESS_CODE,
    };
  } catch (error) {
    console.error(`Error requesting transaction to deposit tokens:`, error);
    return {
      serializedTx: null,
      error: true,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_DEPOSIT_TOKENS_ERROR_CODE,
    };
  }
};

/**
 * Request a transaction to deposit tokens v2, include wayru network fee
 * @param signature - The signature of the deposit tokens message
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionDepositTokensV2 = async (
  signature: string
): Promise<RequestTransactionResponse> => {
  try {
    const { isValid, message } = await verifyTransactionSignature(signature);
    if (!isValid || !message) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_DEPOSIT_TOKENS_INVALID_SIGNATURE_ERROR_CODE,
      };
    }
    const data = await processMessageData("deposit-tokens", message);
    if (!data) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_DEPOSIT_TOKENS_INVALID_DATA_ERROR_CODE,
      };
    }
    const { walletAddress, solanaAssetId, nonce } = data;
    // validate signature status
    const { isValid: isValidSignature, code: codeSignature } =
      await validateAndUpdateSignatureStatus(nonce, signature);
    if (!isValidSignature) {
      return {
        serializedTx: null,
        error: true,
        code: codeSignature,
      };
    }
    const connection = getSolanaConnection();
    const program = await RewardSystemManager.getInstance();
    const user = new PublicKey(walletAddress);
    const nftMint = new PublicKey(solanaAssetId);
    const userNFTTokenAccount = await getAssociatedTokenAddress(
      nftMint,
      user,
      false, // allowOwnerOffCurve
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const rewardTokenMint = await getRewardTokenMint();
    const wayruFeeTransaction = await getWayruFeeTransaction();

    // add instruction to pay wayru network fee
    const ixToSendWayruToFoundationWallet = await instructionToSendWayruToFoundationWallet(
      user,
      wayruFeeTransaction
    );
    if (!ixToSendWayruToFoundationWallet) {
      throw new Error("Failed to create instruction to send wayru token to wayru foundation wallet");
    }

    const ix = await program.methods
      .depositTokens()
      .accounts({
        user: user,
        tokenMint: new PublicKey(rewardTokenMint),
        nftMintAddress: nftMint,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        userNftTokenAccount: userNFTTokenAccount,
      })
      .instruction();

    const tx = new Transaction();
    // add ix to tx
    tx.add(ixToSendWayruToFoundationWallet, ix);
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = user;

    // serialize tx
    const serializedTx = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    // update the status of the transaction
    await updateTransactionTrackerStatus(nonce, "request_authorized_by_admin");

    return {
      serializedTx: serializedTx.toString("base64"),
      error: false,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_SUCCESS_CODE,
    };
  } catch (error) {
    console.error(`Error requesting transaction to deposit tokens:`, error);
    return {
      serializedTx: null,
      error: true,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_DEPOSIT_TOKENS_ERROR_CODE,
    };
  }
};

/**
 * Request a transaction to deposit tokens
 * @param signature - The signature of the deposit tokens message
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionStakeTokens = async (
  signature: string
): Promise<RequestTransactionResponse> => {
  try {
    const { isValid, message } = await verifyTransactionSignature(signature);
    if (!isValid || !message) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_DEPOSIT_TOKENS_INVALID_SIGNATURE_ERROR_CODE,
      };
    }
    const data = await processMessageData("stake-tokens", message);
    if (!data) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_DEPOSIT_TOKENS_INVALID_DATA_ERROR_CODE,
      };
    }
    const { walletAddress, solanaAssetId, amount, nonce } = data;
    // validate signature status
    const { isValid: isValidSignature, code: codeSignature } =
      await validateAndUpdateSignatureStatus(nonce, signature);
    if (!isValidSignature) {
      return {
        serializedTx: null,
        error: true,
        code: codeSignature,
      };
    }
    const connection = getSolanaConnection();
    const program = await StakeSystemManager.getInstance();
    const user = new PublicKey(walletAddress);
    const nftMint = new PublicKey(solanaAssetId);
    const userNFTTokenAccount = await getAssociatedTokenAddress(
      nftMint,
      user,
      false, // allowOwnerOffCurve
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const rewardTokenMint = await getRewardTokenMint();

    const ix = await program.methods
      .depositTokens(new BN(amount * 1000000))
      .accounts({
        user: user,
        tokenMint: new PublicKey(rewardTokenMint),
        nftMintAddress: nftMint,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        userNftTokenAccount: userNFTTokenAccount,
      })
      .instruction();

    const tx = new Transaction();
    // add priority fee
    const priorityFeeInSol = await getSolanaPriorityFee();
    // Convert SOL to microLamports per compute unit
    const microLamportsPerComputeUnit = Math.floor(
      priorityFeeInSol * 1_000_000
    );

    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: microLamportsPerComputeUnit,
      }),
      ix
    );

    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = user;

    // serialize tx
    const serializedTx = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    // update the status of the transaction
    await updateTransactionTrackerStatus(nonce, "request_authorized_by_admin");

    return {
      serializedTx: serializedTx.toString("base64"),
      error: false,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_SUCCESS_CODE,
    };
  } catch (error) {
    console.error(`Error requesting transaction to deposit tokens:`, error);
    return {
      serializedTx: null,
      error: true,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_DEPOSIT_TOKENS_ERROR_CODE,
    };
  }
};

/**
 * Request a transaction to deposit tokens
 * @param signature - The signature of the deposit tokens message v2, include wayru fee transaction
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionStakeTokensV2 = async (
  signature: string
): Promise<RequestTransactionResponse> => {
  try {
    const { isValid, message } = await verifyTransactionSignature(signature);
    if (!isValid || !message) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_DEPOSIT_TOKENS_INVALID_SIGNATURE_ERROR_CODE,
      };
    }
    const data = await processMessageData("stake-tokens", message);
    if (!data) {
      return {
        serializedTx: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_DEPOSIT_TOKENS_INVALID_DATA_ERROR_CODE,
      };
    }
    const { walletAddress, solanaAssetId, amount, nonce } = data;
    // validate signature status
    const { isValid: isValidSignature, code: codeSignature } =
      await validateAndUpdateSignatureStatus(nonce, signature);
    if (!isValidSignature) {
      return {
        serializedTx: null,
        error: true,
        code: codeSignature,
      };
    }
    const connection = getSolanaConnection();
    const program = await StakeSystemManager.getInstance();
    const user = new PublicKey(walletAddress);
    const nftMint = new PublicKey(solanaAssetId);

    const userNFTTokenAccount = await getAssociatedTokenAddress(
      nftMint,
      user,
      false, // allowOwnerOffCurve
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const rewardTokenMint = await getRewardTokenMint();
    // add wayru fee transaction
    const wayruFeeTransaction = await getWayruFeeTransaction();

    const ix = await program.methods
      .depositTokens(new BN(amount * 1000000))
      .accounts({
        user: user,
        tokenMint: new PublicKey(rewardTokenMint),
        nftMintAddress: nftMint,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        userNftTokenAccount: userNFTTokenAccount,
      })
      .instruction();

    const tx = new Transaction();
    // add priority fee
    const priorityFeeInSol = await getSolanaPriorityFee();

    // Convert SOL to microLamports per compute unit
    const microLamportsPerComputeUnit = Math.floor(
      priorityFeeInSol * 1_000_000
    );

    // create instruction to send wayru token to wayru foundation wallet
    const ixToSendWayruToFoundationWallet = await instructionToSendWayruToFoundationWallet(
      user,
      wayruFeeTransaction
    );
    if (!ixToSendWayruToFoundationWallet) {
      throw new Error("Failed to create instruction to send wayru token to wayru foundation wallet");
    }

    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: microLamportsPerComputeUnit,
      }),
      ixToSendWayruToFoundationWallet,
      ix
    );

    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = user;

    // serialize tx
    const serializedTx = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    // update the status of the transaction
    await updateTransactionTrackerStatus(nonce, "request_authorized_by_admin");

    return {
      serializedTx: serializedTx.toString("base64"),
      error: false,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_SUCCESS_CODE,
    };
  } catch (error) {
    console.error(`Error requesting transaction to deposit tokens:`, error);
    return {
      serializedTx: null,
      error: true,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_DEPOSIT_TOKENS_ERROR_CODE,
    };
  }
};

/**
 * Request to update reward contract
 * @param signature - The signature of the update reward contract message
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionToUpdateRewardContract = async (
  signature: string
): Promise<{
  txBase64InitializeNFNode: string | null;
  txBase64ClaimLostTokens: string | null;
  error: boolean;
  code: string;
}> => {
  try {
    // verify the signature
    const { isValid, message } = await verifyTransactionSignature(signature);
    if (!isValid || !message) {
      return {
        txBase64InitializeNFNode: null,
        txBase64ClaimLostTokens: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_UPDATE_REWARD_CONTRACT_INVALID_SIGNATURE_ERROR_CODE,
      };
    }
    const data = await processMessageData("update-reward-contract", message);
    if (!data) {
      return {
        txBase64InitializeNFNode: null,
        txBase64ClaimLostTokens: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_UPDATE_REWARD_CONTRACT_INVALID_DATA_ERROR_CODE,
      };
    }
    const {
      walletAddress,
      solanaAssetId,
      nonce,
      nfnodeType,
      manufacturerAddress,
      hostAddress,
      status,
    } = data;
    const userWallet = new PublicKey(walletAddress);

    // validate signature status
    const disabledValidateExpiration = status === "only_init_nfnode";
    const { isValid: isValidSignature, code: codeSignature } =
      await validateAndUpdateSignatureStatus(
        nonce,
        signature,
        disabledValidateExpiration
      );
    if (!isValidSignature) {
      return {
        txBase64InitializeNFNode: null,
        txBase64ClaimLostTokens: null,
        error: true,
        code: codeSignature,
      };
    }

    // prepare transaction to claim lost tokens
    let txBase64ClaimLostTokens: string | null = null;
    if (status === "claim_and_init_nfnode" && !nfnodeType.don) {
      txBase64ClaimLostTokens = await prepareTransactionToClaimLostTokens(
        userWallet
      );
      if (!txBase64ClaimLostTokens) {
        return {
          txBase64InitializeNFNode: null,
          txBase64ClaimLostTokens: null,
          error: true,
          code: REQUEST_TRANSACTION_ERROR_CODES.FAILED_TO_PREPARE_TX_TO_CLAIM_LOST_TOKENS_ERROR_CODE,
        };
      }
    }
    // prepare transaction to initialize NFNode
    const txBase64InitializeNFNode = await prepareTransactionToInitializeNFNode(
      {
        walletOwnerAddress: userWallet,
        hostAddress: new PublicKey(hostAddress),
        manufacturerAddress: new PublicKey(manufacturerAddress),
        solanaAssetId: new PublicKey(solanaAssetId),
        nfnodeType,
      }
    );
    if (!txBase64InitializeNFNode) {
      return {
        txBase64InitializeNFNode: null,
        txBase64ClaimLostTokens: null,
        error: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.FAILED_TO_PREPARE_TX_TO_INITIALIZE_NFNODE_ERROR_CODE,
      };
    }

    return {
      txBase64ClaimLostTokens,
      txBase64InitializeNFNode,
      error: false,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_UPDATE_REWARD_CONTRACT_SUCCESS_CODE,
    };
  } catch (error) {
    console.error(
      `Error requesting transaction to update reward contract:`,
      error
    );
    return {
      txBase64InitializeNFNode: null,
      txBase64ClaimLostTokens: null,
      error: true,
      code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_UPDATE_REWARD_CONTRACT_ERROR_CODE,
    };
  }
};
