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

    // Filter out ComputeBudgetProgram instructions
    // Wallets may add/modify these instructions, so we exclude them for consistent hashing
    const computeBudgetProgramId = ComputeBudgetProgram.programId;

    // Log all instructions before filtering
    const allInstructions = transaction.instructions.map((ix, idx) => {
        const isComputeBudget = ix.programId.equals(computeBudgetProgramId);
        return {
            index: idx,
            programId: ix.programId.toString(),
            isComputeBudget,
            dataLength: ix.data.length,
            keysCount: ix.keys.length,
            // Try to identify instruction type
            instructionType: isComputeBudget
                ? (ix.data.length === 4 ? 'setComputeUnitLimit' : ix.data.length === 8 ? 'setComputeUnitPrice' : 'unknown')
                : 'other'
        };
    });

    console.log(`[${context}] All instructions before filtering:`, {
        totalInstructions: transaction.instructions.length,
        instructions: allInstructions
    });

    const filteredInstructions = transaction.instructions.filter(ix => {
        return !ix.programId.equals(computeBudgetProgramId);
    });

    const computeBudgetInstructions = transaction.instructions.filter(ix => {
        return ix.programId.equals(computeBudgetProgramId);
    });

    console.log(`[${context}] Filtering results:`, {
        totalInstructions: transaction.instructions.length,
        computeBudgetInstructionsCount: computeBudgetInstructions.length,
        filteredInstructionsCount: filteredInstructions.length,
        computeBudgetInstructions: computeBudgetInstructions.map((ix, idx) => ({
            index: idx,
            dataLength: ix.data.length,
            data: Array.from(ix.data.slice(0, 8)) // First 8 bytes to identify type
        }))
    });

    // Add filtered instructions
    filteredInstructions.forEach(ix => {
        normalizedTx.add(ix);
    });

    // Log filtered instructions details
    const filteredInstructionsDetails = filteredInstructions.map((ix, idx) => ({
        index: idx,
        programId: ix.programId.toString(),
        dataLength: ix.data.length,
        keysCount: ix.keys.length,
        firstAccount: ix.keys[0]?.pubkey?.toString() || 'N/A'
    }));

    console.log(`[${context}] Filtered instructions (after removing ComputeBudgetProgram):`, {
        count: filteredInstructions.length,
        instructions: filteredInstructionsDetails
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
        console.log(`[createTransactionHash:${context}] Starting hash creation`, {
            feePayer: transaction.feePayer?.toString(),
            recentBlockhash: transaction.recentBlockhash,
            lastValidBlockHeight: transaction.lastValidBlockHeight,
            instructionsCount: transaction.instructions.length,
            signaturesCount: transaction.signatures.length
        });

        // Normalize the transaction to filter out ComputeBudgetProgram instructions
        // This ensures consistent hashing regardless of wallet modifications
        const normalizedTx = normalizeTransaction(transaction, context);

        // Use compileMessage() to get the canonical message representation
        // This method generates the message that would be signed, without any signatures
        // It correctly handles all transaction properties including versioned transactions
        const message = normalizedTx.compileMessage();
        const serializedMessage = message.serialize();

        // Debug: Log message details
        console.log(`[createTransactionHash:${context}] Compiled message details:`, {
            header: {
                numRequiredSignatures: message.header.numRequiredSignatures,
                numReadonlySignedAccounts: message.header.numReadonlySignedAccounts,
                numReadonlyUnsignedAccounts: message.header.numReadonlyUnsignedAccounts
            },
            accountKeysLength: message.accountKeys.length,
            accountKeys: message.accountKeys.map(key => key.toString()),
            recentBlockhash: message.recentBlockhash,
            instructionsLength: message.instructions.length,
            originalInstructionsCount: transaction.instructions.length,
            filteredInstructionsCount: normalizedTx.instructions.length,
            serializedLength: serializedMessage.length,
            feePayer: normalizedTx.feePayer?.toString()
        });

        // Calculate SHA256 hash of the serialized message
        // serialize() returns a Buffer, which is compatible with createHash
        const hash = createHash('sha256')
            .update(serializedMessage as any)
            .digest('hex');

        console.log(`[createTransactionHash:${context}] Hash created successfully:`, hash);

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
        console.log('[verifyTransactionHash] Starting verification', {
            expectedHash,
            transactionInstructionsCount: transaction.instructions.length,
            transactionSignaturesCount: transaction.signatures.length
        });

        // Calculate the hash of the transaction without signatures
        const actualHash = createTransactionHash(transaction, 'verification');

        console.log('[verifyTransactionHash] Hash comparison:', {
            expectedHash,
            actualHash,
            match: actualHash === expectedHash
        });

        // Compare hashes
        const isValid = actualHash === expectedHash;

        if (!isValid) {
            console.warn('[verifyTransactionHash] Hash mismatch detected!', {
                expectedHash,
                actualHash,
                difference: expectedHash !== actualHash ? 'Hashes do not match' : 'Unknown issue'
            });
        } else {
            console.log('[verifyTransactionHash] Hash verification successful!');
        }

        return isValid;
    } catch (error) {
        console.error('[verifyTransactionHash] Error verifying transaction hash:', error);
        return false;
    }
};