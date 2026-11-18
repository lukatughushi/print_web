import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '../../users/schemas/user.schema';
import { UsersService } from '../../users/users.service';

export interface JwtPayload {
  sub: string;
  iat?: number;
  email: string;
  role: Role;
}

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // Re-reads the account so a deactivation or role change applies at once
  // (a 401 signs the client out).
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.users.findAuthInfo(payload.sub);
    if (!user || user.disabled) throw new UnauthorizedException('Account is not active');
    // Signed in before the password was last changed (iat is in whole seconds).
    const changed = user.passwordChangedAt ? new Date(user.passwordChangedAt).getTime() : 0;
    if (changed && (payload.iat ?? 0) * 1000 < changed - 1000) {
      throw new UnauthorizedException('Session ended after a password change');
    }
    return { id: payload.sub, email: user.email, role: user.role };
  }
}
