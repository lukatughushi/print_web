import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { PRINT_PAGES } from '../lib/printPages';

const SITE = 'https://www.prenta.ge';

// Default title and description (the same as in index.html).
const HOME = {
  title: 'ბეჭდვა მაისურებზე და ტანსაცმელზე თბილისში | Prenta',
  description: 'მაისურების, ჰუდების, ჩანთების, კეპებისა და ჭიქების ბეჭდვა თბილისში. DTF ბეჭდვა 1 ცალიდან, საკუთარი დიზაინის კონსტრუქტორი და კორპორატიული შეკვეთები. მიწოდება მთელ საქართველოში.',
};

// Search result text for the public pages.
const PAGES = {
  '/': HOME,
  '/shop': {
    title: 'მაღაზია: მაისურები, ჰუდები, ჩანთები ბეჭდვით | Prenta',
    description: 'მზა პროდუქცია ბეჭდვით: მაისურები, პოლოები, ჰუდები, ბომბერები, ჩანთები, კეპები და ჭიქები. შეუკვეთე ონლაინ, მიწოდება მთელ საქართველოში.',
  },
  '/corporate': {
    title: 'კორპორატიული ბეჭდვა კომპანიებისთვის | Prenta',
    description: 'ბეჭდვა კომპანიებისთვის: გუნდის ტანსაცმელი, ბრენდირებული მაისურები, ჰუდები და აქსესუარები ლოგოთი. კორპორატიული შეკვეთები თბილისში.',
  },
  '/about': {
    title: 'ჩვენს შესახებ: ბეჭდვის სტუდია თბილისში | Prenta',
    description: 'Prenta ბეჭდვის სტუდიაა თბილისში, ოდესის ქუჩა 14-ზე. გაიცანი სტუდია, დაბრუნებისა და კონფიდენციალურობის პირობები.',
  },
};

const DESIGN = {
  title: 'დიზაინის კონსტრუქტორი: შექმენი შენი მაისური | Prenta',
  description: 'ატვირთე სურათი, ლოგო ან ტექსტი, ნახე შედეგი 3D-ში და შეუკვეთე ბეჭდვა 1 ცალიდან.',
};

function setTag(selector, attr, value) {
  document.head.querySelector(selector)?.setAttribute(attr, value);
}

/** Keeps the page title, description and canonical address in step with the route. */
export default function PageMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = PAGES[pathname]
      ?? PRINT_PAGES.find((p) => p.path === pathname)
      ?? (pathname.startsWith('/design') ? DESIGN : HOME);
    const url = SITE + (pathname.startsWith('/design') ? '/design/start' : pathname);
    document.title = meta.title;
    setTag('meta[name="description"]', 'content', meta.description);
    setTag('link[rel="canonical"]', 'href', url);
    setTag('meta[property="og:title"]', 'content', meta.title);
    setTag('meta[property="og:description"]', 'content', meta.description);
    setTag('meta[property="og:url"]', 'content', url);
  }, [pathname]);

  return null;
}
