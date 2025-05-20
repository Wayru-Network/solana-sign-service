import { ComputeBudgetProgram, Transaction } from "@solana/web3.js";
import { getSolanaPriorityFee } from "@helpers/solana/solana.helpers";
import { ENV } from "@config/env/env";
import { getRewardTokenMint } from "@helpers/solana/solana.helpers";
import { getKeyPairFromUnit8Array } from "@helpers/solana/solana.helpers";
import { AirdropsSystemManager } from "@services/solana/contracts/airdrop-system.manager";
import { getSolanaConnection } from "@services/solana/solana.connection";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { convertToTokenAmount } from "@services/solana/solana.service";
import moment from "moment";
import { countNFNodesByWallet } from "@services/nfnodes/nfnodes.service";

export const prepareTransactionToClaimLostTokens = async (
  userWallet: PublicKey
): Promise<string | null> => {
  try {
    // get program
    const program = await AirdropsSystemManager.getInstance();
    const adminKeypair = getKeyPairFromUnit8Array(
      Uint8Array.from(JSON.parse(ENV.ADMIN_REWARD_SYSTEM_PRIVATE_KEY as string))
    );
    const user = new PublicKey(userWallet); // owner of the NFT
    const connection = getSolanaConnection();
    const rewardTokenMint = await getRewardTokenMint();
    // Add priority fee
    const priorityFeeInSol = await getSolanaPriorityFee();
    const microLamportsPerComputeUnit = Math.floor(
      priorityFeeInSol * 1_000_000
    );
    // the lost tokens always are 5,000
    const amountToClaim = 5000;

    // count how many nfnodes the user wallet has
    const nfnodesCount = await countNFNodesByWallet(userWallet.toBase58());
    if (nfnodesCount === 0) {
      return null;
    }

    // generate safe nonce
    // this nonce is used once per day and wallet
    // so if the wallet has more than 1 nfnodes, we need to generate a nonce for each nfnodes
    const { nonce, isValid } = generateSafeNonce();
    if (!isValid || !nonce) {
      return null;
    }
    const nonceToUse = nfnodesCount === 1 ? nonce : new Date().getTime();

    // amount to claim
    const amount = new BN(convertToTokenAmount(amountToClaim));

    const ix = await program.methods
      .claimTokens(amount, new BN(nonceToUse))
      .accounts({
        userAdmin: adminKeypair.publicKey,
        user: user,
        tokenMint: new PublicKey(rewardTokenMint),
      })
      .instruction();

    const tx = new Transaction();
    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: microLamportsPerComputeUnit,
      }),
      ix
    );
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = user;
    tx.partialSign(adminKeypair);

    // serialize tx
    const serializedTx = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    const txBase64 = serializedTx.toString("base64");
    return txBase64;
  } catch (error) {
    console.error("Error preparing transaction to claim lost tokens:", error);
    return null;
  }
};

// Auxiliary function to determine if we are in the grace period
const isInvalidNonceTimestamp = (date: moment.Moment): boolean => {
  const hour = date.utc().hours();
  const minutes = date.utc().minutes();
  // If it is 00:00 to 00:02 UTC
  return hour === 0 && minutes < 2;
};

// Generate nonce with grace period
export const generateSafeNonce = (): {
  nonce: number | undefined;
  isValid: boolean;
} => {
  // Use UTC time for nonce generation
  const now = moment().utc();

  if (isInvalidNonceTimestamp(now)) {
    return {
      nonce: undefined,
      isValid: false,
    };
  }

  return {
    nonce: parseInt(now.format("YYYYMMDD")),
    isValid: true,
  };
};
