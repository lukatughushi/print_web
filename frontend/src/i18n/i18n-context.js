import { createContext, useContext } from 'react';
import en from './en';
import ru from './ru';

export const LANGS = [
  { code: 'ka', label: 'ქა', name: 'ქართული', locale: 'ka-GE' },
  { code: 'en', label: 'EN', name: 'English', locale: 'en-GB' },
  { code: 'ru', label: 'RU', name: 'Русский', locale: 'ru-RU' },
];

const DICTS = { en, ru };
const STORAGE_KEY = 'lang';

export function initialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGS.some((l) => l.code === saved)) return saved;
  } catch { /* storage blocked */ }
  return 'ka';
}

export function saveLang(code) {
  try { localStorage.setItem(STORAGE_KEY, code); } catch { /* not persisted */ }
}

// Current language for code outside React (e.g. the cart toast).
let current = initialLang();
export const currentLang = () => current;
export const setCurrentLang = (code) => { current = code; };

/**
 * Georgian text is the key: translate('მაღაზია', 'en') → 'Shop'. Missing
 * entries fall back to Georgian. {name} placeholders are filled from vars.
 */
export function translate(key, lang = current, vars) {
  const text = (lang !== 'ka' && DICTS[lang]?.[key]) || key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, name) => (vars[name] ?? m));
}

export const I18nContext = createContext({
  lang: 'ka',
  setLang: () => {},
  t: (key, vars) => translate(key, 'ka', vars),
  locale: 'ka-GE',
});

export function useI18n() {
  return useContext(I18nContext);
}
