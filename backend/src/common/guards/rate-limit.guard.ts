import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

const DEFAULT = { max: 10, minutes: 10 };
const RATE_LIMIT_KEY = 'rateLimit';

/** Overrides the limit for one route: at most `max` requests per IP every `minutes`. */
export const RateLimit = (max: number, minutes = 10) => SetMetadata(RATE_LIMIT_KEY, { max, minutes });

/**
 * The visitor's address. In production every request passes Cloudflare (in
 * front of Render), which sets CF-Connecting-IP itself and overwrites any value
 * the client sends. X-Forwarded-For is NOT used: Render keeps whatever the
 * client put there, so it can be forged to dodge the limit.
 */
export function clientIp(req: Request) {
  const header = (name: string) => {
    const v = req.headers[name];
    return (Array.isArray(v) ? v[0] : v)?.trim();
  };
  return header('cf-connecting-ip') || header('true-client-ip') || req.socket?.remoteAddress || 'unknown';
}

/**
 * Slows down password guessing, e-mail flooding and spam on public forms:
 * each IP gets a number of requests per route in a time window, then 429.
 * Kept in memory (one server instance), so a restart resets the counts.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const { max, minutes } =
      this.reflector.getAllAndOverride<{ max: number; minutes: number }>(RATE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT;
    const windowMs = minutes * 60 * 1000;
    const key = `${clientIp(req)}|${req.method} ${req.route?.path ?? req.path}`;
    const now = Date.now();

    const recent = (this.hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      throw new HttpException(
        { message: `ძალიან ბევრი მცდელობა — სცადე ${minutes} წუთში`, code: 'TOO_MANY_ATTEMPTS' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.hits.set(key, recent);

    // Drop stale entries now and then so the map doesn't grow forever.
    if (this.hits.size > 5000) {
      for (const [k, list] of this.hits) if (!list.some((t) => now - t < 60 * 60 * 1000)) this.hits.delete(k);
    }
    return true;
  }
}
