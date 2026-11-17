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
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { isValidObjectId, Model } from 'mongoose';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Order, OrderDocument, OrderSchema, PaymentStatus } from '../orders/schemas/order.schema';
import { Role } from '../users/schemas/user.schema';
import { BogReceipt, BogService } from './bog.service';

// BOG order_status.key → our payment status.
const STATUS: Record<string, PaymentStatus> = {
  created: PaymentStatus.Pending,
  processing: PaymentStatus.Pending,
  auth_requested: PaymentStatus.Pending,
  completed: PaymentStatus.Paid,
  rejected: PaymentStatus.Failed,
  refund_requested: PaymentStatus.Paid,
  refunded: PaymentStatus.Refunded,
  refunded_partially: PaymentStatus.PartlyRefunded,
};

class RefundDto {
  /** Lari to return; without it, everything not yet returned. */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(100000) amount?: number;
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
    const left = Math.round((order.total - (order.refundedAmount || 0)) * 100) / 100;
    const amount = dto.amount ?? left;
    if (amount > left + 0.005) {
      throw new BadRequestException({ message: `დასაბრუნებელი თანხა მაქსიმუმ ${left} ₾-ია`, code: 'TOO_MUCH' });
    }
    // The whole remainder goes without an amount, as BOG expects for a full refund.
    await this.bog.refund(order.bogOrderId, amount < left - 0.005 || order.refundedAmount ? amount : undefined);
    this.logger.log(`Refund of ${amount} GEL requested for order ${order.id} by ${user.email}`);
    // BOG settles refunds asynchronously; read the state it reports now.
    await this.refresh(order).catch(() => undefined);
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
    const next = this.statusOf(order, receipt);
    const refunded = Number(receipt.purchase_units?.refund_amount) || 0;
    if (next === order.paymentStatus && refunded === (order.refundedAmount || 0)) return;
    order.paymentStatus = next;
    order.refundedAmount = refunded;
    if (next === PaymentStatus.Paid) {
      order.paidAt = new Date();
      order.paidWith = receipt.payment_detail?.transfer_method?.key ?? '';
    }
    await order.save();
  }

  private statusOf(order: OrderDocument, receipt: BogReceipt) {
    const status = STATUS[receipt.order_status?.key ?? ''] ?? PaymentStatus.Pending;
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
