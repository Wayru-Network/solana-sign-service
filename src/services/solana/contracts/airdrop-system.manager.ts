import * as anchor from "@coral-xyz/anchor";
import { ENV } from "@config/env/env";
import { getSolanaConnection } from "../solana.connection";
import { getKeyPairFromUnit8Array, getAirdropsProgramId } from "@helpers/solana/solana.helpers";
import { AirdropsProgram } from "@interfaces/airdrops-program/airdrops_program";

/**
 * - This class is used to manage the airdrops program
 * - It is a singleton class that can be used to get the instance of the airdrops program
 * - It is also used to clean up the airdrops program
 * - You can no use it to make transactions because it is only for reading states of the program
 */
export class AirdropsSystemManager {
    private static instance: anchor.Program<AirdropsProgram> | null = null;
    private static isInitializing: boolean = false;

    static async getInstance(): Promise<anchor.Program<AirdropsProgram>> {
        if (AirdropsSystemManager.instance) {
            return AirdropsSystemManager.instance;
        }

        if (AirdropsSystemManager.isInitializing) {
            // await until the instance is initialized
            while (AirdropsSystemManager.isInitializing) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return AirdropsSystemManager.instance!;
        }

        AirdropsSystemManager.isInitializing = true;
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

            const airdropsProgramId = await getAirdropsProgramId();
            const programId = new anchor.web3.PublicKey(airdropsProgramId);

            // Only fetch IDL in development environment
            if (ENV.NODE_ENV === 'develop') {
                const idl = await anchor.Program.fetchIdl(programId, provider);
                if (!idl) {
                    console.error('❌ Failed to initialize Airdrops Program: IDL not found');
                    throw new Error('❌ Failed to initialize Airdrops Program: IDL not found');
                }
            }

            AirdropsSystemManager.instance = await anchor.Program.at(
                programId,
                provider
            ) as anchor.Program<AirdropsProgram>;

            console.log('✅ Airdrops Program initialized');
            return AirdropsSystemManager.instance;
        } catch (error) {
            console.error('Error initializing Airdrops Program:', error);
            throw new Error('❌ Failed to initialize Airdrops Program');
        } finally {
            AirdropsSystemManager.isInitializing = false;
        }
    }

    static cleanup() {
        if (AirdropsSystemManager.instance) {
            // clean up connections if necessary
            AirdropsSystemManager.instance = null;
            console.log('🧹 Airdrops Program cleaned up');
        }
    }
}