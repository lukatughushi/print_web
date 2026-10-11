import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api, { getErrorMessage } from '../lib/api';
import SiteFooter from '../components/SiteFooter';
import s from './CorporatePage.module.css';

// Layout follows src/acrhi/uploads/Corporate.dc.html.

const PHOTOS = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/corp/*.webp', { eager: true, import: 'default' }))
    .map(([path, url]) => [path.split('/').pop().replace('.webp', ''), url]),
);

const CATS = [['all', 'ყველა'], ['tee', 'მაისური'], ['polo', 'პოლო'], ['cap', 'კეპი'], ['bag', 'ჩანთა'], ['vest', 'ჟილეტი']];
const CAT_LABEL = Object.fromEntries(CATS);

const WORKS = [
  { client: 'Modern Roofing', cats: ['polo', 'cap'], imgs: ['roofing-1', 'roofing-2'], big: true },
  { client: 'Sushi Icons', cats: ['tee'], imgs: ['sushi'] },
  { client: 'Vaxo Shonia’s Vlog', cats: ['tee'], imgs: ['vlog-1', 'vlog-2'] },
  { client: 'პრაიმ შაურმა', cats: ['tee', 'cap'], imgs: ['shawarma'] },
  { client: '670 Festival', cats: ['bag'], imgs: ['festival-2', 'festival-1'] },
  { client: 'დელფი მოტორსი', cats: ['tee'], imgs: ['delfi-2', 'delfi-1'] },
  { client: 'სამუშაო ჟილეტები', cats: ['vest'], imgs: ['vest-1', 'vest-3', 'vest-2'], big: true },
  { client: 'ქართული სამზარეულო', cats: ['tee'], imgs: ['cuisine'] },
  { client: 'istOria', cats: ['bag'], imgs: ['istoria'] },
  { client: 'EPO Yapı Kimya', cats: ['tee'], imgs: ['epo'] },
  { client: 'Ratto Bistro', cats: ['tee'], imgs: ['ratto-2', 'ratto-1'] },
  { client: 'ფარი — გუნდის მაისურები', cats: ['tee'], imgs: ['shield-1', 'shield-2'] },
  { client: '1991', cats: ['tee'], imgs: ['1991'] },
  { client: 'პროფკავშირი „78-ე მუხლი“', cats: ['tee'], imgs: ['union-1', 'union-2'] },
  { client: 'ვაზის კოლექცია', cats: ['tee'], imgs: ['vine'] },
  { client: 'კორპორატიული ღონისძიება', cats: ['tee'], imgs: ['event'] },
].map((w) => ({ ...w, photos: w.imgs.map((i) => PHOTOS[i]).filter(Boolean), tags: w.cats.map((c) => CAT_LABEL[c]).join(' · ') }));

const BRANDS = ['Modern Roofing', 'Sushi Icons', 'Ratto Bistro', 'EPO Yapı Kimya', 'istOria', 'დელფი მოტორსი', 'პრაიმ შაურმა', '670 Festival', 'Vaxo Shonia’s Vlog', 'ქართული სამზარეულო'];

// Calculator: base price per piece (₾), extra per print zone, quantity discounts.
const PRODS = [['tee', 'მაისური', 22], ['polo', 'პოლო', 34], ['ls', 'გრძელმკლავიანი', 30], ['hoodie', 'ჰუდი', 58], ['cap', 'კეპი', 18], ['bag', 'ჩანთა', 14], ['vest', 'ჟილეტი', 20]];
const ZONES = [['front', 'წინა მხარე', 0], ['back', 'ზურგი', 8], ['sleeve', 'სახელო', 4]];
const TIERS = [[10, '10–49 · −5%', 0.05], [50, '50–99 · −12%', 0.12], [100, '100–299 · −20%', 0.2], [300, '300+ · −25%', 0.25]];

const STEPS = [
  ['01', 'მოთხოვნა', 'გამოგვიგზავნე ლოგო, რაოდენობა და ვადა. 1 საათში დაგიკავშირდებით.'],
  ['02', 'მაკეტი', 'ვამზადებთ ციფრულ მაკეტს — ზომა, განთავსება, ფერი. უფასოდ.'],
  ['03', 'ნიმუში', '50+ ცალზე ვბეჭდავთ ერთ საცდელ ნიმუშს დასამტკიცებლად.'],
  ['04', 'წარმოება და მიწოდება', '3–5 სამუშაო დღე. ზომების მიხედვით შეფუთული, ინვოისით.'],
];

const FAQ = [
  ['რა არის მინიმალური რაოდენობა?', 'კორპორატიული ფასი მოქმედებს 10 ცალიდან. შეიძლება სხვადასხვა ზომისა და ფერის შერევა ერთ შეკვეთაში.'],
  ['რა ფორმატით გამოგიგზავნოთ ლოგო?', 'საუკეთესოა ვექტორული PDF. PNG/JPG-საც ვიღებთ — საჭიროების შემთხვევაში ვექტორიზაციას ჩვენ გავაკეთებთ. AI ან SVG ფაილი შეინახე PDF-ად და ისე ატვირთე.'],
  ['რამდენ ხანში მზადდება შეკვეთა?', 'მაკეტის დამტკიცებიდან 3–5 სამუშაო დღეში. 300+ ცალზე ვადას ინდივიდუალურად ვათანხმებთ.'],
  ['რამდენად გამძლეა ბეჭდვა?', 'DTF ბეჭდვა უძლებს 50+ რეცხვას 40°C-ზე, არ სკდება და ფერს ინარჩუნებს.'],
  ['გაქვთ ინვოისით გადახდა?', 'დიახ — ვმუშაობთ იურიდიულ პირებთან ინვოისითა და ზედნადებით, ასევე წინასწარი 50%-იანი გადახდით.'],
];

const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const MAX_LOGO_MB = 10;
const fmt = (n) => Math.round(n).toLocaleString('ka-GE').replace(/\s/g, ' ');

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Lightbox({ work, index, onIndex, onClose }) {
  const count = work.photos.length;
  const step = useCallback((d) => onIndex((index + d + count) % count), [index, count, onIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose, step]);

  return (
    <div className={s.lb} onClick={onClose} role="dialog" aria-label={work.client}>
      <div className={s.lbStage} onClick={(e) => e.stopPropagation()}>
        <img src={work.photos[index]} alt={work.client} className={s.lbImg} />
        {count > 1 && (
          <>
            <button type="button" className={`${s.lbArrow} ${s.lbPrev}`} onClick={() => step(-1)} aria-label="წინა">←</button>
            <button type="button" className={`${s.lbArrow} ${s.lbNext}`} onClick={() => step(1)} aria-label="შემდეგი">→</button>
          </>
        )}
      </div>
      <div className={s.lbBar} onClick={(e) => e.stopPropagation()}>
        <div>
          <div className={s.lbClient}>{work.client}</div>
          <div className={s.lbTags}>{work.tags} · {index + 1} / {count}</div>
        </div>
        <div className={s.lbActions}>
          <a href="#quote" className={s.btnPink} onClick={onClose}>მსგავსის შეკვეთა</a>
          <button type="button" className={s.btnLine} onClick={onClose}>დახურვა ✕</button>
        </div>
      </div>
    </div>
  );
}

export default function CorporatePage() {
  const [settings, setSettings] = useState({});
  const [cat, setCat] = useState('all');
  const [lb, setLb] = useState(null); // { work, index }
  const [prod, setProd] = useState('tee');

  // Links like /corporate#quote land on that section.
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    return () => clearTimeout(t);
  }, [hash]);
  const [qty, setQty] = useState(50);
  const [zones, setZones] = useState(['front']);
  const [form, setForm] = useState({ name: '', company: '', contact: '', comment: '' });
  const [logo, setLogo] = useState(null); // File
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(null);
  const [faq, setFaq] = useState(0);
  const closeLb = useCallback(() => setLb(null), []);
  const setLbIndex = useCallback((index) => setLb((v) => ({ ...v, index })), []);

  useEffect(() => {
    api.get('/api/settings').then((r) => r.data && setSettings(r.data)).catch(() => {});
  }, []);

  const works = useMemo(() => (cat === 'all' ? WORKS : WORKS.filter((w) => w.cats.includes(cat))), [cat]);

  const product = PRODS.find((p) => p[0] === prod);
  const zoneAdd = ZONES.filter((z) => zones.includes(z[0])).reduce((a, z) => a + z[2], 0);
  const tier = [...TIERS].reverse().find((t) => qty >= t[0]);
  const unit = Math.round((product[2] + zoneAdd) * (1 - tier[2]) * 10) / 10;
  const total = Math.round(unit * qty);
  const zoneNames = ZONES.filter((z) => zones.includes(z[0])).map((z) => z[1].toLowerCase()).join(', ');

  const toggleZone = (id) => setZones((z) => {
    const next = z.includes(id) ? z.filter((x) => x !== id) : [...z, id];
    return next.length ? next : z;
  });

  const set = (key) => (e) => { setError(''); setForm((f) => ({ ...f, [key]: e.target.value })); };

  const pickLogo = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) return setError('ლოგო ატვირთე PNG, JPG, WebP ან PDF ფორმატით (AI/SVG შეინახე PDF-ად).');
    if (file.size > MAX_LOGO_MB * 1024 * 1024) return setError(`ფაილი ${MAX_LOGO_MB} MB-ზე დიდია.`);
    setError('');
    setLogo(file);
  };

  const send = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return setError('ჩაწერე სახელი.');
    if (form.contact.trim().length < 5) return setError('ჩაწერე ტელეფონი ან ელფოსტა.');
    setSending(true);
    setError('');
    try {
      const { data } = await api.post('/api/quotes', {
        name: form.name.trim(),
        company: form.company.trim(),
        contact: form.contact.trim(),
        comment: form.comment.trim(),
        product: prod,
        quantity: qty,
        zones,
        estimate: total,
        ...(logo ? { logo: await readAsDataUrl(logo), logoName: logo.name } : {}),
      });
      setSent(data.number);
    } catch (err) {
      setError(getErrorMessage(err, 'გაგზავნა ვერ მოხერხდა. სცადე ხელახლა ან დაგვირეკე.'));
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setSent(null);
    setForm({ name: '', company: '', contact: '', comment: '' });
    setLogo(null);
  };

  const phone = settings.contactPhone || '+995 555 12 34 56';

  return (
    <div className={s.page}>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className={s.hero}>
        <div className={s.heroGlow} />
        <div className={s.heroInner}>
          <div className={s.heroText}>
            <span className={s.eyebrow}>PRENTA BUSINESS · 10 ცალიდან</span>
            <h1 className={s.heroTitle}>შენი ბრენდი — <span>გუნდის ტანსაცმელზე.</span></h1>
            <p className={s.heroLead}>მაისურები, პოლოები, კეპები, ჩანთები და სამუშაო ჟილეტები ლოგოთი. ერთი მენეჯერი, ერთი ინვოისი, ზომების მიხედვით დალაგებული შეკვეთა.</p>
            <div className={s.heroCtas}>
              <a href="#quote" className={s.btnPinkLg}>გამოთვალე ფასი →</a>
              <a href="#work" className={s.btnGhostLg}>ჩვენი ნამუშევრები</a>
            </div>
            <div className={s.stats}>
              <div><div className={s.statValue}>10+</div><div className={s.statLabel}>მინიმალური შეკვეთა</div></div>
              <div><div className={s.statValue}>3–5 დღე</div><div className={s.statLabel}>წარმოების ვადა</div></div>
              <div><div className={s.statValue}>−20%</div><div className={s.statLabel}>100 ცალიდან</div></div>
            </div>
          </div>
          <div className={s.mosaic}>
            <div className={s.mosaicBig}><img src={PHOTOS['roofing-1']} alt="Modern Roofing" /></div>
            <div><img src={PHOTOS.sushi} alt="Sushi Icons" /></div>
            <div><img src={PHOTOS['vlog-1']} alt="Vaxo Shonia’s Vlog" /></div>
          </div>
        </div>
      </section>

      {/* ── Trusted by ───────────────────────────────────── */}
      <section className={s.trust}>
        <div className={s.trustInner}>
          <span className={s.trustLabel}>გვენდობიან</span>
          <div className={s.marqueeMask}>
            <div className={s.marquee}>
              {[...BRANDS, ...BRANDS].map((b, i) => <span key={i} aria-hidden={i >= BRANDS.length}>{b}</span>)}
            </div>
          </div>
        </div>
      </section>

      <main className={s.main}>
        {/* ── Portfolio ──────────────────────────────────── */}
        <section id="work" className={s.section}>
          <div className={s.sectionHead}>
            <div className={s.headText}>
              <span className={s.kicker}>პორტფოლიო</span>
              <h2 className={s.h2}>უკვე შექმნილი კორპორატიული პროდუქცია</h2>
            </div>
            <div className={s.chips}>
              {CATS.map(([id, label]) => (
                <button key={id} type="button" className={`${s.chip} ${cat === id ? s.chipOn : ''}`} onClick={() => setCat(id)}>
                  {label}<span>{id === 'all' ? WORKS.length : WORKS.filter((w) => w.cats.includes(id)).length}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={s.works}>
            {works.map((w) => (
              <button
                key={w.client}
                type="button"
                className={`${s.work} ${w.big && cat === 'all' ? s.workBig : ''}`}
                onClick={() => setLb({ work: w, index: 0 })}
              >
                <img src={w.photos[0]} alt={w.client} loading="lazy" />
                <span className={s.workCap}>
                  <span className={s.workText}>
                    <span className={s.workClient}>{w.client}</span>
                    <span className={s.workTags}>{w.tags}</span>
                  </span>
                  {w.photos.length > 1 && <span className={s.workCount}>{w.photos.length} ფოტო</span>}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ── How we work ────────────────────────────────── */}
        <section className={s.sectionTop}>
          <div className={s.headText}>
            <span className={s.kicker}>როგორ ვმუშაობთ</span>
            <h2 className={s.h2}>ლოგოდან მიწოდებამდე — 4 ნაბიჯი</h2>
          </div>
          <div className={s.steps}>
            {STEPS.map(([n, t, d]) => (
              <div key={n} className={s.step}>
                <span className={s.stepNum}>{n}</span>
                <div className={s.stepTitle}>{t}</div>
                <div className={s.stepText}>{d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Calculator + quote ─────────────────────────── */}
        <section id="quote" className={s.sectionTop}>
          <div className={s.quote}>
            <div className={s.calc}>
              <div className={s.headText}>
                <span className={s.kicker}>კალკულატორი</span>
                <h2 className={s.h2Light}>გამოთვალე სავარაუდო ფასი</h2>
              </div>

              <div className={s.calcGroup}>
                <span className={s.calcLabel}>პროდუქტი</span>
                <div className={s.chips}>
                  {PRODS.map(([id, label]) => (
                    <button key={id} type="button" className={`${s.darkChip} ${prod === id ? s.darkChipOn : ''}`} onClick={() => setProd(id)} aria-pressed={prod === id}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={s.calcGroup}>
                <div className={s.calcRow}>
                  <span className={s.calcLabel}>რაოდენობა</span>
                  <span className={s.calcQty}>{qty} ცალი</span>
                </div>
                <input type="range" min="10" max="500" step="10" value={qty} onChange={(e) => setQty(+e.target.value)} className={s.range} aria-label="რაოდენობა" />
                <div className={s.tiers}>
                  {TIERS.map((t) => <span key={t[0]} className={`${s.tier} ${t === tier ? s.tierOn : ''}`}>{t[1]}</span>)}
                </div>
              </div>

              <div className={s.calcGroup}>
                <span className={s.calcLabel}>ბეჭდვის ზონები</span>
                <div className={s.chips}>
                  {ZONES.map(([id, label, add]) => {
                    const on = zones.includes(id);
                    return (
                      <button key={id} type="button" className={`${s.zone} ${on ? s.zoneOn : ''}`} onClick={() => toggleZone(id)} aria-pressed={on}>
                        <span className={s.zoneBox}>{on ? '✓' : ''}</span>{label}{add ? ` +${add} ₾` : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={s.calcFoot}>
                <div>
                  <div className={s.calcLabel}>ერთეული</div>
                  <div className={s.unit}>{unit.toFixed(unit % 1 ? 1 : 0)} ₾ / ცალი</div>
                </div>
                <div className={s.totalBox}>
                  <div className={s.calcLabel}>სულ, სავარაუდოდ</div>
                  <div className={s.total}>{fmt(total)} ₾</div>
                </div>
              </div>
            </div>

            <div className={s.formCard}>
              {sent ? (
                <div className={s.sent}>
                  <div className={s.sentIcon}>✓</div>
                  <div className={s.sentTitle}>მოთხოვნა მიღებულია</div>
                  <div className={s.sentText}>მოთხოვნის ნომერი <b>{sent}</b>. მენეჯერი დაგიკავშირდებათ მალე და გამოგიგზავნით მაკეტს.</div>
                  <button type="button" className={s.btnOutline} onClick={reset}>ახალი მოთხოვნა</button>
                </div>
              ) : (
                <form className={s.form} onSubmit={send} noValidate>
                  <div className={s.formTitle}>მოითხოვე ზუსტი შეთავაზება</div>
                  <div className={s.formSummary}>{product[1]} · {qty} ცალი · {zoneNames} · ≈ {fmt(total)} ₾</div>
                  <div className={s.formGrid}>
                    <input className={s.input} placeholder="სახელი" value={form.name} onChange={set('name')} aria-label="სახელი" />
                    <input className={s.input} placeholder="კომპანია" value={form.company} onChange={set('company')} aria-label="კომპანია" />
                  </div>
                  <input className={s.input} placeholder="ტელეფონი ან ელფოსტა" value={form.contact} onChange={set('contact')} aria-label="ტელეფონი ან ელფოსტა" />
                  <textarea className={s.textarea} rows={3} placeholder="კომენტარი — ფერები, ზომები, ვადა…" value={form.comment} onChange={set('comment')} aria-label="კომენტარი" />
                  <label className={s.file}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF5F7A" strokeWidth="2" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>
                    <span className={s.fileName}>{logo ? logo.name : 'ატვირთე ლოგო (PDF, PNG, JPG)'}</span>
                    {logo && <button type="button" className={s.fileClear} onClick={(e) => { e.preventDefault(); setLogo(null); }} aria-label="ფაილის მოხსნა">✕</button>}
                    <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={pickLogo} hidden />
                  </label>
                  {error && <div className={s.error}>{error}</div>}
                  <button type="submit" className={s.btnPinkLg} disabled={sending}>{sending ? 'იგზავნება…' : 'გაგზავნა'}</button>
                  <div className={s.formNote}>ვპასუხობთ 1 საათში, სამუშაო დღეებში 10:00–19:00 · <a href={`tel:${phone.replace(/\s/g, '')}`}>{phone}</a></div>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────── */}
        <section className={s.faqSection}>
          <div className={s.headText}>
            <span className={s.kicker}>კითხვები</span>
            <h2 className={s.h2}>ხშირად გვეკითხებიან</h2>
          </div>
          <div className={s.faqList}>
            {FAQ.map(([q, a], i) => (
              <div key={q} className={s.faqItem}>
                <button type="button" className={s.faqQ} onClick={() => setFaq(faq === i ? -1 : i)} aria-expanded={faq === i}>
                  {q}<span className={s.faqIcon}>{faq === i ? '−' : '+'}</span>
                </button>
                {faq === i && <div className={s.faqA}>{a}</div>}
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} />

      {lb && <Lightbox work={lb.work} index={lb.index} onIndex={setLbIndex} onClose={closeLb} />}
    </div>
  );
}
