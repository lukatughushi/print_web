import { setServers } from 'node:dns';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model, isValidObjectId, mongo } from 'mongoose';
import sharp from 'sharp';
import { AppModule } from '../app.module';
import { Product } from '../products/schemas/product.schema';
import { Settings } from '../settings/settings.schema';

// Some home routers refuse the SRV lookups mongodb+srv:// needs
// (querySrv ECONNREFUSED); ask public DNS servers instead.
setServers(['1.1.1.1', '8.8.8.8']);

// Shop photos and hero designs are shown at most ~800 px wide; 1600 covers sharp screens.
const MAX_SIDE = 1600;
const MIN_BYTES = 400 * 1024; // smaller files are left as they are

async function readFile(bucket: mongo.GridFSBucket, id: mongo.ObjectId) {
  const chunks: Buffer[] = [];
  for await (const chunk of bucket.openDownloadStream(id)) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

function writeFile(bucket: mongo.GridFSBucket, buffer: Buffer, filename: string, metadata: object) {
  return new Promise<mongo.ObjectId>((resolve, reject) => {
    const stream = bucket.openUploadStream(filename, { metadata });
    stream.on('error', reject).on('finish', () => resolve(stream.id as mongo.ObjectId));
    stream.end(buffer);
  });
}

/**
 * One-off: re-encodes the oversized shop product photos and hero rack designs
 * (often 7–10 MB PNGs) as WebP of at most 1600 px, then deletes the originals.
 * This frees database space and backend bandwidth. Customers' uploads and
 * order print files are never touched: they must keep full print quality.
 * Transparency is kept. Safe to run again: small files are skipped.
 *
 * Dry run:  npm run images:compress
 * Apply:    npm run images:compress -- --yes
 */
async function compressImages() {
  const logger = new Logger('CompressImages');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const confirmed = process.argv.includes('--yes');

  try {
    const conn = app.get<Connection>(getConnectionToken());
    logger.log(`Database: ${conn.host} / ${conn.name}`);
    const bucket = new mongo.GridFSBucket(conn.db!, { bucketName: 'uploads' });
    const productModel = app.get<Model<Product>>(getModelToken(Product.name));
    const settingsModel = app.get<Model<Settings>>(getModelToken(Settings.name));

    // Every product photo and hero design, with how to point it at the new file.
    const targets: { id: string; label: string; repoint: (newId: string) => Promise<unknown> }[] = [];
    for (const p of await productModel.find({}, { image: 1, name: 1 }).lean()) {
      if (isValidObjectId(p.image)) {
        targets.push({
          id: p.image!,
          label: `product "${p.name}"`,
          repoint: (newId) => productModel.updateOne({ _id: p._id, image: p.image }, { image: newId }),
        });
      }
    }
    const settings = await settingsModel.findOne({ key: 'site' }, { heroRack: 1 }).lean();
    for (const d of settings?.heroRack ?? []) {
      if (isValidObjectId(d.image)) {
        targets.push({
          id: d.image,
          label: `hero design ${d.slot + 1}`,
          repoint: (newId) => settingsModel.updateOne({ key: 'site', 'heroRack.slot': d.slot }, { $set: { 'heroRack.$.image': newId } }),
        });
      }
    }

    let before = 0, after = 0, done = 0;
    const converted = new Map<string, string>(); // one photo may be used twice
    for (const t of targets) {
      const oid = new mongo.ObjectId(t.id);
      const [file] = await bucket.find({ _id: oid }).limit(1).toArray();
      if (!file) { logger.warn(`Missing file for ${t.label}, skipping`); continue; }
      if (converted.has(t.id)) {
        if (confirmed) await t.repoint(converted.get(t.id)!);
        continue;
      }
      if (file.length < MIN_BYTES) { logger.log(`Small already (${Math.round(file.length / 1024)} KB): ${t.label}`); continue; }

      const input = await readFile(bucket, oid);
      const output = await sharp(input)
        .rotate()
        .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85, alphaQuality: 100 })
        .toBuffer();
      if (output.length >= file.length) { logger.log(`No gain, skipping: ${t.label}`); continue; }

      before += file.length;
      after += output.length;
      done++;
      logger.log(`${t.label}: ${(file.length / 1e6).toFixed(2)} MB → ${(output.length / 1e6).toFixed(2)} MB`);
      if (!confirmed) { converted.set(t.id, ''); continue; }

      const name = String(file.filename || 'image').replace(/\.[a-z0-9]+$/i, '') + '.webp';
      const newId = await writeFile(bucket, output, name, { ...file.metadata, contentType: 'image/webp' });
      await t.repoint(newId.toString());
      converted.set(t.id, newId.toString());
    }

    // Originals go only after everything points at the new files.
    if (confirmed) for (const oldId of converted.keys()) await bucket.delete(new mongo.ObjectId(oldId)).catch(() => undefined);

    const mb = (n: number) => (n / 1e6).toFixed(1);
    logger.log(`${done} image(s): ${mb(before)} MB → ${mb(after)} MB`);
    if (!confirmed) logger.warn('Dry run — nothing changed. Run again with --yes.');
  } finally {
    await app.close();
  }
}

compressImages().catch((err) => {
  console.error(err);
  process.exit(1);
});
