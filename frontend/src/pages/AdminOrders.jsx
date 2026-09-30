import { Fragment, useEffect, useState } from 'react';
import adminApi from '../lib/adminApi';
import { assetUrl } from '../lib/catalog';
import styles from './admin.module.css';

const STATUSES = ['PENDING', 'PRINTING', 'READY_FOR_PICKUP', 'SHIPPED', 'COMPLETED', 'CANCELLED'];

const STATUS_LABELS = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PRINTING: 'Printing',
  READY_FOR_PICKUP: 'Ready for Pickup',
  SHIPPED: 'Shipped',
  COMPLETED: 'Completed',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

const STATUS_COLORS = {
  PENDING:          { color: '#b45309', bg: '#fef3c7' },
  CONFIRMED:        { color: '#1d4ed8', bg: '#dbeafe' },
  PRINTING:         { color: '#6d28d9', bg: '#ede9fe' },
  READY_FOR_PICKUP: { color: '#0e7490', bg: '#cffafe' },
  SHIPPED:          { color: '#065f46', bg: '#d1fae5' },
  COMPLETED:        { color: '#15803d', bg: '#dcfce7' },
  DELIVERED:        { color: '#15803d', bg: '#dcfce7' },
  CANCELLED:        { color: '#b91c1c', bg: '#fee2e2' },
};

const CATEGORY_LABELS = { TSHIRT: 'T-Shirt', HOODIE: 'Hoodie', BAG: 'Tote Bag' };

const GARMENT_LABELS = { tshirt: 'T-Shirt', hoodie: 'Hoodie', hat: 'Hat', bag: 'Bag', pillow: 'Pillow Case' };

// Orders store only the grand total; shipping is whatever it adds on top of the items.
function shippingOf(order) {
  const items = order.items.reduce((sum, it) => sum + it.price, 0);
  return Math.max(0, Math.round((order.totalPrice - items) * 100) / 100);
}

function parseDesign(design) {
  if (!design?.canvasJson) return null;
  try {
    return typeof design.canvasJson === 'string' ? JSON.parse(design.canvasJson) : design.canvasJson;
  } catch {
    return null;
  }
}

// Design files live on the API host, so the <a download> attribute is ignored
// (cross-origin). Fetch as a blob to force a real download.
async function downloadFile(url, filename) {
  try {
    const res = await fetch(assetUrl(url));
    if (!res.ok) throw new Error(res.statusText);
    const href = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  } catch {
    alert('Could not download file.');
  }
}

function fileExt(url) {
  const m = /^data:image\/(\w+)/.exec(url) || /\.(\w+)$/.exec(url);
  return m ? m[1].replace('jpeg', 'jpg') : 'png';
}

function downloadDesignImages(design, itemId) {
  const images = parseDesign(design)?.images ?? [];
  if (images.length === 0) { alert('No uploaded images found in this design.'); return; }
  images.forEach((img, i) => downloadFile(img.src, `design_${itemId}_file_${i + 1}.${fileExt(img.src)}`));
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    adminApi.get('/api/admin/orders')
      .then((r) => { setOrders(Array.isArray(r.data) ? r.data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const updateStatus = async (orderId, status) => {
    setUpdatingStatus(true);
    try {
      const res = await adminApi.patch(`/api/orders/${orderId}/status`, { status });
      if (res.data) {
        const updated = res.data;
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: updated.status } : o)));
        setSelected((prev) => prev && prev.id === orderId ? { ...prev, status: updated.status } : prev);
      }
    } finally {
      setUpdatingStatus(false);
    }
  };

  const custName = (o) => o.customerName || o.user?.name || '—';
  const custEmail = (o) => o.customerEmail || o.user?.email || '';

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    return (
      o.id.toLowerCase().includes(q) ||
      custName(o).toLowerCase().includes(q) ||
      custEmail(o).toLowerCase().includes(q) ||
      (o.phone || '').toLowerCase().includes(q)
    );
  });

  if (loading) return <div className={styles.loading}>Loading orders…</div>;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Orders</h1>
        <input
          className={styles.searchInput}
          placeholder="Search by ID or customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className={styles.emptyText}>No orders found.</td></tr>
            )}
            {filtered.map((order) => {
              const sc = STATUS_COLORS[order.status] ?? { color: '#374151', bg: '#f3f4f6' };
              const isOpen = selected?.id === order.id;
              return (
                <Fragment key={order.id}>
                  <tr
                    className={`${styles.tableRow} ${isOpen ? styles.tableRowSelected : ''}`}
                    onClick={() => setSelected(isOpen ? null : order)}
                  >
                    <td className={styles.orderId}>#{order.id.slice(-8).toUpperCase()}</td>
                    <td>
                      <div className={styles.customerName}>{custName(order)}</div>
                      <div className={styles.customerEmail}>{custEmail(order) || order.phone}</div>
                    </td>
                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td>{order.items.length} item{order.items.length !== 1 ? 's' : ''}</td>
                    <td className={styles.price}>₾{order.totalPrice.toFixed(2)}</td>
                    <td>
                      <span
                        className={styles.statusBadge}
                        style={{ '--status-color': sc.color, '--status-bg': sc.bg }}
                      >
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </td>
                  </tr>

                  {isOpen && (
                    <tr className={styles.detailRow}>
                      <td colSpan={6}>
                        <div className={styles.orderDetail}>
                          <div className={styles.orderDetailGrid}>
                            {/* Customer info */}
                            <div className={styles.detailSection}>
                              <h3 className={styles.detailSectionTitle}>Customer &amp; Shipping</h3>
                              <div className={styles.infoGrid}>
                                <span className={styles.infoLabel}>Name</span>
                                <span>{custName(order)}</span>
                                <span className={styles.infoLabel}>Email</span>
                                <span>{custEmail(order) || '—'}</span>
                                <span className={styles.infoLabel}>Phone</span>
                                <span>{order.phone ?? '—'}</span>
                                <span className={styles.infoLabel}>Address</span>
                                <span>{order.address}</span>
                                {order.notes && (
                                  <>
                                    <span className={styles.infoLabel}>Notes</span>
                                    <span>{order.notes}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Status update */}
                            <div className={styles.detailSection}>
                              <h3 className={styles.detailSectionTitle}>Update Status</h3>
                              <select
                                className={styles.statusSelect}
                                value={order.status}
                                disabled={updatingStatus}
                                onChange={(e) => updateStatus(order.id, e.target.value)}
                              >
                                {STATUSES.map((s) => (
                                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                ))}
                              </select>
                              {updatingStatus && (
                                <span className={styles.updatingText}>Saving…</span>
                              )}
                            </div>
                          </div>

                          {/* Items */}
                          <h3 className={styles.detailSectionTitle}>
                            Order Items
                            {shippingOf(order) > 0 && ` · Shipping ₾${shippingOf(order).toFixed(2)}`}
                          </h3>
                          <div className={styles.orderItems}>
                            {order.items.map((item) => {
                              const design = parseDesign(item.design);
                              const texts = (design?.texts ?? []).filter((t) => t.visible !== false && t.text);
                              return (
                              <div key={item.id} className={styles.orderItemCard}>
                                <div className={styles.orderItemImages}>
                                  {item.design?.previewUrl ? (
                                    <img
                                      src={assetUrl(item.design.previewUrl)}
                                      alt="Design preview"
                                      className={styles.designPreview}
                                    />
                                  ) : item.product?.mockupUrl ? (
                                    <img
                                      src={assetUrl(item.product.mockupUrl)}
                                      alt="Product mockup"
                                      className={styles.designPreview}
                                    />
                                  ) : (
                                    <div className={styles.noPreview}>No Preview</div>
                                  )}
                                </div>

                                <div className={styles.orderItemDetails}>
                                  <div className={styles.orderItemName}>
                                    {item.product?.name ?? 'Unknown Product'}
                                  </div>
                                  <div className={styles.orderItemMeta}>
                                    <span className={styles.metaTag}>
                                      {CATEGORY_LABELS[item.product?.category] ?? item.product?.category}
                                    </span>
                                    <span className={styles.metaTag}>Size: {item.size}</span>
                                    {item.color && (
                                      <span className={styles.metaTag}>Color: {item.color}</span>
                                    )}
                                    <span className={styles.metaTag}>Qty: {item.quantity}</span>
                                    {design?.garment && (
                                      <span className={styles.metaTag}>
                                        Designed on: {GARMENT_LABELS[design.garment] ?? design.garment}
                                        {design.gender ? ` (${design.gender})` : ''}
                                      </span>
                                    )}
                                  </div>
                                  {texts.map((t) => (
                                    <div key={t.id} className={styles.orderItemMeta}>
                                      Text: “{t.text}” · {t.fontFamily || 'Arial'} {Math.round(t.fontSize ?? 28)}px
                                      {t.fontWeight === 'bold' ? ' bold' : ''}{t.fontStyle === 'italic' ? ' italic' : ''} · {t.fill}
                                    </div>
                                  ))}
                                  <div className={styles.orderItemPrice}>
                                    ₾{item.price.toFixed(2)}
                                  </div>
                                </div>

                                {item.design && (
                                  <div className={styles.orderItemActions}>
                                    {design?.printUrl && (
                                      <button
                                        className={styles.downloadBtn}
                                        onClick={() => downloadFile(design.printUrl, `print_${item.id}.png`)}
                                      >
                                        ↓ Print File
                                      </button>
                                    )}
                                    <button
                                      className={styles.downloadBtn}
                                      onClick={() => downloadDesignImages(item.design, item.id)}
                                    >
                                      ↓ Download Original
                                    </button>
                                    {item.design.previewUrl && (
                                      <button
                                        className={styles.downloadBtn}
                                        onClick={() => downloadFile(item.design.previewUrl, `mockup_${item.id}.${fileExt(item.design.previewUrl)}`)}
                                      >
                                        ↓ Download Mockup
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
