import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * A new page opens at the top. Kept as is: Back/Forward (the browser restores
 * the old position), links to a section (#quote — the page scrolls to it) and
 * query-only changes on the same page (shop filters, admin tabs).
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  const lastPath = useRef(pathname);

  useLayoutEffect(() => {
    if (lastPath.current === pathname) return; // same page: filters, tabs, #anchors
    lastPath.current = pathname;
    if (navigationType === 'POP' || hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash, navigationType]);

  return null;
}
