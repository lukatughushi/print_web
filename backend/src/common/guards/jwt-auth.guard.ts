import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // WebSocket messages are authenticated on connect by EventsGateway.
    if (context.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isPublic) return super.canActivate(context);
    // Public routes still see who is signed in, when a valid token comes along.
    return this.optional(context);
  }

  private async optional(context: ExecutionContext) {
    const { headers } = context.switchToHttp().getRequest();
    if (!headers?.authorization) return true;
    try {
      await super.canActivate(context);
    } catch {
      // An expired or bad token on a public route: carry on as a guest.
    }
    return true;
  }
}
