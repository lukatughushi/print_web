// Shared Tailwind building blocks for the login / register forms.

export function AuthCard({ title, subtitle, children, footer }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-cream/40 px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-line bg-white p-8 shadow-sm sm:p-10">
        <h1 className="font-display text-3xl text-navy">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-ink">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <p className="mt-6 text-center text-sm text-ink">{footer}</p>}
      </div>
    </main>
  );
}

export function Field({ label, id, ...inputProps }) {
  return (
    <div className="mb-5">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-navy">
        {label}
      </label>
      <input
        id={id}
        className="w-full rounded-xl border border-line bg-white px-4 py-3 text-navy outline-none transition placeholder:text-ink/50 focus:border-coral focus:ring-4 focus:ring-coral/15"
        {...inputProps}
      />
    </div>
  );
}

export function SubmitButton({ loading, children }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="mt-2 w-full cursor-pointer rounded-full bg-coral px-6 py-3 font-bold text-white transition hover:bg-navy disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? '...' : children}
    </button>
  );
}

export function FormError({ message }) {
  if (!message) return null;
  return (
    <p role="alert" className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
      {message}
    </p>
  );
}
