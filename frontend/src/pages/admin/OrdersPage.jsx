import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
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
import Pager from './Pager';
import useServerList, { useDebounced, usePageSize } from './useServerList';
import s from './Admin.module.css';

const fileUrl = (id) => `${API_BASE}/api/files/${id}`;

// The constructor's own colour keys / hexes (see SHIRT_COLORS in DesignPage).
const EDITOR_COLORS = {
  white: 'თეთრი', black: 'შავი', grey: 'ნაცრისფერი', red: 'წითელი', blue: 'ლურჯი', green: 'მწვანე',
  '#ffffff': 'თეთრი', '#1a1a1a': 'შავი', '#888888': 'ნაცრისფერი', '#cc2222': 'წითელი', '#2244cc': 'ლურჯი', '#228833': 'მწვანე',
};

// Product colour arrives as a hex from the editor (or a key from the shop).
function colorName(value) {
  if (!value) return null;
  if (COLORS[value]) return COLORS[value].name;
  const key = String(value).toLowerCase();
  const match = Object.values(COLORS).find((c) => c.hex.toLowerCase() === key);
  return match?.name ?? EDITOR_COLORS[key] ?? value;
}

// three.js loads only when an order with a custom design is opened.
const Snapshot3D = lazy(() => import('./Snapshot3D'));

const downloadUrl = (id, name) => `${fileUrl(id)}?download=1&name=${encodeURIComponent(name)}`;

/** One picture in a side card; null src = still being prepared. */
function SideImage({ src, tag, kind, alt, onZoom, pending }) {
  if (!src && !pending) return null;
  const cls = kind === 'art' ? s.printArt : s.printMock;
  if (!src) {
    return (
      <div className={`${cls} ${s.printPending}`}>
        <span className={s.printTag}>{tag}</span>
        <span>მზადდება…</span>
      </div>
    );
  }
  return (
    <button type="button" className={cls} onClick={() => onZoom(src)} title="გადიდება">
      <img src={src} alt={alt} />
      <span className={s.printTag}>{tag}</span>
    </button>
  );
}

/**
 * One printed side of a custom item: where it is printed (a 3D photo of the
 * garment with the design; the flat placement drawing if 3D can't be made)
 * and the print file.
 */
function PrintSide({ title, view3d, view3dPending, placement, print, printName, onZoom }) {
  if (!placement && !print && !view3d) return null;
  const where = view3d || (view3dPending ? null : placement);
  return (
    <div className={s.printSide}>
      <div className={s.printSideHead}><span>{title}</span></div>
      <div className={s.printSideImgs}>
        <SideImage src={where} pending={view3dPending} tag="სად დაიბეჭდოს" alt={`${title} — სად დაიბეჭდოს`} onZoom={onZoom} />
        <SideImage src={print} kind="art" tag="ბეჭდვის ფაილი" alt={`${title} — ბეჭდვის ფაილი`} onZoom={onZoom} />
      </div>
      {print && (
        <a className={s.printDownload} href={print} download={printName}>⬇ ბეჭდვის ფაილი (PNG)</a>
      )}
    </div>
  );
}

/**
 * Front / back of a custom item, rebuilt from its saved layers so every
 * order (old ones too) shows each side in 3D, where it is printed, and the
 * print file. Falls back to the files stored with the order.
 */
function ItemDesign({ design, baseName, onZoom }) {
  const [layers, setLayers] = useState(null);
  const [built, setBuilt] = useState(null); // { front, back } or 'failed'
  const [shots, setShots] = useState(null); // 3D photos { front, back }

  useEffect(() => {
    if (!design.layersFile) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await (await fetch(fileUrl(design.layersFile))).json();
        const { renderPlacement, renderSidePrint } = await import('../../lib/placement');
        const side = async (name) => ({
          placement: await renderPlacement(data, name),
          print: await renderSidePrint(data, name),
        });
        const result = { front: await side('front'), back: await side('back') };
        if (!cancelled) { setLayers(data); setBuilt(result); }
      } catch {
        if (!cancelled) setBuilt('failed');
      }
    })();
    return () => { cancelled = true; };
  }, [design.layersFile]);

  if (design.layersFile && built === null) return <div className={s.muted} style={{ fontSize: 12.5, marginTop: 8 }}>განლაგება მზადდება…</div>;

  const fromLayers = built && built !== 'failed';
  const stored3d = { front: design.previewFile && fileUrl(design.previewFile), back: design.backPreviewFile && fileUrl(design.backPreviewFile) };
  const sideData = (name) => (fromLayers
    ? { ...built[name], view3d: shots ? shots[name] ?? null : null, pending: !shots && !!built[name].placement }
    : {
        placement: null,
        print: (name === 'front' ? design.printFile : design.backPrintFile)
          && downloadUrl(name === 'front' ? design.printFile : design.backPrintFile, `${baseName}-${name}.png`),
        view3d: stored3d[name],
        pending: false,
      });
  const front = sideData('front');
  const back = sideData('back');

  return (
    <>
      {fromLayers && layers && !shots && (
        <Suspense fallback={null}>
          <Snapshot3D layers={layers} onDone={(r) => setShots({ front: r.front ?? stored3d.front, back: r.back ?? stored3d.back })} />
        </Suspense>
      )}
      <div className={s.printSides}>
        <PrintSide title="წინა მხარე" view3d={front.view3d} view3dPending={front.pending} placement={front.placement} print={front.print} printName={`${baseName}-front.png`} onZoom={onZoom} />
        <PrintSide title="უკანა მხარე" view3d={back.view3d} view3dPending={back.pending} placement={back.placement} print={back.print} printName={`${baseName}-back.png`} onZoom={onZoom} />
      </div>
    </>
  );
}

function StatusBadge({ status }) {
  const st = STATUS_BY_KEY[status];
  return <span className={`${s.badge} ${s[`tone-${st?.tone}`]}`}>{st?.label ?? status}</span>;
}

function OrderDrawer({ order, onClose, onSaved }) {
  const [note, setNote] = useState(order.adminNote || '');
  const [zoom, setZoom] = useState(null); // image shown full size
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
                {!it.design && <div className={s.itemPreview}>დიზაინის გარეშე</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={s.strong}>{it.name}</div>
                  <div className={s.muted} style={{ fontSize: 12.5 }}>
                    {[CATEGORY_LABELS[it.category] ?? it.category, it.size || 'ერთი ზომა', colorName(it.color)].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    {it.quantity} × {gel(it.unitPrice)} = <b>{gel(it.lineTotal)}</b>
                  </div>
                  {it.design && (
                    <>
                      <ItemDesign design={it.design} baseName={`${order.number}-${i + 1}`} onZoom={setZoom} />
                      {it.design.layersFile && (
                        <div className={s.itemLinks}>
                          <a className={s.link} href={fileUrl(it.design.layersFile)} target="_blank" rel="noreferrer">ფენები (JSON)</a>
                        </div>
                      )}
                    </>
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
      {zoom && (
        <div className={s.zoomBack} onClick={() => setZoom(null)} role="dialog" aria-label="სურათი">
          <img src={zoom} alt="" className={s.zoomImg} />
          <button type="button" className={s.zoomClose} onClick={() => setZoom(null)} aria-label="დახურვა">×</button>
        </div>
      )}
    </>
  );
}

export default function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const openId = params.get('open') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [pageSize, setPageSize] = usePageSize('orders');
  const [query, setQuery] = useState(params.get('q') || '');
  const search = useDebounced(query.trim());
  // Drawer order fetched by id when it isn't on the current page (or after a save).
  const [fetched, setFetched] = useState(null);

  const setParam = useCallback((changes) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(changes).forEach(([k, v]) => { if (v) next.set(k, v); else next.delete(k); });
      return next;
    }, { replace: true });
  }, [setParams]);

  // A new search starts again from page 1.
  useEffect(() => {
    if (search !== (params.get('q') || '')) setParam({ q: search, page: '' });
  }, [search, params, setParam]);

  const { data, error, loading, reload } = useServerList(
    '/api/orders',
    { status, q: params.get('q') || '', page, pageSize },
    'შეკვეთები ვერ ჩაიტვირთა',
  );

  const row = openId ? data?.items.find((o) => o.id === openId) : null;
  const opened = !openId ? null : (fetched?.id === openId ? fetched : row) || null;

  // Opened from elsewhere (e.g. the dashboard) and not on this page: fetch it.
  useEffect(() => {
    if (!openId || !data || data.items.some((o) => o.id === openId)) return;
    api.get(`/api/orders/${openId}`).then((r) => setFetched(r.data)).catch(() => {});
  }, [openId, data]);

  const counts = data?.counts || {};
  const all = Object.values(counts).reduce((a, b) => a + b, 0);

  const saved = (updated) => {
    setFetched(updated);
    reload(); // status counts and filters may have changed
  };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>შეკვეთები</h1>
          <p className={s.sub}>{data ? `${all} შეკვეთა` : ' '}</p>
        </div>
        <button type="button" className={s.btnGhost} onClick={reload}>↻ განახლება</button>
      </div>

      <div className={s.tabs}>
        <button type="button" className={`${s.tab} ${!status ? s.tabOn : ''}`} onClick={() => setParam({ status: '', page: '' })}>
          ყველა <span className={s.tabCount}>{all}</span>
        </button>
        {ORDER_STATUSES.map((st) => (
          <button key={st.key} type="button" className={`${s.tab} ${status === st.key ? s.tabOn : ''}`} onClick={() => setParam({ status: st.key, page: '' })}>
            {st.label} <span className={s.tabCount}>{counts[st.key] || 0}</span>
          </button>
        ))}
      </div>

      <div className={s.toolbar}>
        <input
          className={s.search}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ძებნა: ნომერი, სახელი, ტელეფონი, ელფოსტა, მისამართი…"
        />
      </div>

      {error && <div className={s.error}>{error}</div>}
      {!data && !error && <div className={s.loading}>იტვირთება…</div>}
      {data && data.items.length === 0 && <div className={s.empty}>შეკვეთები ვერ მოიძებნა.</div>}

      {data?.items.length > 0 && (
        <div className={`${s.tableWrap} ${loading ? s.tableBusy : ''}`}>
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
              {data.items.map((o) => (
                <tr key={o.id} className={s.clickRow} onClick={() => setParam({ open: o.id })}>
                  <td className={`${s.strong} ${s.nowrap}`}>{o.number}</td>
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

      {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(n) => setParam({ page: n > 1 ? String(n) : '' })} onPageSize={(n) => { setPageSize(n); setParam({ page: '' }); }} />}

      {opened && <OrderDrawer key={opened.id} order={opened} onClose={() => setParam({ open: '' })} onSaved={saved} />}
    </div>
  );
}
