import { Fragment, useEffect, useState } from 'react';
import adminApi from '../lib/adminApi';
import styles from './admin.module.css';

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

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    adminApi.get('/api/admin/users')
      .then((r) => { setUsers(Array.isArray(r.data) ? r.data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  if (loading) return <div className={styles.loading}>Loading users…</div>;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Users</h1>
        <input
          className={styles.searchInput}
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Joined</th>
              <th>Orders</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className={styles.emptyText}>No users found.</td></tr>
            )}
            {filtered.map((user) => {
              const isOpen = expanded === user.id;
              return (
                <Fragment key={user.id}>
                  <tr
                    className={`${styles.tableRow} ${isOpen ? styles.tableRowSelected : ''}`}
                    onClick={() => setExpanded(isOpen ? null : user.id)}
                  >
                    <td className={styles.customerName}>{user.name ?? '—'}</td>
                    <td>{user.email}</td>
                    <td>{user.phone ?? '—'}</td>
                    <td>
                      <span className={user.role === 'ADMIN' ? styles.adminChip : styles.customerChip}>
                        {user.role}
                      </span>
                    </td>
                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td>{user._count?.orders ?? 0}</td>
                  </tr>

                  {isOpen && (
                    <tr className={styles.detailRow}>
                      <td colSpan={6}>
                        <div className={styles.userOrders}>
                          <h4 className={styles.userOrdersTitle}>Order History</h4>
                          {user.orders?.length ? (
                            <table className={styles.subTable}>
                              <thead>
                                <tr>
                                  <th>Order ID</th>
                                  <th>Date</th>
                                  <th>Total</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {user.orders.map((order) => (
                                  <tr key={order.id}>
                                    <td>#{order.id.slice(-8).toUpperCase()}</td>
                                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                                    <td>₾{order.totalPrice.toFixed(2)}</td>
                                    <td>{STATUS_LABELS[order.status] ?? order.status}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>
                              No orders yet.
                            </p>
                          )}
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
