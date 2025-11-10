import Router from 'koa-router';
import { Route } from '@/interfaces/api/api';
import { CtxSignatureInside } from '@/interfaces/request-transaction/api';
import { RequestTransactionController } from '@/controllers/request-transaction/request-transaction.controller';
const router = new Router();

const routes: Route[] = [
  {
    method: 'post',
    path: '/to-claim-rewards',
    handler: async (ctx: CtxSignatureInside) => {
      await RequestTransactionController.claimRewards(ctx);
    },
  },
  {
    method: 'post',
    path: '/to-claim-rewards-v2',
    handler: async (ctx: CtxSignatureInside) => {
      await RequestTransactionController.claimRewardsV2(ctx);
    },
  },
  {
    method: 'post',
    path: '/to-claim-depin-staker-rewards',
    handler: async (ctx: CtxSignatureInside) => {
      await RequestTransactionController.claimDepinStakerRewards(ctx);
    },
    config: {
      auth: false // Set to false to make this route public (no authentication required)
    }
  },
  {
    method: 'post',
    path: '/to-initialize-nfnode',
    handler: async (ctx: CtxSignatureInside) => {
      await RequestTransactionController.initializeNfnode(ctx);
    }
  },
  {
    method: 'post',
    path: '/to-initialize-stake',
    handler: async (ctx: CtxSignatureInside) => {
      await RequestTransactionController.initializeStake(ctx);
    }
  },
  {
    method: 'post',
    path: '/to-initialize-stake-v2',
    handler: async (ctx: CtxSignatureInside) => {
      await RequestTransactionController.initializeStakeV2(ctx);
    }
  },
  {
    method: 'post',
    path: '/to-add-host-to-nfnode',
    handler: async (ctx: CtxSignatureInside) => {
      await RequestTransactionController.addHostToNfnode(ctx);
    }
  },
  {
    method: 'post',
    path: '/to-add-host-to-nfnode-v2',
    handler: async (ctx: CtxSignatureInside) => {
      await RequestTransactionController.addHostToNfnodeV2(ctx);
    }
  },
  {
    method: 'post',
    path: '/to-claim-w-credits',
    handler: async (ctx: CtxSignatureInside) => {
      await RequestTransactionController.claimWCredits(ctx);
    }
  },
  {
    method: 'post',
    path: '/to-withdraw-tokens',
    handler: async (ctx: CtxSignatureInside) => {
      await RequestTransactionController.withdrawTokens(ctx);
    }
  },
  {
    method: 'post',
    path: '/to-withdraw-tokens-v2',
    handler: async (ctx: CtxSignatureInside) => {
      await RequestTransactionController.withdrawTokensV2(ctx);
    }
  },
  {
    method: 'post',
    path: '/to-withdraw-staked-tokens',
    handler: async (ctx: CtxSignatureInside) => {
      await RequestTransactionController.withdrawStakedTokens(ctx);
    }
  },
  {
    method: 'post',
    path: '/to-withdraw-staked-tokens-v2',
    handler: async (ctx: CtxSignatureInside) => {
      await RequestTransactionController.withdrawStakedTokensV2(ctx);
    }
  },
  {
    method: 'post',
    path: '/to-deposit-tokens',
    handler: async (ctx: CtxSignatureInside) => {
      await RequestTransactionController.depositTokens(ctx);
    }
  },
  {
    method: 'post',
    path: '/to-deposit-tokens-v2',
    handler: async (ctx: CtxSignatureInside) => {
      await RequestTransactionController.depositTokensV2(ctx);
    }
  },
  {
    method: 'post',
    path: '/to-stake-tokens',
    handler: async (ctx: CtxSignatureInside) => {
      await RequestTransactionController.stakeTokens(ctx);
    }
  },
  {
    method: 'post',
    path: '/to-stake-tokens-v2',
    handler: async (ctx: CtxSignatureInside) => {
      await RequestTransactionController.stakeTokensV2(ctx);
    }
  },
  {
    method: 'post',
    path: '/to-update-reward-contract',
    handler: async (ctx: CtxSignatureInside) => {
      await RequestTransactionController.updateRewardContract(ctx);
    }
  },
  {
    method: 'post',
    path: '/to-initialize-nfnode-v2',
    handler: async (ctx: CtxSignatureInside) => {
      await RequestTransactionController.initializeNfnodeV2(ctx);
    }
  },
];

// Register all routes automatically
routes.forEach(route => {
  router[route.method](route.path, route.handler);
});

// Export routes array for configuration-based registration
export { routes };

export default router;