import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

/**
 * Slows down password guessing and e-mail flooding on the sign-in routes:
 * each IP gets MAX_ATTEMPTS requests per route every WINDOW_MS, then 429.
 * Kept in memory (one server instance), so a restart resets the counts.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, number[]>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    // Render's proxy appends the real client address last; earlier entries
    // can be sent by the client itself, so they aren't trusted.
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').pop()?.trim();
    const ip = forwarded || req.ip || 'unknown';
    const key = `${ip}|${req.path}`;
    const now = Date.now();

    const recent = (this.hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= MAX_ATTEMPTS) {
      throw new HttpException(
        { message: 'ძალიან ბევრი მცდელობა — სცადე 10 წუთში', code: 'TOO_MANY_ATTEMPTS' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.hits.set(key, recent);

    // Drop stale entries now and then so the map doesn't grow forever.
    if (this.hits.size > 5000) {
      for (const [k, list] of this.hits) if (!list.some((t) => now - t < WINDOW_MS)) this.hits.delete(k);
    }
    return true;
  }
}
