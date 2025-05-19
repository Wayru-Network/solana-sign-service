import { CtxSignatureInside } from '@/interfaces/request-transaction/api';
import { signatureInsideSchema } from '@/validations/request-transaction/request-transaction.validation';
import { requestTransactionDepositTokens, requestTransactionStakeTokens, requestTransactionToClaimReward, requestTransactionToClaimWCredits, requestTransactionToInitializeNfnode, requestTransactionToInitializeStakeEntry, requestTransactionToUpdateHost, requestTransactionToUpdateRewardContract, requestTransactionWithdrawStakedTokens, requestTransactionWithdrawTokens } from '@services/request-transaction/request-transaction.service';
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