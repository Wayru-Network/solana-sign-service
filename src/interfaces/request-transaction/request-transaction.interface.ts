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
export type MessageType =
    'claim-rewards' |
    'initialize-nfnode' |
    'initialize-stake' |
    'add-host-to-nfnode' |
    'withdraw-tokens' |
    'claim-w-credits' |
    'deposit-tokens' |
    'stake-tokens' |
    'update-reward-contract'

export type NFNodeTypeEnum = 'don' | 'byod' | 'wayruHotspot'
export type NFNodeType = 'don' | 'byod' | 'wayru'

export interface ClaimRewardsMessage {
    walletAddress: string;
    totalAmount: number;
    minerId: number;
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
export interface InitializeStakeMessage {
    walletAddress: string;
    solanaAssetId: string;
    amount: number;
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
    solanaWayruFeeTransactionAddress: string;
    wayruFeeTransaction: number;
    hostShare: number;
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
    trackerId: number;
}

export interface DepositTokensMessage {
    walletAddress: string;
    solanaAssetId: string;
    nonce: number;
}
export interface StakeTokensMessage {
    walletAddress: string;
    solanaAssetId: string;
    amount: number;
    nonce: number;
}

interface UpdateRewardContractMessage {
    walletAddress: string;
    nonce: number;
    solanaAssetId: string;
    nfnodeType: Record<NFNodeType, {}>
    manufacturerAddress: string;
    hostAddress: string;
    status: 'invalid_nfnode' | 'only_init_nfnode' | 'claim_and_init_nfnode'
}

// Mapping between message types and their payloads
export type PayloadProcessMessageByType = {
    'claim-rewards': ClaimRewardsMessage;
    'initialize-nfnode': InitializeNfnodeMessage;
    'initialize-stake': InitializeStakeMessage;
    'add-host-to-nfnode': UpdateHostMessage;
    'withdraw-tokens': WithdrawTokensMessage;
    'claim-w-credits': ClaimWCreditsMessage;
    'deposit-tokens': DepositTokensMessage;
    'stake-tokens': StakeTokensMessage;
    'update-reward-contract': UpdateRewardContractMessage;
}

