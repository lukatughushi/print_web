import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { EventsGateway } from '../realtime/events.gateway';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './schemas/product.schema';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    private readonly events: EventsGateway,
  ) {}

  findAll(category?: string) {
    const filter: Record<string, unknown> = { isActive: true };
    if (category) filter.category = category;
    return this.productModel.find(filter).sort({ createdAt: -1, _id: -1 }).exec();
  }

  async findOne(id: string) {
    const product = isValidObjectId(id) ? await this.productModel.findById(id).exec() : null;
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(dto: CreateProductDto) {
    const product = await this.productModel.create(dto);
    this.events.broadcast('product:created', product);
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = isValidObjectId(id)
      ? await this.productModel.findByIdAndUpdate(id, dto, { new: true, runValidators: true }).exec()
      : null;
    if (!product) throw new NotFoundException('Product not found');
    this.events.broadcast('product:updated', product);
    return product;
  }

  async remove(id: string) {
    const product = isValidObjectId(id) ? await this.productModel.findByIdAndDelete(id).exec() : null;
    if (!product) throw new NotFoundException('Product not found');
    this.events.broadcast('product:deleted', { id });
    return { deleted: true };
  }
}
