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
export type MessageType = 'claim-rewards' | 'initialize-nfnode' | 'add-host-to-nfnode' | 'withdraw-tokens' | 'claim-w-credits'
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
    feeToUpdateMetadata: number;
    paymentToAddHostToNFnode: number;
    solanaWalletAddressAdmin: string;
    solanaTreasuryWalletAddress: string;
}

export interface WithdrawTokensMessage {
    walletAddress: string;
    solanaAssetId: string;
    nonce: number;
}

export interface ClaimWCreditsMessage {
    walletAddress: string;
    amountToClaim: number;
    nonce: number;
}

// Mapping between message types and their payloads
export type PayloadProccessMessageByType = {
    'claim-rewards': ClaimRewardsMessage;
    'initialize-nfnode': InitializeNfnodeMessage;
    'add-host-to-nfnode': UpdateHostMessage;
    'withdraw-tokens': WithdrawTokensMessage;
    'claim-w-credits': ClaimWCreditsMessage;
}

export interface SimulationResult {
    feeInLamports: number;
    feeInSol: number;
    success: boolean;
    error?: string;
    details?: {
        hasEnoughBalance: boolean;
        userBalance: number;
        requiredBalance: number;
        rentExemptBalance?: number;
        breakdown?: {
            transactionFee: number;
            claimEntryRent: number;
            tokenAccountRent: number;
        };
    };
    code?: string;
}
