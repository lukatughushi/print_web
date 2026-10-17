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
  Query,
} from '@nestjs/common';
import { InjectModel, MongooseModule } from '@nestjs/mongoose';
import { IsBoolean, IsEnum } from 'class-validator';
import { isValidObjectId, Model } from 'mongoose';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { pageParams, PageQuery, searchRegex } from '../common/pagination';
import { Roles } from '../common/decorators/roles.decorator';
import { Order, OrderSchema, OrderStatus } from '../orders/schemas/order.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Quote, QuoteSchema, QuoteStatus } from '../quotes/quotes.module';
import { Role, User, UserSchema } from '../users/schemas/user.schema';

export class UpdateRoleDto {
  @IsEnum(Role) role: Role;
}

export class UpdateStatusDto {
  @IsBoolean() disabled: boolean;
}

/** Orders that count towards revenue. */
const COUNTED = { status: { $ne: OrderStatus.Cancelled } };

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Quote.name) private readonly quoteModel: Model<Quote>,
  ) {}

  async stats() {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 29);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [revenue, byStatus, daily, top, recent, products, activeProducts, users, todayOrders, newQuotes] =
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
        this.quoteModel.countDocuments({ status: QuoteStatus.New }),
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
      newQuotes,
    };
  }

  /** One page of products, hidden ones included. */
  async allProducts(query: { q?: string; category?: string; visibility?: string } & PageQuery) {
    const filter: Record<string, unknown> = {};
    const rx = searchRegex(query.q);
    if (rx) filter.name = rx;
    if (query.category) filter.category = query.category;
    if (query.visibility === 'on') filter.isActive = true;
    if (query.visibility === 'off') filter.isActive = false;
    if (query.visibility === 'sale') filter.$expr = { $gt: ['$oldPrice', '$price'] };

    const { page, pageSize } = pageParams(query);
    const [items, total, all, active] = await Promise.all([
      this.productModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).exec(),
      this.productModel.countDocuments(filter).exec(),
      this.productModel.countDocuments().exec(),
      this.productModel.countDocuments({ isActive: true }).exec(),
    ]);
    return { items, total, page, pageSize, all, active };
  }

  /** Users with their order count and spend (orders are matched by e-mail). */
  async users(query: { q?: string; role?: string } & PageQuery) {
    const filter: Record<string, unknown> = {};
    const rx = searchRegex(query.q);
    if (rx) filter.$or = [{ name: rx }, { email: rx }];
    if (query.role === Role.Admin || query.role === Role.User) filter.role = query.role;
    const { page, pageSize } = pageParams(query);
    const [pageUsers, total] = await Promise.all([
      this.userModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean().exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);
    const items = await this.withOrderTotals(pageUsers);
    return { items, total, page, pageSize };
  }

  /** Adds order count / spend to users (orders are matched by e-mail). */
  private async withOrderTotals(pageUsers: (User & { _id: unknown; __v?: number; createdAt?: Date })[]) {
    const [users, totals] = await Promise.all([
      Promise.resolve(pageUsers),
      this.orderModel.aggregate<{ _id: string; orders: number; spent: number; last: Date }>([
        { $match: { customerEmail: { $in: pageUsers.map((u) => u.email) } } },
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

  /** Deactivates (or re-activates) an account; admins can't lock themselves out. */
  async setStatus(id: string, disabled: boolean, actor: AuthUser) {
    if (id === actor.id && disabled) throw new BadRequestException('საკუთარ ანგარიშს ვერ გათიშავ');
    const user = isValidObjectId(id) ? await this.userModel.findByIdAndUpdate(id, { disabled }, { new: true }).exec() : null;
    if (!user) throw new NotFoundException('User not found');
    return user;
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
  products(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('visibility') visibility?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.admin.allProducts({ q, category, visibility, page, pageSize });
  }

  @Get('users')
  users(
    @Query('q') q?: string,
    @Query('role') role?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.admin.users({ q, role, page, pageSize });
  }

  @Patch('users/:id/status')
  setStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto, @CurrentUser() actor: AuthUser) {
    return this.admin.setStatus(id, dto.disabled, actor);
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
      { name: Quote.name, schema: QuoteSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
