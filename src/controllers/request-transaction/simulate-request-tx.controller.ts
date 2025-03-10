import { CtxWalletAddress } from "@interfaces/request-transaction/api";
import { simulateClaimWCreditsTransaction } from "@services/request-transaction/simulate-request-tx.service";
import { WalletAddressBody } from "@interfaces/request-transaction/api";

export class SimulateRequestTxController {
    static async simulateClaimWCredits(ctx: CtxWalletAddress) {
        const { walletAddress } = ctx?.request?.body as WalletAddressBody;
        const result = await simulateClaimWCreditsTransaction(walletAddress);
        return ctx.body = result
    }
}