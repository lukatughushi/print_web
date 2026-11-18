import { Link } from 'react-router-dom';
import s from '../pages/storefront.module.css';

/** "Back" link above a page title: a round arrow plus a label. */
export default function BackLink({ to, children }) {
  return (
    <Link to={to} className={s.back}>
      <span className={s.backIcon} aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="M11 6l-6 6 6 6" />
        </svg>
      </span>
      <span>{children}</span>
    </Link>
  );
}
