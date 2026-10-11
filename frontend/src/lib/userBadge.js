// Initials and a stable avatar colour for a signed-in user.

const AVATAR_COLORS = ['#EF5F7A', '#3F6B4F', '#2F5D8A', '#B4692F', '#7A4FA0', '#1F8A86'];

/** "ზაზა ზაზაევიჩი" → "ზზ", "nino" → "N"; falls back to the e-mail. */
export function initialsOf(user) {
  const words = String(user?.name || '').trim().split(/\s+/).filter(Boolean);
  const letters = words.length ? words.slice(0, 2).map((w) => [...w][0]) : [[...String(user?.email || '?')][0]];
  // Latin initials are capitalised; Georgian stays Mkhedruli (toUpperCase would give Mtavruli).
  return letters.map((ch) => (/[Ⴀ-ჿᲐ-Ჿ]/.test(ch) ? ch : ch.toUpperCase())).join('');
}

export function avatarColor(user) {
  const key = String(user?.email || user?.name || '');
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
