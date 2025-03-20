import { PrepareAccountsToClaimReward, PrepareParamsToClaimReward, PayloadProccessMessageByType, MessageType } from "@/interfaces/request-transaction/request-transaction.interface";
import { getUserNFTTokenAccount } from "@/services/solana/solana.service";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { Transaction } from "@solana/web3.js";
import { ENV } from "@config/env/env";
import { rewardClaimSchema, initializeNfnodeSchema, updateHostSchema, withdrawTokensSchema, claimWCreditsSchema, depositTokensSchema } from "@validations/request-transaction/request-transaction.validation";

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

export const verifyTrasactionSignature = async (serializedTransaction: string): Promise<{ isValid: boolean; message?: string }> => {
    try {
        const transaction = Transaction.from(Buffer.from(serializedTransaction, 'base64'));

        // Rebuild the message from all instructions
        const message = transaction.instructions
            .slice(1) // Ignore the first instruction (transfer)
            .map(inst => inst.data.toString())
            .join('');

        const isValid = transaction.signatures.some(sig =>
            sig.publicKey.toString() === ENV.DB_ADMIN_PUBLIC_KEY
        );

        return { isValid, message };
    } catch (error) {
        console.error('Error verifying the transaction:', error);
        return { isValid: false, message: undefined };
    }
}

export const proccessMessageData = async <T extends MessageType>(type: T, message: string) => {
    try {
        const data = JSON.parse(message) as PayloadProccessMessageByType[T];

        // validate schemas
        switch (type) {
            case 'claim-rewards':
                await rewardClaimSchema.validate(data);
                return data;
            case 'initialize-nfnode':
                await initializeNfnodeSchema.validate(data);
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
            default:
                return null;
        }
    } catch (error) {
        console.error('Error processing message data:', error);
        return null;
    }
}