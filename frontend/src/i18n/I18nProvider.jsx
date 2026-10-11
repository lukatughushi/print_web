import { useCallback, useEffect, useMemo, useState } from 'react';
import { I18nContext, LANGS, initialLang, saveLang, setCurrentLang, translate } from './i18n-context';

export default function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLang);

  const setLang = useCallback((code) => {
    if (!LANGS.some((l) => l.code === code)) return;
    setCurrentLang(code);
    saveLang(code);
    setLangState(code);
  }, []);

  useEffect(() => {
    setCurrentLang(lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => ({
    lang,
    setLang,
    t: (key, vars) => translate(key, lang, vars),
    locale: LANGS.find((l) => l.code === lang)?.locale ?? 'ka-GE',
  }), [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
