import pool from "@/config/db";
import { REQUEST_TRANSACTION_EXPIRATION_TIME } from "@constants/request-transaction";
import { REQUEST_TRANSACTION_ERROR_CODES } from "@errors/request-transaction/request-transaction";
import { CifradedSignatureStatus, TransactionTracker, VerifySignatureStatusToClaim } from "@interfaces/request-transaction/transaction-tracker";
import moment from "moment";

export const verifyTransactionTrackerToClaimRewards = async ({ signature, nonce, rewardsId, minerId, claimerType }: VerifySignatureStatusToClaim) => {

    // validations for signature and rewards id:
    // 1: signature is equal to the signature in the database
    // 2: document status is equal to claiming
    // 3: all rewardsId are linked to the document
    const signatureUsed = await pool.query(
        `SELECT tt.*,
            ARRAY(
                SELECT rewards_per_epoch_id::text 
                FROM transaction_trackers_rewards_per_epoches_links
                WHERE transaction_tracker_id = tt.id
            ) as linked_rewards
         FROM transaction_trackers tt 
         WHERE tt.cifraded_signature = $1 
         AND tt.id = $2 
         AND tt.cifraded_signature_status = $3
         AND tt.transaction_type = $4`,
        [signature, nonce, 'requesting_admin_authorization', 'claim_rewards']
    );
    const document = signatureUsed.rows.length > 0 ? signatureUsed.rows[0] : null;
    if (!document) {
        return {
            isValidStatus: false,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_SIGNATURE_NOT_FOUND_ERROR_CODE
        }
    }

    // validate if the document is older than 30 seconds
    const isOlderThan30Seconds = moment(document?.created_at).isBefore(moment().subtract(REQUEST_TRANSACTION_EXPIRATION_TIME, 'seconds'));
    if (isOlderThan30Seconds) {
        return {
            isValidStatus: false,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_SIGNATURE_EXPIRED_ERROR_CODE
        }
    }
    // Verify that all provided rewardsId exist in the linked rewards
    const linkedRewardsMatch = rewardsId.every(id =>
        document.linked_rewards?.includes(id.toString())
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
            AND rpe.${claimerType === 'owner' ? 'owner_payment_status' : 'host_payment_status'} = 'claiming'`,
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


export const updateTransactionTrackerStatus = async (nonce: number, status: CifradedSignatureStatus) => {
    if (!nonce) {
        return null;
    }
    const documentQuery = await pool.query(
        `UPDATE transaction_trackers SET cifraded_signature_status = $1 WHERE id = $2 RETURNING *`,
        [status, nonce]
    );
    const document = documentQuery.rows.length > 0 ? documentQuery.rows[0] : null;
    return document as TransactionTracker | null;
}

export const validateSignatureStatus = async (nonce: number, signature: string) => {
    const documents = await pool.query(
        `SELECT * FROM transaction_trackers WHERE id = $1 AND cifraded_signature = $2 AND cifraded_signature_status = $3`,
        [nonce, signature, 'requesting_admin_authorization']
    );
    const document = documents.rows.length > 0 ? documents.rows[0] : null;
    if (!document) {
        return {
            isValid: false,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_SIGNATURE_NOT_FOUND_ERROR_CODE
        }
    }
    // validate if the document is older than 30 seconds
    const isOlderThan30Seconds = moment(document?.created_at).isBefore(moment().subtract(REQUEST_TRANSACTION_EXPIRATION_TIME, 'seconds'));
    if (isOlderThan30Seconds) {
        return {
            isValid: false,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_SIGNATURE_EXPIRED_ERROR_CODE
        }
    }

    return {
        isValid: true,
        code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_SUCCESS_CODE
    }
}