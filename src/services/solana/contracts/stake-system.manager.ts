import * as anchor from "@coral-xyz/anchor";
import { ENV } from "@config/env/env";
import { getSolanaConnection } from "../solana.connection";
import { getKeyPairFromUnit8Array, getStakeSystemProgramId } from "@helpers/solana/solana.helpers";
import { StakeProgram } from "@interfaces/stake-program/stake_program";
/**
 * - This class is used to manage the reward system program
 * - It is a singleton class that can be used to get the instance of the reward system program
 * - It is also used to clean up the reward system program
 * - You can no use it to make transactions because it is only for reading states of the program
 */
export class StakeSystemManager {
    private static instance: anchor.Program<StakeProgram> | null = null;
    private static isInitializing: boolean = false;

    static async getInstance(): Promise<anchor.Program<StakeProgram>> {
        if (StakeSystemManager.instance) {
            return StakeSystemManager.instance;
        }

        if (StakeSystemManager.isInitializing) {
            // await until the instance is initialized
            while (StakeSystemManager.isInitializing) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return StakeSystemManager.instance!;
        }

        StakeSystemManager.isInitializing = true;
        try {
            if (!ENV.ADMIN_REWARD_SYSTEM_PRIVATE_KEY) {
                throw new Error("ADMIN_REWARD_SYSTEM_PRIVATE_KEY is not set");
            }
            const connection = getSolanaConnection();
            const adminKeypair = getKeyPairFromUnit8Array(Uint8Array.from(JSON.parse(ENV.ADMIN_REWARD_SYSTEM_PRIVATE_KEY)));
            const provider = new anchor.AnchorProvider(
                connection,
                new anchor.Wallet(adminKeypair),
                { commitment: "confirmed" }
            );

            const stakeSystemProgramId = await getStakeSystemProgramId();
            const programId = new anchor.web3.PublicKey(stakeSystemProgramId);
            const idl = await anchor.Program.fetchIdl(programId, provider);

            if (!idl) {
                console.error('❌ Failed to initialize Reward System Program: IDL not found');
                throw new Error('❌ Failed to initialize Reward System Program: IDL not found');
            }

            StakeSystemManager.instance = await anchor.Program.at(
                programId,
                provider
            ) as anchor.Program<StakeProgram>;

            console.log('✅ Stake System Program initialized');
            return StakeSystemManager.instance;
        } catch (error) {
            console.error('Error loading IDL:', error);
            throw new Error('❌ Failed to initialize Stake System Program: IDL not found');
        } finally {
            StakeSystemManager.isInitializing = false;
        }
    }

    static cleanup() {
        if (StakeSystemManager.instance) {
            // clean up connections if necessary
            StakeSystemManager.instance = null;
            console.log('🧹 Stake System Program cleaned up');
        }
    }
}