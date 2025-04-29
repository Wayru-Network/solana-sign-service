import * as anchor from "@coral-xyz/anchor";
import { ENV } from "@config/env/env";
import { getSolanaConnection } from "../solana.connection";
import { getKeyPairFromUnit8Array, getRewardSystemProgramId } from "@helpers/solana/solana.helpers";
import { RewardSystem } from "@interfaces/reward-system-program/reward_system";
/**
 * - This class is used to manage the reward system program
 * - It is a singleton class that can be used to get the instance of the reward system program
 * - It is also used to clean up the reward system program
 * - You can no use it to make transactions because it is only for reading states of the program
 */
export class RewardSystemManager {
    private static instance: anchor.Program<RewardSystem> | null = null;
    private static isInitializing: boolean = false;

    static async getInstance(): Promise<anchor.Program<RewardSystem>> {
        if (RewardSystemManager.instance) {
            return RewardSystemManager.instance;
        }

        if (RewardSystemManager.isInitializing) {
            // await until the instance is initialized
            while (RewardSystemManager.isInitializing) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return RewardSystemManager.instance!;
        }

        RewardSystemManager.isInitializing = true;
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

            const rewardSystemProgramId = await getRewardSystemProgramId();
            const programId = new anchor.web3.PublicKey(rewardSystemProgramId);
            const idl = await anchor.Program.fetchIdl(programId, provider);

            if (!idl) {
                console.error('❌ Failed to initialize Reward System Program: IDL not found');
                throw new Error('❌ Failed to initialize Reward System Program: IDL not found');
            }

            RewardSystemManager.instance = await anchor.Program.at(
                programId,
                provider
            ) as anchor.Program<RewardSystem>;

            console.log('✅ Reward System Program initialized');
            return RewardSystemManager.instance;
        } catch (error) {
            console.error('Error loading IDL:', error);
            throw new Error('❌ Failed to initialize Reward System Program: IDL not found');
        } finally {
            RewardSystemManager.isInitializing = false;
        }
    }

    static cleanup() {
        if (RewardSystemManager.instance) {
            // clean up connections if necessary
            RewardSystemManager.instance = null;
            console.log('🧹 Reward System Program cleaned up');
        }
    }
}