import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
} from '@nestjs/common';
import { InjectModel, MongooseModule } from '@nestjs/mongoose';
import { IsEnum } from 'class-validator';
import { isValidObjectId, Model } from 'mongoose';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Order, OrderSchema, OrderStatus } from '../orders/schemas/order.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Role, User, UserSchema } from '../users/schemas/user.schema';

export class UpdateRoleDto {
  @IsEnum(Role) role: Role;
}

/** Orders that count towards revenue. */
const COUNTED = { status: { $ne: OrderStatus.Cancelled } };

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async stats() {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 29);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [revenue, byStatus, daily, top, recent, products, activeProducts, users, todayOrders] =
      await Promise.all([
        this.orderModel.aggregate<{ total: number; count: number }>([
          { $match: COUNTED },
          { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
        ]),
        this.orderModel.aggregate<{ _id: string; count: number }>([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        this.orderModel.aggregate<{ _id: string; total: number; count: number }>([
          { $match: { ...COUNTED, createdAt: { $gte: since } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Tbilisi' } },
              total: { $sum: '$total' },
              count: { $sum: 1 },
            },
          },
        ]),
        this.orderModel.aggregate<{ _id: unknown; name: string; category: string; quantity: number; revenue: number }>([
          { $match: COUNTED },
          { $unwind: '$items' },
          {
            $group: {
              _id: '$items.product',
              name: { $last: '$items.name' },
              category: { $last: '$items.category' },
              quantity: { $sum: '$items.quantity' },
              revenue: { $sum: '$items.lineTotal' },
            },
          },
          { $sort: { quantity: -1 } },
          { $limit: 5 },
        ]),
        this.orderModel.find().sort({ createdAt: -1 }).limit(6).exec(),
        this.productModel.countDocuments(),
        this.productModel.countDocuments({ isActive: true }),
        this.userModel.countDocuments(),
        this.orderModel.countDocuments({ createdAt: { $gte: today } }),
      ]);

    // Fill missing days with zeros so the chart has 30 bars.
    const perDay = new Map(daily.map((d) => [d._id, d]));
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Tbilisi' });
      return { date: key, total: perDay.get(key)?.total ?? 0, count: perDay.get(key)?.count ?? 0 };
    });

    const statusCounts = Object.fromEntries(Object.values(OrderStatus).map((s) => [s, 0]));
    byStatus.forEach((s) => (statusCounts[s._id] = s.count));
    const open = [OrderStatus.Pending, OrderStatus.Printing, OrderStatus.Ready, OrderStatus.Shipped]
      .reduce((sum, s) => sum + statusCounts[s], 0);

    return {
      revenue: revenue[0]?.total ?? 0,
      orders: revenue[0]?.count ?? 0,
      averageOrder: revenue[0]?.count ? revenue[0].total / revenue[0].count : 0,
      openOrders: open,
      todayOrders,
      statusCounts,
      days,
      topProducts: top.map((t) => ({ id: String(t._id), name: t.name, category: t.category, quantity: t.quantity, revenue: t.revenue })),
      recentOrders: recent,
      products,
      activeProducts,
      users,
    };
  }

  /** Every product, hidden ones included. */
  allProducts() {
    return this.productModel.find().sort({ createdAt: -1, _id: -1 }).exec();
  }

  /** Users with their order count and spend (orders are matched by e-mail). */
  async users() {
    const [users, totals] = await Promise.all([
      this.userModel.find().sort({ createdAt: -1 }).lean().exec(),
      this.orderModel.aggregate<{ _id: string; orders: number; spent: number; last: Date }>([
        { $match: { customerEmail: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: '$customerEmail',
            orders: { $sum: 1 },
            spent: { $sum: { $cond: [{ $eq: ['$status', OrderStatus.Cancelled] }, 0, '$total'] } },
            last: { $max: '$createdAt' },
          },
        },
      ]),
    ]);
    const byEmail = new Map(totals.map((t) => [t._id, t]));
    // `password` is never selected (select: false on the schema).
    return users.map(({ __v: _v, ...u }) => {
      const t = byEmail.get(u.email);
      return { ...u, id: String(u._id), orders: t?.orders ?? 0, spent: t?.spent ?? 0, lastOrderAt: t?.last ?? null };
    });
  }

  async setRole(id: string, role: Role, actor: AuthUser) {
    if (id === actor.id && role !== Role.Admin) {
      throw new BadRequestException('საკუთარ თავს ადმინის როლს ვერ ჩამოართმევ');
    }
    const user = isValidObjectId(id) ? await this.userModel.findByIdAndUpdate(id, { role }, { new: true }).exec() : null;
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}

@Roles(Role.Admin)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  @Get('products')
  products() {
    return this.admin.allProducts();
  }

  @Get('users')
  users() {
    return this.admin.users();
  }

  @Patch('users/:id/role')
  setRole(@Param('id') id: string, @Body() dto: UpdateRoleDto, @CurrentUser() actor: AuthUser) {
    return this.admin.setRole(id, dto.role, actor);
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
