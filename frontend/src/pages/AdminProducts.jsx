import { useEffect, useState, useCallback } from 'react';
import adminApi from '../lib/adminApi';
import styles from './admin.module.css';

const CATEGORIES = ['TSHIRT', 'HOODIE', 'BAG'];
const CATEGORY_LABELS = { TSHIRT: 'T-Shirt', HOODIE: 'Hoodie', BAG: 'Tote Bag' };
const ALL_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'ONE SIZE'];

const EMPTY_FORM = {
  name: '',
  category: 'TSHIRT',
  basePrice: '',
  sizes: ['S', 'M', 'L', 'XL', '2XL'],
  mockupUrl: '',
  isActive: true,
};

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | product object
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchProducts = useCallback(() => {
    adminApi.get('/api/admin/products')
      .then((r) => { setProducts(Array.isArray(r.data) ? r.data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const openNew = () => {
    setEditing('new');
    setForm(EMPTY_FORM);
    setError('');
  };

  const openEdit = (product) => {
    setEditing(product);
    setForm({
      name: product.name,
      category: product.category,
      basePrice: String(product.basePrice),
      sizes: product.sizes,
      mockupUrl: product.mockupUrl,
      isActive: product.isActive,
    });
    setError('');
  };

  const toggleSize = (size) => {
    setForm((f) => ({
      ...f,
      sizes: f.sizes.includes(size) ? f.sizes.filter((s) => s !== size) : [...f.sizes, size],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const isNew = editing === 'new';
    const url = isNew ? '/api/products' : `/api/products/${editing.id}`;

    try {
      const res = await adminApi[isNew ? 'post' : 'patch'](url, {
        ...form,
        basePrice: parseFloat(form.basePrice),
      });
      if (res.data?.error) { setError(res.data.error); return; }
      setEditing(null);
      fetchProducts();
    } catch (err) {
      setError(err.response?.data?.error || 'Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (product) => {
    if (!confirm(`Deactivate "${product.name}"? It will be hidden from customers.`)) return;
    await adminApi.delete(`/api/products/${product.id}`);
    fetchProducts();
  };

  const handleReactivate = async (product) => {
    await adminApi.patch(`/api/products/${product.id}`, { isActive: true });
    fetchProducts();
  };

  if (loading) return <div className={styles.loading}>Loading products…</div>;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Products</h1>
        <button className={styles.btnPrimary} onClick={openNew}>+ Add Product</button>
      </div>

      {editing && (
        <div className={styles.formCard}>
          <div className={styles.formCardHeader}>
            <h2 className={styles.formCardTitle}>
              {editing === 'new' ? 'New Product' : `Edit: ${editing.name}`}
            </h2>
            <button className={styles.btnText} onClick={() => setEditing(null)}>✕ Close</button>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGrid}>
              <label className={styles.formLabel}>
                Name
                <input
                  className={styles.formInput}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="e.g. Standard Hoodie"
                />
              </label>

              <label className={styles.formLabel}>
                Category
                <select
                  className={styles.formSelect}
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </label>

              <label className={styles.formLabel}>
                Base Price (₾)
                <input
                  className={styles.formInput}
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.basePrice}
                  onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
                  required
                  placeholder="0.00"
                />
              </label>

              <label className={styles.formLabel}>
                Mockup Image URL
                <input
                  className={styles.formInput}
                  value={form.mockupUrl}
                  onChange={(e) => setForm((f) => ({ ...f, mockupUrl: e.target.value }))}
                  required
                  placeholder="https://…"
                />
              </label>
            </div>

            <div className={styles.formLabel} style={{ marginBottom: 16 }}>
              Available Sizes
              <div className={styles.sizeToggleGrid}>
                {ALL_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={`${styles.sizeToggle} ${form.sizes.includes(size) ? styles.sizeToggleActive : ''}`}
                    onClick={() => toggleSize(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {editing !== 'new' && (
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                Active — visible to customers
              </label>
            )}

            {error && <div className={styles.formError}>{error}</div>}

            <div className={styles.formActions}>
              <button type="submit" className={styles.btnPrimary} disabled={saving}>
                {saving ? 'Saving…' : editing === 'new' ? 'Create Product' : 'Save Changes'}
              </button>
              <button type="button" className={styles.btnSecondary} onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Base Price</th>
              <th>Sizes</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr><td colSpan={6} className={styles.emptyText}>No products yet.</td></tr>
            )}
            {products.map((product) => (
              <tr key={product.id} className={styles.tableRow}>
                <td className={styles.productName}>{product.name}</td>
                <td>{CATEGORY_LABELS[product.category] ?? product.category}</td>
                <td className={styles.price}>₾{product.basePrice.toFixed(2)}</td>
                <td>
                  <div className={styles.sizeList}>
                    {product.sizes.map((s) => (
                      <span key={s} className={styles.sizeChip}>{s}</span>
                    ))}
                  </div>
                </td>
                <td>
                  <span className={product.isActive ? styles.activeChip : styles.inactiveChip}>
                    {product.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div className={styles.tableActions}>
                    <button className={styles.btnText} onClick={() => openEdit(product)}>
                      Edit
                    </button>
                    {product.isActive ? (
                      <button className={styles.btnDanger} onClick={() => handleDeactivate(product)}>
                        Deactivate
                      </button>
                    ) : (
                      <button className={styles.btnText} onClick={() => handleReactivate(product)}>
                        Reactivate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
