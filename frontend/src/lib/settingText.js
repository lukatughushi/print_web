/**
 * An admin text in the current language: the English / Russian version
 * written in admin settings (settings.i18n), otherwise the Georgian text
 * run through the site dictionary.
 */
export function settingText(settings, key, lang, t) {
  const own = lang !== 'ka' ? settings?.i18n?.[lang]?.[key] : '';
  if (own) return own;
  const ka = settings?.[key];
  return ka ? t(ka) : '';
}
