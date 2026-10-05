import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { CATEGORY_LABELS } from '../../lib/catalog';
import { ORDER_STATUSES, STATUS_BY_KEY, gel, getErrorMessage, shortDate } from './adminShared';
import s from './Admin.module.css';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/admin/stats')
      .then((r) => setStats(r.data))
      .catch((e) => setError(getErrorMessage(e, 'მონაცემები ვერ ჩაიტვირთა')));
  }, []);

  if (error) return <div className={s.error}>{error}</div>;
  if (!stats) return <div className={s.loading}>იტვირთება…</div>;

  const maxDay = Math.max(1, ...stats.days.map((d) => d.total));
  const totalByStatus = Math.max(1, ...Object.values(stats.statusCounts));
  const last30 = stats.days.reduce((sum, d) => sum + d.total, 0);

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>მიმოხილვა</h1>
          <p className={s.sub}>მაღაზიის მდგომარეობა ერთ გვერდზე</p>
        </div>
        <Link to="/admin/orders" className={s.btn}>ყველა შეკვეთა →</Link>
      </div>

      <div className={s.kpis}>
        <div className={`${s.kpi} ${s.kpiAccent}`}>
          <span className={s.kpiLabel}>შემოსავალი</span>
          <span className={s.kpiValue}>{gel(stats.revenue)}</span>
          <span className={s.kpiHint}>ბოლო 30 დღე: {gel(last30)}</span>
        </div>
        <div className={s.kpi}>
          <span className={s.kpiLabel}>შეკვეთები</span>
          <span className={s.kpiValue}>{stats.orders}</span>
          <span className={s.kpiHint}>დღეს: {stats.todayOrders}</span>
        </div>
        <div className={s.kpi}>
          <span className={s.kpiLabel}>დასამუშავებელი</span>
          <span className={s.kpiValue}>{stats.openOrders}</span>
          <span className={s.kpiHint}>ახალი, ბეჭდვაში, მზადაა, გზაში</span>
        </div>
        <div className={s.kpi}>
          <span className={s.kpiLabel}>საშუალო შეკვეთა</span>
          <span className={s.kpiValue}>{gel(stats.averageOrder)}</span>
          <span className={s.kpiHint}>გაუქმებულების გარეშე</span>
        </div>
        <div className={s.kpi}>
          <span className={s.kpiLabel}>პროდუქტები</span>
          <span className={s.kpiValue}>{stats.activeProducts}</span>
          <span className={s.kpiHint}>სულ {stats.products} · მომხმარებელი {stats.users}</span>
        </div>
      </div>

      <div className={s.grid2}>
        <div className={s.card}>
          <div className={s.cardHead}>
            <h2 className={s.cardTitle}>გაყიდვები — ბოლო 30 დღე</h2>
            <span className={s.muted}>{gel(last30)}</span>
          </div>
          <div className={s.chart}>
            {stats.days.map((d, i) => (
              <div
                key={d.date}
                className={`${s.bar} ${i === stats.days.length - 1 ? s.barToday : ''}`}
                style={{ height: `${Math.max(2, (d.total / maxDay) * 100)}%` }}
                title={`${shortDate(d.date)}: ${gel(d.total)} · ${d.count} შეკვეთა`}
              />
            ))}
          </div>
          <div className={s.chartAxis}>
            <span>{shortDate(stats.days[0]?.date)}</span>
            <span>დღეს</span>
          </div>
        </div>

        <div className={s.card}>
          <h2 className={s.cardTitle}>შეკვეთები სტატუსით</h2>
          <div className={s.statusBars}>
            {ORDER_STATUSES.map((st) => (
              <button
                key={st.key}
                type="button"
                className={s.statusLine}
                style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', textAlign: 'left' }}
                onClick={() => navigate(`/admin/orders?status=${st.key}`)}
              >
                <span>{st.label}</span>
                <span className={s.track}>
                  <span className={s[`toneFill-${st.tone}`]} style={{ width: `${(stats.statusCounts[st.key] / totalByStatus) * 100}%` }} />
                </span>
                <span className={`${s.num} ${s.right}`}>{stats.statusCounts[st.key]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={s.grid2}>
        <div className={s.card}>
          <div className={s.cardHead}>
            <h2 className={s.cardTitle}>ბოლო შეკვეთები</h2>
            <Link to="/admin/orders" className={s.link}>ყველა</Link>
          </div>
          {stats.recentOrders.length === 0 ? (
            <div className={s.muted}>შეკვეთები ჯერ არ არის.</div>
          ) : (
            <div className={s.rows}>
              {stats.recentOrders.map((o) => {
                const st = STATUS_BY_KEY[o.status];
                return (
                  <div key={o.id} className={`${s.row} ${s.clickRow}`} onClick={() => navigate(`/admin/orders?open=${o.id}`)}>
                    <div className={s.rowMain}>
                      <div className={s.rowName}>{o.number} · {o.customerName}</div>
                      <div className={s.rowSub}>{shortDate(o.createdAt, true)} · {o.items.length} პროდუქტი</div>
                    </div>
                    <span className={`${s.badge} ${s[`tone-${st?.tone}`]}`}>{st?.label ?? o.status}</span>
                    <span className={s.rowEnd}>{gel(o.total)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={s.card}>
          <h2 className={s.cardTitle}>ყველაზე გაყიდვადი</h2>
          {stats.topProducts.length === 0 ? (
            <div className={s.muted}>გაყიდვები ჯერ არ არის.</div>
          ) : (
            <div className={s.rows}>
              {stats.topProducts.map((p, i) => (
                <div key={p.id} className={s.row}>
                  <span className={s.muted} style={{ width: 18 }}>{i + 1}</span>
                  <div className={s.rowMain}>
                    <div className={s.rowName}>{p.name}</div>
                    <div className={s.rowSub}>{CATEGORY_LABELS[p.category] ?? p.category} · {p.quantity} ცალი</div>
                  </div>
                  <span className={s.rowEnd}>{gel(p.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
