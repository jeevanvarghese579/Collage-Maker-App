export function Spinner({ size = 18, className = '' }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}

export function FullPageSpinner({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-ink-500">
      <Spinner size={28} />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export default Spinner;
