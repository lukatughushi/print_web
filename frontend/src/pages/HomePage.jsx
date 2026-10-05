import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { CATEGORIES, isOnSale, priceOf } from '../lib/catalog';
import ProductCard, { ProductImage } from '../components/ProductCard';
import SiteFooter from '../components/SiteFooter';
import s from './HomePage.module.css';

import heroTshirt from '../assets/prenta/home_tshirt.webp';
import mainHoodie from '../assets/prenta/main_hoode.webp';

import { API_URL as API_BASE } from '../lib/config';

/* ── Static defaults (overridden by /api/settings) ─────────── */
const DEFAULT_SETTINGS = {
  announcementText: '★ 2 400+ დაბეჭდილი შეკვეთა · ბეჭდვა 3 დღეში · მიწოდება მთელ საქართველოში',
  announcementActive: true,
  heroTitle: 'დაბეჭდე საკუთარი დიზაინი',
  heroSubtitle:
    'ატვირთე სურათი ან დაწერე ტექსტი, აწყვე დიზაინი პირდაპირ ბრაუზერში და მიიღე მზა პროდუქტი 3 დღეში. მინიმალური შეკვეთა — 1 ცალი.',
  heroCtaText: 'დაიწყე დიზაინი',
  heroCtaLink: '',
  freeShipThreshold: 150,
  currency: '₾',
  contactPhone: '+995 555 12 34 56',
  contactEmail: 'info@prenta.ge',
  contactAddress: 'თბილისი, ჭავჭავაძის 12',
};

const STEPS = [
  { n: '01', t: 'აწყვე დიზაინი', d: 'ატვირთე ლოგო ან სურათი, დაამატე ტექსტი და მზა ემბლემები — წინ, უკან და სახელოებზე.' },
  { n: '02', t: 'ნახე ფასი მაშინვე', d: 'ფასი ცოცხლად ითვლება: პროდუქტი + ბეჭდვის ზონები + რაოდენობა. ფარული ხარჯების გარეშე.' },
  { n: '03', t: 'მიიღე 3 დღეში', d: 'ვბეჭდავთ, ვაფუთავთ და კურიერით ვაგზავნით მთელ საქართველოში. 150 ₾-დან უფასოდ.' },
];

const WHY = [
  { t: 'ბრაუზერის კონსტრუქტორი', d: 'ოთხი ბეჭდვის ზონა, ფენები, შრიფტები და ბეჭდვის საზღვარი — პროგრამის ჩამოტვირთვის გარეშე.' },
  { t: '1 ცალიც ისეთივე ფასია', d: 'მინიმალური შეკვეთა არ არსებობს. დაბეჭდე ერთი მაისური საჩუქრად ან 200 ცალი გუნდისთვის.' },
  { t: 'DTF ბეჭდვა', d: 'ნათელი ფერები მუქ ქსოვილზეც, 50+ რეცხვის შემდეგაც არ სკდება და არ ცვივა.' },
  { t: 'ფასი გამჭვირვალედ', d: 'პროდუქტი + ბეჭდვის ზონა × რაოდენობა. ჯამს ხედავ დიზაინის აწყობის დროსვე.' },
  { t: 'მიწოდება 2–3 დღეში', d: 'კურიერი მთელ საქართველოში, 150 ₾-დან უფასოდ. თბილისში — მეორე დღეს.' },
  { t: 'დიზაინის დახმარება', d: 'გვიგზავნი იდეას — ჩვენი დიზაინერი ბეჭდვისთვის ამზადებს ფაილს უფასოდ.' },
];

const REVIEWS = [
  { q: 'ბენდის მერჩი ვთხოვეთ 40 მაისურზე — ორ დღეში მზად იყო და ფერები ზუსტად ისეთია, როგორც ეკრანზე ვნახეთ.', n: 'ნიკა, მუსიკოსი' },
  { q: 'კონსტრუქტორი ისეთი მარტივია, რომ დედაჩემმაც აწყო შვილიშვილისთვის ჰუდი. ბეჭდვა რეცხვის შემდეგ არ შეცვლილა.', n: 'ანა, თბილისი' },
  { q: 'ჩვენი კაფესთვის 25 ჩანთა და 30 ჭიქა დავბეჭდეთ. ერთი შეკვეთით, ერთი ფასით — ძალიან მოსახერხებელია.', n: 'გიორგი, კაფე „ჩრდილი“' },
];

function Chevron({ dir = 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points={dir === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

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

  const firstProductId = products[0]?.id;
  const designLink = settings.heroCtaLink || (firstProductId ? `/design/${firstProductId}` : '/');
  const goDesign = () => navigate(designLink.startsWith('/') ? designLink : '/');
  const goShop = () => navigate('/shop');

  // Lowest price per category, for the category tiles.
  const fromPrice = {};
  products.forEach((p) => {
    const price = priceOf(p);
    if (price > 0 && !(fromPrice[p.category] <= price)) fromPrice[p.category] = price;
  });

  // Featured: discounted first, then new arrivals, one of each category at most.
  const featured = [];
  const seen = new Set();
  [...products]
    .sort((a, b) => Number(isOnSale(b)) - Number(isOnSale(a)) || Number(!!b.newArrival) - Number(!!a.newArrival))
    .forEach((p) => {
      if (featured.length < 10 && !seen.has(p.category)) {
        seen.add(p.category);
        featured.push(p);
      }
    });

  /* ── Dynamic banners → slider ───────────────────────────── */
  const [banners, setBanners] = useState(null); // null = loading, [] = none
  useEffect(() => {
    api.get('/api/banners').then((r) => setBanners(Array.isArray(r.data) ? r.data : [])).catch(() => setBanners([]));
  }, []);

  const [slide, setSlide] = useState(0);
  const timerRef = useRef(null);
  const slideCount = banners?.length || 0;

  const goTo = useCallback((idx) => {
    if (!slideCount) return;
    setSlide((idx + slideCount) % slideCount);
  }, [slideCount]);

  useEffect(() => {
    if (slideCount < 2) return undefined;
    timerRef.current = setInterval(() => setSlide((x) => (x + 1) % slideCount), 5000);
    return () => clearInterval(timerRef.current);
  }, [slideCount]);

  const nudge = (dir) => {
    clearInterval(timerRef.current);
    goTo(slide + dir);
  };

  const money = (n) => `${Math.round(n)} ${settings.currency}`;
  const hasBanners = Array.isArray(banners) && banners.length > 0;
  const safeSlide = Math.min(slide, Math.max(0, slideCount - 1));

  return (
    <div className={s.page}>

      {/* ── Announcement bar ─────────────────────────────── */}
      {settings.announcementActive && settings.announcementText && (
        <div className={s.announce}>{settings.announcementText}</div>
      )}

      {/* ── Hero / Slider ────────────────────────────────── */}
      {banners === null ? (
        <div className={s.sliderLoading}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="16" stroke="#EF5F79" strokeWidth="3" strokeDasharray="80" strokeDashoffset="30" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from="0 20 20" to="360 20 20" dur="0.9s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>
      ) : hasBanners ? (
        <section className={s.slider}>
          <div className={s.sliderTrack} style={{ transform: `translateX(-${safeSlide * 100}%)` }}>
            {banners.map((b) => (
              <div key={b.id} className={s.slide} style={{ backgroundImage: `url(${API_BASE}${b.imageUrl})` }}>
                <div className={s.slideOverlay}>
                  <div>
                    {b.title && <h2 className={s.slideTitle}>{b.title}</h2>}
                    {b.subtitle && <p className={s.slideText}>{b.subtitle}</p>}
                    {b.ctaText && (
                      <a href={b.ctaLink || '/'} className={s.btnPrimary}>{b.ctaText}</a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {slideCount > 1 && (
            <div className={s.sliderCtrl}>
              <div className={s.dots}>
                {banners.map((b, i) => (
                  <button
                    key={b.id}
                    className={`${s.dot} ${safeSlide === i ? s.dotActive : ''}`}
                    onClick={() => { clearInterval(timerRef.current); goTo(i); }}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
              <div className={s.arrows}>
                <button className={s.arrow} onClick={() => nudge(-1)} aria-label="Previous"><Chevron dir="left" /></button>
                <button className={s.arrow} onClick={() => nudge(1)} aria-label="Next"><Chevron dir="right" /></button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className={s.hero}>
          <div className={s.heroBlobA} />
          <div className={s.heroBlobB} />
          <div className={s.heroInner}>
            <div>
              <h1 className={s.heroTitle}>
                {settings.heroTitle}<br />
                <span>მაისურზე, ჰუდზე, ჩანთაზე.</span>
              </h1>
              <p className={s.heroText}>{settings.heroSubtitle}</p>
              <div className={s.heroCtas}>
                <div className={s.btnPrimary} onClick={goDesign} role="button" tabIndex={0}>
                  {settings.heroCtaText} <ArrowRight />
                </div>
                <div className={s.btnGhost} onClick={goShop} role="button" tabIndex={0}>
                  მზა პროდუქცია
                </div>
              </div>
              <div className={s.heroLinks}>
                <div className={s.heroLink} onClick={() => navigate('/shop?cat=TSHIRT')}>ნახე პოპულარული მაისურები</div>
                <div className={s.heroLink} onClick={goDesign}>როგორ მუშაობს ბეჭდვა</div>
              </div>
            </div>
            <div className={s.heroArt}>
              <img className={s.heroArtBack} src={heroTshirt} alt="" />
              <img className={s.heroArtMid} src={heroTshirt} alt="" />
              <img className={s.heroArtFront} src={heroTshirt} alt="დაბეჭდილი მაისური" fetchPriority="high" />
            </div>
          </div>
        </section>
      )}

      {/* ── How it works ─────────────────────────────────── */}
      <section className={s.band}>
        <div className={s.bandInner}>
          <div className={s.steps}>
            {STEPS.map((step) => (
              <div key={step.n}>
                <div className={s.stepNum}>{step.n}</div>
                <div className={s.stepTitle}>{step.t}</div>
                <div className={s.stepText}>{step.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Categories ───────────────────────────────────── */}
      <section className={s.section}>
        <div className={s.sectionHead}>
          <div>
            <h2 className={s.h2}>კატეგორიები</h2>
            <p className={s.sub} style={{ marginBottom: 0 }}>ტანსაცმელი და აქსესუარები — ყველა ბეჭდვისთვის მომზადებული.</p>
          </div>
          <Link className={s.moreLink} to="/shop">მთელი კატალოგი →</Link>
        </div>
        <div className={s.catGrid}>
          {CATEGORIES.map((c) => (
            <Link key={c.code} className={s.catCard} to={`/shop?cat=${c.code}`}>
              <span className={s.catTile}>
                <ProductImage product={{ category: c.code, name: c.label }} color={c.swatch} className={s.catImg} />
              </span>
              <span className={s.catName}>{c.label}</span>
              {fromPrice[c.code] !== undefined && (
                <span className={s.catPrice}>{money(fromPrice[c.code])}-დან</span>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Featured products ────────────────────────────── */}
      {featured.length > 0 && (
        <section className={s.section}>
          <div className={s.sectionHead}>
            <div>
              <h2 className={s.h2}>შეთავაზებები</h2>
              <p className={s.sub} style={{ marginBottom: 0 }}>ფასდაკლებები და ახალი კოლექცია.</p>
            </div>
            <Link className={s.moreLink} to="/shop?sale=1">ყველა ფასდაკლება →</Link>
          </div>
          <div className={s.bestGrid}>
            {featured.map((p) => <ProductCard key={p.id} product={p} currency={settings.currency} />)}
          </div>
        </section>
      )}

      {/* ── Corporate CTA ────────────────────────────────── */}
      <section className={s.sectionPad} style={{ maxWidth: 1360, margin: '0 auto' }}>
        <div className={s.corp}>
          <div className={s.corpBody}>
            <div className={s.corpKicker}>კორპორატიული შეკვეთები</div>
            <h3 className={s.corpTitle}>გუნდისთვის, ღონისძიებისთვის, ბრენდისთვის</h3>
            <p className={s.corpText}>
              10 ცალიდან — ფასდაკლება, ერთიანი დიზაინი და ზომების მიხედვით დაშლილი შეკვეთა.
              ჩვენ ვამზადებთ ნიმუშს, თქვენ ამტკიცებთ და ვბეჭდავთ.
            </p>
            <div className={s.btnPrimary} onClick={goDesign} role="button" tabIndex={0}>გამოთვალე ფასი <ArrowRight /></div>
          </div>
          <img className={s.corpImg} src={mainHoodie} alt="ჰუდი" />
        </div>
      </section>

      {/* ── Why Prenta ───────────────────────────────────── */}
      <section className={s.band}>
        <div className={s.bandInner}>
          <h2 className={s.h2} style={{ marginBottom: 26 }}>რატომ Prenta?</h2>
          <div className={s.whyGrid}>
            {WHY.map((w) => (
              <div key={w.t} className={s.whyCard}>
                <div className={s.whyTitle}>{w.t}</div>
                <div className={s.whyText}>{w.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Reviews ──────────────────────────────────────── */}
      <section className={s.sectionPad} style={{ maxWidth: 1360, margin: '0 auto' }}>
        <h2 className={s.h2} style={{ marginBottom: 24 }}>რას ამბობენ მომხმარებლები</h2>
        <div className={s.reviewGrid}>
          {REVIEWS.map((r) => (
            <div key={r.n} className={s.reviewCard}>
              <div className={s.stars}>★★★★★</div>
              <div className={s.reviewText}>{r.q}</div>
              <div className={s.reviewName}>{r.n}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────── */}
      <section className={s.finalCta}>
        <div className={s.finalInner}>
          <div>
            <h2 className={s.finalTitle}>მზად ხარ დასაბეჭდად?</h2>
            <div style={{ opacity: 0.9 }}>დიზაინის აწყობა უფასოა — გადაიხდი მხოლოდ მაშინ, როცა შეკვეთას გააფორმებ.</div>
          </div>
          <div className={s.btnDark} onClick={goDesign} role="button" tabIndex={0}>კონსტრუქტორის გახსნა</div>
        </div>
      </section>

      <SiteFooter settings={settings} />

    </div>
  );
}
