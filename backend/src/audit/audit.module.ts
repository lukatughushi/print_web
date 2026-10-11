import {
  CallHandler,
  Controller,
  ExecutionContext,
  Get,
  Global,
  Injectable,
  Logger,
  Module,
  NestInterceptor,
  Query,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { InjectModel, MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Request, Response } from 'express';
import { Model } from 'mongoose';
import { Observable, catchError, tap, throwError } from 'rxjs';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { Roles } from '../common/decorators/roles.decorator';
import { pageParams } from '../common/pagination';
import { Role } from '../users/schemas/user.schema';

/* ── Schema ─────────────────────────────────────────────── */

const RETENTION_DAYS = 180;

/** One logged change or sign-in attempt (admin "ჟურნალი" page). */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, versionKey: false, toJSON: { virtuals: true } })
export class AuditLog {
  /** e.g. 'auth.login', 'order.update' — see ACTIONS below. */
  @Prop({ required: true, index: true }) action: string;
  @Prop({ required: true }) method: string;
  @Prop({ required: true }) path: string;
  @Prop({ required: true }) status: number;
  @Prop({ required: true, index: true }) ok: boolean;

  @Prop() actorId?: string;
  @Prop({ index: true }) actorEmail?: string;
  @Prop() actorRole?: string;

  /** Id of the record the action was about (order, product…). */
  @Prop() targetId?: string;
  /** Small, sanitised summary of what was sent (never passwords or files). */
  @Prop({ type: Object }) details?: Record<string, unknown>;
  @Prop() error?: string;

  @Prop() ip?: string;
  @Prop() userAgent?: string;

  createdAt?: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 3600 });

/* ── What gets logged ───────────────────────────────────── */

// "METHOD /route/pattern" → action key. Unlisted mutating routes are logged
// as 'other'; GET requests are never logged.
const ACTIONS: Record<string, string> = {
  'POST /api/auth/login': 'auth.login',
  'POST /api/auth/register': 'auth.register',
  'POST /api/orders': 'order.create',
  'PATCH /api/orders/:id': 'order.update',
  'POST /api/products': 'product.create',
  'PATCH /api/products/:id': 'product.update',
  'DELETE /api/products/:id': 'product.delete',
  'PATCH /api/settings': 'settings.update',
  'POST /api/quotes': 'quote.create',
  'PATCH /api/quotes/:id': 'quote.update',
  'PATCH /api/admin/users/:id/role': 'user.role',
  'POST /api/files': 'file.upload',
  'DELETE /api/files/:id': 'file.delete',
  'PATCH /api/me/profile': 'account.profile',
  'POST /api/me/password': 'account.password',
  'PUT /api/me/favorites': 'account.favorites',
  'POST /api/me/media': 'media.upload',
  'DELETE /api/me/media/:id': 'media.delete',
  'POST /api/me/designs': 'design.create',
  'PUT /api/me/designs/:id': 'design.update',
  'PATCH /api/me/designs/:id': 'design.rename',
  'DELETE /api/me/designs/:id': 'design.delete',
};

// Never stored: secrets and bulky payloads.
const DROP = new Set(['password', 'logo', 'printUrl', 'previewUrl', 'canvasJson', 'design', 'accessToken', 'data', 'dataUrl', 'preview', 'currentPassword', 'newPassword']);

function sanitize(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.startsWith('data:')) return '[file]';
    return value.length > 200 ? `${value.slice(0, 200)}…` : value;
  }
  if (Array.isArray(value)) {
    if (depth >= 2) return `[${value.length}]`;
    return value.slice(0, 10).map((v) => sanitize(v, depth + 1));
  }
  if (typeof value === 'object') {
    if (depth >= 2) return '{…}';
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!DROP.has(k)) out[k] = sanitize(v, depth + 1);
    }
    return out;
  }
  return undefined;
}

function clientIp(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || req.socket?.remoteAddress || undefined;
}

/* ── Service ────────────────────────────────────────────── */

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@InjectModel(AuditLog.name) private readonly logModel: Model<AuditLog>) {}

  /** Fire-and-forget: a logging failure must never break the request. */
  record(entry: Partial<AuditLog>) {
    this.logModel.create(entry).catch((err) => this.logger.warn(`Audit log failed: ${err.message}`));
  }

  async list(query: { action?: string; q?: string; failed?: string; page?: string; pageSize?: string }) {
    const filter: Record<string, unknown> = {};
    if (query.action) {
      // 'order' matches 'order.create' and 'order.update'.
      filter.action = query.action.includes('.') ? query.action : new RegExp(`^${query.action.replace(/\W/g, '')}\\.`);
    }
    if (query.failed === '1') filter.ok = false;
    if (query.q?.trim()) {
      const rx = new RegExp(query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ actorEmail: rx }, { ip: rx }, { targetId: rx }, { 'details.email': rx }];
    }
    const { page, pageSize } = pageParams(query);
    const [items, total] = await Promise.all([
      this.logModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).exec(),
      this.logModel.countDocuments(filter).exec(),
    ]);
    return { items, total, page, pageSize };
  }
}

/* ── Interceptor: logs every mutating request ───────────── */

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: AuthUser }>();
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return next.handle();

    const route = (req.route?.path as string | undefined) ?? req.path;
    const action = ACTIONS[`${req.method} ${route}`] ?? 'other';
    const base = {
      action,
      method: req.method,
      path: req.originalUrl.split('?')[0].slice(0, 200),
      ip: clientIp(req),
      userAgent: String(req.headers['user-agent'] ?? '').slice(0, 200),
      details: sanitize(req.body) as Record<string, unknown> | undefined,
      targetId: typeof req.params?.id === 'string' ? req.params.id : undefined,
      actorId: req.user?.id,
      actorEmail: req.user?.email ?? (typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : undefined),
      actorRole: req.user?.role,
    };

    return next.handle().pipe(
      tap((data: unknown) => {
        const res = http.getResponse<Response>();
        const body = data as { id?: string; user?: { id?: string; email?: string; role?: string } } | undefined;
        this.audit.record({
          ...base,
          status: res.statusCode,
          ok: true,
          // Sign-in/registration: the user is only known from the response.
          actorId: base.actorId ?? body?.user?.id,
          actorEmail: base.actorEmail ?? body?.user?.email,
          actorRole: base.actorRole ?? body?.user?.role,
          targetId: base.targetId ?? (typeof body?.id === 'string' ? body.id : undefined),
        });
      }),
      catchError((err: { status?: number; getStatus?: () => number; message?: string }) => {
        const status = err?.getStatus?.() ?? err?.status ?? 500;
        this.audit.record({ ...base, status, ok: false, error: String(err?.message ?? 'Error').slice(0, 300) });
        return throwError(() => err);
      }),
    );
  }
}

/* ── Admin route ────────────────────────────────────────── */

@Roles(Role.Admin)
@Controller('admin/logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @Query('action') action?: string,
    @Query('q') q?: string,
    @Query('failed') failed?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.audit.list({ action, q, failed, page, pageSize });
  }
}

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: AuditLog.name, schema: AuditLogSchema }])],
  controllers: [AuditController],
  providers: [AuditService, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
  exports: [AuditService],
})
export class AuditModule {}
