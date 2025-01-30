import { CtxBase } from "../api/api";

interface ClaimRewardsBody {
    signature: string;
}

export interface CtxClaimRewards extends CtxBase<ClaimRewardsBody> {}