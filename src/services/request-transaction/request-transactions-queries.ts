import pool from "@/config/db";
import { REQUEST_TRANSACTION_ERROR_CODES } from "@errors/request-transaction/request-transaction";
import { SignRewardsMessage } from "@/interfaces/request-transaction/request-transaction.interface";
import { ClaimRewardHistory, ClaimRewardHistoryStatus } from "@/interfaces/claim-reward-histories/claim-reward-histories";

export const verifySignatureStatus = async (signature: string, rewardsId: number[], minerId: number, claimerType: SignRewardsMessage['type']) => {

    // validations for signature and rewards id:
    // 1: signature is equal to the signature in the database
    // 2: document status is equal to claiming
    // 3: all rewardsId are linked to the document
    const signatureUsed = await pool.query(
        `SELECT crh.*, 
            (SELECT ARRAY_AGG(crl.rewards_per_epoch_id) 
             FROM claim_reward_histories_rewards_per_epoches_links crl 
             WHERE crl.claim_reward_history_id = crh.id) as linked_rewards
         FROM claim_reward_histories crh 
         WHERE crh.cifraded_signature = $1 AND crh.status = $2`,
        [signature, 'requesting-admin-authorization']
    );
    const document = signatureUsed.rows.length > 0 ? signatureUsed.rows[0] : null;
    if (!document) {
        return {
            isValidStatus: false,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_SIGNATURE_NOT_FOUND_ERROR_CODE
        }
    }
    // Verify that all provided rewardsId exist in the linked rewards
    const linkedRewardsMatch = rewardsId.every(id =>
        document.linked_rewards?.includes(id)
    );
    if (!linkedRewardsMatch) {
        return {
            isValidStatus: false,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_INVALID_REWARDS_ERROR_CODE
        }
    }

    // validations for minerId:
    //1: find rewards_per_epoches that matches the minerId and has the status ready-for-claim
    const rewardsPerEpoch = await pool.query(
        `SELECT rpe.* 
         FROM rewards_per_epoches rpe
         INNER JOIN rewards_per_epoches_nfnode_links rpel 
            ON rpe.id = rpel.rewards_per_epoch_id
         WHERE rpel.nfnode_id = $1 
            AND rpe.status = $2
            AND rpe.${claimerType === 'owner' ? 'owner_payment_status' : 'host_payment_status'} = 'pending'`,
        [minerId, 'ready-for-claim']
    );
    if (rewardsPerEpoch?.rows?.length === 0) {
        return {
            isValidStatus: false,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_MINER_ID_NOT_MATCH_ERROR_CODE
        }
    }

    return {
        isValidStatus: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_SUCCESS_CODE
    }
}

export const updateClaimRewardHistoryStatus = async (signature: string, status: ClaimRewardHistoryStatus) => {
    const documentQuery = await pool.query(
        `UPDATE claim_reward_histories SET status = $1 WHERE cifraded_signature = $2 RETURNING *`,
        [status, signature]
    );
    const document = documentQuery.rows.length > 0 ? documentQuery.rows[0] : null;
    return document as ClaimRewardHistory | null;
}