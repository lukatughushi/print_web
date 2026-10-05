import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { FilesService } from '../files/files.service';
import { Product } from '../products/schemas/product.schema';
import { SettingsService } from '../settings/settings.service';
import { CreateOrderDto, OrderDesignDto, UpdateOrderDto } from './dto/order.dto';
import { Order, OrderDesign, OrderItem, OrderStatus } from './schemas/order.schema';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/** Decodes a data: URL into bytes; null when it isn't an allowed image. */
function decodeDataUrl(value?: string) {
  const match = /^data:([\w/+.-]+);base64,(.+)$/s.exec(value ?? '');
  if (!match || !IMAGE_TYPES.includes(match[1])) return null;
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return null;
  return { buffer, type: match[1] };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    private readonly settings: SettingsService,
    private readonly files: FilesService,
  ) {}

  async create(dto: CreateOrderDto) {
    const ids = [...new Set(dto.items.map((i) => i.productId))];
    const products = await this.productModel.find({ _id: { $in: ids }, isActive: true }).exec();
    if (products.length !== ids.length) {
      throw new BadRequestException({
        message: 'ზოგიერთი პროდუქტი აღარ იყიდება',
        code: 'PRODUCT_UNAVAILABLE',
      });
    }
    const byId = new Map(products.map((p) => [p.id as string, p]));

    // Prices always come from the catalogue, never from the client.
    const lines = dto.items.map((item) => {
      const product = byId.get(item.productId)!;
      const size = item.size ?? '';
      if (product.sizes.length && !product.sizes.includes(size)) {
        throw new BadRequestException({
          message: `ზომა „${size}“ აღარ არის ხელმისაწვდომი: ${product.name}`,
          code: 'INVALID_SIZE',
          productId: product.id,
        });
      }
      const unitPrice = product.price;
      return { item, product, size, unitPrice, lineTotal: round2(unitPrice * item.quantity) };
    });

    const subtotal = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
    const settings = await this.settings.get();
    const shipping = this.settings.shippingFor(subtotal, settings);
    const total = round2(subtotal + shipping);

    // Refuse rather than charge an amount the customer never saw.
    if (typeof dto.expectedTotal === 'number' && Math.abs(dto.expectedTotal - total) > 0.005) {
      throw new ConflictException({
        message: 'ფასები შეიცვალა',
        code: 'PRICE_CHANGED',
        total,
      });
    }

    const written: string[] = [];
    try {
      const items: OrderItem[] = [];
      for (const { item, product, size, unitPrice, lineTotal } of lines) {
        items.push({
          product: product._id as Types.ObjectId,
          name: product.name,
          category: product.category,
          size,
          color: item.color,
          quantity: item.quantity,
          unitPrice,
          lineTotal,
          design: item.design ? await this.storeDesign(item.design, written) : undefined,
        });
      }

      const order = await this.orderModel.create({
        items,
        customerName: dto.customerName,
        customerEmail: dto.customerEmail,
        phone: dto.phone,
        address: dto.address,
        notes: dto.notes ?? '',
        payment: dto.payment ?? 'cash',
        subtotal,
        shipping,
        total,
      });
      return order;
    } catch (err) {
      await Promise.all(written.map((id) => this.files.removeById(id)));
      throw err;
    }
  }

  findAll(query: { status?: string; q?: string }) {
    const filter: Record<string, unknown> = {};
    if (query.status && Object.values(OrderStatus).includes(query.status as OrderStatus)) {
      filter.status = query.status;
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const or: Record<string, unknown>[] = [{ customerName: rx }, { phone: rx }, { customerEmail: rx }];
      // "PR-3F9A21" or "3f9a21" → ids ending with those hex digits.
      const tail = q.replace(/^PR-/i, '').toLowerCase();
      if (/^[0-9a-f]{4,24}$/.test(tail)) {
        or.push({ $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: `${tail}$` } } });
      }
      filter.$or = or;
    }
    return this.orderModel.find(filter).sort({ createdAt: -1 }).limit(500).exec();
  }

  findByEmail(email: string) {
    return this.orderModel.find({ customerEmail: email.toLowerCase() }).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string) {
    const order = isValidObjectId(id) ? await this.orderModel.findById(id).exec() : null;
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async update(id: string, dto: UpdateOrderDto) {
    const order = await this.findOne(id);
    Object.assign(order, dto);
    await order.save();
    return order;
  }

  /** Saves the editor output as files; returns their ids. */
  private async storeDesign(design: OrderDesignDto, written: string[]): Promise<OrderDesign> {
    const out: OrderDesign = { model: design.model };
    const put = async (buffer: Buffer, name: string, type: string) => {
      const id = await this.files.uploadBuffer(buffer, name, type);
      written.push(id);
      return id;
    };

    const print = decodeDataUrl(design.printUrl);
    if (print) out.printFile = await put(print.buffer, 'print.png', print.type);

    const preview = decodeDataUrl(design.previewUrl);
    if (preview) out.previewFile = await put(preview.buffer, 'preview.png', preview.type);

    if (design.canvasJson) {
      const json = Buffer.from(JSON.stringify(design.canvasJson));
      if (json.length > 20 * 1024 * 1024) throw new BadRequestException('Design is too large');
      out.layersFile = await put(json, 'layers.json', 'application/json');
    }
    return out;
  }
}
