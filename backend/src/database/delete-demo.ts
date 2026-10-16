import { setServers } from 'node:dns';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { AppModule } from '../app.module';
import { Product } from '../products/schemas/product.schema';
import { buildCatalog } from './catalog';

/**
 * One-off cleanup: deletes the demo catalogue inserted by the seed (matched
 * by category + name, see ./catalog.ts), all of it. Products added in admin
 * are never touched. Orders keep their own copy of each line, so they are
 * unaffected. A constructor tab with no product left can't take orders
 * until a product of that category is added in admin.
 *
 * Dry run (lists what would go):  npm run demo:delete
 * Delete for real:                npm run demo:delete -- --yes
 * (after a build: demo:delete:prod)
 */
// Some home routers refuse the SRV lookups mongodb+srv:// needs
// (querySrv ECONNREFUSED); ask public DNS servers instead.
setServers(['1.1.1.1', '8.8.8.8']);

async function deleteDemo() {
  const logger = new Logger('DeleteDemo');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const confirmed = process.argv.includes('--yes');

  try {
    // Which database this is (host and name only, never the password).
    const conn = app.get<Connection>(getConnectionToken());
    logger.log(`Database: ${conn.host} / ${conn.name}`);

    const productModel = app.get<Model<Product>>(getModelToken(Product.name));
    const demo = new Set(buildCatalog().map((p) => `${p.category}|${p.name}`));

    const rows = await productModel.find({}).select('_id name category').lean().exec();
    const doomed = rows.filter((p) => demo.has(`${p.category}|${p.name}`));
    rows
      .filter((p) => !doomed.includes(p))
      .forEach((p) => logger.log(`Keeping (added in admin): ${p.category} — ${p.name}`));
    logger.log(`Products in database: ${rows.length}; demo products to delete: ${doomed.length}`);

    if (!confirmed) {
      logger.warn('Dry run — nothing deleted. Run again with --yes to delete.');
      return;
    }
    const res = await productModel.deleteMany({ _id: { $in: doomed.map((p) => p._id) } }).exec();
    logger.log(`Deleted ${res.deletedCount} demo products; ${rows.length - res.deletedCount} remain.`);
  } finally {
    await app.close();
  }
}

deleteDemo().catch((err) => {
  console.error(err);
  process.exit(1);
});
