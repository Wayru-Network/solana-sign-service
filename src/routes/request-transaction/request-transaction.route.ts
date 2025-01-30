import Router from 'koa-router';
import { Route } from '@/interfaces/api/api';
import { CtxClaimRewards } from '@/interfaces/request-transaction/api';
import { RequestTransactionController } from '@/controllers/request-transaction/request-transaction.controller';
const router = new Router();

const routes: Route[] = [
  {
    method: 'post',
    path: '/to-claim-rewards',
    handler: async (ctx: CtxClaimRewards) => {
      await RequestTransactionController.claimRewards(ctx);
    }
  },
];

// Register all routes automatically
routes.forEach(route => {
  router[route.method](route.path, route.handler);
});

export default router;