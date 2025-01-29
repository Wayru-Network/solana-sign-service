import Router from 'koa-router';
import { Context } from 'koa';

const router = new Router({
  prefix: '/api/request-transaction'
});

router.get('/', async (ctx: Context) => {
  ctx.body = {
    message: 'Hello, World!'
  };
});

export default router;