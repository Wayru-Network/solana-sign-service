import Router from 'koa-router';
import { Route } from '@/interfaces/api/api';
import { CtxSimulateClaimReward, CtxSimulateInitNfnode, CtxSimulateInitStake, CtxSimulateUnstake, CtxWalletAddress } from '@/interfaces/request-transaction/api';
import { SimulateRequestTxController } from '@/controllers/request-transaction/simulate-request-tx.controller';
const router = new Router();

const routes: Route[] = [
  {
    method: 'post',
    path: '/simulate-upgrade-reward-contract',
    handler: async (ctx: CtxSimulateInitNfnode) => {
      await SimulateRequestTxController.simulateUpdateRewardContract(ctx);
    }
  },
  {
    method: 'post',
    path: '/simulate-claim-w-credits',
    handler: async (ctx: CtxWalletAddress) => {
      await SimulateRequestTxController.simulateClaimWCredits(ctx);
    }
  },
  {
    method: 'post',
    path: '/simulate-initialize-nfnode',
    handler: async (ctx: CtxSimulateInitNfnode) => {
      await SimulateRequestTxController.simulateInitializeNfnode(ctx);
    }
  },
  {
    method: 'post',
    path: '/simulate-initialize-stake',
    handler: async (ctx: CtxSimulateInitStake) => {
      await SimulateRequestTxController.simulateInitializeStake(ctx);
    }
  },
  {
    method: 'post',
    path: '/simulate-stake',
    handler: async (ctx: CtxSimulateInitStake) => {
      await SimulateRequestTxController.simulateStake(ctx);
    }
  },
  {
    method: 'post',
    path: '/simulate-unstake',
    handler: async (ctx: CtxSimulateUnstake) => {
      await SimulateRequestTxController.simulateUnstake(ctx);
    }
  }
  ,
  {
    method: 'post',
    path: '/simulate-claim-reward',
    handler: async (ctx: CtxSimulateClaimReward) => {
      await SimulateRequestTxController.simulateClaimReward(ctx);
    }
  }
];

// Register all routes automatically
routes.forEach(route => {
  router[route.method](route.path, route.handler);
});

export default router;