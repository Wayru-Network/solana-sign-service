import { getKeyPairFromUnit8Array, getRewardTokenMint } from "@/helpers/solana/solana.helpers";
import { ENV } from "@config/env/env";
<<<<<<< HEAD
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getSolanaConnection } from "./solana.connection";
import { getKeyByName } from "@services/keys/keys-queries";
import { getAssetsPrice } from "@services/assets/assets.service";
import { AssetInfoOutput } from "@interfaces/assets/assets.interface";
=======
import { RewardSystem } from "@interfaces/reward-system-program/reward_system";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { AirdropsProgram } from "@interfaces/airdrops-program/airdrops_program";
import { getAirdropsProgramId, getRewardSystemProgramId } from "@helpers/solana/solana.helpers";
import { getSolanaConnection } from "./solana.connection";
import { getKeyByName } from "@services/keys/keys-queries";
>>>>>>> 65c5ceb214356ed4ef81b8e7c9c2ad93a3949f69


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

export const getMinimumRemainingSolanaBalance = async () => {
  const key = await getKeyByName('MINIMUM_REMAINING_SOLANA_BALANCE_IN_SOL')
  return key?.value ? Number(key.value) * LAMPORTS_PER_SOL : 0.02 * LAMPORTS_PER_SOL;
<<<<<<< HEAD
}

/**
 * get Wallet Balance
 * @param address string
 */
export const getSolanaWalletBalance = async (address: string, decimals?: number) => {
  try {
    // get balance
    const balance = await getSolBalance(address)

    const assetsPrice = await getAssetsPrice()
    const wayruBalance = await getWAYRUBalance(address)
    const rewardTokenMint = await getRewardTokenMint()

    const data: AssetInfoOutput[] = [
      {
        name: 'SOL',
        balance: Number(balance).toFixed(decimals ?? 6),
        value: assetsPrice?.SOL || 100,
        assetId: undefined,
        'opt-in': true,
      },
      {
        name: 'WAYRU',
        balance: wayruBalance?.toString() || '0',
        value: assetsPrice?.WAYRU || 0.001,
        assetId: rewardTokenMint,
        'opt-in': true,
      },
    ]

    return {
      assets: data,
      totalBalance: balance,
      error: false,
      message: 'Success',
    }
  } catch (error) {
    console.log('get IoTeX Wallet Balance', error)
    return {
      assets: [
        {
          name: 'SOL',
          balance: '0',
          value: 0,
          assetId: undefined,
          'opt-in': true,
        },
        {
          name: 'WAYRU',
          balance: '0',
          value: 0,
          assetId: undefined,
          'opt-in': true,
        },
      ] as AssetInfoOutput[],
      totalBalance: '0',
      error: false,
      message: 'Internal Error',
    }
  }
}


const getSolBalance = async (public_key: string) => {
  try {
    const connection = getSolanaConnection()
    const address = new PublicKey(public_key)
    const balance = await connection.getBalance(address)
    const balance_in_sol = balance / LAMPORTS_PER_SOL
    return balance_in_sol
  } catch (error) {
    console.log('getSolBalance Error', error)
    return 0
  }
}

const getWAYRUBalance = async (address: string): Promise<number> => {
  try {
    const connection = getSolanaConnection()
    const rewardTokenMint = await getRewardTokenMint()

    // Get user's Associated Token Account
    const userATA = await getAssociatedTokenAddress(
      new PublicKey(rewardTokenMint),
      new PublicKey(address),
      false,
      TOKEN_PROGRAM_ID,
    )

    // Verify if the account exists
    let exists = false
    try {
      await getAccount(connection, userATA, 'confirmed', TOKEN_PROGRAM_ID)
      exists = true
    } catch (e) {
      exists = false
    }

    // Get balance if account exists
    let uiAmount: number | null = null
    let decimals = 0

    if (exists) {
      const balance = await connection.getTokenAccountBalance(userATA)
      uiAmount = balance.value.uiAmount
      decimals = balance.value.decimals
    }

    return uiAmount || 0
  } catch (error) {
    console.error('Error getting token balance:', error)
    return 0
  }
}

/**
 * this wallet is used to receive the payments the cost of the network fee for the wayru network and extra payments
 * @returns wayru foundation wallet address
 */
export const getWayruFoundationWalletAddress = async () => {
  const solanaWayruNetworkFeeWalletAddress = await getKeyByName('WAYRU_FOUNDATION_WALLET_ADDRESS')
  return solanaWayruNetworkFeeWalletAddress?.value ?? 'EgnzEnm2yKRg2wk7cdqtXTt9YKKKSSaqLZbchdX2mPAW'
=======
>>>>>>> 65c5ceb214356ed4ef81b8e7c9c2ad93a3949f69
}