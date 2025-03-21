import { CtxSimulateInitNfnode, CtxWalletAddress } from "@interfaces/request-transaction/api";
import { simulateClaimWCreditsTransaction, simulateInitializeNfnodeTransaction } from "@services/request-transaction/simulate-request-tx.service";
import { WalletAddressBody } from "@interfaces/request-transaction/api";
import { SimulateInitNfnodeParams } from "@interfaces/request-transaction/simulate-request-tx.interfaces";

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
}