import { CtxSimulateClaimReward, CtxSimulateInitNfnode, CtxSimulateInitStake, CtxSimulateUnstake, CtxWalletAddress, SimulateClaimRewardParams } from "@interfaces/request-transaction/api";
import { simulateClaimRewardTransaction, simulateClaimRewardTransactionV2, simulateClaimWCreditsTransaction, simulateInitializeNfnodeTransaction, simulateInitializeNfnodeTransactionV2, simulateInitializeStakeTransaction, simulateInitializeStakeTransactionV2, simulateStakeTransaction, simulateStakeTransactionV2, simulateUnstakeTransaction, simulateUnstakeTransactionV2, simulateUpdateContractTransactions } from "@services/request-transaction/simulate-request-tx.service";
import { WalletAddressBody } from "@interfaces/request-transaction/api";
import { SimulateInitNfnodeParams, SimulateInitStakeParams, SimulateUnstakeParams } from "@interfaces/request-transaction/simulate-request-tx.interfaces";

export class SimulateRequestTxController {
    static async simulateUpdateRewardContract(ctx: CtxSimulateInitNfnode) {
        const body = ctx?.request?.body as SimulateInitNfnodeParams;
        const result = await simulateUpdateContractTransactions(body)
        return ctx.body = result
    }
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
    static async simulateUnstake(ctx: CtxSimulateUnstake) {
        const body = ctx?.request?.body as SimulateUnstakeParams;
        const result = await simulateUnstakeTransaction(body);
        return ctx.body = result
    }
    static async simulateUnstakeV2(ctx: CtxSimulateUnstake) {
        const body = ctx?.request?.body as SimulateUnstakeParams;
        const result = await simulateUnstakeTransactionV2(body);
        return ctx.body = result
    }
    static async simulateInitializeStake(ctx: CtxSimulateInitStake) {
        const body = ctx?.request?.body as SimulateInitStakeParams;
        const result = await simulateInitializeStakeTransaction(body);
        return ctx.body = result
    }
    static async simulateInitializeStakeV2(ctx: CtxSimulateInitStake) {
        const body = ctx?.request?.body as SimulateInitStakeParams;
        const result = await simulateInitializeStakeTransactionV2(body);
        return ctx.body = result
    }
    static async simulateStake(ctx: CtxSimulateInitStake) {
        const body = ctx?.request?.body as SimulateInitStakeParams;
        const result = await simulateStakeTransaction(body);
        return ctx.body = result
    }
    static async simulateStakeV2(ctx: CtxSimulateInitStake) {
        const body = ctx?.request?.body as SimulateInitStakeParams;
        const result = await simulateStakeTransactionV2(body);
        return ctx.body = result
    }
    static async simulateClaimReward(ctx: CtxSimulateClaimReward) {
        const { walletAddress, amountToClaim, nftMintAddress, claimerType } = ctx?.request?.body as SimulateClaimRewardParams;
        const result = await simulateClaimRewardTransaction(walletAddress, amountToClaim, nftMintAddress, claimerType);
        return ctx.body = result
    }
    static async simulateClaimRewardV2(ctx: CtxSimulateClaimReward) {
        const { walletAddress, amountToClaim, nftMintAddress, claimerType } = ctx?.request?.body as SimulateClaimRewardParams;
        const result = await simulateClaimRewardTransactionV2(walletAddress, amountToClaim, nftMintAddress, claimerType);
        return ctx.body = result
    }
    static async simulateInitializeNfnodeV2(ctx: CtxSimulateInitNfnode) {
        const body = ctx?.request?.body as SimulateInitNfnodeParams;
        const result = await simulateInitializeNfnodeTransactionV2(body);
        return ctx.body = result
    }
}