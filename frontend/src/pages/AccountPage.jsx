import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/auth-context';

const STATUS_LABELS = {
  PENDING: 'მიღებულია',
  PRINTING: 'ბეჭდვაში',
  READY_FOR_PICKUP: 'მზადაა',
  SHIPPED: 'გზაშია',
  COMPLETED: 'ჩაბარებულია',
  CANCELLED: 'გაუქმებულია',
};

export default function AccountPage() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    api.get('/api/orders/mine').then((r) => setOrders(r.data)).catch(() => setOrders([]));
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
      <h1 className="font-display text-3xl text-navy">ჩემი ანგარიში</h1>

      <section className="mt-8 rounded-3xl border border-line bg-white p-8 shadow-sm">
        <dl className="grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold tracking-wide text-ink uppercase">სახელი</dt>
            <dd className="mt-1 text-lg font-semibold text-navy">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-ink uppercase">ელ-ფოსტა</dt>
            <dd className="mt-1 text-lg font-semibold break-all text-navy">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-ink uppercase">როლი</dt>
            <dd className="mt-1">
              <span className="inline-block rounded-full bg-coral/10 px-3 py-1 text-sm font-semibold text-coral">
                {user.role}
              </span>
            </dd>
          </div>
          {user.createdAt && (
            <div>
              <dt className="text-xs font-semibold tracking-wide text-ink uppercase">რეგისტრაცია</dt>
              <dd className="mt-1 text-lg font-semibold text-navy">
                {new Date(user.createdAt).toLocaleDateString('ka-GE')}
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-8 flex flex-wrap gap-3">
          {isAdmin && (
            <Link
              to="/admin/dashboard"
              className="rounded-full bg-navy px-6 py-2.5 font-bold text-white transition hover:bg-coral hover:text-white!"
            >
              ადმინ პანელი
            </Link>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="cursor-pointer rounded-full border border-navy px-6 py-2.5 font-bold text-navy transition hover:bg-navy hover:text-white"
          >
            გასვლა
          </button>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-line bg-white p-8 shadow-sm">
        <h2 className="text-lg font-bold text-navy">ჩემი შეკვეთები</h2>
        {orders === null && <p className="mt-4 text-ink">იტვირთება…</p>}
        {orders?.length === 0 && (
          <p className="mt-4 text-ink">
            შეკვეთები ჯერ არ გაქვს. <Link to="/shop" className="font-semibold text-coral">მაღაზიაში გადასვლა →</Link>
          </p>
        )}
        {orders?.length > 0 && (
          <ul className="mt-4 divide-y divide-line">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="font-semibold text-navy">{o.number}</div>
                  <div className="text-sm text-ink">
                    {new Date(o.createdAt).toLocaleDateString('ka-GE')} · {o.items.reduce((n, it) => n + it.quantity, 0)} ცალი
                  </div>
                </div>
                <span className="rounded-full bg-coral/10 px-3 py-1 text-sm font-semibold text-coral">
                  {STATUS_LABELS[o.status] ?? o.status}
                </span>
                <span className="font-bold text-navy">{Math.round(o.total)} ₾</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
