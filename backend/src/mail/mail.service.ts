import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Sends e-mail through Resend (https://resend.com) using its HTTP API.
 * Needs RESEND_API_KEY and MAIL_FROM (an address on a domain verified in
 * Resend, e.g. "Prenta <info@prenta.ge>"). Without a key the service is off:
 * `enabled` is false and messages are only logged, so local development and
 * a not-yet-configured server keep working without e-mail checks.
 * MAIL_LOG_ONLY=true turns the checks on locally and prints the e-mails'
 * links to the server log instead of sending them.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');

  constructor(private readonly config: ConfigService) {}

  get enabled() {
    return (
      Boolean(this.config.get<string>('RESEND_API_KEY')) ||
      this.config.get<string>('MAIL_LOG_ONLY') === 'true'
    );
  }

  /** Public site address used in links (APP_URL, else the first CORS origin). */
  get appUrl() {
    const url =
      this.config.get<string>('APP_URL') ||
      String(this.config.get<string>('CORS_ORIGINS') || 'http://localhost:5173').split(',')[0];
    return url.trim().replace(/\/+$/, '');
  }

  async send(to: string, subject: string, html: string) {
    const key = this.config.get<string>('RESEND_API_KEY');
    if (!key) {
      this.logger.warn(`E-mail not sent (RESEND_API_KEY missing) — to ${to}: ${subject}`);
      const links = [...new Set([...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]))];
      this.logger.log(`Links: ${links.join(' ')}`);
      return;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: this.config.get<string>('MAIL_FROM') || 'Prenta <info@prenta.ge>',
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`Resend ${res.status}: ${body.slice(0, 300)}`);
      throw new Error('E-mail could not be sent');
    }
  }

  /** A simple branded message with one button. */
  layout(title: string, text: string, button: string, link: string) {
    return `<!doctype html><html><body style="margin:0;background:#F9F6F3;font-family:Arial,sans-serif;color:#16233B">
<div style="max-width:480px;margin:0 auto;padding:32px 20px">
  <div style="font-family:Georgia,serif;font-weight:700;letter-spacing:.16em;font-size:20px;margin-bottom:24px">PRENTA</div>
  <div style="background:#fff;border:1px solid #ECE6DF;border-radius:16px;padding:28px">
    <h1 style="margin:0 0 12px;font-size:20px">${title}</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#4A5368">${text}</p>
    <a href="${link}" style="display:inline-block;background:#EF5F7A;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">${button}</a>
    <p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#8A8F9C">თუ ღილაკი არ მუშაობს, გახსენი ეს ბმული:<br><a href="${link}" style="color:#8A8F9C;word-break:break-all">${link}</a></p>
  </div>
  <p style="margin:18px 0 0;font-size:12px;color:#8A8F9C">თუ ეს შენ არ მოგითხოვია, უბრალოდ უგულებელყავი ეს წერილი.</p>
</div></body></html>`;
  }
}
