import { RequestTransactionResponse, RequestTransactionUpdateHost } from "@interfaces/request-transaction/request-transaction.interface";
import { BN } from "bn.js";
import * as anchor from "@coral-xyz/anchor";
import { convertToTokenAmount, getRewardSystemProgram, getSolanaConnection, getUserNFTTokenAccount } from "../solana/solana.service";
import { getKeyPairFromUnit8Array } from "@helpers/solana/solana.helpers";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { REQUEST_TRANSACTION_ERROR_CODES } from "@errors/request-transaction/request-transaction";
import { prepareAccountsToClaimReward, processInitializeNfnodeMessage, processRewardClaimMessage, verifyRewardsSignature } from "@helpers/request-transaction/request-transaction.helper";
import { updateClaimRewardHistoryStatus, verifySignatureStatus } from "./request-transactions-queries";
import { ENV } from "@config/env/env";

/**
 * Request a transaction to initialize a NFNode
 * @param {string} signature - The signature of the initialize nfnode message
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionToInitializeNfnode = async (signature: string): RequestTransactionResponse => {
    try {
        // verify the signature
        const { isValid, message } = await verifyRewardsSignature(signature);
        if (!isValid || !message) {
            return {
                serializedTx: null,
                error: true,
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_INITIALIZE_NFNODE_INVALID_SIGNATURE_ERROR_CODE
            };
        }

        const data = await processInitializeNfnodeMessage(message);
        if (!data) {
            return {
                serializedTx: null,
                error: true,
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_INITIALIZE_NFNODE_INVALID_DATA_ERROR_CODE
            };
        }
        const { walletOwnerAddress, hostAddress, manufacturerAddress, solanaAssetId } = data;

        // prepare transaction parameters
        const nonce = new BN(Date.now());
        const program = await getRewardSystemProgram();
        const adminKeypair = getKeyPairFromUnit8Array(Uint8Array.from(JSON.parse(ENV.ADMIN_REWARD_SYSTEM_PRIVATE_KEY as string)));
        const user = new PublicKey(walletOwnerAddress); // owner of the NFT
        const host = new PublicKey(hostAddress); // host of the NFT
        const manufacturer = new PublicKey(manufacturerAddress); // manufacturer of the NFT
        const nftMintAddress = new PublicKey(solanaAssetId); // mint address of the NFT
        const userNFTTokenAccount = await getUserNFTTokenAccount(nftMintAddress, user);

        // create a transaction
        const tx = await program.methods
            .initializeNfnode(nonce)
            .accounts({
                userAdmin: adminKeypair.publicKey,
                user,
                nftMintAddress,
                host,
                manufacturer,
                tokenProgram2022: TOKEN_2022_PROGRAM_ID,
                userNftTokenAccount: userNFTTokenAccount,
            })
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
    try {
        const { isValid, message } = await verifyRewardsSignature(signature);
        if (!isValid || !message) {
            return {
                serializedTx: null,
                error: true,
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_INVALID_SIGNATURE_ERROR_CODE
            };
        };
        const data = await processRewardClaimMessage(message);
        if (!data) {
            return {
                serializedTx: null,
                error: true,
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_INVALID_DATA_ERROR_CODE
            };
        } 
        const { walletAddress, totalAmount, minerId, rewardsId, type: claimerType, solanaAssetId } = data;

        // first verify the signature status
        const {isValidStatus, code} = await verifySignatureStatus(signature, rewardsId, minerId,  claimerType);
        if (!isValidStatus) {
            return {
                serializedTx: null,
                error: true,
                code: code
            };
        }

        // prepare transaction parameters
        const program = await getRewardSystemProgram();
        const adminKeypair = getKeyPairFromUnit8Array(Uint8Array.from(JSON.parse(ENV.ADMIN_REWARD_SYSTEM_PRIVATE_KEY as string)));
        const user = new PublicKey(walletAddress);
        const mint = new PublicKey(ENV.ASSET_REWARD_ID)
        const nftMint = new PublicKey(solanaAssetId)
        const amountToClaim = new BN(convertToTokenAmount(totalAmount));
        const nonce = new BN(Date.now());

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
                .ownerClaimRewards(amountToClaim, nonce)
                .accounts(accounts as unknown as any)
                .instruction();
        } else {
            ix = await program.methods
                .othersClaimRewards(amountToClaim, nonce)
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
        const updatedClaimRewardHistory = await updateClaimRewardHistoryStatus(signature, 'admin-authorization');
        if (!updatedClaimRewardHistory) {
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
        return {
            serializedTx: null,
            error: true,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_ERROR_CODE
        }
    }
}

export const requestTransactionToUpdateHost = async (params: RequestTransactionUpdateHost): RequestTransactionResponse => {
    try {
        return {
            serializedTx: null,
            error: false,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_UPDATE_NFNODE_SUCCESS_CODE
        }

    } catch (error) {
        return {
            serializedTx: null,
            error: true,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_UPDATE_HOST_ERROR_CODE
        }
    }
}