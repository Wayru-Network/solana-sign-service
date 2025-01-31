import { CtxBase } from "../api/api";

interface SignatureInsideBody {
    signature: string;
}

export interface CtxSignatureInside extends CtxBase<SignatureInsideBody> {}