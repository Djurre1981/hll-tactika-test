const VARIANTS = {
  primary: "bg-accent text-white hover:opacity-90",
  secondary: "bg-surface text-text border border-border hover:border-accent",
  ghost: "text-muted hover:text-text",
};

export function Button({
  children,
  variant = "primary",
  className = "",
  type = "button",
  ...props
}) {
  const styles = VARIANTS[variant] || VARIANTS.primary;
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded px-3 py-1.5 text-sm font-medium transition ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
