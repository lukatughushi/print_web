import { Body, Controller, Get, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
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

  /** Guest checkout. */
  @Public()
  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.orders.create(dto);
  }

  /** The signed-in customer's orders (matched by e-mail). */
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.orders.findByEmail(user.email);
  }

  @Roles(Role.Admin)
  @Get()
  findAll(@Query('status') status?: string, @Query('q') q?: string) {
    return this.orders.findAll({ status, q });
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
