import db from "@/config/db";
import { REQUEST_TRANSACTION_EXPIRATION_TIME } from "@constants/request-transaction";
import { REQUEST_TRANSACTION_ERROR_CODES } from "@errors/request-transaction/request-transaction";
import { CifradedSignatureStatus, TransactionTracker, VerifySignatureStatusToClaim } from "@interfaces/request-transaction/transaction-tracker";
import moment from "moment";

export const verifyTransactionTrackerToClaimRewards = async ({ signature, nonce, minerId, claimerType, amountToClaim }: VerifySignatureStatusToClaim) => {

    // validations for signature and rewards id:
    // 1: signature is equal to the signature in the database
    // 2: document status is equal to claiming
    // 3: all rewardsId are linked to the document
    const signatureUsed = await db.query(
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
    const document = signatureUsed?.rows?.length > 0 ? signatureUsed.rows[0] : null
    if (!document) {
        return {
            isValidStatus: false,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_SIGNATURE_NOT_FOUND_ERROR_CODE
        }
    }

    // into tx context has to be the amount to claim, the name is amountToClaim, and has to be equal to the amount in the document
    const amountToClaimDocument = document?.tx_context?.amountToClaim as number;
    const formattedAmountToClaimDocument = Number(amountToClaimDocument).toFixed(2);
    const formattedAmountToClaim = Number(amountToClaim).toFixed(2);
    if (!amountToClaimDocument || !amountToClaim || Number(formattedAmountToClaimDocument) !== Number(formattedAmountToClaim)) {
        return {
            isValidStatus: false,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_AMOUNT_NOT_MATCH_ERROR_CODE
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

    // validations for minerId:
    //1: find rewards_per_epoches that matches the minerId and has the status ready-for-claim
    const rewardsPerEpoch = await db.query(
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
    const documentQuery = await db.query(
        `UPDATE transaction_trackers SET cifraded_signature_status = $1 WHERE id = $2 RETURNING *`,
        [status, nonce]
    );
    const document = documentQuery.rows.length > 0 ? documentQuery.rows[0] : null;
    return document as TransactionTracker | null;
}

export const validateAndUpdateSignatureStatus = async (nonce: number, signature: string) => {
    // Start transaction
    try {
        await db.query('BEGIN');

        // Validate with SELECT FOR UPDATE to lock the row
        const result = await db.query(
            `SELECT * FROM transaction_trackers 
             WHERE id = $1 AND cifraded_signature = $2 AND cifraded_signature_status = $3
             FOR UPDATE`,
            [nonce, signature, 'requesting_admin_authorization']
        );

        if (result.rows.length === 0) {
            await db.query('ROLLBACK');
            return {
                isValid: false,
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_SIGNATURE_NOT_FOUND_ERROR_CODE,
                message: 'Transaction not found'
            };
        }

        const document = result.rows[0];

        // Verify expiration
        if (moment(document.created_at).isBefore(moment().subtract(REQUEST_TRANSACTION_EXPIRATION_TIME, 'seconds'))) {
            // update the status of the transaction
            await updateTransactionTrackerStatus(nonce, 'request_expired');
            return {
                isValid: false,
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_SIGNATURE_EXPIRED_ERROR_CODE,
                message: 'Transaction expired'
            };
        }

        // Update status
        await db.query(
            `UPDATE transaction_trackers 
             SET cifraded_signature_status = $1 
             WHERE id = $2`,
            ['request_authorized_by_admin', nonce]
        );

        await db.query('COMMIT');
        return {
            isValid: true,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_SUCCESS_CODE,
            message: 'Transaction authorized by admin'
        };

    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error validating signature status:', error);
        return {
            isValid: false,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_ERROR_CODE,
            message: 'Error validating signature status'
        };
    }
};