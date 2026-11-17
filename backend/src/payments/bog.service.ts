import { createPublicKey, randomUUID, verify } from 'node:crypto';
import { Injectable, Logger, ServiceUnavailableException, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OrderDocument } from '../orders/schemas/order.schema';

/*
 * Bank of Georgia online payments (https://api.bog.ge/docs/payments).
 * The customer pays on BOG's own page (card, Apple Pay, Google Pay: whatever
 * is switched on for the business in businessmanager.bog.ge); card details
 * never reach this server.
 *
 * Needs BOG_CLIENT_ID and BOG_CLIENT_SECRET (from the bank). BOG_SANDBOX=true
 * switches to the bank's test environment instead, with its own keys in
 * BOG_SANDBOX_CLIENT_ID / BOG_SANDBOX_CLIENT_SECRET and the test cards from
 * the docs (4000 0000 0000 0001 = success). Optional:
 * BOG_CALLBACK_URL, the public https address of POST /api/payments/bog/callback
 * (on Render it is built from RENDER_EXTERNAL_URL).
 */

const HOSTS = {
  live: { token: 'https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token', api: 'https://api.bog.ge/payments/v1' },
  sandbox: { token: 'https://oauth2-sandbox.bog.ge/auth/realms/bog/protocol/openid-connect/token', api: 'https://api-sandbox.bog.ge/payments/v1' },
};

/** BOG's key for checking the Callback-Signature header (from the docs' callback page). */
const BOG_PUBLIC_KEY = createPublicKey(`-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu4RUyAw3+CdkS3ZNILQh
zHI9Hemo+vKB9U2BSabppkKjzjjkf+0Sm76hSMiu/HFtYhqWOESryoCDJoqffY0Q
1VNt25aTxbj068QNUtnxQ7KQVLA+pG0smf+EBWlS1vBEAFbIas9d8c9b9sSEkTrr
TYQ90WIM8bGB6S/KLVoT1a7SnzabjoLc5Qf/SLDG5fu8dH8zckyeYKdRKSBJKvhx
tcBuHV4f7qsynQT+f2UYbESX/TLHwT5qFWZDHZ0YUOUIvb8n7JujVSGZO9/+ll/g
4ZIWhC1MlJgPObDwRkRd8NFOopgxMcMsDIZIoLbWKhHVq67hdbwpAq9K9WMmEhPn
PwIDAQAB
-----END PUBLIC KEY-----`);

export interface BogReceipt {
  order_id: string;
  external_order_id?: string;
  order_status?: { key?: string };
  purchase_units?: {
    request_amount?: string | number;
    transfer_amount?: string | number;
    refund_amount?: string | number;
    currency_code?: string;
  };
  payment_detail?: { transfer_method?: { key?: string } };
}

@Injectable()
export class BogService {
  private readonly logger = new Logger(BogService.name);
  private token: { value: string; until: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  private get sandbox() {
    return this.config.get('BOG_SANDBOX') === 'true';
  }

  private get hosts() {
    return this.sandbox ? HOSTS.sandbox : HOSTS.live;
  }

  private get keys() {
    const prefix = this.sandbox ? 'BOG_SANDBOX_' : 'BOG_';
    return { id: this.config.get<string>(prefix + 'CLIENT_ID'), secret: this.config.get<string>(prefix + 'CLIENT_SECRET') };
  }

  get enabled() {
    return Boolean(this.keys.id && this.keys.secret);
  }

  /** Where BOG posts payment results; must be public https. */
  private callbackUrl() {
    const own = this.config.get<string>('BOG_CALLBACK_URL');
    if (own) return own;
    const render = this.config.get<string>('RENDER_EXTERNAL_URL');
    // Locally BOG can't reach this computer; the status check on return covers it.
    return `${render || 'https://printweb-api.onrender.com'}/api/payments/bog/callback`;
  }

  private async accessToken() {
    if (this.token && this.token.until > Date.now()) return this.token.value;
    if (!this.enabled) throw new ServiceUnavailableException({ message: 'ონლაინ გადახდა დროებით მიუწვდომელია', code: 'BOG_DISABLED' });
    const basic = Buffer.from(`${this.keys.id}:${this.keys.secret}`).toString('base64');
    const res = await fetch(this.hosts.token, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    }).catch(() => null);
    if (!res?.ok) {
      this.logger.error(`BOG token request failed: ${res?.status ?? 'network error'}`);
      throw new BadGatewayException('ბანკთან კავშირი ვერ დამყარდა, სცადე ხელახლა');
    }
    const data = (await res.json()) as { access_token: string };
    // Tokens are short-lived; reuse one for a few minutes only.
    this.token = { value: data.access_token, until: Date.now() + 4 * 60 * 1000 };
    return data.access_token;
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.hosts.api}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await this.accessToken()}`,
        'Content-Type': 'application/json',
        'Accept-Language': 'ka',
        ...(method === 'POST' ? { 'Idempotency-Key': randomUUID() } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    if (!res?.ok) {
      const detail = res ? await res.text().catch(() => '') : 'network error';
      this.logger.error(`BOG ${method} ${path} failed: ${res?.status ?? ''} ${detail.slice(0, 500)}`);
      throw new BadGatewayException('ბანკთან კავშირი ვერ დამყარდა, სცადე ხელახლა');
    }
    return (await res.json()) as T;
  }

  /** Opens a payment for the order; returns BOG's order id and its payment page. */
  async createPayment(order: OrderDocument, appUrl: string) {
    const back = `${appUrl}/checkout/paid?order=${order.id}`;
    const data = await this.call<{ id: string; _links: { redirect: { href: string } } }>('POST', '/ecommerce/orders', {
      callback_url: this.callbackUrl(),
      external_order_id: (order as unknown as { number: string }).number,
      purchase_units: {
        currency: 'GEL',
        total_amount: order.total,
        basket: order.items.map((it) => ({
          product_id: String(it.product),
          description: it.name.slice(0, 100),
          quantity: it.quantity,
          unit_price: it.unitPrice,
        })),
        ...(order.shipping ? { delivery: { amount: order.shipping } } : {}),
      },
      redirect_urls: { success: back, fail: `${back}&failed=1` },
      ttl: 30,
      buyer: { full_name: order.customerName.slice(0, 100) },
    });
    return { bogOrderId: data.id, redirectUrl: data._links.redirect.href };
  }

  /** Returns money to the customer's card: the whole payment, or `amount` lari of it. */
  refund(bogOrderId: string, amount?: number) {
    return this.call<{ key: string; message: string; action_id: string }>(
      'POST',
      `/payment/refund/${encodeURIComponent(bogOrderId)}`,
      amount === undefined ? {} : { amount },
    );
  }

  receipt(bogOrderId: string) {
    return this.call<BogReceipt>('GET', `/receipt/${encodeURIComponent(bogOrderId)}`);
  }

  /** Whether the callback body really comes from BOG. */
  signatureValid(rawBody: Buffer | undefined, signature: string | undefined) {
    if (!rawBody || !signature) return false;
    // The docs don't state the encoding; base64 is expected, hex is tried too.
    const encodings: BufferEncoding[] = /^[0-9a-f]+$/i.test(signature) ? ['hex', 'base64'] : ['base64'];
    return encodings.some((enc) => {
      try {
        return verify('sha256', rawBody, BOG_PUBLIC_KEY, Buffer.from(signature, enc));
      } catch {
        return false;
      }
    });
  }
}
