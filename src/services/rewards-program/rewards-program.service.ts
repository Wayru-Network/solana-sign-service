import { ComputeBudgetProgram } from "@solana/web3.js";
import { ENV } from "@config/env/env";
import { getKeyPairFromUnit8Array, getRewardTokenMint, getSolanaPriorityFee } from "@helpers/solana/solana.helpers";
import { NFNodeTypeEnum } from "@interfaces/request-transaction/request-transaction.interface";
import { RewardSystemManager } from "@services/solana/contracts/reward-system.manager";
import { getSolanaConnection } from "@services/solana/solana.connection";
import { getUserNFTTokenAccount } from "@services/solana/solana.service";
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { BN } from "bn.js";
import * as anchor from "@coral-xyz/anchor";

export const prepareTransactionToInitializeNFNode = async (params: {
    walletOwnerAddress: PublicKey;
    hostAddress: PublicKey;
    manufacturerAddress: PublicKey;
    solanaAssetId: PublicKey;
    nfnodeType: { don: {} } | { byod: {} } | { wayruHotspot: {} };
}) => {
    try {
        const {walletOwnerAddress, hostAddress, manufacturerAddress, solanaAssetId, nfnodeType} = params
        // prepare transaction parameters
        const hostShare = new BN(0); // host share of the NFT is 0
        const program = await RewardSystemManager.getInstance();
        const adminKeypair = getKeyPairFromUnit8Array(Uint8Array.from(JSON.parse(ENV.ADMIN_REWARD_SYSTEM_PRIVATE_KEY as string)));
        const user = walletOwnerAddress; // owner of the NFT
        const host = hostAddress; // host of the NFT
        const manufacturer = manufacturerAddress; // manufacturer of the NFT
        const nftMintAddress = solanaAssetId; // mint address of the NFT
        const userNFTTokenAccount = await getUserNFTTokenAccount(nftMintAddress, user);
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
        const microLamportsPerComputeUnit = Math.floor(priorityFeeInSol * 1_000_000);

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
        const ix = await program.methods
            .initializeNfnode(hostShare, nfnodeType as Record<NFNodeTypeEnum, never>)
            .accounts(accounts)
            .transaction()

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
        tx.feePayer = user;  // set the fee payer

        // sign admin keypair
        tx.partialSign(adminKeypair)

        // serialize tx
        const serializedTx = tx.serialize({
            requireAllSignatures: false,
            verifySignatures: false,
        });

        return serializedTx.toString("base64")

    } catch (error) {
        console.error('Error preparing transaction to initialize NFNode:', error);
        return null;
    }
}