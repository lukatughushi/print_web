import { useId, useMemo, useState } from 'react';
import { PROFESSIONS } from '../lib/professions';
import { useI18n } from '../i18n/i18n-context';
import c from './ProfessionInput.module.css';

const norm = (v) => v.trim().toLowerCase();

/**
 * Free-text field with suggestions: typing matches the Georgian and English
 * names alike; picking one fills it in the page's language.
 */
export default function ProfessionInput({ value, onChange, className, placeholder }) {
  const { lang } = useI18n();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    const q = norm(value);
    if (!q) return PROFESSIONS;
    const starts = [];
    const contains = [];
    for (const p of PROFESSIONS) {
      const names = p.map(norm);
      if (names.includes(q)) continue; // already typed exactly
      if (names.some((n) => n.startsWith(q))) starts.push(p);
      else if (names.some((n) => n.includes(q))) contains.push(p);
    }
    return [...starts, ...contains];
  }, [value]);

  const pick = ([ka, en]) => {
    onChange(lang === 'ka' ? ka : en);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open || !matches.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % matches.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + matches.length) % matches.length); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(matches[active]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  const show = open && matches.length > 0;
  return (
    <div className={c.wrap}>
      <input
        className={className}
        value={value}
        placeholder={placeholder}
        maxLength={80}
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {show && (
        <ul id={listId} className={c.list} role="listbox">
          {matches.map((p, i) => {
            const [first, second] = lang === 'ka' ? p : [p[1], p[0]];
            return (
              <li
                key={p[1]}
                role="option"
                aria-selected={i === active}
                className={`${c.option} ${i === active ? c.active : ''}`}
                // mousedown, not click: it fires before the input's blur closes the list
                onMouseDown={(e) => { e.preventDefault(); pick(p); }}
                onMouseEnter={() => setActive(i)}
              >
                {first}<span className={c.other}>{second}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
