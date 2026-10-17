import { messengerLink } from './messenger';

const digits = (v) => String(v || '').replace(/\D/g, '');

/** The WhatsApp / Viber / Messenger contacts set in admin settings. */
export function chatChannels(settings) {
  if (!settings) return [];
  return [
    digits(settings.chatWhatsapp) && { key: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/${digits(settings.chatWhatsapp)}` },
    digits(settings.chatViber) && { key: 'viber', label: 'Viber', href: `viber://chat?number=%2B${digits(settings.chatViber)}` },
    messengerLink(settings.chatMessenger) && { key: 'messenger', label: 'Messenger', href: messengerLink(settings.chatMessenger) },
  ].filter(Boolean);
}

const OPEN_EVENT = 'prenta:open-chat';

/** Opens the floating chat menu (ChatButton), optionally with its own heading. */
export function openChat(title) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { title } }));
}

export function onOpenChat(handler) {
  const listener = (e) => handler(e.detail || {});
  window.addEventListener(OPEN_EVENT, listener);
  return () => window.removeEventListener(OPEN_EVENT, listener);
}
