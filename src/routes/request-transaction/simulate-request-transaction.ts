import Router from 'koa-router';
import { Route } from '@/interfaces/api/api';
import { CtxSimulateInitNfnode, CtxWalletAddress } from '@/interfaces/request-transaction/api';
import { SimulateRequestTxController } from '@/controllers/request-transaction/simulate-request-tx.controller';
const router = new Router();

const routes: Route[] = [
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
  }
];

// Register all routes automatically
routes.forEach(route => {
  router[route.method](route.path, route.handler);
});

export default router;