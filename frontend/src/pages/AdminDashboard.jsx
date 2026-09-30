import { useEffect, useState } from 'react';
import adminApi from '../lib/adminApi';
import styles from './admin.module.css';

const CATEGORY_LABELS = { TSHIRT: 'T-Shirt', HOODIE: 'Hoodie', BAG: 'Tote Bag' };

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.get('/api/admin/analytics')
      .then((r) => { setAnalytics(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.loading}>Loading analytics…</div>;

  const top = analytics?.topProducts ?? [];
  const maxCount = top[0]?.orderCount || 1;

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Dashboard</h1>

      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Total Revenue</div>
          <div className={styles.metricValue}>
            ₾{(analytics?.totalRevenue ?? 0).toFixed(2)}
          </div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Active Orders</div>
          <div className={styles.metricValue}>{analytics?.activeOrdersCount ?? 0}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Top Products</div>
          <div className={styles.metricValue}>{top.length}</div>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Top Selling Products</h2>
        {top.length === 0 ? (
          <p className={styles.emptyText}>No sales data yet.</p>
        ) : (
          <div className={styles.topProductsList}>
            {top.map((product, i) => (
              <div key={product.id} className={styles.topProductRow}>
                <div className={styles.topProductRank}>#{i + 1}</div>
                <div>
                  <div className={styles.topProductName}>{product.name}</div>
                  <div className={styles.topProductCat}>
                    {CATEGORY_LABELS[product.category] ?? product.category}
                  </div>
                </div>
                <div className={styles.topProductStats}>
                  <div className={styles.topProductCount}>{product.orderCount} orders</div>
                  <div className={styles.topProductRevenue}>₾{product.revenue.toFixed(2)}</div>
                </div>
                <div className={styles.topProductBar}>
                  <div
                    className={styles.topProductBarFill}
                    style={{ width: `${(product.orderCount / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
