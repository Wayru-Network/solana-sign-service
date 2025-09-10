import { NFNodeType } from "./request-transaction.interface";


export interface SimulateInitNfnodeParams {
    walletAddress: string;
    nftMintAddress: string;
    nfnodeType: NFNodeType
}
export interface SimulateInitStakeParams {
    walletAddress: string;
    nftMintAddress: string;
    amount: number;
}
export interface SimulateUnstakeParams {
    walletAddress: string;
    nftMintAddress: string;
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
        minimumRequired?: number;
        breakdown?: {
            transactionFee: number;
            claimEntryRent?: number;
            tokenAccountRent?: number;
            nfnodeEntryRent?: number;
            userTokenAccountRent?: number;
        };
    };
    code?: string;
}

export interface SimulationResultV2 {
    success: boolean
    error?: string
    code: string
    details?: {
        networkFeeInSol: number
        wayruFeeTransaction: number
        hasEnoughSolBalance: boolean
        hasEnoughWayruBalance: boolean
        userBalanceInSol: number
        userBalanceInWayru: number
        requiredBalanceInSol: number
        requiredBalanceWayru: number
        txBase64?: string
        discountCodeError?: string
        breakdown?: {
            totalTransferAmountInSol: number
            totalTransferAmountInWayru: number
            treasuryPaymentInSol: number
            treasuryPaymentInWayru: number
            adminPaymentInSol: number
        }
    }
}