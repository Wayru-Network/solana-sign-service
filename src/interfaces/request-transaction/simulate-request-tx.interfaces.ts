import { NFNodeType } from "./request-transaction.interface";


export interface SimulateInitNfnodeParams {
    walletAddress: string;
    nftMintAddress: string;
    nfnodeType: NFNodeType
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
            claimEntryRent?: number;
            tokenAccountRent?: number;
            nfnodeEntryRent?: number;
        };
    };
    code?: string;
}
