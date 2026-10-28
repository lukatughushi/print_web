import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../lib/api';
import { settingText } from '../lib/settingText';
import SiteFooter from '../components/SiteFooter';
import studioPhoto from '../assets/about/studio.webp';
import s from './AboutPage.module.css';
import { useI18n } from '../i18n/i18n-context';

// Same Google Maps pin as the footer.
const MAP_URL = 'https://maps.app.goo.gl/UDuy3SRruh8H1mS47';
// Shown until admin settings fill in the contacts.
const ADDRESS = 'ქ. თბილისი, ოდესის ქუჩა 14';
const EMAIL = 'prentastudio@gmail.com';

const SERVICES = [
  {
    tag: 'DTF',
    title: 'DTF ბეჭდვა ტექსტილზე',
    text: 'პრენტა გთავაზობთ ტექსტილზე DTF (Direct To Film) ტიპის ბეჭდვას. ვიყენებთ უმაღლესი ხარისხის საღებავებსა და საბეჭდ ფირს, რაც საშუალებას გვაძლევს, მომხმარებელს პრემიუმ ხარისხის მომსახურება შევთავაზოთ. ჩვენ მიერ შექმნილი დიზაინები გამოირჩევა მკვეთრი და კაშკაშა ფერებით: რეცხვისას ფერს არ კარგავს, არ სკდება და სწორი ბეჭდვითი პროცესის შემდეგ ღრმად ჯდება ტექსტილში.',
  },
  {
    tag: 'SCREEN',
    title: 'ტრაფარეტული ბეჭდვა (შოლკოგრაფია)',
    text: 'ტრაფარეტული ბეჭდვა საშუალებას გვაძლევს, დიდი რაოდენობით ბეჭდვის ფასი მინიმუმამდე შევამციროთ. ვიყენებთ ეკოლოგიურად სუფთა საღებავებს, რომლებიც ტექსტილის პიგმენტს ფერს უცვლის. ეს გვაძლევს გარანტიას, რომ ნაბეჭდი არ დაზიანდება ხშირი და მაღალ ტემპერატურაზე რეცხვისას.',
  },
  {
    tag: 'ECO-SOLVENT',
    title: 'ბანერები და სტიკერები',
    text: 'ეკოსოლვენტური პრინტერით გთავაზობთ ბეჭდვას ბანერებზე, ბადე-სტიკერებსა და სტიკერებზე. უახლესი საბეჭდი დანადგარით დაგიმზადებთ როგორც გარე რეკლამას თქვენი ბიზნესისთვის, ასევე ბრენდირებულ სტიკერებს სასურველი დიზაინით.',
  },
  {
    tag: 'UV DTF',
    title: 'ბეჭდვა აქსესუარებზე',
    text: 'ასევე გთავაზობთ ტილოზე ბეჭდვას და დიზაინის დატანას სხვადასხვა აქსესუარზე: ჭიქაზე, კალამზე, დღიურზე, თერმოსსა და ნებისმიერი მყარი ზედაპირის პროდუქტზე. უახლესი დანადგარით (UV DTF) დიზაინი ჯერ სპეციალურ ფირზე იბეჭდება და მხოლოდ ამის შემდეგ გადადის ნებისმიერი ფორმის ნივთის ზედაპირზე. ნაბეჭდი გამოირჩევა მდგრადობითა და მკვეთრი, კაშკაშა ფერებით.',
  },
];

export default function AboutPage() {
  const { t, lang } = useI18n();
  const [settings, setSettings] = useState({});
  const { hash } = useLocation();

  useEffect(() => {
    api.get('/api/settings').then((r) => r.data && setSettings(r.data)).catch(() => {});
  }, []);

  // Footer links open a section (#returns, #privacy).
  useEffect(() => {
    if (!hash) return undefined;
    const tm = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    return () => clearTimeout(tm);
  }, [hash]);

  const address = settingText(settings, 'contactAddress', lang, t) || t(ADDRESS);
  const email = settings.contactEmail || EMAIL;
  const phone = settings.contactPhone || '';

  return (
    <div className={s.page}>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className={s.hero}>
        <div className={s.heroGlow} />
        <div className={s.heroInner}>
          <div className={s.heroText}>
            <span className={s.eyebrow}>{t('ჩვენს შესახებ')}</span>
            <h1 className={s.heroTitle}>{t('ბეჭდვის სტუდია')} <span>{t('2022 წლიდან.')}</span></h1>
            <p className={s.heroLead}>
              {t('კომპანია „პრენტა“ 2022 წელს კერძო ინვესტიციითა და სააგენტო „აწარმოე საქართველოში“-ს დახმარებით შეიქმნა. გთავაზობთ ბრენდირებული სამოსის წარმოებას, სარეკლამო მომსახურებასა და სხვადასხვა აქსესუარის ბრენდირებას, როგორც კომპანიებისთვის, ასევე საცალო მყიდველებისთვის.')}
            </p>
            <div className={s.heroCtas}>
              <Link to="/design/start" className={s.btnPink}>{t('შექმენი დიზაინი')}</Link>
              <Link to="/corporate" className={s.btnLine}>{t('ბიზნესისთვის')}</Link>
            </div>
          </div>
          <figure className={s.photo}>
            <img src={studioPhoto} alt={t('პრენტას საბეჭდი დანადგარები')} width="900" height="1200" />
          </figure>
        </div>
      </section>

      <main className={s.main}>
        {/* ── Mission ───────────────────────────────────── */}
        <section className={s.mission}>
          <span className={s.kicker}>{t('ჩვენი მიზანი')}</span>
          <p className={s.missionText}>
            {t('მომხმარებელს შევთავაზოთ საუკეთესო ხარისხის მომსახურება და პროდუქტი ბაზარზე არსებულ ყველაზე კონკურენტულ ფასად.')}
          </p>
        </section>

        {/* ── Services ──────────────────────────────────── */}
        <section className={s.section}>
          <div className={s.headText}>
            <span className={s.kicker}>{t('რას ვაკეთებთ')}</span>
            <h2 className={s.h2}>{t('ბეჭდვის ტექნოლოგიები')}</h2>
          </div>
          <div className={s.services}>
            {SERVICES.map((sv) => (
              <article key={sv.tag} className={s.service}>
                <span className={s.tag}>{sv.tag}</span>
                <h3 className={s.h3}>{t(sv.title)}</h3>
                <p className={s.text}>{t(sv.text)}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Contacts and policies ─────────────────────── */}
        <section className={s.section}>
          <div className={s.info}>
            <div className={`${s.card} ${s.cardDark}`}>
              <h2 className={s.h3}>{t('კონტაქტი')}</h2>
              <dl className={s.contacts}>
                <dt>{t('მისამართი')}</dt>
                <dd><a href={MAP_URL} target="_blank" rel="noopener noreferrer">{address}</a></dd>
                <dt>{t('ელფოსტა')}</dt>
                <dd><a href={`mailto:${email}`}>{email}</a></dd>
                {phone && (
                  <>
                    <dt>{t('ტელეფონი')}</dt>
                    <dd><a href={`tel:${phone.replace(/\s/g, '')}`}>{phone}</a></dd>
                  </>
                )}
              </dl>
            </div>
            <div id="returns" className={s.card}>
              <h2 className={s.h3}>{t('პროდუქტის დაბრუნება')}</h2>
              <p className={s.text}>{t('შეძენილი პროდუქტის დაბრუნება შესაძლებელია შეძენიდან 14 დღის ვადაში, თუ:')}</p>
              <ol className={s.list}>
                <li>{t('პროდუქტს აქვს საწარმოო წუნი;')}</li>
                <li>{t('პროდუქტი არ არის დაზიანებული, მაგრამ არ შეესაბამება მომხმარებლის მიერ მოთხოვნილ სტანდარტს.')}</li>
              </ol>
              <p className={s.text}>{t('მომხმარებელმა თან უნდა იქონიოს გადახდის დამადასტურებელი ქვითარი, ფიზიკური ან ელექტრონული სახით. თანხა ანგარიშზე დაბრუნდება არაუგვიანეს 2 დღისა.')}</p>
            </div>
            <div id="privacy" className={s.card}>
              <h2 className={s.h3}>{t('კონფიდენციალურობის პოლიტიკა')}</h2>
              <p className={s.text}>{t('პროდუქციის შესყიდვისას მომხმარებლის მიერ გაზიარებული პირადი ინფორმაცია სრულად კონფიდენციალურია და საიტის ადმინისტრაციის მხრიდან მისი გაზიარება დაუშვებელია.')}</p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} />
    </div>
  );
}
