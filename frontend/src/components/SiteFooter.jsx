import { Link } from 'react-router-dom';
import logo from '../assets/prenta/logo_prenta.webp';
import s from './SiteFooter.module.css';

const DEFAULTS = {
  contactPhone: '+995 555 12 34 56',
  contactEmail: 'info@prenta.ge',
  contactAddress: 'თბილისი, ჭავჭავაძის 12',
};

export default function SiteFooter({ settings = {} }) {
  const info = { ...DEFAULTS, ...settings };
  return (
    <footer className={s.footer}>
      <div className={s.grid}>
        <div className={s.about}>
          <div className={s.brand}>
            <img src={logo} alt="" />
            <span>PRENTA</span>
          </div>
          <span>{info.contactAddress}</span>
          <span>{info.contactPhone}</span>
          <span>{info.contactEmail}</span>
        </div>
        <div className={s.col}>
          <span className={s.colTitle}>პროდუქცია</span>
          <Link to="/shop?cat=TSHIRT,POLO,LONGSLEEVE,POLO_LONGSLEEVE">მაისურები და პოლოები</Link>
          <Link to="/shop?cat=HOODIE,ZIP_HOODIE,BOMBER">ჰუდები და ბომბერები</Link>
          <Link to="/shop?cat=BAG,CAP">ჩანთები და კეპები</Link>
          <Link to="/shop?cat=MUG">ჭიქები</Link>
        </div>
        <div className={s.col}>
          <span className={s.colTitle}>სერვისი</span>
          <Link to="/shop">მაღაზია</Link>
          <Link to="/shop#corporate">კორპორატიული შეკვეთები</Link>
          <span>DTF ბეჭდვა</span>
        </div>
        <div className={s.col}>
          <span className={s.colTitle}>დახმარება</span>
          <span>მიწოდება და ვადები</span>
          <span>დაბრუნება</span>
          <span>ხშირად დასმული კითხვები</span>
        </div>
      </div>
      <div className={s.bar}>
        <div className={s.barInner}>
          <span>© {new Date().getFullYear()} Prenta · ყველა უფლება დაცულია</span>
          <span>გადახდა: ბარათით, კურიერთან ან განვადებით</span>
        </div>
      </div>
    </footer>
  );
}
