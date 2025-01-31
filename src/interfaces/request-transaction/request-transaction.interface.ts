import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { RewardSystem } from "../reward-system-program/reward_system.js";

type claimerType = 'owner' | 'other' | 'manufacturer'


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
export type RequestTransactionResponse = Promise<{ serializedTx: string | null, error: boolean, code: string, claimRewardHistoryId?: number }>


export interface SignRewardsMessage {
    walletAddress: string;
    totalAmount: number;
    minerId: number;
    rewardsId: number[];
    type: claimerType
    solanaAssetId: string;
}

export interface InitializeNfnodeMessage {
    walletOwnerAddress: string;
    hostAddress: string;
    manufacturerAddress: string;
    solanaAssetId: string;
}