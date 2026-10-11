import { Link } from 'react-router-dom';
import s from './storefront.module.css';
import { useI18n } from '../i18n/i18n-context';

export default function NotFoundPage() {
  const { t } = useI18n();
  return (
    <main className={s.page}>
      <div className={s.wrapMid}>
        <div className={s.emptyCard} style={{ marginTop: 40 }}>
          <div className={s.notFoundCode}>404</div>
          <h2>{t('გვერდი ვერ მოიძებნა')}</h2>
          <p>{t('ბმული შეიძლება შეცვლილი ან წაშლილი იყოს.')}</p>
          <div className={s.emptyActions}>
            <Link to="/" className={s.btnPrimary}>{t('მთავარი გვერდი')}</Link>
            <Link to="/shop" className={s.btnOutline}>{t('მაღაზია')}</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
