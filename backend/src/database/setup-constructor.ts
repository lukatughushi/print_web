import { setServers } from 'node:dns';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { AppModule } from '../app.module';
import { Product } from '../products/schemas/product.schema';

// Some home routers refuse the SRV lookups mongodb+srv:// needs
// (querySrv ECONNREFUSED); ask public DNS servers instead.
setServers(['1.1.1.1', '8.8.8.8']);

const APPAREL = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
// Seven colours from the built-in palette (frontend/src/lib/catalog.js).
const COLORS = ['white', 'black', 'grey', 'navy', 'red', 'royal', 'bottle'];

// One product per constructor tab; prices include printing (₾).
const PRODUCTS = [
  { category: 'TSHIRT', name: 'მაისური', price: 29, sizes: APPAREL, material: '100% ბამბა' },
  { category: 'POLO', name: 'პოლო', price: 44, sizes: APPAREL, material: 'პიკე ბამბა' },
  { category: 'LONGSLEEVE', name: 'გრძელმკლავიანი მაისური', price: 39, sizes: APPAREL, material: '100% ბამბა' },
  { category: 'POLO_LONGSLEEVE', name: 'გრძელმკლავიანი პოლო', price: 54, sizes: APPAREL, material: 'პიკე ბამბა' },
  { category: 'HOODIE', name: 'ჰუდი ჯიბით', price: 79, sizes: APPAREL, material: 'ბამბის ფუტერი' },
  { category: 'ZIP_HOODIE', name: 'ჰუდი ელვით', price: 89, sizes: APPAREL, material: 'ბამბის ფუტერი' },
  { category: 'BAG', name: 'ჩანთა', price: 24, sizes: [], material: 'კანვასი' },
  { category: 'CAP', name: 'კეპი', price: 29, sizes: [], material: 'ბამბა' },
  { category: 'MUG', name: 'ჭიქა', price: 19, sizes: [], material: 'კერამიკა' },
  { category: 'PILLOW', name: 'ბალიშის პირი', price: 35, sizes: [], material: 'პოლიესტერი' },
];

/**
 * One-off setup: creates the constructor's products (one per tab) with
 * prices, seven colours and sizes. A tab that already has a constructor
 * product is left alone, so it is safe to run again. Everything can be
 * changed afterwards on the admin Constructor page.
 *
 * Dry run:  npm run constructor:setup
 * Create:   npm run constructor:setup -- --yes
 */
async function setupConstructor() {
  const logger = new Logger('SetupConstructor');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const confirmed = process.argv.includes('--yes');

  try {
    const conn = app.get<Connection>(getConnectionToken());
    logger.log(`Database: ${conn.host} / ${conn.name}`);
    const productModel = app.get<Model<Product>>(getModelToken(Product.name));

    const missing = [];
    for (const p of PRODUCTS) {
      if (await productModel.exists({ category: p.category, inConstructor: true })) {
        logger.log(`Exists, skipping: ${p.name}`);
      } else {
        missing.push(p);
        logger.log(`To create: ${p.name} — ${p.price} ₾`);
      }
    }

    if (!confirmed) {
      logger.warn(`Dry run — nothing created (${missing.length} to create). Run again with --yes.`);
      return;
    }
    await productModel.insertMany(
      missing.map((p) => ({
        ...p,
        description: '',
        colors: COLORS,
        inConstructor: true,
        constructorEnabled: true,
        inStock: true,
        isActive: false,
      })),
    );
    logger.log(`Created ${missing.length} constructor products.`);
  } finally {
    await app.close();
  }
}

setupConstructor().catch((err) => {
  console.error(err);
  process.exit(1);
});
