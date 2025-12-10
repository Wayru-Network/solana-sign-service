import db from "@/config/db";
import { REQUEST_TRANSACTION_EXPIRATION_TIME } from "@constants/request-transaction";
import { REQUEST_TRANSACTION_ERROR_CODES } from "@errors/request-transaction/request-transaction";
import { CifradedSignatureStatus, TransactionTracker, VerifySignatureStatusToClaim } from "@interfaces/request-transaction/transaction-tracker";
import moment from "moment";
import { Transaction } from "@solana/web3.js";
import { verifyTransactionHash } from "@helpers/request-transaction/request-transaction.helper";
import { RewardSystemManager } from "@services/solana/contracts/reward-system.manager";
import { BN } from "bn.js";

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

export const updateTransactionTrackerStatus = async (nonce: number, status: CifradedSignatureStatus, expectedHash?: string) => {
    if (!nonce) {
        return null;
    }
    const documentQuery = await db.query(
        `UPDATE transaction_trackers SET cifraded_signature_status = $1, expected_hash = $3 WHERE id = $2 RETURNING *`,
        [status, nonce, expectedHash ?? null]
    );
    const document = documentQuery.rows.length > 0 ? documentQuery.rows[0] : null;
    return document as TransactionTracker | null;
}

/**
 * Verifies that a user-signed transaction matches the expected hash stored in the database
 * This ensures that the transaction returned by the user is the same one originally created by the backend
 * 
 * @param {string} signature - The signature of the transaction
 * @param {number} nonce - The transaction tracker ID (nonce)
 * @returns {Promise<{ isValid: boolean, code?: string, message?: string }>} - Verification result
 */
export const verifyTransactionHashFromDb = async (
    serializedTransaction: string,
    nonce: number
): Promise<{ isValid: boolean, code?: string, message?: string }> => {
    try {
        if (!nonce) {
            return {
                isValid: false,
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_SIGNATURE_NOT_FOUND_ERROR_CODE,
                message: 'Nonce is required'
            };
        }

        // Get the expected hash and tx_context from the database
        const result = await db.query(
            `SELECT expected_hash, cifraded_signature_status, tx_context 
             FROM transaction_trackers 
             WHERE id = $1`,
            [nonce]
        );

        if (result.rows.length === 0) {
            return {
                isValid: false,
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_SIGNATURE_NOT_FOUND_ERROR_CODE,
                message: 'Transaction tracker not found'
            };
        }

        const document = result.rows[0];
        const expectedHash = document.expected_hash;
        const txContext = document.tx_context || {};

        if (!expectedHash) {
            return {
                isValid: false,
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_ERROR_CODE,
                message: 'Expected hash not found in database. Transaction may not have been created properly.'
            };
        }

        // Deserialize the transaction from base64
        let transaction: Transaction;
        try {
            transaction = Transaction.from(Buffer.from(serializedTransaction, 'base64'));
        } catch (error) {
            console.error('Error deserializing transaction:', error);
            return {
                isValid: false,
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_INVALID_DATA_ERROR_CODE,
                message: 'Invalid transaction format'
            };
        }

        // Verify the hash
        const isValid = verifyTransactionHash(transaction, expectedHash);

        if (!isValid) {
            return {
                isValid: false,
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_ERROR_CODE,
                message: 'Transaction hash does not match. The transaction may have been modified.'
            };
        }

        // Verify the amountToClaim from the instruction matches tx_context
        const amountToClaimFromDb = txContext.amountToClaim as number | undefined;
        if (amountToClaimFromDb !== undefined) {
            try {
                // Get the program instance to get the program ID
                const program = await RewardSystemManager.getInstance();
                const programId = program.programId;

                // Find the ownerClaimRewards instruction
                // The discriminator for ownerClaimRewards is [11, 92, 226, 213, 71, 223, 171, 241]
                const ownerClaimRewardsDiscriminator = new Uint8Array([11, 92, 226, 213, 71, 223, 171, 241]);

                let claimRewardsInstruction = null;
                for (const ix of transaction.instructions) {
                    // Check if this instruction belongs to our program
                    if (ix.programId.equals(programId)) {
                        // Check if the discriminator matches ownerClaimRewards
                        const instructionDiscriminator = new Uint8Array(ix.data.slice(0, 8));
                        if (ix.data.length >= 8 &&
                            instructionDiscriminator.every((val, idx) => val === ownerClaimRewardsDiscriminator[idx])) {
                            claimRewardsInstruction = ix;
                            break;
                        }
                    }
                }

                if (claimRewardsInstruction && claimRewardsInstruction.data.length >= 24) {
                    // The instruction data structure is:
                    // - 8 bytes: discriminator
                    // - 8 bytes: rewardAmount (u64, little-endian)
                    // - 8 bytes: nonce (u64, little-endian)

                    // Extract rewardAmount (bytes 8-16)
                    const rewardAmountBuffer = claimRewardsInstruction.data.slice(8, 16);
                    const rewardAmountBN = new BN(rewardAmountBuffer, 'le');
                    const rewardAmountNumber = rewardAmountBN.toNumber();

                    // The amount in DB is stored in human-readable format (e.g., 1.5)
                    // The amount in the transaction is in token units (with decimals)
                    // We need to convert from token units to human-readable format
                    // convertToTokenAmount uses 6 decimals by default, so divide by 1e6
                    const rewardAmountHumanReadable = rewardAmountNumber / 1e6;

                    // Compare with the amount from DB (format both to 2 decimal places for comparison)
                    const formattedAmountFromDb = Number(amountToClaimFromDb).toFixed(2);
                    const formattedAmountFromTx = rewardAmountHumanReadable.toFixed(2);
                    console.log("formattedAmountFromDb", formattedAmountFromDb);
                    console.log("formattedAmountFromTx", formattedAmountFromTx);

                    if (Number(formattedAmountFromDb) !== Number(formattedAmountFromTx)) {
                        return {
                            isValid: false,
                            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_AMOUNT_NOT_MATCH_ERROR_CODE,
                            message: `Transaction amount mismatch. Expected: ${amountToClaimFromDb}, Found: ${rewardAmountHumanReadable}`
                        };
                    }
                } else {
                    console.warn('Could not find ownerClaimRewards instruction in transaction');
                }
            } catch (error) {
                console.error('Error verifying transaction amount:', error);
                // Don't fail the verification if we can't decode the instruction
                // The hash verification is the primary security check
            }
        }

        return {
            isValid: true,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_SUCCESS_CODE,
            message: 'Transaction hash verified successfully'
        };
    } catch (error) {
        console.error('Error verifying transaction hash from database:', error);
        return {
            isValid: false,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_CLAIM_REWARD_ERROR_CODE,
            message: 'Error verifying transaction hash'
        };
    }
}

export const validateAndUpdateSignatureStatus = async (
    nonce: number,
    signature: string,
    disabledValidateExpiration: boolean = false
) => {
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
        if (!disabledValidateExpiration && moment(document.created_at).isBefore(moment().subtract(REQUEST_TRANSACTION_EXPIRATION_TIME, 'seconds'))) {
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

export const verifyTxTrackerToClaimDepinStakerRewards = async ({ signature, nonce, minerId, amountToClaim }: VerifySignatureStatusToClaim) => {
    // validations for signature and rewards id:
    // 1: signature is equal to the signature in the database
    // 2: document status is equal to claiming
    // 3: all rewardsId are linked to the document
    const signatureUsed = await db.query(
        `SELECT tt.*,
            ARRAY(
                SELECT depin_stake_reward_id::text 
                FROM transaction_trackers_depin_stakes_rewards_links
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
    //1: find depin_stakes_rewards that matches the minerId and has the status claiming
    const depinStakeRewards = await db.query(
        `SELECT dsr.* 
         FROM depin_stakes_rewards dsr
         INNER JOIN depin_stakes_rewards_nfnode_links dsrnl 
            ON dsr.id = dsrnl.depin_stake_reward_id
         WHERE dsrnl.nfnode_id = $1 
            AND dsr.status = $2`,
        [minerId, 'claiming']
    );
    if (depinStakeRewards?.rows?.length === 0) {
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

export const updateTransactionTracker = async (id: number, payload: Partial<TransactionTracker>) => {
    try {
        const documentQuery = await db.query(
            `UPDATE transaction_trackers SET $1 WHERE id = $2 RETURNING *`,
            [JSON.stringify(payload), id]
        );
        const document = documentQuery.rows.length > 0 ? documentQuery.rows[0] : null;
        return document as TransactionTracker | null;
    } catch (error) {
        console.error('Error updating transaction tracker:', error);
        return null;
    }
}