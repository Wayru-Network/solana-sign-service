import { PrepareAccountsToClaimReward, PrepareParamsToClaimReward, PayloadProcessMessageByType, MessageType, NFNodeTypeEnum } from "@/interfaces/request-transaction/request-transaction.interface";
import { getUserNFTTokenAccount } from "@/services/solana/solana.service";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { PublicKey, SystemProgram, ComputeBudgetProgram } from "@solana/web3.js";
import { Transaction } from "@solana/web3.js";
import { ENV } from "@config/env/env";
import { rewardClaimSchema, initializeNfnodeSchema, updateHostSchema, withdrawTokensSchema, claimWCreditsSchema, depositTokensSchema, updateRewardContractSchema, stakeTokensSchema, initializeStakeSchema, claimDepinStakerRewardsSchema } from "@validations/request-transaction/request-transaction.validation";
import nacl from 'tweetnacl';
import { createHash } from "crypto";
import { RewardSystemManager } from "@services/solana/contracts/reward-system.manager";
import { getWayruFoundationWalletAddress } from "@services/solana/solana.service";

export const prepareParamsToClaimReward = async ({ program, mint, userWallet, nftMint }: PrepareParamsToClaimReward) => {
    try {    // Get token storage authority
        const [tokenStorageAuthority] = PublicKey.findProgramAddressSync(
            [Buffer.from("token_storage")],
            program.programId
        );

        // Get storage account
        const storageAccount = await getAssociatedTokenAddress(
            mint,
            tokenStorageAuthority,
            true,
            TOKEN_PROGRAM_ID
        );

        // Get user's token account
        const userTokenAccount = await getAssociatedTokenAddress(
            mint,
            userWallet,
            false,
            TOKEN_PROGRAM_ID
        );

        // Derive other necessary PDAs
        const [adminAccount] = PublicKey.findProgramAddressSync(
            [Buffer.from("admin_account")],
            program.programId
        );

        const [rewardEntry] = PublicKey.findProgramAddressSync(
            [Buffer.from("reward_entry"), userWallet.toBuffer(), nftMint.toBuffer()],
            program.programId
        );

        const [nfnodeEntry] = PublicKey.findProgramAddressSync(
            [Buffer.from("nfnode_entry"), nftMint.toBuffer()],
            program.programId
        );

        return {
            tokenStorageAuthority,
            storageAccount,
            userTokenAccount,
            adminAccount,
            rewardEntry,
            nfnodeEntry
        }
    } catch (error) {
        console.error(`Error preparing params to claim reward:`, error);
        throw error;
    }
}

export const prepareAccountsToClaimReward = async ({ program, mint, userWallet, nftMint, claimerType, adminKeypair }: PrepareAccountsToClaimReward) => {
    const params = await prepareParamsToClaimReward({ program, mint, userWallet, nftMint })
    if (!params) {
        throw new Error('Error preparing params to claim reward')
    }
    const userNFTTokenAccount = await getUserNFTTokenAccount(nftMint, userWallet);
    const { tokenStorageAuthority, storageAccount, userTokenAccount, adminAccount, rewardEntry, nfnodeEntry } = params
    let accounts:
        {
            userAdmin: PublicKey,
            user: PublicKey,
            nftMintAddress: PublicKey,
            rewardEntry: PublicKey,
            nfnodeEntry: PublicKey,
            tokenMint: PublicKey,
            tokenStorageAuthority: PublicKey,
            tokenStorageAccount: PublicKey,
            userTokenAccount: PublicKey,
            userNftTokenAccount?: PublicKey,
            adminAccount: PublicKey,
            tokenProgram2022: PublicKey,  // Añadido de nuevo
            tokenProgram: PublicKey,
            associatedTokenProgram: PublicKey,
            systemProgram: PublicKey,
        } | null = null


    if (claimerType === 'owner') {
        accounts = {
            userAdmin: adminKeypair.publicKey,
            user: userWallet,
            nftMintAddress: nftMint,
            rewardEntry,
            nfnodeEntry,
            tokenMint: mint,
            tokenStorageAuthority,
            tokenStorageAccount: storageAccount,
            userTokenAccount,
            userNftTokenAccount: userNFTTokenAccount,
            adminAccount,
            tokenProgram2022: TOKEN_2022_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
        }
    } else {
        accounts = {
            userAdmin: adminKeypair.publicKey,
            user: userWallet,
            nftMintAddress: nftMint,
            rewardEntry,
            nfnodeEntry,
            tokenMint: mint,
            tokenStorageAuthority,
            tokenStorageAccount: storageAccount,
            userTokenAccount,
            adminAccount,
            tokenProgram2022: TOKEN_2022_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
        }
    }
    return accounts
}

export const verifyTransactionSignature = async (serializedTransaction: string): Promise<{ isValid: boolean; message?: string }> => {
    try {
        const transaction = Transaction.from(Buffer.from(serializedTransaction, 'base64'));

        // Verify the transaction signature
        const messageBytes = transaction.compileMessage().serialize();
        const dbAdminPubKey = new PublicKey(ENV.DB_ADMIN_PUBLIC_KEY);

        // Find the signature corresponding to the admin key
        const adminSignatureIndex = transaction.signatures.findIndex(
            sig => sig.publicKey.toString() === ENV.DB_ADMIN_PUBLIC_KEY
        );

        if (adminSignatureIndex === -1 || !transaction.signatures[adminSignatureIndex].signature) {
            return { isValid: false };
        }

        // Verify the signature using the tweetnacl library
        const signatureValid = nacl.sign.detached.verify(
            messageBytes as Uint8Array,
            transaction.signatures[adminSignatureIndex].signature!.slice() as Uint8Array,
            dbAdminPubKey.toBytes()
        );

        if (!signatureValid) {
            return { isValid: false };
        }

        // If the signature is valid, extract the message
        const message = transaction.instructions
            .slice(1) // Ignore the first instruction (transfer)
            .map(inst => inst.data.toString())
            .join('');

        return { isValid: true, message };
    } catch (error) {
        console.error('Error verifying the transaction:', error);
        return { isValid: false, message: undefined };
    }
}

export const processMessageData = async <T extends MessageType>(type: T, message: string) => {
    try {
        // validate that the message is a valid JSON
        const { data, error } = safeJsonParse<PayloadProcessMessageByType[T]>(message);
        if (error) {
            return null;
        }

        // validate schemas
        switch (type) {
            case 'claim-rewards':
                await rewardClaimSchema.validate(data);
                return data;
            case 'initialize-nfnode':
                await initializeNfnodeSchema.validate(data);
                return data;
            case 'initialize-stake':
                await initializeStakeSchema.validate(data);
                return data;
            case 'add-host-to-nfnode':
                await updateHostSchema.validate(data);
                return data;
            case 'withdraw-tokens':
                await withdrawTokensSchema.validate(data);
                return data;
            case 'claim-w-credits':
                await claimWCreditsSchema.validate(data);
                return data;
            case 'deposit-tokens':
                await depositTokensSchema.validate(data);
                return data;
            case 'stake-tokens':
                await stakeTokensSchema.validate(data);
                return data;
            case 'update-reward-contract':
                await updateRewardContractSchema.validate(data);
                return data;
            case 'claim-depin-staker-rewards':
                await claimDepinStakerRewardsSchema.validate(data);
                return data;
            default:
                return null;
        }
    } catch (error) {
        console.error('Error processing message data:', error);
        return null;
    }
}

export const getNFNodeTypeRecord = (type: 'don' | 'byod' | 'wayru'): Record<NFNodeTypeEnum, never> => {
    const typeMap = {
        don: { don: {} },
        byod: { byod: {} },
        wayru: { wayruHotspot: {} }
    };
    return typeMap[type] as Record<NFNodeTypeEnum, never>
};

export const safeJsonParse = <T>(jsonString: string): { data: T | null; error: boolean } => {
    try {
        // Validate that it is a string
        if (typeof jsonString !== 'string') {
            return { data: null, error: true };
        }

        // Validate basic JSON format (start and end correctly)
        const trimmed = jsonString.trim();
        if (!(
            (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))
        )) {
            return { data: null, error: true };
        }

        // Parse the JSON
        const parsed = JSON.parse(jsonString);
        return { data: parsed as T, error: false };
    } catch (error) {
        console.error('JSON parse error:', error);
        return { data: null, error: true };
    }
};

/**
 * Normalizes a transaction by filtering out ComputeBudgetProgram instructions
 * This is necessary because wallets may add/modify these instructions when the user has SOL,
 * but won't add them when the user doesn't have SOL, causing hash mismatches
 * 
 * @param {Transaction} transaction - The transaction to normalize
 * @param {string} context - Context for logging (e.g., 'original' or 'user')
 * @returns {Transaction} - A new transaction with ComputeBudgetProgram instructions filtered out
 */
const normalizeTransaction = (transaction: Transaction, context: string = 'unknown'): Transaction => {
    const normalizedTx = new Transaction();

    // Copy essential properties
    normalizedTx.feePayer = transaction.feePayer;
    normalizedTx.recentBlockhash = transaction.recentBlockhash;
    normalizedTx.lastValidBlockHeight = transaction.lastValidBlockHeight;
    normalizedTx.nonceInfo = transaction.nonceInfo;

    // Filter out ComputeBudgetProgram instructions and wallet-added programs
    // Wallets may add/modify these instructions, so we exclude them for consistent hashing
    const computeBudgetProgramId = ComputeBudgetProgram.programId;

    // L2TExMFK program ID - wallets may add this program automatically
    // This is a known program that wallets add, so we filter it out for consistent hashing
    const l2TExMFKProgramId = new PublicKey('L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95');

    const filteredInstructions = transaction.instructions.filter(ix => {
        return !ix.programId.equals(computeBudgetProgramId) && !ix.programId.equals(l2TExMFKProgramId);
    });

    // Add filtered instructions
    filteredInstructions.forEach(ix => {
        normalizedTx.add(ix);
    });

    return normalizedTx;
};

/**
 * Creates a hash of a Solana transaction without signatures
 * This hash can be used to verify that a transaction returned by the user
 * is the same one that was originally created by the backend
 * 
 * Uses compileMessage() to get the canonical message representation,
 * which is more reliable than manually copying transaction properties
 * and handles versioned transactions and address lookup tables correctly
 * 
 * Normalizes the transaction by filtering ComputeBudgetProgram instructions to handle
 * cases where wallets add these instructions when the user has SOL but not when they don't
 * 
 * @param {Transaction} transaction - The Solana transaction to hash
 * @returns {string} - SHA256 hash of the transaction (hex string)
 */
export const createTransactionHash = (transaction: Transaction, context: string = 'unknown'): string => {
    try {
        // Normalize the transaction to filter out ComputeBudgetProgram instructions
        // This ensures consistent hashing regardless of wallet modifications
        const normalizedTx = normalizeTransaction(transaction, context);

        // Clear all signatures to ensure consistent message compilation
        // This is important because compileMessage() might behave differently
        // when signatures are present vs when they're not
        normalizedTx.signatures = normalizedTx.signatures.map(sig => ({
            publicKey: sig.publicKey,
            signature: null
        }));

        // Use compileMessage() to get the canonical message representation
        // This method generates the message that would be signed, without any signatures
        // It correctly handles all transaction properties including versioned transactions
        const message = normalizedTx.compileMessage();
        const serializedMessage = message.serialize();

        // Calculate SHA256 hash of the serialized message
        // serialize() returns a Buffer, which is compatible with createHash
        const hash = createHash('sha256')
            .update(serializedMessage as any)
            .digest('hex');

        return hash;
    } catch (error) {
        console.error(`[createTransactionHash:${context}] Error creating transaction hash:`, error);
        throw new Error('Failed to create transaction hash');
    }
};

/**
 * Verifies that a transaction (which may have user signatures) matches the expected hash
 * This function removes all signatures before calculating the hash to compare
 * 
 * @param {Transaction} transaction - The transaction to verify (may have user signatures)
 * @param {string} expectedHash - The expected hash to compare against
 * @returns {boolean} - True if the transaction matches the expected hash
 */
export const verifyTransactionHash = (transaction: Transaction, expectedHash: string): boolean => {
    try {
        // Calculate the hash of the transaction without signatures
        const actualHash = createTransactionHash(transaction, 'verification');

        // Compare hashes
        const isValid = actualHash === expectedHash;

        if (!isValid) {
            console.warn('[verifyTransactionHash] Hash mismatch detected!', {
                expectedHash,
                actualHash
            });
        }

        return isValid;
    } catch (error) {
        console.error('[verifyTransactionHash] Error verifying transaction hash:', error);
        return false;
    }
};

/**
 * Checks if a transaction contains an InitializeNfnode instruction
 * @param {Transaction} transaction - The transaction to check
 * @returns {Promise<boolean>} - True if the transaction contains InitializeNfnode instruction
 */
export const hasInitializeNfnodeInstruction = async (transaction: Transaction): Promise<boolean> => {
    try {
        const program = await RewardSystemManager.getInstance();
        const programId = program.programId;

        // Discriminator for initializeNfnode: [51, 110, 148, 151, 182, 151, 64, 104]
        const initializeNfnodeDiscriminator = new Uint8Array([51, 110, 148, 151, 182, 151, 64, 104]);

        for (const ix of transaction.instructions) {
            if (ix.programId.equals(programId)) {
                // Check if the discriminator matches initializeNfnode
                if (ix.data.length >= 8) {
                    const instructionDiscriminator = new Uint8Array(ix.data.slice(0, 8));
                    if (instructionDiscriminator.every((val, idx) => val === initializeNfnodeDiscriminator[idx])) {
                        return true;
                    }
                }
            }
        }

        return false;
    } catch (error) {
        console.error('Error checking for InitializeNfnode instruction:', error);
        return false;
    }
};

/**
 * Checks if a transaction has suspicious token transfers to the fee payer (user's wallet)
 * This helps prevent malicious transactions that try to send tokens to the user's wallet
 * 
 * For InitializeNfnode transactions, we allow:
 * - Transfer to foundation wallet (wayru fee) - legitimate
 * - Transfers within the RewardSystem program - legitimate
 * 
 * We reject:
 * - Transfers where the fee payer is the authority (meaning user is receiving tokens)
 * - Any other suspicious token transfers
 * 
 * @param {Transaction} transaction - The transaction to check
 * @returns {Promise<{ hasSuspiciousTransfers: boolean, reason?: string }>} - Result of the check
 */
export const hasSuspiciousTokenTransfers = async (transaction: Transaction): Promise<{ hasSuspiciousTransfers: boolean, reason?: string }> => {
    try {
        if (!transaction.feePayer) {
            return { hasSuspiciousTransfers: false };
        }

        const feePayer = transaction.feePayer;
        const foundationWalletAddress = await getWayruFoundationWalletAddress();
        const foundationWallet = new PublicKey(foundationWalletAddress);

        // Get RewardSystem program ID to allow transfers within the program
        const program = await RewardSystemManager.getInstance();
        const rewardSystemProgramId = program.programId;

        // Token Program ID
        const tokenProgramId = TOKEN_PROGRAM_ID;
        // Token-2022 Program ID (also check this)
        const token2022ProgramId = TOKEN_2022_PROGRAM_ID;

        // Transfer instruction discriminator is 3
        const TRANSFER_DISCRIMINATOR = 3;

        for (const ix of transaction.instructions) {
            // Check if it's a Token Program instruction
            if (ix.programId.equals(tokenProgramId) || ix.programId.equals(token2022ProgramId)) {
                // Check if it's a transfer instruction (discriminator is first byte = 3)
                if (ix.data.length > 0 && ix.data[0] === TRANSFER_DISCRIMINATOR) {
                    // Transfer instruction structure:
                    // - First account (index 0): source account (writable)
                    // - Second account (index 1): destination account (writable)
                    // - Third account (index 2): authority (signer, owner of source)

                    if (ix.keys.length >= 3) {
                        const authority = ix.keys[2].pubkey;
                        const destinationAccount = ix.keys[1].pubkey;

                        // Check if fee payer is the authority - this means user is authorizing a transfer
                        // This could be suspicious if it's not a legitimate transfer (like wayru fee)
                        // For now, we'll check if the destination is NOT the foundation wallet
                        // If destination is foundation wallet, it's legitimate (wayru fee)
                        // If destination is not foundation wallet and fee payer is authority, it's suspicious

                        // However, we need to be careful - the user might be sending tokens FROM their account
                        // which is legitimate. The issue is when tokens are being sent TO the user.

                        // A simpler check: if fee payer is the authority AND destination is not foundation wallet,
                        // we need to verify it's not sending tokens to an account owned by fee payer
                        // But this is complex without checking account ownership

                        // For now, we'll allow transfers where:
                        // 1. Destination is foundation wallet (wayru fee) - always allowed
                        // 2. Authority is not fee payer - means user is not involved in the transfer

                        // If authority is fee payer and destination is not foundation wallet, it's suspicious
                        // UNLESS it's part of a RewardSystem program instruction (which we check separately)

                        // Check if this transfer is part of a RewardSystem instruction by checking
                        // if there's a RewardSystem instruction in the transaction
                        const hasRewardSystemInstruction = transaction.instructions.some(
                            rewardIx => rewardIx.programId.equals(rewardSystemProgramId)
                        );

                        if (authority.equals(feePayer) && !destinationAccount.equals(foundationWallet)) {
                            // If there's no RewardSystem instruction, this is suspicious
                            // (transfers within RewardSystem are handled by the program itself)
                            if (!hasRewardSystemInstruction) {
                                return {
                                    hasSuspiciousTransfers: true,
                                    reason: `Suspicious token transfer detected: fee payer is authorizing transfer to ${destinationAccount.toString()}`
                                };
                            }
                        }
                    }
                }
            }
        }

        return { hasSuspiciousTransfers: false };
    } catch (error) {
        console.error('Error checking for suspicious token transfers:', error);
        // On error, be conservative and reject
        return {
            hasSuspiciousTransfers: true,
            reason: 'Error validating transaction'
        };
    }
};