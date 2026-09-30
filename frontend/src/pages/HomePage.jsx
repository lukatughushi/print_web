import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import s from './HomePage.module.css';

import logoPrenta from '../assets/prenta/LOGO_PRENTA.png';
import heroTshirt from '../assets/prenta/home_tshirt.png';
import mainHoodie from '../assets/prenta/main_hoode.png';
import mainBag from '../assets/prenta/main_bag.png';
import catTshirt from '../assets/prenta/cat_tshirt.png';
import catLongsleeve from '../assets/prenta/cat_longsleeve.png';
import catCap from '../assets/prenta/cat_cap.png';
import catMug from '../assets/prenta/cat_mug.png';

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

/* ── Categories — exact set from Prenta.dc (P object) ──────── */
const CATEGORIES = [
  { key: 'tee', cat: 'TSHIRT', name: 'მაისური', en: 'T-SHIRT', from: 35, img: catTshirt },
  { key: 'hoodie', cat: 'HOODIE', name: 'ჰუდი', en: 'HOODIE', from: 89, img: mainHoodie },
  { key: 'long', cat: 'TSHIRT', name: 'გრძელმკლავიანი', en: 'LONG SLEEVE', from: 55, img: catLongsleeve },
  { key: 'tote', cat: 'BAG', name: 'ჩანთა', en: 'TOTE BAG', from: 29, img: mainBag },
  { key: 'cap', cat: 'BAG', name: 'ქუდი', en: 'CAP', from: 39, img: catCap },
  { key: 'mug', cat: 'BAG', name: 'ჭიქა', en: 'MUG', from: 25, img: catMug },
];

/* ── Bestsellers — first 6 of Prenta.dc buildShop() ───────── */
const BESTSELLERS = [
  { title: 'ღამის ჭექა', badge: 'მაისური', en: 'Night Bolt', price: 49, img: catTshirt },
  { title: 'მთების ხაზი', badge: 'მაისური', en: 'Ridge Line', price: 49, img: catTshirt },
  { title: 'ალუბლის გული', badge: 'ჰუდი', en: 'Cherry Heart', price: 105, img: mainHoodie },
  { title: 'მზის ტალღა', badge: 'ჩანთა', en: 'Sun Wave', price: 39, img: mainBag },
  { title: 'ვარსკვლავი', badge: 'ქუდი', en: 'Star Cap', price: 49, img: catCap },
  { title: 'დილის რგოლი', badge: 'ჭიქა', en: 'Morning Ring', price: 35, img: catMug },
];

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

  // Link a static category to a live product of the same category when one exists.
  const productByCategory = {};
  products.forEach((p) => { if (!productByCategory[p.category]) productByCategory[p.category] = p; });
  const openCategory = (catEnum) => {
    const match = productByCategory[catEnum];
    if (match) navigate(`/design/${match.id}`);
    else goDesign();
  };

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
                <div className={s.heroLink} onClick={goShop}>ნახე პოპულარული მაისურები</div>
                <div className={s.heroLink} onClick={goDesign}>როგორ მუშაობს ბეჭდვა</div>
              </div>
            </div>
            <div className={s.heroArt}>
              <img className={s.heroArtBack} src={heroTshirt} alt="" />
              <img className={s.heroArtMid} src={heroTshirt} alt="" />
              <img className={s.heroArtFront} src={heroTshirt} alt="დაბეჭდილი მაისური" />
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
        <h2 className={s.h2}>კატეგორიები</h2>
        <p className={s.sub}>ექვსი პროდუქტი, ყველა DTF ბეჭდვისთვის მომზადებული.</p>
        <div className={s.catGrid}>
          {CATEGORIES.map((c) => (
            <div key={c.key} className={s.catCard} onClick={() => openCategory(c.cat)} role="button" tabIndex={0}>
              <img className={s.catImg} src={c.img} alt={c.name} />
              <div className={s.catName}>{c.name}</div>
              <div className={s.catEn}>{c.en}</div>
              <div className={s.catPrice}>{money(c.from)}-დან</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bestsellers ──────────────────────────────────── */}
      <section className={s.section}>
        <div className={s.sectionHead}>
          <div>
            <h2 className={s.h2}>ბესთსელერები</h2>
            <p className={s.sub} style={{ marginBottom: 0 }}>ყველაზე ხშირად შეკვეთილი მზა დიზაინები.</p>
          </div>
          <div className={s.moreLink} onClick={goShop}>ყველა პროდუქტი →</div>
        </div>
        <div className={s.bestGrid}>
          {BESTSELLERS.map((b) => (
            <div key={b.en} className={s.bestCard} onClick={goShop} role="button" tabIndex={0}>
              <div className={s.bestTile}>
                <img src={b.img} alt={b.title} />
              </div>
              <div className={s.bestBody}>
                <span className={s.bestBadge}>{b.badge}</span>
                <div className={s.bestTitle}>{b.title}</div>
                <div className={s.bestEn}>{b.en}</div>
                <div className={s.bestPrice}>{money(b.price)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

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

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className={s.footer}>
        <div className={s.footerGrid}>
          <div>
            <div className={s.footerBrand}>
              <img src={logoPrenta} alt="Prenta" />
              <span className={s.footerWordmark}>PRENTA</span>
            </div>
            <div className={s.footerAbout}>
              ბეჭდვა მაისურებზე, ჰუდებზე, ჩანთებზე და ჭიქებზე.<br />
              {settings.contactAddress}<br />
              {settings.contactPhone}<br />
              {settings.contactEmail}
            </div>
          </div>
          <div>
            <div className={s.footerColTitle}>პროდუქცია</div>
            <div className={s.footerCol}>
              <span onClick={goShop}>მაისურები</span>
              <span onClick={goShop}>ჰუდები</span>
              <span onClick={goShop}>ჩანთები</span>
              <span onClick={goShop}>ქუდები და ჭიქები</span>
            </div>
          </div>
          <div>
            <div className={s.footerColTitle}>სერვისი</div>
            <div className={s.footerCol}>
              <span onClick={goDesign}>დიზაინის კონსტრუქტორი</span>
              <span>კორპორატიული შეკვეთები</span>
              <span>DTF ბეჭდვა</span>
              <span>ბეჭდვის მაკეტის მოთხოვნები</span>
            </div>
          </div>
          <div>
            <div className={s.footerColTitle}>დახმარება</div>
            <div className={s.footerCol}>
              <span>მიწოდება და ვადები</span>
              <span>დაბრუნება</span>
              <span>ხშირად დასმული კითხვები</span>
              <span>კონტაქტი</span>
            </div>
          </div>
        </div>
        <div className={s.footerBar}>
          <div className={s.footerBarInner}>
            <span>© {new Date().getFullYear()} Prenta · ყველა უფლება დაცულია</span>
            <span>გადახდა: ბარათით, კურიერთან ან განვადებით</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
