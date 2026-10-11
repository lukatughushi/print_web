import { Link } from 'react-router-dom';
import logo from '../assets/prenta/logo_prenta.webp';
import s from './SiteFooter.module.css';
import { useI18n } from '../i18n/i18n-context';

const DEFAULTS = {
  contactPhone: '+995 555 12 34 56',
  contactEmail: 'info@prenta.ge',
  contactAddress: 'თბილისი, ჭავჭავაძის 12',
};

export default function SiteFooter({ settings = {} }) {
  const { t } = useI18n();
  const info = { ...DEFAULTS, ...settings };
  return (
    <footer className={s.footer}>
      <div className={s.grid}>
        <div className={s.about}>
          <div className={s.brand}>
            <img src={logo} alt="" />
            <span>PRENTA</span>
          </div>
          <span>{t(info.contactAddress)}</span>
          <span>{info.contactPhone}</span>
          <span>{info.contactEmail}</span>
        </div>
        <div className={s.col}>
          <span className={s.colTitle}>{t('პროდუქცია')}</span>
          <Link to="/shop?cat=TSHIRT,POLO,LONGSLEEVE,POLO_LONGSLEEVE">{t('მაისურები და პოლოები')}</Link>
          <Link to="/shop?cat=HOODIE,ZIP_HOODIE,BOMBER">{t('ჰუდები და ბომბერები')}</Link>
          <Link to="/shop?cat=BAG,CAP">{t('ჩანთები და კეპები')}</Link>
          <Link to="/shop?cat=MUG">{t('ჭიქები')}</Link>
        </div>
        <div className={s.col}>
          <span className={s.colTitle}>{t('სერვისი')}</span>
          <Link to="/shop">{t('მაღაზია')}</Link>
          <Link to="/corporate">{t('კორპორატიული შეკვეთები')}</Link>
          <span>{t('DTF ბეჭდვა')}</span>
        </div>
        <div className={s.col}>
          <span className={s.colTitle}>{t('დახმარება')}</span>
          <span>{t('მიწოდება და ვადები')}</span>
          <span>{t('დაბრუნება')}</span>
          <span>{t('ხშირად დასმული კითხვები')}</span>
        </div>
      </div>
      <div className={s.bar}>
        <div className={s.barInner}>
          <span>© {new Date().getFullYear()} Prenta · {t('ყველა უფლება დაცულია')}</span>
          <span>{t('გადახდა: ბარათით, კურიერთან ან განვადებით')}</span>
        </div>
      </div>
    </footer>
  );
}
