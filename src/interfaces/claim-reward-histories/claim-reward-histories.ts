export type ClaimRewardHistoryStatus = "claimed-successfully" | "requesting-admin-authorization" | "admin-authorization" | "failed"

export interface ClaimRewardHistory {
    id: number;
    status: ClaimRewardHistoryStatus;
    tx_hash: string;
    cifraded_signature: string;
}
