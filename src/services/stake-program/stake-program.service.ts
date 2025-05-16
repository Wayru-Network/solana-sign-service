import { NFNodeTypeEnum } from "@interfaces/request-transaction/request-transaction.interface";
import { StakeSystemManager } from "@services/solana/contracts/stake-system.manager";
import { getSolanaConnection } from "@services/solana/solana.connection";
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { ComputeBudgetProgram, PublicKey, SystemProgram } from "@solana/web3.js";
import anchor, { BN } from "@coral-xyz/anchor";
import { getKeyPairFromUnit8Array, getRewardTokenMint, getSolanaPriorityFee } from "@helpers/solana/solana.helpers";
import { ENV } from "@config/env/env";
import { convertToTokenAmount, getUserNFTTokenAccount } from "@services/solana/solana.service";
import { RewardSystemManager } from "@services/solana/contracts/reward-system.manager";
import { REQUEST_TRANSACTION_ERROR_CODES } from "@errors/request-transaction/request-transaction";

export const prepareTransactionToInitializeNFNode = async (
    props: {
        userWallet: PublicKey;
        hostAddress: PublicKey;
        manufacturerAddress: PublicKey;
        solanaAssetId: PublicKey;
        nfnodeType: { don: {} } | { byod: {} } | { wayruHotspot: {} };
    }): Promise<string | null> => {
    try {
        const { userWallet, hostAddress, manufacturerAddress, solanaAssetId, nfnodeType } = props;
        // prepare transaction parameters
        const hostShare = new BN(0); // host share of the NFT is 0
        const program = await RewardSystemManager.getInstance();
        const adminKeypair = getKeyPairFromUnit8Array(Uint8Array.from(JSON.parse(ENV.ADMIN_REWARD_SYSTEM_PRIVATE_KEY as string)));
        const manufacturer = new PublicKey(manufacturerAddress); // manufacturer of the NFT
        const nftMintAddress = new PublicKey(solanaAssetId); // mint address of the NFT
        const userNFTTokenAccount = await getUserNFTTokenAccount(nftMintAddress, userWallet);
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
            userWallet
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
        const microLamportsPerComputeUnit = Math.floor(priorityFeeInSol * 1_000_000);

        const accounts = {
            userAdmin: adminKeypair.publicKey,
            user: userWallet,
            nftMintAddress: nftMintAddress,
            userNftTokenAccount: userNFTTokenAccount,
            host: hostAddress,
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

        // create a transaction to initialize the NFNode
        const ixInitializeNFNode = await program.methods
            .initializeNfnode(hostShare, nfnodeType as Record<NFNodeTypeEnum, never>)
            .accounts(accounts)
            .transaction()

        // create a transaction to stake the NFNode

        // get the latest blockhash
        const connection = getSolanaConnection();
        let tx = new anchor.web3.Transaction();
        tx.add(
            ComputeBudgetProgram.setComputeUnitPrice({
                microLamports: microLamportsPerComputeUnit,
            }),
            ixInitializeNFNode
        );
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        tx.feePayer = userWallet;  // set the fee payer

        // sign admin keypair
        tx.partialSign(adminKeypair)

        // serialize tx
        const serializedTx = tx.serialize({
            requireAllSignatures: false,
            verifySignatures: false,
        });
        const txBase64 = serializedTx.toString("base64");
        return txBase64;
    } catch (error) {
        console.error('Error preparing transaction to initialize NFNode:', error);
        return null;
    }
}

export const prepareTransactionToStakeNFNode = async (
    props: {
        userWallet: PublicKey;
        hostAddress: PublicKey;
        manufacturerAddress: PublicKey;
        solanaAssetId: PublicKey;
        totalAmountToDeposit: number;
    }): Promise<any> => {
    try {
        const { userWallet, hostAddress, manufacturerAddress, solanaAssetId, totalAmountToDeposit } = props;
        if (typeof totalAmountToDeposit !== 'number' || totalAmountToDeposit <= 0) {
            return null;
        }
        // get stake program
        const program = await StakeSystemManager.getInstance();
        const nftMint = new PublicKey(solanaAssetId);
        const amount = convertToTokenAmount(totalAmountToDeposit);
        const adminKeypair = getKeyPairFromUnit8Array(Uint8Array.from(JSON.parse(ENV.ADMIN_REWARD_SYSTEM_PRIVATE_KEY as string)));
        const connection = getSolanaConnection();
        const tokenMint = await getRewardTokenMint();

        // check if the nft has already a stake entry
        const [nfnodeEntryPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("nfnode_entry"), nftMint.toBuffer()],
            program.programId
        );
        const stake = await program.account.nfNodeEntry.fetch(
            nfnodeEntryPDA
        );
        let tx = new anchor.web3.Transaction();
        if (stake) {
            // get the user nft token account
            const userNFTTokenAccount = await getOrCreateAssociatedTokenAccount(
                program.provider.connection,
                adminKeypair, // admin never going to pay because in this moment the token account is created
                nftMint,
                userWallet,
                undefined,
                'confirmed',
                { commitment: "finalized" },
                TOKEN_2022_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID
            );

            tx = await program.methods
                .depositTokens(new BN(amount))
                .accounts({
                    user: userWallet,
                    tokenMint: nftMint,
                    nftMintAddress: nftMint,
                    tokenProgram2022: TOKEN_2022_PROGRAM_ID,
                    userNftTokenAccount: userNFTTokenAccount.address
                }).transaction();
        } else {
            // init stake
            // Derivate token storage authority PDA
            const [tokenStorageAuthority] = PublicKey.findProgramAddressSync(
                [Buffer.from("token_storage"), nftMint.toBuffer()],
                program.programId
            );

            // Get the user token account
            const userTokenAccount = await getAssociatedTokenAddress(
                new PublicKey(tokenMint),
                userWallet
            );

            // Get the token storage account
            const tokenStorageAccount = await getAssociatedTokenAddress(
                new PublicKey(tokenMint),
                tokenStorageAuthority,
                true // allowOwnerOffCurve = true para PDAs
            );

            const userNFTTokenAccount = await getUserNFTTokenAccount(nftMint, userWallet);

            const [adminAccountPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("admin_account")],
                program.programId
            );

            // prepare accounts
            const accounts = {
                userAdmin: adminKeypair.publicKey,
                user: userWallet,
                nftMintAddress: nftMint,
                userNftTokenAccount: userNFTTokenAccount,
                host: hostAddress,
                manufacturer: manufacturerAddress,
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

            // create a transaction to initialize the NFNode
            tx = await program.methods
                .initializeNfnode(new BN(amount))
                .accounts(accounts)
                .transaction()
        }

        const { blockhash, lastValidBlockHeight } = await program.provider.connection.getLatestBlockhash();

        // Set transaction properties before signing
        tx.feePayer = adminKeypair.publicKey;
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;

        // sign admin keypair
        tx.partialSign(adminKeypair)

        // serialize tx
        const serializedTx = tx.serialize({
            requireAllSignatures: false,
            verifySignatures: false,
        });
        const txBase64 = serializedTx.toString("base64");
        return txBase64;
    } catch (error) {
        console.error('Error preparing transaction to stake NFNode:', error);
        return null;
    }
}

export const prepareTransactionToInitializeAndStakeNFNode = async (
    props: {
        userWallet: PublicKey;
        hostAddress: PublicKey;
        manufacturerAddress: PublicKey;
        solanaAssetId: PublicKey;
        extraAmountToDeposit: number;
        nfnodeType: { don: {} } | { byod: {} } | { wayruHotspot: {} };
    }): Promise<{
        serializedTxToInitNFN: string | null;
        serializedTxToStakeNFNode: string | null;
        error: boolean;
        code: string;
    }> => {
    try {
        const { userWallet, hostAddress, manufacturerAddress, solanaAssetId, extraAmountToDeposit, nfnodeType } = props;
        // first prepare the transaction to initialize the NFNode
        const txBase64InitializeNFNode = await prepareTransactionToInitializeNFNode({
            userWallet,
            hostAddress,
            manufacturerAddress,
            solanaAssetId,
            nfnodeType,
        });
        if (!txBase64InitializeNFNode) {
            return {
                serializedTxToInitNFN: null,
                serializedTxToStakeNFNode: null,
                error: true,
                code: REQUEST_TRANSACTION_ERROR_CODES.FAILED_TO_PREPARE_TX_TO_INITIALIZE_NFNODE_ERROR_CODE
            }
        }

        // if there is an extraAmountToDeposit, prepare the transaction to stake the NFNode
        let txBase64StakeNFNode = null;
        if (extraAmountToDeposit > 0) {
            txBase64StakeNFNode = await prepareTransactionToStakeNFNode({
                userWallet,
                hostAddress,
                manufacturerAddress,
                solanaAssetId,
                totalAmountToDeposit: extraAmountToDeposit,
            });
            if (!txBase64StakeNFNode) {
                return {
                    serializedTxToInitNFN: null,
                    serializedTxToStakeNFNode: null,
                    error: true,
                    code: REQUEST_TRANSACTION_ERROR_CODES.FAILED_TO_PREPARE_TX_TO_STAKE_NFNODE_ERROR_CODE
                }
            }
        }
        return {
            serializedTxToInitNFN: txBase64InitializeNFNode,
            serializedTxToStakeNFNode: txBase64StakeNFNode,
            error: false,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_UPDATE_REWARD_CONTRACT_SUCCESS_CODE
        }
    } catch (error) {
        console.error('Error preparing transaction to initialize and stake NFNode:', error);
        return {
            serializedTxToInitNFN: null,
            serializedTxToStakeNFNode: null,
            error: true,
            code: REQUEST_TRANSACTION_ERROR_CODES.FAILED_TO_PREPARE_TX_TO_INITIALIZE_AND_STAKE_NFNODE_ERROR_CODE
        }
    }
}
