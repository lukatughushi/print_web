import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { API_BASE, CATEGORY_LABELS, COLORS } from '../../lib/catalog';
import {
  ORDER_STATUSES,
  PAYMENT_LABELS,
  STATUS_BY_KEY,
  gel,
  getErrorMessage,
  shortDate,
} from './adminShared';
import s from './Admin.module.css';

const fileUrl = (id) => `${API_BASE}/api/files/${id}`;

// Product colour arrives as a hex from the editor (or a key from the shop).
function colorName(value) {
  if (!value) return null;
  if (COLORS[value]) return COLORS[value].name;
  const match = Object.values(COLORS).find((c) => c.hex.toLowerCase() === String(value).toLowerCase());
  return match?.name ?? value;
}

function StatusBadge({ status }) {
  const st = STATUS_BY_KEY[status];
  return <span className={`${s.badge} ${s[`tone-${st?.tone}`]}`}>{st?.label ?? status}</span>;
}

function OrderDrawer({ order, onClose, onSaved }) {
  const [note, setNote] = useState(order.adminNote || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (patch) => {
    setSaving(true);
    setError('');
    try {
      const { data } = await api.patch(`/api/orders/${order.id}`, patch);
      onSaved(data);
    } catch (e) {
      setError(getErrorMessage(e, 'შენახვა ვერ მოხერხდა'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className={s.backdrop} onClick={onClose} aria-hidden="true" />
      <aside className={s.drawer} role="dialog" aria-label={`შეკვეთა ${order.number}`}>
        <div className={s.drawerHead}>
          <div>
            <h2 className={s.drawerTitle}>{order.number}</h2>
            <div className={s.muted} style={{ fontSize: 12.5 }}>{shortDate(order.createdAt, true)}</div>
          </div>
          <button type="button" className={s.iconBtn} onClick={onClose} aria-label="დახურვა">✕</button>
        </div>

        <div className={s.drawerBody}>
          {error && <div className={s.error}>{error}</div>}

          <div className={s.card}>
            <h3 className={s.cardTitle}>სტატუსი</h3>
            <div className={s.statusPick}>
              {ORDER_STATUSES.map((st) => (
                <button
                  key={st.key}
                  type="button"
                  disabled={saving}
                  className={`${s.badge} ${s[`tone-${st.tone}`]} ${order.status === st.key ? s.statusPickOn : ''}`}
                  onClick={() => order.status !== st.key && save({ status: st.key })}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          <div className={s.card}>
            <h3 className={s.cardTitle}>მომხმარებელი</h3>
            <dl className={s.kv}>
              <dt>სახელი</dt><dd>{order.customerName}</dd>
              <dt>ტელეფონი</dt><dd><a className={s.link} href={`tel:${order.phone}`}>{order.phone}</a></dd>
              {order.customerEmail && <><dt>ელფოსტა</dt><dd><a className={s.link} href={`mailto:${order.customerEmail}`}>{order.customerEmail}</a></dd></>}
              <dt>მისამართი</dt><dd>{order.address}</dd>
              <dt>გადახდა</dt><dd>{PAYMENT_LABELS[order.payment] ?? order.payment}</dd>
              {order.notes && <><dt>შენიშვნა</dt><dd>{order.notes}</dd></>}
            </dl>
          </div>

          <div className={s.card}>
            <h3 className={s.cardTitle}>პროდუქტები</h3>
            {order.items.map((it, i) => (
              <div key={i} className={s.item}>
                <div className={s.itemPreview}>
                  {it.design?.previewFile
                    ? <img src={fileUrl(it.design.previewFile)} alt="" />
                    : it.design?.printFile
                      ? <img src={fileUrl(it.design.printFile)} alt="" />
                      : 'დიზაინის გარეშე'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={s.strong}>{it.name}</div>
                  <div className={s.muted} style={{ fontSize: 12.5 }}>
                    {[CATEGORY_LABELS[it.category] ?? it.category, it.size || 'ერთი ზომა', colorName(it.color)].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    {it.quantity} × {gel(it.unitPrice)} = <b>{gel(it.lineTotal)}</b>
                  </div>
                  {it.design && (
                    <div className={s.itemLinks}>
                      {it.design.printFile && <a className={s.link} href={fileUrl(it.design.printFile)} target="_blank" rel="noreferrer" download>⬇ ბეჭდვის ფაილი (PNG)</a>}
                      {it.design.layersFile && <a className={s.link} href={fileUrl(it.design.layersFile)} target="_blank" rel="noreferrer">ფენები (JSON)</a>}
                      {it.design.model && <span className={s.muted} style={{ fontSize: 12 }}>მოდელი: {it.design.model}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <dl className={s.kv} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F1ECE6' }}>
              <dt>ჯამი</dt><dd>{gel(order.subtotal)}</dd>
              <dt>მიწოდება</dt><dd>{order.shipping ? gel(order.shipping) : 'უფასო'}</dd>
              <dt className={s.strong} style={{ color: '#16233B' }}>სულ</dt><dd className={s.strong}>{gel(order.total)}</dd>
            </dl>
          </div>

          <div className={s.card}>
            <h3 className={s.cardTitle}>შიდა შენიშვნა</h3>
            <textarea
              className={s.textarea}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="მხოლოდ ადმინისთვის — მაგ. „დაურეკე 18:00-ის შემდეგ“"
            />
          </div>
        </div>

        <div className={s.drawerFoot}>
          <button type="button" className={s.btnGhost} onClick={onClose}>დახურვა</button>
          <button type="button" className={s.btn} disabled={saving || note === (order.adminNote || '')} onClick={() => save({ adminNote: note })}>
            შენიშვნის შენახვა
          </button>
        </div>
      </aside>
    </>
  );
}

export default function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const openId = params.get('open') || '';
  const [query, setQuery] = useState(params.get('q') || '');
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/api/orders')
      .then((r) => setOrders(r.data))
      .catch((e) => setError(getErrorMessage(e, 'შეკვეთები ვერ ჩაიტვირთა')));
  }, []);

  useEffect(() => { load(); }, [load]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };

  const counts = useMemo(() => {
    const c = Object.fromEntries(ORDER_STATUSES.map((st) => [st.key, 0]));
    (orders || []).forEach((o) => { c[o.status] = (c[o.status] || 0) + 1; });
    return c;
  }, [orders]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (orders || []).filter((o) => {
      if (status && o.status !== status) return false;
      if (!q) return true;
      return [o.number, o.customerName, o.phone, o.customerEmail, o.address]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [orders, status, query]);

  const open = orders?.find((o) => o.id === openId) || null;

  const saved = (updated) => setOrders((list) => list.map((o) => (o.id === updated.id ? updated : o)));

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>შეკვეთები</h1>
          <p className={s.sub}>{orders ? `${orders.length} შეკვეთა` : ' '}</p>
        </div>
        <button type="button" className={s.btnGhost} onClick={load}>↻ განახლება</button>
      </div>

      <div className={s.tabs}>
        <button type="button" className={`${s.tab} ${!status ? s.tabOn : ''}`} onClick={() => setParam('status', '')}>
          ყველა <span className={s.tabCount}>{orders?.length ?? 0}</span>
        </button>
        {ORDER_STATUSES.map((st) => (
          <button key={st.key} type="button" className={`${s.tab} ${status === st.key ? s.tabOn : ''}`} onClick={() => setParam('status', st.key)}>
            {st.label} <span className={s.tabCount}>{counts[st.key]}</span>
          </button>
        ))}
      </div>

      <div className={s.toolbar}>
        <input
          className={s.search}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ძებნა: ნომერი, სახელი, ტელეფონი, ელფოსტა…"
        />
      </div>

      {error && <div className={s.error}>{error}</div>}
      {!orders && !error && <div className={s.loading}>იტვირთება…</div>}
      {orders && shown.length === 0 && <div className={s.empty}>შეკვეთები ვერ მოიძებნა.</div>}

      {shown.length > 0 && (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>ნომერი</th>
                <th>თარიღი</th>
                <th>მომხმარებელი</th>
                <th>პროდუქტები</th>
                <th>გადახდა</th>
                <th className={s.right}>ჯამი</th>
                <th>სტატუსი</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o.id} className={s.clickRow} onClick={() => setParam('open', o.id)}>
                  <td className={s.strong}>{o.number}</td>
                  <td className={s.nowrap}>{shortDate(o.createdAt, true)}</td>
                  <td>
                    <div>{o.customerName}</div>
                    <div className={s.muted} style={{ fontSize: 12 }}>{o.phone}</div>
                  </td>
                  <td>
                    {o.items.reduce((n, it) => n + it.quantity, 0)} ცალი
                    {o.items.some((it) => it.design) && <span className={s.muted} style={{ fontSize: 12 }}> · დიზაინით</span>}
                  </td>
                  <td className={s.nowrap}>{PAYMENT_LABELS[o.payment] ?? o.payment}</td>
                  <td className={`${s.num} ${s.right} ${s.strong}`}>{gel(o.total)}</td>
                  <td><StatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <OrderDrawer key={open.id} order={open} onClose={() => setParam('open', '')} onSaved={saved} />}
    </div>
  );
}
