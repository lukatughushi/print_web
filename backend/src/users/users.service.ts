import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { Role, User, UserDocument } from './schemas/user.schema';

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  async create(data: { name: string; email: string; password: string; role?: Role }) {
    const exists = await this.userModel.exists({ email: data.email.toLowerCase() });
    if (exists) throw new ConflictException('Email is already registered');
    const password = await bcrypt.hash(data.password, SALT_ROUNDS);
    return this.userModel.create({ ...data, password });
  }

  findByEmailWithPassword(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase() }).select('+password').exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  findAll() {
    return this.userModel.find().sort({ createdAt: -1 }).exec();
  }

  comparePassword(plain: string, hash: string) {
    return bcrypt.compare(plain, hash);
  }
}
