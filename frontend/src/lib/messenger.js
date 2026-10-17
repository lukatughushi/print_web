/**
 * Messenger chat link (https://m.me/…) from what admin typed for the page:
 * a username ("prenta.ge" or "@prenta.ge"), an m.me link, or any facebook.com
 * address, including profile.php?id=… and /people/Name/ID pages. Returns ''
 * when it isn't a Facebook page (e.g. a Google share link), so the button
 * never opens the wrong site.
 */
export function messengerLink(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const isUrl = /^(https?:\/\/)?([a-z0-9-]+\.)*(m\.me|facebook\.com|fb\.com|messenger\.com)\b/i.test(raw);
  if (!isUrl) {
    // A bare page username.
    if (/^@?[a-z0-9.\-_]{3,}$/i.test(raw) && !/^https?:/i.test(raw)) return `https://m.me/${raw.replace(/^@/, '')}`;
    return '';
  }

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return '';
  }
  const parts = url.pathname.split('/').filter(Boolean);
  const id = url.searchParams.get('id');

  if (/m\.me$/i.test(url.hostname) && parts[0]) return `https://m.me/${parts[0]}`;
  if (parts[0] === 'profile.php' && id) return `https://m.me/${id}`;
  if (parts[0] === 'people' && parts[2]) return `https://m.me/${parts[2]}`;
  if (parts[0] === 't' && parts[1]) return `https://m.me/${parts[1]}`; // messenger.com/t/…
  if (parts[0] && !['pages', 'groups', 'share', 'sharer', 'home.php'].includes(parts[0])) return `https://m.me/${parts[0]}`;
  return '';
}
