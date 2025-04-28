import * as anchor from "@coral-xyz/anchor";
import { getKeyPairFromUnit8Array } from "@/helpers/solana/solana.helpers";
import { ENV } from "@config/env/env";
import { RewardSystem } from "@interfaces/reward-system-program/reward_system";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { AirdropsProgram } from "@interfaces/airdrops-program/airdrops_program";
import { getAirdropsProgramId, getRewardSystemProgramId } from "@helpers/solana/solana.helpers";
import { getSolanaConnection } from "./solana.connection";


export const getUserNFTTokenAccount = async (
  nftMint: PublicKey,
  userPublicKey: PublicKey,
): Promise<PublicKey> => {
  try {
      const userNFTTokenAccount = await getAssociatedTokenAddress(
          nftMint,                // mint
          userPublicKey,          // owner
          false,                  // allowOwnerOffCurve
          TOKEN_2022_PROGRAM_ID   // programId
      );

      return userNFTTokenAccount;
  } catch (error) {
      console.error("Error getting NFT token account:", error);
      throw error;
  }
};

export const convertToTokenAmount = (amount: number, decimals: number = 6) => {
  return Math.round(amount * Math.pow(10, decimals));
};

export const getAdminKeypair = () => {
  return getKeyPairFromUnit8Array(Uint8Array.from(JSON.parse(ENV.ADMIN_REWARD_SYSTEM_PRIVATE_KEY as string)));
}