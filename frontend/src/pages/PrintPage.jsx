import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { PRINT_PAGES } from '../lib/printPages';
import SiteFooter from '../components/SiteFooter';
import teeImg from '../assets/home/tee.webp';
import hoodieImg from '../assets/home/hoodie.webp';
import poloImg from '../assets/corp/roofing-2.webp';
import s from './PrintPage.module.css';
import { useI18n } from '../i18n/i18n-context';

const IMAGES = { tee: teeImg, hoodie: hoodieImg, polo: poloImg };

const STEPS = [
  ['აირჩიე პროდუქტი', 'ფერების ფართო არჩევანი, ზომები XS-დან 3XL-მდე.'],
  ['ატვირთე სასურველი დიზაინი', 'დაიტანე შენი დიზაინი პროდუქტის ნებისმიერ ნაწილზე.'],
  ['მიიღე შეკვეთა 3 დღეში', 'მიწოდება მთელი საქართველოს მასშტაბით.'],
];

/** A search landing page ("print on a T-shirt" and so on), see lib/printPages. */
export default function PrintPage({ page }) {
  const { t } = useI18n();
  const [settings, setSettings] = useState({});

  useEffect(() => {
    api.get('/api/settings').then((r) => r.data && setSettings(r.data)).catch(() => {});
  }, []);

  return (
    <div className={s.page}>
      <section className={s.hero}>
        <div className={s.heroGlow} />
        <div className={s.heroInner}>
          <div className={s.heroText}>
            <h1 className={s.heroTitle}>{t(page.h1)}</h1>
            <p className={s.heroLead}>{t(page.lead)}</p>
            <div className={s.heroCtas}>
              <Link to="/design/start" className={s.btnPink}>{t('შექმენი დიზაინი')}</Link>
              <Link to={`/shop?cat=${page.shopCats}`} className={s.btnLine}>{t('მზა პროდუქცია')}</Link>
            </div>
          </div>
          <img className={s.heroImg} src={IMAGES[page.img]} alt={t(page.h1)} />
        </div>
      </section>

      <main className={s.main}>
        <section className={s.points}>
          {page.points.map(([title, text]) => (
            <div key={title} className={s.point}>
              <h2>{t(title)}</h2>
              <p>{t(text)}</p>
            </div>
          ))}
        </section>

        <section className={s.section}>
          <h2 className={s.h2}>{t('როგორ მუშაობს')}</h2>
          <ol className={s.steps}>
            {STEPS.map(([title, text]) => (
              <li key={title}><b>{t(title)}</b><span>{t(text)}</span></li>
            ))}
          </ol>
        </section>

        <section className={s.section}>
          <h2 className={s.h2}>{t('ხშირად დასმული კითხვები')}</h2>
          <div className={s.faq}>
            {page.faq.map(([q, a]) => (
              <div key={q}>
                <h3>{t(q)}</h3>
                <p>{t(a)}</p>
              </div>
            ))}
          </div>
        </section>

        <nav className={s.others} aria-label={t('სხვა პროდუქტები')}>
          {PRINT_PAGES.filter((p) => p !== page).map((p) => (
            <Link key={p.path} to={p.path}>{t(p.label)} →</Link>
          ))}
          <Link to="/corporate">{t('კორპორატიული შეკვეთები')} →</Link>
        </nav>
      </main>

      <SiteFooter settings={settings} />
    </div>
  );
}
