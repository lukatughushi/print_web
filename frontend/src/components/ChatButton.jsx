import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../lib/api';
import { messengerLink } from '../lib/messenger';
import { useI18n } from '../i18n/i18n-context';
import s from './ChatButton.module.css';

const digits = (v) => String(v || '').replace(/\D/g, '');

const ICONS = {
  whatsapp: 'M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.3.1.2.1.7-.1 1.3z',
  viber: 'M11.4 2C9.1 2 4.7 2.4 3.3 5.3 2.4 7.1 2.5 9.4 2.5 11.6c0 2.2.1 5.4 2.9 7.1v2.8c0 .6.6.9 1 .5l2.4-2.5c1 .1 2.1.2 3.2.2 2.3 0 6.7-.4 8.1-3.3.9-1.8.9-4.1.9-6.3s0-4.5-.9-6.3C18.7 2.4 14.3 2 12 2h-.6zm.9 3.4c2.9.1 5.2 2.4 5.3 5.3 0 .3-.2.5-.5.5s-.5-.2-.5-.5c-.1-2.4-2-4.2-4.3-4.3-.3 0-.5-.2-.5-.5s.2-.5.5-.5zm-3.8 1c.3 0 .5.1.7.3l1.2 1.7c.2.3.2.8-.1 1.1l-.6.5c-.2.2-.2.4-.1.6.6 1.4 1.7 2.5 3.1 3.1.2.1.4.1.6-.1l.5-.6c.3-.3.8-.3 1.1-.1l1.7 1.2c.4.3.4.8.2 1.2-.6.9-1.6 1.6-2.7 1.2-3.3-1.2-5.9-3.8-7.1-7.1-.4-1.1.3-2.1 1.2-2.7.1-.1.3-.2.5-.2zm3.9 1.4c1.6.1 2.9 1.4 3 3 0 .3-.2.5-.5.5s-.5-.2-.5-.5c0-1.1-.9-2-2-2-.3 0-.5-.2-.5-.5s.2-.5.5-.5z',
  messenger: 'M12 2C6.4 2 2 6.1 2 11.6c0 2.9 1.2 5.4 3.2 7.1V22l3-1.7c1.2.3 2.5.5 3.8.5 5.6 0 10-4.1 10-9.6S17.6 2 12 2zm1 12.9-2.6-2.7-5 2.7 5.5-5.8 2.6 2.7 4.9-2.7-5.4 5.8z',
  chat: 'M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z',
  close: 'M6 6l12 12M18 6 6 18',
};

/**
 * Floating "write to us" button (bottom right) with the WhatsApp, Viber and
 * Messenger contacts set in admin settings. Hidden when none is set and in
 * the admin panel; in the constructor it sits left of the order panel.
 */
export default function ChatButton() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const [settings, setSettings] = useState(null);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    api.get('/api/settings').then((r) => setSettings(r.data || {})).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!settings || pathname.startsWith('/admin')) return null;

  const channels = [
    digits(settings.chatWhatsapp) && { key: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/${digits(settings.chatWhatsapp)}` },
    digits(settings.chatViber) && { key: 'viber', label: 'Viber', href: `viber://chat?number=%2B${digits(settings.chatViber)}` },
    messengerLink(settings.chatMessenger) && { key: 'messenger', label: 'Messenger', href: messengerLink(settings.chatMessenger) },
  ].filter(Boolean);
  if (!channels.length) return null;

  return (
    <div className={`${s.wrap} ${pathname.startsWith('/design') ? s.onDesign : ''}`} ref={ref}>
      {open && (
        <div className={s.menu} role="menu">
          <div className={s.menuTitle}>{t('მოგვწერე')}</div>
          {channels.map((c) => (
            <a key={c.key} role="menuitem" className={s.item} href={c.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
              <span className={`${s.icon} ${s[c.key]}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={ICONS[c.key]} /></svg>
              </span>
              {c.label}
            </a>
          ))}
        </div>
      )}
      <button
        type="button"
        className={s.fab}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('მოგვწერე')}
        title={t('მოგვწერე')}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={open ? ICONS.close : ICONS.chat} />
        </svg>
      </button>
    </div>
  );
}
