import { CtxClaimRewards } from '@/interfaces/request-transaction/api';
import { claimRewardsSchema } from '@/validations/request-transaction/request-transaction.validation';
import { requestTransactionToClaimReward } from '@services/request-transaction/request-transaction.service';
import { ValidationError } from 'yup';

export class RequestTransactionController {
  static async claimRewards(ctx: CtxClaimRewards) {
    try {
      // validate request body
      await claimRewardsSchema.validate(ctx.request.body, {
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
          message: 'Error preparing transaction',
          code: response.code
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
        // Para otros tipos de errores
        ctx.status = 500;
        ctx.body = {
          error: true,
          message: 'internal server error'
        };
      }
    }
  }
  // ... add more controllers
} 