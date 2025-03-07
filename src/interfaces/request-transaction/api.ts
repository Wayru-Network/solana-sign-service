import { CtxBase } from "../api/api";

interface SignatureInsideBody {
    signature: string;
}

export interface WalletAddressBody {
    walletAddress: string;
}

export interface CtxSignatureInside extends CtxBase<SignatureInsideBody> {}

export interface CtxWalletAddress extends CtxBase<WalletAddressBody> {}