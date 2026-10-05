import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UpdateSettingsDto } from './settings.dto';
import { Settings } from './settings.schema';

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
    return this.settingsModel.findOneAndUpdate({ key: 'site' }, dto, { new: true, runValidators: true }).exec();
  }

  /** Delivery fee for a subtotal, using the current settings. */
  shippingFor(subtotal: number, settings: Pick<Settings, 'freeShipThreshold' | 'shippingFee'>) {
    return subtotal === 0 || subtotal >= settings.freeShipThreshold ? 0 : settings.shippingFee;
  }
}
