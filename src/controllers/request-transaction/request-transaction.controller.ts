import { CtxSignatureInside } from '@/interfaces/request-transaction/api';
import { signatureInsideSchema } from '@/validations/request-transaction/request-transaction.validation';
import { requestTransactionDepositTokens, requestTransactionDepositTokensV2, requestTransactionStakeTokens, requestTransactionStakeTokensV2, requestTransactionToClaimDepinStakerRewards, requestTransactionToClaimReward, requestTransactionToClaimRewardV2, requestTransactionToClaimWCredits, requestTransactionToInitializeNfnode, requestTransactionToInitializeNfnodeV2, requestTransactionToInitializeStakeEntry, requestTransactionToInitializeStakeEntryV2, requestTransactionToUpdateHost, requestTransactionToUpdateHostV2, requestTransactionToUpdateRewardContract, requestTransactionWithdrawStakedTokens, requestTransactionWithdrawStakedTokensV2, requestTransactionWithdrawTokens, requestTransactionWithdrawTokensV2 } from '@services/request-transaction/request-transaction.service';
import { ValidationError } from 'yup';

export class RequestTransactionController {
  static async claimRewards(ctx: CtxSignatureInside) {
    try {
      // validate request body
      await signatureInsideSchema.validate(ctx.request.body, {
        abortEarly: false,
        stripUnknown: true
      });

      const signature = ctx.request.body?.signature as string;
      // prepare transaction
      const response = await requestTransactionToClaimReward(signature);
      if (response.error || !response.serializedTx) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          code: response.code,
          serializedTx: null
        };
      } else {
        ctx.status = 200;
        ctx.body = {
          error: false,
          code: response.code,
          serializedTx: response.serializedTx
        };
      }

    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          message: 'validation error',
          errors: err.errors
        };
      } else {
        // for other types of errors
        ctx.status = 500;
        ctx.body = {
          error: true,
          message: 'internal server error'
        };
      }
    }
  }
  static async claimRewardsV2(ctx: CtxSignatureInside) {
    try {
      // validate request body
      await signatureInsideSchema.validate(ctx.request.body, {
        abortEarly: false,
        stripUnknown: true
      });

      const signature = ctx.request.body?.signature as string;
      // prepare transaction
      const response = await requestTransactionToClaimRewardV2(signature);
      if (response.error || !response.serializedTx) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          code: response.code,
          serializedTx: null
        };
      } else {
        ctx.status = 200;
        ctx.body = {
          error: false,
          code: response.code,
          serializedTx: response.serializedTx
        };
      }

    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          message: 'validation error',
          errors: err.errors
        };
      } else {
        // for other types of errors
        ctx.status = 500;
        ctx.body = {
          error: true,
          message: 'internal server error'
        };
      }
    }
  }
  static async claimDepinStakerRewards(ctx: CtxSignatureInside) {
    try {
      // validate request body
      await signatureInsideSchema.validate(ctx.request.body, {
        abortEarly: false,
        stripUnknown: true
      });

      const signature = ctx.request.body?.signature as string;
      // prepare transaction
      const response = await requestTransactionToClaimDepinStakerRewards(signature);
      if (response.error || !response.serializedTx || !response.serializedInitTx) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          code: response.code,
          serializedTx: null,
          serializedInitTx: null
        };
      } else {
        ctx.status = 200;
        ctx.body = {
          error: false,
          code: response.code,
          serializedTx: response.serializedTx,
          serializedInitTx: response.serializedInitTx
        };
      }

    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          message: 'validation error',
          errors: err.errors
        };
      } else {
        // for other types of errors
        ctx.status = 500;
        ctx.body = {
          error: true,
          message: 'internal server error'
        };
      }
    }
  }
  static async initializeNfnode(ctx: CtxSignatureInside) {
    try {
      // validate request body
      await signatureInsideSchema.validate(ctx.request.body, {
        abortEarly: false,
        stripUnknown: true
      });

      const signature = ctx.request.body?.signature as string;
      // prepare transaction
      const response = await requestTransactionToInitializeNfnode(signature);
      if (response.error || !response.serializedTx) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          code: response.code,
          serializedTx: response.serializedTx
        };
      } else {
        ctx.status = 200;
        ctx.body = {
          error: false,
          code: response.code,
          serializedTx: response.serializedTx
        };
      }

    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          message: 'validation error',
          errors: err.errors
        };
      } else {
        // for other types of errors
        ctx.status = 500;
        ctx.body = {
          error: true,
          message: 'internal server error'
        };
      }
    }
  }
  static async initializeNfnodeV2(ctx: CtxSignatureInside) {
    try {
      // validate request body
      await signatureInsideSchema.validate(ctx.request.body, {
        abortEarly: false,
        stripUnknown: true
      });

      const signature = ctx.request.body?.signature as string;
      // prepare transaction
      const response = await requestTransactionToInitializeNfnodeV2(signature);
      if (response.error || !response.serializedTx) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          code: response.code,
          serializedTx: response.serializedTx
        };
      } else {
        ctx.status = 200;
        ctx.body = {
          error: false,
          code: response.code,
          serializedTx: response.serializedTx
        };
      }

    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          message: 'validation error',
          errors: err.errors
        };
      } else {
        // for other types of errors
        ctx.status = 500;
        ctx.body = {
          error: true,
          message: 'internal server error'
        };
      }
    }
  }
  static async initializeStake(ctx: CtxSignatureInside) {
    try {
      // validate request body
      await signatureInsideSchema.validate(ctx.request.body, {
        abortEarly: false,
        stripUnknown: true
      });

      const signature = ctx.request.body?.signature as string;
      // prepare transaction
      const response = await requestTransactionToInitializeStakeEntry(signature);
      if (response.error || !response.serializedTx) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          code: response.code,
          serializedTx: response.serializedTx
        };
      } else {
        ctx.status = 200;
        ctx.body = {
          error: false,
          code: response.code,
          serializedTx: response.serializedTx
        };
      }

    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          message: 'validation error',
          errors: err.errors
        };
      } else {
        // for other types of errors
        ctx.status = 500;
        ctx.body = {
          error: true,
          message: 'internal server error'
        };
      }
    }
  }
  static async initializeStakeV2(ctx: CtxSignatureInside) {
    try {
      // validate request body
      await signatureInsideSchema.validate(ctx.request.body, {
        abortEarly: false,
        stripUnknown: true
      });

      const signature = ctx.request.body?.signature as string;
      // prepare transaction
      const response = await requestTransactionToInitializeStakeEntryV2(signature);
      if (response.error || !response.serializedTx) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          code: response.code,
          serializedTx: response.serializedTx
        };
      } else {
        ctx.status = 200;
        ctx.body = {
          error: false,
          code: response.code,
          serializedTx: response.serializedTx
        };
      }

    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          message: 'validation error',
          errors: err.errors
        };
      } else {
        // for other types of errors
        ctx.status = 500;
        ctx.body = {
          error: true,
          message: 'internal server error'
        };
      }
    }
  }
  static async addHostToNfnode(ctx: CtxSignatureInside) {
    try {
      // validate request body
      await signatureInsideSchema.validate(ctx.request.body, {
        abortEarly: false,
        stripUnknown: true
      });

      const signature = ctx.request.body?.signature as string;
      // prepare transaction
      const response = await requestTransactionToUpdateHost(signature);
      if (response.error || !response.serializedTx) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          code: response.code,
          serializedTx: response.serializedTx
        };
      } else {
        ctx.status = 200;
        ctx.body = {
          error: false,
          code: response.code,
          serializedTx: response.serializedTx
        };
      }

    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          message: 'validation error',
          errors: err.errors
        };
      } else {
        // for other types of errors
        ctx.status = 500;
        ctx.body = {
          error: true,
          message: 'internal server error'
        };
      }
    }
  }
  static async addHostToNfnodeV2(ctx: CtxSignatureInside) {
    try {
      // validate request body
      await signatureInsideSchema.validate(ctx.request.body, {
        abortEarly: false,
        stripUnknown: true
      });

      const signature = ctx.request.body?.signature as string;
      // prepare transaction
      const response = await requestTransactionToUpdateHostV2(signature);
      if (response.error || !response.serializedTx) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          code: response.code,
          serializedTx: response.serializedTx
        };
      } else {
        ctx.status = 200;
        ctx.body = {
          error: false,
          code: response.code,
          serializedTx: response.serializedTx
        };
      }

    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          message: 'validation error',
          errors: err.errors
        };
      } else {
        // for other types of errors
        ctx.status = 500;
        ctx.body = {
          error: true,
          message: 'internal server error'
        };
      }
    }
  }
  static async claimWCredits(ctx: CtxSignatureInside) {
    try {
      // validate request body
      await signatureInsideSchema.validate(ctx.request.body, {
        abortEarly: false,
        stripUnknown: true
      });

      const signature = ctx.request.body?.signature as string;
      // prepare transaction
      const response = await requestTransactionToClaimWCredits(signature);
      if (response.error || !response.serializedTx) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          code: response.code,
          serializedTx: response.serializedTx
        };
      } else {
        ctx.status = 200;
        ctx.body = {
          error: false,
          code: response.code,
          serializedTx: response.serializedTx
        };
      }
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          message: 'validation error',
          errors: err.errors,
          code: 'CWC-001'
        };
      } else {
        // for other types of errors
        ctx.status = 500;
        ctx.body = {
          error: true,
          message: 'internal server error',
          code: 'CWC-002'
        };
      }
    }
  }
  static async withdrawTokens(ctx: CtxSignatureInside) {
    try {
      // validate request body
      await signatureInsideSchema.validate(ctx.request.body, {
        abortEarly: false,
        stripUnknown: true
      });

      const signature = ctx.request.body?.signature as string;
      // prepare transaction
      const response = await requestTransactionWithdrawTokens(signature);
      if (response.error || !response.serializedTx) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          code: response.code,
          serializedTx: response.serializedTx
        };
      } else {
        ctx.status = 200;
        ctx.body = {
          error: false,
          code: response.code,
          serializedTx: response.serializedTx
        };
      }
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          message: 'validation error',
          errors: err.errors,
          code: 'WT-001'
        };
      } else {
        // for other types of errors
        ctx.status = 500;
        ctx.body = {
          error: true,
          message: 'internal server error',
          code: 'WT-002'
        };
      }
    }
  }
  static async withdrawTokensV2(ctx: CtxSignatureInside) {
    try {
      // validate request body
      await signatureInsideSchema.validate(ctx.request.body, {
        abortEarly: false,
        stripUnknown: true
      });

      const signature = ctx.request.body?.signature as string;
      // prepare transaction
      const response = await requestTransactionWithdrawTokensV2(signature);
      if (response.error || !response.serializedTx) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          code: response.code,
          serializedTx: response.serializedTx
        };
      } else {
        ctx.status = 200;
        ctx.body = {
          error: false,
          code: response.code,
          serializedTx: response.serializedTx
        };
      }
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          message: 'validation error',
          errors: err.errors,
          code: 'WT-001'
        };
      } else {
        // for other types of errors
        ctx.status = 500;
        ctx.body = {
          error: true,
          message: 'internal server error',
          code: 'WT-002'
        };
      }
    }
  }
  static async withdrawStakedTokens(ctx: CtxSignatureInside) {
    try {
      // validate request body
      await signatureInsideSchema.validate(ctx.request.body, {
        abortEarly: false,
        stripUnknown: true
      });

      const signature = ctx.request.body?.signature as string;
      // prepare transaction
      const response = await requestTransactionWithdrawStakedTokens(signature);
      if (response.error || !response.serializedTx) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          code: response.code,
          serializedTx: response.serializedTx
        };
      } else {
        ctx.status = 200;
        ctx.body = {
          error: false,
          code: response.code,
          serializedTx: response.serializedTx
        };
      }
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          message: 'validation error',
          errors: err.errors,
          code: 'WT-001'
        };
      } else {
        // for other types of errors
        ctx.status = 500;
        ctx.body = {
          error: true,
          message: 'internal server error',
          code: 'WT-002'
        };
      }
    }
  }
  static async withdrawStakedTokensV2(ctx: CtxSignatureInside) {
    try {
      // validate request body
      await signatureInsideSchema.validate(ctx.request.body, {
        abortEarly: false,
        stripUnknown: true
      });

      const signature = ctx.request.body?.signature as string;
      // prepare transaction
      const response = await requestTransactionWithdrawStakedTokensV2(signature);
      if (response.error || !response.serializedTx) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          code: response.code,
          serializedTx: response.serializedTx
        };
      } else {
        ctx.status = 200;
        ctx.body = {
          error: false,
          code: response.code,
          serializedTx: response.serializedTx
        };
      }
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          message: 'validation error',
          errors: err.errors,
          code: 'WT-001'
        };
      } else {
        // for other types of errors
        ctx.status = 500;
        ctx.body = {
          error: true,
          message: 'internal server error',
          code: 'WT-002'
        };
      }
    }
  }
  static async depositTokens(ctx: CtxSignatureInside) {
    try {
      // validate request body
      await signatureInsideSchema.validate(ctx.request.body, {
        abortEarly: false,
        stripUnknown: true
      });

      const signature = ctx.request.body?.signature as string;
      // prepare transaction
      const response = await requestTransactionDepositTokens(signature);
      if (response.error || !response.serializedTx) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          code: response.code,
          serializedTx: response.serializedTx
        };
      } else {
        ctx.status = 200;
        ctx.body = {
          error: false,
          code: response.code,
          serializedTx: response.serializedTx
        };
      }
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          message: 'validation error',
          errors: err.errors,
          code: 'DT-001'
        };
      } else {
        // for other types of errors
        ctx.status = 500;
        ctx.body = {
          error: true,
          message: 'internal server error',
          code: 'DT-002'
        };
      }
    }
  }
  static async depositTokensV2(ctx: CtxSignatureInside) {
    try {
      // validate request body
      await signatureInsideSchema.validate(ctx.request.body, {
        abortEarly: false,
        stripUnknown: true
      });

      const signature = ctx.request.body?.signature as string;
      // prepare transaction
      const response = await requestTransactionDepositTokensV2(signature);
      if (response.error || !response.serializedTx) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          code: response.code,
          serializedTx: response.serializedTx
        };
      } else {
        ctx.status = 200;
        ctx.body = {
          error: false,
          code: response.code,
          serializedTx: response.serializedTx
        };
      }
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          message: 'validation error',
          errors: err.errors,
          code: 'DT-001'
        };
      } else {
        // for other types of errors
        ctx.status = 500;
        ctx.body = {
          error: true,
          message: 'internal server error',
          code: 'DT-002'
        };
      }
    }
  }
  static async stakeTokens(ctx: CtxSignatureInside) {
    try {
      // validate request body
      await signatureInsideSchema.validate(ctx.request.body, {
        abortEarly: false,
        stripUnknown: true
      });

      const signature = ctx.request.body?.signature as string;
      // prepare transaction
      const response = await requestTransactionStakeTokens(signature);
      if (response.error || !response.serializedTx) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          code: response.code,
          serializedTx: response.serializedTx
        };
      } else {
        ctx.status = 200;
        ctx.body = {
          error: false,
          code: response.code,
          serializedTx: response.serializedTx
        };
      }
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          message: 'validation error',
          errors: err.errors,
          code: 'ST-001'
        };
      } else {
        // for other types of errors
        ctx.status = 500;
        ctx.body = {
          error: true,
          message: 'internal server error',
          code: 'ST-002'
        };
      }
    }
  }
  static async stakeTokensV2(ctx: CtxSignatureInside) {
    try {
      // validate request body
      await signatureInsideSchema.validate(ctx.request.body, {
        abortEarly: false,
        stripUnknown: true
      });

      const signature = ctx.request.body?.signature as string;
      // prepare transaction
      const response = await requestTransactionStakeTokensV2(signature);
      if (response.error || !response.serializedTx) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          code: response.code,
          serializedTx: response.serializedTx
        };
      } else {
        ctx.status = 200;
        ctx.body = {
          error: false,
          code: response.code,
          serializedTx: response.serializedTx
        };
      }
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          message: 'validation error',
          errors: err.errors,
          code: 'ST-001'
        };
      } else {
        // for other types of errors
        ctx.status = 500;
        ctx.body = {
          error: true,
          message: 'internal server error',
          code: 'ST-002'
        };
      }
    }
  }
  static async updateRewardContract(ctx: CtxSignatureInside) {
    try {
      // validate request body
      await signatureInsideSchema.validate(ctx.request.body, {
        abortEarly: false,
        stripUnknown: true
      });

      const signature = ctx.request.body?.signature as string;
      // prepare transaction
      const response = await requestTransactionToUpdateRewardContract(signature);
      if (response.error) {
        ctx.status = 400;
        ctx.body = response
      } else {
        ctx.status = 200;
        ctx.body = response;
      }
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        ctx.status = 400;
        ctx.body = {
          error: true,
          message: 'validation error',
          errors: err.errors,
          code: 'URC-001'
        };
      } else {
        // for other types of errors
        ctx.status = 500;
        ctx.body = {
          error: true,
          message: 'internal server error',
          code: 'URC-002'
        };
      }
    }
  }
}