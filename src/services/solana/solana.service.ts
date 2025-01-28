import * as anchor from "@coral-xyz/anchor";
import { getKeyPairFromUnit8Array } from "@/helpers/solana/solana.helpers.js";
import { ADMIN_PRIVATE_KEY, NODE_ENV } from "@/constants/solana/solana.constants.js";
import { REWARD_SYSTEM_PROGRAM_ID } from "@/constants/solana/solana.constants.js";
import { SOLANA_API_URL } from "@/constants/solana/solana.constants.js";
import { RewardSystem } from "@/interfaces/reward-system-program/reward_system.js";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

export const getRewardSystemProgram = async () => {
  try {
    // get admin key
    if (!ADMIN_PRIVATE_KEY) {
      throw new Error("ADMIN_PRIVATE_KEY is not set");
    }

    const adminKeypair = getKeyPairFromUnit8Array(Uint8Array.from(JSON.parse(ADMIN_PRIVATE_KEY)));
    // prepare connection
    const connection = new anchor.web3.Connection(SOLANA_API_URL);
    const provider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(adminKeypair as unknown as anchor.web3.Keypair), // Type cast to anchor's Keypair
      { commitment: "confirmed" }
    );
    const programId = new anchor.web3.PublicKey(REWARD_SYSTEM_PROGRAM_ID);
    //only for devnet because it required fee
    if (NODE_ENV === 'develop') {
      const idl = await anchor.Program.fetchIdl(programId, provider);
      if (!idl) throw new Error("IDL not found");
    }

    const program = await anchor.Program.at(
      programId,
      provider
    ) as anchor.Program<RewardSystem>;

    return program;

  } catch (error) {
    console.error(`Error getting reward system program:`, error);
    throw error;
  }
};

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

      console.log("NFT Token Account:", userNFTTokenAccount.toString());
      return userNFTTokenAccount;
  } catch (error) {
      console.error("Error getting NFT token account:", error);
      throw error;
  }
};

export const getSolanaConnection = async () => {
  const connection = new Connection(SOLANA_API_URL, "confirmed");
  return connection;
};

export const convertToTokenAmount = (amount: number, decimals: number = 6) => {
  return Math.round(amount * Math.pow(10, decimals));
};