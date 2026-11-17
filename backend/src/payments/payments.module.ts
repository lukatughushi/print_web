import type { RawBodyRequest } from '@nestjs/common';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Logger,
  Module,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel, MongooseModule } from '@nestjs/mongoose';
import type { Request } from 'express';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { isValidObjectId, Model } from 'mongoose';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Order, OrderDocument, OrderSchema, OrderStatus, PaymentStatus } from '../orders/schemas/order.schema';
import { Role } from '../users/schemas/user.schema';
import { BogReceipt, BogService } from './bog.service';

// BOG order_status.key → our payment status (refund_requested keeps ours).
const STATUS: Record<string, PaymentStatus> = {
  created: PaymentStatus.Pending,
  processing: PaymentStatus.Pending,
  auth_requested: PaymentStatus.Pending,
  completed: PaymentStatus.Paid,
  rejected: PaymentStatus.Failed,
  refunded: PaymentStatus.Refunded,
  refunded_partially: PaymentStatus.PartlyRefunded,
};

const round2 = (n: number) => Math.round(n * 100) / 100;
/** Lari already returned from the admin panel. */
const refundedSoFar = (order: OrderDocument) => round2((order.refunds ?? []).reduce((sum, r) => sum + r.amount, 0));

class RefundDto {
  /** Lari to return; without it, everything not yet returned. */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(100000) amount?: number;
  /** Why the money goes back; stored on the order. */
  @IsString() @MinLength(3) @MaxLength(500) reason: string;
}

/**
 * Card / Apple Pay / Google Pay payment through Bank of Georgia.
 * 1. The signed-in customer places the order (POST /orders), then
 *    POST /payments/bog/:orderId/start returns BOG's payment page.
 * 2. After paying, BOG sends the customer back to /checkout/paid, which asks
 *    GET /payments/bog/:orderId/status; BOG also posts to /callback.
 * Both read the result from BOG's own API, so neither trusts what the
 * browser or an unsigned request says.
 */
@Controller('payments/bog')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    private readonly bog: BogService,
    private readonly config: ConfigService,
  ) {}

  @Post(':orderId/start')
  @HttpCode(200)
  async start(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string) {
    const order = await this.ownOrder(user, orderId);
    if (order.paymentStatus === PaymentStatus.Paid) {
      throw new BadRequestException({ message: 'შეკვეთა უკვე გადახდილია', code: 'ALREADY_PAID' });
    }
    const appUrl = this.config.get<string>('APP_URL') || 'https://www.prenta.ge';
    const { bogOrderId, redirectUrl } = await this.bog.createPayment(order, appUrl);
    order.bogOrderId = bogOrderId;
    order.paymentStatus = PaymentStatus.Pending;
    await order.save();
    return { redirectUrl };
  }

  @Get(':orderId/status')
  async status(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string) {
    const order = await this.ownOrder(user, orderId);
    if (order.bogOrderId && [PaymentStatus.Pending, PaymentStatus.PartlyRefunded].includes(order.paymentStatus)) {
      await this.refresh(order).catch(() => undefined);
    }
    return {
      id: order.id,
      number: (order as unknown as { number: string }).number,
      total: order.total,
      phone: order.phone,
      address: order.address,
      paymentStatus: order.paymentStatus,
    };
  }

  /** Admin: returns money to the customer's card through BOG. */
  @Roles(Role.Admin)
  @Post(':orderId/refund')
  @HttpCode(200)
  async refund(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string, @Body() dto: RefundDto) {
    const order = await this.ownOrder(user, orderId);
    if (!order.bogOrderId || ![PaymentStatus.Paid, PaymentStatus.PartlyRefunded].includes(order.paymentStatus)) {
      throw new BadRequestException({ message: 'ამ შეკვეთაზე ონლაინ გადახდა არ არის', code: 'NOT_PAID' });
    }
    const done = refundedSoFar(order);
    const left = round2(order.total - done);
    const amount = round2(dto.amount ?? left);
    if (left <= 0) throw new BadRequestException({ message: 'თანხა უკვე სრულად დაბრუნებულია', code: 'NOTHING_LEFT' });
    if (amount > left + 0.005) {
      throw new BadRequestException({ message: `დასაბრუნებელი თანხა მაქსიმუმ ${left} ₾-ია`, code: 'TOO_MUCH' });
    }
    const full = Math.abs(amount - left) < 0.005;
    // The first refund of everything goes without an amount, as BOG expects for a full refund.
    await this.bog.refund(order.bogOrderId, full && done === 0 ? undefined : amount);
    this.logger.log(`Refund of ${amount} GEL for order ${order.id} by ${user.email}`);

    // BOG accepted the request (it settles it shortly); record it now.
    const reason = dto.reason.trim();
    order.refunds.push({ amount, reason, at: new Date(), by: user.email });
    order.paymentStatus = full ? PaymentStatus.Refunded : PaymentStatus.PartlyRefunded;
    if (full) {
      // Everything went back: the order is off.
      order.status = OrderStatus.Cancelled;
      order.cancelReason = reason;
    }
    await order.save();
    return order;
  }

  /** BOG's notice that a payment changed. Always answers 200 once read. */
  @Public()
  @Post('callback')
  @HttpCode(200)
  async callback(@Req() req: RawBodyRequest<Request>, @Headers('callback-signature') signature?: string) {
    if (!this.bog.signatureValid(req.rawBody, signature)) {
      this.logger.warn('BOG callback with an invalid signature ignored');
      return { ok: true };
    }
    const bogOrderId = (req.body as { body?: { order_id?: string } })?.body?.order_id;
    const order = bogOrderId ? await this.orders.findOne({ bogOrderId }).exec() : null;
    if (order) await this.refresh(order).catch((err) => this.logger.error(`BOG refresh failed: ${err}`));
    return { ok: true };
  }

  /** Reads the payment from BOG and stores the result on the order. */
  private async refresh(order: OrderDocument) {
    const receipt = await this.bog.receipt(order.bogOrderId!);
    let next = this.statusOf(order, receipt);
    // Refunds recorded here stand while BOG is still settling them.
    if (order.refunds?.length && (next === PaymentStatus.Paid || next === null)) next = order.paymentStatus;
    if (next === null) return;
    const refunded = Number(receipt.purchase_units?.refund_amount) || 0;
    if (next === order.paymentStatus && refunded === (order.refundedAmount || 0)) return;
    order.paymentStatus = next;
    order.refundedAmount = refunded;
    if (next === PaymentStatus.Paid && !order.paidAt) {
      order.paidAt = new Date();
      order.paidWith = receipt.payment_detail?.transfer_method?.key ?? '';
    }
    await order.save();
  }

  /** Our payment status for BOG's receipt; null = leave it as it is. */
  private statusOf(order: OrderDocument, receipt: BogReceipt): PaymentStatus | null {
    const key = receipt.order_status?.key ?? '';
    if (key === 'refund_requested') return null;
    const status = STATUS[key] ?? PaymentStatus.Pending;
    if (status !== PaymentStatus.Paid) return status;
    // Paid only if BOG took the full amount, in lari.
    const units = receipt.purchase_units ?? {};
    const amount = Number(units.transfer_amount ?? units.request_amount);
    const currencyOk = !units.currency_code || units.currency_code === 'GEL';
    if (currencyOk && Math.abs(amount - order.total) < 0.005) return PaymentStatus.Paid;
    this.logger.error(`BOG amount mismatch on order ${order.id}: ${amount} ${units.currency_code} vs ${order.total}`);
    return PaymentStatus.Failed;
  }

  private async ownOrder(user: AuthUser, orderId: string) {
    const order = isValidObjectId(orderId) ? await this.orders.findById(orderId).exec() : null;
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerEmail !== user.email.toLowerCase() && user.role !== Role.Admin) throw new ForbiddenException();
    return order;
  }
}

@Module({
  imports: [MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }])],
  controllers: [PaymentsController],
  providers: [BogService],
})
export class PaymentsModule {}
