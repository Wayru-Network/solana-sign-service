import { Context, Next } from 'koa';
import jwt from 'jsonwebtoken';
import { ENV } from '@/config/env/env';
import { getUserById } from '@services/user/user-queries';

export async function errorHandler(ctx: Context, next: Next) {
  try {
    await next();
  } catch (err: any) {
    ctx.status = err.status || 500;
    ctx.body = {
      error: true,
      message: err.message || 'Internal server error',
    };

    // Emit error for logging
    ctx.app.emit('error', err, ctx);
  }
}

// Optional: Authentication validation middleware
export async function authValidator(ctx: Context, next: Next) {
  const token = ctx.headers.authorization;

  if (!token) {
    ctx.response.status = 401;
    ctx.response.body = {
      error: true,
      message: 'Unauthorized'
    };
    return;
  }
 
  try {
    // replace bearer from token
    const jwtToken = token.replace('Bearer ', '');
    // verify and decode token
    const decoded = jwt.verify(jwtToken, ENV.JWT_SECRET as string) as { id: number, iat: number, exp: number };
    // check if token is expired
    if (decoded.exp < Date.now() / 1000) {
      console.log('token expired');
      ctx.response.status = 401;
      ctx.response.body = {
        error: true,
        message: 'Unauthorized'
      };
      return;
    }

    // attach user information to context state
    const user = await getUserById(decoded.id);
    if (!user) {
      console.log('user not found');
      ctx.response.status = 401;
      ctx.response.body = {
        error: true,
        message: 'Unauthorized'
      };
      return;
    }
    ctx.state.user = user;
    await next();
  } catch (error) {
    console.log('error', error);
    ctx.response.status = 401;
    ctx.response.body = { 
      error: true,
      message: 'Unauthorized'
    };
    return;
  }
}