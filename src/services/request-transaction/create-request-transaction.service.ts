import {
    InitializeNfnodeMessage,
    NFNodeTypeEnum,
} from "@interfaces/request-transaction/request-transaction.interface";
import { RewardSystemManager } from "@services/solana/contracts/reward-system.manager";
import { getSolanaConnection } from "@services/solana/solana.connection";
import {
    getUserNFTTokenAccount,
    getWayruFoundationWalletAddress,
} from "@services/solana/solana.service";
import {
    ComputeBudgetProgram,
    MessageV0,
    PublicKey,
    TransactionMessage,
    VersionedTransaction,
} from "@solana/web3.js";
import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    createTransferInstruction,
    getAssociatedTokenAddress,
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
    getRewardTokenMint,
    getSolanaPriorityFee,
    getKeyPairFromUnit8Array,
    getWayruFeeTransaction,
} from "@helpers/solana/solana.helpers";
import { SystemProgram } from "@solana/web3.js";
import { getNFNodeTypeRecord } from "@helpers/request-transaction/request-transaction.helper";
import { BN } from "bn.js";
import { ENV } from "@config/env/env";
import * as anchor from "@coral-xyz/anchor";

interface CreateTransactionToInitializeNfnodeParams {
    walletAddress: string;
    nftMintAddress: string;
    nfnodeType: InitializeNfnodeMessage["nfnodeType"];
    hostAddress?: string;
    manufacturerAddress?: string;
    forSimulation?: boolean; // Flag to determine if this is for simulation or real transaction
    includeAdminAuthorization?: boolean;
}

interface CreateOnlyInitializeNfnodeTxParams {
    walletOwnerAddress: string;
    hostAddress: string;
    manufacturerAddress: string;
    solanaAssetId: string;
    nfnodeType: InitializeNfnodeMessage["nfnodeType"];
}
interface CreateTransactionToInitializeNfnodeResponse {
    error: boolean;
    transaction: VersionedTransaction | null;
    transactionMessage: MessageV0 | null;
    serializedTransaction?: string | null; // For real transactions
    userTokenAccountRent: number | null;
    tokenStorageAccountRent: number | null;
}
export const createTransactionToInitializeNfnode = async (
    params: CreateTransactionToInitializeNfnodeParams
): Promise<CreateTransactionToInitializeNfnodeResponse> => {
    try {
        // prepare wallet addresses
        const hostAddress =
            params.hostAddress || "8QMK1JHzjydq7qHgTo1RwK3ateLm4zVQF7V7BkriNkeD"

        const manufacturerAddress =
            params.manufacturerAddress ||
            "FCap4kWAPMMTvAqUgEX3oFmMmSzg7g3ytxknYD21hpzm"


        // create only initialize nfnode tx
        const { serializedTx, transaction } = await createOnlyInitializeNfnodeTx({
            walletOwnerAddress: params.walletAddress,
            hostAddress: hostAddress,
            manufacturerAddress: manufacturerAddress,
            solanaAssetId: params.nftMintAddress,
            nfnodeType: params.nfnodeType,
            includeAdminAuthorization: params.includeAdminAuthorization,
        })
        if (!serializedTx || !transaction) {
            return {
                error: true,
                transaction: null,
                transactionMessage: null,
                serializedTransaction: null,
                userTokenAccountRent: null,
                tokenStorageAccountRent: null,
            }
        }


        // Get the instructions from the transaction for simulation
        const instructions = transaction.instructions;

        // Create TransactionMessage for simulation
        const messageV0 = new TransactionMessage({
            payerKey: new PublicKey(params.walletAddress),
            recentBlockhash: transaction.recentBlockhash!,
            instructions: instructions,
        }).compileToV0Message();

        // Create VersionedTransaction for simulation
        const versionedTransaction = new VersionedTransaction(messageV0);

        // If this is for simulation, return the versioned transaction
        if (params.forSimulation) {
            return {
                error: false,
                transaction: versionedTransaction,
                transactionMessage: messageV0,
                userTokenAccountRent: 0, // We'll need to calculate this if needed
                tokenStorageAccountRent: 0, // We'll need to calculate this if needed
            };
        }

        // For real transactions, return the serialized transaction from createOnlyInitializeNfnodeTx
        return {
            error: false,
            transaction: versionedTransaction,
            transactionMessage: messageV0,
            serializedTransaction: serializedTx,
            userTokenAccountRent: 0, // We'll need to calculate this if needed
            tokenStorageAccountRent: 0, // We'll need to calculate this if needed
        };
    } catch (error) {
        console.error(`Error creating transaction to initialize nfnode:`, error);
        return {
            error: true,
            transaction: null,
            transactionMessage: null,
            serializedTransaction: null,
            userTokenAccountRent: null,
            tokenStorageAccountRent: null,
        };
    }
};

interface CreateOnlyInitializeNfnodeTxParams {
    walletOwnerAddress: string;
    hostAddress: string;
    manufacturerAddress: string;
    solanaAssetId: string;
    nfnodeType: InitializeNfnodeMessage["nfnodeType"];
    includeAdminAuthorization?: boolean;
}
const createOnlyInitializeNfnodeTx = async (
    params: CreateOnlyInitializeNfnodeTxParams
) => {
    try {
        const {
            includeAdminAuthorization = true,
            walletOwnerAddress,
            hostAddress,
            manufacturerAddress,
            solanaAssetId,
            nfnodeType,
        } = params;
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

        // prepare accounts
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

        // create an instruction
        const ix = await program.methods
            .initializeNfnode(hostShare, nfnodeType as Record<NFNodeTypeEnum, never>)
            .accounts(accounts)
            .instruction();

        // get the latest blockhash
        const connection = getSolanaConnection();
        let tx = new anchor.web3.Transaction();
        tx.add(
            ComputeBudgetProgram.setComputeUnitPrice({
                microLamports: microLamportsPerComputeUnit,
            }),
            ix
        );
        // add instruction to send 20 reward Token Mint to foundation wallet for wayru network fee
        const wayruNetworkFee = await getWayruFeeTransaction()
        const wayruToFoundationWalletIx = await instructionToSendWayruToFoundationWallet(user, wayruNetworkFee)
        if (wayruToFoundationWalletIx) {
            tx.add(wayruToFoundationWalletIx)
        }

        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        tx.feePayer = user; // set the fee payer

        // sign admin keypair
        if (includeAdminAuthorization) {
            tx.partialSign(adminKeypair);
        }

        // serialize tx
        const serializedTx = tx.serialize({
            requireAllSignatures: false,
            verifySignatures: false,
        });

        return {
            serializedTx: serializedTx.toString("base64"),
            transaction: tx,
        }
    } catch (error) {
        console.error(`Error creating only initialize nfnode tx:`, error);
        return {
            serializedTx: null,
            transaction: null,
        }
    }
};

/**
 * create transfer instruction to send wayru token to the treasury wallet
 * @param fromPubkey public key of the sender
 * @param amount amount to send
 * @returns
 */
export const instructionToSendWayruToFoundationWallet = async (
    fromPubkey: PublicKey,
    amount: number,
) => {
    try {
        const foundationWalletAddress = await getWayruFoundationWalletAddress();
        // get addresses
        const WAYRU_MINT_ADDRESS = await getRewardTokenMint();

        // Get or create the associated account of the sender for Wayru
        const fromTokenAccount = await getAssociatedTokenAddress(
            new PublicKey(WAYRU_MINT_ADDRESS),
            fromPubkey,
            false,
            TOKEN_PROGRAM_ID
        );
        const toTokenAccount = await getAssociatedTokenAddress(
            new PublicKey(WAYRU_MINT_ADDRESS),
            new PublicKey(foundationWalletAddress),
            false,
            TOKEN_PROGRAM_ID
        );

        // create transfer instruction
        const transferInstruction = createTransferInstruction(
            fromTokenAccount,
            toTokenAccount,
            fromPubkey,
            Math.round(amount * Math.pow(10, 6))
        );
        return transferInstruction;
    } catch (error) {
        console.error("Error creating transfer instruction to send wayru:", error);
        return null;
    }
};
