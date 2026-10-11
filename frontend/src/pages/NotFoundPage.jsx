import { Link } from 'react-router-dom';
import s from './storefront.module.css';

export default function NotFoundPage() {
  return (
    <main className={s.page}>
      <div className={s.wrapMid}>
        <div className={s.emptyCard} style={{ marginTop: 40 }}>
          <div className={s.notFoundCode}>404</div>
          <h2>გვერდი ვერ მოიძებნა</h2>
          <p>ბმული შეიძლება შეცვლილი ან წაშლილი იყოს.</p>
          <div className={s.emptyActions}>
            <Link to="/" className={s.btnPrimary}>მთავარი გვერდი</Link>
            <Link to="/shop" className={s.btnOutline}>მაღაზია</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
