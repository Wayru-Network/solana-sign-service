import { CtxBase } from "../api/api";
import { SimulateInitNfnodeParams } from "./simulate-request-tx.interfaces";

interface SignatureInsideBody {
    signature: string;
}

export interface WalletAddressBody {
    walletAddress: string;
}

export interface CtxSignatureInside extends CtxBase<SignatureInsideBody> {}

export interface CtxWalletAddress extends CtxBase<WalletAddressBody> {}

export interface CtxSimulateInitNfnode extends CtxBase<SimulateInitNfnodeParams> {}