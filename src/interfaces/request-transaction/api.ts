import { CtxBase } from "../api/api";
import { SimulateInitNfnodeParams, SimulateInitStakeParams } from "./simulate-request-tx.interfaces";

interface SignatureInsideBody {
    signature: string;
}

export interface WalletAddressBody {
    walletAddress: string;
}

export interface SimulateClaimRewardParams {
    walletAddress: string;
    amountToClaim: number;
    nftMintAddress: string;
    claimerType: 'owner' | 'other';
}
export interface CtxSignatureInside extends CtxBase<SignatureInsideBody> {}

export interface CtxWalletAddress extends CtxBase<WalletAddressBody> {}

export interface CtxSimulateInitNfnode extends CtxBase<SimulateInitNfnodeParams> {}
export interface CtxSimulateInitStake extends CtxBase<SimulateInitStakeParams> {}

export interface CtxSimulateClaimReward extends CtxBase<SimulateClaimRewardParams> {}