import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { isOnSale, priceOf, starterProduct } from '../lib/catalog';
import ProductCard from '../components/ProductCard';
import SiteFooter from '../components/SiteFooter';
import s from './HomePage.module.css';

import heroImg from '../assets/home/hero.webp';
import teeImg from '../assets/home/tee.webp';
import hoodieImg from '../assets/home/hoodie.webp';
import longsleeveImg from '../assets/home/longsleeve.webp';
import toteImg from '../assets/home/tote.webp';
import capImg from '../assets/home/cap.webp';
import mugImg from '../assets/home/mug.webp';
import corpRoofing from '../assets/corp/roofing-2.webp';
import corpSushi from '../assets/corp/sushi.webp';
import corpVlog from '../assets/corp/vlog-1.webp';
import corpFestival from '../assets/corp/festival-1.webp';
import corpDelfi from '../assets/corp/delfi-1.webp';
import { useI18n } from '../i18n/i18n-context';


/* ── Defaults until /api/settings arrives. Texts edited in admin have no
   fallback: what admin leaves empty is not shown at all. ──────────── */
const DEFAULT_SETTINGS = {
  announcementText: '',
  announcementActive: false,
  heroCtaText: '',
  heroCtaLink: '',
  proofNumber: '',
  proofText: '',
  freeShipThreshold: 150,
  currency: '₾',
  contactPhone: '',
  contactEmail: '',
  contactAddress: '',
};

// Starting price shown on the hero chip (a printed T-shirt).
const HERO_FROM_PRICE = 29;

// Category cards. `cats` are the shop categories whose lowest price the tile shows;
// `from` is the fallback while products load.
const BENTO = [
  { ka: 'მაისური', cats: ['TSHIRT'], img: teeImg, from: 35 },
  { ka: 'ჰუდი', cats: ['HOODIE', 'ZIP_HOODIE'], img: hoodieImg, from: 89 },
  { ka: 'პოლო', cats: ['POLO', 'POLO_LONGSLEEVE'], img: corpRoofing, from: 45, photo: true },
  { ka: 'გრძელმკლავიანი', cats: ['LONGSLEEVE'], img: longsleeveImg, from: 55 },
  { ka: 'ჩანთა', cats: ['BAG'], img: toteImg, from: 29 },
  { ka: 'კეპი', cats: ['CAP'], img: capImg, from: 39 },
  { ka: 'ჭიქა', cats: ['MUG'], img: mugImg, from: 25 },
];

const TICKER = ['მაისური', 'ჰუდი', 'პოლო', 'ბომბერი', 'ჩანთა', 'კეპი', 'ჭიქა', 'DTF ბეჭდვა', '1 ცალიდან', 'მიწოდება 3 დღეში'];

const STEPS = [
  { t: 'აირჩიე პროდუქტი', d: 'ფერების ფართო არჩევანი, ზომები XS-დან 3XL-მდე.' },
  { t: 'ატვირთე სასურველი დიზაინი', d: 'დაიტანე შენი დიზაინი პროდუქტის ნებისმიერ ნაწილზე.' },
  { t: 'მიიღე შეკვეთა 3 დღეში', d: 'მიწოდება მთელი საქართველოს მასშტაბით.' },
];

const STATS = [
  { n: '200+', t: 'რეცხვა', d: 'ვიყენებთ უმაღლესი ხარისხის საბეჭდ მასალას — ნაბეჭდი არ სკდება და არ იცვლის ფერს.' },
  { n: '3 დღე', t: 'შეკვეთიდან კარამდე', d: 'თბილისში მიწოდება მეორე დღეს.' },
  { n: '100%', t: 'ბამბის, პრემიალური ხარისხის მაისურები', d: 'გთავაზობთ 150, 180, 200 და 300 გრამიან მაისურებს.' },
];


export default function HomePage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  /* ── Settings ───────────────────────────────────────────── */
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  useEffect(() => {
    api.get('/api/settings')
      .then((r) => setSettings({ ...DEFAULT_SETTINGS, ...Object.fromEntries(
        Object.entries(r.data || {}).filter(([, v]) => v !== null && v !== undefined && v !== ''),
      ) }))
      .catch(() => {});
  }, []);

  /* ── Products ───────────────────────────────────────────── */
  const [products, setProducts] = useState([]);
  useEffect(() => {
    api.get('/api/products').then((r) => setProducts(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const firstProductId = starterProduct(products)?.id;
  const designLink = settings.heroCtaLink || (firstProductId ? `/design/${firstProductId}` : '/shop');
  const goDesign = () => navigate(designLink.startsWith('/') ? designLink : '/shop');

  // Lowest price per category, for the category cards.
  const fromPrice = {};
  products.forEach((p) => {
    const price = priceOf(p);
    if (price > 0 && !(fromPrice[p.category] <= price)) fromPrice[p.category] = price;
  });
  const tileFrom = (tile) => {
    const prices = tile.cats.map((c) => fromPrice[c]).filter((v) => v !== undefined);
    return prices.length ? Math.min(...prices) : tile.from;
  };

  // Best sellers: discounted first, then new arrivals, one of each category at most.
  const popular = [];
  const seen = new Set();
  [...products]
    .sort((a, b) => Number(isOnSale(b)) - Number(isOnSale(a)) || Number(!!b.newArrival) - Number(!!a.newArrival))
    .forEach((p) => {
      if (popular.length < 6 && !seen.has(p.category)) {
        seen.add(p.category);
        popular.push(p);
      }
    });

  // Orders line under the hero buttons, edited in admin settings.
  const hasOrders = Boolean(settings.proofNumber || settings.proofText);
  const money = (n) => `${Math.round(n)} ${settings.currency}`;

  return (
    <div className={s.page}>

      {settings.announcementActive && settings.announcementText && (
        <div className={s.announce}>{t(settings.announcementText)}</div>
      )}

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className={s.hero}>
        <div className={s.heroGlow} />
        <div className={s.heroInner}>
          <div className={s.heroCopy}>
            <h1 className={s.heroTitle}>{t('შექმენი შენი დიზაინი')} <br /><span>{t('ჩვენთან.')}</span></h1>
            <p className={s.heroText}>
              {t('ატვირთე სურათი, ლოგო ან ტექსტი — მიიღე უმაღლესი ხარისხის ბეჭდვითი მომსახურება „პრენტასგან“.')}
            </p>
            <div className={s.heroCtas}>
              {settings.heroCtaText && (
                <button type="button" className={`${s.btn} ${s.btnPink} ${s.btnLg}`} onClick={goDesign}>
                  {t(settings.heroCtaText)}
                </button>
              )}
              <Link to="/shop" className={`${s.btn} ${s.btnOutline} ${s.btnLg}`}>{t('მზა პროდუქცია')}</Link>
            </div>
            <div className={s.proof}>
              <div className={s.avatars}>
                {[corpSushi, corpRoofing, corpVlog].map((src) => <img key={src} src={src} alt="" />)}
              </div>
              <div className={s.proofText}>
                {hasOrders && (
                  <>
                    {settings.proofNumber && <b>{settings.proofNumber}</b>} {settings.proofText && t(settings.proofText)}
                    <br />
                  </>
                )}
                <span className={s.stars}>★★★★★</span> {t('4.9 შეფასება')}
              </div>
            </div>
          </div>
          <div className={s.heroArt}>
            <div className={s.heroArtBox}>
              <img className={s.heroImg} src={heroImg} alt={t('მაისურები')} fetchPriority="high" />
              <div className={`${s.chip} ${s.chipA}`}>
                <span className={s.chipIcon}>✓</span>
                <div><div className={s.chipTitle}>{t('მზადდება 2 სამუშაო დღეში')}</div><div className={s.chipSub}>{t('მიწოდება მესამე დღეს')}</div></div>
              </div>
              <div className={`${s.chip} ${s.chipB}`}>
                <span className={s.chipIcon}>₾</span>
                <div><div className={s.chipTitle}>{t('{price}-დან', { price: money(HERO_FROM_PRICE) })}</div><div className={s.chipSub}>{t('საფასური ბეჭდვით')}</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ticker ───────────────────────────────────────── */}
      <div className={s.ticker} aria-hidden="true">
        <div className={s.tickerTrack}>
          {[...TICKER, ...TICKER].map((word, i) => (
            <span key={i} className={s.tickerItem}>{t(word)}<span className={s.tickerStar}>✦</span></span>
          ))}
        </div>
      </div>

      <main className={s.main}>

        {/* ── Categories ────────────────────────────────── */}
        <section className={s.section}>
          <div className={s.head}>
            <div className={s.headText}>
              <span className={s.kicker}>{t('კატეგორიები')}</span>
              <h2 className={s.h2}>{t('რაზე დავბეჭდოთ?')}</h2>
            </div>
            <Link className={s.more} to="/shop">{t('ყველა პროდუქტი →')}</Link>
          </div>
          <div className={s.cats}>
            {BENTO.map((b) => (
              <Link key={b.ka} to={`/shop?cat=${b.cats[0]}`} className={s.cat}>
                <span className={s.catMedia}>
                  <img src={b.img} alt={t(b.ka)} loading="lazy" className={b.photo ? s.catPhoto : ''} />
                </span>
                <span className={s.catBar}>
                  <span className={s.catText}>
                    <span className={s.catName}>{t(b.ka)}</span>
                    <span className={s.catFrom}>{t('{price}-დან', { price: money(tileFrom(b)) })}</span>
                  </span>
                  <span className={s.catArrow}>→</span>
                </span>
              </Link>
            ))}
            <Link to="/shop" className={`${s.cat} ${s.catAll}`}>
              <span className={s.catAllBody}>
                <span className={s.catAllTitle}>{t('მრავალფეროვანი არჩევანი')}</span>
                <span className={s.catAllText}>{t('ზომები XS-დან XL-მდე.')}</span>
              </span>
              <span className={s.catBar}>
                <span className={s.catName}>{t('ყველა პროდუქტი')}</span>
                <span className={s.catArrow}>→</span>
              </span>
            </Link>
          </div>
        </section>

        {/* ── How it works ───────────────────────────────── */}
        <section className={s.section}>
          <div className={s.steps}>
            <div className={s.stepsIntro}>
              <span className={s.kicker}>{t('როგორ მუშაობს')}</span>
              <h2 className={s.h2}>{t('სამი ნაბიჯი შენს პროდუქტამდე')}</h2>
              <p className={s.muted}>{t('შექმენი შენი დიზაინი, გადაიხადე საფასური და მიიღე პროდუქტი სასურველ მისამართზე. ყველაფერი ერთ სივრცეში — გამოიყენე ჩვენი კონსტრუქტორი.')}</p>
              <button type="button" className={`${s.btn} ${s.btnNavy}`} onClick={goDesign}>{t('გახსენი კონსტრუქტორი')}</button>
            </div>
            <ol className={s.stepList}>
              {STEPS.map((st, i) => (
                <li key={st.t} className={s.step}>
                  <span className={`${s.stepNum} ${s[`stepNum${i}`]}`}>{i + 1}</span>
                  <div>
                    <div className={s.stepTitle}>{t(st.t)}</div>
                    <div className={s.stepText}>
                      {t(st.d)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Best sellers ───────────────────────────────── */}
        {popular.length > 0 && (
          <section className={s.section}>
            <div className={s.head}>
              <div className={s.headText}>
                <span className={s.kicker}>{t('პოპულარული')}</span>
                <h2 className={s.h2}>{t('ყველაზე გაყიდვადი')}</h2>
              </div>
              <Link className={s.more} to="/shop">{t('მაღაზიაში გადასვლა →')}</Link>
            </div>
            <div className={s.products}>
              {popular.map((p) => <ProductCard key={p.id} product={p} currency={settings.currency} />)}
            </div>
          </section>
        )}

        {/* ── Corporate ──────────────────────────────────── */}
        <section className={s.section}>
          <div className={s.corp}>
            <div className={s.corpBody}>
              <span className={s.kicker}>{t('ბიზნესისთვის')}</span>
              <h2 className={s.h2}>{t('ფორმა შენი გუნდისთვის — საბითუმო შეთავაზება 10 ცალიდან')}</h2>
              <p className={s.corpText}>{t('Modern Roofing, Sushi Icons, Ratto Bistro და კიდევ ათობით კომპანიამ უკვე გამოსცადა ჩვენი მომსახურება.')}</p>
              <div className={s.corpBtns}>
                <Link to="/corporate#quote" className={`${s.btn} ${s.btnPink}`}>{t('გამოთვალე ფასი')}</Link>
                <Link to="/corporate#work" className={`${s.btn} ${s.btnOutline}`}>{t('ნამუშევრები')}</Link>
              </div>
            </div>
            <div className={s.corpMosaic}>
              <span className={`${s.corpCell} ${s.corpBig}`}><img src={corpRoofing} alt="" loading="lazy" /></span>
              <span className={s.corpCell}><img src={corpFestival} alt="" loading="lazy" /></span>
              <span className={s.corpCell}><img src={corpDelfi} alt="" loading="lazy" /></span>
            </div>
          </div>
        </section>

        {/* ── Stats ──────────────────────────────────────── */}
        <section className={`${s.section} ${s.stats}`}>
          {STATS.map((st) => (
            <div key={st.n} className={s.stat}>
              <span className={s.statNum}>{t(st.n)}</span>
              <span className={s.statTitle}>{t(st.t)}</span>
              <span className={s.statText}>{t(st.d)}</span>
            </div>
          ))}
        </section>

        {/* ── Final CTA ──────────────────────────────────── */}
        <section className={`${s.section} ${s.sectionEnd}`}>
          <div className={s.final}>
            <h2 className={s.finalTitle}>{t('მზად ხარ? შექმენი პირველი დიზაინი 2 წუთში.')}</h2>
            <p className={s.finalText}>{t('რეგისტრაცია არ არის საჭირო. ნახე, როგორ გამოიყურება, ვიდრე შეუკვეთავ.')}</p>
            <button type="button" className={`${s.btn} ${s.btnNavy} ${s.btnXl}`} onClick={goDesign}>{t('დაიწყე ახლა')}</button>
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} />
    </div>
  );
}
