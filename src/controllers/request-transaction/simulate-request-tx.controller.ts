import { CtxSimulateClaimReward, CtxSimulateInitNfnode, CtxWalletAddress, SimulateClaimRewardParams } from "@interfaces/request-transaction/api";
import { simulateClaimRewardTransaction, simulateClaimWCreditsTransaction, simulateInitializeNfnodeTransaction, simulateInitializeStakeTransaction } from "@services/request-transaction/simulate-request-tx.service";
import { WalletAddressBody } from "@interfaces/request-transaction/api";
import { SimulateInitNfnodeParams, SimulateInitStakeParams } from "@interfaces/request-transaction/simulate-request-tx.interfaces";

export class SimulateRequestTxController {
    static async simulateClaimWCredits(ctx: CtxWalletAddress) {
        const { walletAddress } = ctx?.request?.body as WalletAddressBody;
        const result = await simulateClaimWCreditsTransaction(walletAddress);
        return ctx.body = result
    }
    static async simulateInitializeNfnode(ctx: CtxSimulateInitNfnode) {
        const body = ctx?.request?.body as SimulateInitNfnodeParams;
        const result = await simulateInitializeNfnodeTransaction(body);
        return ctx.body = result
    }
    static async simulateInitializeStake(ctx: CtxSimulateInitNfnode) {
        const body = ctx?.request?.body as SimulateInitStakeParams;
        const result = await simulateInitializeStakeTransaction(body);
        return ctx.body = result
    }
    static async simulateClaimReward(ctx: CtxSimulateClaimReward) {
        const { walletAddress, amountToClaim, nftMintAddress, claimerType } = ctx?.request?.body as SimulateClaimRewardParams;
        const result = await simulateClaimRewardTransaction(walletAddress, amountToClaim, nftMintAddress, claimerType);
        return ctx.body = result
    }
}