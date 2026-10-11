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


/* ── Static defaults (overridden by /api/settings) ─────────── */
const DEFAULT_SETTINGS = {
  announcementText: '',
  announcementActive: false,
  heroCtaText: 'დაიწყე დიზაინი',
  heroCtaLink: '',
  freeShipThreshold: 150,
  currency: '₾',
  contactPhone: '+995 555 12 34 56',
  contactEmail: 'info@prenta.ge',
  contactAddress: 'თბილისი, ჭავჭავაძის 12',
};

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
  { t: 'აირჩიე პროდუქტი', d: '10 კატეგორია, 8 ფერი, XS–XXL ზომები.' },
  { t: 'ატვირთე დიზაინი', d: 'წინ, უკან ან სახელოზე — ფასი მაშინვე ითვლება.' },
  { t: 'მიიღე 3 დღეში', d: null },
];

const STATS = [
  { n: '50+', t: 'რეცხვას უძლებს', d: 'DTF ბეჭდვა არ სკდება და ფერს ინარჩუნებს.' },
  { n: '3 დღე', t: 'შეკვეთიდან კარამდე', d: 'თბილისში — ხშირად მეორე დღესვე.' },
  { n: '100%', t: 'ბამბა', d: 'მაისურები 180–220 გრ/მ² ქსოვილისგან.' },
];


export default function HomePage() {
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

  // Lowest price per category, for the category cards and the hero chip.
  const fromPrice = {};
  products.forEach((p) => {
    const price = priceOf(p);
    if (price > 0 && !(fromPrice[p.category] <= price)) fromPrice[p.category] = price;
  });
  const tileFrom = (tile) => {
    const prices = tile.cats.map((c) => fromPrice[c]).filter((v) => v !== undefined);
    return prices.length ? Math.min(...prices) : tile.from;
  };
  const allPrices = Object.values(fromPrice);
  const lowest = allPrices.length ? Math.min(...allPrices) : 35;

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

  const money = (n) => `${Math.round(n)} ${settings.currency}`;
  const freeShip = Number(settings.freeShipThreshold) || 0;

  return (
    <div className={s.page}>

      {settings.announcementActive && settings.announcementText && (
        <div className={s.announce}>{settings.announcementText}</div>
      )}

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className={s.hero}>
        <div className={s.heroGlow} />
        <div className={s.heroInner}>
          <div className={s.heroCopy}>
            <span className={s.pill}><span className={s.pillBadge}>ახალი</span>ბეჭდვა 1 ცალიდანაც</span>
            <h1 className={s.heroTitle}>შენი იდეა. <br /><span>ჩვენი ბეჭდვა.</span></h1>
            <p className={s.heroText}>
              ატვირთე სურათი, ლოგო ან ტექსტი — დავბეჭდავთ მაისურზე, ჰუდზე, ჩანთაზე, კეპზე ან ჭიქაზე და მოგიტანთ 3 დღეში.
            </p>
            <div className={s.heroCtas}>
              <button type="button" className={`${s.btn} ${s.btnPink} ${s.btnLg}`} onClick={goDesign}>
                {settings.heroCtaText} →
              </button>
              <Link to="/shop" className={`${s.btn} ${s.btnOutline} ${s.btnLg}`}>მზა პროდუქცია</Link>
            </div>
            <div className={s.proof}>
              <div className={s.avatars}>
                {[corpSushi, corpRoofing, corpVlog].map((src) => <img key={src} src={src} alt="" />)}
              </div>
              <div className={s.proofText}>
                <b>2 400+</b> დაბეჭდილი შეკვეთა<br />
                <span className={s.stars}>★★★★★</span> 4.9 შეფასება
              </div>
            </div>
          </div>
          <div className={s.heroArt}>
            <div className={s.heroArtBox}>
              <img className={s.heroImg} src={heroImg} alt="მაისურები" fetchPriority="high" />
              <div className={`${s.chip} ${s.chipA}`}>
                <span className={s.chipIcon}>✓</span>
                <div><div className={s.chipTitle}>მზადაა 3 დღეში</div><div className={s.chipSub}>მიწოდება კარამდე</div></div>
              </div>
              <div className={`${s.chip} ${s.chipB}`}>
                <span className={s.chipIcon}>₾</span>
                <div><div className={s.chipTitle}>{money(lowest)}-დან</div><div className={s.chipSub}>ფასი ბეჭდვით</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ticker ───────────────────────────────────────── */}
      <div className={s.ticker} aria-hidden="true">
        <div className={s.tickerTrack}>
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} className={s.tickerItem}>{t}<span className={s.tickerStar}>✦</span></span>
          ))}
        </div>
      </div>

      <main className={s.main}>

        {/* ── Categories ────────────────────────────────── */}
        <section className={s.section}>
          <div className={s.head}>
            <div className={s.headText}>
              <span className={s.kicker}>კატეგორიები</span>
              <h2 className={s.h2}>რაზე დავბეჭდოთ?</h2>
            </div>
            <Link className={s.more} to="/shop">ყველა პროდუქტი →</Link>
          </div>
          <div className={s.cats}>
            {BENTO.map((b) => (
              <Link key={b.ka} to={`/shop?cat=${b.cats[0]}`} className={s.cat}>
                <span className={s.catMedia}>
                  <img src={b.img} alt={b.ka} loading="lazy" className={b.photo ? s.catPhoto : ''} />
                </span>
                <span className={s.catBar}>
                  <span className={s.catText}>
                    <span className={s.catName}>{b.ka}</span>
                    <span className={s.catFrom}>{money(tileFrom(b))}-დან</span>
                  </span>
                  <span className={s.catArrow}>→</span>
                </span>
              </Link>
            ))}
            <Link to="/shop" className={`${s.cat} ${s.catAll}`}>
              <span className={s.catAllBody}>
                <span className={s.catAllNum}>10</span>
                <span className={s.catAllText}>კატეგორია, 8 ფერი და ზომები XS–XXL</span>
              </span>
              <span className={s.catBar}>
                <span className={s.catName}>ყველა პროდუქტი</span>
                <span className={s.catArrow}>→</span>
              </span>
            </Link>
          </div>
        </section>

        {/* ── How it works ───────────────────────────────── */}
        <section className={s.section}>
          <div className={s.steps}>
            <div className={s.stepsIntro}>
              <span className={s.kicker}>როგორ მუშაობს</span>
              <h2 className={s.h2}>სამი ნაბიჯი შენს პროდუქტამდე</h2>
              <p className={s.muted}>არ გჭირდება დიზაინერი — კონსტრუქტორში ყველაფერს თვითონ ნახავ, ფასსაც ჩათვლით.</p>
              <button type="button" className={`${s.btn} ${s.btnNavy}`} onClick={goDesign}>გახსენი კონსტრუქტორი →</button>
            </div>
            <ol className={s.stepList}>
              {STEPS.map((st, i) => (
                <li key={st.t} className={s.step}>
                  <span className={`${s.stepNum} ${s[`stepNum${i}`]}`}>{i + 1}</span>
                  <div>
                    <div className={s.stepTitle}>{st.t}</div>
                    <div className={s.stepText}>
                      {st.d ?? (freeShip > 0
                        ? `მიწოდება მთელ საქართველოში, ${money(freeShip)}-დან უფასოდ.`
                        : 'მიწოდება მთელ საქართველოში.')}
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
                <span className={s.kicker}>პოპულარული</span>
                <h2 className={s.h2}>ყველაზე გაყიდვადი</h2>
              </div>
              <Link className={s.more} to="/shop">მაღაზიაში გადასვლა →</Link>
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
              <span className={s.kicker}>ბიზნესისთვის</span>
              <h2 className={s.h2}>გუნდის ფორმა, ლოგოთი — 10 ცალიდან</h2>
              <p className={s.corpText}>Modern Roofing, Sushi Icons, Ratto Bistro და კიდევ ათობით კომპანია უკვე ჩვენთან ბეჭდავს.</p>
              <div className={s.corpBtns}>
                <Link to="/corporate#quote" className={`${s.btn} ${s.btnPink}`}>გამოთვალე ფასი →</Link>
                <Link to="/corporate#work" className={`${s.btn} ${s.btnOutline}`}>ნამუშევრები</Link>
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
              <span className={s.statNum}>{st.n}</span>
              <span className={s.statTitle}>{st.t}</span>
              <span className={s.statText}>{st.d}</span>
            </div>
          ))}
        </section>

        {/* ── Final CTA ──────────────────────────────────── */}
        <section className={`${s.section} ${s.sectionEnd}`}>
          <div className={s.final}>
            <h2 className={s.finalTitle}>მზად ხარ? შექმენი პირველი დიზაინი 2 წუთში.</h2>
            <p className={s.finalText}>რეგისტრაცია არ არის საჭირო. ნახე, როგორ გამოიყურება, სანამ შეუკვეთავ.</p>
            <button type="button" className={`${s.btn} ${s.btnNavy} ${s.btnXl}`} onClick={goDesign}>დაიწყე ახლა →</button>
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} />
    </div>
  );
}
