import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UpdateSettingsDto } from './settings.dto';
import { Settings } from './settings.schema';

// Texts admin may translate, and the languages besides Georgian.
const I18N_FIELDS = ['announcementText', 'heroCtaText', 'proofText', 'contactAddress', 'pickupText'];
const I18N_LANGS = ['en', 'ru'];

/** Keeps only known languages and fields, as trimmed strings. */
function cleanI18n(input: Record<string, Record<string, string>>) {
  const out: Record<string, Record<string, string>> = {};
  for (const lang of I18N_LANGS) {
    const src = input?.[lang];
    if (!src || typeof src !== 'object') continue;
    out[lang] = {};
    for (const field of I18N_FIELDS) {
      if (typeof src[field] === 'string') out[lang][field] = src[field].trim().slice(0, 600);
    }
  }
  return out;
}

/**
 * Facebook "share" links (facebook.com/share/…) hide which page they point
 * to, so the chat button can't build a Messenger link from them. Follow the
 * redirect once and keep the page address it leads to (e.g.
 * facebook.com/profile.php?id=…). Anything else is returned unchanged.
 */
async function resolveFacebookShare(value: string) {
  const raw = value.trim();
  if (!/^(https?:\/\/)?(www\.|m\.)?facebook\.com\/share\//i.test(raw)) return raw;
  try {
    const res = await fetch(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    const location = res.headers.get('location');
    if (!location) return raw;
    const target = new URL(location, 'https://www.facebook.com');
    const id = target.searchParams.get('id');
    if (target.pathname === '/profile.php' && id) return `https://www.facebook.com/profile.php?id=${id}`;
    if (/facebook\.com$/i.test(target.hostname) && target.pathname.length > 1) return `https://www.facebook.com${target.pathname}`;
    return raw;
  } catch {
    return raw;
  }
}

@Injectable()
export class SettingsService {
  constructor(@InjectModel(Settings.name) private readonly settingsModel: Model<Settings>) {}

  /** The settings document, created with defaults on first read. */
  async get() {
    return this.settingsModel
      .findOneAndUpdate({ key: 'site' }, { $setOnInsert: { key: 'site' } }, { upsert: true, new: true, setDefaultsOnInsert: true })
      .exec();
  }

  async update(dto: UpdateSettingsDto) {
    if (dto.categories) await this.checkRemovedCategories(dto.categories.custom.map((c) => c.code));
    await this.get();
    const patch: UpdateSettingsDto = dto.i18n ? { ...dto, i18n: cleanI18n(dto.i18n) } : { ...dto };
    if (patch.chatMessenger) patch.chatMessenger = await resolveFacebookShare(patch.chatMessenger);
    return this.settingsModel.findOneAndUpdate({ key: 'site' }, patch, { new: true, runValidators: true }).exec();
  }

  /** Delivery fee for a subtotal and delivery method, using the current settings. */
  shippingFor(
    subtotal: number,
    settings: Pick<Settings, 'freeShipThreshold' | 'shippingFee' | 'regionShippingFee'>,
    delivery = 'tbilisi',
  ) {
    if (delivery === 'pickup' || subtotal === 0) return 0;
    // A threshold of 0 means there is no free delivery.
    if (settings.freeShipThreshold > 0 && subtotal >= settings.freeShipThreshold) return 0;
    return delivery === 'region' ? (settings.regionShippingFee ?? 15) : settings.shippingFee;
  }

  /** A custom category may only go once no product uses it. */
  private async checkRemovedCategories(keptCodes: string[]) {
    const current = await this.settingsModel.findOne({ key: 'site' }).lean().exec();
    const removed = (current?.categories?.custom ?? []).map((c) => c.code).filter((c) => !keptCodes.includes(c));
    if (!removed.length) return;
    const products = this.settingsModel.db.models.Product;
    const used = products ? await products.distinct('category', { category: { $in: removed } }) : [];
    if (used.length) {
      throw new ConflictException({
        message: `კატეგორიას პროდუქტები აქვს — ჯერ ისინი გადაიტანე ან წაშალე (${used.join(', ')})`,
        code: 'CATEGORY_IN_USE',
      });
    }
  }
}
