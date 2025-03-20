import { NFNodeType, RequestTransactionResponse } from "@interfaces/request-transaction/request-transaction.interface";
import { BN } from "bn.js";
import * as anchor from "@coral-xyz/anchor";
import { convertToTokenAmount, getAirdropsProgram, getRewardSystemProgram, getSolanaConnection, getUserNFTTokenAccount } from "../solana/solana.service";
import { getKeyPairFromUnit8Array } from "@helpers/solana/solana.helpers";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { REQUEST_TRANSACTION_ERROR_CODES } from "@errors/request-transaction/request-transaction";
import { prepareAccountsToClaimReward, verifyTrasactionSignature, processMessageData } from "@helpers/request-transaction/request-transaction.helper";
import { getRewardTokenMint } from "@helpers/solana/solana.helpers";
import { validateSignatureStatus } from "../transaction-tracker/transaction-tracker.service";
import { ENV } from "@config/env/env";
import { updateTransactionTrackerStatus, verifyTransactionTrackerToClaimRewards } from "../transaction-tracker/transaction-tracker.service";

/**
 * Request a transaction to initialize a NFNode
 * @param {string} signature - The signature of the initialize nfnode message
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionToInitializeNfnode = async (signature: string): RequestTransactionResponse => {
    try {
        // verify the signature
        const { isValid, message } = await verifyTrasactionSignature(signature);
        if (!isValid || !message) {
            return {
                serializedTx: null,
                error: true,
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_INITIALIZE_NFNODE_INVALID_SIGNATURE_ERROR_CODE
            };
        }

        const data = await processMessageData('initialize-nfnode', message);
        if (!data) {
            return {
                serializedTx: null,
                error: true,
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_INITIALIZE_NFNODE_INVALID_DATA_ERROR_CODE
            };
        }
        const { walletOwnerAddress, hostAddress, manufacturerAddress, solanaAssetId, nfnodeType, nonce } = data;

        // validate signature status
        const { isValid: isValidSignature, code: codeSignature } = await validateSignatureStatus(nonce, signature);
        if (!isValidSignature) {
            // update the status of the transaction
            await updateTransactionTrackerStatus(nonce, 'request_unauthorized_by_admin');
            return {
                serializedTx: null,
                error: true,
                code: codeSignature
            };
        }

        // prepare transaction parameters
        const hostShare = new BN(0); // host share of the NFT is 0
        const program = await getRewardSystemProgram();
        const adminKeypair = getKeyPairFromUnit8Array(Uint8Array.from(JSON.parse(ENV.ADMIN_REWARD_SYSTEM_PRIVATE_KEY as string)));
        const user = new PublicKey(walletOwnerAddress); // owner of the NFT
        const host = new PublicKey(hostAddress); // host of the NFT
        const manufacturer = new PublicKey(manufacturerAddress); // manufacturer of the NFT
        const nftMintAddress = new PublicKey(solanaAssetId); // mint address of the NFT
        const userNFTTokenAccount = await getUserNFTTokenAccount(nftMintAddress, user);
        const [nfnodeEntryPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("nfnode_entry"), nftMintAddress.toBuffer()],
            program.programId
        );
        const [adminAccountPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("admin_account")],
            program.programId
        );
        // Derivar token storage authority PDA
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
            systemProgram: SystemProgram.programId
        } as const;

        // create a transaction
        const tx = await program.methods
            .initializeNfnode(hostShare, nfnodeType as Record<NFNodeType, never>)
            .accounts(accounts)
            .transaction()

        // get the latest blockhash
        const connection = await getSolanaConnection();
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        tx.feePayer = user;  // set the fee payer

        // sign admin keypair
        tx.partialSign(adminKeypair)

        // serialize tx
        const serializedTx = tx.serialize({
            requireAllSignatures: false,
            verifySignatures: false,
        });

        // update tx status
        await updateTransactionTrackerStatus(nonce, 'request_authorized_by_admin');

        return {
            serializedTx: serializedTx.toString("base64"),
            error: false,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_SUCCESS_CODE
        }

    } catch (error) {
        console.error(`Error requesting transaction initialize nfnode:`, error);
        return {
            serializedTx: null,
            error: true,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_INITIALIZE_NFNODE_ERROR_CODE
        }
    }
}

/**
 * Request a transaction to claim reward
 * @param {string} signature - The signature of the reward claim message
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionToClaimReward = async (signature: string): RequestTransactionResponse => {
    let nonceFDB: number | undefined;
    try {
        const { isValid, message } = await verifyTrasactionSignature(signature);
        if (!isValid || !message) {
            return {
                serializedTx: null,
                error: true,
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_INVALID_SIGNATURE_ERROR_CODE
            };
        };
        const data = await processMessageData('claim-rewards', message);
        if (!data) {
            return {
                serializedTx: null,
                error: true,
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_INVALID_DATA_ERROR_CODE
            };
        }
        const { walletAddress, totalAmount, minerId, rewardsId, type: claimerType, solanaAssetId, nonce } = data;

        // first verify the signature status
        const { isValidStatus, code } = await verifyTransactionTrackerToClaimRewards({
            signature,
            rewardsId,
            minerId,
            claimerType,
            nonce
        });
        if (!isValidStatus) {
            // update the status of the transaction
            await updateTransactionTrackerStatus(nonce, 'request_unauthorized_by_admin');
            return {
                serializedTx: null,
                error: true,
                code: code
            };
        }
        nonceFDB = nonce;

        // prepare transaction parameters
        const rewardTokenMint = await getRewardTokenMint();
        const program = await getRewardSystemProgram();
        const adminKeypair = getKeyPairFromUnit8Array(Uint8Array.from(JSON.parse(ENV.ADMIN_REWARD_SYSTEM_PRIVATE_KEY as string)));
        const user = new PublicKey(walletAddress);
        const mint = new PublicKey(rewardTokenMint)
        const nftMint = new PublicKey(solanaAssetId)
        const amountToClaim = new BN(convertToTokenAmount(2)); //new BN(convertToTokenAmount(totalAmount));
        const bnNonce = new BN(nonce);

        // prepare params to claim reward
        const accounts = await prepareAccountsToClaimReward({ program, mint, userWallet: user, nftMint, claimerType, adminKeypair })
        if (!accounts) {
            return {
                serializedTx: null,
                error: true,
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_PREPARED_ACCOUNTS_ERROR_CODE
            }
        }
        let ix: anchor.web3.TransactionInstruction | null = null

        // create a transaction
        if (claimerType === 'owner') {
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

        // create a transaction
        const connection = await getSolanaConnection();
        let tx = new anchor.web3.Transaction();
        tx.add(ix);
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
        const updatedTransactionTracker = await updateTransactionTrackerStatus(nonce, 'request_authorized_by_admin');
        if (!updatedTransactionTracker) {
            return {
                serializedTx: null,
                error: true,
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_UPDATE_CLAIM_REWARD_HISTORY_ERROR_CODE
            }
        }
        // return the transaction
        return {
            serializedTx: txBase64,
            error: false,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_SUCCESS_CODE,
        }
    } catch (error) {
        console.error(`Error requesting transaction to claim reward:`, error);
        if (nonceFDB !== undefined) {
            await updateTransactionTrackerStatus(nonceFDB, 'request_unauthorized_by_admin');
        }
        return {
            serializedTx: null,
            error: true,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_ERROR_CODE
        }
    }
}

/**
 * Request a transaction to update the host of a NFNode
 * @param {string} signature - The signature of the update host message
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionToUpdateHost = async (signature: string): RequestTransactionResponse => {
    try {
        // verify the signature
        const { isValid, message } = await verifyTrasactionSignature(signature);
        if (!isValid || !message) {
            return {
                serializedTx: null,
                error: true,
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_UPDATE_NFNODE_INVALID_SIGNATURE_ERROR_CODE
            };
        }
        const data = await processMessageData('add-host-to-nfnode', message);
        if (!data) {
            return {
                serializedTx: null,
                error: true,
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_UPDATE_NFNODE_INVALID_DATA_ERROR_CODE
            };
        }
        const { walletOwnerAddress, hostAddress, solanaAssetId, feeToUpdateMetadata, paymentToAddHostToNFnode, solanaWalletAddressAdmin, solanaTreasuryWalletAddress, nonce } = data;
        // validate signature status
        const { isValid: isValidSignature, code: codeSignature } = await validateSignatureStatus(nonce, signature);
        if (!isValidSignature) {
            // update the status of the transaction
            await updateTransactionTrackerStatus(nonce, 'request_unauthorized_by_admin');
            return {
                serializedTx: null,
                error: true,
                code: codeSignature
            };
        }

        // prepare transaction parameters 
        const connection = await getSolanaConnection();
        const program = await getRewardSystemProgram()
        const ownerAddress = new PublicKey(walletOwnerAddress)
        const nftMint = new PublicKey(solanaAssetId)
        const adminKeypair = getKeyPairFromUnit8Array(Uint8Array.from(JSON.parse(ENV.ADMIN_REWARD_SYSTEM_PRIVATE_KEY as string)));
        const hostWalletAddress = new PublicKey(hostAddress)
        const bnNonce = new BN(nonce)
        const userNFTTokenAccount = await getAssociatedTokenAddress(
            nftMint,
            ownerAddress,
            false, // allowOwnerOffCurve
            TOKEN_2022_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );
        const transaction = new Transaction();

        // add transfer instruction
        // Add SOL transfers
        transaction.add(
            SystemProgram.transfer({
                fromPubkey: ownerAddress,
                toPubkey: new PublicKey(solanaWalletAddressAdmin),
                lamports: Math.round(feeToUpdateMetadata * LAMPORTS_PER_SOL),
            }),
            SystemProgram.transfer({
                fromPubkey: ownerAddress,
                toPubkey: new PublicKey(solanaTreasuryWalletAddress),
                lamports: Math.round(paymentToAddHostToNFnode * LAMPORTS_PER_SOL),
            })
        );

        // create the tx for the user
        const updateNfnodeIx = await program.methods
            .updateNfnode(bnNonce)
            .accounts({
                userAdmin: adminKeypair.publicKey,
                user: ownerAddress,
                host: hostWalletAddress,
                nftMintAddress: nftMint,
                userNftTokenAccount: userNFTTokenAccount,
                tokenProgram2022: TOKEN_2022_PROGRAM_ID,
            })
            .instruction()

        transaction.add(updateNfnodeIx)
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        transaction.feePayer = ownerAddress;
        // admin sign the transaction
        transaction.partialSign(adminKeypair);

        // serialize tx
        const serializedTx = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false,
        });

        // update the status of the transaction
        await updateTransactionTrackerStatus(nonce, 'request_authorized_by_admin');

        return {
            serializedTx: serializedTx.toString("base64"),
            error: false,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_SUCCESS_CODE
        }
    } catch (error) {
        return {
            serializedTx: null,
            error: true,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_UPDATE_HOST_ERROR_CODE
        }
    }
}

/**
 * Request a transaction to withdraw tokens
 * @param signature - The signature of the withdraw tokens message
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionWithdrawTokens = async (signature: string): Promise<RequestTransactionResponse> => {
    try {
        const { isValid, message } = await verifyTrasactionSignature(signature);
        if (!isValid || !message) {
            return {
                serializedTx: null,
                error: true,
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_WITHDRAW_TOKENS_INVALID_SIGNATURE_ERROR_CODE
            };
        }
        // decode the message
        const data = await processMessageData('withdraw-tokens', message);
        if (!data) {
            return {
                serializedTx: null,
                error: true,
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_WITHDRAW_TOKENS_INVALID_DATA_ERROR_CODE
            };
        }
        const { walletAddress, solanaAssetId, nonce } = data;

        // validate signature status // validate signature status
        const { isValid: isValidSignature, code: codeSignature } = await validateSignatureStatus(nonce, signature);
        if (!isValidSignature) {
            // update the status of the transaction
            await updateTransactionTrackerStatus(nonce, 'request_unauthorized_by_admin');
            return {
                serializedTx: null,
                error: true,
                code: codeSignature
            };
        }

        const connection = await getSolanaConnection();
        const program = await getRewardSystemProgram();
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
                userNftTokenAccount: _userNFTTokenAccount
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
        await updateTransactionTrackerStatus(nonce, 'request_authorized_by_admin');

        return {
            serializedTx: serializedTx.toString("base64"),
            error: false,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_SUCCESS_CODE
        }

    } catch (error) {
        console.error(`Error requesting transaction to withdraw tokens:`, error);
        return {
            serializedTx: null,
            error: true,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_WITHDRAW_TOKENS_ERROR_CODE
        }
    }
}

/**
 * Request a transaction to claim w credits
 * @param signature - The signature of the claim w credits message
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionToClaimWCredits = async (signature: string): Promise<RequestTransactionResponse> => {
    try {
        // verify the signature
        const { isValid, message } = await verifyTrasactionSignature(signature);
        if (!isValid || !message) {
            return {
                serializedTx: null,
                error: true,
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_INITIALIZE_NFNODE_INVALID_SIGNATURE_ERROR_CODE
            };
        }
        // process message data
        const data = await processMessageData('claim-w-credits', message);
        if (!data) {
            return {
                serializedTx: null,
                error: true,
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_INITIALIZE_NFNODE_INVALID_DATA_ERROR_CODE
            };
        }
        const { walletAddress, amountToClaim, nonce } = data;
        // validate signature status
        const { isValid: isValidSignature, code: codeSignature } = await validateSignatureStatus(nonce, signature);
        if (!isValidSignature) {
            // update the status of the transaction
            await updateTransactionTrackerStatus(nonce, 'request_unauthorized_by_admin');
            return {
                serializedTx: null,
                error: true,
                code: codeSignature
            };
        }

        // get program 
        const program = await getAirdropsProgram();
        const adminKeypair = getKeyPairFromUnit8Array(Uint8Array.from(JSON.parse(ENV.ADMIN_REWARD_SYSTEM_PRIVATE_KEY as string)));
        const user = new PublicKey(walletAddress); // owner of the NFT
        const connection = await getSolanaConnection();
        const rewardTokenMint = await getRewardTokenMint();
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
        tx.add(ix);
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
        await updateTransactionTrackerStatus(nonce, 'request_authorized_by_admin');

        return {
            serializedTx: txBase64,
            error: false,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_SUCCESS_CODE
        }

    } catch (error) {
        console.error(`Error requesting transaction to claim w credits:`, error);
        return {
            serializedTx: null,
            error: true,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_W_CREDITS_ERROR_CODE
        }
    }
}

/**
 * Request a transaction to deposit tokens
 * @param signature - The signature of the deposit tokens message
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionDepositTokens = async (signature: string): Promise<RequestTransactionResponse> => {
    try {
        const { isValid, message } = await verifyTrasactionSignature(signature);
        if (!isValid || !message) {
            return {
                serializedTx: null,
                error: true,
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_DEPOSIT_TOKENS_INVALID_SIGNATURE_ERROR_CODE
            };
        }
        const data = await processMessageData('deposit-tokens', message);
        if (!data) {
            return {
                serializedTx: null,
                error: true,
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_DEPOSIT_TOKENS_INVALID_DATA_ERROR_CODE
            };
        }
        const { walletAddress, solanaAssetId, nonce } = data;
        // validate signature status
        const { isValid: isValidSignature, code: codeSignature } = await validateSignatureStatus(nonce, signature);
        if (!isValidSignature) {
            // update the status of the transaction
            await updateTransactionTrackerStatus(nonce, 'request_unauthorized_by_admin');
            return {
                serializedTx: null,
                error: true,
                code: codeSignature
            };
        }
        const connection = await getSolanaConnection();
        const program = await getRewardSystemProgram();
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
                userNftTokenAccount: userNFTTokenAccount
            })
            .instruction();

        const tx = new Transaction();
        tx.add(ix);
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        tx.feePayer = user;

        // serialize tx
        const serializedTx = tx.serialize({
            requireAllSignatures: false,
            verifySignatures: false,
        });

        // update the status of the transaction
        await updateTransactionTrackerStatus(nonce, 'request_authorized_by_admin');

        return {
            serializedTx: serializedTx.toString("base64"),
            error: false,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_SUCCESS_CODE
        }
    } catch (error) {
        console.error(`Error requesting transaction to deposit tokens:`, error);
        return {
            serializedTx: null,
            error: true,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_DEPOSIT_TOKENS_ERROR_CODE
        }
    }
}