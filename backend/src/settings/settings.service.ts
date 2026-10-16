import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UpdateSettingsDto } from './settings.dto';
import { Settings } from './settings.schema';

// Texts admin may translate, and the languages besides Georgian.
const I18N_FIELDS = ['announcementText', 'heroCtaText', 'proofText', 'contactAddress'];
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
    await this.get();
    const patch = dto.i18n ? { ...dto, i18n: cleanI18n(dto.i18n) } : dto;
    return this.settingsModel.findOneAndUpdate({ key: 'site' }, patch, { new: true, runValidators: true }).exec();
  }

  /** Delivery fee for a subtotal, using the current settings. */
  shippingFor(subtotal: number, settings: Pick<Settings, 'freeShipThreshold' | 'shippingFee'>) {
    return subtotal === 0 || subtotal >= settings.freeShipThreshold ? 0 : settings.shippingFee;
  }
}
