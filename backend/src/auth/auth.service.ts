import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const HOUR = 60 * 60 * 1000;
const VERIFY_TTL = 48 * HOUR;
const RESET_TTL = HOUR;
const RESEND_GAP = 60 * 1000;

/** A one-time link token and its SHA-256 hash (only the hash is stored). */
export function newToken() {
  const token = randomBytes(32).toString('hex');
  return { token, hash: hashToken(token) };
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mail: MailService,
  ) {}

  /**
   * With e-mail set up, a new account must confirm its address before it
   * can sign in; without it (no RESEND_API_KEY) it is signed in right away.
   */
  async register(dto: RegisterDto) {
    if (!this.mail.enabled) {
      const user = await this.usersService.create(dto);
      return this.buildAuthResponse(user);
    }
    const user = await this.usersService.create({ ...dto, emailVerified: false });
    // A failed send must not block the account: the link can be resent.
    await this.sendVerification(user).catch(() => undefined);
    return { verifyRequired: true, email: user.email };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    const valid = user && (await this.usersService.comparePassword(dto.password, user.password));
    if (!user || !valid) throw new UnauthorizedException('Invalid email or password');
    if (user.disabled) {
      throw new ForbiddenException({ message: 'ანგარიში გათიშულია — დაგვიკავშირდი', code: 'ACCOUNT_DISABLED' });
    }
    if (user.emailVerified === false) {
      throw new ForbiddenException({
        message: 'ელფოსტა ჯერ არ არის დადასტურებული — გახსენი მეილზე გამოგზავნილი ბმული',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }
    return this.buildAuthResponse(user);
  }

  /** Opens the link from the welcome e-mail: confirms and signs in. */
  async verifyEmail(token: string) {
    const user = await this.usersService.findByToken('verifyTokenHash', 'verifyTokenExpires', hashToken(token));
    if (!user) throw new BadRequestException({ message: 'ბმული არასწორია ან ვადაგასულია', code: 'BAD_TOKEN' });
    await this.usersService.update(user.id, { emailVerified: true }, ['verifyTokenHash', 'verifyTokenExpires', 'verifySentAt']);
    const fresh = await this.usersService.findById(user.id);
    if (fresh.disabled) {
      throw new ForbiddenException({ message: 'ანგარიში გათიშულია — დაგვიკავშირდი', code: 'ACCOUNT_DISABLED' });
    }
    return this.buildAuthResponse(fresh);
  }

  /** Sends the confirmation link again (at most once a minute). */
  async resendVerification(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || user.emailVerified !== false || !this.mail.enabled) return { ok: true };
    const withMeta = await this.usersService.findByIdWith(user.id, '+verifySentAt');
    const last = withMeta?.verifySentAt?.getTime() ?? 0;
    if (Date.now() - last < RESEND_GAP) return { ok: true };
    await this.sendVerification(user);
    return { ok: true };
  }

  /** E-mails a password reset link. Always answers ok (no account probing). */
  async forgotPassword(email: string) {
    if (!this.mail.enabled) {
      throw new ServiceUnavailableException('პაროლის აღდგენა დროებით მიუწვდომელია');
    }
    const user = await this.usersService.findByEmail(email);
    if (!user) return { ok: true };
    const { token, hash } = newToken();
    await this.usersService.update(user.id, { resetTokenHash: hash, resetTokenExpires: new Date(Date.now() + RESET_TTL) });
    const link = `${this.mail.appUrl}/reset-password?token=${token}`;
    await this.mail.send(
      user.email,
      'პაროლის აღდგენა — Prenta',
      this.mail.layout(
        'პაროლის აღდგენა',
        `გამარჯობა, ${escapeHtml(user.name)}! ახალი პაროლის დასაყენებლად დააჭირე ღილაკს. ბმული 1 საათი მოქმედებს.`,
        'ახალი პაროლის დაყენება',
        link,
      ),
    );
    return { ok: true };
  }

  /** Sets a new password from the reset link; also confirms the e-mail. */
  async resetPassword(token: string, password: string) {
    const user = await this.usersService.findByToken('resetTokenHash', 'resetTokenExpires', hashToken(token));
    if (!user) throw new BadRequestException({ message: 'ბმული არასწორია ან ვადაგასულია', code: 'BAD_TOKEN' });
    await this.usersService.setPassword(user.id, password);
    await this.usersService.update(user.id, { emailVerified: true }, [
      'resetTokenHash', 'resetTokenExpires', 'pendingPassword', 'pendingPasswordTokenHash', 'pendingPasswordExpires',
    ]);
    return { ok: true };
  }

  /** Applies a password change confirmed from the e-mailed link. */
  async confirmPassword(token: string) {
    const user = await this.usersService.findByToken(
      'pendingPasswordTokenHash',
      'pendingPasswordExpires',
      hashToken(token),
      '+pendingPassword',
    );
    if (!user?.pendingPassword) {
      throw new BadRequestException({ message: 'ბმული არასწორია ან ვადაგასულია', code: 'BAD_TOKEN' });
    }
    await this.usersService.update(user.id, { password: user.pendingPassword }, [
      'pendingPassword', 'pendingPasswordTokenHash', 'pendingPasswordExpires',
    ]);
    return { ok: true };
  }

  private async sendVerification(user: UserDocument) {
    const { token, hash } = newToken();
    await this.usersService.update(user.id, {
      verifyTokenHash: hash,
      verifyTokenExpires: new Date(Date.now() + VERIFY_TTL),
      verifySentAt: new Date(),
    });
    const link = `${this.mail.appUrl}/verify-email?token=${token}`;
    await this.mail.send(
      user.email,
      'დაადასტურე ელფოსტა — Prenta',
      this.mail.layout(
        'მოგესალმებით Prenta-ში!',
        `გამარჯობა, ${escapeHtml(user.name)}! რეგისტრაციის დასასრულებლად დაადასტურე ელფოსტა. ბმული 48 საათი მოქმედებს.`,
        'ელფოსტის დადასტურება',
        link,
      ),
    );
  }

  private buildAuthResponse(user: UserDocument) {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
      user: user.toJSON(),
    };
  }
}

export function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}
