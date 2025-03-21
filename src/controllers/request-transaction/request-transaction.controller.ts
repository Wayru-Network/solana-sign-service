import { CtxSignatureInside } from '@/interfaces/request-transaction/api';
import { signatureInsideSchema } from '@/validations/request-transaction/request-transaction.validation';
import { requestTransactionDepositTokens, requestTransactionToClaimReward, requestTransactionToClaimWCredits, requestTransactionToInitializeNfnode, requestTransactionToUpdateHost, requestTransactionWithdrawTokens } from '@services/request-transaction/request-transaction.service';
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
}