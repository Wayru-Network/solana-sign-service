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
