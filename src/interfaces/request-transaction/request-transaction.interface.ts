import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { RewardSystem } from "../reward-system-program/reward_system.js";

type claimerType = 'owner' | 'other'


/** Requests types */
export interface RequestTransactionInitializeNfnode {
    walletOwner: string;
    hostAddress: string;
    manufacturerAddress: string;
    solanaAssetId: string;
}

export interface RequestTransactionClaimReward {
    solanaAssetId: string;
    rewardAmount: number;
    claimerType: claimerType
    walletAddress: string
}

export interface PrepareParamsToClaimReward {
    program: Program<RewardSystem>
    mint: PublicKey
    userWallet: PublicKey
    nftMint: PublicKey
}

export interface PrepareAccountsToClaimReward {
    program: Program<RewardSystem>
    mint: PublicKey
    userWallet: PublicKey
    nftMint: PublicKey
    claimerType: claimerType
    adminKeypair: Keypair
}

export interface RequestTransactionUpdateHost {
    newHostAddress: string
    ownerAddress: string
    solanaAssetId: string;
}


/** Responses types */
export type RequestTransactionResponse = Promise<{ serializedTx: string | null, error: boolean, code: string }>
