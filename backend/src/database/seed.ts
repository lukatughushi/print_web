import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { Product } from '../products/schemas/product.schema';
import { Role, User } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';

/**
 * Idempotent seed: creates an admin, a demo user and sample products.
 * Run: `npm run seed` (dev) or `npm run seed:prod` (after build, e.g. Render shell).
 * Pass `--reset` to wipe users and products first.
 */
async function seed() {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const reset = process.argv.includes('--reset');

  try {
    const users = app.get(UsersService);
    const userModel = app.get<Model<User>>(getModelToken(User.name));
    const productModel = app.get<Model<Product>>(getModelToken(Product.name));

    if (reset) {
      await Promise.all([userModel.deleteMany({}), productModel.deleteMany({})]);
      logger.warn('Cleared users and products');
    }

    const accounts = [
      {
        name: 'Admin',
        email: process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com',
        password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!',
        role: Role.Admin,
      },
      { name: 'Demo User', email: 'user@example.com', password: 'User1234!', role: Role.User },
    ];

    for (const account of accounts) {
      if (await userModel.exists({ email: account.email.toLowerCase() })) {
        logger.log(`User exists, skipping: ${account.email}`);
        continue;
      }
      await users.create(account);
      logger.log(`Created ${account.role}: ${account.email} / ${account.password}`);
    }

    if ((await productModel.countDocuments()) === 0) {
      await productModel.insertMany([
        { name: 'Classic T-Shirt', description: '100% cotton unisex tee', price: 35, category: 'tshirts' },
        { name: 'Long Sleeve', description: 'Soft long-sleeve crew neck', price: 45, category: 'tshirts' },
        { name: 'Hoodie', description: 'Heavyweight fleece hoodie', price: 79, category: 'hoodies' },
        { name: 'Tote Bag', description: 'Canvas tote with custom print', price: 25, category: 'bags' },
        { name: 'Ceramic Mug', description: '330ml white ceramic mug', price: 20, category: 'mugs' },
        { name: 'Baseball Cap', description: 'Embroidered adjustable cap', price: 30, category: 'caps' },
      ]);
      logger.log('Inserted sample products');
    } else {
      logger.log('Products exist, skipping');
    }
  } finally {
    await app.close();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
