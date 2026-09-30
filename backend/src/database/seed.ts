import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { Product } from '../products/schemas/product.schema';
import { Role, User } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { buildCatalog, CATALOG_CATEGORY_CODES } from './catalog';

/**
 * Idempotent seed: creates an admin, a demo user and the demo catalogue
 * (20 products per storefront category, see ./catalog.ts).
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

    // Old demo rows used lowercase categories the storefront doesn't know.
    const legacy = await productModel.deleteMany({
      category: { $in: ['tshirts', 'hoodies', 'bags', 'mugs', 'caps'] },
    });
    if (legacy.deletedCount) logger.log(`Removed ${legacy.deletedCount} legacy sample products`);

    if ((await productModel.countDocuments({ category: { $in: CATALOG_CATEGORY_CODES } })) === 0) {
      const catalog = buildCatalog();
      await productModel.insertMany(catalog);
      logger.log(`Inserted ${catalog.length} catalogue products`);
    } else {
      logger.log('Catalogue products exist, skipping');
    }
  } finally {
    await app.close();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
