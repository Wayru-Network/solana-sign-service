import { PrepareAccountsToClaimReward, PrepareParamsToClaimReward } from "@/interfaces/request-transaction/request-transaction.interface.js";
import { getUserNFTTokenAccount } from "@/services/solana/solana.service.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";

export const prepareParamsToClaimReward = async ({ program, mint, userWallet, nftMint }: PrepareParamsToClaimReward) => {
    try {    // Get token storage authority
        const [tokenStorageAuthority] = PublicKey.findProgramAddressSync(
            [Buffer.from("token_storage")],
            program.programId
        );
        console.log("\n=== PDAs and Accounts ===");
        console.log("Token Storage Authority:", tokenStorageAuthority.toString());

        // Get storage account
        const storageAccount = await getAssociatedTokenAddress(
            mint,
            tokenStorageAuthority,
            true,
            TOKEN_PROGRAM_ID
        );
        console.log("Storage Account:", storageAccount.toString());

        // Get user's token account
        const userTokenAccount = await getAssociatedTokenAddress(
            mint,
            userWallet,
            false,
            TOKEN_PROGRAM_ID
        );

        // Derivar otras PDAs necesarias
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
            tokenProgram2022: TOKEN_2022_PROGRAM_ID,  // Añadido de nuevo
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