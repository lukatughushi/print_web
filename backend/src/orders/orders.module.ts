import { randomBytes } from 'crypto';
import { Body, Controller, Get, Module, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RateLimit, RateLimitGuard } from '../common/guards/rate-limit.guard';
import { FilesModule } from '../files/files.module';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { SettingsModule } from '../settings/settings.module';
import { Role } from '../users/schemas/user.schema';
import { CreateOrderDto, UpdateOrderDto } from './dto/order.dto';
import { OrdersService } from './orders.service';
import { Order, OrderSchema } from './schemas/order.schema';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /**
   * Checkout, with or without an account. A signed-in order is filed under the
   * account's e-mail; a guest gets a key for paying and checking this order.
   */
  // Open to everyone and each order can carry MBs of print files: capped per IP
  // so a script can't fill the database.
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit(15, 60)
  @Post()
  async create(@CurrentUser() user: AuthUser | undefined, @Body() dto: CreateOrderDto) {
    if (user) return this.orders.create({ ...dto, customerEmail: user.email });
    const guestKey = randomBytes(24).toString('hex');
    const order = await this.orders.create({ ...dto, customerEmail: undefined, guestKey });
    return { ...order.toJSON(), guestKey };
  }

  /** The signed-in customer's orders (matched by e-mail). */
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.orders.findByEmail(user.email);
  }

  @Roles(Role.Admin)
  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.orders.findAll({ status, q, page, pageSize });
  }

  @Roles(Role.Admin)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orders.findOne(id);
  }

  @Roles(Role.Admin)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.orders.update(id, dto);
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    FilesModule,
    SettingsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
