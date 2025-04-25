import { User } from "@interfaces/user";
import { ClaimerType } from "./request-transaction.interface";

export type TransactionType = 'mint_nfnode' | 'initialize_nfnode' | 'claim_rewards' | 'add_host_to_nfnode'
export type TxHashStatus = 'pending' | 'success' | 'error'
export type CifradedSignatureStatus = 'requesting_admin_authorization' | 'request_authorized_by_admin' | 'request_unauthorized_by_admin' | 'request_expired'

export interface VerifySignatureStatusToClaim {
    signature: string;
    nonce: number;
    rewardsId: number[];
    minerId: number;
    claimerType: ClaimerType;
}

export interface TransactionTracker {
    id: number
    users_permissions_user: User
    transaction_type: TransactionType
    tx_hash_status: TxHashStatus
    cifraded_signature_status: CifradedSignatureStatus
    tx_hash: string
    cifraded_signature: string
    rewards_per_epoches: number[]
}