import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { RewardSystem } from "../reward-system-program/reward_system.js";

export type ClaimerType = 'owner' | 'other' | 'manufacturer'


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
    claimerType: ClaimerType
    adminKeypair: Keypair
}

export interface RequestTransactionUpdateHost {
    newHostAddress: string
    ownerAddress: string
    solanaAssetId: string;
}


/** Responses types */
export type RequestTransactionResponse = Promise<{ serializedTx: string | null, error: boolean, code: string }>



/** Message types */
export type MessageType = 'claim-rewards' | 'initialize-nfnode' | 'add-host-to-nfnode' | 'withdraw-tokens'
export type NFNodeType = 'don' | 'byod' | 'wayruHotspot'

export interface ClaimRewardsMessage {
    walletAddress: string;
    totalAmount: number;
    minerId: number;
    rewardsId: number[];
    type: ClaimerType
    solanaAssetId: string;
    nonce: number;
}

export interface InitializeNfnodeMessage {
    walletOwnerAddress: string;
    hostAddress: string;
    manufacturerAddress: string;
    solanaAssetId: string;
    nfnodeType: { don: {} } | { byod: {} } | { wayruHotspot: {} }
    nonce: number;
}

export interface UpdateHostMessage {
    walletOwnerAddress: string;
    hostAddress: string;
    solanaAssetId: string;
    nonce: number;
}

export interface WithdrawTokensMessage {
    walletAddress: string;
    solanaAssetId: string;
    userNFTTokenAccount: string;
    nonce: number;
}

// Mapping between message types and their payloads
export type PayloadProccessMessageByType = {
    'claim-rewards': ClaimRewardsMessage;
    'initialize-nfnode': InitializeNfnodeMessage;
    'add-host-to-nfnode': UpdateHostMessage;
    'withdraw-tokens': WithdrawTokensMessage;
}