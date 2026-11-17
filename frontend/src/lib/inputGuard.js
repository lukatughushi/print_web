/*
 * Site-wide rules for typed numbers, so no field has to repeat them:
 * - number fields (prices, fees, amounts) take only digits and a decimal
 *   point: no minus, plus or "e";
 * - phone fields (type="tel") take digits, spaces and a leading +, no dashes.
 * Pasted text is cleaned the same way. The server checks the values again.
 */

const NUMBER_KEYS = /^[0-9.,]$/;
const PHONE_KEYS = /^[0-9+ ]$/;

const kind = (el) => {
  if (!(el instanceof HTMLInputElement)) return null;
  if (el.type === 'number') return 'number';
  if (el.type === 'tel') return 'tel';
  return null;
};

const clean = {
  number: (text) => text.replace(',', '.').replace(/[^0-9.]/g, ''),
  tel: (text) => text.replace(/[^0-9+ ]/g, ''),
};

function onKeyDown(e) {
  const k = kind(e.target);
  // Only single printable characters; Backspace, arrows, Tab and shortcuts pass.
  if (!k || e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
  if (!(k === 'number' ? NUMBER_KEYS : PHONE_KEYS).test(e.key)) e.preventDefault();
}

function onPaste(e) {
  const k = kind(e.target);
  if (!k) return;
  const text = e.clipboardData?.getData('text') ?? '';
  const cleaned = clean[k](text);
  if (cleaned === text) return;
  e.preventDefault();
  // insertText goes through the browser's own editing, so React sees the change.
  if (cleaned) document.execCommand('insertText', false, cleaned);
}

export function installInputGuard() {
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('paste', onPaste, true);
}
