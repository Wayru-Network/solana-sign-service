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
    path: '/to-add-host-to-nfnode',
    handler: async (ctx: CtxSignatureInside) => {
      await RequestTransactionController.addHostToNfnode(ctx);
    }
  },
  {
    method: 'post',
    path: '/to-claim-w-credits',
    handler: async (ctx: CtxSignatureInside) => {
      await RequestTransactionController.claimWCredits(ctx);
    }
  }
];

// Register all routes automatically
routes.forEach(route => {
  router[route.method](route.path, route.handler);
});

export default router;