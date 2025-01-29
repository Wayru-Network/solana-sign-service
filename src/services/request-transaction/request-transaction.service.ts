import { RequestTransactionResponse, RequestTransactionClaimReward, RequestTransactionInitializeNfnode, RequestTransactionUpdateHost } from "@/interfaces/request-transaction/request-transaction.interface";
import { BN } from "bn.js";
import * as anchor from "@coral-xyz/anchor";
import { convertToTokenAmount, getRewardSystemProgram, getSolanaConnection, getUserNFTTokenAccount } from "../solana/solana.service";
import { getKeyPairFromUnit8Array } from "@/helpers/solana/solana.helpers";
import { ADMIN_PRIVATE_KEY, ASSET_REWARD_ID } from "@/constants/solana/solana.constants";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { REQUEST_TRANSACTION_ERROR_CODES } from "@/errors/request-transaction/request-transaction";
import { prepareAccountsToClaimReward } from "@/helpers/request-transaction/request-transaction.helper";

/**
 * Request a transaction to initialize a NFNode
 * @param {RequestTransactionInitializeNfnode} params - The parameters for the transaction
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionToInitializeNfnode = async ({ walletOwner, hostAddress, manufacturerAddress, solanaAssetId }: RequestTransactionInitializeNfnode): RequestTransactionResponse => {
    try {
        // prepare transaction parameters
        const nonce = new BN(Date.now());
        const program = await getRewardSystemProgram();
        const adminKeypair = getKeyPairFromUnit8Array(Uint8Array.from(JSON.parse(ADMIN_PRIVATE_KEY)));
        const user = new PublicKey(walletOwner); // owner of the NFT
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
 * @param {RequestTransactionClaimReward} params - The parameters for the transaction
 * @returns {Promise<{ serializedTx: string | null, error: boolean, code: string }>} - serializedTx: string | null, error: boolean, code: string
 */
export const requestTransactionToClaimReward = async ({ rewardAmount, claimerType, walletAddress, solanaAssetId }: RequestTransactionClaimReward): RequestTransactionResponse => {
    try {
        // prepare transaction parameters
        const program = await getRewardSystemProgram();
        const adminKeypair = getKeyPairFromUnit8Array(Uint8Array.from(JSON.parse(ADMIN_PRIVATE_KEY)));
        const user = new PublicKey(walletAddress);
        const mint = new PublicKey(ASSET_REWARD_ID)
        const nftMint = new PublicKey(solanaAssetId)
        const amountToClaim = new BN(convertToTokenAmount(rewardAmount));
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

        // return the transaction
        return {
            serializedTx: txBase64,
            error: false,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_SUCCESS_CODE
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